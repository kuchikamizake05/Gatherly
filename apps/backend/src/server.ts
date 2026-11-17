import mongoose from "mongoose";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { attachRealtime } from "./modules/realtime/server.js";

async function startServer() {
  await mongoose.connect(env.MONGODB_URI);
  const server = app.listen(env.PORT, "127.0.0.1", () => {
    console.info(`Gatherly API listening on http://localhost:${env.PORT}`);
  });
  attachRealtime(server);
  const shutdown = () => {
    server.close(() => {
      void mongoose.disconnect().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch((error: unknown) => {
  console.error("Unable to start Gatherly API.", error);
  process.exitCode = 1;
});
