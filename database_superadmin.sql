
-- TABLE DES SUPER-ADMINISTRATEURS
CREATE TABLE super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INSERTION DU COMPTE MAÎTRE INITIAL (Mot de passe: admin123)
-- Hash bcrypt pour 'admin123'
INSERT INTO super_admins (name, email, password) 
VALUES ('Master Admin', 'master@gestock.pro', '$2b$10$9f8v1x/D5vW5LpY8rG8XheOQyB9.pYy1v6f4W8H8kO9i0.i9w8W1y');

-- EXTENSION TABLE PLANS (Si non existante ou incomplète)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';

-- INDEX POUR LES RECHERCHES CROISÉES
CREATE INDEX idx_sub_status ON subscriptions(status);
CREATE INDEX idx_tenant_payment_status ON tenants(payment_status);
