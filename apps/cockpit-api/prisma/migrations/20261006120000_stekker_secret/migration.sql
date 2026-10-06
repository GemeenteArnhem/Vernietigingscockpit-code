-- Stekkerbeheer: het secret van een stekker (OAuth2 client credentials) versleuteld opgeslagen
-- (AES-256-GCM, sleutel uit SECRET_ENCRYPTION_KEY). Wordt nooit teruggegeven door de API.
-- secret_ref (naam van een omgevingsvariabele) blijft werken als terugval.
ALTER TABLE "stekker_configuratie" ADD COLUMN "secret_versleuteld" TEXT;
