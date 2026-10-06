#!/bin/bash
# Draait bij elke start van de acceptatieomgeving, na Keycloak (idempotent):
# - wachtwoorden van de testgebruikers zetten (GEBRUIKERS_WACHTWOORD uit .env);
# - het client-secret van cockpit-stekker zetten (STEKKER_GEHEIM uit .env);
# - de terugkeer-URL's van cockpit-web op het adres van de web-app zetten (WEB_URL);
# - de scopes van de Stekker-API aanmaken en als standaardscope aan cockpit-stekker koppelen.
# Geheimen staan dus nooit in de realm-import (die in git staat).
# Alleen bash: het Keycloak-image heeft geen awk of sed.
set -euo pipefail
KC=/opt/keycloak/bin/kcadm.sh
REALM=vernietigingscockpit

: "${GEBRUIKERS_WACHTWOORD:?ontbreekt}"
: "${STEKKER_GEHEIM:?ontbreekt}"
: "${WEB_URL:?ontbreekt}"

$KC config credentials --server http://keycloak:8080 --realm master --user "$KC_ADMIN" --password "$KC_ADMIN_PASSWORD"

for GEBRUIKER in rm1 po1 arch1 auditor1 beheerder1; do
  $KC set-password -r "$REALM" --username "$GEBRUIKER" --new-password "$GEBRUIKERS_WACHTWOORD"
done
echo "Wachtwoorden van de testgebruikers gezet."

# Adres van de web-app (lokaal of het domein op de server) als toegestane terugkeer-URL.
WEB_CLIENT_ID=$($KC get clients -r "$REALM" -q clientId=cockpit-web --fields id --format csv --noquotes)
$KC update "clients/$WEB_CLIENT_ID" -r "$REALM"   -s "redirectUris=[\"$WEB_URL/*\"]" -s "webOrigins=[\"$WEB_URL\"]"   -s "attributes.\"post.logout.redirect.uris\"=$WEB_URL/*"
echo "cockpit-web toegestaan op $WEB_URL."

CLIENT_ID=$($KC get clients -r "$REALM" -q clientId=cockpit-stekker --fields id --format csv --noquotes)
$KC update "clients/$CLIENT_ID" -r "$REALM" -s "secret=$STEKKER_GEHEIM"
echo "Client-secret van cockpit-stekker gezet."

for SCOPE in selectie.read selectie.write vernietiging.read vernietiging.write; do
  ID=""
  while IFS=, read -r SID SNAAM; do
    if [ "$SNAAM" = "$SCOPE" ]; then ID="$SID"; fi
  done < <($KC get client-scopes -r "$REALM" --fields id,name --format csv --noquotes)
  if [ -z "$ID" ]; then
    ID=$($KC create client-scopes -r "$REALM" -s name="$SCOPE" -s protocol=openid-connect \
      -s 'attributes."include.in.token.scope"=true' -s 'attributes."display.on.consent.screen"=false' -i)
    echo "Scope $SCOPE aangemaakt."
  fi
  $KC update "clients/$CLIENT_ID/default-client-scopes/$ID" -r "$REALM" || true
done
echo "Stekkerscopes gekoppeld aan cockpit-stekker."
