# Gatherly — Initial Requirements

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

## Nice-to-have features

- Payment gateway integration.
- Automatic email delivery of electronic tickets.
- Event location map.

## Success criteria

The application demonstrates a complete flow: an organizer creates an event and ticket types, a participant obtains a ticket without exceeding quota, and a committee member validates its QR code at check-in.
