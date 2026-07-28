-- Table de suivi de la fenêtre de 24h WhatsApp
-- Alimentée par le webhook entrant Botpress → backend
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  phone        VARCHAR(20) PRIMARY KEY,
  last_inbound TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_inbound
  ON whatsapp_sessions (last_inbound);
