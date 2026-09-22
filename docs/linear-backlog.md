# Gatherly — Initial Linear backlog

Status: historical planning reference. The 25 work items now exist as [GitHub Issues](https://github.com/kuchikamizake05/Gatherly/issues) in [Gatherly MVP](https://github.com/users/kuchikamizake05/projects/3/views/1), all initially in Backlog without assignees or deadlines. B-codes remain local references, not GitHub issue numbers. Role owners are Ancung (FE 1), Nasta (FE 2), Sako (BE 1), and Dien (BE 2). GitHub Projects is the source of truth for status and assignments.

## M1 — Foundations

| Ref | Title / outcome | Acceptance criteria | Depends on | Area |
| --- | --- | --- | --- | --- |
| B01 | Review and approve MVP business rules | Team reviews requirements; decisions about roles, reservation defaults, payment, scope, and unresolved questions recorded. | — | documentation |
| B02 | Review confirmed stack and development conventions | Next.js + Express + MongoDB confirmed; review proposed TypeScript/npm workspaces, session approach, runtime versions, and branch/review conventions. | B01 | documentation |
| B03 | Design data model and state transitions | Users, organizer profiles, assignments, events, ticket types, orders, tickets defined; ownership, indexes, inventory invariants, payment/issuance/check-in transitions documented; Mongo deployment supports needed transactions. | B02 | backend |
| B04 | Define API contract | Auth, event CRUD, public browsing, orders, tickets, committee endpoints specify inputs, validation, permissions, success/errors, pagination, idempotency, and example responses; team reviews contract. | B03 | fullstack |
| B05 | Initialize runnable web/API workspace | Both applications start using documented commands; health check works; environment examples contain no secrets; validation scripts run from clean checkout. | B02 | infrastructure |
| B06 | Implement account authentication | Registration/login/logout work; password hashed; invalid inputs and credentials handled; session/token expiry and protected-route checks verified. | B04, B05 | fullstack |
| B07 | Implement ownership and per-event permissions | Organizer onboarding grants own-workspace management only; assignment checks protect APIs; tests reject cross-user and cross-event access and public privilege escalation. | B06 | backend |

## M2 — Event publishing

| Ref | Title / outcome | Acceptance criteria | Depends on | Area |
| --- | --- | --- | --- | --- |
| B08 | Implement event and ticket-type API | CRUD with owner checks, validated dates/prices/quotas, draft/publish states; disallowed deletion and post-sale edits rejected; ticket sales periods enforced. | B07 | backend |
| B09 | Build organizer event editor and poster upload | Draft/save/edit/publish with API data; safe file type/size validation and upload error recovery; ticket-type editing; unsaved changes handled; responsive layout. | B08 | fullstack |
| B10 | Build public discovery and event details | Published events searchable/filterable; correct date/location/poster/prices; no draft exposure; ticket availability and closed-sales states; loading/empty/error states. | B08 | fullstack |

## M3 — Purchase and tickets

| Ref | Title / outcome | Acceptance criteria | Depends on | Area |
| --- | --- | --- | --- | --- |
| B11 | Implement atomic order reservation | Server pricing and quantity validation; final-slot concurrent requests allow one success; retry does not create duplicate order; failures leave inventory/order consistent; no payment session without reservation. | B08 | backend |
| B12 | Integrate Midtrans sandbox sessions | Server-only credentials; unique provider order identity and aligned expiry; reopen existing payable session; provider creation failures recover; no real payment required. | B11 | backend |
| B13 | Verify payment notifications and reconcile expiry | Validate notification/status, order and amount; repeated/out-of-order events are safe; release once only after confirmed unpayability; recover interrupted processing; uncertain status remains reconcilable. | B12 | backend |
| B14 | Issue unique tickets after payment | Exactly purchased quantity issued once; unguessable unique QR tokens; attendee names and order snapshots preserved; paid-but-processing can retry without charge; unpaid orders have no usable ticket. | B13 | backend |
| B15 | Build checkout and payment status journey | Attendee forms, itemized total, server expiry, sandbox handoff/resume, verifying/paid/pending/failed/expired states; preserve inputs; no success based solely on browser callback. | B10, B12, B13 | frontend |
| B16 | Build My Tickets and ticket details | Owner-only ticket data and distinct QR per unit; pending orders visible; QR readable on mobile; used status displayed; loading/error/empty states. | B14, B15 | fullstack |

## M4 — Check-in

| Ref | Title / outcome | Acceptance criteria | Depends on | Area |
| --- | --- | --- | --- | --- |
| B17 | Manage per-event committee assignments | Organizer assigns existing accounts; missing/duplicate accounts handled; removal ends access; other organizers cannot change assignments. | B07, B08 | fullstack |
| B18 | Implement atomic ticket validation | Event/role/time-window/paid/unused checks; parallel scans yield one admission; retry does not double-count; actor/time logged; manual lookup applies same checks. | B14, B17 | backend |
| B19 | Build mobile committee scanner | Assigned-event selection, camera consent, denied-camera fallback, manual lookup, and distinct result states; no success on network failure; scanner pauses during verification/results. | B18 | frontend |
| B20 | Build organizer inventory, orders, and attendance views | Accurate available/reserved/sold breakdown; paid gross totals exclude pending orders; scoped searches and check-in history; sales closure preserves existing payable orders. | B13, B18 | fullstack |

## M5 — Submission

| Ref | Title / outcome | Acceptance criteria | Depends on | Area |
| --- | --- | --- | --- | --- |
| B21 | Verify complete journeys and failure recovery | Participant/organizer/committee flows pass; overselling, repeated payments, stale notifications, expiry races, simultaneous scans, ownership violations tested; findings tracked and resolved. | B09, B16, B19, B20 | fullstack |
| B22 | Finish responsive and accessible interaction states | Primary flows work on desktop/mobile; keyboard/focus and labels usable; form feedback, loading, empty, retry, and session-expired states consistent. | B09, B16, B19, B20 | frontend |
| B23 | Deploy demo and document setup | Reproducible setup, environment examples, separate demo accounts, HTTPS camera support, provider webhook reachability, and transaction-capable database verified; deployed smoke checks pass. | B21, B22 | infrastructure |
| B24 | Prepare rubric evidence and group presentation | Map rubric to demonstrable features; contributions match agreed tasks; video at most 10 minutes; rehearsal and submission links verified. | B23 | documentation |

## Optional after core readiness

| Ref | Title / outcome | Acceptance criteria | Depends on | Area |
| --- | --- | --- | --- | --- |
| B25 | Deferred: deliver ticket email automatically | Outside Rp0 MVP; revisit only if scope/budget permits. Send after issuance; retry without duplicate tickets; app tickets remain accessible if email fails. | B14, B16 | fullstack |

## First working session

### Kelengkapan kontrak hasil review UI

- B10: tambahkan minPrice/maxPrice, startingPrice/matchingStartingPrice, sold-out/null-price, dan pengujian T19 pada child FE 1 dan BE 1.
- B20: tambahkan ringkasan lintas acara organizer dan detail order read-only beserta scope kepemilikan, periode paidAt, dan pengujian T20–T21 pada child FE 2 dan BE 2.
- B18–B19: tambahkan API serta halaman riwayat check-in, counter seluruh acara, akses setelah pencabutan assignment, dan T22 pada child BE 2 dan FE 2.
- B21: sertakan T19–T22 dari testing.md dalam verifikasi integrasi. Ini melengkapi fitur yang sudah direncanakan, bukan milestone baru.

### Mulai pengerjaan

Review B01 together, record B02 decisions, then assign only the next unblocked issues. B03 and B05 can proceed independently after B02. Split oversized issues into smaller children when implementation details are known; keep their acceptance criteria and dependencies visible. This is a delivery sequence, not an estimate or commitment to a deadline.

## FE/BE split for Linear creation

The rows above are parent outcomes. Split them into the following child issues when creating the project; one actual person owns each child. Codes here are local references, not generated Linear identifiers. B01–B04 have draft documents now, but team review is still required before marking them Done.

| Parent | Frontend child | Backend child | Integration dependency |
| --- | --- | --- | --- |
| B05 | Ancung (FE 1): Next scaffold, FE 2 reviews shared shell | Sako (BE 1): Express/Mongo/config scaffold | Both apps run from documented setup |
| B06–B07 | Ancung (FE 1): auth screens/session handling | Sako (BE 1): session/auth/permissions | Login and protected request demo |
| B08–B09 | Nasta (FE 2): organizer forms/poster/ticket editor | Sako (BE 1): event/ticket/upload endpoints | Publish appears in public API |
| B10 | Ancung (FE 1): discovery/detail | Sako (BE 1): catalog filters/detail | Real API replaces matching mock |
| B11–B13, B15 | Ancung (FE 1): checkout and payment result states | Dien (BE 2): reservation/payment/reconciliation | Sandbox webhook to verified state |
| B14, B16 | Ancung (FE 1): My Tickets/QR/print | Dien (BE 2): issuance/owner ticket API | Paid order yields exact ticket count |
| B17 | Nasta (FE 2): assignment UI/event picker | Sako (BE 1): assignment/scoped events APIs | Revocation changes effective access |
| B18–B19 | Nasta (FE 2): scanner/manual/results | Dien (BE 2): atomic check-in/lookup | Real camera + duplicate scan test |
| B20 | Nasta (FE 2): operational dashboard | Dien (BE 2): aggregates/orders/attendees | Counters match database fixtures |

For frontend children, dependency is the reviewed endpoint contract, allowing mocks before BE completion. Integration depends on both FE and BE children. BE 1 helps BE 2 with concurrency/recovery tests; B21–B24 are shared outcomes with explicitly assigned owners after team discussion.
