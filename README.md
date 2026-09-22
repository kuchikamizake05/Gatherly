<h1 align="center">Gatherly</h1>

<p align="center">
  <strong>Discover events. Book your spot. Be there.</strong><br>
  Community events, digital tickets, and QR check-in in one place.
</p>

<p align="center">
  <a href="docs/README.md">Documentation</a> ·
  <a href="docs/requirements.md">Product Specification</a> ·
  <a href="https://github.com/users/kuchikamizake05/projects/3/views/1">Project Board</a>
</p>

---

## Overview

**Gatherly** is a web application for discovering and managing community events, from creative workshops to live performances. It connects organizers, participants, and event committees through a shared experience for ticket sales and admission.

Developed by **Team 11** for the **Pengembangan Aplikasi Web** course, with the topic **US3 — Tiket acara komunitas: kuota dan tiket elektronik berkode**.

> Currently in the planning stage. The features below represent the planned MVP.

## Features

| Feature | Description |
| --- | --- |
| **Event Discovery** | Explore events by category, location, date, and ticket price. |
| **Event Management** | Publish event details and posters, with ticket types such as Presale, Regular, and VIP. |
| **Ticket Quotas** | Manage availability for each ticket type and reserve slots during checkout. |
| **Online Checkout** | Purchase tickets through Midtrans Snap Sandbox using simulated payments. |
| **Digital Tickets** | Access personal tickets with unique QR codes in My Tickets. |
| **Event Check-in** | Validate admission by scanning a QR code or entering a ticket code. |

## User Roles

| Role | Experience |
| --- | --- |
| **Participant** | Discover events, purchase tickets, and access digital tickets. |
| **Organizer** | Manage events, ticket types, quotas, committee assignments, and sales summaries. |
| **Committee** | Check in attendees and view attendance history for assigned events. |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js · App Router |
| Backend | ExpressJS |
| Database | MongoDB |
| Payments | Midtrans Snap Sandbox |
| QR Tickets | qrcode · qr-scanner |

## Project Structure

```text
Gatherly/
├── apps/
│   ├── web/       Next.js frontend
│   └── api/       ExpressJS backend
└── docs/          Project documentation
```

The repository currently contains the documentation and application directory placeholders. Technical plans and development workflows are available in [docs](docs/README.md).

## Local Development

Install dependencies from the repository root, copy `backend/.env.example` to `backend/.env`, then start both applications:

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:3000`; the API health check is available at `http://localhost:4000/api/v1/health`. A running MongoDB instance is required for the API.

## Team 11

| Name | Student ID |
| --- | --- |
| Dien Muhammad Scientivan Kurniapramono | 24/533571/TK/59114 |
| Aulia Nur Fajri Tri Anggoro | 24/535054/TK/59327 |
| Muhammad Khoirunas | 24/533373/TK/59083 |
| Faaid Sakhaa | 24/539398/TK/59820 |
