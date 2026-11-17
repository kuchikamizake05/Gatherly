# Participant and public API implementation

Implemented routes use the `/api/v1` prefix. All participant mutations require a valid session and `X-CSRF-Token`, except public authentication/reset entry points. Admin report routes use the separate admin session and its CSRF token. Root application composition applies rate limiting to authentication entry points.

## Account

| Method | Path | Result |
| --- | --- | --- |
| GET | `/account` | Name, immutable email, phone, avatar URL, join/password dates, password/Google state, active session count, notification preferences |
| PATCH | `/account` | Updates name and nullable phone, returns refreshed account |
| POST | `/account/avatar` | Multipart `file`, JPG/PNG/WebP up to 1 MB, stores public media on R2 and returns durable application media URL |
| POST | `/account/password` | Current password required when one exists, new password 12–128 characters, revokes other sessions and existing reset links |
| DELETE | `/account/google` | Allowed only when a password exists |
| POST | `/account/sessions/revoke-others` | Revokes all sessions except the current session and returns count |
| PATCH | `/account/notifications` | Stores reminders and recommendations preferences, does not enable recommendation delivery |
| POST | `/account/delete` | Requires `confirmation` equal to `hapus akun`, anonymizes account and revokes sessions |
| POST | `/auth/password/forgot` | Generic 204 response, queues a single-use reset link valid 30 minutes for an existing active account |
| POST | `/auth/password/reset` | Consumes reset token transactionally, changes password and revokes all sessions |

Five wrong current-password attempts lock password changes for ten minutes. `INVALID_PASSWORD`, `PASSWORD_REUSED`, and `PASSWORD_LOCKED` map to existing frontend form states. Reset links return 410 `TOKEN_INVALID` if unavailable or expired. A password cannot be reset to the previous password. Delivery of a reset email expires with its reset link.

Account deletion is blocked while upcoming tickets or pending/paid orders remain, and for accounts owning an organizer. Business transaction documents remain as records. Deleted participants cannot authenticate using historical sessions or OTP challenges. Checkout must write/validate the same user document transactionally to serialize account deletion with new purchases.

## Public discovery and saved events

| Method | Path | Result |
| --- | --- | --- |
| GET | `/events` | Paginated cards with search, category, active ticket price, date, campus area, date/price ordering |
| GET | `/events/suggestions?q=...` | Event titles, short event cards, matching category counts |
| GET | `/events/:slug` | Published/cancelled event detail, performers, terms, ticket sale states, organizer, optional participant saved state |
| GET | `/me/saved-events` | Paginated participant-specific saved cards, upcoming before past |
| PUT | `/me/saved-events/:slug` | Idempotently saves a published event |
| DELETE | `/me/saved-events/:slug` | Idempotently removes the participant's saved event |
| GET | `/organizers/:username/profile` | Public profile and upcoming/past published event cards |

Price filters require an actually purchasable ticket type in the specified range. Sold-out, stopped, not-yet-open, expired, and globally closed sales do not qualify. Frozen organizers are excluded from discovery, while directly opening their published event shows closed sales. Draft events are never public. Cancelled event detail remains accessible with cancellation state. Date chips use WIB day boundaries. Campus-area filtering currently matches campus/university wording in venue, address, or event title.

Sessions on public discovery are optional. Invalid or expired sessions are treated as anonymous. Public cards never return participant identity, QR credentials, or private organizer documents.

## Event reports

| Method | Path | Result |
| --- | --- | --- |
| POST | `/events/:slug/reports` | Authenticated participant submits reason and note |
| GET | `/admin/reports?tab=new\|done&page=1` | Paginated reports and counts per state |
| GET | `/admin/reports/:id` | Admin-only report detail including reporter email and organizer's other report count over 90 days |
| POST | `/admin/reports/:id/close` | Requires review note, marks reviewed once and transactionally queues email to reporter |

Reasons are `fraud`, `wrong_info`, `inappropriate`, and `other`. Other requires a note of at least ten characters. All notes are limited to 1,000 characters. Each participant can have only one open report per event. Closing notes are limited to 2,000 characters. Reporter identity is never exposed to the organizer or to public users. Freezing an organizer uses the separate organizer-management flow.

## Verification

`test/participant.test.ts` uses an isolated `gatherly_participant_test` database. It covers profile/password validation, password lockout, concurrent one-use reset, session revocation, saved-list isolation, duplicate open reports, deletion blocked by upcoming tickets, public price filters, draft/frozen restrictions, and WIB date boundaries.
