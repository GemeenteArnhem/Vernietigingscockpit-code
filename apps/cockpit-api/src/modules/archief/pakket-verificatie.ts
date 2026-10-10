import { createHash } from "node:crypto";

// Hercontrole van een gearchiveerd MDTO-pakket vlak vóór het verwijderen van de werkkopie
// (ADR-0006 §2, voorwaarde 3). Los van de opslag: de adapter levert een lezer per pad.
// - de SHA-256 van dossier.mdto.xml is de vastgelegde dossier-hash;
// - elk bestand met een MDTO-bestandsbeschrijving (`<bestand>.mdto.xml`) heeft de
//   beschreven omvang en checksum;
// - elk bestand in kandidaten/ en specificaties/ heeft de SHA-256 uit de CSV-bijlage.

export const DOSSIER_XML = "dossier.mdto.xml";

export function sha256(inhoud: Buffer | string) {
  return createHash("sha256").update(inhoud).digest("hex");
}

export type PakketLezer = {
  // Alle paden in het pakket, relatief, met "/" als scheidingsteken.
  paden(): Promise<string[]>;
  lees(pad: string): Promise<Buffer>;
};

export type Verificatie = {
  tijdstip: string;
  uitkomst: "geslaagd";
  aantalBestanden: number;
  dossierSha256: string;
};

export class VerificatieFout extends Error {}

export async function verifieerPakket(lezer: PakketLezer, dossierSha256: string): Promise<Verificatie> {
  const paden = new Set(await lezer.paden());
  const lees = async (pad: string) => {
    if (!paden.has(pad)) {
      throw new VerificatieFout(`Bestand ontbreekt in het archiefpakket: ${pad}`);
    }
    return lezer.lees(pad);
  };

  const dossier = await lees(DOSSIER_XML);
  if (sha256(dossier) !== dossierSha256) {
    throw new VerificatieFout("De SHA-256 van dossier.mdto.xml komt niet overeen met de vastgelegde dossier-hash.");
  }

  let gecontroleerd = 1;

  // Bestandsbeschrijvingen: <naam>.mdto.xml met een <bestand>-element.
  for (const pad of paden) {
    if (!pad.endsWith(".mdto.xml") || pad.includes("/")) {
      continue;
    }

    const xml = (await lees(pad)).toString("utf8");
    if (!xml.includes("<bestand>")) {
      continue;
    }

    const naam = waarde(xml, "naam");
    const omvang = Number(waarde(xml, "omvang"));
    const checksum = waarde(xml, "checksumWaarde");
    const inhoud = await lees(naam);

    if (inhoud.length !== omvang || sha256(inhoud) !== checksum) {
      throw new VerificatieFout(`Het bestand ${naam} komt niet overeen met zijn MDTO-beschrijving.`);
    }
    gecontroleerd += 2;
  }

  // Kandidaatbeschrijvingen en specificaties: SHA-256 uit de CSV-bijlage.
  const [kop, ...regels] = leesCsv((await lees("bijlage.csv")).toString("utf8"));
  const paren: Array<[string, string]> = [
    ["mdtoXml", "mdtoXmlSha256"],
    ["specificatie", "specificatieSha256"],
  ];

  for (const regel of regels) {
    for (const [padKolom, hashKolom] of paren) {
      const pad = regel[kop.indexOf(padKolom)];
      if (!pad) {
        continue;
      }
      if (sha256(await lees(pad)) !== regel[kop.indexOf(hashKolom)]) {
        throw new VerificatieFout(`Het bestand ${pad} komt niet overeen met de SHA-256 in de CSV-bijlage.`);
      }
      gecontroleerd += 1;
    }
  }

  const verwacht = [...paden].filter((pad) => pad.startsWith("kandidaten/") || pad.startsWith("specificaties/")).length;
  const inCsv = regels.reduce((som, regel) => som + paren.filter(([kolom]) => regel[kop.indexOf(kolom)]).length, 0);
  if (verwacht !== inCsv) {
    throw new VerificatieFout(`Het archiefpakket bevat ${verwacht} kandidaat- en specificatiebestanden, de CSV-bijlage noemt er ${inCsv}.`);
  }

  return { tijdstip: new Date().toISOString(), uitkomst: "geslaagd", aantalBestanden: gecontroleerd, dossierSha256 };
}

function waarde(xml: string, element: string) {
  const gevonden = new RegExp(`<${element}>([^<]*)</${element}>`).exec(xml);
  if (!gevonden) {
    throw new VerificatieFout(`Element ${element} ontbreekt in een MDTO-bestandsbeschrijving.`);
  }
  return gevonden[1].replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&");
}

// CSV volgens RFC 4180 (velden tussen dubbele quotes, "" als quote).
export function leesCsv(tekst: string) {
  const regels: string[][] = [];
  let regel: string[] = [];
  let veld = "";
  let tussenQuotes = false;

  for (let i = 0; i < tekst.length; i += 1) {
    const teken = tekst[i];
    if (tussenQuotes) {
      if (teken === '"' && tekst[i + 1] === '"') {
        veld += '"';
        i += 1;
      } else if (teken === '"') {
        tussenQuotes = false;
      } else {
        veld += teken;
      }
    } else if (teken === '"') {
      tussenQuotes = true;
    } else if (teken === ",") {
      regel.push(veld);
      veld = "";
    } else if (teken === "\n" || teken === "\r") {
      if (teken === "\r" && tekst[i + 1] === "\n") {
        i += 1;
      }
      regel.push(veld);
      regels.push(regel);
      regel = [];
      veld = "";
    } else {
      veld += teken;
    }
  }

  if (veld !== "" || regel.length > 0) {
    regel.push(veld);
    regels.push(regel);
  }

  return regels;
}
