
-- ==========================================
-- MODULE D'INVENTAIRE PHYSIQUE (KERNEL GSP)
-- ==========================================

-- Table des Campagnes
CREATE TABLE IF NOT EXISTS inventory_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table des Items d'Inventaire
CREATE TABLE IF NOT EXISTS inventory_campaign_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES inventory_campaigns(id) ON DELETE CASCADE,
    stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    system_qty INTEGER NOT NULL DEFAULT 0,
    counted_qty INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexation Multi-Tenant
CREATE INDEX IF NOT EXISTS idx_inv_campaign_tenant ON inventory_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_item_campaign ON inventory_campaign_items(campaign_id);
