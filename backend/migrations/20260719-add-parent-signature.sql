-- Signature digitale parent + suivi documents signés
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS documents_signes JSONB DEFAULT '[]';
