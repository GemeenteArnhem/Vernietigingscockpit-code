# F2 inloggen en workflowbasis – start

Datum: 2026-09-29

## Doel

F2 brengt de applicatie van mockup naar ingelogde applicatie met een workflowbasis. Deze eerste stap legt de web-authenticatielaag klaar.

## Geïmplementeerd

- OIDC dependencies toegevoegd aan `@vernietigingscockpit/cockpit-web`:
  - `react-oidc-context`
  - `oidc-client-ts`
- Auth-configuratie toegevoegd via `VITE_...` environment variables.
- `AuthProvider` toegevoegd rond de webapp.
- Route guard `RequireAuth` toegevoegd rond de bestaande applicatieroutes.
- Callback-route toegevoegd: `/auth/callback`.
- Sidebar-footer toont nu sessiegebruiker, rollen en uitloggen wanneer OIDC actief is.
- Dev-fallback blijft beschikbaar met `VITE_AUTH_ENABLED=false`, zodat de mockup lokaal bruikbaar blijft zonder Keycloak.
- `@vernietigingscockpit/cockpit-api` toegevoegd als NestJS workspace.
- JWT-validatie toegevoegd met `passport-jwt` en JWKS vanuit Keycloak.
- Globale `JwtAuthGuard` en `RolesGuard` toegevoegd.
- `GET /api/v1/me` toegevoegd als eerste beveiligde API-endpoint.
- Een kleine web-API-client toegevoegd die het OIDC access token als bearer token meestuurt.
- De web-sessie loopt nu via een eigen `SessionUserContext`.
- De sidebar gebruikt de identiteit uit `GET /api/v1/me` zodra de API antwoordt; tot die tijd valt hij terug op de OIDC-profielclaims.
- `GET /api/v1/me` geeft nu ook globale acties terug op basis van de Keycloak-rollen.

## Benodigde configuratie

Maak lokaal een `.env` naast `.env.example` in `apps/cockpit-web` met:

```text
VITE_AUTH_ENABLED=true
VITE_OIDC_AUTHORITY=<Keycloak realm URL>
VITE_OIDC_CLIENT_ID=cockpit-web
VITE_OIDC_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:5173/
VITE_OIDC_SCOPE=openid profile email
VITE_API_BASE_URL=<cockpit-api base URL>
```

Keycloak moet de redirect URI `http://localhost:5173/auth/callback` toestaan voor de client `cockpit-web`.

Voor de huidige dev-omgeving is de publieke realm gecontroleerd:

```text
VITE_OIDC_AUTHORITY=https://auth.cockpit.arnhem.dev/realms/vernietigingscockpit
VITE_OIDC_CLIENT_ID=cockpit-web
```

De lokale `.env.local` bevat alleen publieke webconfiguratie. Adminwachtwoorden, testuserwachtwoorden en client secrets worden niet in de repo opgeslagen.

Gecontroleerde endpoints:

- Discovery: `https://auth.cockpit.arnhem.dev/realms/vernietigingscockpit/.well-known/openid-configuration`
- JWKS: `https://auth.cockpit.arnhem.dev/realms/vernietigingscockpit/protocol/openid-connect/certs`

## Nog te doen in F2

- Echte Keycloak-configuratie invullen en login handmatig testen.
- Login handmatig testen tegen `GET /api/v1/me` met een echt access token.
- Controleren of tokens van `cockpit-web` de audience `cockpit-api` bevatten; zonder die audience weigert de API terecht met `401`.
- UI-acties later baseren op `taak.toegestaneActies` uit de API.

## Controle

Uitgevoerd:

- `npm run build` in `Vernietigingscockpit-code`
- Keycloak discovery opgehaald voor realm `vernietigingscockpit`
- JWKS opgehaald voor backend-tokenvalidatie
- API lokaal gestart met issuer `https://auth.cockpit.arnhem.dev/realms/vernietigingscockpit`
- `GET /api/v1/me` zonder bearer token geeft `401 Unauthorized`
- Webclient lint op de gewijzigde auth/API-bestanden
- Rollen uit `realm_access.roles` worden in de API vertaald naar globale acties.

Niet uitgevoerd als automatische eindtest:

- Direct password grant met `cockpit-web`. Keycloak weigert dit terecht voor een public PKCE-client met `unauthorized_client`.
- Interactieve login in de browser. Die blijft nodig om de echte authorization-code flow en de token-audience volledig te bevestigen.

De build is groen. npm meldt nog 2 auditbevindingen in dependencies; deze zijn niet automatisch gefixt om ongecontroleerde dependencywijzigingen te voorkomen.
