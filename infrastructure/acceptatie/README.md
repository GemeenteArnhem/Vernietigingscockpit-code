# Acceptatieomgeving (lokaal, Docker Desktop)

Volledige cockpit met Keycloak, PostgreSQL, Gotenberg en de teststekker, om zelf de
vernietigingscyclus door te lopen. Alleen testgegevens; niet voor productie.

## Eerste keer: wachtwoorden aanmaken

Wachtwoorden en secrets staan niet in git. Maak ze eenmalig aan, vanuit de root van deze
repo:

```bash
node infrastructure/acceptatie/init-geheimen.mjs
```

Het script vraagt een wachtwoord voor de testgebruikers (minimaal 12 tekens; leeg laten
geeft een willekeurig wachtwoord). Alle andere waarden (database, Keycloak-beheer,
stekker-secret) maakt het willekeurig. Alles komt in `infrastructure/acceptatie/.env`, dat
door git wordt genegeerd. Een bestaand `.env` wordt nooit overschreven. Zonder `.env` start
de omgeving niet.

## Starten en stoppen

Vanuit de root van deze repo (de teststekker-repo moet naast deze repo staan, of zet
`STEKKER_REPO`):

```bash
docker compose -f infrastructure/acceptatie/docker-compose.yml up -d --build --wait
```

```bash
docker compose -f infrastructure/acceptatie/docker-compose.yml stop
```

Opnieuw beginnen met een lege database, lege Keycloak, leeg archief en lege stekkerstatus
(verwijdert de volumes van **alleen** deze omgeving):

```bash
docker compose -f infrastructure/acceptatie/docker-compose.yml down -v
```

Andere wachtwoorden:
- **Testgebruikers:** pas `ACC_GEBRUIKERS_WACHTWOORD` in `.env` aan en start opnieuw (`up -d`). `keycloak-init` zet het wachtwoord bij elke start.
- **Database, Keycloak-beheer of stekker-secret:** eerst `down -v`, dan `.env` verwijderen, dan het script opnieuw draaien. De database en Keycloak onthouden het wachtwoord van hun eerste start.

## Op een server (cloud-VM met Docker en Traefik)

Op een server draait dezelfde omgeving achter de bestaande Traefik, op drie eigen domeinen
met HTTPS. Inloggen vereist HTTPS (of `localhost`); een kaal `http://<ip>` werkt niet.
`docker-compose.vm.yml` komt bovenop `docker-compose.yml`. Web, API en Keycloak publiceren
dan geen eigen poorten; Traefik routeert en verzorgt de certificaten.

**Vooraf**

- De code staat op GitHub: de server haalt alleen gecommit en gepusht werk op.
- Docker Compose 2.24 of nieuwer (`docker compose version`).
- Traefik draait, met een HTTPS-entrypoint en een certresolver.
- DNS: drie A-records naar de server, bijvoorbeeld `acc.voorbeeld.nl`,
  `api.acc.voorbeeld.nl` en `auth.acc.voorbeeld.nl`. Het script noemt ze ook.

**1. Traefik-waarden opzoeken**

```bash
docker ps --filter name=traefik --format '{{.Names}}'
```

```bash
docker inspect <traefik-container> --format '{{json .Args}}'
```

```bash
docker inspect <traefik-container> --format '{{range $n, $_ := .NetworkSettings.Networks}}{{$n}} {{end}}'
```

Uit de argumenten: de HTTPS-entrypoint (`--entrypoints.<naam>.address=:443`) en de
certresolver (`--certificatesresolvers.<naam>...`). Het netwerk is het Docker-netwerk van
Traefik (de laatste opdracht).

