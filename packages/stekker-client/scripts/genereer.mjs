// Genereert de TypeScript-types voor de Stekker-API uit de vastgepinde OpenAPI-spec in de
// architectuurrepo (CC-19). De spec staat daar normatief; hier staat alleen de afgeleide
// types-module. `--controleer` faalt als de module niet meer overeenkomt met de spec.
//
// Bron: STEKKER_SPEC, of standaard de architectuurrepo naast deze repo:
//   ../Vernietigingscockpit/designrules/api/stekker-openapi-spec.yaml
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const pakket = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(pakket, "../..");
const spec = path.resolve(
  process.env.STEKKER_SPEC ?? path.join(repo, "..", "Vernietigingscockpit", "designrules", "api", "stekker-openapi-spec.yaml")
);
const doel = path.join(pakket, "src", "stekker-api.ts");
const VERWACHTE_VERSIE = "1.0.0";

const tekst = await readFile(spec, "utf8").catch(() => {
  console.error(`Spec niet gevonden: ${spec}. Zet STEKKER_SPEC of check de architectuurrepo naast deze repo uit.`);
  process.exit(1);
});
const versie = /^\s{2}version:\s*["']?([^"'\s]+)/m.exec(tekst)?.[1];
if (versie !== VERWACHTE_VERSIE) {
  console.error(`Spec heeft versie ${versie}; vastgepind is ${VERWACHTE_VERSIE}. Pas de versie bewust aan.`);
  process.exit(1);
}

const ast = await openapiTS(tekst);
const inhoud =
  `// GEGENEREERD door packages/stekker-client/scripts/genereer.mjs uit de Stekker-OpenAPI-spec v${VERWACHTE_VERSIE}.\n` +
  "// Niet handmatig aanpassen: wijzig de spec en genereer opnieuw (npm run generate).\n\n" +
  astToString(ast);

if (process.argv.includes("--controleer")) {
  const huidig = await readFile(doel, "utf8").catch(() => "");
  if (huidig.replace(/\r\n/g, "\n") !== inhoud) {
    console.error("packages/stekker-client/src/stekker-api.ts komt niet overeen met de spec. Draai: npm run generate --workspace @vernietigingscockpit/stekker-client");
    process.exit(1);
  }
  console.log(`stekker-api.ts komt overeen met ${path.relative(repo, spec)} (v${versie}).`);
} else {
  await writeFile(doel, inhoud, "utf8");
  console.log(`stekker-api.ts gegenereerd uit ${path.relative(repo, spec)} (v${versie}).`);
}
