import { describe, expect, it } from "vitest";
import { maakDossier } from "./mdto-dossier.js";
import { leesCsv, sha256, verifieerPakket, VerificatieFout, type PakketLezer } from "./pakket-verificatie.js";

const kandidaatXml = Buffer.from("<MDTO>kandidaat</MDTO>");
const specificatie = Buffer.from("<MDTO>specificatie</MDTO>");
const csv = Buffer.from(
  [
    "vernietigingskandidaatId,naam,mdtoXml,mdtoXmlSha256,specificatie,specificatieSha256",
    `vk-1,"Zaak 1, met komma",kandidaten/k1.mdto.xml,${sha256(kandidaatXml)},specificaties/k1.xml,${sha256(specificatie)}`,
    "vk-2,Uitgesloten,,,,",
  ].join("\r\n")
);

function pakket() {
  const { bestanden, dossierXml } = maakDossier({
    taak: { id: "taak-1", naam: "Taak", taakdefinitie: "Definitie", aangemaaktOp: "2026-09-01T10:00:00.000Z" },
    zorgdrager: { verwijzingNaam: "Gemeente Voorbeeld" },
    gearchiveerdOp: "2026-10-02T10:00:00.000Z",
    verklaring: { pdf: Buffer.from("%PDF"), versie: 1, gegenereerdOp: "2026-10-01T10:00:00.000Z" },
    vernietigingslijst: { csv, lijstHash: "abc", bevrorenOp: null, aantalKandidaten: 2 },
    auditlog: { json: Buffer.from("[]"), aantalEvents: 1, laatsteHash: "def", intact: true },
    besluiten: [],
  });
  const bestandenPerPad = new Map<string, Buffer>([
    ...bestanden.map((bestand) => [bestand.naam, bestand.inhoud] as [string, Buffer]),
    ["dossier.mdto.xml", dossierXml],
    ["kandidaten/k1.mdto.xml", kandidaatXml],
    ["specificaties/k1.xml", specificatie],
  ]);
  return { bestanden: bestandenPerPad, dossierSha256: sha256(dossierXml) };
}

const lezer = (bestanden: Map<string, Buffer>): PakketLezer => ({
  paden: async () => [...bestanden.keys()],
  lees: async (pad) => bestanden.get(pad)!,
});

describe("hercontrole van het archiefpakket (ADR-0006)", () => {
  it("slaagt voor een ongeschonden pakket en telt de gecontroleerde bestanden", async () => {
    const { bestanden, dossierSha256 } = pakket();

    await expect(verifieerPakket(lezer(bestanden), dossierSha256)).resolves.toMatchObject({
      uitkomst: "geslaagd",
      dossierSha256,
      // dossier + 3 bestanden met beschrijving + kandidaat + specificatie
      aantalBestanden: 1 + 3 * 2 + 2,
    });
  });

  it.each([
    ["een andere dossier-hash", (b: Map<string, Buffer>) => b, "0".repeat(64), /dossier-hash/],
    ["een gewijzigd dossierbestand", (b: Map<string, Buffer>) => b.set("verklaring.pdf", Buffer.from("anders")), null, /verklaring\.pdf/],
    ["een gewijzigde specificatie", (b: Map<string, Buffer>) => b.set("specificaties/k1.xml", Buffer.from("anders")), null, /specificaties\/k1\.xml/],
    ["een ontbrekend bestand", (b: Map<string, Buffer>) => (b.delete("kandidaten/k1.mdto.xml"), b), null, /ontbreekt/],
    ["een extra kandidaatbestand", (b: Map<string, Buffer>) => b.set("kandidaten/extra.mdto.xml", Buffer.from("x")), null, /noemt er 2/],
  ])("faalt bij %s", async (_, wijzig, hash, fout) => {
    const { bestanden, dossierSha256 } = pakket();

    const resultaat = verifieerPakket(lezer(wijzig(bestanden)), hash ?? dossierSha256);
    await expect(resultaat).rejects.toThrow(VerificatieFout);
    await expect(resultaat).rejects.toThrow(fout);
  });

  it("leest CSV met quotes en lege velden", () => {
    expect(leesCsv('a,"b, ""c""",\r\n1,2,3')).toEqual([
      ["a", 'b, "c"', ""],
      ["1", "2", "3"],
    ]);
  });
});
