// Schrijft de OpenAPI-specificatie (openapi.json) uit de code, of controleert met --controleer
// dat het bestand nog klopt (ook in CI). Bron: src/openapi en @vernietigingscockpit/api-contract.
//   npm run generate:openapi --workspace @vernietigingscockpit/cockpit-api
//   npm run check:openapi --workspace @vernietigingscockpit/cockpit-api
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bouwOpenApiDocument } from "../src/openapi/document.js";

const bestand = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "openapi.json");
const inhoud = `${JSON.stringify(bouwOpenApiDocument(), null, 2)}\n`;

if (process.argv.includes("--controleer")) {
  const huidig = fs.existsSync(bestand) ? fs.readFileSync(bestand, "utf8").replace(/\r\n/g, "\n") : "";
  if (huidig !== inhoud) {
    console.error("openapi.json loopt achter op de code. Draai: npm run generate:openapi --workspace @vernietigingscockpit/cockpit-api");
    process.exit(1);
  }
  console.log("openapi.json klopt met de code.");
} else {
  fs.writeFileSync(bestand, inhoud, "utf8");
  console.log(`Geschreven: ${path.relative(process.cwd(), bestand)}`);
}
