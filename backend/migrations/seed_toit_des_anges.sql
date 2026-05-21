-- ============================================================
-- SEED DONNÉES RÉELLES — Le Toit des Anges
-- Tenant ID : b2688399-60a9-42ad-ac8c-d16b0fffdf4c
-- Généré le : 2026-05-20
-- ============================================================

-- Variables de référence
-- tenant_id  : b2688399-60a9-42ad-ac8c-d16b0fffdf4c
-- directrice user id : 7c99d34d-03e3-4f62-8cbb-601981c0c8d5
-- Année scolaire active : 2025-2026

DO $$
DECLARE
  v_tenant UUID := 'b2688399-60a9-42ad-ac8c-d16b0fffdf4c';

  -- Département IDs
  dep_direction   UUID;
  dep_maternelle  UUID;
  dep_elementaire UUID;
  dep_creche      UUID;
  dep_admin       UUID;
  dep_securite    UUID;

  -- Employee IDs (enseignants)
  emp_directrice  UUID := '9a000001-0000-0000-0000-000000000001';
  emp_ps_a        UUID := '9a000002-0000-0000-0000-000000000002';
  emp_ms_a        UUID := 'fe79f4df-bb47-48a9-a531-1e3a6eb26099'; -- Fatou SALL (existant)
  emp_gs_a        UUID := '9a000003-0000-0000-0000-000000000003';
  emp_cp_a        UUID := 'a279cbcc-6010-4f27-a20a-416868166004'; -- Moussa Cissokho (existant)
  emp_ce1_a       UUID := '9a000004-0000-0000-0000-000000000004';
  emp_ce2_a       UUID := '9a000005-0000-0000-0000-000000000005';
  emp_creche_a    UUID := '879adb93-1198-4f04-8115-1aeb172e47fb'; -- Fatima DIOP (existant)
  emp_anglais     UUID := '9a000006-0000-0000-0000-000000000006';
  emp_eps         UUID := '9a000007-0000-0000-0000-000000000007';
  emp_infirmiere  UUID := '9a000008-0000-0000-0000-000000000008';
  emp_secretaire  UUID := '9a000009-0000-0000-0000-000000000009';
  emp_vigile1     UUID := '9a000010-0000-0000-0000-000000000010';
  emp_vigile2     UUID := '9a000011-0000-0000-0000-000000000011';
  emp_chauffeur   UUID := '9a000012-0000-0000-0000-000000000012';

  -- Class IDs (2025-2026)
  cls_creche      UUID := '9b000001-0000-0000-0000-000000000001';
  cls_ps          UUID := 'b90013ac-4c33-431b-ac27-78e47ac4bec7'; -- PS existant (modifié)
  cls_ms          UUID := '687a7bc3-5552-4b8f-87ed-e51d53ac1768'; -- MS existant
  cls_ms_hand     UUID := '8a4f8c38-776c-472c-be70-70405062894b'; -- MS Handicap existant
  cls_gs          UUID := '9b000004-0000-0000-0000-000000000004';
  cls_cp          UUID := '16cfa884-3278-4e6f-82d2-140b14c5b2e5'; -- CP existant
  cls_ce1         UUID := '9b000006-0000-0000-0000-000000000006';
  cls_ce2         UUID := '9b000007-0000-0000-0000-000000000007';

BEGIN

-- ═══════════════════════════════════════════════════════════════
-- 1. DEPARTMENTS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO departments (id, tenant_id, name, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_tenant, 'Direction',              'Directrice et administration générale', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'Pédagogie Maternelle',  'Classes PS, MS, GS',                    NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'Pédagogie Élémentaire', 'Classes CP, CE1, CE2',                  NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'Crèche',                'Section bébés 3-36 mois',               NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'Administration',        'Secrétariat, comptabilité, infirmerie',  NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'Sécurité & Services',   'Vigiles, chauffeur, entretien',          NOW(), NOW())
ON CONFLICT DO NOTHING;

SELECT id INTO dep_direction   FROM departments WHERE tenant_id = v_tenant AND name = 'Direction'              LIMIT 1;
SELECT id INTO dep_maternelle  FROM departments WHERE tenant_id = v_tenant AND name = 'Pédagogie Maternelle'   LIMIT 1;
SELECT id INTO dep_elementaire FROM departments WHERE tenant_id = v_tenant AND name = 'Pédagogie Élémentaire'  LIMIT 1;
SELECT id INTO dep_creche      FROM departments WHERE tenant_id = v_tenant AND name = 'Crèche'                 LIMIT 1;
SELECT id INTO dep_admin       FROM departments WHERE tenant_id = v_tenant AND name = 'Administration'         LIMIT 1;
SELECT id INTO dep_securite    FROM departments WHERE tenant_id = v_tenant AND name = 'Sécurité & Services'    LIMIT 1;

-- ═══════════════════════════════════════════════════════════════
-- 2. EMPLOYEES (nouveaux + mise à jour des existants)
-- ═══════════════════════════════════════════════════════════════

-- Mise à jour des employés existants avec département
UPDATE employees SET department_id = dep_creche,     position = 'Enseignante Crèche',   phone = '+221 77 102 03 04', base_salary = 180000 WHERE id = emp_creche_a;
UPDATE employees SET department_id = dep_maternelle,  position = 'Enseignante MS',        phone = '+221 77 203 04 05', base_salary = 210000 WHERE id = emp_ms_a;
UPDATE employees SET department_id = dep_elementaire, position = 'Enseignant(e) CP',      phone = '+221 77 304 05 06', base_salary = 220000 WHERE id = emp_cp_a;

-- Directrice
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_directrice, v_tenant, 'Aïssatou', 'NDIAYE', 'directrice@toit-des-anges.sn', '+221 77 000 11 22', '1980-03-15', 'F', '2015-09-01', 'Directrice', dep_direction, 450000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_direction, position = 'Directrice', base_salary = 450000;

-- Enseignante PS
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_ps_a, v_tenant, 'Mariama', 'BA', 'mariama.ba@toit-des-anges.sn', '+221 77 112 22 33', '1992-07-08', 'F', '2020-09-01', 'Enseignante PS', dep_maternelle, 200000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_maternelle, position = 'Enseignante PS';

-- Enseignante GS
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_gs_a, v_tenant, 'Rokhaya', 'FALL', 'rokhaya.fall@toit-des-anges.sn', '+221 77 213 34 45', '1990-11-20', 'F', '2019-09-01', 'Enseignante GS', dep_maternelle, 205000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_maternelle, position = 'Enseignante GS';

-- Enseignante CE1
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_ce1_a, v_tenant, 'Ndèye', 'DIAW', 'ndeye.diaw@toit-des-anges.sn', '+221 77 314 44 55', '1988-04-12', 'F', '2018-09-01', 'Enseignante CE1', dep_elementaire, 225000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_elementaire, position = 'Enseignante CE1';

-- Enseignant CE2
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_ce2_a, v_tenant, 'Ousmane', 'DIALLO', 'ousmane.diallo@toit-des-anges.sn', '+221 77 415 55 66', '1985-09-25', 'M', '2017-09-01', 'Enseignant CE2', dep_elementaire, 230000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_elementaire, position = 'Enseignant CE2';

-- Professeur d'Anglais (inter-classes)
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_anglais, v_tenant, 'Ibrahima', 'SECK', 'ibrahima.seck@toit-des-anges.sn', '+221 77 516 66 77', '1991-01-30', 'M', '2021-09-01', 'Professeur d''Anglais', dep_elementaire, 195000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_elementaire, position = 'Professeur d''Anglais';

-- Professeur d'EPS (inter-classes)
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_eps, v_tenant, 'Modou', 'MBAYE', 'modou.mbaye@toit-des-anges.sn', '+221 77 617 77 88', '1987-06-14', 'M', '2022-01-15', 'Professeur EPS', dep_elementaire, 190000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_elementaire, position = 'Professeur EPS';

-- Infirmière
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_infirmiere, v_tenant, 'Khady', 'CISSÉ', 'khady.cisse@toit-des-anges.sn', '+221 77 718 88 99', '1989-08-05', 'F', '2020-01-02', 'Infirmière', dep_admin, 220000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_admin, position = 'Infirmière';

-- Secrétaire
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_secretaire, v_tenant, 'Amy', 'TOURÉ', 'amy.toure@toit-des-anges.sn', '+221 77 819 99 00', '1994-12-18', 'F', '2023-09-01', 'Secrétaire', dep_admin, 175000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_admin, position = 'Secrétaire';

-- Vigile 1
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_vigile1, v_tenant, 'Babacar', 'NIANG', 'babacar.niang@toit-des-anges.sn', '+221 76 100 11 22', '1983-02-28', 'M', '2016-06-01', 'Agent de Sécurité', dep_securite, 160000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_securite, position = 'Agent de Sécurité';

-- Vigile 2
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_vigile2, v_tenant, 'Pape', 'DIOUF', 'pape.diouf@toit-des-anges.sn', '+221 76 200 22 33', '1986-10-10', 'M', '2019-03-01', 'Agent de Sécurité', dep_securite, 160000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_securite, position = 'Agent de Sécurité';

