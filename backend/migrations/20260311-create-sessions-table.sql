-- Migration: Create sessions table for user session management
-- Date: 2026-03-11

-- Créer la table sessions pour gérer les sessions utilisateur actives
CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    session_token varchar(255) UNIQUE NOT NULL,
    jwt_token text NOT NULL,
    ip_address inet,
    user_agent text,
    device_info text,
    is_active boolean DEFAULT true,
    last_activity timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    login_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    logout_at timestamp with time zone NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

-- Trigger pour mise à jour automatique du timestamp
CREATE OR REPLACE FUNCTION update_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_sessions_updated_at();

-- Commentaires sur la table
COMMENT ON TABLE sessions IS 'Table pour gérer les sessions utilisateur actives avec JWT et suivi de l''activité';
COMMENT ON COLUMN sessions.session_token IS 'Token de session unique généré côté serveur';
COMMENT ON COLUMN sessions.jwt_token IS 'Token JWT associé à la session';
COMMENT ON COLUMN sessions.last_activity IS 'Dernière activité de l''utilisateur dans cette session';
COMMENT ON COLUMN sessions.expires_at IS 'Date d''expiration de la session';