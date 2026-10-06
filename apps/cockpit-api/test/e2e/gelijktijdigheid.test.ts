import { afterAll, describe, expect, it } from "vitest";
import { api, auditActies, maakTaak, prisma, wachtOp } from "./helpers.js";

afterAll(async () => {
  await prisma.client.$disconnect();
});

// Scenario E: twee tabbladen (of een dubbelklik) op dezelfde statuswijziging.
describe("statuswijzigingen over HTTP: If-Match en foutcodes", () => {
  it("vraagt If-Match (428), weigert een verouderde versie (412) en laat één van twee gelijktijdige verzoeken slagen", async () => {
    const { taakId } = await maakTaak("Gelijktijdigheid E2E", "http://stekker:3000");
    await api("rm", `/taken/${taakId}/selectie`, { method: "POST", body: {} });
    await wachtOp("taak naar beoordeling", () => api("rm", `/taken/${taakId}`), (antwoord) => antwoord.body?.status === "beoordeling");

    const { body } = await api("rm", `/taken/${taakId}/kandidaten`);
    for (const kandidaat of body.kandidaten) {
      await api("rm", `/taken/${taakId}/kandidaten/${kandidaat.id}/beoordeling`, {
        method: "PATCH",
        body: { beoordeling: "AKKOORD" },
      });
    }

    const taak = await api("rm", `/taken/${taakId}`);
    expect(taak.etag).toBe(`"${taak.body.versie}"`);
    expect(body.taak.versie).toBe(taak.body.versie);

    const voorleggen = (ifMatch?: string) =>
      api("rm", `/taken/${taakId}/beoordeling/voorleggen`, { method: "POST", ifMatch });

    expect((await voorleggen()).status).toBe(428);
    expect((await voorleggen(`"${taak.body.versie - 1}"`)).status).toBe(412);

    const [eerste, tweede] = await Promise.all([voorleggen(taak.etag!), voorleggen(taak.etag!)]);
    expect([eerste.status, tweede.status].sort()).toEqual([201, 412]);

    const na = await api("rm", `/taken/${taakId}`);
    expect(na.body).toMatchObject({ status: "accordering_po", versie: taak.body.versie + 1 });

    // Zelfde actie opnieuw met de nieuwe versie: verkeerde status.
    expect((await voorleggen(na.etag!)).status).toBe(409);
    // Verkeerde rol voor deze taak.
    expect(
      (await api("arch", `/taken/${taakId}/accordering/archivaris/besluiten`, { method: "POST", ifMatch: na.etag! }))
        .status
    ).toBe(409);
    expect(
      (await api("po", `/taken/${taakId}/beoordeling/voorleggen`, { method: "POST", ifMatch: na.etag! })).status
    ).toBe(403);

    // Na het gelijktijdige voorleggen: één REVIEW_SUBMITTED en een keten zonder vertakkingen.
    const acties = await auditActies(taakId);
    expect(acties.filter((actie) => actie === "REVIEW_SUBMITTED")).toHaveLength(1);
    expect((await api("rm", `/taken/${taakId}/auditlog/verificatie`)).body).toMatchObject({ intact: true, fouten: [] });
  });

  it("geeft 404 bij een onbekend id en 400 bij een ongeldig id, zonder interne details", async () => {
    const onbekend = await api("rm", "/taken/00000000-0000-4000-8000-000000000001");
    expect(onbekend.status).toBe(404);
    const ongeldig = await api("rm", "/taken/geen-uuid");
    expect(ongeldig.status).toBe(400);
    for (const antwoord of [onbekend, ongeldig]) {
      expect(JSON.stringify(antwoord.body)).not.toMatch(/prisma|invalid input|P20/i);
    }
  });
});
