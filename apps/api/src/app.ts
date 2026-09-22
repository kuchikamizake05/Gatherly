import { randomUUID } from "node:crypto";
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { AppError } from "./lib/app-error.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { organizerRouter } from "./modules/organizers/organizer.routes.js";
import { eventRouter } from "./modules/events/event.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.WEB_ORIGIN,
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

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/organizers", organizerRouter);
app.use("/api/v1/organizer/events", eventRouter);

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found.",
    },
    requestId: response.locals.requestId,
  });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        fields: error.fields,
      },
      requestId: response.locals.requestId,
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  ) {
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
