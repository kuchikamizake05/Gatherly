import { Event } from "../modules/events/event.models.js";
import { Ticket } from "../modules/tickets/ticket.model.js";
import { User } from "../modules/auth/auth.models.js";
import { queueEmail } from "../modules/notifications/email.service.js";
import { reminderEmail } from "../modules/notifications/email-templates.js";
export async function queueReminders(now = new Date()) {
  const events = await Event.find({
    publicationStatus: "published",
    startsAt: { $gt: now, $lte: new Date(now.getTime() + 24 * 3600_000) },
  }).limit(100);
  for (const event of events) {
    const tickets = await Ticket.find({ eventId: event._id, checkInStatus: { $ne: "cancelled" } });
    for (const ticket of tickets) {
      const user = await User.findOne({ emailNormalized: ticket.attendeeEmail });
      if (user?.notifications?.reminders === false) continue;
      const email = ticket.attendeeEmail;
      if (email)
        await queueEmail(
          reminderEmail(`reminder:${ticket.id}:${event.startsAt.toISOString()}`, email, {
            attendeeName: ticket.attendeeName,
            eventTitle: event.title,
            startsAt: event.startsAt,
            timezone: event.timezone,
            venueName: event.venueName,
            ticketCode: ticket.ticketCode,
          }),
        );
    }
  }
}
