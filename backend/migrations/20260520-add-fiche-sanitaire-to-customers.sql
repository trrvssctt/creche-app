-- Migration : ajout des champs fiche sanitaire, 2e parent et coordonnées supplémentaires
-- À exécuter UNE SEULE FOIS en base de données

ALTER TABLE public.customers
  -- Sexe
  ADD COLUMN IF NOT EXISTS sexe                     VARCHAR(1),

  -- Coordonnées supplémentaires parent 1
  ADD COLUMN IF NOT EXISTS parent1_tel_domicile     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS parent1_tel_travail      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS parent1_adresse          TEXT,

  -- Parent 2
  ADD COLUMN IF NOT EXISTS parent2_nom              VARCHAR(255),
  ADD COLUMN IF NOT EXISTS parent2_prenom           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS parent2_lien             VARCHAR(20),
  ADD COLUMN IF NOT EXISTS parent2_tel              VARCHAR(50),
  ADD COLUMN IF NOT EXISTS parent2_tel_domicile     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS parent2_tel_travail      VARCHAR(50),

  -- Vaccinations
  ADD COLUMN IF NOT EXISTS vacc_diphterie           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacc_diphterie_date      DATE,
  ADD COLUMN IF NOT EXISTS vacc_tetanos             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacc_tetanos_date        DATE,
  ADD COLUMN IF NOT EXISTS vacc_polio               BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacc_polio_date          DATE,
  ADD COLUMN IF NOT EXISTS vacc_coqueluche          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacc_coqueluche_date     DATE,
  ADD COLUMN IF NOT EXISTS vacc_bcg                 BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacc_bcg_date            DATE,
  ADD COLUMN IF NOT EXISTS vacc_hep_b               BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacc_hep_b_date          DATE,
  ADD COLUMN IF NOT EXISTS vacc_ror                 BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacc_ror_date            DATE,

  -- Traitement médical
  ADD COLUMN IF NOT EXISTS certif_contr_indication  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS traitement_medical       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS traitement_detail        TEXT,

  -- Antécédents maladies
  ADD COLUMN IF NOT EXISTS maladie_rubeole          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS maladie_varicelle        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS maladie_angine           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS maladie_rhumatisme       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS maladie_scarlatine       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS maladie_coqueluche       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS maladie_otite            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS maladie_rougeole         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS maladie_oreillons        BOOLEAN DEFAULT false,

  -- Allergies
  ADD COLUMN IF NOT EXISTS allergie_asthme          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergie_medicament      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergie_alimentaire     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergie_autres          TEXT,
  ADD COLUMN IF NOT EXISTS allergie_conduite        TEXT,
  ADD COLUMN IF NOT EXISTS difficulte_sante         TEXT,

  -- Équipements
  ADD COLUMN IF NOT EXISTS equipe_lunettes          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipe_lentilles         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipe_prothese_auditive BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipe_prothese_dentaire BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipe_precisions        TEXT,

  -- Divers sanitaire
  ADD COLUMN IF NOT EXISTS mouiller_lit             VARCHAR(20),
  ADD COLUMN IF NOT EXISTS medecin_nom              VARCHAR(255),
  ADD COLUMN IF NOT EXISTS medecin_tel              VARCHAR(50),
  ADD COLUMN IF NOT EXISTS autorisation_photo       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS autorisation_soins       BOOLEAN DEFAULT true;
