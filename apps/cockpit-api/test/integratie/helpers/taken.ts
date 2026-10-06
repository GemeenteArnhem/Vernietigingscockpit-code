import { CurrentMedewerkerService } from "../../../src/modules/auth/current-medewerker.service.js";
import { BeoordelingService } from "../../../src/modules/taken/beoordeling.service.js";
import { BesluitvormingService } from "../../../src/modules/taken/besluitvorming.service.js";
import { DossierService } from "../../../src/modules/taken/dossier.service.js";
import { SelectieService } from "../../../src/modules/taken/selectie.service.js";
import { TaakToegangService } from "../../../src/modules/taken/taak-toegang.service.js";
import { UitvoeringService } from "../../../src/modules/taken/uitvoering.service.js";
import { WorkflowService } from "../../../src/modules/workflow/workflow.service.js";
import type { TestDatabase } from "./database.js";

// De taak-services zoals Nest ze samenstelt, voor tests zonder de hele applicatie.
export function maakTaakServices(db: TestDatabase, workflow = new WorkflowService()) {
  const medewerker = new CurrentMedewerkerService(db.prisma);
  const toegang = new TaakToegangService(db.prisma, medewerker, workflow);
  const dossier = new DossierService(db.prisma, medewerker, db.config, toegang);

  return {
    toegang,
    selectie: new SelectieService(db.prisma, medewerker, toegang),
    beoordeling: new BeoordelingService(db.prisma, medewerker, workflow, toegang),
    besluitvorming: new BesluitvormingService(db.prisma, medewerker, workflow, toegang),
    dossier,
    uitvoering: new UitvoeringService(db.prisma, medewerker, workflow, toegang, dossier),
  };
}

export type TaakServices = ReturnType<typeof maakTaakServices>;
