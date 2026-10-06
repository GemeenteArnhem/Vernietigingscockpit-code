import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { api, auditActies, maakTaak, prisma, statuswijziging, token, totVrijgegeven, wachtOp } from "./helpers.js";

const API = process.env.E2E_API_URL ?? "http://localhost:39700/api/v1";
const COMPOSE = path.resolve(import.meta.dirname, "../../../../infrastructure/compose/docker-compose.test.yml");

// Een bestand uit het gedeelde archiefvolume lezen, via een van de workers.
const leesArchief = (bestand: string) =>
  execFileSync("docker", ["compose", "-f", COMPOSE, "exec", "-T", "worker-2", "cat", bestand]);

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
    expect(body.resultaten.every((resultaat: { vernietigingsstatus: string }) => resultaat.vernietigingsstatus === "SUCCESS")).toBe(true);

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
    expect(acties.slice(0, 3)).toEqual(["TASK_CREATED", "SELECTION_REQUESTED", "SELECTION_COMPLETED"]);
    expect(acties.filter((actie) => actie === "OBJECT_EXCLUDED")).toHaveLength(UITGESLOTEN);
    expect(acties.filter((actie) => actie === "OBJECT_INCLUDED")).toHaveLength(vernietigd);
    expect(acties.filter((actie) => actie === "OBJECT_PROCESSED")).toHaveLength(vernietigd);
    for (const actie of [
      "REVIEW_SUBMITTED",
      "APPROVAL_GRANTED",
      "DESTRUCTION_APPROVED_BY_ARCHIVIST",
      "DESTRUCTION_ORDERED_BY_RM",
      "EXECUTION_STARTED",
      "BATCH_STARTED",
      "BATCH_COMPLETED",
    ]) {
      expect(acties, actie).toContain(actie);
    }
    expect(acties.slice(-2)).toEqual(["EXECUTION_COMPLETED", "CERTIFICATE_GENERATED"]);

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

    const manifestTekst = leesArchief(`${locatie}/manifest.json`);
    expect(createHash("sha256").update(manifestTekst).digest("hex")).toBe(archief.body.archivering.manifestSha256);
    const manifest = JSON.parse(manifestTekst.toString("utf8"));
    expect(manifest.bestanden.map((bestand: { naam: string }) => bestand.naam)).toEqual(["verklaring.pdf", "bijlage.csv", "auditlog.json"]);
    expect(manifest.bestanden[0].sha256).toBe(createHash("sha256").update(pdf).digest("hex"));
    expect(manifest.auditlog).toMatchObject({ intact: true });

    const naArchief = await auditActies(taakId);
    expect(naArchief.slice(-2)).toEqual(["ARCHIVING_REQUESTED", "TASK_COMPLETED"]);
    expect((await api("auditor", `/taken/${taakId}/auditlog/verificatie`)).body).toMatchObject({ intact: true, fouten: [] });
  });
});
