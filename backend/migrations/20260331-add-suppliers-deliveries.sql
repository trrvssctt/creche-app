-- Migration: add purchase_price to stock_items + create suppliers, deliveries, delivery_items
-- Date: 2026-03-31

-- 1. Add purchase_price to stock_items (PUMP — Prix Unitaire Moyen Pondéré)
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(15,2) DEFAULT 0;

-- 2. Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  main_contact VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  address TEXT,
  siret VARCHAR(50),
  tva_intra VARCHAR(50),
  website VARCHAR(255),
  payment_terms INTEGER DEFAULT 30,
  status VARCHAR(20) DEFAULT 'actif',
  deleted_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_tenant_name
  ON suppliers (tenant_id, company_name)
  WHERE status = 'actif';

-- 3. Create deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reference VARCHAR(50) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  delivery_date DATE,
  total_ht NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING','RECEIVED','PARTIAL','CANCELLED')),
  notes TEXT,
  purchase_order_ref VARCHAR(100),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_tenant_ref
  ON deliveries (tenant_id, reference);

-- 4. Create delivery_items table
CREATE TABLE IF NOT EXISTS delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id),
  quantity_received INTEGER NOT NULL DEFAULT 0,
  purchase_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_ht NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery_id ON delivery_items (delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_stock_item_id ON delivery_items (stock_item_id);
