import { createRequire } from "node:module";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const swaggerRequire = createRequire(require.resolve("swagger-ui-express"));
const assets = dirname(swaggerRequire.resolve("swagger-ui-dist/package.json"));
const destination = new URL("../public/api/v1/docs/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const file of ["swagger-ui.css", "swagger-ui-bundle.js", "swagger-ui-standalone-preset.js", "favicon-16x16.png", "favicon-32x32.png"]) {
  await copyFile(join(assets, file), new URL(file, destination));
}
