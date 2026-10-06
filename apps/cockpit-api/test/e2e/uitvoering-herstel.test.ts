import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { api, controleerBijStekker, maakTaak, prisma, statuswijziging, totVrijgegeven, wachtOp } from "./helpers.js";

// CC-8: de uitvoering herstelt zich zonder iets dubbel te doen.
// - scenario C: de stekker verwerkt batches en vrijgeven, maar het eerste antwoord gaat verloren;
// - worker-kill: beide workers worden hard gestopt (docker kill) midden in de uitvoering en
//   daarna weer gestart; na de lease nemen ze het werk over.

const COMPOSE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../infrastructure/compose/docker-compose.test.yml"
);

afterAll(async () => {
  // Zorg dat de workers weer draaien, ook als de test halverwege faalde.
  docker("start", "worker-1", "worker-2");
  await prisma.client.$disconnect();
});

function docker(...args: string[]) {
  const resultaat = spawnSync("docker", ["compose", "-f", COMPOSE, ...args], { stdio: "pipe", encoding: "utf8" });
  if (resultaat.status !== 0) {
    throw new Error(`docker compose ${args.join(" ")} mislukt: ${resultaat.stderr}`);
  }
}

describe("herstel van de uitvoering (CC-8)", () => {
  it("scenario C · verloren antwoorden op batches en vrijgeven: één vernietiging, geen dubbele batches", async () => {
    const { taakId } = await maakTaak("Scenario C (antwoord kwijt)", "http://stekker-na:3000");
    const { aantalKandidaten } = await totVrijgegeven(taakId);
    await statuswijziging("rm", taakId, "vernietigingsopdracht");

    await wachtOp("taak naar resultaat", () => api("rm", `/taken/${taakId}`), (antwoord) => antwoord.body?.status === "resultaat");

    await controleerBijStekker("http://localhost:39705", taakId, aantalKandidaten);
    const jobs = await prisma.client.outbox.findMany({ where: { taakinstantieId: taakId, queue: "vernietiging" } });
    const pogingen = Object.fromEntries(jobs.map((job) => [job.jobNaam, job.pogingen]));
    expect(pogingen).toEqual({ "vernietiging:start": 1, "vernietiging:batches": 2, "vernietiging:vrijgeven": 2 });
  });

  it("worker-kill midden in de uitvoering: na herstart geen dubbele vernietiging, batches of resultaten", async () => {
    const { taakId } = await maakTaak("Worker-kill", "http://stekker-traag-teller:8080");
    const { aantalKandidaten } = await totVrijgegeven(taakId);
    await statuswijziging("rm", taakId, "vernietigingsopdracht");

    // Zodra de stekker de vernietiging heeft aangemaakt: beide workers hard stoppen.
    await wachtOp(
      "vernietiging gestart",
      () => prisma.client.vernietiging.findFirst({ where: { taakinstantieId: taakId } }),
      (vernietiging) => Boolean(vernietiging?.externVernietigingId),
      120_000
    );
    docker("kill", "worker-1", "worker-2");
    const tijdensKill = await prisma.client.vernietigingBatch.count({
      where: { vernietiging: { taakinstantieId: taakId }, geaccepteerdOp: { not: null } },
    });
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    docker("start", "worker-1", "worker-2");

    await wachtOp(
      "taak naar resultaat",
      () => api("rm", `/taken/${taakId}`),
      (antwoord) => antwoord.body?.status === "resultaat",
      120_000
    );

    // Gestopt vóór de laatste batch: de herstart moest dus echt verder gaan.
    expect(tijdensKill).toBeLessThan(Math.ceil(aantalKandidaten / 100));
    const vernietigingen = (await fetch("http://localhost:39704/__vernietigingen").then((antwoord) => antwoord.json())) as Record<string, string[]>;
    expect(vernietigingen[taakId]).toHaveLength(1);
    await controleerBijStekker("http://localhost:39706", taakId, aantalKandidaten);
  }, 300_000);
});
