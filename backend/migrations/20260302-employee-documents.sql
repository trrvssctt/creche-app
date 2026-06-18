-- Migration pour la gestion des documents des employés
-- Date: 2026-03-02

-- Création de la table employee_documents
CREATE TABLE IF NOT EXISTS employee_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('ID_CARD', 'CONTRACT', 'DIPLOMA', 'BANK_DETAILS', 'MEDICAL', 'OTHER')),
    category VARCHAR(255),
    file_url TEXT NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by uuid,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_employee_documents_employee_id ON employee_documents(employee_id);
CREATE INDEX idx_employee_documents_category ON employee_documents(category);
CREATE INDEX idx_employee_documents_created_at ON employee_documents(created_at);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_employee_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_employee_documents_updated_at
    BEFORE UPDATE ON employee_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_documents_updated_at();

-- Ajouter quelques documents d'exemple (optionnel pour les tests)
-- INSERT INTO employee_documents (employee_id, name, category, file_url, file_type, file_size, original_name)
-- VALUES 
-- (1, 'Contrat de Travail CDI', 'CONTRACT', 'https://example.com/contract.pdf', 'application/pdf', 204800, 'contrat_moussa_diop.pdf'),
-- (1, 'CNI Recto-Verso', 'IDENTITY', 'https://example.com/cni.jpg', 'image/jpeg', 1024000, 'cni_moussa.jpg');

COMMIT;