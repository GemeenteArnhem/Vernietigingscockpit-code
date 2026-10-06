#!/bin/sh
# Vult bij het starten van de web-container de Content-Security-Policy met de origins van
# Keycloak (WEB_OIDC_AUTHORITY) en de API (WEB_API_BASE_URL) (CC-13). Zo verschilt de CSP
# per omgeving zonder nieuwe build. Ontbreekt een waarde, dan start de container niet.
set -eu

: "${WEB_OIDC_AUTHORITY:?WEB_OIDC_AUTHORITY ontbreekt (nodig voor de CSP)}"
: "${WEB_API_BASE_URL:?WEB_API_BASE_URL ontbreekt (nodig voor de CSP)}"

# Alleen schema en host (en poort): https://auth.voorbeeld.nl/realms/x -> https://auth.voorbeeld.nl
origin() {
  printf '%s' "$1" | sed -n 's#^\(https\{0,1\}://[^/]*\).*$#\1#p'
}

OIDC_ORIGIN=$(origin "$WEB_OIDC_AUTHORITY")
API_ORIGIN=$(origin "$WEB_API_BASE_URL")

if [ -z "$OIDC_ORIGIN" ]; then
  echo "WEB_OIDC_AUTHORITY is geen http(s)-URL: $WEB_OIDC_AUTHORITY" >&2
  exit 1
fi

# Een relatieve API-URL (bijv. /api/v1) valt al onder 'self'.
CONNECT="$OIDC_ORIGIN${API_ORIGIN:+ $API_ORIGIN}"

sed -e "s#__CSP_CONNECT__#$CONNECT#g" -e "s#__CSP_OIDC__#$OIDC_ORIGIN#g" \
  /etc/nginx/cockpit/default.conf.template > /etc/nginx/conf.d/default.conf

echo "CSP: connect-src 'self' $CONNECT; frame-src $OIDC_ORIGIN"