-- Chauffeur
INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, birth_date, gender, hire_date, position, department_id, base_salary, status, country, city, created_at, updated_at)
VALUES (emp_chauffeur, v_tenant, 'Samba', 'SARR', 'samba.sarr@toit-des-anges.sn', '+221 76 300 33 44', '1979-05-22', 'M', '2018-09-01', 'Chauffeur', dep_securite, 170000, 'ACTIVE', 'Sénégal', 'Dakar', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET department_id = dep_securite, position = 'Chauffeur';

-- ═══════════════════════════════════════════════════════════════
-- 3. CONTRATS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO contracts (id, tenant_id, employee_id, type, start_date, salary, status, working_hours, created_at, updated_at)
SELECT gen_random_uuid(), v_tenant, emp, 'CDI', '2025-09-01'::date, sal, 'ACTIVE', 40, NOW(), NOW()
FROM (VALUES
  (emp_directrice,  450000),
  (emp_ps_a,        200000),
  (emp_gs_a,        205000),
  (emp_ce1_a,       225000),
  (emp_ce2_a,       230000),
  (emp_anglais,     195000),
  (emp_eps,         190000),
  (emp_infirmiere,  220000),
  (emp_secretaire,  175000),
  (emp_vigile1,     160000),
  (emp_vigile2,     160000),
  (emp_chauffeur,   170000)
) AS t(emp, sal)
WHERE NOT EXISTS (
  SELECT 1 FROM contracts WHERE employee_id = t.emp AND tenant_id = v_tenant AND status = 'ACTIVE'
);

-- Contrats existants si absent
INSERT INTO contracts (id, tenant_id, employee_id, type, start_date, salary, status, working_hours, created_at, updated_at)
SELECT gen_random_uuid(), v_tenant, id, 'CDI', '2025-09-01'::date, base_salary, 'ACTIVE', 40, NOW(), NOW()
FROM employees
WHERE tenant_id = v_tenant AND id IN (emp_ms_a, emp_cp_a, emp_creche_a)
AND NOT EXISTS (SELECT 1 FROM contracts WHERE employee_id = employees.id AND tenant_id = v_tenant AND status = 'ACTIVE');

-- ═══════════════════════════════════════════════════════════════
-- 4. USERS (comptes d'accès) pour les nouveaux employés
-- ═══════════════════════════════════════════════════════════════

-- Directrice user (existant 7c99d34d) — mise à jour du lien employee
UPDATE users SET employee_id = emp_directrice WHERE id = '7c99d34d-03e3-4f62-8cbb-601981c0c8d5';

-- Upsert des users par (tenant_id, email) — contrainte composite
INSERT INTO users (id, tenant_id, name, email, password, role, is_active, employee_id, created_at, updated_at)
SELECT gen_random_uuid(), t.tenant_id, t.name, t.email, t.pwd, t.role, true, t.emp, NOW(), NOW()
FROM (VALUES
  (v_tenant, 'Mariama BA',      'mariama.ba@toit-des-anges.sn',      '$2b$10$K7EBSwOZ5U5NlSuU3bJuGOsrmXm0nt1ZmfIRLNB.A0DlTx7iK5kFi', 'ENSEIGNANT', emp_ps_a),
  (v_tenant, 'Rokhaya FALL',    'rokhaya.fall@toit-des-anges.sn',    '$2b$10$K7EBSwOZ5U5NlSuU3bJuGOsrmXm0nt1ZmfIRLNB.A0DlTx7iK5kFi', 'ENSEIGNANT', emp_gs_a),
  (v_tenant, 'Ndèye DIAW',      'ndeye.diaw@toit-des-anges.sn',      '$2b$10$K7EBSwOZ5U5NlSuU3bJuGOsrmXm0nt1ZmfIRLNB.A0DlTx7iK5kFi', 'ENSEIGNANT', emp_ce1_a),
  (v_tenant, 'Ousmane DIALLO',  'ousmane.diallo@toit-des-anges.sn',  '$2b$10$K7EBSwOZ5U5NlSuU3bJuGOsrmXm0nt1ZmfIRLNB.A0DlTx7iK5kFi', 'ENSEIGNANT', emp_ce2_a),
  (v_tenant, 'Babacar NIANG',   'babacar.niang@toit-des-anges.sn',   '$2b$10$K7EBSwOZ5U5NlSuU3bJuGOsrmXm0nt1ZmfIRLNB.A0DlTx7iK5kFi', 'EMPLOYEE',   emp_vigile1),
  (v_tenant, 'Pape DIOUF',      'pape.diouf@toit-des-anges.sn',      '$2b$10$K7EBSwOZ5U5NlSuU3bJuGOsrmXm0nt1ZmfIRLNB.A0DlTx7iK5kFi', 'EMPLOYEE',   emp_vigile2),
  (v_tenant, 'Khady CISSÉ',     'khady.cisse@toit-des-anges.sn',     '$2b$10$K7EBSwOZ5U5NlSuU3bJuGOsrmXm0nt1ZmfIRLNB.A0DlTx7iK5kFi', 'INFIRMIERE', emp_infirmiere),
  (v_tenant, 'Amy TOURÉ',       'amy.toure@toit-des-anges.sn',       '$2b$10$K7EBSwOZ5U5NlSuU3bJuGOsrmXm0nt1ZmfIRLNB.A0DlTx7iK5kFi', 'ASSISTANTE', emp_secretaire),
  (v_tenant, 'Samba SARR',      'samba.sarr@toit-des-anges.sn',      '$2b$10$K7EBSwOZ5U5NlSuU3bJuGOsrmXm0nt1ZmfIRLNB.A0DlTx7iK5kFi', 'CHAUFFEUR',  emp_chauffeur)
) AS t(tenant_id, name, email, pwd, role, emp)
ON CONFLICT (tenant_id, email) DO UPDATE
  SET employee_id = EXCLUDED.employee_id,
      role        = EXCLUDED.role,
      name        = EXCLUDED.name,
      updated_at  = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 5. CLASSES (2025-2026) — compléter les manquantes
-- ═══════════════════════════════════════════════════════════════

-- Mettre à jour la PS existante avec les bonnes infos
UPDATE classes SET nom = 'Petite Section A', enseignant_id = emp_ps_a, annee_scolaire = '2025-2026' WHERE id = cls_ps;

-- Crèche (nouvelle)
INSERT INTO classes (id, tenant_id, nom, niveau, enseignant_id, capacite_max, annee_scolaire, description, created_at, updated_at)
VALUES (cls_creche, v_tenant, 'Crèche', 'CRECHE', emp_creche_a, 15, '2025-2026', 'Section bébés 3-36 mois — Mme Fatima DIOP', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- GS
INSERT INTO classes (id, tenant_id, nom, niveau, enseignant_id, capacite_max, annee_scolaire, description, created_at, updated_at)
VALUES (cls_gs, v_tenant, 'Grande Section A', 'GS', emp_gs_a, 30, '2025-2026', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- CE1
INSERT INTO classes (id, tenant_id, nom, niveau, enseignant_id, capacite_max, annee_scolaire,
  enseignants_matiere, description, created_at, updated_at)
VALUES (cls_ce1, v_tenant, 'CE1 A', 'CE1', emp_ce1_a, 30, '2025-2026',
  jsonb_build_array(
    jsonb_build_object('matiere', 'Anglais', 'enseignantId', emp_anglais::text),
    jsonb_build_object('matiere', 'EPS',     'enseignantId', emp_eps::text)
  ), NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- CE2
INSERT INTO classes (id, tenant_id, nom, niveau, enseignant_id, capacite_max, annee_scolaire,
  enseignants_matiere, description, created_at, updated_at)
VALUES (cls_ce2, v_tenant, 'CE2 A', 'CE2', emp_ce2_a, 30, '2025-2026',
  jsonb_build_array(
    jsonb_build_object('matiere', 'Anglais', 'enseignantId', emp_anglais::text),
    jsonb_build_object('matiere', 'EPS',     'enseignantId', emp_eps::text)
  ), NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Mise à jour MS Handicap
UPDATE classes SET nom = 'Section Inclusion (Handicap)', description = 'Enfants à besoins spécifiques' WHERE id = cls_ms_hand;

-- ═══════════════════════════════════════════════════════════════
-- 6. ÉLÈVES — données réelles par classe (2025-2026)
-- ═══════════════════════════════════════════════════════════════

-- Helper: parent JSONB
-- parent1 = { nom, prenom, tel, whatsapp, profession }

-- ── CRÈCHE (8 bébés) ──────────────────────────────────────────
INSERT INTO eleves (id, tenant_id, matricule, nom, prenom, date_naissance, lieu_naissance, niveau, classe_id,
  regime_financier, cantine, transport_bus, statut, date_admission, parent1, parent2, whatsapp_principal, annee_scolaire, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_tenant, 'CRE-2026-001', 'FALL',   'Mariama',  '2024-03-10', 'Dakar',    'CRECHE', cls_creche, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02',
    '{"nom":"FALL","prenom":"Ibrahima","tel":"+221771001001","whatsapp":"+221771001001","profession":"Ingénieur"}'::jsonb,
    '{"nom":"NDIAYE","prenom":"Rokhaya","tel":"+221772001001","whatsapp":"+221772001001","profession":"Professeure"}'::jsonb,
    '+221771001001', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CRE-2026-002', 'SOW',    'Abdoulaye', '2024-05-22', 'Dakar',    'CRECHE', cls_creche, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02',
    '{"nom":"SOW","prenom":"Mamadou","tel":"+221771002002","whatsapp":"+221771002002","profession":"Médecin"}'::jsonb, NULL,
    '+221771002002', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CRE-2026-003', 'DIALLO', 'Fatou',     '2024-07-15', 'Thiès',    'CRECHE', cls_creche, 'CAS_SOCIAL', false, false, 'INSCRIT', '2025-09-03',
    '{"nom":"DIALLO","prenom":"Oumar","tel":"+221771003003","whatsapp":"+221771003003","profession":"Commerçant"}'::jsonb, NULL,
    '+221771003003', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CRE-2026-004', 'MBAYE',  'Serigne',   '2024-01-08', 'Dakar',    'CRECHE', cls_creche, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02',
    '{"nom":"MBAYE","prenom":"El Hadji","tel":"+221771004004","whatsapp":"+221771004004","profession":"Avocat"}'::jsonb,
    '{"nom":"DÈME","prenom":"Awa","tel":"+221772004004","whatsapp":"+221772004004","profession":"Infirmière"}'::jsonb,
    '+221771004004', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CRE-2026-005', 'NDIAYE', 'Aïssatou',  '2024-09-01', 'Dakar',    'CRECHE', cls_creche, 'NORMAL', false, false, 'INSCRIT', '2025-09-04',
    '{"nom":"NDIAYE","prenom":"Babacar","tel":"+221771005005","whatsapp":"+221771005005","profession":"Enseignant"}'::jsonb, NULL,
    '+221771005005', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CRE-2026-006', 'CISSÉ',  'Mouhamed',  '2024-11-30', 'Ziguinchor','CRECHE', cls_creche, 'NORMAL', true,  false, 'INSCRIT', '2025-09-05',
    '{"nom":"CISSÉ","prenom":"Lamine","tel":"+221771006006","whatsapp":"+221771006006","profession":"Comptable"}'::jsonb, NULL,
    '+221771006006', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CRE-2026-007', 'BADJI',  'Aminata',   '2024-04-18', 'Dakar',    'CRECHE', cls_creche, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02',
    '{"nom":"BADJI","prenom":"Joseph","tel":"+221771007007","whatsapp":"+221771007007","profession":"Architecte"}'::jsonb,
    '{"nom":"BADJI","prenom":"Marie","tel":"+221772007007","whatsapp":"+221772007007","profession":"Sage-femme"}'::jsonb,
    '+221771007007', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CRE-2026-008', 'SARR',   'Binta',     '2024-08-25', 'Saint-Louis','CRECHE', cls_creche, 'NORMAL', false, true,  'INSCRIT', '2025-09-03',
    '{"nom":"SARR","prenom":"Abdou","tel":"+221771008008","whatsapp":"+221771008008","profession":"Pharmacien"}'::jsonb, NULL,
    '+221771008008', '2025-2026', NOW(), NOW());

-- ── PS (12 élèves) ────────────────────────────────────────────
INSERT INTO eleves (id, tenant_id, matricule, nom, prenom, date_naissance, lieu_naissance, niveau, classe_id,
  regime_financier, cantine, transport_bus, statut, date_admission, parent1, parent2, whatsapp_principal, annee_scolaire, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_tenant, 'PS-2026-001', 'DIOP',    'Moussa',    '2022-05-12', 'Dakar',      'PS', cls_ps, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"DIOP","prenom":"Pape","tel":"+221771010001","whatsapp":"+221771010001","profession":"Ingénieur BTP"}'::jsonb, '{"nom":"DIOP","prenom":"Fatou","tel":"+221772010001","whatsapp":"+221772010001","profession":"Secrétaire"}'::jsonb, '+221771010001', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'PS-2026-002', 'NIANG',   'Aminata',   '2022-08-03', 'Dakar',      'PS', cls_ps, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"NIANG","prenom":"Serigne","tel":"+221771010002","whatsapp":"+221771010002","profession":"Entrepreneur"}'::jsonb, NULL, '+221771010002', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'PS-2026-003', 'FALL',    'Ibrahima',  '2022-02-20', 'Thiès',      'PS', cls_ps, 'CAS_SOCIAL', false, false, 'INSCRIT', '2025-09-03', '{"nom":"FALL","prenom":"Samba","tel":"+221771010003","whatsapp":"+221771010003","profession":"Jardinier"}'::jsonb, NULL, '+221771010003', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'PS-2026-004', 'SOW',     'Rokhaya',   '2022-11-15', 'Dakar',      'PS', cls_ps, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"SOW","prenom":"Aliou","tel":"+221771010004","whatsapp":"+221771010004","profession":"Médecin"}'::jsonb, '{"nom":"SOW","prenom":"Marème","tel":"+221772010004","whatsapp":"+221772010004","profession":"Professeure"}'::jsonb, '+221771010004', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'PS-2026-005', 'BA',      'Fatimata',  '2022-07-08', 'Kolda',      'PS', cls_ps, 'NORMAL', false, true,  'INSCRIT', '2025-09-04', '{"nom":"BA","prenom":"Mamadou","tel":"+221771010005","whatsapp":"+221771010005","profession":"Commerçant"}'::jsonb, NULL, '+221771010005', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'PS-2026-006', 'DIALLO',  'Alpha',     '2022-04-25', 'Dakar',      'PS', cls_ps, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"DIALLO","prenom":"Tierno","tel":"+221771010006","whatsapp":"+221771010006","profession":"Banquier"}'::jsonb, '{"nom":"DIALLO","prenom":"Aissata","tel":"+221772010006","whatsapp":"+221772010006","profession":"Juriste"}'::jsonb, '+221771010006', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'PS-2026-007', 'DIOUF',   'Ndèye Aby', '2022-09-14', 'Dakar',      'PS', cls_ps, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"DIOUF","prenom":"Jean","tel":"+221771010007","whatsapp":"+221771010007","profession":"Informaticien"}'::jsonb, NULL, '+221771010007', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'PS-2026-008', 'CISSÉ',   'El Hadji',  '2022-01-30', 'Dakar',      'PS', cls_ps, 'NORMAL', false, false, 'INSCRIT', '2025-09-03', '{"nom":"CISSÉ","prenom":"Mouhamadou","tel":"+221771010008","whatsapp":"+221771010008","profession":"Policier"}'::jsonb, '{"nom":"CISSÉ","prenom":"Awa","tel":"+221772010008","whatsapp":"+221772010008","profession":"Aide-soignante"}'::jsonb, '+221771010008', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'PS-2026-009', 'TOURÉ',   'Oumou',     '2022-06-07', 'Ziguinchor', 'PS', cls_ps, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"TOURÉ","prenom":"Seydou","tel":"+221771010009","whatsapp":"+221771010009","profession":"Douanier"}'::jsonb, NULL, '+221771010009', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'PS-2026-010', 'MBAYE',   'Cheikh',    '2022-03-19', 'Dakar',      'PS', cls_ps, 'CAS_SOCIAL', false, false, 'INSCRIT', '2025-09-05', '{"nom":"MBAYE","prenom":"Idrissa","tel":"+221771010010","whatsapp":"+221771010010","profession":"Mécanicien"}'::jsonb, NULL, '+221771010010', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'PS-2026-011', 'BADIANE', 'Khadija',   '2022-10-11', 'Dakar',      'PS', cls_ps, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"BADIANE","prenom":"Alioune","tel":"+221771010011","whatsapp":"+221771010011","profession":"Architecte"}'::jsonb, '{"nom":"BADIANE","prenom":"Coumba","tel":"+221772010011","whatsapp":"+221772010011","profession":"Comptable"}'::jsonb, '+221771010011', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'PS-2026-012', 'NDIAYE',  'Pape Ngor', '2022-12-05', 'Saint-Louis','PS', cls_ps, 'NORMAL', true,  false, 'INSCRIT', '2025-09-03', '{"nom":"NDIAYE","prenom":"Boubacar","tel":"+221771010012","whatsapp":"+221771010012","profession":"Professeur"}'::jsonb, NULL, '+221771010012', '2025-2026', NOW(), NOW());

-- ── MS (11 élèves) ────────────────────────────────────────────
INSERT INTO eleves (id, tenant_id, matricule, nom, prenom, date_naissance, lieu_naissance, niveau, classe_id,
  regime_financier, cantine, transport_bus, statut, date_admission, parent1, parent2, whatsapp_principal, annee_scolaire, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_tenant, 'MS-2026-001', 'DIOP',    'Awa',        '2021-04-10', 'Dakar',      'MS', cls_ms, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"DIOP","prenom":"Pape Demba","tel":"+221771020001","whatsapp":"+221771020001","profession":"Directeur commercial"}'::jsonb, '{"nom":"DIOP","prenom":"Ndèye","tel":"+221772020001","profession":"Fonctionnaire"}'::jsonb, '+221771020001', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'MS-2026-002', 'DIALLO',  'Seydou',     '2021-07-22', 'Dakar',      'MS', cls_ms, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"DIALLO","prenom":"Alpha","tel":"+221771020002","whatsapp":"+221771020002","profession":"Ingénieur"}'::jsonb, NULL, '+221771020002', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'MS-2026-003', 'SOW',     'Aissata',    '2021-01-15', 'Kaolack',    'MS', cls_ms, 'NORMAL', false, false, 'INSCRIT', '2025-09-04', '{"nom":"SOW","prenom":"Demba","tel":"+221771020003","whatsapp":"+221771020003","profession":"Agriculteur"}'::jsonb, NULL, '+221771020003', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'MS-2026-004', 'NDIAYE',  'Rokhaya',    '2021-09-08', 'Dakar',      'MS', cls_ms, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"NDIAYE","prenom":"Youssoupha","tel":"+221771020004","whatsapp":"+221771020004","profession":"Médecin"}'::jsonb, '{"nom":"DIAGNE","prenom":"Sophie","tel":"+221772020004","profession":"Sage-femme"}'::jsonb, '+221771020004', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'MS-2026-005', 'FALL',    'Mamadou',    '2021-11-20', 'Dakar',      'MS', cls_ms, 'CAS_SOCIAL', false, false, 'INSCRIT', '2025-09-05', '{"nom":"FALL","prenom":"Serigne","tel":"+221771020005","whatsapp":"+221771020005","profession":"Pêcheur"}'::jsonb, NULL, '+221771020005', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'MS-2026-006', 'MBAYE',   'Lamine',     '2021-03-14', 'Dakar',      'MS', cls_ms, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"MBAYE","prenom":"Cheikh Ahmed","tel":"+221771020006","whatsapp":"+221771020006","profession":"Avocat"}'::jsonb, '{"nom":"MBAYE","prenom":"Khady","tel":"+221772020006","profession":"Professeure"}'::jsonb, '+221771020006', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'MS-2026-007', 'BA',      'Fatoumata',  '2021-06-28', 'Dakar',      'MS', cls_ms, 'NORMAL', true,  true,  'INSCRIT', '2025-09-03', '{"nom":"BA","prenom":"Thierno","tel":"+221771020007","whatsapp":"+221771020007","profession":"Journaliste"}'::jsonb, NULL, '+221771020007', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'MS-2026-008', 'CISSÉ',   'Aminata',    '2021-12-02', 'Dakar',      'MS', cls_ms, 'NORMAL', false, false, 'INSCRIT', '2025-09-02', '{"nom":"CISSÉ","prenom":"Mamadou L.","tel":"+221771020008","whatsapp":"+221771020008","profession":"Comptable"}'::jsonb, NULL, '+221771020008', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'MS-2026-009', 'SARR',    'Mouhamed',   '2021-08-17', 'Saint-Louis','MS', cls_ms, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"SARR","prenom":"Pathé","tel":"+221771020009","whatsapp":"+221771020009","profession":"Enseignant"}'::jsonb, '{"nom":"SARR","prenom":"Bineta","tel":"+221772020009","profession":"Secrétaire"}'::jsonb, '+221771020009', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'MS-2026-010', 'DIAGNE',  'Yacine',     '2021-05-05', 'Dakar',      'MS', cls_ms, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"DIAGNE","prenom":"Moustapha","tel":"+221771020010","whatsapp":"+221771020010","profession":"Pharmacien"}'::jsonb, NULL, '+221771020010', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'MS-2026-011', 'TOURÉ',   'Ibrahima',   '2021-10-10', 'Ziguinchor', 'MS', cls_ms, 'CAS_SOCIAL', false, false, 'INSCRIT', '2025-09-06', '{"nom":"TOURÉ","prenom":"Mamadou","tel":"+221771020011","whatsapp":"+221771020011","profession":"Artisan"}'::jsonb, NULL, '+221771020011', '2025-2026', NOW(), NOW());

