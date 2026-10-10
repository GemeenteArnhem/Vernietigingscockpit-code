// GEGENEREERD door packages/stekker-client/scripts/genereer.mjs uit de Stekker-OpenAPI-spec v2.0.0.
// Niet handmatig aanpassen: wijzig de spec en genereer opnieuw (npm run generate).

export interface paths {
    "/selecties": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start een nieuwe selectie */
        post: operations["startSelectie"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/selecties/{selectieId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Haal de status en metadata van een selectie op */
        get: operations["getSelectie"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/selecties/{selectieId}/vernietigingskandidaten": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Haal vernietigingskandidaten uit een selectie op
         * @description Gepagineerd. Gebruik `offset` of `cursor`, niet allebei (anders 400).
         *     Zolang de selectie niet `READY` is, volgt 409 (`SELECTIE_NOT_READY`).
         */
        get: operations["getVernietigingskandidaten"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vernietigingen": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start een nieuwe vernietigingsuitvoering */
        post: operations["startVernietiging"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vernietigingen/{vernietigingId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Haal de status van een vernietigingsuitvoering op */
        get: operations["getVernietiging"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vernietigingen/{vernietigingId}/batches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Haal alle batchresultaten van een vernietigingsuitvoering op */
        get: operations["getBatchResultaten"];
        put?: never;
        /** Bied een batch vernietigingskandidaten ter vernietiging aan */
        post: operations["verwerkVernietigingBatch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vernietigingen/{vernietigingId}/vrijgeven": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Geef een vernietigingsuitvoering vrij voor technische uitvoering */
        post: operations["geefVernietigingVrij"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vernietigingen/{vernietigingId}/batches/{batchNummer}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Haal het resultaat van een specifieke batch op */
        get: operations["getBatchResultaat"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/vernietigingen/{vernietigingId}/specificaties/{vernietigingskandidaatId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Haal de MDTO-specificatie van een vernietigde kandidaat op
         * @description Specificatie van de vernietiging in de zin van art. 8 Archiefbesluit 1995 (ADR-0005, B-M2).
         *     Eén MDTO-XML-document (MDTO-XML 1.0.1) met het vernietigde informatieobject
         *     (de kandidaat) als `informatieobject`, met:
         *     - `identificatie`, `naam`, `aggregatieniveau`, `waardering`, `bewaartermijn`,
         *       `informatiecategorie`, `archiefvormer` en `beperkingGebruik` zoals bij selectie;
         *     - een `event` met `eventType` *Vernietigen* (MDTO EventTypeLijst), de `eventTijd` van de
         *       vernietiging en een `eventResultaat` met de vernietigingsmethode;
         *     - per direct onderliggend informatieobject een `bevatOnderdeel` met naam en identificatie
         *       (bij Archief, Serie en Dossier).
         *
         *     Alleen beschikbaar voor kandidaten met resultaat `SUCCESS`; anders volgt 409
         *     (`SPECIFICATIE_NIET_BESCHIKBAAR`). De cockpit neemt het document als bestand met
         *     checksum op in het vernietigingsdossier.
         */
        get: operations["getSpecificatie"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description MDTO identificatieGegevens. */
        identificatieGegevens: {
            /** @description Kenmerk waarmee het object geïdentificeerd kan worden. */
            identificatieKenmerk: string;
            /** @description Herkomst van het kenmerk; de context waarbinnen het kenmerk uniek is. */
            identificatieBron: string;
        };
        /** @description MDTO verwijzingGegevens. */
        verwijzingGegevens: {
            verwijzingNaam: string;
            verwijzingIdentificatie?: components["schemas"]["identificatieGegevens"];
        };
        /** @description MDTO begripGegevens. De waarde komt uit de begrippenlijst in `begripBegrippenlijst`. */
        begripGegevens: {
            begripLabel: string;
            begripCode?: string;
            begripBegrippenlijst: components["schemas"]["verwijzingGegevens"];
        };
        /** @description MDTO dekkingInTijdGegevens. Type uit de lijst Cockpit-dekkingInTijdtypen. */
        dekkingInTijdGegevens: {
            dekkingInTijdType: components["schemas"]["begripGegevens"];
            dekkingInTijdBegindatum: components["schemas"]["MdtoDatum"];
            dekkingInTijdEinddatum?: components["schemas"]["MdtoDatum"];
        };
        /** @description MDTO gerelateerdInformatieobjectGegevens. Type uit de MDTO-lijst Relatietypen (informatieobject). */
        gerelateerdInformatieobjectGegevens: {
            gerelateerdInformatieobjectVerwijzing: components["schemas"]["verwijzingGegevens"];
            gerelateerdInformatieobjectTypeRelatie: components["schemas"]["begripGegevens"];
        };
        /** @description MDTO-datum: jaar (`2020`), jaar-maand (`2020-05`) of datum (`2020-05-17`). */
        MdtoDatum: string;
        /**
         * @description MDTO aggregatieniveau, uitsluitend uit de MDTO-lijst Aggregatieniveaus (ADR-0005, B-M2).
         *     `begripBegrippenlijst.verwijzingNaam` = `Begrippenlijst Aggregatieniveaus MDTO`.
         */
        Aggregatieniveau: {
            /** @enum {string} */
            begripLabel: "Archief" | "Serie" | "Dossier" | "Archiefstuk";
            begripCode?: string;
            begripBegrippenlijst: components["schemas"]["verwijzingGegevens"];
        };
        /**
         * @description MDTO waardering uit de gesloten MDTO-lijst Waarderingen.
         *     `begripBegrippenlijst.verwijzingNaam` = `Begrippenlijst Waarderingen MDTO`.
         *     Alleen `V` is vernietigbaar; een kandidaat met `B` of `N` sluit de cockpit
         *     automatisch uit (ADR-0005, B-M1).
         */
        Waardering: {
            /** @enum {string} */
            begripLabel: "Blijvend te bewaren" | "Tijdelijk te bewaren" | "Nader te bepalen";
            /** @enum {string} */
            begripCode: "B" | "V" | "N";
            begripBegrippenlijst: components["schemas"]["verwijzingGegevens"];
        };
        /**
         * @description MDTO termijnGegevens voor de bewaartermijn. Voor een vernietigingskandidaat is
         *     `termijnEinddatum` verplicht (datum waarop vernietiging mag plaatsvinden). Trigger en
         *     startdatum zijn verplicht zodra bekend; zo is einddatum = startdatum + looptijd controleerbaar.
         */
        Bewaartermijn: {
            termijnTriggerStartLooptijd?: components["schemas"]["begripGegevens"];
            /** Format: date */
            termijnStartdatumLooptijd?: string;
            /** @description ISO 8601-duur (`xs:duration`), bijvoorbeeld `P5Y`. */
            termijnLooptijd?: string;
            /** Format: date */
            termijnEinddatum: string;
        };
        /**
         * @description Cockpituitbreiding (geen MDTO-attribuut). Toelichting als de toegepaste informatiecategorie
         *     of bewaartermijn afwijkt van de standaardselectielijst (bijv. hotspot, specifieke wetgeving).
         */
        InformatiecategorieAfwijking: {
            toelichting: string;
            norm?: components["schemas"]["verwijzingGegevens"];
        };
        /**
         * @description MDTO eventGegevens voor de vernietiging. `eventType.begripLabel` = `Vernietigen`
         *     (MDTO EventTypeLijst). `eventTijd` is het tijdstip van vernietiging (Archiefbesluit art. 8).
         *     `eventVerantwoordelijkeActor` vult de cockpit (de zorgdrager), niet de stekker.
         */
        VernietigingsEvent: {
            eventType: components["schemas"]["begripGegevens"];
            /** Format: date-time */
            eventTijd: string;
            eventResultaat?: string;
        };
        /** @description Optionele parameters voor het starten van een selectie. */
        SelectieStart: {
            /**
             * Format: date
             * @description Datum waarop selectieregels worden toegepast; alleen kandidaten met `bewaartermijn.termijnEinddatum` ≤ peildatum.
             */
            peildatum?: string;
        };
        /**
         * @example {
         *       "selectieId": "sel-2026-001",
         *       "peildatum": "2026-09-23",
         *       "selectietijdstip": "2026-09-23T09:30:00Z",
         *       "status": "READY",
         *       "totaalKandidaten": 126,
         *       "totaalObjecten": 892,
         *       "totaalBetrokkenen": 74,
         *       "stekkerNaam": "SociaalDomeinStekker",
         *       "stekkerversie": "2.0.0",
         *       "configuratieversie": "2026.09",
         *       "apiVersie": "2.0.0",
         *       "aantalWaarschuwingen": 0,
         *       "aantalFouten": 0
         *     }
         */
        Selectie: {
            selectieId: string;
            /** Format: date */
            peildatum?: string;
            /** Format: date-time */
            selectietijdstip?: string;
            status: components["schemas"]["SelectieStatus"];
            totaalKandidaten?: number;
            /** @description Som van `aantalObjecten` van de kandidaten in de selectie. */
            totaalObjecten?: number;
            totaalBetrokkenen?: number;
            stekkerNaam?: string;
            stekkerOmschrijving?: string;
            stekkerversie?: string;
            configuratieversie?: string;
            apiVersie?: string;
            aantalWaarschuwingen?: number;
            aantalFouten?: number;
        };
        /**
         * @description Precies één MDTO-informatieobject (aggregatieniveau Archief, Serie, Dossier of
         *     Archiefstuk) met de MDTO-gegevens voor beoordeling, besluit en verantwoording.
         *     `identificatie` bevat minimaal de technische sleutel in de bron; daarnaast bij voorkeur
         *     het voor mensen herkenbare kenmerk (bijv. zaaknummer), elk met eigen `identificatieBron`.
         * @example {
         *       "vernietigingskandidaatId": "kandidaat-000123",
         *       "identificatie": [
         *         {
         *           "identificatieKenmerk": "8f7410a8-3b8a-42a8-8c10-7424f589e501",
         *           "identificatieBron": "Zaaksysteem sociaal domein (technische sleutel)"
         *         },
         *         {
         *           "identificatieKenmerk": "ZAAK-2020-00421",
         *           "identificatieBron": "Zaaknummering gemeente Voorbeeld"
         *         }
         *       ],
         *       "naam": "Handhaving bijstand ZAAK-2020-00421",
         *       "aggregatieniveau": {
         *         "begripLabel": "Dossier",
         *         "begripBegrippenlijst": {
         *           "verwijzingNaam": "Begrippenlijst Aggregatieniveaus MDTO"
         *         }
         *       },
         *       "classificatie": [
         *         {
         *           "begripLabel": "Handhaving bijstand",
         *           "begripCode": "ZTC-SD-BZ-007",
         *           "begripBegrippenlijst": {
         *             "verwijzingNaam": "ZTC sociaal domein"
         *           }
         *         }
         *       ],
         *       "dekkingInTijd": [
         *         {
         *           "dekkingInTijdType": {
         *             "begripLabel": "Looptijd",
         *             "begripCode": "looptijd",
         *             "begripBegrippenlijst": {
         *               "verwijzingNaam": "Cockpit-dekkingInTijdtypen"
         *             }
         *           },
         *           "dekkingInTijdBegindatum": "2020-01-06",
         *           "dekkingInTijdEinddatum": "2020-12-14"
         *         }
         *       ],
         *       "waardering": {
         *         "begripLabel": "Tijdelijk te bewaren",
         *         "begripCode": "V",
         *         "begripBegrippenlijst": {
         *           "verwijzingNaam": "Begrippenlijst Waarderingen MDTO"
         *         }
         *       },
         *       "bewaartermijn": {
         *         "termijnTriggerStartLooptijd": {
         *           "begripLabel": "Afgehandeld",
         *           "begripCode": "afgehandeld",
         *           "begripBegrippenlijst": {
         *             "verwijzingNaam": "Cockpit-termijntriggers"
         *           }
         *         },
         *         "termijnStartdatumLooptijd": "2020-12-14",
         *         "termijnLooptijd": "P5Y",
         *         "termijnEinddatum": "2025-12-14"
         *       },
         *       "informatiecategorie": {
         *         "begripLabel": "Handhaving",
         *         "begripCode": "11.1.2",
         *         "begripBegrippenlijst": {
         *           "verwijzingNaam": "Selectielijst gemeenten en intergemeentelijke organen 2020",
         *           "verwijzingIdentificatie": {
         *             "identificatieKenmerk": "selectielijst-gemeenten-2020",
         *             "identificatieBron": "Nationaal Archief"
         *           }
         *         }
         *       },
         *       "aantalObjecten": 4,
         *       "aantalBetrokkenen": 1
         *     }
         */
        Vernietigingskandidaat: {
            /**
             * @description Identificatie van de kandidaat (eigen begrip), uniek en stabiel binnen één selectie en in de
             *     vernietigingen en resultaten die op die selectie gebaseerd zijn. Hergebruik voor hetzelfde object
             *     in een volgende selectie mag, maar de cockpit geeft daar geen betekenis aan; hetzelfde object
             *     herken je aan `identificatie` (ADR-0007, DR-01 en DR-02).
             */
            vernietigingskandidaatId: string;
            identificatie: components["schemas"]["identificatieGegevens"][];
            /** @description MDTO naam; betekenisvolle aanduiding, bijv. de titel van het dossier. */
            naam: string;
            /** @description MDTO omschrijving van de inhoud. */
            omschrijving?: string[];
            aggregatieniveau: components["schemas"]["Aggregatieniveau"];
            /** @description MDTO classificatie; `begripBegrippenlijst` = het classificatieschema (bijv. ZTC, BAC). */
            classificatie?: components["schemas"]["begripGegevens"][];
            dekkingInTijd?: components["schemas"]["dekkingInTijdGegevens"][];
            waardering: components["schemas"]["Waardering"];
            bewaartermijn: components["schemas"]["Bewaartermijn"];
            /**
             * @description MDTO informatiecategorie: de categorie uit de vastgestelde selectielijst (of hotspotlijst).
             *     `begripCode` = codering in de selectielijst, `begripLabel` = titel,
             *     `begripBegrippenlijst` = de selectielijst, met `verwijzingIdentificatie` voor
             *     identificatie en versie (bij ZGW: de URL van de selectielijstklasse).
             */
            informatiecategorie: components["schemas"]["begripGegevens"];
            informatiecategorieAfwijking?: components["schemas"]["InformatiecategorieAfwijking"];
            isOnderdeelVan?: components["schemas"]["verwijzingGegevens"][];
            gerelateerdInformatieobject?: components["schemas"]["gerelateerdInformatieobjectGegevens"][];
            /** @description Afwijkende archiefvormer; ontbreekt hij, dan geldt die van de taakuitvoering (profiel van de proceseigenaar, ADR-0005, B-M3). */
            archiefvormer?: components["schemas"]["verwijzingGegevens"][];
            activiteit?: components["schemas"]["verwijzingGegevens"];
            /**
             * @description Cockpituitbreiding. Aantal direct onderliggende informatieobjecten in de momentopname,
             *     gelijk aan het aantal `bevatOnderdeel` in de specificatie. Dieper liggende niveaus tellen
             *     niet mee; een archiefstuk heeft 0 (ADR-0007, DR-04).
             */
            aantalObjecten?: number;
            /** @description Cockpituitbreiding. Aantal unieke betrokkenen. */
            aantalBetrokkenen?: number;
            /** @description Cockpituitbreiding. Toelichting van de stekker op selectie of afwijkingen. */
            toelichting?: string;
        };
        VernietigingskandidatenPagina: {
            selectieId: string;
            offset?: number;
            limit?: number;
            cursor?: string;
            nextCursor?: string;
            totaal?: number;
            items: components["schemas"]["Vernietigingskandidaat"][];
        };
        /**
         * @example {
         *       "selectieId": "sel-2026-001",
         *       "cockpitTaakId": "taak-2026-042",
         *       "vernietigingsdossierId": "dossier-2026-042",
         *       "besluitReferentie": "besluit-archivaris-2026-042"
         *     }
         */
        VernietigingStart: {
            /** @description Selectie waarop de vernietigingsuitvoering is gebaseerd. */
            selectieId: string;
            /** @description Verwijzing naar de Cockpit-taak voor herleidbaarheid. */
            cockpitTaakId: string;
            /** @description Verwijzing naar het vernietigingsdossier in de Cockpit. */
            vernietigingsdossierId?: string;
            /** @description Verwijzing naar het genomen besluit of de vrijgave. */
            besluitReferentie: string;
        };
        /**
         * @example {
         *       "aantalBatches": 3,
         *       "aantalKandidaten": 120
         *     }
         */
        VernietigingVrijgave: {
            /** @description Aantal batches dat de Cockpit heeft aangeleverd voor deze vernietiging. */
            aantalBatches: number;
            /** @description Aantal vrijgegeven vernietigingskandidaten dat in de batches is aangeleverd. */
            aantalKandidaten: number;
        };
        /**
         * @description `vernietigingsmethode` en `vernietigingsmethodeToelichting` zijn verplicht vanaf status
         *     `RUNNING` (ADR-0005, B-M4): de wijze van vernietiging (lijst Cockpit-vernietigingsmethoden)
         *     en de behandeling van back-ups, replica's, indexen en logbestanden met de termijn waarbinnen
         *     restanten zijn uitgedoofd.
         * @example {
         *       "vernietigingId": "vernietiging-2026-001",
         *       "selectieId": "sel-2026-001",
         *       "cockpitTaakId": "taak-2026-042",
         *       "vernietigingsdossierId": "dossier-2026-042",
         *       "besluitReferentie": "besluit-archivaris-2026-042",
         *       "status": "RUNNING",
         *       "totaalKandidaten": 120,
         *       "totaalObjecten": 850,
         *       "totaalBatches": 3,
         *       "ontvangenBatches": 3,
         *       "verwerkteBatches": 1,
         *       "vernietigingsmethode": {
         *         "begripLabel": "Verwijderd via bronfunctie",
         *         "begripBegrippenlijst": {
         *           "verwijzingNaam": "Cockpit-vernietigingsmethoden"
         *         }
         *       },
         *       "vernietigingsmethodeToelichting": "Definitieve verwijderfunctie van het zaaksysteem; back-ups verlopen na 35 dagen."
         *     }
         */
        Vernietigingsuitvoering: {
            vernietigingId: string;
            selectieId: string;
            cockpitTaakId: string;
            vernietigingsdossierId?: string;
            besluitReferentie: string;
            status: components["schemas"]["VernietigingStatus"];
            /** Format: date-time */
            starttijd?: string;
            /** Format: date-time */
            eindtijd?: string;
            totaalKandidaten?: number;
            /** @description Som van `aantalObjecten` van de aangeboden kandidaten. */
            totaalObjecten?: number;
            /** @description Aantal batches dat bij vrijgave is aangekondigd. */
            totaalBatches?: number;
            ontvangenBatches?: number;
            verwerkteBatches?: number;
            succesvolVernietigd?: number;
            mislukt?: number;
            overgeslagen?: number;
            gewijzigd?: number;
            nietGevonden?: number;
            stekkerNaam?: string;
            stekkerOmschrijving?: string;
            stekkerversie?: string;
            configuratieversie?: string;
            vernietigingsmethode?: components["schemas"]["begripGegevens"];
            vernietigingsmethodeToelichting?: string;
            aantalWaarschuwingen?: number;
            aantalFouten?: number;
        };
        /**
         * @example {
         *       "batchNummer": 1,
         *       "vernietigingskandidaten": [
         *         {
         *           "vernietigingskandidaatId": "kandidaat-000123",
         *           "identificatie": [
         *             {
         *               "identificatieKenmerk": "8f7410a8-3b8a-42a8-8c10-7424f589e501",
         *               "identificatieBron": "Zaaksysteem sociaal domein (technische sleutel)"
         *             },
         *             {
         *               "identificatieKenmerk": "ZAAK-2020-00421",
         *               "identificatieBron": "Zaaknummering gemeente Voorbeeld"
         *             }
         *           ]
         *         }
         *       ]
         *     }
         */
        VernietigingBatch: {
            batchNummer: number;
            vernietigingskandidaten: components["schemas"]["TeVernietigenKandidaat"][];
        };
        /**
         * @description Een vrijgegeven kandidaat. `identificatie` is letterlijk gelijk aan die uit de selectie;
         *     bij een verschil weigert de stekker de batch (400).
         */
        TeVernietigenKandidaat: {
            vernietigingskandidaatId: string;
            identificatie: components["schemas"]["identificatieGegevens"][];
        };
        BatchResultaat: {
            batchNummer: number;
            resultaten: components["schemas"]["Uitvoeringsresultaat"][];
        };
        /**
         * @description Precies één eindresultaat per aangeboden kandidaat. Bij `SUCCESS` is `event` verplicht
         *     (MDTO-event *Vernietigen* met tijdstip) en is de specificatie op te halen via
         *     `GET /vernietigingen/{vernietigingId}/specificaties/{vernietigingskandidaatId}`.
         */
        Uitvoeringsresultaat: {
            vernietigingskandidaatId: string;
            identificatie: components["schemas"]["identificatieGegevens"][];
            batchNummer?: number;
            resultaat: components["schemas"]["UitvoeringsresultaatWaarde"];
            event?: components["schemas"]["VernietigingsEvent"];
            /** @description Optioneel (ADR-0005, B-M7). Verwijzing naar het event *Vernietigen* dat de stekker ook in de bron heeft vastgelegd. */
            bronEventReferentie?: string;
            foutcode?: string;
            foutmelding?: string;
            bronstatus?: string;
            logReference?: string;
            correlatieId?: string;
            toelichting?: string;
        };
        /**
         * @example {
         *       "code": "VALIDATION_ERROR",
         *       "message": "Request is ongeldig of onvolledig.",
         *       "correlatieId": "corr-20260923-001"
         *     }
         */
        Fout: {
            /** @description Stabiele foutcode die door de Cockpit kan worden verwerkt. */
            code: string;
            /** @description Leesbare foutmelding. */
            message: string;
            /** @description Optionele technische of validatie-informatie. */
            details?: string;
            /** @description Correlatiekenmerk voor logging en foutanalyse. */
            correlatieId?: string;
            /** @description Verwijzing naar technische logging bij de Stekker. */
            logReference?: string;
        };
        /** @enum {string} */
        SelectieStatus: "IDLE" | "RUNNING" | "READY" | "FAILED";
        /** @enum {string} */
        VernietigingStatus: "IDLE" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
        /** @enum {string} */
        UitvoeringsresultaatWaarde: "SUCCESS" | "FAILED" | "SKIPPED" | "NOT_FOUND" | "CHANGED";
    };
    responses: {
        /**
         * @description Ongeldige of onvolledige request. Ook bij een ontbrekende
         *     `Idempotency-Key` op een muterend verzoek (`IDEMPOTENCY_KEY_MISSING`).
         */
        BadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Fout"];
            };
        };
        /** @description Authenticatie ontbreekt of is ongeldig. */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Fout"];
            };
        };
        /** @description De client is niet geautoriseerd voor deze actie. */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Fout"];
            };
        };
        /** @description De gevraagde resource bestaat niet of is niet beschikbaar voor deze client. */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Fout"];
            };
        };
        /**
         * @description De request conflicteert met de actuele resource-status of met een eerdere aanlevering,
         *     bijvoorbeeld dezelfde `Idempotency-Key` met een andere inhoud (`IDEMPOTENCY_KEY_REUSED`).
         */
        Conflict: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Fout"];
            };
        };
        /** @description Onverwachte technische fout. */
        InternalServerError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Fout"];
            };
        };
    };
    parameters: {
        /** @description Stabiele identificatie van de selectie binnen de Stekker. */
        SelectieId: string;
        /** @description Stabiele identificatie van de vernietigingsuitvoering binnen de Stekker. */
        VernietigingId: string;
        /** @description Identificatie van de vernietigingskandidaat, uniek binnen de selectie waarop de vernietiging is gebaseerd (ADR-0007). */
        VernietigingskandidaatId: string;
        /** @description Nummer van de technische batch binnen een vernietigingsuitvoering. */
        BatchNummer: number;
        Offset: number;
        Limit: number;
        /** @description Opake cursor uit `nextCursor`; alternatief voor `offset`. */
        Cursor: string;
        /**
         * @description Verplicht op alle muterende verzoeken (ADR-0004). Zelfde sleutel en zelfde inhoud:
         *     de stekker voert niets opnieuw uit en geeft hetzelfde antwoord. Zelfde sleutel met
         *     andere inhoud: 409 `IDEMPOTENCY_KEY_REUSED`. Ontbreekt de sleutel: 400
         *     `IDEMPOTENCY_KEY_MISSING`. De stekker bewaart sleutels minimaal 7 dagen.
         */
        IdempotencyKey: string;
    };
    requestBodies: never;
    headers: {
        /** @description Volledig versienummer van de API (API Design Rules API-57). */
        "API-Version": string;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    startSelectie: {
        parameters: {
            query?: never;
            header: {
                /**
                 * @description Verplicht op alle muterende verzoeken (ADR-0004). Zelfde sleutel en zelfde inhoud:
                 *     de stekker voert niets opnieuw uit en geeft hetzelfde antwoord. Zelfde sleutel met
                 *     andere inhoud: 409 `IDEMPOTENCY_KEY_REUSED`. Ontbreekt de sleutel: 400
                 *     `IDEMPOTENCY_KEY_MISSING`. De stekker bewaart sleutels minimaal 7 dagen.
                 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["SelectieStart"];
            };
        };
        responses: {
            /** @description Selectie gestart (of eerder gestart met dezelfde Idempotency-Key) */
            202: {
                headers: {
                    "API-Version": components["headers"]["API-Version"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Selectie"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            500: components["responses"]["InternalServerError"];
        };
    };
    getSelectie: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Stabiele identificatie van de selectie binnen de Stekker. */
                selectieId: components["parameters"]["SelectieId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Selectie */
            200: {
                headers: {
                    "API-Version": components["headers"]["API-Version"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Selectie"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            500: components["responses"]["InternalServerError"];
        };
    };
    getVernietigingskandidaten: {
        parameters: {
            query?: {
                offset?: components["parameters"]["Offset"];
                limit?: components["parameters"]["Limit"];
                /** @description Opake cursor uit `nextCursor`; alternatief voor `offset`. */
                cursor?: components["parameters"]["Cursor"];
            };
            header?: never;
            path: {
                /** @description Stabiele identificatie van de selectie binnen de Stekker. */
                selectieId: components["parameters"]["SelectieId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Pagina met vernietigingskandidaten */
            200: {
                headers: {
                    "API-Version": components["headers"]["API-Version"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VernietigingskandidatenPagina"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            500: components["responses"]["InternalServerError"];
        };
    };
    startVernietiging: {
        parameters: {
            query?: never;
            header: {
                /**
                 * @description Verplicht op alle muterende verzoeken (ADR-0004). Zelfde sleutel en zelfde inhoud:
                 *     de stekker voert niets opnieuw uit en geeft hetzelfde antwoord. Zelfde sleutel met
                 *     andere inhoud: 409 `IDEMPOTENCY_KEY_REUSED`. Ontbreekt de sleutel: 400
                 *     `IDEMPOTENCY_KEY_MISSING`. De stekker bewaart sleutels minimaal 7 dagen.
                 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VernietigingStart"];
            };
        };
        responses: {
            /** @description Vernietigingsuitvoering aangemaakt (status IDLE) */
            202: {
                headers: {
                    "API-Version": components["headers"]["API-Version"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Vernietigingsuitvoering"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            500: components["responses"]["InternalServerError"];
        };
    };
    getVernietiging: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Stabiele identificatie van de vernietigingsuitvoering binnen de Stekker. */
                vernietigingId: components["parameters"]["VernietigingId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Status van vernietigingsuitvoering */
            200: {
                headers: {
                    "API-Version": components["headers"]["API-Version"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Vernietigingsuitvoering"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            500: components["responses"]["InternalServerError"];
        };
    };
    getBatchResultaten: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Stabiele identificatie van de vernietigingsuitvoering binnen de Stekker. */
                vernietigingId: components["parameters"]["VernietigingId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lijst met batchresultaten */
            200: {
                headers: {
                    "API-Version": components["headers"]["API-Version"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BatchResultaat"][];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            500: components["responses"]["InternalServerError"];
        };
    };
    verwerkVernietigingBatch: {
        parameters: {
            query?: never;
            header: {
                /**
                 * @description Verplicht op alle muterende verzoeken (ADR-0004). Zelfde sleutel en zelfde inhoud:
                 *     de stekker voert niets opnieuw uit en geeft hetzelfde antwoord. Zelfde sleutel met
                 *     andere inhoud: 409 `IDEMPOTENCY_KEY_REUSED`. Ontbreekt de sleutel: 400
                 *     `IDEMPOTENCY_KEY_MISSING`. De stekker bewaart sleutels minimaal 7 dagen.
                 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @description Stabiele identificatie van de vernietigingsuitvoering binnen de Stekker. */
                vernietigingId: components["parameters"]["VernietigingId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VernietigingBatch"];
            };
        };
        responses: {
            /** @description Batch ontvangen */
            202: {
                headers: {
                    "API-Version": components["headers"]["API-Version"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BatchResultaat"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            500: components["responses"]["InternalServerError"];
        };
    };
    geefVernietigingVrij: {
        parameters: {
            query?: never;
            header: {
                /**
                 * @description Verplicht op alle muterende verzoeken (ADR-0004). Zelfde sleutel en zelfde inhoud:
                 *     de stekker voert niets opnieuw uit en geeft hetzelfde antwoord. Zelfde sleutel met
                 *     andere inhoud: 409 `IDEMPOTENCY_KEY_REUSED`. Ontbreekt de sleutel: 400
                 *     `IDEMPOTENCY_KEY_MISSING`. De stekker bewaart sleutels minimaal 7 dagen.
                 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @description Stabiele identificatie van de vernietigingsuitvoering binnen de Stekker. */
                vernietigingId: components["parameters"]["VernietigingId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VernietigingVrijgave"];
            };
        };
        responses: {
            /** @description Vernietigingsuitvoering vrijgegeven voor technische uitvoering */
            202: {
                headers: {
                    "API-Version": components["headers"]["API-Version"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Vernietigingsuitvoering"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            500: components["responses"]["InternalServerError"];
        };
    };
    getBatchResultaat: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Stabiele identificatie van de vernietigingsuitvoering binnen de Stekker. */
                vernietigingId: components["parameters"]["VernietigingId"];
                /** @description Nummer van de technische batch binnen een vernietigingsuitvoering. */
                batchNummer: components["parameters"]["BatchNummer"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Resultaat van batch */
            200: {
                headers: {
                    "API-Version": components["headers"]["API-Version"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BatchResultaat"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            500: components["responses"]["InternalServerError"];
        };
    };
    getSpecificatie: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Stabiele identificatie van de vernietigingsuitvoering binnen de Stekker. */
                vernietigingId: components["parameters"]["VernietigingId"];
                /** @description Identificatie van de vernietigingskandidaat, uniek binnen de selectie waarop de vernietiging is gebaseerd (ADR-0007). */
                vernietigingskandidaatId: components["parameters"]["VernietigingskandidaatId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description MDTO-XML-specificatie */
            200: {
                headers: {
                    "API-Version": components["headers"]["API-Version"];
                    [name: string]: unknown;
                };
                content: {
                    "application/xml": string;
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            500: components["responses"]["InternalServerError"];
        };
    };
}
