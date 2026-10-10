// De enige geldige eventtypen in het auditlog en het configuratielog (ADR-0005 §5, wijzigt
// ADR-0003 §1). MDTO is leidend: waar de MDTO EventTypeLijst een begrip heeft, wordt dat
// gebruikt; anders een begrip uit een eigen begrippenlijst (designrules/begrippenlijsten).
// Het label wordt letterlijk opgeslagen en getoond; per event staat ook de begrippenlijst vast.
// TODO(B-F): ADR-0003 en ADR-0005 hebben status 'Voorgesteld'; na vaststelling weghalen.

export const BEGRIPPENLIJST_MDTO = "MDTO EventTypeLijst 1.0";
export const BEGRIPPENLIJST_COCKPIT = "Cockpit-eventtypen 1.0";
export const BEGRIPPENLIJST_CONFIGURATIE = "Cockpit-configuratie-eventtypen 1.0";

export const AUDIT_EVENTTYPEN = {
  // MDTO EventTypeLijst
  Creatie: BEGRIPPENLIJST_MDTO,
  Import: BEGRIPPENLIJST_MDTO,
  Accordering: BEGRIPPENLIJST_MDTO,
  Bevriezing: BEGRIPPENLIJST_MDTO,
  Vernietigen: BEGRIPPENLIJST_MDTO,
  Export: BEGRIPPENLIJST_MDTO,
  // Cockpit-eventtypen
  "Selectie aangevraagd": BEGRIPPENLIJST_COCKPIT,
  "Selectie opnieuw aangevraagd": BEGRIPPENLIJST_COCKPIT,
  "Kandidaat opgenomen": BEGRIPPENLIJST_COCKPIT,
  "Kandidaat uitgesloten": BEGRIPPENLIJST_COCKPIT,
  Voorgelegd: BEGRIPPENLIJST_COCKPIT,
  Retour: BEGRIPPENLIJST_COCKPIT,
  Vernietigingsopdracht: BEGRIPPENLIJST_COCKPIT,
  "Uitvoering gestart": BEGRIPPENLIJST_COCKPIT,
  "Batch aangeboden": BEGRIPPENLIJST_COCKPIT,
  "Batch verwerkt": BEGRIPPENLIJST_COCKPIT,
  "Niet vernietigd": BEGRIPPENLIJST_COCKPIT,
  "Uitvoering mislukt": BEGRIPPENLIJST_COCKPIT,
  "Uitvoering opnieuw aangevraagd": BEGRIPPENLIJST_COCKPIT,
  "Uitvoering afgerond": BEGRIPPENLIJST_COCKPIT,
  "Archivering aangevraagd": BEGRIPPENLIJST_COCKPIT,
  "Archivering mislukt": BEGRIPPENLIJST_COCKPIT,
  "Logisch verwijderd": BEGRIPPENLIJST_COCKPIT,
} as const;

export type AuditEventType = keyof typeof AUDIT_EVENTTYPEN;

export const CONFIGURATIE_EVENTTYPEN = [
  "Stamgegevens geïmporteerd",
  "Taakdefinitie aangemaakt",
  "Taakdefinitie verwijderd",
  "Gebruiker gekoppeld",
  "Stekker aangemaakt",
  "Stekker gewijzigd",
  "Stekker gedeactiveerd",
  "Stekker geactiveerd",
  "Stekker verwijderd",
  "Instelling gewijzigd",
  "Verificatie archief mislukt",
  "Werkkopie verwijderd",
] as const;

export type ConfiguratieEventType = (typeof CONFIGURATIE_EVENTTYPEN)[number];
