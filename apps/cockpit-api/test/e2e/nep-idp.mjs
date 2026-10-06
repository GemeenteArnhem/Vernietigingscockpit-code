// Nep-identity-provider voor de E2E-tests. NIET voor productie.
//
// Bootst de onderdelen van Keycloak na die cockpit en teststekker gebruiken:
// - JWKS:    GET  /realms/vc/protocol/openid-connect/certs
// - Token:   POST /realms/vc/protocol/openid-connect/token  (client credentials, cockpit → stekker)
// - Test:    POST /test/gebruikerstoken                      (gebruikerstoken voor de cockpit-API)
//
// De sleutel wordt bij elke start opnieuw gemaakt en verlaat het proces niet.
import crypto from 'node:crypto';
import http from 'node:http';

const ISSUER = process.env.IDP_ISSUER ?? 'http://idp:8080/realms/vc';
const CLIENT_ID = process.env.IDP_CLIENT_ID ?? 'cockpit-stekker';
const CLIENT_SECRET = process.env.IDP_CLIENT_SECRET;

if (!CLIENT_SECRET) {
  console.error('IDP_CLIENT_SECRET ontbreekt (komt uit infrastructure/compose/.env).');
  process.exit(1);
}
const STEKKER_AUDIENCE = process.env.IDP_STEKKER_AUDIENCE ?? 'teststekker';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'e2e-1', use: 'sig', alg: 'RS256' };

function maakToken(claims, looptijdS = 300) {
  const nu = Math.floor(Date.now() / 1000);
  const b64 = (waarde) => Buffer.from(JSON.stringify(waarde)).toString('base64url');
  const data = `${b64({ alg: 'RS256', typ: 'JWT', kid: jwk.kid })}.${b64({ iss: ISSUER, iat: nu, exp: nu + looptijdS, ...claims })}`;
  return `${data}.${crypto.sign('sha256', Buffer.from(data), privateKey).toString('base64url')}`;
}

async function leesBody(request) {
  const delen = [];
  for await (const deel of request) delen.push(deel);
  return Buffer.concat(delen).toString('utf8');
}

function stuur(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

http.createServer(async (request, response) => {
  const pad = request.url.split('?')[0];

  if (request.method === 'GET' && pad === '/health') {
    return stuur(response, 200, { status: 'ok' });
  }

  if (request.method === 'GET' && pad === '/realms/vc/protocol/openid-connect/certs') {
    return stuur(response, 200, { keys: [jwk] });
  }

  if (request.method === 'POST' && pad === '/realms/vc/protocol/openid-connect/token') {
    const form = new URLSearchParams(await leesBody(request));

    if (form.get('grant_type') !== 'client_credentials' || form.get('client_id') !== CLIENT_ID || form.get('client_secret') !== CLIENT_SECRET) {
      return stuur(response, 401, { error: 'invalid_client' });
    }

    const scope = form.get('scope') ?? '';
    return stuur(response, 200, {
      access_token: maakToken({ sub: `service-account-${CLIENT_ID}`, azp: CLIENT_ID, aud: STEKKER_AUDIENCE, scope }),
      token_type: 'Bearer',
      expires_in: 300
    });
  }

  if (request.method === 'POST' && pad === '/test/gebruikerstoken') {
    const { username, roles = [], email } = JSON.parse((await leesBody(request)) || '{}');
    return stuur(response, 200, {
      access_token: maakToken({
        sub: `sub-${username}`,
        aud: 'cockpit-api',
        preferred_username: username,
        name: username,
        email,
        realm_access: { roles }
      })
    });
  }

  return stuur(response, 404, { error: 'not_found' });
}).listen(8080, () => console.log(`nep-idp luistert op 8080 (issuer ${ISSUER})`));
