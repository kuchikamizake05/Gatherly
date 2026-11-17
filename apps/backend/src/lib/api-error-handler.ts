import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "./app-error.js";

export function apiErrorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please check the submitted fields.",
        fields: Object.fromEntries(error.issues.map(issue => [issue.path.join(".") || "request", issue.message])),
      },
      requestId: response.locals.requestId,
    });
    return;
  }
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
}
