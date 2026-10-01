# Design guardrail
- Hanteer overal de designstijl van dashboard en taken als standaard. 
- Alle nieuwe pagina's en componenten moeten consistent zijn in layout, hiërarchie, componentgebruik, spacing, typografie en kleurgebruik. 
- De stijl is rustig, modern, professioneel en functioneel, met goede scanbaarheid, subtiele accenten en minimale visuele ruis. 
- Geen dubbele informatie.
- WCAG 2.2 AA compliant.
- Gebruik voor iconen lucide-react bibliotheek.
- Wijk alleen af als dat expliciet gevraagd wordt.

## Contentpanels
- Contentpanels beginnen altijd met een passende ContentPanelHeader
- Bij taakuitvoering (selectie, beoordeling, accordering, uitvoering, resultaat) pagina's volgt taakinformatie (compact)

## Taakuitvoering
Belangrijke taakinformatie bij taakuitvoering:
- Naam recordmanager
- Naam proceseigenaar
- Naam archivaris
- Startdatum van de taak

# Data guardrails
- Plaats gedeelde types centraal in vaste typebestanden.
- Plaats mockdata centraal in aparte modules.
- Vermijd verspreide inline types en hardcoded mockdata in componenten of pagina's.
- Structureer code zo dat migratie naar een REST API later eenvoudig blijft.