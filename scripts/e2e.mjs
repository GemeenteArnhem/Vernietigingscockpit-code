// Start de E2E-omgeving, draait de E2E-tests en ruimt daarna op (ook bij falen).
//   npm run test:e2e                 standaard
//   E2E_BEHOUD=1 npm run test:e2e    omgeving laten draaien voor onderzoek
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compose = ['compose', '-f', path.join(root, 'infrastructure', 'compose', 'docker-compose.test.yml')];

// Geheimen voor de E2E-omgeving: in infrastructure/compose/.env (niet in git). Bestaat het
// bestand niet, dan worden willekeurige waarden gemaakt; een bestaand bestand blijft staan.
// Compose leest het zelf; de tests krijgen de waarden via de omgeving.
const geheimenBestand = path.join(root, 'infrastructure', 'compose', '.env');
const GEHEIMEN = ['E2E_DB_WACHTWOORD', 'E2E_DB_APP_WACHTWOORD', 'E2E_STEKKER_GEHEIM'];

function leesGeheimen() {
  const waarden = {};
  if (fs.existsSync(geheimenBestand)) {
    for (const regel of fs.readFileSync(geheimenBestand, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(regel);
      if (match) {
        waarden[match[1]] = match[2];
      }
    }
  }
  return waarden;
}

let geheimen = leesGeheimen();
const ontbrekend = GEHEIMEN.filter((sleutel) => !geheimen[sleutel]);

if (ontbrekend.length > 0) {
  const aanvulling = ontbrekend.map((sleutel) => `${sleutel}=${randomBytes(24).toString('base64url')}`).join('\n');
  const kop = fs.existsSync(geheimenBestand) ? '' : '# Geheimen van de E2E-omgeving; gemaakt door scripts/e2e.mjs. Niet in git.\n';
  fs.appendFileSync(geheimenBestand, `${kop}${aanvulling}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log(`E2E-geheimen aangevuld in ${path.relative(root, geheimenBestand)}: ${ontbrekend.join(', ')}`);
  geheimen = leesGeheimen();
}

function run(command, args, opties = {}) {
  const resultaat = spawnSync(command, args, { stdio: 'inherit', cwd: root, ...opties });
  return resultaat.status ?? 1;
}

// Scenario H (CC-10): een stekker met 15.000 kandidaten. De dataset wordt met de generator
// van de teststekker gemaakt (deterministisch) en alleen als hij nog niet bestaat.
const stekkerRepo = process.env.STEKKER_REPO
  ? path.resolve(root, 'infrastructure', 'compose', process.env.STEKKER_REPO)
  : path.resolve(root, '..', 'Vernietigingscockpit-stekker-test');
const dataset = path.join(root, 'apps', 'cockpit-api', 'test', 'e2e', 'data', 'groot-15000.csv');

if (!fs.existsSync(dataset)) {
  fs.mkdirSync(path.dirname(dataset), { recursive: true });
  run(process.execPath, [path.join(stekkerRepo, 'scripts', 'genereer-testdata.js'), '--aantal', '15000', '--uit', dataset]);
}

let status = run('docker', [...compose, 'up', '-d', '--build', '--wait']);

if (status === 0) {
  status = run(process.execPath, [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--project', 'e2e'], {
    cwd: path.join(root, 'apps', 'cockpit-api'),
    env: { ...process.env, ...geheimen, VITEST_E2E: '1' },
  });
} else {
  run('docker', [...compose, 'logs', '--tail', '80']);
}

if (status !== 0) {
  run('docker', [...compose, 'logs', '--tail', '40', 'api', 'worker-1', 'worker-2', 'stekker']);
}

if (process.env.E2E_BEHOUD !== '1') {
  run('docker', [...compose, 'down', '-v', '--remove-orphans']);
}

process.exit(status);
