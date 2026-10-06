import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BestandArchiefAdapter, sha256, type ArchiefPakket } from "./archief-adapter.js";

let basis: string;

beforeEach(async () => {
  basis = await mkdtemp(path.join(tmpdir(), "archief-test-"));
});

afterEach(async () => {
  await rm(basis, { recursive: true, force: true });
});

const pakket = (inhoud = "pdf"): ArchiefPakket => ({
  taakinstantieId: "taak-1",
  archiveringId: "arch-1",
  bestanden: [
    { naam: "verklaring.pdf", inhoud: Buffer.from(inhoud), contentType: "application/pdf" },
    { naam: "bijlage.csv", inhoud: Buffer.from("a,b\n1,2\n"), contentType: "text/csv; charset=utf-8" },
  ],
  manifest: { soort: "vernietigingsdossier" },
});

describe("BestandArchiefAdapter", () => {
  it("schrijft de bestanden en een manifest met SHA-256 per bestand in een map per taak en archivering", async () => {
    const resultaat = await new BestandArchiefAdapter(basis).archiveer(pakket());
    const map = path.join(basis, "taak-1", "arch-1");

    expect(resultaat.locatie).toBe(map);
    expect((await readdir(map)).sort()).toEqual(["bijlage.csv", "manifest.json", "verklaring.pdf"]);
    const manifestTekst = await readFile(path.join(map, "manifest.json"));
    expect(resultaat.manifestSha256).toBe(sha256(manifestTekst));
    expect(JSON.parse(manifestTekst.toString("utf8"))).toEqual({
      soort: "vernietigingsdossier",
      bestanden: [
        { naam: "verklaring.pdf", contentType: "application/pdf", bytes: 3, sha256: sha256("pdf") },
        { naam: "bijlage.csv", contentType: "text/csv; charset=utf-8", bytes: 8, sha256: sha256("a,b\n1,2\n") },
      ],
    });
    // Geen tijdelijke map achtergebleven.
    expect(await readdir(path.join(basis, "taak-1"))).toEqual(["arch-1"]);
  });

  it("is idempotent: een herhaalde poging laat het bestaande pakket staan", async () => {
    const adapter = new BestandArchiefAdapter(basis);
    const eerste = await adapter.archiveer(pakket("pdf"));
    const tweede = await adapter.archiveer(pakket("andere inhoud"));

    expect(tweede).toEqual(eerste);
    expect((await readFile(path.join(basis, "taak-1", "arch-1", "verklaring.pdf"))).toString()).toBe("pdf");
  });
});
