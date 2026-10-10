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
    { naam: "kandidaten/k-1.mdto.xml", inhoud: Buffer.from("<MDTO/>"), contentType: "application/xml" },
  ],
  dossierXml: Buffer.from("<MDTO>dossier</MDTO>"),
});

describe("BestandArchiefAdapter", () => {
  it("schrijft de bestanden (ook in submappen) en als laatste dossier.mdto.xml in een map per taak en archivering", async () => {
    const resultaat = await new BestandArchiefAdapter(basis).archiveer(pakket());
    const map = path.join(basis, "taak-1", "arch-1");

    expect(resultaat.locatie).toBe(map);
    expect((await readdir(map)).sort()).toEqual(["bijlage.csv", "dossier.mdto.xml", "kandidaten", "verklaring.pdf"]);
    expect(await readdir(path.join(map, "kandidaten"))).toEqual(["k-1.mdto.xml"]);
    expect(resultaat.dossierSha256).toBe(sha256(await readFile(path.join(map, "dossier.mdto.xml"))));
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

  it("weigert een bestandsnaam buiten de pakketmap en laat geen half pakket staan", async () => {
    const kwaad = { ...pakket(), bestanden: [{ naam: "../ontsnapt.txt", inhoud: Buffer.from("x"), contentType: "text/plain" }] };

    await expect(new BestandArchiefAdapter(basis).archiveer(kwaad)).rejects.toThrow(/Ongeldige bestandsnaam/);
    expect(await readdir(path.join(basis, "taak-1"))).toEqual([]);
  });
});
