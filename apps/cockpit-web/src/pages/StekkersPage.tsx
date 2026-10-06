import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pencil, Plug, PlugZap, Plus, Power, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import ActieFoutmelding from "../components/ActieFoutmelding";
import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelSection,
} from "../components/ActionPanel";
import ConfirmDialog from "../components/ConfirmDialog";
import ContentPanel, { ContentPanelEmptyState } from "../components/ContentPanel";
import RecordDetailsPanel from "../features/task-execution/components/RecordDetailsPanel";
import TaskExecutionHeader from "../features/task-execution/components/TaskExecutionHeader";
import { AppShellPortal } from "../layouts/AppShellPortalContext";
import {
  getStekkersBeheer,
  verwijderStekker,
  zetStekkerActief,
  type ApiStekkerBeheer,
} from "../api/stekkerbeheer";
import { serverFoutmelding } from "../api/apiClient";
import { useSessionUser } from "../auth/useSessionUser";

// Stekkerbeheer (functioneel beheerder): overzicht van alle stekkers, met in het actiepanel
// bewerken, nieuw, (de)activeren en verwijderen, en de details van de gekozen stekker.

type ActieId = "bewerken" | "nieuw" | "deactiveren" | "activeren" | "verwijderen";

type Actie = {
  id: ActieId;
  title: string;
  description: string;
  icon: ReactNode;
  tone: "primary" | "success" | "warning" | "danger";
};

const AUTHENTICATIE: Record<string, string> = {
  none: "Geen",
  oauth2_cc: "OAuth2 (client credentials)",
};

const formatDatum = (waarde: string) =>
  new Date(waarde).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" });

function acties(stekker: ApiStekkerBeheer | null): Actie[] {
  const lijst: Actie[] = [];

  if (stekker?.toegestaneActies.includes("stekker.bewerken")) {
    lijst.push({
      id: "bewerken",
      title: "Stekker bewerken",
      description: "Wijzig de verbinding; opslaan maakt een nieuwe configuratieversie.",
      icon: <Pencil size={18} />,
      tone: "primary",
    });
  }

  lijst.push({
    id: "nieuw",
    title: "Nieuwe stekker",
    description: "Voeg een stekker toe met verbinding en authenticatie.",
    icon: <Plus size={18} />,
    tone: "success",
  });

  if (stekker?.toegestaneActies.includes("stekker.deactiveren")) {
    lijst.push({
      id: "deactiveren",
      title: "Stekker deactiveren",
      description: "Niet meer te kiezen voor nieuwe taken; de historie blijft.",
      icon: <Power size={18} />,
      tone: "warning",
    });
  }

  if (stekker?.toegestaneActies.includes("stekker.activeren")) {
    lijst.push({
      id: "activeren",
      title: "Stekker activeren",
      description: "Weer beschikbaar voor taakdefinities en selecties.",
      icon: <PlugZap size={18} />,
      tone: "success",
    });
  }

  if (stekker?.toegestaneActies.includes("stekker.verwijderen")) {
    lijst.push({
      id: "verwijderen",
      title: "Stekker verwijderen",
      description: "Alleen mogelijk omdat deze stekker nog nergens is gebruikt.",
      icon: <Trash2 size={18} />,
      tone: "danger",
    });
  }

  return lijst;
}

