import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { api, auditActies, maakTaak, prisma, statuswijziging, token, totVrijgegeven, wachtOp } from "./helpers.js";
import { valideerMdto } from "../../src/modules/archief/mdto-xsd.testhulp.js";

const API = process.env.E2E_API_URL ?? "http://localhost:39700/api/v1";
const COMPOSE = path.resolve(import.meta.dirname, "../../../../infrastructure/compose/docker-compose.test.yml");

// Het hele pakket in één aanroep (relatief pad -> inhoud). Veel losse aanroepen blokkeren
// het testproces zo lang dat een bewaarde verbinding met de API wordt verbroken.
const LEES_MAP = [
  "const fs = require('fs'), path = require('path');",
  "const lees = (map) => fs.readdirSync(map, { withFileTypes: true }).flatMap((d) =>",
  "  d.isDirectory() ? lees(path.join(map, d.name)) : [path.join(map, d.name)]);",
  "const basis = process.argv[1];",
  "console.log(JSON.stringify(Object.fromEntries(lees(basis).map((f) => [path.relative(basis, f).split(path.sep).join('/'), fs.readFileSync(f).toString('base64')]))));",
].join("\n");
const leesArchiefMap = (map: string): Record<string, Buffer> =>
  Object.fromEntries(
    Object.entries(
      JSON.parse(
        execFileSync("docker", ["compose", "-f", COMPOSE, "exec", "-T", "worker-2", "node", "-e", LEES_MAP, map], {
          maxBuffer: 256 * 1024 * 1024,
        }).toString("utf8")
      ) as Record<string, string>
    ).map(([naam, inhoud]) => [naam, Buffer.from(inhoud, "base64")])
  );

afterAll(async () => {
  await prisma.client.$disconnect();
});

