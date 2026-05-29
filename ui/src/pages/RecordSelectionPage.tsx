import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Database,
  FileStack,
  FolderKanban,
  Info,
  Mail,
} from "lucide-react";

import Breadcrumb from "../components/Breadcrumb";
import PageHeader from "../components/PageHeader";
import WorkflowBar from "../features/task-execution/components/WorkflowBar";
import StatusBadge from "../components/StatusBadge";

type Connector = {
  id: string;
  naam: string;
  versie: string;
  stekkerStatus: "SUCCES" | "FOUT";
  selectieStatus:
    | "NIET_GESTART"
    | "BEZIG"
    | "VOLTOOID"
    | "GEDEELTELIJK_VOLTOOID";
  voortgang: number;
  icon: ReactNode;
};

const connectors: Connector[] = [
  {
    id: "sharepoint",
    naam: "Suite4sociaaldomein",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    selectieStatus: "NIET_GESTART",
    voortgang: 0,
    icon: <FolderKanban className="h-4 w-4" />,
  },
  {
    id: "files",
    naam: "Djuma",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    selectieStatus: "BEZIG",
    voortgang: 42,
    icon: <FileStack className="h-4 w-4" />,
  },
  {
    id: "topdesk",
    naam: "Join",
    versie: "1.0",
    stekkerStatus: "FOUT",
    selectieStatus: "GEDEELTELIJK_VOLTOOID",
    voortgang: 20,
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: "outlook",
    naam: "Onegov",
    versie: "1.0",
    stekkerStatus: "SUCCES",
    selectieStatus: "VOLTOOID",
    voortgang: 100,
    icon: <Mail className="h-4 w-4" />,
  },
];

function renderStekkerStatus(status: Connector["stekkerStatus"]) {
  if (status === "SUCCES") {
    return <StatusBadge status="SUCCES" />;
  }

  return <StatusBadge status="FOUT" />;
}

function getSelectieStatusClasses(status: Connector["selectieStatus"]) {
  switch (status) {
    case "NIET_GESTART":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "BEZIG":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "VOLTOOID":
      return "bg-green-50 text-green-700 border-green-200";
    case "GEDEELTELIJK_VOLTOOID":
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function getSelectieStatusLabel(status: Connector["selectieStatus"]) {
  switch (status) {
    case "NIET_GESTART":
      return "Niet gestart";
    case "BEZIG":
      return "Bezig";
    case "VOLTOOID":
      return "Voltooid";
    case "GEDEELTELIJK_VOLTOOID":
      return "Gedeeltelijk voltooid";
  }
}

function getVoortgangskleur(status: Connector["selectieStatus"]) {
  switch (status) {
    case "VOLTOOID":
      return "bg-green-500";
    case "GEDEELTELIJK_VOLTOOID":
      return "bg-amber-500";
    case "BEZIG":
      return "bg-blue-500";
    case "NIET_GESTART":
      return "bg-gray-300";
  }
}

export default function RecordSelectionPage() {
  const navigate = useNavigate();
  const { taakId, id } = useParams();

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb
        items={[
          { label: "Taken" },
          { label: "Vernietiging Inkoop 2022" },
          { label: "Selectie" },
        ]}
      />

      <PageHeader
        titel="Vernietiging Inkoop 2022"
        badge={{
          label: "Selectie",
          color: "gray",
        }}
        actions={[
          {
            label: "selectie ophalen",
            variant: "primary",
            icon: <ArrowRight className="h-3.5 w-3.5" />,
            onClick: () =>
              navigate(
                `/taak/${taakId}/taakuitvoering/${id}/beoordeling`
              ),
          },
        ]}
      />

      <WorkflowBar activeStep="SELECTIE" />

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
            <Info className="h-4 w-4" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Wat gebeurt er bij selectie ophalen?
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
              Er wordt een momentopname (snapshot) gemaakt van alle vernietigbare
              objecten in de geselecteerde stekkers. Deze snapshot vormt de basis
              voor beoordeling.
            </p>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <h2 className="text-base font-semibold text-gray-900">Stekkers</h2>
          <p className="mt-1 text-sm text-gray-500">Beschikbare bronnen voor selectie</p>
        </div>

        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">
              <th className="px-6 py-3">Stekker</th>
              <th className="px-6 py-3">Versie</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Selectie status</th>
              <th className="px-6 py-3 text-right">Actie</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {connectors.map((connector) => (
              <tr key={connector.id} className="text-gray-700">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      {connector.icon}
                    </div>
                    <span className="font-medium text-gray-900">{connector.naam}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500">{connector.versie}</td>
                <td className="px-6 py-4">{renderStekkerStatus(connector.stekkerStatus)}</td>
                <td className="px-6 py-4">
                  <div className="min-w-[220px]">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getSelectieStatusClasses(
                          connector.selectieStatus
                        )}`}
                      >
                        {getSelectieStatusLabel(connector.selectieStatus)}
                      </span>

                      <span className="text-xs font-medium text-gray-500">
                        {connector.voortgang}%
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 rounded-full bg-gray-100">
                      <div
                        className={`h-1.5 rounded-full transition-[width] ${getVoortgangskleur(
                          connector.selectieStatus
                        )}`}
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, connector.voortgang)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      aria-label={`Open ${connector.naam}`}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
