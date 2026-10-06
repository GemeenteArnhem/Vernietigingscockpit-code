import { createHash } from "node:crypto";
import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../shared/db/prisma.service.js";
import { schrijfAuditEvent, type AuditActor } from "../audit/audit-keten.js";
import { verifieerTaakKeten } from "../audit/audit.service.js";
import { ACTIEVE_SELECTIE } from "../taken/actieve-selectie.js";

// Vernietigingsverklaring (CC-17). De worker maakt hem bij de overgang naar `resultaat`;
// de API levert alleen opgeslagen versies. Inhoud volgens bouwplan stap 6: taak en
// verantwoordelijken, per stekker de versies en id's, de resultaten, de uitgesloten
// kandidaten per reden, het verloop van de besluitvorming en de integriteitsgegevens
// (CSV-bijlage, lijst- en auditloghash). PDF/A-2b via Gotenberg.

const BESLUITEN = {
  REVIEW_SUBMITTED: "Voorgelegd ter accordering",
  APPROVAL_GRANTED: "Akkoord",
  APPROVAL_REJECTED: "Teruggestuurd naar recordmanager",
  DESTRUCTION_APPROVED_BY_ARCHIVIST: "Vrijgegeven voor vernietiging",
  DESTRUCTION_ORDERED_BY_RM: "Vernietigingsopdracht gegeven",
  EXECUTION_COMPLETED: "Uitvoering afgerond",
} as const;

const ROLNAMEN: Record<string, string> = {
  recordmanager: "Recordmanager",
  proceseigenaar: "Proceseigenaar",
  archivaris: "Archivaris",
};

export type VerklaringGegevens = Awaited<ReturnType<VerklaringMaker["verzamel"]>>;

