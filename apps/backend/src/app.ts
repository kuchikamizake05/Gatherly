import { randomUUID } from "node:crypto";
import cors from "cors";
import cookieParser from "cookie-parser";
import express, {
  type NextFunction,
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import helmetModule, { type HelmetOptions } from "helmet";

import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { reconcileDuePayments } from "./modules/payments/payment-reconciliation.service.js";
import { issueDueTickets } from "./modules/tickets/ticket-issuance.service.js";
import { AppError } from "./lib/app-error.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { organizerRouter } from "./modules/organizers/organizer.routes.js";
import { eventRouter } from "./modules/events/event.routes.js";
import { orderRouter } from "./modules/orders/order.routes.js";
import { paymentRouter } from "./modules/payments/payment.routes.js";
import { ticketRouter } from "./modules/tickets/ticket.routes.js";
import { checkInRouter } from "./modules/check-ins/check-in.routes.js";
import { organizerReportRouter } from "./modules/reports/organizer-report.routes.js";
import { swaggerRouter } from "./docs/swagger.router.js";
import { databaseRateLimit } from "./lib/rate-limit.js";
import { workspaceAuthRouter, teamRouter } from "./modules/workspace/workspace.routes.js";
import { organizerProfileRouter } from "./modules/workspace/organizer-profile.routes.js";
import { adminAuthRouter } from "./modules/admin/admin-auth.routes.js";
import { adminOrganizersRouter } from "./modules/admin/admin-organizers.routes.js";
import { applicationRouter } from "./modules/applications/application.routes.js";
import { accountRouter, participantPasswordRouter } from "./modules/account/account.routes.js";
import {
  savedEventRouter,
  publicOrganizerRouter,
} from "./modules/saved-events/saved-event.routes.js";
import {
  participantReportRouter,
  adminEventReportRouter,
} from "./modules/event-reports/event-report.routes.js";
import { buyerRefundRouter, adminFinanceRouter } from "./modules/refunds/refund.routes.js";
import { payoutRouter, adminPayoutRouter } from "./modules/payouts/payout.routes.js";
import { ticketDeliveryRouter } from "./modules/tickets/ticket.routes.js";
import { mediaRouter } from "./modules/storage/storage.routes.js";
import { realtimeRouter } from "./modules/realtime/auth.js";
import multer from "multer";
import { publicEventRouter } from "./modules/public-events/public-event.routes.js";
import { organizerAssetsRouter } from "./modules/events/event-assets.routes.js";

export const app = express();

// Helmet's CJS declaration is interpreted as a namespace by Vercel's compiler.
// Its ESM default export is the middleware factory at runtime.
const helmet = helmetModule as unknown as (options?: HelmetOptions) => RequestHandler;

app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "validator.swagger.io"],
      },
    },
  }),
);
app.use(
  cors({
    origin: (env.WEB_ORIGINS ?? env.WEB_ORIGIN).split(",").map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.use((request, response, next) => {
  response.locals.requestId = request.get("X-Request-Id") ?? randomUUID();
  response.setHeader("X-Request-Id", response.locals.requestId);
  next();
});

app.get("/api/v1/health", (_request, response) => {
  response.status(200).json({
    data: {
      service: "gatherly-api",
      status: "ok",
    },
  });
});

app.get("/docs", (_request, response) => {
  response.redirect("/api/v1/docs");
});

app.use("/api/v1/docs", swaggerRouter);

app.get("/api/v1/internal/maintenance", async (request, response) => {
  if (!env.CRON_SECRET || request.get("Authorization") !== `Bearer ${env.CRON_SECRET}`) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized." } });
    return;
  }
  await connectDatabase();
  // Keep each invocation bounded; the scheduler can repeat while work remains.
  const payments = await reconcileDuePayments(undefined, 2);
  const tickets = await issueDueTickets(2);
  response.status(200).json({ data: { payments, tickets } });
});

if (process.env.VERCEL === "1") {
  app.use(async (_request, _response, next) => {
    await connectDatabase();
    next();
  });
}
app.use("/api/v1/auth", databaseRateLimit(60, 15 * 60_000), participantPasswordRouter, authRouter);
app.use("/api/v1/workspace/auth", databaseRateLimit(60, 15 * 60_000), workspaceAuthRouter);
app.use("/api/v1/admin/auth", databaseRateLimit(60, 15 * 60_000), adminAuthRouter);
app.use("/api/v1/organizer-applications", databaseRateLimit(60, 15 * 60_000), applicationRouter);
app.use("/api/v1/account", accountRouter);
app.use("/api/v1/me", savedEventRouter);
app.use("/api/v1/events", participantReportRouter);
app.use("/api/v1/events", publicEventRouter);
app.use("/api/v1/organizers", publicOrganizerRouter);
app.use("/api/v1/organizer/team", teamRouter);
app.use("/api/v1/organizer/profile", organizerProfileRouter);
app.use("/api/v1/organizer", organizerAssetsRouter);
app.use("/api/v1/organizer", payoutRouter);
app.use(
  "/api/v1/admin",
  adminOrganizersRouter,
  adminFinanceRouter,
  adminPayoutRouter,
  adminEventReportRouter,
);
app.use("/api/v1/refunds", buyerRefundRouter);
app.use("/api/v1/realtime", realtimeRouter);
app.use("/api/v1/media", mediaRouter);
app.use("/api/v1/organizers", organizerRouter);
app.use("/api/v1/organizer", organizerReportRouter);
app.use("/api/v1/organizer/events", eventRouter);
app.use("/api/v1/orders", ticketDeliveryRouter, orderRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/tickets", ticketRouter);
app.use("/api/v1/committee/events", checkInRouter);

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found.",
    },
    requestId: response.locals.requestId,
  });
});

export default app;

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    response
      .status(400)
      .json({
        error: {
          code: error.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "INVALID_UPLOAD",
          message: "Upload exceeds the supported limits.",
        },
      });
    return;
  }
  if ((error as { name?: string })?.name === "CastError") {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found." } });
    return;
  }
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        fields: error.fields,
        details: error.details,
      },
      requestId: response.locals.requestId,
    });
    return;
  }

  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    response.status(409).json({
      error: {
        code: "CONFLICT",
        message: "This record already exists.",
        fields: {},
      },
      requestId: response.locals.requestId,
    });
    return;
  }

  console.error("Unhandled API error", error);
  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    },
    requestId: response.locals.requestId,
  });
});