**2. Code ophalen** (beide repo's naast elkaar in dezelfde map)

```bash
git clone -b dev5 https://github.com/GemeenteArnhem/Vernietigingscockpit-code.git
```

```bash
git clone -b dev https://github.com/GemeenteArnhem/Vernietigingscockpit-stekker-test.git
```

```bash
cd Vernietigingscockpit-code
```

**3. Wachtwoorden en adressen aanmaken.** Node is op de server niet nodig; het script draait in
een container. Vul je eigen domein en de Traefik-waarden uit stap 1 in:

```bash
docker run --rm -it --user "$(id -u):$(id -g)" -v "$PWD/infrastructure/acceptatie:/w" -w /w node:22-alpine node init-geheimen.mjs --domein acc.voorbeeld.nl --traefik-netwerk <netwerk> --traefik-entrypoint <entrypoint> --traefik-certresolver <resolver>
```

Het script vraagt een wachtwoord voor de testgebruikers en zet alles in
`infrastructure/acceptatie/.env`, leesbaar voor alleen jouw gebruiker.

**4. Starten**

```bash
docker compose -f infrastructure/acceptatie/docker-compose.yml -f infrastructure/acceptatie/docker-compose.vm.yml up -d --build --wait
```

Open daarna `https://acc.voorbeeld.nl` en log in met een testaccount (zie hieronder). De
eerste keer kan het even duren voordat Traefik de certificaten heeft.

**Controleren**

```bash
docker compose -f infrastructure/acceptatie/docker-compose.yml -f infrastructure/acceptatie/docker-compose.vm.yml ps
```

```bash
docker compose -f infrastructure/acceptatie/docker-compose.yml -f infrastructure/acceptatie/docker-compose.vm.yml logs keycloak-init
```

`keycloak-init` moet onder meer melden: `cockpit-web toegestaan op https://acc.voorbeeld.nl`.

**Bijwerken**

```bash
git pull
```

```bash
docker compose -f infrastructure/acceptatie/docker-compose.yml -f infrastructure/acceptatie/docker-compose.vm.yml up -d --build --wait
```

Gebruik op de server bij elke opdracht beide `-f`-bestanden, ook bij `stop` en `down`.

**Aandachtspunten**

- **De containers praten met Keycloak via het publieke adres** (`https://auth…`), zodat de
  issuer in de tokens overal gelijk is. Dat vraagt dat de server zijn eigen domeinen kan
  bereiken (hairpin). Weigert de API alle aanmeldingen of meldt de worker dat het token
  ophalen mislukt, controleer dat dan vanaf de server met
  `curl -sI https://auth.acc.voorbeeld.nl/realms/vernietigingscockpit`.
- **Keycloak staat publiek, ook de beheerconsole.** De wachtwoorden zijn willekeurig en
  sterk. Wil je de console afschermen, zet dan in Traefik een IP-allowlist op het pad
  `/admin`.
- **De database** is alleen bereikbaar vanaf de server zelf (`127.0.0.1:55434`).
- **Eén Traefik voor meer projecten:** de routers heten `vc-acc-auth`, `vc-acc-api` en
  `vc-acc-web`. Kies andere namen als die al bestaan.

## Adressen (lokaal)

| Wat | Adres |
|---|---|
| Cockpit (web) | http://localhost:8480 |
| API | http://localhost:8481/api/v1 |
| Keycloak (inloggen en beheer) | http://host.docker.internal:8482 |
| Database (alleen vanaf deze pc) | `localhost:55434`, database `cockpit` |

## Testaccounts

Alle testgebruikers hebben het wachtwoord uit `ACC_GEBRUIKERS_WACHTWOORD` in `.env`
(realm `vernietigingscockpit`).

| Gebruiker | Rol | Medewerker in de cockpit |
|---|---|---|
| `rm1` | recordmanager | Rita Recordmanager |
| `po1` | proceseigenaar | Peter Proceseigenaar |
| `arch1` | archivaris | Anna Archivaris |
| `auditor1` | auditor | (alleen lezen) |
| `beheerder1` | functioneel beheerder | (beheeracties) |

Keycloak-beheer (realm `master`): gebruiker `admin`, wachtwoord `ACC_KEYCLOAK_ADMIN_WACHTWOORD`
uit `.env`.

De eerste keer dat `rm1`, `po1` of `arch1` inlogt, koppelt de cockpit het account aan de
medewerker met dezelfde gebruikersnaam (`USER_LINKED` in het configuratielog).

Wissel van gebruiker via **Uitloggen** in de cockpit. Of gebruik een privévenster per rol.

## Wat er klaarstaat

- Taakdefinitie **Sociaal domein 2026** met de teststekker, en één taakuitvoering in `init`.
- De teststekker (dataset *sociaal-domein-zaken*). Selectie en vernietiging duren elk een
  paar seconden, zodat je de tussenstanden ziet.

Een volledige ronde:

1. `rm1`: selectie ophalen, kandidaten beoordelen, voorleggen.
2. `po1`: accorderen.
3. `arch1`: accorderen (vrijgeven).
4. `rm1`: vernietigingsopdracht geven; na de uitvoering verschijnt de verklaring
   (PDF/A en CSV); daarna archiveren.

Het archief staat in het volume `vernietigingscockpit-acceptatie_archief`. Bekijken:

```bash
docker compose -f infrastructure/acceptatie/docker-compose.yml exec worker ls -R /archief
```

## Opbouw en aandachtspunten

- **Keycloak via `host.docker.internal`.** De browser en de containers gebruiken hetzelfde
  adres, zodat de issuer in de tokens overal gelijk is. Docker Desktop zet die naam in het
  hosts-bestand van Windows, met het LAN-adres van deze pc. Verandert dat adres (ander
  netwerk), herstart dan Docker Desktop. Poort 8482 is daardoor ook vanaf het lokale
  netwerk bereikbaar; zet de omgeving stil als je hem niet gebruikt.
- **Realm.** `keycloak/vernietigingscockpit-realm.json` bevat geen wachtwoorden of
  secrets. Hij wordt bij de eerste start ingelezen. Daarna bewaart Keycloak alles in het
  volume `keycloak`, zodat accounts (en hun koppeling aan medewerkers) een herstart
  overleven.
- **keycloak-init** (`keycloak/keycloak-init.sh`) draait bij elke start. Hij zet uit `.env`
  de wachtwoorden van de testgebruikers en het client-secret van `cockpit-stekker`, en
  koppelt de scopes `selectie.read`, `selectie.write`, `vernietiging.read` en
  `vernietiging.write` aan die client.
- **Seed.** Draait bij elke start; hij is idempotent.
- **Stekkerverbinding.** De worker haalt via OAuth2 (client credentials) een token voor de
  teststekker, met het secret uit `ACC_STEKKER_GEHEIM`.
