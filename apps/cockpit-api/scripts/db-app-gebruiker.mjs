// Maakt (of werkt bij) de loginrol waarmee de API verbindt, als lid van de applicatierol
// '<database>_app' uit migratie 20261002140000_audit_keten_app_rol.
//
// Draai na `prisma migrate deploy`, als eigenaar van de database:
//   DATABASE_URL=<eigenaar-url> APP_DB_USER=cockpit_api APP_DB_PASSWORD=... npm run db:app-gebruiker
//
// Het wachtwoord komt alleen uit de omgeving en wordt niet gelogd.
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
const gebruiker = process.env.APP_DB_USER;
const wachtwoord = process.env.APP_DB_PASSWORD;

if (!databaseUrl || !gebruiker || !wachtwoord) {
  console.error("DATABASE_URL (eigenaar), APP_DB_USER en APP_DB_PASSWORD zijn verplicht.");
  process.exit(1);
}

if (!/^[a-z_][a-z0-9_]{0,62}$/.test(gebruiker)) {
  console.error("APP_DB_USER mag alleen kleine letters, cijfers en _ bevatten.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const { rows } = await client.query("SELECT current_database() AS database");
  const appRol = `${rows[0].database}_app`;
  const rolBestaat = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [appRol]);

  if (rolBestaat.rowCount === 0) {
    throw new Error(`Rol ${appRol} bestaat niet; draai eerst de migraties.`);
  }

  const bestaat = await client.query("SELECT rolsuper FROM pg_roles WHERE rolname = $1", [gebruiker]);

  // De app-rol mag nooit de eigenaar of een superuser zijn: dan gelden de REVOKEs niet.
  if (bestaat.rows[0]?.rolsuper || gebruiker === (await client.query("SELECT current_user AS u")).rows[0].u) {
    throw new Error(`${gebruiker} is superuser of de eigenaar; kies een aparte gebruiker voor de API.`);
  }

  const id = client.escapeIdentifier(gebruiker);
  const geheim = client.escapeLiteral(wachtwoord);

  await client.query(
    bestaat.rowCount === 0
      ? `CREATE ROLE ${id} LOGIN PASSWORD ${geheim} NOSUPERUSER NOCREATEDB NOCREATEROLE`
      : `ALTER ROLE ${id} LOGIN PASSWORD ${geheim}`
  );
  await client.query(`GRANT ${client.escapeIdentifier(appRol)} TO ${id}`);
  await client.query(`GRANT CONNECT ON DATABASE ${client.escapeIdentifier(rows[0].database)} TO ${id}`);

  console.log(`Loginrol ${gebruiker} is lid van ${appRol}.`);
} finally {
  await client.end();
}
