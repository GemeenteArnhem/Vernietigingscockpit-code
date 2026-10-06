import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarClock, Check, ClipboardList, Plug } from "lucide-react";
import { useNavigate } from "react-router-dom";

import ContentPanel, {
  ContentPanelBody,
  ContentPanelSection,
} from "../components/ContentPanel";
import FormulierActiePanel from "../components/FormulierActiePanel";
import PageHeaderBar from "../components/PageHeaderBar";
import { AppShellPortal } from "../layouts/AppShellPortalContext";
import {
  createTaskDefinition,
  getMedewerkers,
  getStekkers,
  type CreateTaskDefinitionInput,
  type StamgegevensMedewerker,
  type StekkerOption,
} from "../api/f3Data";
import { useSessionUser } from "../auth/useSessionUser";

type Frequency = CreateTaskDefinitionInput["frequentie"];

const frequencyOptions: Array<{ value: Frequency; label: string }> = [
  { value: "jaarlijks", label: "Jaarlijks" },
  { value: "kwartaal", label: "Per kwartaal" },
  { value: "maandelijks", label: "Maandelijks" },
  { value: "ad_hoc", label: "Ad-hoc" },
];

const monthOptions = [
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December",
];

export default function TaskDefinitionCreatePage() {
  const navigate = useNavigate();
  const { accessToken, user } = useSessionUser();
  const [naam, setNaam] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [categorie, setCategorie] = useState("");
  const [frequentie, setFrequentie] = useState<Frequency>("jaarlijks");
  const [startmaand, setStartmaand] = useState("1");
  const [recordmanagers, setRecordmanagers] = useState<StamgegevensMedewerker[]>([]);
  const [proceseigenaren, setProceseigenaren] = useState<StamgegevensMedewerker[]>([]);
  const [archivarissen, setArchivarissen] = useState<StamgegevensMedewerker[]>([]);
  const [stekkers, setStekkers] = useState<StekkerOption[]>([]);
  const [recordmanagerId, setRecordmanagerId] = useState(user.medewerkerId ?? "");
  const [proceseigenaarId, setProceseigenaarId] = useState("");
  const [archivarisId, setArchivarisId] = useState("");
  const [selectedStekkerIds, setSelectedStekkerIds] = useState<string[]>([]);
  // Token waarvoor de stamgegevens zijn geladen; laden = er is een token, maar nog niet voor dit token geladen.
  const [geladenVoorToken, setGeladenVoorToken] = useState<string | null>(null);
  const loading = Boolean(accessToken) && geladenVoorToken !== accessToken;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formulier = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let isCurrent = true;

    Promise.all([
      getMedewerkers(accessToken, "recordmanager"),
      getMedewerkers(accessToken, "proceseigenaar"),
      getMedewerkers(accessToken, "archivaris"),
      getStekkers(accessToken),
    ])
      .then(([rm, po, arch, activeStekkers]) => {
        if (!isCurrent) {
          return;
        }

        setRecordmanagers(rm);
        setProceseigenaren(po);
        setArchivarissen(arch);
        setStekkers(activeStekkers);
        setRecordmanagerId((current) => current || user.medewerkerId || rm[0]?.id || "");
        setProceseigenaarId((current) => current || po[0]?.id || "");
        setArchivarisId((current) => current || arch[0]?.id || "");
        setSelectedStekkerIds((current) =>
          current.length > 0 ? current : activeStekkers[0]?.id ? [activeStekkers[0].id] : []
        );
        setError(null);
      })
      .catch((caught: unknown) => {
        if (isCurrent) {
          setError(caught instanceof Error ? caught.message : "Laden van stamgegevens is mislukt.");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setGeladenVoorToken(accessToken);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [accessToken, user.medewerkerId]);

  const currentRecordmanager = useMemo(
    () =>
      recordmanagers.find((medewerker) => medewerker.id === recordmanagerId) ??
      recordmanagers.find((medewerker) => medewerker.id === user.medewerkerId),
    [recordmanagerId, recordmanagers, user.medewerkerId]
  );

  const canSave =
    Boolean(accessToken) &&
    naam.trim().length > 0 &&
    categorie.trim().length > 0 &&
    Boolean(recordmanagerId) &&
    Boolean(proceseigenaarId) &&
    Boolean(archivarisId) &&
    selectedStekkerIds.length > 0 &&
    !saving;

  const handleToggleStekker = (stekkerId: string) => {
    setSelectedStekkerIds((current) =>
      current.includes(stekkerId)
        ? current.filter((id) => id !== stekkerId)
        : [...current, stekkerId]
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken || !canSave) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await createTaskDefinition(accessToken, {
        naam: naam.trim(),
        omschrijving: omschrijving.trim() || undefined,
        categorie: categorie.trim(),
        frequentie,
        startmaand: frequentie === "ad_hoc" ? null : Number(startmaand),
        recordmanagerId,
        proceseigenaarId,
        archivarisId,
        stekkers: selectedStekkerIds.map((stekkerId) => ({
          stekkerId,
          selectieparameters: {},
        })),
      });

      navigate(`/taak/${created.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opslaan is mislukt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppShellPortal slot="action">
        <FormulierActiePanel
          opslaanOmschrijving={
            loading
              ? "Stamgegevens laden..."
              : "Bij een terugkerende taak staat na opslaan de eerste uitvoering gepland klaar."
          }
          kanOpslaan={canSave}
          bezig={saving}
          fout={error}
          onOpslaan={() => formulier.current?.requestSubmit()}
          onTerug={() => navigate(-1)}
        />
      </AppShellPortal>

      <ContentPanel>
        <PageHeaderBar title="Taken - nieuw" icon={<ClipboardList size={24} strokeWidth={1.8} />} />
        <ContentPanelBody>
          <form ref={formulier} onSubmit={handleSubmit} className="flex flex-col gap-4">
            <ContentPanelSection
              title="Basis"
              description="Deze gegevens worden getoond in het overzicht, de uitvoering en later in de verklaring."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <TextField
                  label="Naam"
                  value={naam}
                  onChange={setNaam}
                  placeholder="Bijvoorbeeld Sociaal domein 2027"
                  required
                />
                <TextField
                  label="Categorie"
                  value={categorie}
                  onChange={setCategorie}
                  placeholder="Bijvoorbeeld Sociaal domein"
                  required
                />
                <SelectField
                  label="Frequentie"
                  value={frequentie}
                  onChange={(value) => setFrequentie(value as Frequency)}
                  options={frequencyOptions}
                />
                <SelectField
                  label="Startmaand"
                  value={startmaand}
                  onChange={setStartmaand}
                  disabled={frequentie === "ad_hoc"}
                  options={monthOptions.map((label, index) => ({
                    value: String(index + 1),
                    label,
                  }))}
                />
                <div className="lg:col-span-2">
                  <TextAreaField
                    label="Omschrijving"
                    value={omschrijving}
                    onChange={setOmschrijving}
                    placeholder="Korte context voor deze taakdefinitie"
                  />
                </div>
              </div>
            </ContentPanelSection>

            <ContentPanelSection
              title="Verantwoordelijken"
              description="De API bewaakt de functiescheiding bij opslaan."
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <PersonField
                  label="Recordmanager"
                  value={recordmanagerId}
                  onChange={setRecordmanagerId}
                  medewerkers={recordmanagers}
                  disabled={Boolean(user.medewerkerId)}
                  fallbackLabel={currentRecordmanager?.naam ?? user.name}
                />
                <PersonField
                  label="Proceseigenaar"
                  value={proceseigenaarId}
                  onChange={setProceseigenaarId}
                  medewerkers={proceseigenaren}
                />
                <PersonField
                  label="Archivaris"
                  value={archivarisId}
                  onChange={setArchivarisId}
                  medewerkers={archivarissen}
                />
              </div>
            </ContentPanelSection>

            <ContentPanelSection
              title="Stekkers"
              description="Kies de bronnen waaruit deze taak later selectievoorstellen ophaalt."
            >
              <div className="grid gap-3 lg:grid-cols-2">
                {stekkers.map((stekker) => {
                  const selected = selectedStekkerIds.includes(stekker.id);

                  return (
                    <button
                      key={stekker.id}
                      type="button"
                      onClick={() => handleToggleStekker(stekker.id)}
                      className={`flex min-h-28 items-start gap-3 rounded-md border px-4 py-3 text-left transition ${
                        selected
                          ? "border-blue-500 bg-blue-50 text-blue-950"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sm ${
                          selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {selected ? <Check size={18} /> : <Plug size={18} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{stekker.naam}</span>
                        <span className="mt-1 block text-sm leading-5 text-slate-500">
                          {stekker.omschrijving ?? "Geen omschrijving"}
                        </span>
                        {stekker.laatsteConfiguratie ? (
                          <span className="mt-2 inline-flex items-center gap-1 rounded-sm bg-white px-2 py-1 text-xs font-medium text-slate-500">
                            <CalendarClock size={13} />
                            Configuratie v{stekker.laatsteConfiguratie.versie}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              {!loading && stekkers.length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Er zijn nog geen actieve stekkers beschikbaar.
                </div>
              ) : null}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
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
        rows={4}
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PersonField({
  label,
  value,
  onChange,
  medewerkers,
  disabled = false,
  fallbackLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  medewerkers: StamgegevensMedewerker[];
  disabled?: boolean;
  fallbackLabel?: string;
}) {
  const options =
    medewerkers.length > 0
      ? medewerkers.map((medewerker) => ({
          value: medewerker.id,
          label: `${medewerker.naam} (${medewerker.email})`,
        }))
      : value && fallbackLabel
        ? [{ value, label: fallbackLabel }]
        : [];

  return (
    <SelectField
      label={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={options}
    />
  );
}
