-- PATCH DE GESTION DES STATUTS PRODUITS
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'actif';
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Index pour optimiser le filtrage des produits actifs
CREATE INDEX IF NOT EXISTS idx_stock_items_status ON stock_items(status) WHERE status = 'actif';