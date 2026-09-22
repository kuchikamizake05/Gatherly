import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { requireCsrf, requireSession, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { requireOrganizer } from "../authorization/authorization.middleware.js";
import { CommitteeAssignment } from "../committee/committee-assignment.model.js";
import { User } from "../auth/auth.models.js";
import { Event, TicketType } from "./event.models.js";

const date = z.coerce.date();
const eventSchema = z.object({
  title: z.string().trim().min(2).max(160), description: z.string().trim().min(1).max(5_000),
  category: z.string().trim().min(2).max(80), startsAt: date, endsAt: date,
  timezone: z.string().trim().min(1).max(100), venueName: z.string().trim().min(2).max(160),
  address: z.string().trim().min(2).max(300), city: z.string().trim().min(2).max(100),
  posterAssetId: z.string().trim().min(1).optional(),
}).refine((data) => data.endsAt > data.startsAt, { message: "endsAt must be after startsAt", path: ["endsAt"] });
const ticketSchema = z.object({
  name: z.string().trim().min(2).max(80), description: z.string().trim().min(1).max(500),
  price: z.number().int().positive(), capacity: z.number().int().positive(), salesStartsAt: date, salesEndsAt: date,
});

function invalid(result: { success: false }) { throw new AppError(400, "VALIDATION_ERROR", "Please check the submitted fields."); }
function slugify(value: string) { return `${value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Math.random().toString(36).slice(2, 8)}`; }
function dto(event: any) { return { id: event._id.toString(), slug: event.slug, title: event.title, description: event.description, category: event.category, startsAt: event.startsAt, endsAt: event.endsAt, timezone: event.timezone, venueName: event.venueName, address: event.address, city: event.city, posterAssetId: event.posterAssetId ?? null, publicationStatus: event.publicationStatus, salesClosed: event.salesClosed }; }
async function owned(request: AuthenticatedRequest) {
  const id = String(request.params.id);
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "NOT_FOUND", "Event not found.");
  const event = await Event.findOne({ _id: id, organizerId: request.auth!.organizerId });
  if (!event) throw new AppError(404, "NOT_FOUND", "Event not found.");
  return event;
}

