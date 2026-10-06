import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Versleuteling van stekker-secrets in de database (stekkerbeheer, bouwplan §7.1): AES-256-GCM
// met een sleutel uit SECRET_ENCRYPTION_KEY (32 bytes, base64). De API versleutelt bij het
// opslaan, de worker ontsleutelt vlak voor de tokenaanvraag. Een secret wordt nooit
// teruggegeven of gelogd.
//
// Opslagvorm: "v1:" + base64(iv (12) | tag (16) | versleutelde tekst).

const VERSIE = "v1:";

export class GeheimFout extends Error {
  constructor(melding: string) {
    super(melding);
    this.name = "GeheimFout";
  }
}

export function leesSleutel(waarde: string | undefined): Buffer {
  const sleutel = waarde?.trim() ? Buffer.from(waarde.trim(), "base64") : null;

  if (!sleutel || sleutel.length !== 32) {
    throw new GeheimFout("SECRET_ENCRYPTION_KEY ontbreekt of is geen sleutel van 32 bytes (base64).");
  }

  return sleutel;
}

export function versleutel(tekst: string, sleutel: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sleutel, iv);
  const versleuteld = Buffer.concat([cipher.update(tekst, "utf8"), cipher.final()]);
  return VERSIE + Buffer.concat([iv, cipher.getAuthTag(), versleuteld]).toString("base64");
}

export function ontsleutel(opgeslagen: string, sleutel: Buffer) {
  if (!opgeslagen.startsWith(VERSIE)) {
    throw new GeheimFout("Onbekende opslagvorm van het secret.");
  }

  const data = Buffer.from(opgeslagen.slice(VERSIE.length), "base64");

  try {
    const decipher = createDecipheriv("aes-256-gcm", sleutel, data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    // Geen details: een verkeerde sleutel of gewijzigde data.
    throw new GeheimFout("Het secret kan niet worden ontsleuteld (verkeerde SECRET_ENCRYPTION_KEY?).");
  }
}