export default function StekkersPage() {
  const navigate = useNavigate();
  const { accessToken } = useSessionUser();
  const [stekkers, setStekkers] = useState<ApiStekkerBeheer[]>([]);
  const [laden, setLaden] = useState(true);
  const [laadFout, setLaadFout] = useState<string | null>(null);
  const [actieFout, setActieFout] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");
  const [geselecteerdId, setGeselecteerdId] = useState<string | null>(null);
  const [gekozenActie, setGekozenActie] = useState<ActieId | null>(null);
  const [bevestigen, setBevestigen] = useState(false);
  const [bezig, setBezig] = useState(false);

  const laad = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    try {
      const lijst = await getStekkersBeheer(accessToken);
      setStekkers(lijst);
      setLaadFout(null);
      setGeselecteerdId((huidig) => (huidig && lijst.some((stekker) => stekker.id === huidig) ? huidig : lijst[0]?.id ?? null));
    } catch (fout) {
      setLaadFout(serverFoutmelding(fout, "Stekkers laden is mislukt."));
    } finally {
      setLaden(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void laad();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [laad]);

  const zichtbaar = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return term
      ? stekkers.filter((stekker) =>
          [stekker.naam, stekker.omschrijving ?? "", stekker.configuratie?.baseUrl ?? ""].some((waarde) =>
            waarde.toLowerCase().includes(term)
          )
        )
      : stekkers;
  }, [stekkers, zoek]);

  const geselecteerd = stekkers.find((stekker) => stekker.id === geselecteerdId) ?? null;
  const index = geselecteerd ? zichtbaar.findIndex((stekker) => stekker.id === geselecteerd.id) : -1;
  const beschikbareActies = acties(geselecteerd);
  const actieveActie =
    beschikbareActies.find((actie) => actie.id === gekozenActie) ?? beschikbareActies[0] ?? null;

  const kies = (id: string) => {
    setGeselecteerdId(id);
    setGekozenActie(null);
    setActieFout(null);
  };

  const voerUit = () => {
    if (!actieveActie) {
      return;
    }

    setActieFout(null);

    if (actieveActie.id === "nieuw") {
      navigate("/stekkers/nieuw");
    } else if (actieveActie.id === "bewerken" && geselecteerd) {
      navigate(`/stekkers/${geselecteerd.id}/bewerken`);
    } else {
      setBevestigen(true);
    }
  };

  const bevestig = async () => {
    if (!accessToken || !geselecteerd || !actieveActie) {
      return;
    }

    setBezig(true);

    try {
      if (actieveActie.id === "verwijderen") {
        await verwijderStekker(accessToken, geselecteerd.id);
        setGeselecteerdId(null);
      } else {
        await zetStekkerActief(accessToken, geselecteerd.id, actieveActie.id === "activeren");
      }
      setGekozenActie(null);
      await laad();
    } catch (fout) {
      setActieFout(serverFoutmelding(fout, "De actie is mislukt."));
    } finally {
      setBezig(false);
      setBevestigen(false);
    }
  };

  const details = geselecteerd ? stekkerDetails(geselecteerd) : [];

  return (
    <>
      <AppShellPortal slot="detail">
        {geselecteerd ? (
          <RecordDetailsPanel
            heading="Stekker details"
            record={{ titel: geselecteerd.naam }}
            comments={[]}
            showTabs={false}
            currentIndex={index >= 0 ? index + 1 : 0}
            totalCount={zichtbaar.length}
            onPrevious={index > 0 ? () => kies(zichtbaar[index - 1].id) : undefined}
            onNext={index >= 0 && index < zichtbaar.length - 1 ? () => kies(zichtbaar[index + 1].id) : undefined}
            details={details}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">
            Selecteer een stekker om details te zien.
          </div>
        )}
      </AppShellPortal>

      <AppShellPortal slot="action">
        <ActionPanel
          embedded
          title="Actie"
          titleClassName="text-sm"
          hideHeaderBorder
          hideFooterBorder
          bodyPaddingYClass="py-0"
          footer={
            actieveActie ? (
              <ActionPanelButtonGroup>
                <ActionPanelButton label="Actie uitvoeren" variant="primary" onClick={voerUit} />
              </ActionPanelButtonGroup>
            ) : undefined
          }
        >
          <ActionPanelSection title="Kies een actie">
            <div className="space-y-3">
              {beschikbareActies.map((actie) => (
                <ActionPanelChoice
                  key={actie.id}
                  title={actie.title}
                  description={actie.description}
                  icon={actie.icon}
                  tone={actie.tone}
                  density="compact"
                  selected={actieveActie?.id === actie.id}
                  onClick={() => {
                    setGekozenActie(actie.id);
                    setActieFout(null);
                  }}
                />
              ))}
              <ActieFoutmelding melding={actieFout} />
            </div>
          </ActionPanelSection>
        </ActionPanel>
      </AppShellPortal>

      <ContentPanel>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TaskExecutionHeader
            title="Stekkers"
            icon={<Plug size={24} strokeWidth={1.8} />}
            activeStep="BEOORDELING"
            summaryStats={{ teBeoordelen: 0, akkoord: 0, retour: 0, uitgesloten: 0 }}
            metaItems={[]}
            showStatusOverview={false}
            showTaskContext={false}
          />

          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col bg-white">
            {laadFout ? (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{laadFout}</div>
            ) : null}

            <section className="flex min-h-0 flex-1 flex-col border-t border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <label className="relative block">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={zoek}
                    onChange={(event) => setZoek(event.target.value)}
                    placeholder="Zoek op naam, omschrijving of adres..."
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                  />
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {!laden && zichtbaar.length === 0 ? (
                  <ContentPanelEmptyState
                    icon={<Plug size={24} />}
                    title={stekkers.length === 0 ? "Nog geen stekkers" : "Geen stekkers binnen deze zoekopdracht"}
                    description={
                      stekkers.length === 0
                        ? "Voeg een stekker toe via het actiepanel."
                        : "Pas je zoekopdracht aan om stekkers te tonen."
                    }
                  />
                ) : (
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-white">
                      <tr className="border-b border-slate-200">
                        <Kop breedte="w-[34%]">Stekker</Kop>
                        <Kop breedte="w-[14%]">Status</Kop>
                        <Kop breedte="w-[22%]">Authenticatie</Kop>
                        <Kop breedte="w-[12%]">Versie</Kop>
                        <Kop breedte="w-[18%]">In gebruik</Kop>
                      </tr>
                    </thead>
                    <tbody>
                      {zichtbaar.map((stekker) => (
                        <tr
                          key={stekker.id}
                          onClick={() => kies(stekker.id)}
                          className={`cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 ${
                            geselecteerdId === stekker.id ? "bg-blue-50/50" : "bg-white"
                          }`}
                        >
                          <td className="px-4 py-3 align-middle">
                            <div className="truncate font-medium text-slate-900">{stekker.naam}</div>
                            <div className="truncate text-xs text-slate-500">{stekker.configuratie?.baseUrl ?? "-"}</div>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <StatusBadge actief={stekker.actief} />
                          </td>
                          <td className="px-4 py-3 align-middle text-slate-700">
                            {AUTHENTICATIE[stekker.configuratie?.authType ?? ""] ?? "-"}
                          </td>
                          <td className="px-4 py-3 align-middle text-slate-700">
                            {stekker.configuratie ? `v${stekker.configuratie.versie}` : "-"}
                          </td>
                          <td className="px-4 py-3 align-middle text-slate-700">{gebruikTekst(stekker)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                {laden ? "Stekkers laden..." : `${zichtbaar.length.toLocaleString("nl-NL")} stekkers geladen`}
              </div>
            </section>
          </div>
        </div>
      </ContentPanel>

      <ConfirmDialog
        open={bevestigen}
        title={bevestigTitel(actieveActie?.id, geselecteerd?.naam)}
        description={bevestigTekst(actieveActie?.id)}
        confirmLabel={bezig ? "Bezig..." : actieveActie?.title ?? "Bevestigen"}
        onCancel={() => setBevestigen(false)}
        onConfirm={() => {
          if (!bezig) {
            void bevestig();
          }
        }}
      />
    </>
  );
}

function Kop({ breedte, children }: { breedte: string; children: ReactNode }) {
  return (
    <th className={`${breedte} bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500`}>
      {children}
    </th>
  );
}

function StatusBadge({ actief }: { actief: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        actief ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {actief ? "Actief" : "Inactief"}
    </span>
  );
}

function gebruikTekst(stekker: ApiStekkerBeheer) {
  const { taakdefinities, selecties } = stekker.gebruik;
  if (taakdefinities === 0 && selecties === 0) {
    return "Niet gebruikt";
  }
  return `${taakdefinities} ${taakdefinities === 1 ? "taak" : "taken"}, ${selecties} ${selecties === 1 ? "selectie" : "selecties"}`;
}

function stekkerDetails(stekker: ApiStekkerBeheer) {
  const configuratie = stekker.configuratie;
  const timeouts = configuratie?.timeouts ?? {};
  const getal = (waarde: unknown, eenheid: string) => (typeof waarde === "number" ? `${waarde.toLocaleString("nl-NL")} ${eenheid}` : "Standaard");

  return [
    {
      label: "Status",
      value: stekker.actief ? "Actief" : "Inactief",
      badgeClassName: stekker.actief
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-100 text-slate-600",
    },
    { label: "Omschrijving", value: stekker.omschrijving ?? "-", stacked: true },
    { label: "Basis-URL", value: configuratie?.baseUrl ?? "-", stacked: true },
    { label: "Authenticatie", value: AUTHENTICATIE[configuratie?.authType ?? ""] ?? "-" },
    ...(configuratie?.authType === "oauth2_cc"
      ? [
          { label: "Token-URL", value: configuratie.tokenUrl ?? "-", stacked: true },
          { label: "Client-id", value: configuratie.clientId ?? "-" },
          {
            label: "Secret",
            value: configuratie.secretIngesteld
              ? "Ingesteld (versleuteld)"
              : configuratie.secretRef
                ? `Uit omgevingsvariabele ${configuratie.secretRef}`
                : "Niet ingesteld",
          },
          { label: "Scopes", value: configuratie.scopes.join(", ") || "-", stacked: true },
        ]
      : []),
    { label: "Verwachte API-versie", value: configuratie ? `${configuratie.verwachteApiMajor}.x` : "-" },
    { label: "Time-out per aanroep", value: getal(timeouts.requestMs, "ms") },
    {
      label: "Batchgrootte",
      value: typeof configuratie?.parameters.batchGrootte === "number" ? String(configuratie.parameters.batchGrootte) : "Standaard (100)",
    },
    { label: "In gebruik", value: gebruikTekst(stekker) },
    {
      label: "Configuratieversie",
      value: configuratie ? `v${configuratie.versie}, ${formatDatum(configuratie.aangemaaktOp)}` : "-",
    },
    { label: "Eerdere versies", value: String(Math.max(0, stekker.versies.length - 1)) },
  ];
}

function bevestigTitel(actie: ActieId | undefined, naam: string | undefined) {
  switch (actie) {
    case "deactiveren":
      return `${naam ?? "Stekker"} deactiveren?`;
    case "activeren":
      return `${naam ?? "Stekker"} activeren?`;
    case "verwijderen":
      return `${naam ?? "Stekker"} verwijderen?`;
    default:
      return "Bevestigen";
  }
}

function bevestigTekst(actie: ActieId | undefined) {
  switch (actie) {
    case "deactiveren":
      return "De stekker is daarna niet meer te kiezen voor nieuwe taakdefinities en selecties. Lopende uitvoeringen en de historie blijven bewaard. Je kunt hem later weer activeren.";
    case "activeren":
      return "De stekker is daarna weer beschikbaar voor taakdefinities en selecties.";
    case "verwijderen":
      return "De stekker en zijn configuratieversies worden definitief verwijderd. Dit kan niet worden teruggedraaid.";
    default:
      return "";
  }
}
