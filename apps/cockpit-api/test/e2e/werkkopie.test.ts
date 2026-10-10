import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { api, maakTaak, prisma, statuswijziging, totVrijgegeven, wachtOp } from "./helpers.js";

// ADR-0006: na archivering en een termijn van P0D ruimt de worker de werkkopie op; de
// grafsteen blijft opvraagbaar en het gearchiveerde pakket blijft staan. De termijn wordt via
// de beheer-API gezet en na afloop teruggezet (deze test draait als laatste).

const COMPOSE = path.resolve(import.meta.dirname, "../../../../infrastructure/compose/docker-compose.test.yml");
const leesArchief = (bestand: string) =>
  execFileSync("docker", ["compose", "-f", COMPOSE, "exec", "-T", "worker-1", "cat", bestand]);

afterAll(async () => {
  await api("beheer", "/beheer/instellingen/werkkopie-bewaartermijn", { method: "PUT", body: { waarde: "P12M" } });
  await prisma.client.$disconnect();
});

describe("werkkopie verwijderen (ADR-0006)", () => {
  it("ruimt de werkkopie na archivering op en laat een opvraagbare grafsteen achter", async () => {
    const { taakId } = await maakTaak("Werkkopie verwijderen", "http://stekker:3000");
    await totVrijgegeven(taakId);
    expect((await statuswijziging("rm", taakId, "vernietigingsopdracht")).status).toBe(201);
    await wachtOp("verklaring gemaakt", () => api("rm", `/taken/${taakId}/verklaring`), (antwoord) => antwoord.body?.beschikbaar === true, 120_000);
    expect((await statuswijziging("rm", taakId, "archiveren")).status).toBe(202);
    const archief = await wachtOp(
      "archivering afgerond",
      () => api("rm", `/taken/${taakId}/archivering`),
      (antwoord) => antwoord.body?.taakStatus === "archief",
      60_000
    );
    expect((await api("auditor", `/dossiers/${taakId}`)).body).toMatchObject({ status: "werkkopie_aanwezig", taakStatus: "archief" });

    // Alleen de functioneel beheerder zet de termijn; de auditor leest mee.
    expect((await api("rm", "/beheer/instellingen/werkkopie-bewaartermijn", { method: "PUT", body: { waarde: "P0D" } })).status).toBe(403);
    expect((await api("beheer", "/beheer/instellingen/werkkopie-bewaartermijn", { method: "PUT", body: { waarde: "12 maanden" } })).status).toBe(400);
    const gezet = await api("beheer", "/beheer/instellingen/werkkopie-bewaartermijn", { method: "PUT", body: { waarde: "P0D" } });
    expect(gezet.body).toMatchObject({ waarde: "P0D", bron: "instelling" });
    expect((await api("auditor", "/beheer/instellingen/werkkopie-bewaartermijn")).body).toMatchObject({ waarde: "P0D" });

    const dossier = await wachtOp(
      "werkkopie verwijderd",
      () => api("auditor", `/dossiers/${taakId}`),
      (antwoord) => antwoord.body?.status === "werkkopie_verwijderd",
      60_000
    );
    expect(dossier.body.grafsteen).toMatchObject({
      taakinstantieId: taakId,
      archivering: { id: archief.body.archivering.id, dossierSha256: archief.body.archivering.dossierSha256 },
      verificatie: { uitkomst: "geslaagd" },
      bewaartermijnWerkkopie: "P0D",
    });

    // De werkkopie is weg, het blijvende exemplaar staat er nog.
    expect((await api("rm", `/taken/${taakId}`)).status).toBe(404);
    expect((await api("rm", `/dossiers/${taakId}`)).body).toMatchObject({ status: "werkkopie_verwijderd" });
    const dossierXml = leesArchief(`${archief.body.archivering.locatie}/dossier.mdto.xml`);
    expect(createHash("sha256").update(dossierXml).digest("hex")).toBe(dossier.body.grafsteen.archivering.dossierSha256);
    expect((await api("auditor", "/dossiers/grafstenen/verificatie")).body).toMatchObject({ intact: true, fouten: [] });
  });
});