-- ── MS Inclusion/Handicap (4 élèves) ─────────────────────────
INSERT INTO eleves (id, tenant_id, matricule, nom, prenom, date_naissance, lieu_naissance, niveau, classe_id,
  regime_financier, cantine, transport_bus, statut, date_admission, parent1, besoin_specifique, whatsapp_principal, annee_scolaire, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_tenant, 'INC-2026-001', 'DIOP',   'Samba',      '2019-03-12', 'Dakar', 'MS', cls_ms_hand, 'CAS_SOCIAL', true, true,  'INSCRIT', '2025-09-02', '{"nom":"DIOP","prenom":"Amadou","tel":"+221771030001","whatsapp":"+221771030001","profession":"Enseignant"}'::jsonb, 'Retard développemental modéré — suivi orthophonie', '+221771030001', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'INC-2026-002', 'FALL',   'Aïda',       '2018-11-08', 'Dakar', 'MS', cls_ms_hand, 'CAS_SOCIAL', true, false, 'INSCRIT', '2025-09-03', '{"nom":"FALL","prenom":"Ibou","tel":"+221771030002","whatsapp":"+221771030002","profession":"Mécanicien"}'::jsonb, 'Trouble du spectre autistique (TSA) léger', '+221771030002', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'INC-2026-003', 'NDIAYE', 'Omar',       '2019-07-25', 'Dakar', 'MS', cls_ms_hand, 'NORMAL',     false, false, 'INSCRIT', '2025-09-02', '{"nom":"NDIAYE","prenom":"Lamine","tel":"+221771030003","whatsapp":"+221771030003","profession":"Ingénieur"}'::jsonb, 'Trisomie 21 — intégration scolaire', '+221771030003', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'INC-2026-004', 'BA',     'Dieynaba',   '2019-05-14', 'Thiès', 'MS', cls_ms_hand, 'NORMAL',     true, true,  'INSCRIT', '2025-09-04', '{"nom":"BA","prenom":"Seydou","tel":"+221771030004","whatsapp":"+221771030004","profession":"Entrepreneur"}'::jsonb, 'Déficience auditive — appareillée', '+221771030004', '2025-2026', NOW(), NOW());

