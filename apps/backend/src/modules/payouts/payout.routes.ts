import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { requireSession, requireCsrf, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { requireOrganizer } from "../authorization/authorization.middleware.js";
import { requireAdmin } from "../admin/admin.middleware.js";
import { Event } from "../events/event.models.js";
import { Order } from "../orders/order.model.js";
import { Refund } from "../refunds/refund.model.js";
import { validId } from "../refunds/refund.service.js";
import { BankAccount, Payout } from "./payout.model.js";
import { Organizer } from "../organizers/organizer.model.js";
import { queueEmail } from "../notifications/email.service.js";
import { payoutDoneEmail } from "../notifications/email-templates.js";

async function eventBalance(eventId: mongoose.Types.ObjectId, session?: mongoose.ClientSession) {
  const rows = await Order.find({ eventId, paymentStatus: "paid" })
    .session(session ?? null)
    .lean();
  return rows.reduce(
    (sum, order) =>
      sum +
      Math.max(
        0,
        (order.subtotalAmount ?? order.unitPrice * order.quantity) -
          (order.refundedBaseAmount ?? 0),
      ),
    0,
  );
}
function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new AppError(400, "VALIDATION_ERROR", "Please check the submitted fields.");
  return r.data;
}
export const payoutRouter = Router();
payoutRouter.use(requireSession, requireOrganizer);
payoutRouter.get(
  "/bank-account",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const account = await BankAccount.findOne({ organizerId: req.auth!.organizerId }).lean();
    res.json({
      data: account
        ? {
            bank: account.bank,
            accountNumber: `••••${account.accountNumber.slice(-4)}`,
            holderName: account.holderName,
          }
        : null,
    });
  }),
);
payoutRouter.put(
  "/bank-account",
  requireCsrf,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = parse(
      z.object({
        bank: z.string().trim().min(2).max(80),
        accountNumber: z.string().regex(/^\d{5,30}$/),
        holderName: z.string().trim().min(2).max(100),
      }),
      req.body,
    );
    await BankAccount.findOneAndUpdate(
      { organizerId: req.auth!.organizerId },
      { $set: input },
      { upsert: true },
    );
    res.json({ data: { ...input, accountNumber: `••••${input.accountNumber.slice(-4)}` } });
  }),
);
payoutRouter.get(
  "/payouts",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const events = await Event.find({ organizerId: req.auth!.organizerId }).sort({ startsAt: -1 });
    const rows = [];
    for (const event of events) {
      const [payout, outstanding, net] = await Promise.all([
        Payout.findOne({ eventId: event._id }),
        Refund.exists({
          eventId: event._id,
          status: { $in: ["approved", "processing", "manual_required"] },
        }),
        eventBalance(event._id),
      ]);
      const status =
        payout?.status ??
        (event.endsAt > new Date() ||
        outstanding ||
        event.cancellationStatus === "requested" ||
        event.publicationStatus === "cancelled"
          ? "waiting_event"
          : "available");
      rows.push({
        eventId: event._id.toString(),
        eventTitle: event.title,
        eventDate: event.startsAt,
        net: payout?.amount ?? net,
        status,
        requestedAt: payout?.requestedAt ?? null,
        transferredAt: payout?.transferredAt ?? null,
        transferReference: payout?.transferReference ?? null,
      });
    }
    res.json({
      data: {
        available: rows.filter((r) => r.status === "available").reduce((n, r) => n + r.net, 0),
        processing: rows.filter((r) => r.status === "requested").reduce((n, r) => n + r.net, 0),
        transferred: rows.filter((r) => r.status === "transferred").reduce((n, r) => n + r.net, 0),
        rows,
      },
    });
  }),
);
payoutRouter.post(
  "/payouts",
  requireCsrf,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { eventId } = parse(z.object({ eventId: z.string().regex(/^[a-f\d]{24}$/i) }), req.body);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const event = await Event.findOneAndUpdate(
          { _id: validId(eventId), organizerId: req.auth!.organizerId },
          { $inc: { financialVersion: 1 } },
          { session, returnDocument: "after" },
        );
        if (!event) throw new AppError(404, "NOT_FOUND", "Event not found.");
        if (
          event.endsAt > new Date() ||
          event.publicationStatus !== "published" ||
          event.cancellationStatus === "requested"
        )
          throw new AppError(409, "PAYOUT_UNAVAILABLE", "Only completed events can be paid out.");
        if (
          await Refund.exists({
            eventId: event._id,
            status: { $in: ["approved", "processing", "manual_required"] },
          }).session(session)
        )
          throw new AppError(
            409,
            "REFUNDS_PENDING",
            "Approved refunds must finish before a payout.",
          );
        if (await Payout.exists({ eventId: event._id }).session(session))
          throw new AppError(409, "PAYOUT_EXISTS", "Payout already requested.");
        const bank = await BankAccount.findOne({ organizerId: req.auth!.organizerId }).session(
          session,
        );
        if (!bank)
          throw new AppError(
            409,
            "BANK_REQUIRED",
            "Save a bank account before requesting a payout.",
          );
        const amount = await eventBalance(event._id, session);
        if (amount <= 0) throw new AppError(409, "NO_BALANCE", "There is no balance to pay out.");
        await Payout.create(
          [
            {
              organizerId: event.organizerId,
              eventId: event._id,
              amount,
              bank: bank.bank,
              accountNumber: bank.accountNumber,
              holderName: bank.holderName,
              status: "requested",
              requestedAt: new Date(),
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    res.status(201).json({ data: { eventId, status: "requested" } });
  }),
);

export const adminPayoutRouter = Router();
adminPayoutRouter.use(requireAdmin);
adminPayoutRouter.get(
  "/payouts",
  asyncHandler(async (req, res) => {
    const query = parse(
      z.object({
        tab: z.enum(["requested", "transferred"]).default("requested"),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
      req.query,
    );
    const filter = { status: query.tab };
    const [rows, total, requested, transferred] = await Promise.all([
      Payout.find(filter)
        .sort({ requestedAt: query.tab === "requested" ? 1 : -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate("eventId", "title")
        .populate("organizerId", "name")
        .lean(),
      Payout.countDocuments(filter),
      Payout.countDocuments({ status: "requested" }),
      Payout.countDocuments({ status: "transferred" }),
    ]);
    res.json({
      data: rows.map((r: any) => ({
        id: r._id.toString(),
        eventId: r.eventId?._id.toString(),
        eventTitle: r.eventId?.title,
        organizerName: r.organizerId?.name,
        amount: r.amount,
        net: r.amount,
        bank: r.bank,
        accountNumber: r.accountNumber,
        holderName: r.holderName,
        status: r.status,
        requestedAt: r.requestedAt,
        transferredAt: r.transferredAt ?? null,
        transferReference: r.transferReference ?? null,
      })),
      meta: { page: query.page, limit: query.limit, total },
      counts: { requested, transferred },
    });
  }),
);
adminPayoutRouter.post(
  "/payouts/:id/transferred",
  asyncHandler(async (req: any, res) => {
    const input = parse(
      z.object({
        transferReference: z.string().trim().min(3).max(200),
        transferredAt: z.coerce
          .date()
          .refine((d) => d <= new Date(), "Transfer cannot be in future"),
      }),
      req.body,
    );
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const payout = await Payout.findById(validId(String(req.params.id))).session(session);
        if (!payout) throw new AppError(404, "NOT_FOUND", "Payout not found.");
        if (payout.status === "transferred")
          throw new AppError(409, "ALREADY_TRANSFERRED", "Payout already transferred.");
        await Event.updateOne(
          { _id: payout.eventId },
          { $inc: { financialVersion: 1 } },
          { session },
        );
        if (input.transferredAt < payout.requestedAt)
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Transfer date cannot precede the payout request.",
          );
        if (
          await Refund.exists({
            eventId: payout.eventId,
            status: { $in: ["approved", "processing", "manual_required"] },
          }).session(session)
        )
          throw new AppError(409, "REFUNDS_PENDING", "Refunds are still processing.");
        payout.status = "transferred";
        payout.transferredAt = input.transferredAt;
        payout.transferReference = input.transferReference;
        payout.transferredBy = validId(req.admin.id);
        await payout.save({ session });
        const org = await Organizer.findById(payout.organizerId).session(session);
        if (org)
          await queueEmail(
            payoutDoneEmail(`payout-${payout._id}`, org.contactEmail, payout.amount, input.transferReference),
            session,
          );
      });
    } finally {
      await session.endSession();
    }
    res.status(204).send();
  }),
);
