import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { Order } from "../orders/order.model.js";
import { Ticket } from "../tickets/ticket.model.js";
import { EmailJob, queueEmail } from "./email.service.js";
import { orderSummaryEmail, ticketEmail } from "./email-templates.js";

async function ticketPdf(ticket: {
  attendeeName: string;
  ticketCode: string;
  qrToken: string;
  eventSnapshot: { title: string; startsAt: Date; venueName: string; timezone: string };
  ticketTypeSnapshot: { name: string };
}) {
  const qr = await QRCode.toBuffer(`gatherly:v1:${ticket.qrToken}`, { width: 240, margin: 2 });
  const doc = new PDFDocument({ size: "A5", margin: 32 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (b) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.fontSize(24).text("E-tiket Gatherlyy").moveDown();
  doc.fontSize(16).text(ticket.eventSnapshot.title).moveDown();
  doc
    .fontSize(11)
    .text(ticket.attendeeName)
    .text(ticket.ticketTypeSnapshot.name)
    .text(
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: ticket.eventSnapshot.timezone,
      }).format(ticket.eventSnapshot.startsAt),
    )
    .text(ticket.eventSnapshot.venueName)
    .moveDown()
    .text(ticket.ticketCode);
  doc
    .image(qr, { width: 200 })
    .moveDown()
    .fontSize(9)
    .text("Satu tiket hanya berlaku untuk satu kali check-in. Jaga kerahasiaan QR Anda.");
  doc.end();
  return done;
}

export async function notifyOrderTickets(orderId: string, resendKey?: string) {
  const order = await Order.findOne({
    _id: orderId,
    paymentStatus: "paid",
    issuanceStatus: "issued",
  });
  if (!order) return;
  const tickets = await Ticket.find({ orderId: order._id })
    .select("+qrToken")
    .sort({ sequence: 1 });
  for (const ticket of tickets) {
    const recipient =
      ticket.attendeeEmail ?? order.attendees[ticket.sequence]?.email ?? order.buyerSnapshot.email;
    const key = `ticket:${ticket.id}:${resendKey ?? "issued"}`;
    if (await EmailJob.exists({ key })) continue;
    const link = `${env.PUBLIC_WEB_URL}/tickets/shared/${ticket.qrToken}`;
    await queueEmail(
      ticketEmail(
        key,
        recipient,
        {
          attendeeName: ticket.attendeeName,
          eventTitle: ticket.eventSnapshot.title,
          startsAt: ticket.eventSnapshot.startsAt,
          timezone: ticket.eventSnapshot.timezone,
          venueName: ticket.eventSnapshot.venueName,
          ticketTypeName: ticket.ticketTypeSnapshot.name,
          ticketCode: ticket.ticketCode,
          link,
        },
        [
          {
            filename: `${ticket.ticketCode}.pdf`,
            content: (await ticketPdf(ticket)).toString("base64"),
            contentType: "application/pdf",
          },
        ],
      ),
    );
  }
  if (!resendKey)
    await queueEmail(
      orderSummaryEmail(`order-summary:${order.id}`, order.buyerSnapshot.email, {
        orderCode: order.orderCode,
        eventTitle: order.eventSnapshot.title,
        quantity: order.quantity,
        total: order.totalAmount,
        url: `${env.PUBLIC_WEB_URL}/orders/${order.id}`,
      }),
    );
}

// Repairs the gap if the process crashes after issuance commits but before email jobs are created.
export async function repairTicketEmails() {
  const orders = await Order.find({
    issuanceStatus: "issued",
    paymentStatus: "paid",
    ticketEmailQueuedAt: { $exists: false },
  }).limit(20);
  for (const order of orders) {
    await notifyOrderTickets(order.id);
    await Order.updateOne(
      { _id: order._id },
      { $set: { ticketEmailQueuedAt: new Date() } },
      { strict: false },
    );
  }
}
export const resendBatchKey = () => randomUUID();
