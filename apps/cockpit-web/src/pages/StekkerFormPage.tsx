import { useEffect, useRef, useState, type FormEvent } from "react";
import { KeyRound, Plug } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import ContentPanel, { ContentPanelBody, ContentPanelSection } from "../components/ContentPanel";
import FormulierActiePanel from "../components/FormulierActiePanel";
import TaskExecutionHeader from "../features/task-execution/components/TaskExecutionHeader";
import { AppShellPortal } from "../layouts/AppShellPortalContext";
import { serverFoutmelding } from "../api/apiClient";
import {
  bewerkStekker,
  getStekkerBeheer,
  maakStekker,
  type ApiStekkerBeheer,
  type StekkerInvoer,
} from "../api/stekkerbeheer";
import { useSessionUser } from "../auth/useSessionUser";

// Nieuwe stekker of een bestaande bewerken (functioneel beheerder). Opslaan bij bewerken maakt
// een nieuwe configuratieversie. Het secret wordt nooit getoond; leeg laten bij bewerken houdt
// het bestaande.

type AuthType = StekkerInvoer["authType"];

export default function StekkerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const bewerken = Boolean(id);
  const { accessToken } = useSessionUser();
  const [bestaand, setBestaand] = useState<ApiStekkerBeheer | null>(null);
  const [laden, setLaden] = useState(bewerken);
  const [opslaan, setOpslaan] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const formulier = useRef<HTMLFormElement>(null);

  const [naam, setNaam] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState<AuthType>("oauth2_cc");
  const [tokenUrl, setTokenUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [scopes, setScopes] = useState("selectie.read, selectie.write, vernietiging.read, vernietiging.write");
  const [verwachteApiMajor, setVerwachteApiMajor] = useState("2");
  const [requestMs, setRequestMs] = useState("30000");
  const [batchGrootte, setBatchGrootte] = useState("100");

  useEffect(() => {
    if (!bewerken || !accessToken || !id) {
      return;
    }

    let actueel = true;
    getStekkerBeheer(accessToken, id)
      .then((stekker) => {
        if (!actueel) {
          return;
        }
        const configuratie = stekker.configuratie;
        setBestaand(stekker);
        setNaam(stekker.naam);
        setOmschrijving(stekker.omschrijving ?? "");
        setBaseUrl(configuratie?.baseUrl ?? "");
        setAuthType((configuratie?.authType as AuthType | undefined) ?? "oauth2_cc");
        setTokenUrl(configuratie?.tokenUrl ?? "");
        setClientId(configuratie?.clientId ?? "");
        setScopes(configuratie?.scopes.join(", ") ?? "");
        setVerwachteApiMajor(String(configuratie?.verwachteApiMajor ?? 2));
        setRequestMs(typeof configuratie?.timeouts.requestMs === "number" ? String(configuratie.timeouts.requestMs) : "");
        setBatchGrootte(
          typeof configuratie?.parameters.batchGrootte === "number" ? String(configuratie.parameters.batchGrootte) : ""
        );
      })
      .catch((oorzaak) => actueel && setFout(serverFoutmelding(oorzaak, "Stekker laden is mislukt.")))
      .finally(() => actueel && setLaden(false));

    return () => {
      actueel = false;
    };
  }, [accessToken, bewerken, id]);

  const oauth = authType === "oauth2_cc";
  const secretVerplicht = oauth && !bewerken;
  const kanOpslaan =
    !laden &&
    !opslaan &&
    naam.trim() !== "" &&
    baseUrl.trim() !== "" &&
    (!oauth || (tokenUrl.trim() !== "" && clientId.trim() !== "")) &&
    (!secretVerplicht || secret !== "");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken || !kanOpslaan) {
      return;
    }

    setOpslaan(true);
    setFout(null);

    // Overige parameters van de vorige versie blijven behouden.
    const parameters: Record<string, unknown> = { ...(bestaand?.configuratie?.parameters ?? {}) };
    if (batchGrootte.trim()) {
      parameters.batchGrootte = Number(batchGrootte);
    } else {
      delete parameters.batchGrootte;
    }

    const invoer: StekkerInvoer = {
      naam: naam.trim(),
      omschrijving: omschrijving.trim() || null,
      baseUrl: baseUrl.trim(),
      authType,
      tokenUrl: oauth ? tokenUrl.trim() : null,
      clientId: oauth ? clientId.trim() : null,
      secret: oauth && secret !== "" ? secret : null,
      secretRef: oauth ? bestaand?.configuratie?.secretRef ?? null : null,
      scopes: scopes
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
      verwachteApiMajor: Number(verwachteApiMajor) || 1,
      timeouts: {
        ...(bestaand?.configuratie?.timeouts ?? {}),
        ...(requestMs.trim() ? { requestMs: Number(requestMs) } : {}),
      },
      parameters,
    };

    try {
      if (bewerken && bestaand?.configuratie && id) {
        await bewerkStekker(accessToken, id, bestaand.configuratie.versie, invoer);
      } else {
        await maakStekker(accessToken, invoer);
      }
      navigate("/stekkers");
    } catch (oorzaak) {
      setFout(serverFoutmelding(oorzaak, "Opslaan is mislukt."));
    } finally {
      setOpslaan(false);
      setSecret("");
    }
  };

  const titel = bewerken ? `Stekkers - ${bestaand?.naam ?? "stekker"} bewerken` : "Stekkers - nieuw";
  const status = laden
    ? "Stekker laden..."
    : bewerken
      ? `Opslaan maakt configuratieversie ${(bestaand?.configuratie?.versie ?? 0) + 1}; lopende selecties houden hun versie.`
      : "Na opslaan is de stekker te kiezen bij taakdefinities.";

  return (
    <>
      <AppShellPortal slot="action">
        <FormulierActiePanel
          opslaanOmschrijving={status}
          kanOpslaan={kanOpslaan}
          bezig={opslaan}
          fout={fout}
          onOpslaan={() => formulier.current?.requestSubmit()}
          onTerug={() => navigate("/stekkers")}
        />
      </AppShellPortal>

      <ContentPanel>
        <TaskExecutionHeader
          title={titel}
          icon={<Plug size={24} strokeWidth={1.8} />}
          summaryStats={{ teBeoordelen: 0, akkoord: 0, retour: 0, uitgesloten: 0 }}
          metaItems={[]}
          showStatusOverview={false}
          showTaskContext={false}
        />
        <ContentPanelBody>
          <form ref={formulier} onSubmit={handleSubmit} className="flex flex-col gap-4">
            <ContentPanelSection title="Basis" description="Naam en omschrijving worden getoond bij taakdefinities en in de verklaring.">
              <div className="grid gap-4 lg:grid-cols-2">
                <TextField label="Naam" value={naam} onChange={setNaam} placeholder="Bijvoorbeeld Zaaksysteem sociaal domein" required />
                <TextField
                  label="Basis-URL"
                  value={baseUrl}
                  onChange={setBaseUrl}
                  placeholder="https://stekker.voorbeeld.nl"
                  required
                />
                <div className="lg:col-span-2">
                  <TextAreaField label="Omschrijving" value={omschrijving} onChange={setOmschrijving} placeholder="Welke bron ontsluit deze stekker?" />
                </div>
              </div>
            </ContentPanelSection>

            <ContentPanelSection title="Authenticatie" description="Hoe de cockpit zich bij de stekker aanmeldt.">
              <div className="grid gap-4 lg:grid-cols-2">
                <SelectField
                  label="Methode"
                  value={authType}
                  onChange={(waarde) => setAuthType(waarde as AuthType)}
                  options={[
                    { value: "oauth2_cc", label: "OAuth2 (client credentials)" },
                    { value: "none", label: "Geen (alleen buiten productie)" },
                  ]}
                />
                {oauth ? (
                  <>
                    <TextField label="Token-URL" value={tokenUrl} onChange={setTokenUrl} placeholder="https://auth.voorbeeld.nl/realms/…/token" required />
                    <TextField label="Client-id" value={clientId} onChange={setClientId} placeholder="cockpit-stekker" required />
                    <label className="block">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <KeyRound size={14} />
                        Client-secret
                      </span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={secret}
                        onChange={(event) => setSecret(event.target.value)}
                        required={secretVerplicht}
                        placeholder={
                          bestaand?.configuratie?.secretIngesteld
                            ? "Ingesteld; leeg laten om het te houden"
                            : bestaand?.configuratie?.secretRef
                              ? `Nu uit ${bestaand.configuratie.secretRef}; leeg laten om dat te houden`
                              : "Wordt versleuteld opgeslagen"
                        }
                        className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                      />
                    </label>
                    <div className="lg:col-span-2">
                      <TextField
                        label="Scopes (kommagescheiden)"
                        value={scopes}
                        onChange={setScopes}
                        placeholder="selectie.read, selectie.write, vernietiging.read, vernietiging.write"
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </ContentPanelSection>

            <ContentPanelSection title="Gedrag" description="Leeg laten geeft de standaardwaarde.">
              <div className="grid gap-4 lg:grid-cols-3">
                <TextField label="Verwachte API-versie (major)" value={verwachteApiMajor} onChange={setVerwachteApiMajor} type="number" />
                <TextField label="Time-out per aanroep (ms)" value={requestMs} onChange={setRequestMs} type="number" placeholder="30000" />
                <TextField label="Batchgrootte (max. 500)" value={batchGrootte} onChange={setBatchGrootte} type="number" placeholder="100" />
              </div>
            </ContentPanelSection>

          </form>
        </ContentPanelBody>
      </ContentPanel>
    </>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-2 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
      >
        {options.map((optie) => (
          <option key={optie.value} value={optie.value}>
            {optie.label}
          </option>
        ))}
      </select>
    </label>
  );
}
