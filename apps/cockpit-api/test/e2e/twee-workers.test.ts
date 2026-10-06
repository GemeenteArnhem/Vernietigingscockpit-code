import { afterAll, describe, expect, it } from "vitest";
import { api, maakTaak, prisma, statuswijziging, totVrijgegeven, wachtOp } from "./helpers.js";

afterAll(async () => {
  await prisma.client.$disconnect();
});

const TELLER = process.env.E2E_TELLER_URL ?? "http://localhost:39703";

async function tellingen(taakId: string): Promise<Record<string, number>> {
  const response = await fetch(`${TELLER}/__tellingen`);
  return ((await response.json()) as Record<string, Record<string, number>>)[taakId] ?? {};
}

// Praktijktest D: met twee workers mag elke stekkeraanroep maar één keer gebeuren.
// De stekker loopt via een tel-proxy, die de muterende aanroepen per taak telt.
describe("twee workers naast elkaar (CC-7)", () => {
  it("starten per taak precies één selectie en één vernietiging", async () => {
    const taken = await Promise.all([
      maakTaak("Twee workers A", "http://stekker-teller:8080"),
      maakTaak("Twee workers B", "http://stekker-teller:8080"),
    ]);

    // Beide taken tegelijk door de cyclus, zodat de workers om het werk concurreren.
    const vrijgaven = await Promise.all(taken.map(({ taakId }) => totVrijgegeven(taakId)));
    expect(vrijgaven.map((vrijgave) => vrijgave.status)).toEqual(["vrijgegeven", "vrijgegeven"]);

    await Promise.all(taken.map(({ taakId }) => statuswijziging("rm", taakId, "vernietigingsopdracht")));
    await Promise.all(
      taken.map(({ taakId }) =>
        wachtOp("taak naar resultaat", () => api("rm", `/taken/${taakId}`), (antwoord) => antwoord.body?.status === "resultaat")
      )
    );

    for (const [index, { taakId }] of taken.entries()) {
      const batches = Math.ceil(vrijgaven[index].aantalKandidaten / 100);

      expect(await tellingen(taakId)).toEqual({
        "POST /selecties": 1,
        "POST /vernietigingen": 1,
        "POST /vernietigingen/{id}/batches": batches,
        "POST /vernietigingen/{id}/vrijgeven": 1,
      });

      const jobs = await prisma.client.outbox.findMany({ where: { taakinstantieId: taakId } });
      expect(jobs.map((job) => [job.queue, job.status, job.pogingen, job.geclaimdDoor])).toEqual(
        expect.arrayContaining([
          ["selectie", "VERWERKT", 1, null],
          ["vernietiging", "VERWERKT", 1, null],
        ])
      );

      const uitvoering = await api("rm", `/taken/${taakId}/uitvoering`);
      expect(uitvoering.body.stekkers[0]).toMatchObject({ vernietigingStatus: "COMPLETED", fout: null });
    }
  });
});
