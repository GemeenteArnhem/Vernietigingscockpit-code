import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";

import ActieFoutmelding from "./ActieFoutmelding";
import ActionPanel, {
  ActionPanelButton,
  ActionPanelButtonGroup,
  ActionPanelChoice,
  ActionPanelSection,
} from "./ActionPanel";

type Props = {
  // Toelichting bij 'Opslaan', bijv. welke versie het opslaan maakt.
  opslaanOmschrijving: string;
  kanOpslaan: boolean;
  bezig: boolean;
  fout: string | null;
  onOpslaan: () => void;
  onTerug: () => void;
};

// Actiepanel voor formulierpagina's (nieuwe stekker, stekker bewerken, nieuwe taakdefinitie),
// in het vaste patroon: een actie kiezen en één knop 'Actie uitvoeren'.
export default function FormulierActiePanel({ opslaanOmschrijving, kanOpslaan, bezig, fout, onOpslaan, onTerug }: Props) {
  const [gekozen, setGekozen] = useState<"opslaan" | "terug">("opslaan");

  const voerUit = () => {
    if (gekozen === "terug") {
      onTerug();
    } else if (kanOpslaan && !bezig) {
      onOpslaan();
    }
  };

  return (
    <ActionPanel
      embedded
      title="Actie"
      titleClassName="text-sm"
      hideHeaderBorder
      hideFooterBorder
      bodyPaddingYClass="py-0"
      footer={
        <ActionPanelButtonGroup>
          <ActionPanelButton
            label={bezig ? "Opslaan..." : "Actie uitvoeren"}
            variant="primary"
            disabled={gekozen === "opslaan" && (!kanOpslaan || bezig)}
            onClick={voerUit}
          />
        </ActionPanelButtonGroup>
      }
    >
      <ActionPanelSection title="Kies een actie">
        <div className="space-y-3">
          <ActionPanelChoice
            title="Opslaan"
            description={opslaanOmschrijving}
            icon={<Save size={18} />}
            tone="primary"
            density="compact"
            selected={gekozen === "opslaan"}
            onClick={() => setGekozen("opslaan")}
          />
          <ActionPanelChoice
            title="Terug"
            description="Terug zonder op te slaan."
            icon={<ArrowLeft size={18} />}
            tone="neutral"
            density="compact"
            selected={gekozen === "terug"}
            onClick={() => setGekozen("terug")}
          />
          <ActieFoutmelding melding={fout} />
        </div>
      </ActionPanelSection>
    </ActionPanel>
  );
}
