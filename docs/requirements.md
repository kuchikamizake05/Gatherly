# Gatherly — MVP Requirements

Status: planning baseline, not implemented functionality. Updated 22 September 2026. Confirmed stack: Next.js frontend, ExpressJS backend, MongoDB database. Confirmed ownership: Ancung (FE 1), Nasta (FE 2), Sako (BE 1 and team lead), and Dien (BE 2). Deadlines remain undecided. Product defaults below are proposals for team review.

## Background

Community organizers often sell tickets through online forms and manually confirm payments. This process makes it difficult to monitor ticket quotas, prepare attendance lists, and prevent overselling. Gatherly centralizes ticket sales and event check-in in one system.

## User roles

| Role | Main access |
| --- | --- |
| Organizer | Creates and manages events and ticket types. |
| Committee member | Validates tickets at event check-in. |
| Participant | Browses events, purchases tickets, and views owned tickets. |

## Core requirements

1. An event stores its title, date, location, description, poster, and ticket types.
2. A ticket type has a name, price, and quota. Examples include Presale, Regular, and VIP.
3. A sale must reduce the relevant quota automatically. The system must reject a sale when its quota is unavailable, including simultaneous purchase attempts.
4. Each purchased ticket receives a unique QR code.
5. A committee member can validate a QR code at the entrance. A ticket may only be checked in once and must belong to the relevant event.
6. The system enforces access rights for organizer, committee member, and participant accounts.
7. Passwords are stored securely using hashing, and protected API routes require authentication and authorization.

## Planned integration and optional features

- Midtrans Snap sandbox: planned payment integration, using simulated payments. This is additional credit under the rubric, included in the proposed MVP delivery target.
- Automatic ticket email: deferred beyond the zero-cost MVP; tickets remain available in the application.
- Event location map: outside the initial MVP.

## Success criteria

The application demonstrates a complete flow: an organizer creates an event and ticket types, a participant obtains a ticket without exceeding quota, and a committee member validates its QR code at check-in.

## Access rules

- Browsing published events is public; purchasing requires login.
- Participants can read only their own orders and tickets.
- An account may create an organizer profile and manage only its own events.
- Organizers assign existing accounts as committee members per event. Public registration cannot grant arbitrary committee access.
- Committee members can look up attendees and check in tickets for assigned events only. They cannot edit events or payments or inspect unrelated sales.
- One account can have multiple permissions in different event contexts. The API enforces ownership and assignment, not only a global role or hidden UI controls.

## Event lifecycle

- An event can be draft, published, or ended. Sales closure is independent of event lifecycle.
- Each ticket type has a price, quota, and sales period. Paid tickets only in the initial MVP; prices and quotas must be positive, with integer quantities.
- Draft events without orders can be deleted. Events and ticket types with orders cannot be permanently deleted.
- Event identity, date, and location are locked after the first paid sale for this MVP. Event cancellation and automatic refunds are outside initial scope.
- Closing sales stops new orders but preserves existing payable orders and issued tickets.
- Quotas cannot be reduced below sold plus reserved tickets. Orders preserve the original purchase price and event/ticket information as snapshots.

## Orders, reservations, and payment

Proposed product defaults: one event and one ticket type per order, 1–4 tickets per order, one attendee name per ticket, a 15-minute payment reservation. Four is an order limit, not an account-wide purchase limit.

1. The server calculates the amount from ticket data; client amounts are not authoritative.
2. Atomically reserve inventory and create an order before initiating payment. Insufficient inventory must prevent creation of a payable order.
3. Align provider expiry with reservation expiry. Countdown uses server expiry and does not reset when the page reloads.
4. Verify provider notifications/status, order identity, and amount on the backend. Browser payment callbacks do not establish payment success.
5. Verified success converts reserved inventory to sold and issues one unique ticket per purchased unit. Retries and duplicate notifications must not issue extra tickets or change inventory twice.
6. Closing a payment window is not failure. Allow resuming the same pending order.
7. Release inventory exactly once only after confirming that payment failed, expired, or was canceled and cannot still be paid. A browser timer or database expiry alone is insufficient.
8. Reconcile uncertain provider status before releasing inventory. Show payment verification in progress when necessary. Keep paid-but-ticket-processing separate from failed payment; retry issuance without another charge.
9. Late or out-of-order notifications cannot downgrade a successful payment to pending. Unexpected discrepancies are recorded for reconciliation, not relabeled as payment failure.

Inventory invariant: total capacity = available + reserved + sold; all values remain nonnegative. Orders and inventory remain consistent under concurrent requests, process failures, and retries.

## Ticket and attendance rules

- Each ticket has an unguessable unique QR credential; avoid personal information in the QR payload.
- Issue usable tickets only after verified payment. Payment, issuance, and attendance are distinct states.
- Check-in validates committee assignment, event identity, active paid ticket, and unused status.
- Proposed check-in window: 30 minutes before the event until event end.
- Concurrent scans permit exactly one admission; record check-in time and committee account.
- Manual ticket lookup follows the same permissions and validation rules as QR scanning.
- Distinguish success, already used, wrong event, invalid ticket, and connection error. Offline check-in is outside MVP.

## Acceptance and quality

- Two buyers request the final slot: exactly one reservation succeeds.
- Retried checkout cannot accidentally create duplicate payable orders for the same attempt.
- Duplicate payment notifications produce exactly the purchased ticket quantity.
- Confirmed expired orders restore inventory once; successful payments survive stale notifications.
- Two simultaneous scans of one ticket produce exactly one check-in.
- Ownership and per-event access restrictions are tested at the API boundary.
- Password hashing, input validation, CRUD APIs, and authenticated/authorized routes are demonstrable.
- Responsive frontend consumes APIs and includes loading, empty, validation, and recoverable error states.
- Use Indonesian interface copy, rupiah prices, and explicit timezones.
- Confirmed stack: Next.js, ExpressJS, MongoDB. Next.js consumes Express APIs; business rules and database access belong to Express.
- Provide setup documentation, environment examples without secrets, demo accounts, and a group video no longer than 10 minutes.

## Outside initial scope

Seat maps, resale, ticket transfer, coupons, organizer payouts, automatic refunds, social login, offline admission, and travel booking.

Work tracking: [Linear workflow](linear-workflow.md). Initial work items: [Linear backlog](linear-backlog.md).

## Budget and success boundary

Target: Rp0 for development and classroom demo. Use sandbox payments, free local libraries, and free-tier infrastructure within available limits. No paid subscription, purchased domain, production payment activation, or paid email is required. Hosting choice is an implementation decision and must be checked against current free-tier terms before deployment; continuous free uptime is not promised.

The MVP is complete when the acceptance criteria pass and the rubric evidence is available, not merely when all screens exist. See [test and rubric plan](testing.md). QR camera access and file uploads must work in the actual demonstration environment.