-- ── GS (13 élèves) ────────────────────────────────────────────
INSERT INTO eleves (id, tenant_id, matricule, nom, prenom, date_naissance, lieu_naissance, niveau, classe_id,
  regime_financier, cantine, transport_bus, statut, date_admission, parent1, parent2, whatsapp_principal, annee_scolaire, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_tenant, 'GS-2026-001', 'DIOP',    'Marème',      '2020-02-14', 'Dakar',      'GS', cls_gs, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"DIOP","prenom":"Pape Alé","tel":"+221771040001","whatsapp":"+221771040001","profession":"Consultant"}'::jsonb, '{"nom":"DIOP","prenom":"Ndèye Coumba","tel":"+221772040001","profession":"Professeure"}'::jsonb, '+221771040001', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-002', 'SOW',     'Abdoul',      '2020-06-10', 'Dakar',      'GS', cls_gs, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"SOW","prenom":"Pape Malick","tel":"+221771040002","whatsapp":"+221771040002","profession":"Militaire"}'::jsonb, NULL, '+221771040002', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-003', 'NDIAYE',  'Anta',        '2020-09-05', 'Dakar',      'GS', cls_gs, 'NORMAL', false, false, 'INSCRIT', '2025-09-03', '{"nom":"NDIAYE","prenom":"Baye","tel":"+221771040003","whatsapp":"+221771040003","profession":"Médecin"}'::jsonb, '{"nom":"NDIAYE","prenom":"Dieynaba","tel":"+221772040003","profession":"Infirmière"}'::jsonb, '+221771040003', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-004', 'FALL',    'Cheikh Tidiane','2020-11-18','Saint-Louis','GS', cls_gs, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"FALL","prenom":"Modou","tel":"+221771040004","whatsapp":"+221771040004","profession":"Architecte"}'::jsonb, NULL, '+221771040004', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-005', 'DIALLO',  'Kadiatou',    '2020-04-22', 'Dakar',      'GS', cls_gs, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"DIALLO","prenom":"Boubacar","tel":"+221771040005","whatsapp":"+221771040005","profession":"Directeur RH"}'::jsonb, '{"nom":"DIALLO","prenom":"Mariama","tel":"+221772040005","profession":"Juriste"}'::jsonb, '+221771040005', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-006', 'BA',      'Mamadou',     '2020-08-30', 'Dakar',      'GS', cls_gs, 'CAS_SOCIAL', false, false, 'INSCRIT', '2025-09-05', '{"nom":"BA","prenom":"Abdoul","tel":"+221771040006","whatsapp":"+221771040006","profession":"Réparateur"}'::jsonb, NULL, '+221771040006', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-007', 'MBAYE',   'Khadija',     '2020-01-07', 'Dakar',      'GS', cls_gs, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"MBAYE","prenom":"Ibrahima","tel":"+221771040007","whatsapp":"+221771040007","profession":"Banquier"}'::jsonb, '{"nom":"MBAYE","prenom":"Khady","tel":"+221772040007","profession":"Sage-femme"}'::jsonb, '+221771040007', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-008', 'CISSÉ',   'Binta',       '2020-07-16', 'Kolda',      'GS', cls_gs, 'NORMAL', true,  false, 'INSCRIT', '2025-09-03', '{"nom":"CISSÉ","prenom":"Samba","tel":"+221771040008","whatsapp":"+221771040008","profession":"Entrepreneur"}'::jsonb, NULL, '+221771040008', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-009', 'SARR',    'Alassane',    '2020-03-25', 'Dakar',      'GS', cls_gs, 'NORMAL', false, false, 'INSCRIT', '2025-09-02', '{"nom":"SARR","prenom":"Pape Oumar","tel":"+221771040009","whatsapp":"+221771040009","profession":"Policier"}'::jsonb, '{"nom":"SARR","prenom":"Awa","tel":"+221772040009","profession":"Secrétaire"}'::jsonb, '+221771040009', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-010', 'DIOUF',   'Fatou',       '2020-10-12', 'Dakar',      'GS', cls_gs, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"DIOUF","prenom":"Biram","tel":"+221771040010","whatsapp":"+221771040010","profession":"Vétérinaire"}'::jsonb, NULL, '+221771040010', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-011', 'TOURÉ',   'Oumou',       '2020-05-19', 'Dakar',      'GS', cls_gs, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"TOURÉ","prenom":"El Hadji","tel":"+221771040011","whatsapp":"+221771040011","profession":"Directeur école"}'::jsonb, '{"nom":"TOURÉ","prenom":"Dieynaba","tel":"+221772040011","profession":"Institutrice"}'::jsonb, '+221771040011', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-012', 'DIAGNE',  'Mouhamed',    '2020-12-28', 'Dakar',      'GS', cls_gs, 'NORMAL', false, true,  'INSCRIT', '2025-09-04', '{"nom":"DIAGNE","prenom":"Moussa","tel":"+221771040012","whatsapp":"+221771040012","profession":"Pharmacien"}'::jsonb, NULL, '+221771040012', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'GS-2026-013', 'NIANG',   'Khadija',     '2020-02-03', 'Dakar',      'GS', cls_gs, 'CAS_SOCIAL', true, false, 'INSCRIT', '2025-09-06', '{"nom":"NIANG","prenom":"Moussa","tel":"+221771040013","whatsapp":"+221771040013","profession":"Menuisier"}'::jsonb, NULL, '+221771040013', '2025-2026', NOW(), NOW());

