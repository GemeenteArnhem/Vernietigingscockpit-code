import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DOSSIER_XML, sha256, verifieerPakket, type Verificatie } from "./pakket-verificatie.js";

export { DOSSIER_XML, sha256 };

// Archivering van het vernietigingsdossier (CC-18). De cockpit stelt een pakket samen;
// een adapter zet het op de juiste plek. Nu: een map op schijf (volume). Later: OpenZaak
// (zaak, documenten en besluit) achter dezelfde interface.
//
// Het pakket is MDTO-XML 1.0.1 (ADR-0005 §7): bestanden met hun MDTO-beschrijving en als
// sluitstuk `dossier.mdto.xml`, de beschrijving van het dossier als geheel.

// `naam` is een relatief pad in het pakket (bijv. `kandidaten/<id>.mdto.xml`).
export type ArchiefBestand = { naam: string; inhoud: Buffer; contentType: string };

export type ArchiefPakket = {
  taakinstantieId: string;
  archiveringId: string;
  bestanden: ArchiefBestand[];
  // De MDTO-beschrijving van het dossier; wordt als laatste geschreven.
  dossierXml: Buffer;
};

export type ArchiefResultaat = {
  locatie: string;
  // SHA-256 van dossier.mdto.xml: de referentie naar het gearchiveerde pakket (ADR-0006).
  dossierSha256: string;
  openzaakZaakId?: string;
};

export interface ArchiefAdapter {
  readonly naam: string;
  archiveer(pakket: ArchiefPakket): Promise<ArchiefResultaat>;
  // Leest het gearchiveerde pakket terug en controleert alle checksums (ADR-0006 §2.3);
  // gooit een VerificatieFout als er iets niet klopt.
  verifieer(locatie: string, dossierSha256: string): Promise<Verificatie>;
}

// Map per taak en archivering: <ARCHIEF_PAD>/<taak-id>/<archivering-id>/. Eerst in een
// tijdelijke map schrijven en dan in één keer hernoemen, zodat er nooit een half pakket
// staat. Bestaat de map al (herhaalde poging na een crash), dan is het pakket er al.
export class BestandArchiefAdapter implements ArchiefAdapter {
  readonly naam = "bestand";

  constructor(private readonly basisPad: string) {}

  async archiveer(pakket: ArchiefPakket): Promise<ArchiefResultaat> {
    const doel = path.join(this.basisPad, pakket.taakinstantieId, pakket.archiveringId);

    const bestaand = await readFile(path.join(doel, DOSSIER_XML)).catch(() => null);
    if (bestaand) {
      return { locatie: doel, dossierSha256: sha256(bestaand) };
    }

    const tijdelijk = `${doel}.bezig-${process.pid}-${Date.now()}`;
    await mkdir(tijdelijk, { recursive: true });

    try {
      for (const bestand of pakket.bestanden) {
        const pad = veiligPad(tijdelijk, bestand.naam);
        await mkdir(path.dirname(pad), { recursive: true });
        await writeFile(pad, bestand.inhoud);
      }

      await writeFile(path.join(tijdelijk, DOSSIER_XML), pakket.dossierXml);
      await rename(tijdelijk, doel);

      return { locatie: doel, dossierSha256: sha256(pakket.dossierXml) };
    } catch (error) {
      await rm(tijdelijk, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  async verifieer(locatie: string, dossierSha256: string): Promise<Verificatie> {
    const map = path.resolve(locatie);

    // Alleen pakketten onder de eigen archiefmap.
    if (!map.startsWith(path.resolve(this.basisPad) + path.sep)) {
      throw new Error(`Archieflocatie ${locatie} valt buiten ARCHIEF_PAD.`);
    }

    return verifieerPakket(
      {
        paden: async () => {
          const items = await readdir(map, { recursive: true, withFileTypes: true });
          return items
            .filter((item) => item.isFile())
            .map((item) => path.relative(map, path.join(item.parentPath, item.name)).split(path.sep).join("/"));
        },
        lees: (pad) => readFile(veiligLeesPad(map, pad)),
      },
      dossierSha256
    );
  }
}

function veiligLeesPad(map: string, naam: string) {
  const pad = path.resolve(map, naam);
  if (!pad.startsWith(map + path.sep)) {
    throw new Error(`Ongeldige bestandsnaam in het archiefpakket: ${naam}`);
  }
  return pad;
}

// Een bestandsnaam uit het pakket mag niet buiten de pakketmap uitkomen.
function veiligPad(map: string, naam: string) {
  const pad = path.resolve(map, naam);

  if (!pad.startsWith(path.resolve(map) + path.sep) || naam === DOSSIER_XML) {
    throw new Error(`Ongeldige bestandsnaam in het archiefpakket: ${naam}`);
  }

  return pad;
}
