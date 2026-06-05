import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { useState } from "react";

import Breadcrumb from "../components/Breadcrumb";
import PageHeader from "../components/PageHeader";
import Tabs from "../components/Tabs";

import TaskDefinitionInstances from "../features/task-definition/components/TaskDefinitionInstances";
import TaskDefinitionConfiguration from "../features/task-definition/components/TaskDefinitionConfiguration";

const mockInstanties = [
  {
    id: "1",
    naam: "Zorgdomein 2026",
    subtitle:
      "Volgende instantie • 1 februari 2026",

    recordmanager:
      "Jan de Vries",

    status:
      "GEPLAND",

    stap: "—",

    voortgang: 0,
  },

  {
    id: "2",
    naam:
      "Zorgdomein 2025",

    subtitle:
      "Gestart 3 februari 2025",

    recordmanager:
      "Jan de Vries",

    status:
      "LOPEND",

    stap:
      "Beoordeling",

    voortgang: 40,

    highlighted: true,
  },

  {
    id: "3",
    naam:
      "Zorgdomein 2024",

    subtitle:
      "8 feb – 14 mrt 2024",

    recordmanager:
      "Jan de Vries",

    status:
      "VOLTOOID",

    stap:
      "Vernietiging",

    voortgang: 100,
  },

  {
    id: "4",
    naam:
      "Zorgdomein 2023",

    subtitle:
      "6 feb – 22 mrt 2023",

    recordmanager:
      "Jan de Vries",

    status:
      "VOLTOOID",

    stap:
      "Vernietiging",

    voortgang: 100,
  },
];

const configuratie = {
  taaknaam:
    "Zorgdomein jaarlijks",

  categorie:
    "Zorgdomein",

  frequentie:
    "Jaarlijks",

  proceseigenaar:
    "Jan de Vries",

  archivaris:
    "R. de Vries",
};

const stekkers = [
  {
    id: "1",
    naam: "Suite4sociaaldomein",
    type: "Taakapplicatie",
    omschrijving:
      "Bestaanszekerheid",
    status:
      "SUCCES",
  },

  {
    id: "2",
    naam:
      "Djuma",

    type:
      "zaaksysteem",

    omschrijving:
      "Zaakdossiers",

    status:
      "SUCCES",
  },
];

export default function TaskDefinitionDetailPage() {
  const navigate =
  useNavigate();
  const { id: taakId } =
    useParams();
  
  const [activeTab, setActiveTab] =
    useState("instanties");

  return (
    <div className="flex flex-col gap-3">

      {/* BREADCRUMB */}
      <Breadcrumb
        items={[
          { label: "Taakdefinities" },
          { label: "Zorgdomein jaarlijks" },
        ]}
      />

      {/* HEADER */}
      <PageHeader
        titel="Zorgdomein"
        badge={{
          label: "Jaarlijks",
          color: "blue",
        }}
        subtitel="Taakdefinities, die de basis zijn voor (geplande) taakuitvoeringen"
        meta={[
          {
            label:
              "Eigenaar",
            value:
              "J. de Vries",
          },

          {
            label:
              "Archivaris",
            value:
              "M. Bakker",
          },
        ]}
        actions={[]}
      />

      {/* TABS */}
      <div className="mt-5">
        <Tabs
          activeTab={
            activeTab
          }
          onChange={
            setActiveTab
          }
          tabs={[
            {
              id:
                "instanties",

              label:
                "Uitvoeringen",
            },

            {
              id:
                "configuratie",

              label:
                "Instellingen",
            },
          ]}
        />
      </div>

      {/* TAB CONTENT */}
      <div className="pt-5 pb-6">

        {activeTab ===
          "instanties" && (
          <TaskDefinitionInstances
            instanties={
              mockInstanties
            }
            onOpen={(instanceId) => {
              const instantie =
                mockInstanties.find(
                  (item) =>
                    item.id ===
                    instanceId
                );

              const stap =
                instantie?.stap
                  ?.toLowerCase();

              if (
                stap ===
                "beoordeling"
              ) {
                navigate(
                  `/taak/${taakId}/taakuitvoering/${instanceId}/selectie`
                );
                return;
              }

              navigate(
                `/taak/${taakId}/taakuitvoering/${instanceId}`
              );
            }}
          />
        )}

        {activeTab ===
          "configuratie" && (
          <TaskDefinitionConfiguration
            configuratie={
              configuratie
            }
            stekkers={
              stekkers
            }
            onEditGeneral={() =>
              console.log(
                "edit general"
              )
            }
            onEditRoles={() =>
              console.log(
                "edit roles"
              )
            }
            onAddConnector={() =>
              console.log(
                "add connector"
              )
            }
          />
        )}

      </div>
    </div>
  );
}
