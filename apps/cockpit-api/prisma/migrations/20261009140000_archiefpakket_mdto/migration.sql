-- Archiefpakket als MDTO-XML 1.0.1 (ADR-0005 §7): manifest.json vervalt; de referentie naar
-- het pakket is de SHA-256 van dossier.mdto.xml.
ALTER TABLE "archivering" RENAME COLUMN "manifest_sha256" TO "dossier_sha256";