export class VerklaringMaker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  // Alle gegevens voor de verklaring, uit de eigen database.
  async verzamel(taakinstantieId: string) {
    const db = this.prisma.client;
    const persoon = { select: { naam: true, email: true } } as const;
    const taak = await db.taakinstantie.findUniqueOrThrow({
      where: { id: taakinstantieId },
      select: {
        id: true,
        naam: true,
        status: true,
        stapSinds: true,
        peildatum: true,
        ronde: true,
        lijstHash: true,
        afgerondOp: true,
        taakdefinitie: { select: { naam: true } },
        recordmanager: persoon,
        proceseigenaar: persoon,
        archivaris: persoon,
      },
    });
    const [selecties, kandidaten, besluitEvents, retourPerRonde] = await Promise.all([
      db.selectie.findMany({
        where: { taakinstantieId, ...ACTIEVE_SELECTIE },
        include: { stekkerConfiguratie: { include: { stekker: true } }, vernietiging: true },
        orderBy: { selectietijdstip: "asc" },
      }),
      db.vernietigingskandidaat.findMany({
        where: { selectie: { taakinstantieId, ...ACTIEVE_SELECTIE } },
        include: {
          uitvoeringsresultaten: true,
          selectie: { select: { stekkerConfiguratie: { select: { stekker: { select: { naam: true } } } } } },
        },
        orderBy: [{ vernietigingsdatum: "asc" }, { kandidaatId: "asc" }],
      }),
      db.auditEvent.findMany({
        where: { taakinstantieId, entiteitType: "taakinstantie", actie: { in: Object.keys(BESLUITEN) } },
        orderBy: { id: "asc" },
        select: { tijdstip: true, actie: true, actorId: true, actorNaam: true, actorType: true, rol: true },
      }),
      db.kandidaatBesluit.groupBy({
        by: ["ronde", "rol", "besluit"],
        where: { taakinstantieId },
        _count: { _all: true },
        orderBy: [{ ronde: "asc" }, { rol: "asc" }],
      }),
    ]);

    const zonderResultaat = kandidaten.filter(
      (kandidaat) => kandidaat.beoordeling === "AKKOORD" && !kandidaat.uitvoeringsresultaten[0]?.resultaat
    ).length;

    if (zonderResultaat > 0) {
      throw new ConflictException(
        `Voor ${zonderResultaat} kandidaten is nog geen resultaat van de stekker; de verklaring kan nog niet worden gemaakt.`
      );
    }

    const rijen = kandidaten.map((kandidaat) => {
      const resultaat = kandidaat.uitvoeringsresultaten[0];
      return {
        kandidaatId: kandidaat.kandidaatId,
        bronId: kandidaat.bronId,
        bronIdNaam: kandidaat.bronIdNaam,
        omschrijving: kandidaat.omschrijving,
        stekker: kandidaat.selectie.stekkerConfiguratie.stekker.naam,
        classificatiesleutel: kandidaat.classificatiesleutel,
        selectielijst: kandidaat.selectielijst,
        grondslag: kandidaat.grondslag,
        bewaartermijn: kandidaat.bewaartermijn,
        begindatum: datum(kandidaat.begindatum),
        einddatum: datum(kandidaat.einddatum),
        vernietigingsdatum: datum(kandidaat.vernietigingsdatum),
        aantalObjecten: kandidaat.aantalObjecten,
        aantalBetrokkenen: kandidaat.aantalBetrokkenen,
        beoordeling: kandidaat.beoordeling,
        uitsluitReden: kandidaat.uitsluitReden,
        vernietigingsstatus: resultaat?.resultaat ?? null,
        foutcode: resultaat?.foutcode ?? null,
        foutmelding: resultaat?.foutmelding ?? null,
        bronstatus: resultaat?.bronstatus ?? null,
        logReference: resultaat?.logReference ?? null,
        correlatieId: resultaat?.correlatieId ?? null,
      };
    });

    const aangeboden = rijen.filter((rij) => rij.beoordeling === "AKKOORD");
    const telling = (status: string) => aangeboden.filter((rij) => rij.vernietigingsstatus === status).length;
    const uitgesloten = rijen.filter((rij) => rij.beoordeling === "UITGESLOTEN");
    const perReden = new Map<string, number>();
    for (const rij of uitgesloten) {
      const reden = rij.uitsluitReden?.trim() || "(geen reden opgegeven)";
      perReden.set(reden, (perReden.get(reden) ?? 0) + 1);
    }

    // Namen zoals vastgelegd bij de medewerker (via de koppeling op sub, CC-12); de naam
    // uit het token is alleen een terugvaloptie.
    const subs = Array.from(new Set(besluitEvents.map((event) => event.actorId).filter((id): id is string => Boolean(id))));
    const gekoppeld = await db.gebruiker.findMany({
      where: { id: { in: subs } },
      select: { id: true, medewerker: { select: { naam: true } } },
    });
    const naamVan = new Map(gekoppeld.map((gebruiker) => [gebruiker.id, gebruiker.medewerker?.naam]));

    let ronde = 1;
    const besluitvorming = besluitEvents.map((event) => {
      const regel = {
        tijdstip: event.tijdstip.toISOString(),
        ronde,
        naam:
          event.actorType === "system"
            ? "Vernietigingscockpit"
            : ((event.actorId ? naamVan.get(event.actorId) : undefined) ?? event.actorNaam ?? "-"),
        rol: event.rol ? (ROLNAMEN[event.rol] ?? event.rol) : "Systeem",
        besluit: BESLUITEN[event.actie as keyof typeof BESLUITEN],
      };
      if (event.actie === "APPROVAL_REJECTED") {
        ronde += 1;
      }
      return regel;
    });

    return {
      taak: {
        id: taak.id,
        naam: taak.naam,
        status: taak.status,
        stapSinds: taak.stapSinds.toISOString(),
        taakdefinitie: taak.taakdefinitie.naam,
        peildatum: datum(taak.peildatum),
        rondes: taak.ronde,
        afgerondOp: taak.afgerondOp?.toISOString() ?? null,
        verantwoordelijken: {
          recordmanager: taak.recordmanager,
          proceseigenaar: taak.proceseigenaar,
          archivaris: taak.archivaris,
        },
      },
      stekkers: selecties.map((selectie) => ({
        naam: selectie.stekkerConfiguratie.stekker.naam,
        stekkerversie: selectie.stekkerversie,
        configuratieversie: selectie.configuratieversie,
        apiVersie: selectie.apiVersie,
        selectieId: selectie.externSelectieId,
        peildatum: datum(selectie.peildatum),
        selectietijdstip: selectie.selectietijdstip?.toISOString() ?? null,
        vernietigingId: selectie.vernietiging?.externVernietigingId ?? null,
        vernietigingStatus: selectie.vernietiging?.stekkerStatus ?? null,
        vernietigingAfgerondOp: (selectie.vernietiging?.stekkerEindtijd ?? selectie.vernietiging?.afgerondOp)?.toISOString() ?? null,
        besluitReferentie: selectie.vernietiging?.besluitReferentie ?? null,
      })),
      tellingen: {
        aangeboden: aangeboden.length,
        success: telling("SUCCESS"),
        failed: telling("FAILED"),
        notFound: telling("NOT_FOUND"),
        skipped: telling("SKIPPED"),
        changed: telling("CHANGED"),
        aantalObjecten: aangeboden.reduce((som, rij) => som + rij.aantalObjecten, 0),
        aantalBetrokkenen: aangeboden.reduce((som, rij) => som + rij.aantalBetrokkenen, 0),
        uitgesloten: uitgesloten.length,
      },
      uitgeslotenPerReden: [...perReden.entries()]
        .map(([reden, aantal]) => ({ reden, aantal }))
        .sort((a, b) => b.aantal - a.aantal || a.reden.localeCompare(b.reden)),
      besluitvorming,
      retourPerRonde: retourPerRonde
        .filter((groep) => groep.besluit === "RETOUR")
        .map((groep) => ({ ronde: groep.ronde, rol: ROLNAMEN[groep.rol] ?? groep.rol, aantal: groep._count._all })),
      lijstHash: taak.lijstHash,
      rijen,
    };
  }

  // Genereert een nieuwe versie (PDF en CSV), slaat die op en legt het vast in het auditlog.
  async genereer(taakinstantieId: string, actor: AuditActor) {
    const gegevens = await this.verzamel(taakinstantieId);
    // De auditketen tot nu toe; het event van deze verklaring komt er straks achter.
    const keten = await verifieerTaakKeten(this.prisma, taakinstantieId);
    const csv = maakCsv(gegevens.rijen);
    const csvBuffer = Buffer.from(csv, "utf8");
    const csvSha256 = createHash("sha256").update(csvBuffer).digest("hex");
    const gegenereerdOp = new Date().toISOString();

    // Eerst het document maken (buiten de transactie: Gotenberg kan even duren); de unieke
    // (taak, versie) voorkomt dat twee gelijktijdige generaties dezelfde versie krijgen.
    const vorige = await this.prisma.client.verklaring.findFirst({
      where: { taakinstantieId },
      orderBy: { versie: "desc" },
      select: { versie: true },
    });
    const versie = (vorige?.versie ?? 0) + 1;
    const metadata = maakMetadata(gegevens, {
      versie,
      gegenereerdOp,
      bestandsnaam: `vernietigingsresultaten-${taakinstantieId}.csv`,
      aantalRegels: gegevens.rijen.length,
      csvSha256,
      auditlog: { aantalEvents: keten.aantalEvents, laatsteHash: keten.laatsteHash, intact: keten.intact },
    });
    const pdf = await this.pdf(maakHtml(metadata));
    const pdfSha256 = createHash("sha256").update(pdf).digest("hex");

    return this.prisma.client.$transaction(async (tx) => {
      const verklaring = await tx.verklaring.create({
        data: {
          taakinstantieId,
          versie,
          status: "gegenereerd",
          pdf,
          pdfSha256,
          csv: csvBuffer,
          csvSha256,
          csvBestandsnaam: metadata.bijlage.bestandsnaam,
          metadata: metadata as unknown as Prisma.InputJsonValue,
          gegenereerdDoor: actor.type === "user" ? actor.user.sub : "systeem",
        },
      });

      await schrijfAuditEvent(tx, actor, {
        taakinstantieId,
        actie: "CERTIFICATE_GENERATED",
        entiteitType: "verklaring",
        entiteitId: verklaring.id,
        details: {
          versie,
          pdfSha256,
          csvSha256,
          aantalRegels: metadata.bijlage.aantalRegels,
          auditlogHash: keten.laatsteHash,
          pdfa: "PDF/A-2b",
        },
      });

      return verklaring;
    });
  }

  // Alleen de metadata, voor de weergave zolang er nog geen verklaring is.
  async voorbeeld(taakinstantieId: string) {
    const gegevens = await this.verzamel(taakinstantieId);
    return maakMetadata(gegevens, {
      versie: 0,
      gegenereerdOp: new Date().toISOString(),
      bestandsnaam: `vernietigingsresultaten-${taakinstantieId}.csv`,
      aantalRegels: gegevens.rijen.length,
      csvSha256: "",
      auditlog: null,
    });
  }

  private async pdf(html: string) {
    const gotenbergUrl = this.config.get<string>("GOTENBERG_URL")?.trim();

    if (!gotenbergUrl) {
      throw new ServiceUnavailableException("GOTENBERG_URL is niet geconfigureerd voor PDF-generatie.");
    }

    const form = new FormData();
    form.append("files", new Blob([html], { type: "text/html" }), "index.html");
    // Archiefformaat (CC-17): PDF/A-2b, met ingesloten lettertypen.
    form.append("pdfa", "PDF/A-2b");
    form.append("printBackground", "true");

    const response = await fetch(gotenbergHtmlUrl(gotenbergUrl), {
      method: "POST",
      headers: gotenbergAuth(this.config.get<string>("GOTENBERG_USERNAME"), this.config.get<string>("GOTENBERG_PASSWORD")),
      body: form,
    });

    if (!response.ok) {
      // De foutbody van Gotenberg kan documentinhoud bevatten: niet doorgeven (CC-11).
      throw new ServiceUnavailableException(`PDF-generatie via Gotenberg is mislukt met status ${response.status}.`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

export type VerklaringMetadata = ReturnType<typeof maakMetadata>;

function maakMetadata(
  gegevens: VerklaringGegevens,
  opties: {
    versie: number;
    gegenereerdOp: string;
    bestandsnaam: string;
    aantalRegels: number;
    csvSha256: string;
    auditlog: { aantalEvents: number; laatsteHash: string | null; intact: boolean } | null;
  }
) {
  const { rijen: _rijen, ...rest } = gegevens;
  void _rijen;

  return {
    ...rest,
    versie: opties.versie,
    status: "gegenereerd",
    gegenereerdOp: opties.gegenereerdOp,
    bijlage: {
      bestandsnaam: opties.bestandsnaam,
      contentType: "text/csv; charset=utf-8",
      aantalRegels: opties.aantalRegels,
      sha256: opties.csvSha256,
    },
    integriteit: {
      lijstHash: gegevens.lijstHash,
      auditlog: opties.auditlog,
    },
  };
}

export function maakCsv(rijen: VerklaringGegevens["rijen"]) {
  const kolommen: Array<[string, (rij: VerklaringGegevens["rijen"][number]) => unknown]> = [
    ["kandidaat_id", (rij) => rij.kandidaatId],
    ["bron_id", (rij) => rij.bronId],
    ["bron_id_naam", (rij) => rij.bronIdNaam],
    ["omschrijving", (rij) => rij.omschrijving],
    ["stekker", (rij) => rij.stekker],
    ["classificatiesleutel", (rij) => rij.classificatiesleutel],
    ["selectielijst", (rij) => rij.selectielijst],
    ["grondslag", (rij) => rij.grondslag],
    ["bewaartermijn", (rij) => rij.bewaartermijn],
    ["begindatum", (rij) => rij.begindatum],
    ["einddatum", (rij) => rij.einddatum],
    ["vernietigingsdatum", (rij) => rij.vernietigingsdatum],
    ["aantal_objecten", (rij) => rij.aantalObjecten],
    ["aantal_betrokkenen", (rij) => rij.aantalBetrokkenen],
    ["beoordeling", (rij) => rij.beoordeling],
    ["uitsluit_reden", (rij) => rij.uitsluitReden],
    ["vernietigingsstatus", (rij) => rij.vernietigingsstatus],
    ["foutcode", (rij) => rij.foutcode],
    ["foutmelding", (rij) => rij.foutmelding],
    ["bronstatus", (rij) => rij.bronstatus],
    ["log_reference", (rij) => rij.logReference],
    ["correlatie_id", (rij) => rij.correlatieId],
  ];

  return [
    kolommen.map(([kop]) => csvWaarde(kop)).join(","),
    ...rijen.map((rij) => kolommen.map(([, waarde]) => csvWaarde(waarde(rij))).join(",")),
  ].join("\r\n");
}

export function maakHtml(m: VerklaringMetadata) {
  const v = m.taak.verantwoordelijken;
  const tabel = (koppen: string[], regels: unknown[][], klasse = "") =>
    `<table class="lijst ${klasse}"><thead><tr>${koppen.map((kop) => `<th>${html(kop)}</th>`).join("")}</tr></thead><tbody>${
      regels.length
        ? regels.map((regel) => `<tr>${regel.map((cel) => `<td>${html(cel)}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${koppen.length}" class="leeg">Geen</td></tr>`
    }</tbody></table>`;
  const gegevens = (regels: Array<[string, unknown, string?]>) =>
    `<table class="gegevens"><tbody>${regels
      .map(([label, waarde, klasse]) => `<tr><th>${html(label)}</th><td${klasse ? ` class="${klasse}"` : ""}>${html(waarde)}</td></tr>`)
      .join("")}</tbody></table>`;
  const t = m.tellingen;

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <title>Vernietigingsverklaring ${html(m.taak.naam)}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 20mm; }
    body { color: #0f172a; font-family: "DejaVu Sans", Arial, sans-serif; font-size: 10.5px; line-height: 1.5; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { border-bottom: 1px solid #cbd5e1; font-size: 13.5px; margin: 22px 0 8px; padding-bottom: 4px; page-break-after: avoid; }
    p { margin: 0 0 8px; }
    .kop { border-bottom: 2px solid #0f172a; margin-bottom: 14px; padding-bottom: 10px; }
    .sub { color: #475569; }
    table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; text-align: left; vertical-align: top; }
    .gegevens th { color: #475569; font-weight: 700; width: 32%; }
    .lijst thead th { background: #f1f5f9; color: #334155; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .getallen td:not(:first-child) { text-align: right; }
    .hash { font-family: "DejaVu Sans Mono", Consolas, monospace; font-size: 9px; overflow-wrap: anywhere; }
    .leeg { color: #64748b; font-style: italic; }
    .voet { border-top: 1px solid #cbd5e1; color: #475569; font-size: 9px; margin-top: 24px; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="kop">
    <h1>Vernietigingsverklaring</h1>
    <div class="sub">${html(m.taak.naam)} &middot; versie ${html(m.versie)} &middot; ${html(datumTijd(m.gegenereerdOp))}</div>
  </div>

  <p>Deze verklaring legt vast welke vernietigingskandidaten na beoordeling en accordering zijn aangeboden voor vernietiging, met welk resultaat de gekoppelde bronsystemen ze hebben verwerkt, en op basis van welke besluiten. De volledige lijst staat in de CSV-bijlage; de integriteit van bijlage en besluitvorming is controleerbaar met de vermelde hashwaarden.</p>

  <h2>Taak</h2>
  ${gegevens([
    ["Taak", m.taak.naam],
    ["Taakdefinitie", m.taak.taakdefinitie],
    ["Taak-id", m.taak.id, "hash"],
    ["Peildatum", m.taak.peildatum ?? "-"],
    ["Uitvoering afgerond", m.taak.afgerondOp ? datumTijd(m.taak.afgerondOp) : "-"],
    ["Recordmanager", persoon(v.recordmanager)],
    ["Proceseigenaar", persoon(v.proceseigenaar)],
    ["Archivaris", persoon(v.archivaris)],
  ])}

  <h2>Resultaat</h2>
  ${tabel(
    ["Onderdeel", "Aantal"],
    [
      ["Aangeboden voor vernietiging", t.aangeboden],
      ["Vernietigd (SUCCESS)", t.success],
      ["Mislukt (FAILED)", t.failed],
      ["Niet gevonden (NOT_FOUND)", t.notFound],
      ["Gewijzigd sinds selectie (CHANGED)", t.changed],
      ["Overgeslagen (SKIPPED)", t.skipped],
      ["Objecten in aangeboden kandidaten", t.aantalObjecten],
      ["Betrokkenen in aangeboden kandidaten", t.aantalBetrokkenen],
      ["Uitgesloten van vernietiging", t.uitgesloten],
    ].map(([label, aantal]) => [label, Number(aantal).toLocaleString("nl-NL")]),
    "getallen"
  )}

  <h2>Uitgesloten van vernietiging, per reden</h2>
  ${tabel(["Reden", "Aantal"], m.uitgeslotenPerReden.map((regel) => [regel.reden, regel.aantal.toLocaleString("nl-NL")]), "getallen")}

  <h2>Uitvoering per stekker</h2>
  ${m.stekkers
    .map((s) =>
      gegevens([
        ["Stekker", s.naam],
        ["Stekkerversie / configuratie / API", `${s.stekkerversie ?? "-"} / ${s.configuratieversie ?? "-"} / ${s.apiVersie ?? "-"}`],
        ["Selectie-id", s.selectieId ?? "-", "hash"],
        ["Peildatum en selectietijdstip", `${s.peildatum ?? "-"} / ${s.selectietijdstip ? datumTijd(s.selectietijdstip) : "-"}`],
        ["Vernietiging-id", s.vernietigingId ?? "-", "hash"],
        ["Status bij de stekker", s.vernietigingStatus ?? "-"],
        ["Afgerond bij de stekker", s.vernietigingAfgerondOp ? datumTijd(s.vernietigingAfgerondOp) : "-"],
        ["Besluitreferentie", s.besluitReferentie ?? "-", "hash"],
      ])
    )
    .join("")}

  <h2>Besluitvorming</h2>
  ${tabel(
    ["Tijdstip", "Ronde", "Naam", "Rol", "Besluit"],
    m.besluitvorming.map((regel) => [datumTijd(regel.tijdstip), regel.ronde, regel.naam, regel.rol, regel.besluit])
  )}
  ${
    m.retourPerRonde.length
      ? `<p style="margin-top:8px">Records teruggestuurd per ronde: ${m.retourPerRonde
          .map((regel) => `ronde ${html(regel.ronde)}, ${html(regel.rol.toLowerCase())}: ${html(regel.aantal)}`)
          .join("; ")}.</p>`
      : ""
  }

  <h2>Integriteit</h2>
  ${gegevens([
    ["CSV-bijlage", `${m.bijlage.bestandsnaam} (${m.bijlage.aantalRegels.toLocaleString("nl-NL")} regels, inclusief uitgesloten kandidaten)`],
    ["SHA-256 CSV-bijlage", m.bijlage.sha256, "hash"],
    ["Vingerafdruk lijst bij vrijgave", m.integriteit.lijstHash ?? "-", "hash"],
    ["Auditlog", m.integriteit.auditlog ? `${m.integriteit.auditlog.aantalEvents.toLocaleString("nl-NL")} events, keten ${m.integriteit.auditlog.intact ? "intact" : "NIET intact"}` : "-"],
    ["Laatste auditloghash", m.integriteit.auditlog?.laatsteHash ?? "-", "hash"],
  ])}

  <div class="voet">Gegenereerd door de Vernietigingscockpit op ${html(datumTijd(m.gegenereerdOp))}. PDF/A-2b. De hashwaarden zijn SHA-256; de auditloghash is de laatste schakel van de auditketen van deze taak op het moment van genereren.</div>
</body>
</html>`;
}

function persoon(p: { naam: string; email: string | null }) {
  return p.email ? `${p.naam} (${p.email})` : p.naam;
}

function datum(waarde: Date | null) {
  return waarde?.toISOString().slice(0, 10) ?? null;
}

function datumTijd(iso: string) {
  return new Date(iso).toLocaleString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function csvWaarde(waarde: unknown) {
  if (waarde === null || waarde === undefined) {
    return "";
  }

  const tekst = String(waarde);
  return /[",\r\n]/.test(tekst) ? `"${tekst.replaceAll('"', '""')}"` : tekst;
}

function html(waarde: unknown) {
  return String(waarde ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function gotenbergAuth(gebruiker: string | undefined, wachtwoord: string | undefined) {
  return gebruiker && wachtwoord
    ? { Authorization: `Basic ${Buffer.from(`${gebruiker}:${wachtwoord}`).toString("base64")}` }
    : undefined;
}

function gotenbergHtmlUrl(basis: string) {
  const genormaliseerd = basis.replace(/\/$/, "");
  return genormaliseerd.includes("/forms/") ? genormaliseerd : `${genormaliseerd}/forms/chromium/convert/html`;
}
