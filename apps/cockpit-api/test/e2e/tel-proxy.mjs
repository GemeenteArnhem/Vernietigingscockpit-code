// Doorgeefluik voor de E2E-tests (CC-7): stuurt elk verzoek ongewijzigd door naar de
// teststekker en telt de muterende aanroepen per taak. De taak volgt uit X-Correlation-ID
// (`<taakId>:<job>`), die de cockpit bij elke stekkeraanroep meestuurt.
//   GET /__tellingen       ->  { "<taakId>": { "POST /selecties": 1, ... } }
//   GET /__vernietigingen  ->  { "<taakId>": ["<vernietigingId bij de stekker>", ...] }  (uniek)
import http from 'node:http';

const DOEL = process.env.DOEL ?? 'http://stekker:3000';
const tellingen = {};
const vernietigingen = {};

// Tellingen zonder de versieprefix van de Stekker API (/v2).
function sjabloon(pad) {
  return pad
    .replace(/^\/v\d+/, '')
    .replace(/^\/selecties\/[^/]+/, '/selecties/{id}')
    .replace(/^\/vernietigingen\/[^/]+/, '/vernietigingen/{id}')
    .replace(/\/batches\/[^/]+$/, '/batches/{nr}');
}

function leesBody(request) {
  return new Promise((resolve, reject) => {
    const delen = [];
    request.on('data', (deel) => delen.push(deel));
    request.on('end', () => resolve(Buffer.concat(delen)));
    request.on('error', reject);
  });
}

http
  .createServer(async (request, response) => {
    const url = new URL(request.url, 'http://proxy');

    if (url.pathname === '/__tellingen') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(tellingen));
      return;
    }

    if (url.pathname === '/__vernietigingen') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(Object.fromEntries(Object.entries(vernietigingen).map(([taak, ids]) => [taak, [...ids]]))));
      return;
    }

    const taak = String(request.headers['x-correlation-id'] ?? 'onbekend').split(':')[0];

    if (request.method !== 'GET') {
      const sleutel = `${request.method} ${sjabloon(url.pathname)}`;
      tellingen[taak] ??= {};
      tellingen[taak][sleutel] = (tellingen[taak][sleutel] ?? 0) + 1;
    }

    try {
      const body = await leesBody(request);
      const headers = { ...request.headers };
      delete headers.host;
      delete headers['content-length'];
      const antwoord = await fetch(`${DOEL}${url.pathname}${url.search}`, {
        method: request.method,
        headers,
        body: body.length > 0 ? body : undefined,
      });
      const inhoud = Buffer.from(await antwoord.arrayBuffer());

      // Welke vernietigingen de stekker werkelijk heeft aangemaakt (ook bij herhaalde POST's).
      if (request.method === 'POST' && sjabloon(url.pathname) === '/vernietigingen' && antwoord.ok) {
        const id = JSON.parse(inhoud.toString('utf8')).vernietigingId;
        (vernietigingen[taak] ??= new Set()).add(id);
      }
      // Headers van de stekker doorgeven (o.a. API-Version, die de cockpit controleert).
      const doorgeven = Object.fromEntries(
        [...antwoord.headers.entries()].filter(([naam]) => !['content-length', 'transfer-encoding', 'connection', 'content-encoding'].includes(naam))
      );
      response.writeHead(antwoord.status, doorgeven);
      response.end(inhoud);
    } catch (error) {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ fout: String(error) }));
    }
  })
  .listen(8080, () => console.log(`tel-proxy -> ${DOEL}`));
