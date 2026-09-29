import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger-spec.js";

export const swaggerRouter = Router();

// Route to get the raw OpenAPI JSON specification
swaggerRouter.get("/json", (_request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.send(swaggerSpec);
});

// Mount Swagger UI
swaggerRouter.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Gatherly API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "none",
      filter: true,
    },
  }),
);