export const eventRouter = Router();
eventRouter.use(requireSession, requireOrganizer);
eventRouter.get("/", asyncHandler(async (request: AuthenticatedRequest, response) => {
  const events = await Event.find({ organizerId: request.auth!.organizerId }).sort({ startsAt: -1 });
  response.json({ data: events.map(dto) });
}));
eventRouter.post("/", requireCsrf, asyncHandler(async (request: AuthenticatedRequest, response) => {
  const parsed = eventSchema.safeParse(request.body); if (!parsed.success) invalid(parsed);
  if (parsed.data!.startsAt <= new Date()) throw new AppError(400, "VALIDATION_ERROR", "The event must start in the future.");
  const event = await Event.create({ ...parsed.data!, organizerId: new Types.ObjectId(request.auth!.organizerId), slug: slugify(parsed.data!.title) });
  response.status(201).json({ data: dto(event) });
}));
eventRouter.get("/:id", asyncHandler(async (request: AuthenticatedRequest, response) => { response.json({ data: dto(await owned(request)) }); }));
eventRouter.patch("/:id", requireCsrf, asyncHandler(async (request: AuthenticatedRequest, response) => {
  const parsed = eventSchema.innerType().partial().safeParse(request.body); if (!parsed.success) invalid(parsed);
  const event = await owned(request); Object.assign(event, parsed.data!);
  if (event.endsAt <= event.startsAt) throw new AppError(400, "VALIDATION_ERROR", "endsAt must be after startsAt");
  await event.save(); response.json({ data: dto(event) });
}));
eventRouter.delete("/:id", requireCsrf, asyncHandler(async (request: AuthenticatedRequest, response) => {
  const event = await owned(request); if (event.publicationStatus !== "draft") throw new AppError(409, "CONFLICT", "Only draft events can be deleted.");
  await TicketType.deleteMany({ eventId: event._id }); await event.deleteOne(); response.status(204).send();
}));
eventRouter.post("/:id/publish", requireCsrf, asyncHandler(async (request: AuthenticatedRequest, response) => {
  const event = await owned(request); const types = await TicketType.find({ eventId: event._id });
  if (!event.posterAssetId || types.length === 0) throw new AppError(409, "CONFLICT", "A poster and at least one ticket type are required.");
  event.publicationStatus = "published"; await event.save(); response.json({ data: dto(event) });
}));
eventRouter.post("/:id/ticket-types", requireCsrf, asyncHandler(async (request: AuthenticatedRequest, response) => {
  const event = await owned(request); const parsed = ticketSchema.safeParse(request.body); if (!parsed.success) invalid(parsed);
  if (parsed.data!.salesEndsAt <= parsed.data!.salesStartsAt || parsed.data!.salesEndsAt > event.startsAt) throw new AppError(400, "VALIDATION_ERROR", "Invalid ticket sales period.");
  const ticket = await TicketType.create({ ...parsed.data!, eventId: event._id }); response.status(201).json({ data: { id: ticket._id.toString(), ...parsed.data!, available: ticket.capacity } });
}));
eventRouter.patch("/:id/ticket-types/:typeId", requireCsrf, asyncHandler(async (request: AuthenticatedRequest, response) => {
  const event = await owned(request); const parsed = ticketSchema.partial().safeParse(request.body); if (!parsed.success) invalid(parsed);
  const ticket = await TicketType.findOne({ _id: request.params.typeId, eventId: event._id }); if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket type not found.");
  if (parsed.data!.capacity !== undefined && parsed.data!.capacity < ticket.sold + ticket.reserved) throw new AppError(409, "CONFLICT", "Capacity cannot be below sold or reserved tickets.");
  Object.assign(ticket, parsed.data!); await ticket.save(); response.json({ data: { id: ticket._id.toString(), ...ticket.toObject(), available: ticket.capacity - ticket.sold - ticket.reserved } });
}));
eventRouter.delete("/:id/ticket-types/:typeId", requireCsrf, asyncHandler(async (request: AuthenticatedRequest, response) => {
  const event = await owned(request); const ticket = await TicketType.findOne({ _id: request.params.typeId, eventId: event._id }); if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket type not found.");
  if (ticket.sold + ticket.reserved > 0) throw new AppError(409, "CONFLICT", "Ticket type already has orders.");
  await ticket.deleteOne(); response.status(204).send();
}));
eventRouter.get("/:id/committee", asyncHandler(async (request: AuthenticatedRequest, response) => {
  const event = await owned(request); const assignments = await CommitteeAssignment.find({ eventId: event._id }).populate("userId", "name emailNormalized");
  response.json({ data: assignments.map((assignment: any) => ({ userId: assignment.userId._id.toString(), name: assignment.userId.name, email: assignment.userId.emailNormalized })) });
}));
eventRouter.post("/:id/committee", requireCsrf, asyncHandler(async (request: AuthenticatedRequest, response) => {
  const event = await owned(request); const parsed = z.object({ email: z.string().trim().email() }).safeParse(request.body); if (!parsed.success) invalid(parsed);
  const user = await User.findOne({ emailNormalized: parsed.data!.email.toLowerCase() }); if (!user) throw new AppError(404, "NOT_FOUND", "User not found.");
  const exists = await CommitteeAssignment.exists({ eventId: event._id, userId: user._id }); if (exists) throw new AppError(409, "CONFLICT", "Committee member already assigned.");
  await CommitteeAssignment.create({ eventId: event._id, userId: user._id, assignedBy: request.auth!.user._id }); response.status(201).json({ data: { userId: user._id.toString(), name: user.name, email: user.emailNormalized } });
}));
eventRouter.delete("/:id/committee/:userId", requireCsrf, asyncHandler(async (request: AuthenticatedRequest, response) => {
  const event = await owned(request); const result = await CommitteeAssignment.deleteOne({ eventId: event._id, userId: request.params.userId }); if (result.deletedCount === 0) throw new AppError(404, "NOT_FOUND", "Committee assignment not found."); response.status(204).send();
}));
