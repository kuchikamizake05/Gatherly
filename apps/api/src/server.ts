import mongoose from "mongoose";

import { app } from "./app.js";
import { env } from "./config/env.js";

async function startServer() {
  await mongoose.connect(env.MONGODB_URI);

  app.listen(env.PORT, () => {
    console.info(`Gatherly API listening on http://localhost:${env.PORT}`);
  });
}

startServer().catch((error: unknown) => {
  console.error("Unable to start Gatherly API.", error);
  process.exitCode = 1;
});