-- ── CP (12 élèves — dont les 2 existants conservés) ───────────
-- Elèves existants en CP : a7734865 (Naffisatou SALL GS->CP?) et 10b64fd2 (Nafissatou DIALLO CP)
-- On ajoute de nouveaux
INSERT INTO eleves (id, tenant_id, matricule, nom, prenom, date_naissance, lieu_naissance, niveau, classe_id,
  regime_financier, cantine, transport_bus, statut, date_admission, parent1, parent2, whatsapp_principal, annee_scolaire, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_tenant, 'CP-2026-001', 'DIOP',    'Cheikh',      '2019-05-14', 'Dakar',      'CP', cls_cp, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"DIOP","prenom":"Mansour","tel":"+221771050001","whatsapp":"+221771050001","profession":"Directeur IT"}'::jsonb, '{"nom":"DIOP","prenom":"Aminata","tel":"+221772050001","profession":"Professeure"}'::jsonb, '+221771050001', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CP-2026-002', 'NDIAYE',  'Mariama',     '2019-08-20', 'Dakar',      'CP', cls_cp, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"NDIAYE","prenom":"Bamba","tel":"+221771050002","whatsapp":"+221771050002","profession":"Avocat"}'::jsonb, NULL, '+221771050002', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CP-2026-003', 'FALL',    'Ibou',        '2019-02-11', 'Saint-Louis','CP', cls_cp, 'NORMAL', false, false, 'INSCRIT', '2025-09-03', '{"nom":"FALL","prenom":"El Hadji","tel":"+221771050003","whatsapp":"+221771050003","profession":"Enseignant"}'::jsonb, '{"nom":"FALL","prenom":"Aissatou","tel":"+221772050003","profession":"Sage-femme"}'::jsonb, '+221771050003', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CP-2026-004', 'SOW',     'Fatoumata',   '2019-11-07', 'Dakar',      'CP', cls_cp, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"SOW","prenom":"Oumar","tel":"+221771050004","whatsapp":"+221771050004","profession":"Militaire"}'::jsonb, NULL, '+221771050004', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CP-2026-005', 'DIALLO',  'Mamadou',     '2019-04-29', 'Dakar',      'CP', cls_cp, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"DIALLO","prenom":"Seydou","tel":"+221771050005","whatsapp":"+221771050005","profession":"Entrepreneur"}'::jsonb, '{"nom":"DIALLO","prenom":"Marième","tel":"+221772050005","profession":"Secrétaire"}'::jsonb, '+221771050005', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CP-2026-006', 'MBAYE',   'Ndèye',       '2019-07-15', 'Dakar',      'CP', cls_cp, 'CAS_SOCIAL', false, false, 'INSCRIT', '2025-09-05', '{"nom":"MBAYE","prenom":"Serigne Ahmadou","tel":"+221771050006","whatsapp":"+221771050006","profession":"Berger"}'::jsonb, NULL, '+221771050006', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CP-2026-007', 'BA',      'Boubacar',    '2019-03-03', 'Kolda',      'CP', cls_cp, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"BA","prenom":"Mamadou Lamine","tel":"+221771050007","whatsapp":"+221771050007","profession":"Médecin"}'::jsonb, NULL, '+221771050007', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CP-2026-008', 'SARR',    'Adja',        '2019-09-24', 'Dakar',      'CP', cls_cp, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"SARR","prenom":"Malick","tel":"+221771050008","whatsapp":"+221771050008","profession":"Comptable"}'::jsonb, '{"nom":"SARR","prenom":"Khadija","tel":"+221772050008","profession":"Institutrice"}'::jsonb, '+221771050008', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CP-2026-009', 'CISSÉ',   'Abdoulaye',   '2019-01-18', 'Dakar',      'CP', cls_cp, 'NORMAL', false, false, 'INSCRIT', '2025-09-03', '{"nom":"CISSÉ","prenom":"Ibrahima","tel":"+221771050009","whatsapp":"+221771050009","profession":"Ingénieur civil"}'::jsonb, NULL, '+221771050009', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CP-2026-010', 'TOURÉ',   'Hawa',        '2019-06-06', 'Thiès',      'CP', cls_cp, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"TOURÉ","prenom":"Lamine","tel":"+221771050010","whatsapp":"+221771050010","profession":"Policier"}'::jsonb, '{"nom":"TOURÉ","prenom":"Awa","tel":"+221772050010","profession":"Pharmacienne"}'::jsonb, '+221771050010', '2025-2026', NOW(), NOW());

-- Mise à jour des 2 élèves existants avec leur classe
UPDATE eleves SET classe_id = cls_cp, annee_scolaire = '2025-2026' WHERE id = '10b64fd2-c2a4-4b1e-990d-a217a1b7e7f4';
UPDATE eleves SET classe_id = cls_gs, niveau = 'GS', annee_scolaire = '2025-2026', matricule = 'GS-2026-014' WHERE id = 'a7734865-241d-4c75-b26c-2cbfbb4ced79';

