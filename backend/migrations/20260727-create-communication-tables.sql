-- Migration: Tables du module Communications (WhatsApp via Botpress)
-- Date: 2026-07-27

CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  category VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(30) NOT NULL,
  category VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
  template_id VARCHAR(100),
  subject VARCHAR(255),
  body TEXT NOT NULL,
  channel VARCHAR(20) DEFAULT 'WHATSAPP',
  target_type VARCHAR(20) NOT NULL,
  target_niveau VARCHAR(10),
  target_classe_id UUID REFERENCES classes(id),
  target_eleve_id UUID REFERENCES eleves(id),
  recipient_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'PENDING',
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comm_logs_tenant ON communication_logs(tenant_id);
CREATE INDEX idx_comm_logs_status ON communication_logs(tenant_id, status);
CREATE INDEX idx_comm_logs_created ON communication_logs(tenant_id, created_at DESC);
CREATE INDEX idx_comm_templates_tenant ON communication_templates(tenant_id, is_active);

-- Templates système par défaut (insérés pour chaque tenant existant)
-- Sera peuplé au premier accès via le seed ou manuellement
