#!/usr/bin/env node
// Maakt eenmalig de wachtwoorden en secrets voor de acceptatieomgeving aan, in
// infrastructure/acceptatie/.env (staat in .gitignore; komt dus niet in git).
//
//   node infrastructure/acceptatie/init-geheimen.mjs
//
// In een terminal vraagt het script een wachtwoord voor de testgebruikers (rm1, po1, arch1,
// auditor1, beheerder1); leeg laten geeft een willekeurig wachtwoord. Alle andere waarden
// (database, Keycloak-beheer, stekker-secret) zijn altijd willekeurig.
//
// Op een server achter Traefik (zie README.md, "Op een server"):
//
//   node infrastructure/acceptatie/init-geheimen.mjs --domein acc.voorbeeld.nl //     --traefik-netwerk <netwerk> --traefik-entrypoint <entrypoint> --traefik-certresolver <resolver>
//
// Dan komen ook de adressen in .env: https://acc.voorbeeld.nl (web), https://api.acc.voorbeeld.nl
// (API) en https://auth.acc.voorbeeld.nl (Keycloak), plus de Traefik-waarden.
//
// Een bestaand .env wordt nooit overschreven; ontbrekende waarden (na een update) worden
// toegevoegd. Nieuwe waarden nodig? Verwijder .env zelf en
// maak de omgeving leeg (`docker compose … down -v`): database en Keycloak onthouden de
// oude wachtwoorden.
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values: opties } = parseArgs({
  options: {
    domein: { type: "string" },
    "traefik-netwerk": { type: "string" },
    "traefik-entrypoint": { type: "string" },
    "traefik-certresolver": { type: "string" },
  },
});

let server = {};
if (opties.domein) {
  const domein = opties.domein.trim().toLowerCase();
  const ontbrekend = ["traefik-netwerk", "traefik-entrypoint", "traefik-certresolver"].filter((naam) => !opties[naam]);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domein) || ontbrekend.length > 0) {
    console.error("Gebruik: --domein <domein> --traefik-netwerk <netwerk> --traefik-entrypoint <entrypoint> --traefik-certresolver <resolver>");
    if (ontbrekend.length > 0) {
      console.error(`Ontbreekt: ${ontbrekend.map((naam) => `--${naam}`).join(", ")} (zie README.md, "Op een server").`);
    }
    process.exit(1);
  }
  server = {
    ACC_WEB_HOST: domein,
    ACC_API_HOST: `api.${domein}`,
    ACC_AUTH_HOST: `auth.${domein}`,
    ACC_WEB_URL: `https://${domein}`,
    ACC_API_URL: `https://api.${domein}`,
    ACC_AUTH_URL: `https://auth.${domein}`,
    TRAEFIK_NETWORK: opties["traefik-netwerk"],
    TRAEFIK_ENTRYPOINT: opties["traefik-entrypoint"],
    TRAEFIK_CERTRESOLVER: opties["traefik-certresolver"],
  };
}

const map = path.dirname(fileURLToPath(import.meta.url));
const bestand = path.join(map, ".env");

// URL-veilig (geen tekens die in een database-URL moeten worden gecodeerd).
const willekeurig = (bytes = 24) => randomBytes(bytes).toString("base64url");

// Waarden die het script altijd zelf kiest. Bij een bestaand .env worden alleen ontbrekende
// toegevoegd (bijv. na een update die een nieuwe sleutel nodig heeft); niets wordt overschreven.
const altijdWillekeurig = () => ({
  ACC_DB_WACHTWOORD: willekeurig(),
  ACC_DB_APP_WACHTWOORD: willekeurig(),
  ACC_KEYCLOAK_ADMIN_WACHTWOORD: willekeurig(),
  ACC_STEKKER_GEHEIM: willekeurig(32),
  // Sleutel voor stekker-secrets uit stekkerbeheer: 32 bytes, base64.
  ACC_SECRET_SLEUTEL: randomBytes(32).toString("base64"),
});

if (existsSync(bestand)) {
  const aanwezig = new Set(
    readFileSync(bestand, "utf8")
      .split(/\r?\n/)
      .map((regel) => /^([A-Z0-9_]+)=/.exec(regel)?.[1])
      .filter(Boolean)
  );
  const ontbrekend = Object.entries(altijdWillekeurig()).filter(([sleutel]) => !aanwezig.has(sleutel));

  if (ontbrekend.length === 0) {
    console.log(`${bestand} bestaat al en is compleet; er is niets gewijzigd.`);
    console.log("Nieuwe waarden nodig? Verwijder het bestand zelf en maak de omgeving leeg (down -v).");
    process.exit(0);
  }

  appendFileSync(bestand, ontbrekend.map(([sleutel, waarde]) => `${sleutel}=${waarde}`).join("\n") + "\n", "utf8");
  console.log(`Aangevuld in ${bestand}: ${ontbrekend.map(([sleutel]) => sleutel).join(", ")}. Bestaande waarden zijn niet gewijzigd.`);
  process.exit(0);
}

async function vraagGebruikerswachtwoord() {
  if (!process.stdin.isTTY) {
    return null;
  }

  const vraag = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const antwoord = (await vraag.question("Wachtwoord voor de testgebruikers (leeg = willekeurig): ")).trim();
    if (antwoord && antwoord.length < 12) {
      console.error("Kies minimaal 12 tekens, of laat het leeg voor een willekeurig wachtwoord.");
      process.exit(1);
    }
    return antwoord || null;
  } finally {
    vraag.close();
  }
}

const gekozen = await vraagGebruikerswachtwoord();
const waarden = {
  ...altijdWillekeurig(),
  ACC_GEBRUIKERS_WACHTWOORD: gekozen ?? willekeurig(12),
  ...server,
};

const inhoud = [
  "# Geheimen van de acceptatieomgeving; gemaakt door init-geheimen.mjs. Niet in git.",
  "# ACC_GEBRUIKERS_WACHTWOORD is het wachtwoord van rm1, po1, arch1, auditor1 en beheerder1;",
  "# het Keycloak-beheeraccount is 'admin' met ACC_KEYCLOAK_ADMIN_WACHTWOORD.",
  ...Object.entries(waarden).map(([sleutel, waarde]) => `${sleutel}=${waarde}`),
  "",
].join("\n");

writeFileSync(bestand, inhoud, { encoding: "utf8", flag: "wx", mode: 0o600 });
console.log(`Aangemaakt: ${bestand}`);
console.log("Daar staan het wachtwoord van de testgebruikers en van het Keycloak-beheeraccount.");
if (opties.domein) {
  console.log(`Maak DNS-records (A) naar deze server voor: ${server.ACC_WEB_HOST}, ${server.ACC_API_HOST} en ${server.ACC_AUTH_HOST}.`);
}