-- ── CE1 (10 élèves) ───────────────────────────────────────────
INSERT INTO eleves (id, tenant_id, matricule, nom, prenom, date_naissance, lieu_naissance, niveau, classe_id,
  regime_financier, cantine, transport_bus, statut, date_admission, parent1, parent2, whatsapp_principal, annee_scolaire, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_tenant, 'CE1-2026-001', 'DIOP',   'Alassane',    '2018-05-12', 'Dakar',      'CE1', cls_ce1, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"DIOP","prenom":"Pape Samba","tel":"+221771060001","whatsapp":"+221771060001","profession":"Directeur commercial"}'::jsonb, NULL, '+221771060001', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE1-2026-002', 'NDIAYE', 'Ndèye Fatou', '2018-09-03', 'Dakar',      'CE1', cls_ce1, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"NDIAYE","prenom":"Cheikh","tel":"+221771060002","whatsapp":"+221771060002","profession":"Avocat"}'::jsonb, '{"nom":"NDIAYE","prenom":"Dieynaba","tel":"+221772060002","profession":"Juriste"}'::jsonb, '+221771060002', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE1-2026-003', 'FALL',   'Khalil',      '2018-01-27', 'Dakar',      'CE1', cls_ce1, 'NORMAL', false, false, 'INSCRIT', '2025-09-03', '{"nom":"FALL","prenom":"Saliou","tel":"+221771060003","whatsapp":"+221771060003","profession":"Banquier"}'::jsonb, NULL, '+221771060003', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE1-2026-004', 'SOW',    'Khady',       '2018-07-14', 'Kaolack',    'CE1', cls_ce1, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"SOW","prenom":"Amadou","tel":"+221771060004","whatsapp":"+221771060004","profession":"Ingénieur"}'::jsonb, '{"nom":"SOW","prenom":"Fatou","tel":"+221772060004","profession":"Secrétaire"}'::jsonb, '+221771060004', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE1-2026-005', 'MBAYE',  'Serigne',     '2018-03-20', 'Dakar',      'CE1', cls_ce1, 'CAS_SOCIAL', true, false, 'INSCRIT', '2025-09-05', '{"nom":"MBAYE","prenom":"Ousmane","tel":"+221771060005","whatsapp":"+221771060005","profession":"Électricien"}'::jsonb, NULL, '+221771060005', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE1-2026-006', 'DIALLO', 'Adja',        '2018-11-08', 'Dakar',      'CE1', cls_ce1, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"DIALLO","prenom":"Mamadou","tel":"+221771060006","whatsapp":"+221771060006","profession":"Médecin"}'::jsonb, NULL, '+221771060006', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE1-2026-007', 'BA',     'Mariama',     '2018-06-25', 'Thiès',      'CE1', cls_ce1, 'NORMAL', false, false, 'INSCRIT', '2025-09-03', '{"nom":"BA","prenom":"Ibrahima","tel":"+221771060007","whatsapp":"+221771060007","profession":"Enseignant"}'::jsonb, '{"nom":"BA","prenom":"Aissatou","tel":"+221772060007","profession":"Aide-soignante"}'::jsonb, '+221771060007', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE1-2026-008', 'SARR',   'Baye',        '2018-02-17', 'Dakar',      'CE1', cls_ce1, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"SARR","prenom":"Modou","tel":"+221771060008","whatsapp":"+221771060008","profession":"Pharmacien"}'::jsonb, NULL, '+221771060008', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE1-2026-009', 'CISSÉ',  'Oumou',       '2018-08-09', 'Dakar',      'CE1', cls_ce1, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"CISSÉ","prenom":"Pape","tel":"+221771060009","whatsapp":"+221771060009","profession":"Informaticien"}'::jsonb, '{"nom":"CISSÉ","prenom":"Ndèye","tel":"+221772060009","profession":"Comptable"}'::jsonb, '+221771060009', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE1-2026-010', 'DIOUF',  'Awa',         '2018-04-30', 'Dakar',      'CE1', cls_ce1, 'NORMAL', false, false, 'INSCRIT', '2025-09-04', '{"nom":"DIOUF","prenom":"Abdoulaye","tel":"+221771060010","whatsapp":"+221771060010","profession":"Consultant"}'::jsonb, NULL, '+221771060010', '2025-2026', NOW(), NOW());

-- ── CE2 (10 élèves) ───────────────────────────────────────────
INSERT INTO eleves (id, tenant_id, matricule, nom, prenom, date_naissance, lieu_naissance, niveau, classe_id,
  regime_financier, cantine, transport_bus, statut, date_admission, parent1, parent2, whatsapp_principal, annee_scolaire, created_at, updated_at)
