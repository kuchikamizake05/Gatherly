import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { AppError } from "../../lib/app-error.js";
import { Event, TicketType } from "../events/event.models.js";
import { Organizer } from "../organizers/organizer.model.js";
import { User } from "../auth/auth.models.js";
import { Ticket } from "../tickets/ticket.model.js";
import { queueEmail } from "../notifications/email.service.js";
import { eventReportReviewedEmail } from "../notifications/email-templates.js";
import { parseInput } from "../account/account.schemas.js";
import { EventReport } from "./event-report.model.js";

export const reportInputSchema = z
  .object({
    reason: z.enum(["fraud", "wrong_info", "inappropriate", "other"]),
    note: z.string().trim().max(1000).default(""),
  })
  .strict()
  .refine((input) => input.reason !== "other" || input.note.length >= 10, {
    path: ["note"],
    message: "Please describe the issue using at least 10 characters.",
  });

export async function submitEventReport(slug: string, reporterId: string, raw: unknown) {
  const input = parseInput(reportInputSchema, raw);
  const event = await Event.findOne({
    slug,
    publicationStatus: { $in: ["published", "cancelled"] },
  }).lean();
  if (!event) throw new AppError(404, "NOT_FOUND", "Event was not found.");
  const organizer = await Organizer.findById(event.organizerId).lean();
  if (!organizer) throw new AppError(404, "NOT_FOUND", "Organizer was not found.");
  try {
    await EventReport.create({
      eventId: event._id,
      organizerId: organizer._id,
      reporterId,
      eventTitle: event.title,
      organizerName: organizer.name,
      ...input,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000)
      throw new AppError(
        409,
        "REPORT_EXISTS",
        "Your report for this event is already awaiting review.",
      );
    throw error;
  }
}

export async function listEventReports(tab: "new" | "done", page: number, limit: number) {
  const [reports, total, newCount, doneCount] = await Promise.all([
    EventReport.find({ status: tab })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    EventReport.countDocuments({ status: tab }),
    EventReport.countDocuments({ status: "new" }),
    EventReport.countDocuments({ status: "done" }),
  ]);
  return {
    data: reports.map((report) => ({
      id: report._id.toString(),
      eventTitle: report.eventTitle,
      organizerName: report.organizerName,
      reason: report.reason,
      createdAt: report.createdAt,
      status: report.status,
    })),
    meta: { page, limit, total },
    counts: { new: newCount, done: doneCount },
  };
}

export async function getEventReport(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "NOT_FOUND", "Report was not found.");
  const report = await EventReport.findById(id).lean();
  if (!report) throw new AppError(404, "NOT_FOUND", "Report was not found.");
  const [user, event, organizer, holder, types, recentReports] = await Promise.all([
    User.findById(report.reporterId).lean(),
    Event.findById(report.eventId).lean(),
    Organizer.findById(report.organizerId).lean(),
    Ticket.exists({ eventId: report.eventId, buyerId: report.reporterId }),
    TicketType.find({ eventId: report.eventId }).lean(),
    EventReport.countDocuments({
      organizerId: report.organizerId,
      _id: { $ne: report._id },
      createdAt: { $gte: new Date(Date.now() - 90 * 86_400_000) },
    }),
  ]);
  const sold = types.reduce((total, type) => total + type.sold, 0);
  const capacity = types.reduce((total, type) => total + type.capacity, 0);
  return {
    id: report._id.toString(),
    eventTitle: report.eventTitle,
    organizerName: report.organizerName,
    reason: report.reason,
    createdAt: report.createdAt,
    status: report.status,
    note: report.note,
    resolutionNote: report.resolutionNote ?? null,
    closedAt: report.closedAt ?? null,
    reporter: {
      email: user?.deletedAt
        ? "Deleted participant"
        : (user?.emailNormalized ?? "Deleted participant"),
      isTicketHolder: Boolean(holder),
    },
    event: {
      slug: event?.slug ?? "",
      title: report.eventTitle,
      startsAt: event?.startsAt ?? null,
      soldLabel: `Dijual, ${sold} dari ${capacity}`,
    },
    organizer: {
      id: report.organizerId.toString(),
      name: report.organizerName,
      username: organizer?.username ?? "",
      recentReports,
    },
  };
}

export async function closeEventReport(
  id: string,
  adminId: string,
  note: string,
  now = new Date(),
) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "NOT_FOUND", "Report was not found.");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const report = await EventReport.findOneAndUpdate(
        { _id: id, status: "new" },
        { $set: { status: "done", resolutionNote: note, closedBy: adminId, closedAt: now } },
        { session, returnDocument: "after" },
      );
      if (!report)
        throw new AppError(409, "REPORT_ALREADY_CLOSED", "Report is missing or already reviewed.");
      const reporter = await User.findOne({ _id: report.reporterId, deletedAt: { $exists: false } })
        .session(session)
        .lean();
      if (reporter)
        await queueEmail(
          eventReportReviewedEmail(
            `report-reviewed:${report._id}`,
            reporter.emailNormalized,
            report.eventTitle,
            note,
          ),
          session,
        );
    });
  } finally {
    await session.endSession();
  }
}