describe("volledige vernietigingscyclus tegen de teststekker (met OAuth2)", () => {
  const UITGESLOTEN = 3;

  it("selectie, beoordeling, accordering en uitvoering: alle niet-uitgesloten kandidaten worden vernietigd", async () => {
    const { taakId } = await maakTaak("Sociaal domein E2E", "http://stekker:3000");
    const { aantalKandidaten, status } = await totVrijgegeven(taakId, UITGESLOTEN);
    expect(aantalKandidaten).toBeGreaterThan(UITGESLOTEN);
    expect(status).toBe("vrijgegeven");

    expect((await statuswijziging("rm", taakId, "vernietigingsopdracht")).status).toBe(201);
    await wachtOp("taak naar resultaat", () => api("rm", `/taken/${taakId}`), (antwoord) => antwoord.body?.status === "resultaat");

    const uitvoering = await api("rm", `/taken/${taakId}/uitvoering`);
    expect(uitvoering.body.stekkers).toHaveLength(1);
    expect(uitvoering.body.stekkers[0]).toMatchObject({ vernietigingStatus: "COMPLETED", fout: null });

    const { body } = await api("rm", `/taken/${taakId}/vernietigingsresultaten`);
    expect(body.resultaten).toHaveLength(aantalKandidaten - UITGESLOTEN);
    expect(body.resultaten.every((resultaat: { resultaat: string }) => resultaat.resultaat === "SUCCESS")).toBe(true);

    const vernietigd = aantalKandidaten - UITGESLOTEN;

    // Vernietigingsverklaring (CC-17): automatisch door de worker, als PDF/A-2b via Gotenberg.
    const verklaring = await wachtOp(
      "verklaring gemaakt",
      () => api("rm", `/taken/${taakId}/verklaring`),
      (antwoord) => antwoord.body?.beschikbaar === true,
      120_000
    );
    expect(verklaring.body).toMatchObject({ versie: 1, tellingen: { aangeboden: vernietigd, success: vernietigd, uitgesloten: UITGESLOTEN } });
    const headers = { authorization: `Bearer ${await token("rm")}` };
    const pdf = Buffer.from(await (await fetch(`${API}/taken/${taakId}/verklaring.pdf`, { headers })).arrayBuffer());
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toMatch(/pdfaid:part>2</);
    expect(pdf.toString("latin1")).toMatch(/pdfaid:conformance>B</);
    const csv = await (await fetch(`${API}/taken/${taakId}/verklaring/bijlage.csv`, { headers })).text();
    expect(csv.split(/\r?\n/).filter((regel) => regel.includes(",UITGESLOTEN,"))).toHaveLength(UITGESLOTEN);

    // Auditlog (ADR-0003): volledige reconstructie en een intacte keten.
    const acties = await auditActies(taakId);
    expect(acties.slice(0, 3)).toEqual(["Creatie", "Selectie aangevraagd", "Import"]);
    expect(acties.filter((actie) => actie === "Kandidaat uitgesloten")).toHaveLength(UITGESLOTEN);
    expect(acties.filter((actie) => actie === "Kandidaat opgenomen")).toHaveLength(vernietigd);
    expect(acties.filter((actie) => actie === "Vernietigen")).toHaveLength(vernietigd);
    for (const actie of [
      "Voorgelegd",
      "Accordering",
      "Accordering",
      "Vernietigingsopdracht",
      "Uitvoering gestart",
      "Batch aangeboden",
      "Batch verwerkt",
    ]) {
      expect(acties, actie).toContain(actie);
    }
    expect(acties.slice(-2)).toEqual(["Uitvoering afgerond", "Creatie"]);

    const verificatie = await api("auditor", `/taken/${taakId}/auditlog/verificatie`);
    expect(verificatie.body).toMatchObject({ intact: true, aantalEvents: acties.length, fouten: [] });

    // Archivering (CC-18): de recordmanager archiveert; de worker zet het dossier in het
    // archiefvolume en rondt de taak af.
    const aanvraag = await statuswijziging("rm", taakId, "archiveren");
    expect(aanvraag.status).toBe(202);
    const archief = await wachtOp(
      "archivering afgerond",
      () => api("rm", `/taken/${taakId}/archivering`),
      (antwoord) => antwoord.body?.archivering?.status !== "PENDING",
      60_000
    );
    expect(archief.body).toMatchObject({ taakStatus: "archief", archivering: { status: "SUCCESS", adapter: "bestand" } });
    const locatie: string = archief.body.archivering.locatie;
    expect(locatie).toBe(`/archief/${taakId}/${aanvraag.body.id}`);

    // MDTO-XML 1.0.1 (ADR-0005 §7): dossier.mdto.xml is de referentie naar het pakket.
    const pakket = leesArchiefMap(locatie);
    const dossierXml = pakket["dossier.mdto.xml"];
    expect(createHash("sha256").update(dossierXml).digest("hex")).toBe(archief.body.archivering.dossierSha256);
    expect(pakket["verklaring.pdf.mdto.xml"].toString("utf8")).toContain(
      `<checksumWaarde>${createHash("sha256").update(pdf).digest("hex")}</checksumWaarde>`
    );
    expect(Object.keys(pakket)).not.toContain("manifest.json");
    const mdto: Record<string, Buffer> = Object.fromEntries(
      Object.entries(pakket).filter(([naam]) => naam.endsWith(".mdto.xml") || naam.startsWith("specificaties/"))
    );
    // Per vernietigde kandidaat: de MDTO-beschrijving en de specificatie van de teststekker,
    // allebei gedekt door de SHA-256 in de CSV-bijlage.
    const [kop, ...regels] = csv.split(/\r?\n/).map((regel) => regel.split(","));
    const kolom = (naam: string) => kop.indexOf(naam);
    const vernietigdeRegels = regels.filter((regel) => regel[kolom("resultaat")] === "SUCCESS");
    expect(vernietigdeRegels).toHaveLength(vernietigd);
    expect(Object.keys(pakket).filter((naam) => naam.startsWith("specificaties/"))).toHaveLength(vernietigd);
    for (const regel of vernietigdeRegels) {
      expect(createHash("sha256").update(pakket[regel[kolom("mdtoXml")]]).digest("hex")).toBe(regel[kolom("mdtoXmlSha256")]);
      expect(createHash("sha256").update(pakket[regel[kolom("specificatie")]]).digest("hex")).toBe(regel[kolom("specificatieSha256")]);
    }
    // Alles voldoet aan de XSD van het Nationaal Archief (overgeslagen zonder Python + lxml).
    const fouten = valideerMdto(mdto);
    if (fouten !== null) {
      expect(fouten).toEqual([]);
    }

    const naArchief = await auditActies(taakId);
    expect(naArchief.slice(-2)).toEqual(["Archivering aangevraagd", "Export"]);
    expect((await api("auditor", `/taken/${taakId}/auditlog/verificatie`)).body).toMatchObject({ intact: true, fouten: [] });
  });
});