VALUES
  (gen_random_uuid(), v_tenant, 'CE2-2026-001', 'DIOP',   'Pape Ibou',   '2017-03-22', 'Dakar',      'CE2', cls_ce2, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"DIOP","prenom":"Moustapha","tel":"+221771070001","whatsapp":"+221771070001","profession":"Architecte"}'::jsonb, '{"nom":"DIOP","prenom":"Khady","tel":"+221772070001","profession":"Professeure"}'::jsonb, '+221771070001', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE2-2026-002', 'NDIAYE', 'Sokhna',      '2017-07-18', 'Dakar',      'CE2', cls_ce2, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"NDIAYE","prenom":"Birane","tel":"+221771070002","whatsapp":"+221771070002","profession":"Médecin"}'::jsonb, NULL, '+221771070002', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE2-2026-003', 'FALL',   'Aïssatou',    '2017-11-04', 'Saint-Louis','CE2', cls_ce2, 'NORMAL', false, false, 'INSCRIT', '2025-09-03', '{"nom":"FALL","prenom":"Samba Laobé","tel":"+221771070003","whatsapp":"+221771070003","profession":"Entrepreneur"}'::jsonb, '{"nom":"FALL","prenom":"Awa","tel":"+221772070003","profession":"Secrétaire"}'::jsonb, '+221771070003', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE2-2026-004', 'SOW',    'Ibrahima',    '2017-05-28', 'Dakar',      'CE2', cls_ce2, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"SOW","prenom":"El Hadji","tel":"+221771070004","whatsapp":"+221771070004","profession":"Militaire"}'::jsonb, NULL, '+221771070004', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE2-2026-005', 'DIALLO', 'Khadija',     '2017-09-13', 'Dakar',      'CE2', cls_ce2, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"DIALLO","prenom":"Mamadou Lamine","tel":"+221771070005","whatsapp":"+221771070005","profession":"Banquier"}'::jsonb, '{"nom":"DIALLO","prenom":"Djenaba","tel":"+221772070005","profession":"Sage-femme"}'::jsonb, '+221771070005', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE2-2026-006', 'MBAYE',  'Mouhamed',    '2017-01-30', 'Dakar',      'CE2', cls_ce2, 'CAS_SOCIAL', false, false, 'INSCRIT', '2025-09-06', '{"nom":"MBAYE","prenom":"Serigne Modou","tel":"+221771070006","whatsapp":"+221771070006","profession":"Gardien"}'::jsonb, NULL, '+221771070006', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE2-2026-007', 'BA',     'Fatima',      '2017-06-07', 'Dakar',      'CE2', cls_ce2, 'NORMAL', true,  true,  'INSCRIT', '2025-09-02', '{"nom":"BA","prenom":"Thierno Amadou","tel":"+221771070007","whatsapp":"+221771070007","profession":"Vétérinaire"}'::jsonb, NULL, '+221771070007', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE2-2026-008', 'SARR',   'Lamine',      '2017-10-25', 'Dakar',      'CE2', cls_ce2, 'NORMAL', true,  false, 'INSCRIT', '2025-09-02', '{"nom":"SARR","prenom":"Mamadou","tel":"+221771070008","whatsapp":"+221771070008","profession":"Douanier"}'::jsonb, '{"nom":"SARR","prenom":"Bineta","tel":"+221772070008","profession":"Comptable"}'::jsonb, '+221771070008', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE2-2026-009', 'CISSÉ',  'Alioune',     '2017-04-14', 'Thiès',      'CE2', cls_ce2, 'NORMAL', false, false, 'INSCRIT', '2025-09-04', '{"nom":"CISSÉ","prenom":"Pape Malick","tel":"+221771070009","whatsapp":"+221771070009","profession":"Policier"}'::jsonb, NULL, '+221771070009', '2025-2026', NOW(), NOW()),
  (gen_random_uuid(), v_tenant, 'CE2-2026-010', 'TOURÉ',  'Fatoumata',   '2017-08-03', 'Dakar',      'CE2', cls_ce2, 'NORMAL', true,  true,  'INSCRIT', '2025-09-03', '{"nom":"TOURÉ","prenom":"Seydou","tel":"+221771070010","whatsapp":"+221771070010","profession":"Ingénieur"}'::jsonb, '{"nom":"TOURÉ","prenom":"Maguette","tel":"+221772070010","profession":"Professeure"}'::jsonb, '+221771070010', '2025-2026', NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════
-- 7. EMPLOIS DU TEMPS — creneaux_horaires (2025-2026)
--    jour: 0=Lun, 1=Mar, 2=Mer, 3=Jeu, 4=Ven
-- ═══════════════════════════════════════════════════════════════

-- Vider les anciens créneaux de ce tenant
DELETE FROM creneaux_horaires WHERE tenant_id = v_tenant;

-- ── CRÈCHE ────────────────────────────────────────────────────
INSERT INTO creneaux_horaires (tenant_id, classe_id, enseignant_id, jour, heure_debut, heure_fin, matiere, couleur, annee_scolaire)
SELECT v_tenant, cls_creche, emp_creche_a, j, deb, fin, mat, coul, '2025-2026'
FROM (VALUES
  (0,'08:00','09:30','Accueil & Éveil','purple'),
  (0,'09:30','10:30','Activités Motrices','green'),
  (0,'10:30','11:30','Sieste','blue'),
  (0,'14:00','15:30','Jeux Libres / Éveil Sensoriel','orange'),
  (1,'08:00','09:30','Accueil & Éveil','purple'),
  (1,'09:30','10:30','Musique & Rythme','pink'),
  (1,'10:30','11:30','Sieste','blue'),
  (1,'14:00','15:30','Atelier Arts Plastiques','orange'),
  (2,'08:00','09:30','Accueil & Éveil','purple'),
  (2,'09:30','10:30','Activités Motrices','green'),
  (2,'10:30','11:30','Sieste','blue'),
  (2,'14:00','15:30','Lecture d''Images / Langage','yellow'),
  (3,'08:00','09:30','Accueil & Éveil','purple'),
  (3,'09:30','10:30','Éveil Cognitif','indigo'),
  (3,'10:30','11:30','Sieste','blue'),
  (3,'14:00','15:30','Jeux Éducatifs','orange'),
  (4,'08:00','09:30','Accueil & Éveil','purple'),
  (4,'09:30','10:30','Musique & Rythme','pink'),
  (4,'10:30','11:30','Sieste','blue'),
  (4,'14:00','15:00','Activités Libres','green')
) AS t(j, deb, fin, mat, coul);

-- ── PS ────────────────────────────────────────────────────────
INSERT INTO creneaux_horaires (tenant_id, classe_id, enseignant_id, jour, heure_debut, heure_fin, matiere, couleur, annee_scolaire)
SELECT v_tenant, cls_ps, emp_ps_a, j, deb, fin, mat, coul, '2025-2026'
FROM (VALUES
  (0,'08:00','09:00','Accueil & Appel','purple'),
  (0,'09:00','10:00','Langage Oral','blue'),
  (0,'10:00','10:30','Récréation','green'),
  (0,'10:30','11:30','Graphisme / Dessin','orange'),
  (0,'14:00','15:00','Éducation Physique','green'),
  (0,'15:00','16:00','Lecture d''Images','yellow'),
  (1,'08:00','09:00','Accueil & Appel','purple'),
  (1,'09:00','10:00','Mathématiques (Formes)','blue'),
  (1,'10:00','10:30','Récréation','green'),
  (1,'10:30','11:30','Musique & Chant','pink'),
  (1,'14:00','15:00','Découverte du Monde','orange'),
  (1,'15:00','16:00','Atelier Créatif','yellow'),
  (2,'08:00','09:00','Accueil & Appel','purple'),
  (2,'09:00','10:00','Langage Oral','blue'),
  (2,'10:00','10:30','Récréation','green'),
  (2,'10:30','11:30','Graphisme / Peinture','orange'),
  (3,'08:00','09:00','Accueil & Appel','purple'),
  (3,'09:00','10:00','Numération (1-10)','blue'),
  (3,'10:00','10:30','Récréation','green'),
  (3,'10:30','11:30','Éducation Physique','green'),
  (3,'14:00','15:00','Conte & Imaginaire','pink'),
  (3,'15:00','16:00','Jeux Éducatifs','yellow'),
  (4,'08:00','09:00','Accueil & Appel','purple'),
  (4,'09:00','10:00','Langage Oral','blue'),
  (4,'10:00','10:30','Récréation','green'),
  (4,'10:30','11:30','Arts Plastiques','orange')
) AS t(j, deb, fin, mat, coul);

-- ── MS ────────────────────────────────────────────────────────
INSERT INTO creneaux_horaires (tenant_id, classe_id, enseignant_id, jour, heure_debut, heure_fin, matiere, couleur, annee_scolaire)
SELECT v_tenant, cls_ms, emp_ms_a, j, deb, fin, mat, coul, '2025-2026'
FROM (VALUES
  (0,'08:00','09:00','Accueil & Appel','purple'),
  (0,'09:00','10:00','Langage & Communication','blue'),
  (0,'10:00','10:30','Récréation','green'),
  (0,'10:30','11:30','Écriture (Lettres)','orange'),
  (0,'14:00','15:00','Mathématiques','indigo'),
  (0,'15:00','16:00','Découverte du Monde','teal'),
  (1,'08:00','09:00','Accueil & Appel','purple'),
  (1,'09:00','10:00','Langage & Communication','blue'),
  (1,'10:00','10:30','Récréation','green'),
  (1,'10:30','11:30','Numération (1-20)','indigo'),
  (1,'14:00','15:00','Musique & Chant','pink'),
  (1,'15:00','16:00','Éducation Physique','green'),
  (2,'08:00','09:00','Accueil & Appel','purple'),
  (2,'09:00','10:00','Pré-Lecture','blue'),
  (2,'10:00','10:30','Récréation','green'),
  (2,'10:30','11:30','Arts Plastiques','orange'),
  (3,'08:00','09:00','Accueil & Appel','purple'),
  (3,'09:00','10:00','Langage & Communication','blue'),
  (3,'10:00','10:30','Récréation','green'),
  (3,'10:30','11:30','Mathématiques','indigo'),
  (3,'14:00','15:00','Éducation Physique','green'),
  (3,'15:00','16:00','Jeux de Logique','yellow'),
  (4,'08:00','09:00','Accueil & Appel','purple'),
  (4,'09:00','10:00','Pré-Lecture','blue'),
  (4,'10:00','10:30','Récréation','green'),
  (4,'10:30','11:30','Écriture (Lettres)','orange')
) AS t(j, deb, fin, mat, coul);

-- ── GS ────────────────────────────────────────────────────────
INSERT INTO creneaux_horaires (tenant_id, classe_id, enseignant_id, jour, heure_debut, heure_fin, matiere, couleur, annee_scolaire)
SELECT v_tenant, cls_gs, emp_gs_a, j, deb, fin, mat, coul, '2025-2026'
FROM (VALUES
  (0,'08:00','09:00','Accueil & Appel','purple'),
  (0,'09:00','10:00','Français (Lecture)','blue'),
  (0,'10:00','10:30','Récréation','green'),
  (0,'10:30','11:30','Mathématiques','indigo'),
  (0,'14:00','15:00','Éveil Scientifique','teal'),
  (0,'15:00','16:00','Écriture','orange'),
  (1,'08:00','09:00','Accueil & Appel','purple'),
  (1,'09:00','10:00','Français (Lecture)','blue'),
  (1,'10:00','10:30','Récréation','green'),
  (1,'10:30','11:30','Numération (1-100)','indigo'),
  (1,'14:00','15:00','Musique','pink'),
  (1,'15:00','16:00','Éducation Physique','green'),
  (2,'08:00','09:00','Accueil & Appel','purple'),
  (2,'09:00','10:00','Français (Graphisme)','blue'),
  (2,'10:00','10:30','Récréation','green'),
  (2,'10:30','11:30','Mathématiques','indigo'),
  (3,'08:00','09:00','Accueil & Appel','purple'),
  (3,'09:00','10:00','Français (Lecture)','blue'),
  (3,'10:00','10:30','Récréation','green'),
  (3,'10:30','11:30','Éducation Civique','yellow'),
  (3,'14:00','15:00','Éducation Physique','green'),
  (3,'15:00','16:00','Arts Plastiques','orange'),
  (4,'08:00','09:00','Accueil & Appel','purple'),
  (4,'09:00','10:00','Français (Oral)','blue'),
  (4,'10:00','10:30','Récréation','green'),
  (4,'10:30','11:30','Mathématiques','indigo')
) AS t(j, deb, fin, mat, coul);

-- ── CP ────────────────────────────────────────────────────────
INSERT INTO creneaux_horaires (tenant_id, classe_id, enseignant_id, jour, heure_debut, heure_fin, matiere, couleur, annee_scolaire)
SELECT v_tenant, cls_cp, emp_cp_a, j, deb, fin, mat, coul, '2025-2026'
FROM (VALUES
  (0,'08:00','09:00','Français (Lecture)','blue'),
  (0,'09:00','10:00','Mathématiques','indigo'),
  (0,'10:00','10:30','Récréation','green'),
  (0,'10:30','11:30','Écriture / Copie','orange'),
  (0,'14:00','15:00','Histoire-Géographie','teal'),
  (0,'15:00','16:00','Éducation Physique','green'),
  (1,'08:00','09:00','Français (Lecture)','blue'),
  (1,'09:00','10:00','Calcul Numérique','indigo'),
  (1,'10:00','10:30','Récréation','green'),
  (1,'10:30','11:30','Sciences de la Vie','teal'),
  (1,'14:00','15:00','Anglais','yellow'),
  (1,'15:00','16:00','Arts Plastiques','orange'),
  (2,'08:00','09:00','Français (Grammaire)','blue'),
  (2,'09:00','10:00','Mathématiques','indigo'),
  (2,'10:00','10:30','Récréation','green'),
  (2,'10:30','11:30','Écriture / Copie','orange'),
  (3,'08:00','09:00','Français (Lecture)','blue'),
  (3,'09:00','10:00','Calcul Numérique','indigo'),
  (3,'10:00','10:30','Récréation','green'),
  (3,'10:30','11:30','Éducation Civique & Morale','yellow'),
  (3,'14:00','15:00','EPS','green'),
  (3,'15:00','16:00','Musique','pink'),
  (4,'08:00','09:00','Français (Oral)','blue'),
  (4,'09:00','10:00','Mathématiques','indigo'),
  (4,'10:00','10:30','Récréation','green'),
  (4,'10:30','11:30','Travaux Manuels','orange')
) AS t(j, deb, fin, mat, coul);

-- ── CE1 ───────────────────────────────────────────────────────
INSERT INTO creneaux_horaires (tenant_id, classe_id, enseignant_id, jour, heure_debut, heure_fin, matiere, couleur, annee_scolaire)
SELECT v_tenant, cls_ce1, emp_ce1_a, j, deb, fin, mat, coul, '2025-2026'
FROM (VALUES
  (0,'08:00','09:00','Français','blue'),
  (0,'09:00','10:00','Mathématiques','indigo'),
  (0,'10:00','10:30','Récréation','green'),
  (0,'10:30','11:30','Écriture / Dictée','orange'),
  (0,'14:00','15:00','Sciences','teal'),
  (0,'15:00','16:00','Éducation Civique','yellow'),
  (1,'08:00','09:00','Français','blue'),
  (1,'09:00','10:00','Mathématiques','indigo'),
  (1,'10:00','10:30','Récréation','green'),
  (1,'10:30','11:30','Histoire-Géo','teal'),
  (1,'14:00','15:00','Anglais','yellow'),
  (1,'15:00','16:00','EPS','green'),
  (2,'08:00','09:00','Français','blue'),
  (2,'09:00','10:00','Mathématiques','indigo'),
  (2,'10:00','10:30','Récréation','green'),
  (2,'10:30','11:30','Sciences','teal'),
  (3,'08:00','09:00','Français','blue'),
  (3,'09:00','10:00','Mathématiques','indigo'),
  (3,'10:00','10:30','Récréation','green'),
  (3,'10:30','11:30','Arts Plastiques','orange'),
  (3,'14:00','15:00','EPS','green'),
  (3,'15:00','16:00','Musique','pink'),
  (4,'08:00','09:00','Français','blue'),
  (4,'09:00','10:00','Mathématiques','indigo'),
  (4,'10:00','10:30','Récréation','green'),
  (4,'10:30','11:30','Écriture / Dictée','orange')
) AS t(j, deb, fin, mat, coul);

-- ── CE2 ───────────────────────────────────────────────────────
INSERT INTO creneaux_horaires (tenant_id, classe_id, enseignant_id, jour, heure_debut, heure_fin, matiere, couleur, annee_scolaire)
SELECT v_tenant, cls_ce2, emp_ce2_a, j, deb, fin, mat, coul, '2025-2026'
FROM (VALUES
  (0,'08:00','09:00','Français','blue'),
  (0,'09:00','10:00','Mathématiques','indigo'),
  (0,'10:00','10:30','Récréation','green'),
  (0,'10:30','11:30','Écriture / Dictée','orange'),
  (0,'14:00','15:00','Sciences de la Vie','teal'),
  (0,'15:00','16:00','Histoire-Géo','teal'),
  (1,'08:00','09:00','Français','blue'),
  (1,'09:00','10:00','Mathématiques','indigo'),
  (1,'10:00','10:30','Récréation','green'),
  (1,'10:30','11:30','Éducation Civique','yellow'),
  (1,'14:00','15:00','Anglais','yellow'),
  (1,'15:00','16:00','EPS','green'),
  (2,'08:00','09:00','Français','blue'),
  (2,'09:00','10:00','Mathématiques','indigo'),
  (2,'10:00','10:30','Récréation','green'),
  (2,'10:30','11:30','Sciences','teal'),
  (3,'08:00','09:00','Français','blue'),
  (3,'09:00','10:00','Mathématiques','indigo'),
  (3,'10:00','10:30','Récréation','green'),
  (3,'10:30','11:30','Arts Plastiques','orange'),
  (3,'14:00','15:00','EPS','green'),
  (3,'15:00','16:00','Musique','pink'),
  (4,'08:00','09:00','Français','blue'),
  (4,'09:00','10:00','Mathématiques','indigo'),
  (4,'10:00','10:30','Récréation','green'),
  (4,'10:30','11:30','Écriture / Dictée','orange')
) AS t(j, deb, fin, mat, coul);

-- ═══════════════════════════════════════════════════════════════
-- 8. CALENDRIER SCOLAIRE — Jours fériés & Vacances 2025-2026
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS school_events (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titre          VARCHAR(255) NOT NULL,
  description    TEXT,
  type           VARCHAR(20)  NOT NULL DEFAULT 'INFO',  -- FERIE, VACANCES, RENTREE, EXAMEN, SORTIE, REUNION, FETE
  date_debut     DATE         NOT NULL,
  date_fin       DATE,
  niveaux_cibles TEXT[]       DEFAULT ARRAY['TOUS'],
  statut         VARCHAR(20)  DEFAULT 'PUBLIE',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_events_tenant_date ON school_events(tenant_id, date_debut);

DELETE FROM school_events WHERE tenant_id = v_tenant;

INSERT INTO school_events (tenant_id, titre, description, type, date_debut, date_fin, niveaux_cibles, statut)
VALUES
  -- Jours fériés nationaux sénégalais
  (v_tenant, 'Gamou (Mawlid)',           'Naissance du Prophète Muhammad',        'FERIE',   '2025-09-04', '2025-09-04', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Magal de Touba',           'Grand Magal de Touba',                  'FERIE',   '2025-10-16', '2025-10-16', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Journée des Femmes',       'Fête internationale des femmes',        'FERIE',   '2026-03-08', '2026-03-08', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Laylat al-Qadr (Korité)', 'Fin du Ramadan',                        'FERIE',   '2026-03-30', '2026-03-31', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Journée de l''Indépendance','Fête nationale du Sénégal — 4 avril', 'FERIE',   '2026-04-04', '2026-04-04', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Fête du Travail',          'Journée internationale du travail',     'FERIE',   '2026-05-01', '2026-05-01', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Ascension',                'Fête chrétienne de l''Ascension',       'FERIE',   '2026-05-14', '2026-05-14', ARRAY['TOUS'], 'PUBLIE'),
  -- Vacances scolaires
  (v_tenant, 'Vacances Toussaint',       'Vacances de la Toussaint',              'VACANCES','2025-11-01', '2025-11-09', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Vacances de Noël',         'Vacances de fin d''année',              'VACANCES','2025-12-20', '2026-01-04', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Vacances Mi-Année',        'Coupure de mi-année',                   'VACANCES','2026-02-21', '2026-03-01', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Vacances de Pâques',       'Vacances de printemps',                 'VACANCES','2026-04-11', '2026-04-26', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Grandes Vacances',         'Fin d''année scolaire 2025-2026',       'VACANCES','2026-07-04', '2026-08-31', ARRAY['TOUS'], 'PUBLIE'),
  -- Rentrées & jalons pédagogiques
  (v_tenant, 'Rentrée scolaire 2025-2026','Début de l''année scolaire',           'RENTREE', '2025-09-02', '2025-09-02', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Fin T1 — Conseils de classe','Clôture du 1er trimestre',            'EXAMEN',  '2025-12-12', '2025-12-19', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Rentrée 2ème trimestre',   'Reprise après vacances de Noël',        'RENTREE', '2026-01-05', '2026-01-05', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Fin T2 — Conseils de classe','Clôture du 2ème trimestre',           'EXAMEN',  '2026-03-20', '2026-03-27', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Rentrée 3ème trimestre',   'Reprise après vacances de Pâques',      'RENTREE', '2026-04-27', '2026-04-27', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Compositions T3',          'Évaluations de fin d''année',           'EXAMEN',  '2026-06-15', '2026-06-30', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Fin d''année scolaire',    'Dernier jour de classe 2025-2026',      'RENTREE', '2026-07-03', '2026-07-03', ARRAY['TOUS'], 'PUBLIE'),
  -- Événements spéciaux
  (v_tenant, 'Journée Portes Ouvertes',  'Accueil des familles pour l''inscription 2026-2027', 'REUNION', '2026-05-23', '2026-05-23', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Fête de fin d''année',     'Spectacle et remise des bulletins T3',  'FETE',    '2026-07-02', '2026-07-02', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Réunion parents T1',       'Réunion parents-professeurs T1',        'REUNION', '2025-11-15', '2025-11-15', ARRAY['TOUS'], 'PUBLIE'),
  (v_tenant, 'Réunion parents T2',       'Réunion parents-professeurs T2',        'REUNION', '2026-02-14', '2026-02-14', ARRAY['TOUS'], 'PUBLIE');

RAISE NOTICE '✅ Seed Le Toit des Anges terminé avec succès.';
RAISE NOTICE '   - Départements : 6';
RAISE NOTICE '   - Employés : 15 (3 existants mis à jour + 12 nouveaux)';
RAISE NOTICE '   - Contrats : créés pour tous les employés actifs';
RAISE NOTICE '   - Comptes utilisateurs : 10 nouveaux';
RAISE NOTICE '   - Classes 2025-2026 : 8 (Crèche, PS, MS, MS-Handicap, GS, CP, CE1, CE2)';
RAISE NOTICE '   - Élèves : ~80 (8-13 par classe)';
RAISE NOTICE '   - Créneaux horaires : planning complet 5 jours × 8 classes';
RAISE NOTICE '   - Calendrier scolaire : jours fériés + vacances + rentrées';

END $$;
