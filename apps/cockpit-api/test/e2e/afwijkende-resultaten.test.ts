import { afterAll, describe, expect, it } from "vitest";
import { API, api, auditActies, maakTaak, prisma, statuswijziging, token, totVrijgegeven, wachtOp } from "./helpers.js";

// Scenario G: de stekker meldt bij een deel van de kandidaten FAILED, CHANGED, NOT_FOUND of
// SKIPPED (stekker-afwijkend, elk 10%, deterministisch per kandidaat). Vastgelegd gedrag
// (besluit stap 19): de taak gaat naar resultaat, per kandidaat staat het gemelde resultaat,
// de verklaring en de CSV tonen de aantallen per uitkomst en archiveren kan.

const UITKOMSTEN = ["SUCCESS", "FAILED", "CHANGED", "NOT_FOUND", "SKIPPED"] as const;

afterAll(async () => {
  await prisma.client.$disconnect();
});

describe("afwijkende resultaten (scenario G)", () => {
  it("legt elk gemeld resultaat vast, telt ze in verklaring en CSV, en laat archiveren toe", async () => {
    const { taakId } = await maakTaak("Scenario G (afwijkende resultaten)", "http://stekker-afwijkend:3000");
    const { aantalKandidaten } = await totVrijgegeven(taakId);
    expect((await statuswijziging("rm", taakId, "vernietigingsopdracht")).status).toBe(201);
    await wachtOp("taak naar resultaat", () => api("rm", `/taken/${taakId}`), (antwoord) => antwoord.body?.status === "resultaat", 120_000);

    // Per kandidaat het gemelde resultaat; elke uitkomst komt voor.
    const { body } = await api("rm", `/taken/${taakId}/vernietigingsresultaten`);
    expect(body.resultaten).toHaveLength(aantalKandidaten);
    const perUitkomst = Object.fromEntries(
      UITKOMSTEN.map((uitkomst) => [
        uitkomst,
        body.resultaten.filter((resultaat: { resultaat: string }) => resultaat.resultaat === uitkomst).length,
      ])
    ) as Record<(typeof UITKOMSTEN)[number], number>;
    expect(Object.values(perUitkomst).reduce((som, aantal) => som + aantal, 0)).toBe(aantalKandidaten);
    for (const uitkomst of UITKOMSTEN) {
      expect(perUitkomst[uitkomst], uitkomst).toBeGreaterThan(0);
    }

    const uitvoering = await api("rm", `/taken/${taakId}/uitvoering`);
    expect(uitvoering.body.stekkers[0].resultaatTellingen).toEqual({
      success: perUitkomst.SUCCESS,
      failed: perUitkomst.FAILED,
      notFound: perUitkomst.NOT_FOUND,
      skipped: perUitkomst.SKIPPED,
      changed: perUitkomst.CHANGED,
    });

    // Audit: één event per object, succes en niet-succes apart.
    const acties = await auditActies(taakId);
    expect(acties.filter((actie) => actie === "Vernietigen")).toHaveLength(perUitkomst.SUCCESS);
    expect(acties.filter((actie) => actie === "Niet vernietigd")).toHaveLength(aantalKandidaten - perUitkomst.SUCCESS);

    // Verklaring en CSV tonen dezelfde aantallen.
    const verklaring = await wachtOp(
      "verklaring gemaakt",
      () => api("rm", `/taken/${taakId}/verklaring`),
      (antwoord) => antwoord.body?.beschikbaar === true,
      120_000
    );
    expect(verklaring.body.tellingen).toMatchObject({
      aangeboden: aantalKandidaten,
      success: perUitkomst.SUCCESS,
      failed: perUitkomst.FAILED,
      notFound: perUitkomst.NOT_FOUND,
      skipped: perUitkomst.SKIPPED,
      changed: perUitkomst.CHANGED,
    });

    const csv = await (
      await fetch(`${API}/taken/${taakId}/verklaring/bijlage.csv`, { headers: { authorization: `Bearer ${await token("rm")}` } })
    ).text();
    const [kop, ...regels] = leesCsv(csv);
    const kolom = kop.indexOf("resultaat");
    expect(kolom).toBeGreaterThan(-1);
    for (const uitkomst of UITKOMSTEN) {
      expect(regels.filter((regel) => regel[kolom] === uitkomst), `CSV ${uitkomst}`).toHaveLength(perUitkomst[uitkomst]);
    }

    // Archiveren kan, ook met niet-geslaagde vernietigingen.
    const taak = await api("rm", `/taken/${taakId}/vernietigingsresultaten`);
    expect(taak.body.taak.toegestaneActies).toEqual(["archiveren"]);
    expect((await statuswijziging("rm", taakId, "archiveren")).status).toBe(202);
    await wachtOp("taak gearchiveerd", () => api("rm", `/taken/${taakId}/archivering`), (antwoord) => antwoord.body?.taakStatus === "archief", 60_000);
  });
});

// Eenvoudige CSV-lezer (RFC 4180: velden tussen aanhalingstekens, "" binnen een veld).
function leesCsv(tekst: string) {
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

  return regels.filter((r) => r.some((waarde) => waarde !== ""));
}
