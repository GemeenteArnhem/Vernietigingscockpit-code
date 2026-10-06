import { afterAll, describe, expect, it } from "vitest";
import { api, maakTaak, prisma, statuswijziging, totVrijgegeven, wachtOp } from "./helpers.js";

// Regressie voor scenario B en B' uit de review (praktijktest 02-10-2026):
// - stekker-403: elke POST /vernietigingen geeft 403 (blijvende fout);
// - stekker-503: de eerste twee POST /vernietigingen geven 503 (tijdelijke fout).
// Beide stekkers staan in infrastructure/compose/docker-compose.test.yml.

afterAll(async () => {
  await prisma.client.$disconnect();
});

const vernietigingJobs = (taakId: string) =>
  prisma.client.outbox.findMany({
    where: { taakinstantieId: taakId, jobNaam: "vernietiging:start" },
    orderBy: { aangemaaktOp: "asc" },
  });

describe("uitvoering bij stekkerfouten", () => {
  it("B · blijvende 403: één poging, taak blijft in uitvoering, recordmanager kan opnieuw starten", async () => {
    const { taakId, stekkerId } = await maakTaak("Scenario B (403)", "http://stekker-403:3000");
    await totVrijgegeven(taakId);
    await statuswijziging("rm", taakId, "vernietigingsopdracht");

    const uitvoering = await wachtOp(
      "opdracht mislukt",
      () => api("rm", `/taken/${taakId}/uitvoering`),
      (antwoord) => antwoord.body?.stekkers?.[0]?.vernietigingStatus === "MISLUKT"
    );
    expect(uitvoering.body.stekkers[0].fout).toMatch(/403/);
    expect(uitvoering.body.stekkers[0].toegestaneActies).toEqual(["vernietiging.opnieuw"]);

    // Ruim na de mislukking: geen nieuwe pogingen, taak nog in uitvoering.
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect((await vernietigingJobs(taakId)).map((job) => [job.status, job.pogingen])).toEqual([["MISLUKT", 1]]);
    expect((await api("rm", `/taken/${taakId}`)).body.status).toBe("uitvoering");

    // De PO mag niet opnieuw starten; de recordmanager wel.
    expect((await api("po", `/taken/${taakId}/uitvoering/${stekkerId}/opnieuw`, { method: "POST" })).status).toBe(403);
    expect((await api("rm", `/taken/${taakId}/uitvoering/${stekkerId}/opnieuw`, { method: "POST" })).status).toBe(201);

    await wachtOp(
      "tweede opdracht mislukt",
      () => vernietigingJobs(taakId),
      (jobs) => jobs.length === 2 && jobs[1].status === "MISLUKT"
    );
  });

  it("B' · twee keer 503: opnieuw met backoff, daarna geslaagd zonder resterende fout", async () => {
    const { taakId } = await maakTaak("Scenario B' (503)", "http://stekker-503:3000");
    const { aantalKandidaten } = await totVrijgegeven(taakId);
    await statuswijziging("rm", taakId, "vernietigingsopdracht");

    await wachtOp("taak naar resultaat", () => api("rm", `/taken/${taakId}`), (antwoord) => antwoord.body?.status === "resultaat");

    const [job] = await vernietigingJobs(taakId);
    expect(job).toMatchObject({ status: "VERWERKT", pogingen: 3, laatsteFout: null });

    const uitvoering = await api("rm", `/taken/${taakId}/uitvoering`);
    expect(uitvoering.body.stekkers[0]).toMatchObject({ vernietigingStatus: "COMPLETED", fout: null });

    const { body } = await api("rm", `/taken/${taakId}/vernietigingsresultaten`);
    expect(body.resultaten).toHaveLength(aantalKandidaten);
  });
});
