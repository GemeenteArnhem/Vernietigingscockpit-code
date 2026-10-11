// Genereert het register Cockpit-selectielijsten (ADR-0008) als TypeScript-module uit de
// machineleesbare kopie in de architectuurrepo. Daar staat het register normatief; hier staat
// alleen de afgeleide module (code -> titel). `--controleer` faalt als de module niet meer
// overeenkomt met het register.
//
// Bron: SELECTIELIJSTEN_REGISTER, of standaard de architectuurrepo naast deze repo:
//   ../Vernietigingscockpit/designrules/begrippenlijsten/cockpit-selectielijsten.json
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(app, "../..");
const bron = path.resolve(
  process.env.SELECTIELIJSTEN_REGISTER ??
    path.join(repo, "..", "Vernietigingscockpit", "designrules", "begrippenlijsten", "cockpit-selectielijsten.json")
);
const doel = path.join(app, "src", "modules", "selectielijsten", "register.ts");
const PATROON = /^[A-Z][A-Z0-9]{1,11}-[0-9]{4}(\.[0-9]{2})?$/;

const tekst = await readFile(bron, "utf8").catch(() => {
  console.error(`Register niet gevonden: ${bron}. Zet SELECTIELIJSTEN_REGISTER of check de architectuurrepo naast deze repo uit.`);
  process.exit(1);
});
const register = JSON.parse(tekst);
const codes = register.selectielijsten.map((lijst) => lijst.code);
const fout = codes.find((code) => !PATROON.test(code)) ?? codes.find((code, index) => codes.indexOf(code) !== index);
if (fout) {
  console.error(`Register bevat een ongeldige of dubbele code: ${fout}.`);
  process.exit(1);
}

const regels = register.selectielijsten.map((lijst) => `  [${JSON.stringify(lijst.code)}, ${JSON.stringify(lijst.titel)}],`);
const inhoud =
  `// GEGENEREERD door apps/cockpit-api/scripts/genereer-selectielijsten.mjs uit het register ${register.naam} ${register.versie}.\n` +
  "// Niet handmatig aanpassen: wijzig het register in de architectuurrepo en genereer opnieuw (npm run generate:selectielijsten).\n\n" +
  `export const REGISTER_IDENTIFICATIE = ${JSON.stringify(register.identificatie)};\n\n` +
  "// Selectielijstcode -> titel van de vastgestelde selectielijst.\n" +
  `export const SELECTIELIJSTEN: ReadonlyMap<string, string> = new Map([\n${regels.join("\n")}\n]);\n`;

if (process.argv.includes("--controleer")) {
  const huidig = await readFile(doel, "utf8").catch(() => "");
  if (huidig.replace(/\r\n/g, "\n") !== inhoud) {
    console.error("src/modules/selectielijsten/register.ts komt niet overeen met het register. Draai: npm run generate:selectielijsten --workspace @vernietigingscockpit/cockpit-api");
    process.exit(1);
  }
  console.log(`register.ts komt overeen met ${path.relative(repo, bron)} (${register.versie}, ${codes.length} lijsten).`);
} else {
  await writeFile(doel, inhoud, "utf8");
  console.log(`register.ts gegenereerd uit ${path.relative(repo, bron)} (${register.versie}, ${codes.length} lijsten).`);
}
