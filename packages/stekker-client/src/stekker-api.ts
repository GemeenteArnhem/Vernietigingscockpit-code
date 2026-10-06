// GEGENEREERD door packages/stekker-client/scripts/genereer.mjs uit de Stekker-OpenAPI-spec v1.0.0.
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
    "/selecties/{selectieId}/objecten": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Haal vernietigingskandidaten uit een selectie op */
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
        /** Bied een batch informatieobjecten ter vernietiging aan */
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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description Optionele parameters voor het starten van een selectie. */
        SelectieStart: {
            /**
             * Format: date
             * @description Datum waarop selectieregels moeten worden toegepast.
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
         *       "stekkerversie": "1.4.2",
         *       "configuratieversie": "2026.09",
         *       "apiVersie": "1.0.0",
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
         * @example {
         *       "vernietigingskandidaatId": "kandidaat-000123",
         *       "omschrijving": "Dossier handhaving 2020",
         *       "classificatieschema": "BAC",
         *       "classificatiesleutel": "3.6.2",
         *       "classificatieomschrijving": "Handhaving",
         *       "selectielijst": "Selectielijst 2020",
         *       "grondslag": "3.6.2",
         *       "resultaat": "Afgehandeld",
         *       "bewaartermijn": "P5Y",
         *       "waardering": "VERNIETIGEN",
         *       "begindatum": "2020-01-01",
         *       "einddatum": "2020-12-31",
         *       "vernietigingsdatum": "2026-01-01",
         *       "aantalObjecten": 4,
         *       "aantalBetrokkenen": 1,
         *       "bronIdNaam": "dossiernummer",
         *       "bronId": "DSR-2020-123",
         *       "statusVernietigingskandidaat": "SELECTED"
         *     }
         */
        Vernietigingskandidaat: {
            /** @description Stabiele identificatie van de vernietigingskandidaat over selectie, beoordeling, vernietiging en resultaatverwerking. */
            vernietigingskandidaatId: string;
            omschrijving: string;
            classificatieschema?: string;
            classificatiesleutel?: string;
            classificatieomschrijving?: string;
            selectielijst?: string;
            grondslag?: string;
            grondslagAfwijkend?: string;
            resultaat?: string;
            bewaartermijn?: string;
            waardering?: components["schemas"]["Waardering"];
            /** Format: date */
            begindatum?: string;
            /** Format: date */
            einddatum?: string;
            /** Format: date */
            vernietigingsdatum?: string;
            aantalObjecten?: number;
            aantalBetrokkenen?: number;
            /** @description Gebruikersherkenbare naam of aanduiding van het object, zoals zaaknummer, dossiernummer of documentnaam. */
            bronIdNaam?: string;
            /** @description Technische sleutel waarmee de Stekker het object in de bron kan terugvinden en vernietigen. */
            bronId: string;
            relatieType?: string;
            relatieId?: string;
            statusVernietigingskandidaat?: string;
            uitvoeringsresultaat?: components["schemas"]["UitvoeringsresultaatWaarde"];
            foutcode?: string;
            foutmelding?: string;
            bronstatus?: string;
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
         *       "scope": "Alleen door de Cockpit vrijgegeven kandidaten",
         *       "cockpitTaakId": "taak-2026-042",
         *       "vernietigingsdossierId": "dossier-2026-042-v1",
         *       "besluitReferentie": "besluit-archivaris-2026-042"
         *     }
         */
        VernietigingStart: {
            /** @description Selectie waarop de vernietigingsuitvoering is gebaseerd. */
            selectieId: string;
            /** @description Scope van de vernietiging zoals door de Cockpit is vrijgegeven. */
            scope?: string;
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
         * @example {
         *       "vernietigingId": "vernietiging-2026-001",
         *       "selectieId": "sel-2026-001",
         *       "cockpitTaakId": "taak-2026-042",
         *       "vernietigingsdossierId": "dossier-2026-042-v1",
         *       "besluitReferentie": "besluit-archivaris-2026-042",
         *       "status": "RUNNING",
         *       "totaalKandidaten": 120,
         *       "totaalObjecten": 850,
         *       "totaalBatches": 3,
         *       "ontvangenBatches": 3,
         *       "aantalBatches": 3
         *     }
         */
        Vernietigingsuitvoering: {
            vernietigingId: string;
            selectieId: string;
            cockpitTaakId?: string;
            vernietigingsdossierId?: string;
            besluitReferentie?: string;
            status: components["schemas"]["VernietigingStatus"];
            /** Format: date-time */
            starttijd?: string;
            /** Format: date-time */
            eindtijd?: string;
            totaalKandidaten?: number;
            totaalObjecten?: number;
            totaalBatches?: number;
            ontvangenBatches?: number;
            succesvolVernietigd?: number;
            mislukt?: number;
            overgeslagen?: number;
            gewijzigd?: number;
            nietGevonden?: number;
            stekkerNaam?: string;
            stekkerOmschrijving?: string;
            stekkerversie?: string;
            configuratieversie?: string;
            aantalBatches?: number;
            aantalWaarschuwingen?: number;
            aantalFouten?: number;
        };
        /**
         * @example {
         *       "batchNummer": 1,
         *       "objecten": [
         *         {
         *           "vernietigingskandidaatId": "kandidaat-000123",
         *           "bronId": "DSR-2020-123"
         *         }
         *       ]
         *     }
         */
        VernietigingBatch: {
            batchNummer: number;
            objecten: components["schemas"]["TeVernietigenObject"][];
        };
        TeVernietigenObject: {
            /** @description Stabiele identificatie van de vrijgegeven vernietigingskandidaat. */
            vernietigingskandidaatId: string;
            /** @description Technische sleutel waarmee de Stekker het object in de bron kan terugvinden en vernietigen. */
            bronId: string;
            relatieType?: string;
            relatieId?: string;
        };
        /**
         * @example {
         *       "batchNummer": 1,
         *       "resultaten": [
         *         {
         *           "vernietigingskandidaatId": "kandidaat-000123",
         *           "bronId": "DSR-2020-123",
         *           "resultaat": "SUCCESS"
         *         }
         *       ]
         *     }
         */
        BatchResultaat: {
            batchNummer: number;
            resultaten: components["schemas"]["Uitvoeringsresultaat"][];
        };
        Uitvoeringsresultaat: {
            /** @description Stabiele identificatie van de vernietigingskandidaat waarop het resultaat betrekking heeft. */
            vernietigingskandidaatId: string;
            /** @description Technische sleutel waarmee de Stekker het object in de bron heeft teruggevonden of geprobeerd heeft terug te vinden. */
            bronId: string;
            batchNummer?: number;
            resultaat: components["schemas"]["UitvoeringsresultaatWaarde"];
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
        /** @enum {string} */
        Waardering: "BEWAREN" | "VERNIETIGEN";
    };
    responses: {
        /** @description Ongeldige of onvolledige request. */
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
        /** @description De request conflicteert met de actuele resource-status of eerdere idempotente aanlevering. */
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
        /** @description Nummer van de technische batch binnen een vernietigingsuitvoering. */
        BatchNummer: number;
        Offset: number;
        Limit: number;
        /** @description Optioneel alternatief voor offset-based paginering. */
        Cursor: string;
        /** @description Optioneel client-id voor veilige retries van muterende requests. */
        IdempotencyKey: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    startSelectie: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["SelectieStart"];
            };
        };
        responses: {
            /** @description Selectie gestart */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Selectie"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
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
                /** @description Optioneel alternatief voor offset-based paginering. */
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
            500: components["responses"]["InternalServerError"];
        };
    };
    startVernietiging: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optioneel client-id voor veilige retries van muterende requests. */
                "Idempotency-Key"?: components["parameters"]["IdempotencyKey"];
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
            /** @description Vernietigingsuitvoering aangemaakt of ingepland */
            202: {
                headers: {
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
            header?: {
                /** @description Optioneel client-id voor veilige retries van muterende requests. */
                "Idempotency-Key"?: components["parameters"]["IdempotencyKey"];
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
            header?: {
                /** @description Optioneel client-id voor veilige retries van muterende requests. */
                "Idempotency-Key"?: components["parameters"]["IdempotencyKey"];
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
}
