import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Archivering van het vernietigingsdossier (CC-18). De cockpit stelt een pakket samen;
// een adapter zet het op de juiste plek. Nu: een map op schijf (volume). Later: OpenZaak
// (zaak, documenten en besluit) achter dezelfde interface.

export type ArchiefBestand = { naam: string; inhoud: Buffer; contentType: string };

export type ArchiefPakket = {
  taakinstantieId: string;
  archiveringId: string;
  bestanden: ArchiefBestand[];
  // Beschrijving van het pakket; de adapter voegt per bestand de SHA-256 toe.
  manifest: Record<string, unknown>;
};

export type ArchiefResultaat = {
  locatie: string;
  manifestSha256: string;
  openzaakZaakId?: string;
};

export interface ArchiefAdapter {
  readonly naam: string;
  archiveer(pakket: ArchiefPakket): Promise<ArchiefResultaat>;
}

export function sha256(inhoud: Buffer | string) {
  return createHash("sha256").update(inhoud).digest("hex");
}

// Het manifest met per bestand naam, type, grootte en SHA-256; zo is het pakket buiten de
// cockpit te controleren.
export function maakManifest(pakket: ArchiefPakket) {
  return {
    ...pakket.manifest,
    bestanden: pakket.bestanden.map((bestand) => ({
      naam: bestand.naam,
      contentType: bestand.contentType,
      bytes: bestand.inhoud.length,
      sha256: sha256(bestand.inhoud),
    })),
  };
}

// Map per taak en archivering: <ARCHIEF_PAD>/<taak-id>/<archivering-id>/. Eerst in een
// tijdelijke map schrijven en dan in één keer hernoemen, zodat er nooit een half pakket
// staat. Bestaat de map al (herhaalde poging na een crash), dan is het pakket er al.
export class BestandArchiefAdapter implements ArchiefAdapter {
  readonly naam = "bestand";

  constructor(private readonly basisPad: string) {}

  async archiveer(pakket: ArchiefPakket): Promise<ArchiefResultaat> {
    const doel = path.join(this.basisPad, pakket.taakinstantieId, pakket.archiveringId);
    const manifestPad = path.join(doel, "manifest.json");

    const bestaand = await readFile(manifestPad).catch(() => null);
    if (bestaand) {
      return { locatie: doel, manifestSha256: sha256(bestaand) };
    }

    const tijdelijk = `${doel}.bezig-${process.pid}-${Date.now()}`;
    await mkdir(tijdelijk, { recursive: true });

    try {
      for (const bestand of pakket.bestanden) {
        await writeFile(path.join(tijdelijk, bestand.naam), bestand.inhoud);
      }

      const manifest = Buffer.from(JSON.stringify(maakManifest(pakket), null, 2), "utf8");
      await writeFile(path.join(tijdelijk, "manifest.json"), manifest);
      await rename(tijdelijk, doel);

      return { locatie: doel, manifestSha256: sha256(manifest) };
    } catch (error) {
      await rm(tijdelijk, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }
}
