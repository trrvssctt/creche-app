-- Migration: Ajouter table pour les messages de contact
-- Date: 11 mars 2026
-- Description: Messages des visiteurs depuis la landing page
-- Note: Ce script est maintenant géré par Sequelize, il est conservé pour référence

-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CREATE TABLE IF NOT EXISTS contact_messages (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     
--     -- Informations du contact
--     full_name VARCHAR(255) NOT NULL,
--     email VARCHAR(255) NOT NULL,
--     phone VARCHAR(50),
--     
--     -- Contenu du message
--     subject VARCHAR(500),
--     message TEXT NOT NULL,
--     
--     -- État du message
--     status VARCHAR(20) DEFAULT 'non_lus' CHECK (status IN ('non_lus', 'lus')),
--     
--     -- Métadonnées
--     ip_address INET,
--     user_agent TEXT,
--     source VARCHAR(100) DEFAULT 'landing_page',
--     
--     -- Gestion des réponses
--     admin_notes TEXT,
--     replied_at TIMESTAMP,
--     replied_by VARCHAR(255),
--     
--     -- Timestamps
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- -- Index pour optimiser les recherches
-- CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
-- CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);
-- CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);

-- -- Fonction pour mettre à jour automatiquement updated_at
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = CURRENT_TIMESTAMP;
--     RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- -- Trigger pour mettre à jour updated_at automatiquement
-- CREATE TRIGGER update_contact_messages_updated_at 
--     BEFORE UPDATE ON contact_messages 
--     FOR EACH ROW 
--     EXECUTE FUNCTION update_updated_at_column();

-- Note: La table contact_messages est maintenant gérée automatiquement par Sequelize
-- Les données de test sont créées par le seeder au démarrage du serveur