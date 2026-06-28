
import { Sequelize, QueryTypes } from 'sequelize';

// Instance ERP Principale (PostgreSQL AlwaysData)
export const sequelize = new Sequelize('gestionapp_creche_app', 'gestionapp', 'Dianka16', {
  host: 'postgresql-gestionapp.alwaysdata.net',
  port: 5432,
  dialect: 'postgres',
  logging: false,  // Désactiver les logs SQL
  define: {
    underscored: true,
    timestamps: true
  },
  retry: {
    match: [
      /ConnectionError/,
      /ConnectionRefusedError/,
      /ConnectionTimedOutError/,
      /TimeoutError/,
      /SequelizeConnectionError/,
      /ETIMEDOUT/,
      /ECONNRESET/,
      /ENOTFOUND/,
      /ENETUNREACH/,
      /ECONNREFUSED/
    ],
    max: 3
  },
  pool: {
    max: 8, // Augmenté pour gérer plus de connexions simultanées
    min: 2, // Maintenir quelques connexions ouvertes
    acquire: 60000, // Augmenté à 60 secondes
    idle: 20000 // Augmenté à 20 secondes avant fermeture
  },
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

// Instance Registry IA (MySQL AlwaysData)
export const sequelize_db_template = new Sequelize('gestionapp_saas_gestockpro_bot', '385922', 'Dianka16', {
  host: 'mysql-gestionapp.alwaysdata.net',
  port: 3306,
  dialect: 'mysql',
  logging: false,
  retry: {
    match: [
      /ConnectionError/,
      /ConnectionRefusedError/,
      /ConnectionTimedOutError/,
      /TimeoutError/,
      /SequelizeConnectionError/,
      /ETIMEDOUT/,
      /ECONNRESET/,
      /ENOTFOUND/,
      /ENETUNREACH/,
      /ECONNREFUSED/
    ],
    max: 3
  },
  pool: {
    max: 8, // Augmenté pour gérer plus de connexions simultanées
    min: 2, // Maintenir quelques connexions ouvertes
    acquire: 60000, // Augmenté à 60 secondes
    idle: 20000 // Augmenté à 20 secondes avant fermeture
  }
});

export const connectDB = async () => {
  try {
    // 1. Connexion & Sync ERP (PostgreSQL)
    await sequelize.authenticate();
    console.log('✅ Kernel ERP Connecté (PostgreSQL)');
    
    try {
      // alter: false pour éviter de modifier des colonnes existantes
      await sequelize.sync({ alter: false });
      console.log('✅ Schéma ERP Synchronisé');
    } catch (syncErr) {
      console.warn('⚠️ Note sync ERP:', syncErr.message);
    }

    // Colonne stockage S3 sur la table tenants (idempotent)
    try {
      await sequelize.query(`
        ALTER TABLE tenants
          ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;
      `, { type: QueryTypes.RAW });
      console.log('✅ Colonne storage_used_bytes vérifiée');
    } catch (storageErr) {
      console.warn('⚠️ Note colonne storage_used_bytes:', storageErr.message);
    }

    // Colonnes suspension de compte (idempotent)
    try {
      await sequelize.query(`
        ALTER TABLE tenants
          ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
      `, { type: QueryTypes.RAW });
      console.log('✅ Colonnes suspension compte vérifiées');
    } catch (suspendErr) {
      console.warn('⚠️ Note colonnes suspension:', suspendErr.message);
    }

    // Évolutions table backups : tenant_id nullable (backups système) + retain_until + storage_path
    try {
      await sequelize.query(`
        ALTER TABLE IF EXISTS backups
          ALTER COLUMN tenant_id DROP NOT NULL,
          ADD COLUMN IF NOT EXISTS retain_until TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);
      `, { type: QueryTypes.RAW });
      console.log('✅ Table backups mise à jour (tenant_id nullable, retain_until, storage_path)');
    } catch (backupErr) {
      console.warn('⚠️ Note table backups:', backupErr.message);
    }

    // Ajout valeur DELETION à l'enum type des backups (idempotent via DO $$)
    try {
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
            WHERE pg_type.typname = 'enum_backups_type'
              AND pg_enum.enumlabel = 'DELETION'
          ) THEN
            ALTER TYPE "enum_backups_type" ADD VALUE 'DELETION';
          END IF;
        END$$;
      `, { type: QueryTypes.RAW });
      console.log('✅ Valeur DELETION ajoutée à enum_backups_type');
    } catch (enumErr) {
      console.warn('⚠️ Note enum backups type:', enumErr.message);
    }

    // Colonnes suppression planifiée du compte (idempotent)
    try {
      await sequelize.query(`
        ALTER TABLE tenants
          ADD COLUMN IF NOT EXISTS pending_deletion      BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS deletion_reason        TEXT,
          ADD COLUMN IF NOT EXISTS deletion_backup_path   VARCHAR(500);
      `, { type: QueryTypes.RAW });
      console.log('✅ Colonnes suppression compte vérifiées');
    } catch (delErr) {
      console.warn('⚠️ Note colonnes deletion:', delErr.message);
    }

    // Garantir la création et les colonnes de pointage (idempotent)
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS attendances (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL,
          employee_id uuid NOT NULL,
          date date,
          clock_in timestamptz,
          clock_out timestamptz,
          source varchar(50) DEFAULT 'manual',
          status varchar(50) DEFAULT 'PRESENT',
          overtime_minutes integer DEFAULT 0,
          meta jsonb,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_attendances_employee_date ON attendances(employee_id, date);
        CREATE INDEX IF NOT EXISTS idx_attendances_tenant_date ON attendances(tenant_id, date);
        CREATE TABLE IF NOT EXISTS overtime_requests (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL,
          employee_id uuid NOT NULL,
          requested_date date NOT NULL,
          start_time varchar(5),
          end_time varchar(5),
          requested_minutes integer DEFAULT 0,
          reason text,
          status varchar(20) DEFAULT 'PENDING',
          reviewed_by uuid,
          review_note text,
          actual_minutes integer DEFAULT 0,
          meta jsonb,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_overtime_requests_employee ON overtime_requests(employee_id, requested_date);
        CREATE INDEX IF NOT EXISTS idx_overtime_requests_tenant_status ON overtime_requests(tenant_id, status);
        ALTER TABLE attendances
          ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS meta JSONB;
        ALTER TABLE IF EXISTS payroll_settings
          ADD COLUMN IF NOT EXISTS deduction_enabled BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS work_start_time VARCHAR(5) DEFAULT '08:00',
          ADD COLUMN IF NOT EXISTS work_end_time VARCHAR(5) DEFAULT '17:00',
          ADD COLUMN IF NOT EXISTS working_days_per_month INTEGER DEFAULT 26;
      `, { type: QueryTypes.RAW });
      console.log('✅ Colonnes pointage vérifiées');
    } catch (colErr) {
      console.warn('⚠️ Note colonnes pointage:', colErr.message);
    }

    // Contraintes uniques anti-doublons (idempotent)
    try {
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
          ON users (lower(email));

        CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_siret_unique
          ON tenants (siret)
          WHERE siret IS NOT NULL AND siret <> '';

        CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_phone_unique
          ON tenants (phone)
          WHERE phone IS NOT NULL AND phone <> '';

        CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_email_unique
          ON tenants (lower(email))
          WHERE email IS NOT NULL AND email <> '';
      `, { type: QueryTypes.RAW });
      console.log('✅ Indexes unicité inscrits');
    } catch (idxErr) {
      console.warn('⚠️ Note indexes unicité:', idxErr.message);
    }

    // Colonnes date_debut_effet + date_specifique sur creneaux_horaires (idempotent)
    try {
      await sequelize.query(`
        ALTER TABLE IF EXISTS creneaux_horaires
          ADD COLUMN IF NOT EXISTS date_debut_effet DATE,
          ADD COLUMN IF NOT EXISTS date_specifique  DATE;
      `, { type: QueryTypes.RAW });
      console.log('✅ Colonnes date_debut_effet + date_specifique sur creneaux_horaires vérifiées');
    } catch (crErr) {
      console.warn('⚠️ Note colonnes creneaux_horaires:', crErr.message);
    }

    // Colonnes abonnement modulable (périodes 1M/3M/1Y)
    try {
      await sequelize.query(`
        ALTER TABLE IF EXISTS plans
          ADD COLUMN IF NOT EXISTS price_three_months FLOAT,
          ADD COLUMN IF NOT EXISTS price_yearly FLOAT;

        ALTER TABLE IF EXISTS subscriptions
          ADD COLUMN IF NOT EXISTS current_period VARCHAR(10) DEFAULT '1M';

        ALTER TABLE IF EXISTS tenants
          ADD COLUMN IF NOT EXISTS plan_id VARCHAR(50),
          ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

        INSERT INTO plans (id, name, price_monthly, price_three_months, price_yearly, trial_days, max_users, has_ai_chatbot, has_stock_forecast, is_active, level, features, created_at, updated_at)
        VALUES
          ('FREE_TRIAL', 'Essai Gratuit',    0,     0,      0,       14, 5,   true, true,  true, 0, '["14 jours complets","Quota: 1 Client, 5 Produits, 5 Ventes","3 Catégories / 3 Sous-cat."]', NOW(), NOW()),
          ('BASIC',      'Starter AI',       7900,  20145,  66360,   0,  1,   false, false, true, 1, '["100 Factures/mois","1 Utilisateur","Support email"]', NOW(), NOW()),
          ('PRO',        'Business Pro',     19900, 50745,  167160,  0,  5,   true,  true,  true, 2, '["Illimité","5 Utilisateurs","IA Chatbot","Prévision Stock"]', NOW(), NOW()),
          ('ENTERPRISE', 'Enterprise Cloud', 69000, 175950, 579600,  0,  100, true,  true,  true, 3, '["Multi-Entités","100 Utilisateurs","Support Premium 24/7"]', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          price_monthly      = EXCLUDED.price_monthly,
          price_three_months = EXCLUDED.price_three_months,
          price_yearly       = EXCLUDED.price_yearly,
          name               = EXCLUDED.name,
          updated_at         = NOW();
      `, { type: QueryTypes.RAW });
      console.log('✅ Colonnes et plans abonnement vérifiés');
    } catch (subErr) {
      console.warn('⚠️ Note colonnes abonnement:', subErr.message);
    }

    // Table pour les inscriptions Stripe en attente (avant création de compte)
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS registration_intents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          stripe_session_id VARCHAR(255) UNIQUE,
          registration_data TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_reg_intents_session ON registration_intents(stripe_session_id);
        CREATE INDEX IF NOT EXISTS idx_reg_intents_status ON registration_intents(status);
      `, { type: QueryTypes.RAW });
      console.log('✅ Table registration_intents vérifiée');
    } catch (regErr) {
      console.warn('⚠️ Note registration_intents:', regErr.message);
    }

    // Garantir la création des tables de notifications (idempotent)
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          title VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          type VARCHAR(20) NOT NULL DEFAULT 'INFO',
          action_link VARCHAR(255),
          created_by UUID REFERENCES users(id) ON DELETE SET NULL,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS notification_reads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(notification_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_tenant  ON notifications(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(tenant_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notif_reads_user      ON notification_reads(user_id);
      `, { type: QueryTypes.RAW });
      console.log('✅ Tables notifications vérifiées');
    } catch (notifErr) {
      console.warn('⚠️ Note tables notifications:', notifErr.message);
    }
    
    // Colonnes client de passage sur sales
    try {
      await sequelize.query(`
        ALTER TABLE IF EXISTS sales
          ADD COLUMN IF NOT EXISTS walkin_name VARCHAR(150),
          ADD COLUMN IF NOT EXISTS walkin_phone VARCHAR(50);
      `, { type: QueryTypes.RAW });
      console.log('✅ Colonnes walkin_name / walkin_phone sur sales vérifiées');
    } catch (walkinErr) {
      console.warn('⚠️ Note colonnes walkin sales:', walkinErr.message);
    }

    // Colonnes chèque & preuve image sur payments
    try {
      await sequelize.query(`
        ALTER TABLE IF EXISTS payments
          ADD COLUMN IF NOT EXISTS proof_image TEXT,
          ADD COLUMN IF NOT EXISTS cheque_number VARCHAR(50),
          ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
          ADD COLUMN IF NOT EXISTS cheque_date DATE,
          ADD COLUMN IF NOT EXISTS cheque_order VARCHAR(150);
      `, { type: QueryTypes.RAW });
      // Ajouter CHEQUE à l'enum PostgreSQL si pas déjà présent
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
            WHERE pg_type.typname = 'enum_payments_method' AND pg_enum.enumlabel = 'CHEQUE'
          ) THEN
            ALTER TYPE "enum_payments_method" ADD VALUE 'CHEQUE';
          END IF;
        END$$;
      `, { type: QueryTypes.RAW });
      console.log('✅ Colonnes paiement chèque/preuve vérifiées');
    } catch (chqErr) {
      console.warn('⚠️ Note colonnes paiement chèque:', chqErr.message);
    }

    // Ajouter BROUILLON à l'enum des statuts de vente (idempotent)
    try {
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
            WHERE pg_type.typname = 'enum_sales_status' AND pg_enum.enumlabel = 'BROUILLON'
          ) THEN
            ALTER TYPE "enum_sales_status" ADD VALUE 'BROUILLON';
          END IF;
        END$$;
      `, { type: QueryTypes.RAW });
      console.log('✅ Valeur BROUILLON ajoutée à enum_sales_status');
    } catch (brouillonErr) {
      console.warn('⚠️ Note enum BROUILLON:', brouillonErr.message);
    }

    // Correction historique : les paiements ni CHEQUE ni TRANSFER existants avec statut PENDING
    // → les passer à PAID car ils ont toujours été encaissés immédiatement
    // TRANSFER est désormais traité comme CHEQUE (PENDING jusqu'à encaissement)
    try {
      await sequelize.query(`
        UPDATE payments
        SET statut = 'PAID'
        WHERE method NOT IN ('CHEQUE', 'TRANSFER')
          AND (statut IS NULL OR statut = 'PENDING');
      `, { type: QueryTypes.RAW });
      console.log('✅ Statuts paiements historiques corrigés');
    } catch (statErr) {
      console.warn('⚠️ Note correction statuts paiements:', statErr.message);
    }

    // Colonnes scolaires sur la table customers (pour le module Admissions)
    try {
      await sequelize.query(`
        ALTER TABLE IF EXISTS customers
          ADD COLUMN IF NOT EXISTS statut            VARCHAR(20)  DEFAULT 'EN_ATTENTE',
          ADD COLUMN IF NOT EXISTS niveau            VARCHAR(10),
          ADD COLUMN IF NOT EXISTS date_naissance    DATE,
          ADD COLUMN IF NOT EXISTS lieu_naissance    VARCHAR(255),
          ADD COLUMN IF NOT EXISTS regime_financier  VARCHAR(30)  DEFAULT 'NORMAL',
          ADD COLUMN IF NOT EXISTS remise_pct        INTEGER      DEFAULT 0,
          ADD COLUMN IF NOT EXISTS cantine           BOOLEAN      DEFAULT false,
          ADD COLUMN IF NOT EXISTS transport_bus     BOOLEAN      DEFAULT false,
          ADD COLUMN IF NOT EXISTS besoin_specifique TEXT,
          ADD COLUMN IF NOT EXISTS parent1_lien      VARCHAR(20),
          ADD COLUMN IF NOT EXISTS parent1_whatsapp  VARCHAR(50),
          ADD COLUMN IF NOT EXISTS urgence_nom       VARCHAR(255),
          ADD COLUMN IF NOT EXISTS urgence_tel       VARCHAR(50),
          ADD COLUMN IF NOT EXISTS urgence_lien      VARCHAR(100),
          ADD COLUMN IF NOT EXISTS date_depot        DATE,
          ADD COLUMN IF NOT EXISTS annee_scolaire    VARCHAR(10),
          ADD COLUMN IF NOT EXISTS notes             TEXT;
      `, { type: QueryTypes.RAW });
      console.log('✅ Colonnes scolaires customers vérifiées');
    } catch (crechemErr) {
      console.warn('⚠️ Note colonnes scolaires customers:', crechemErr.message);
    }

    // Table élèves (module pédagogique)
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS eleves (
          id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id           UUID        NOT NULL,
          matricule           VARCHAR(20),
          nom                 VARCHAR(100) NOT NULL,
          prenom              VARCHAR(100) NOT NULL,
          date_naissance      DATE,
          lieu_naissance      VARCHAR(150),
          niveau              VARCHAR(10)  DEFAULT 'PS',
          classe_id           UUID,
          regime_financier    VARCHAR(30)  DEFAULT 'NORMAL',
          remise_pct          INTEGER      DEFAULT 0,
          cantine             BOOLEAN      DEFAULT false,
          transport_bus       BOOLEAN      DEFAULT false,
          besoin_specifique   TEXT,
          statut              VARCHAR(20)  DEFAULT 'EN_ATTENTE',
          date_admission      DATE,
          date_radiation      DATE,
          parent1             JSONB,
          parent2             JSONB,
          contact_urgence     JSONB,
          whatsapp_principal  VARCHAR(50),
          annee_scolaire      VARCHAR(10),
          photo_url           VARCHAR(500),
          created_at          TIMESTAMPTZ  DEFAULT NOW(),
          updated_at          TIMESTAMPTZ  DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_eleves_tenant  ON eleves(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_eleves_niveau  ON eleves(tenant_id, niveau);
        CREATE INDEX IF NOT EXISTS idx_eleves_statut  ON eleves(tenant_id, statut);
        CREATE INDEX IF NOT EXISTS idx_eleves_annee   ON eleves(tenant_id, annee_scolaire);
      `, { type: QueryTypes.RAW });
      console.log('✅ Table eleves vérifiée');
    } catch (elevesErr) {
      console.warn('⚠️ Note table eleves:', elevesErr.message);
    }

    // Table classes (module pédagogique)
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS classes (
          id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id           UUID        NOT NULL,
          nom                 VARCHAR(100) NOT NULL,
          niveau              VARCHAR(20) NOT NULL,
          enseignant_id       UUID        REFERENCES employees(id) ON DELETE SET NULL,
          capacite_max        INTEGER     DEFAULT 30,
          annee_scolaire      VARCHAR(10) NOT NULL,
          description         TEXT,
          created_at          TIMESTAMPTZ DEFAULT NOW(),
          updated_at          TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_classes_tenant ON classes(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_classes_niveau ON classes(tenant_id, niveau);
      `, { type: QueryTypes.RAW });
      console.log('✅ Table classes vérifiée');
    } catch (classesErr) {
      console.warn('⚠️ Note table classes:', classesErr.message);
    }

    // Tables abonnements & échéances (recouvrement scolaire)
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS abonnements_eleves (
          id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id       UUID        NOT NULL,
          eleve_id        UUID        NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
          service_id      UUID        NOT NULL,
          periodicite     VARCHAR(20) NOT NULL,
          montant         NUMERIC(15,2) NOT NULL,
          date_debut      DATE        NOT NULL,
          date_fin        DATE,
          is_active       BOOLEAN     DEFAULT true,
          created_at      TIMESTAMPTZ DEFAULT NOW(),
          updated_at      TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_abo_eleve    ON abonnements_eleves(tenant_id, eleve_id);
        CREATE INDEX IF NOT EXISTS idx_abo_active   ON abonnements_eleves(tenant_id, is_active);

        CREATE TABLE IF NOT EXISTS echeances_paiements (
          id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id         UUID        NOT NULL,
          abonnement_id     UUID        NOT NULL REFERENCES abonnements_eleves(id) ON DELETE CASCADE,
          eleve_id          UUID        NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
          service_id        UUID        NOT NULL,
          montant           NUMERIC(15,2) NOT NULL,
          date_echeance     DATE        NOT NULL,
          periode_label     VARCHAR(50),
          statut            VARCHAR(20) DEFAULT 'EN_ATTENTE',
          paid_at           TIMESTAMPTZ,
          sale_id           UUID,
          reminder_sent_at  TIMESTAMPTZ,
          created_at        TIMESTAMPTZ DEFAULT NOW(),
          updated_at        TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ech_eleve   ON echeances_paiements(tenant_id, eleve_id);
        CREATE INDEX IF NOT EXISTS idx_ech_statut  ON echeances_paiements(tenant_id, statut);
        CREATE INDEX IF NOT EXISTS idx_ech_date    ON echeances_paiements(tenant_id, date_echeance);
      `, { type: QueryTypes.RAW });
      console.log('✅ Tables abonnements_eleves & echeances_paiements vérifiées');
    } catch (aboErr) {
      console.warn('⚠️ Note tables abonnements/echeances:', aboErr.message);
    }

    // Table bulletins (module pédagogique)
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS bulletins (
          id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id           UUID        NOT NULL,
          eleve_id            UUID        NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
          trimestre           VARCHAR(10) NOT NULL,
          annee_scolaire      VARCHAR(10) NOT NULL,
          niveau              VARCHAR(10) NOT NULL,
          domaines            JSONB,
          matieres            JSONB,
          moyenne_generale    FLOAT,
          appreciation_generale TEXT,
          publie              BOOLEAN     DEFAULT false,
          date_publication    DATE,
          created_at          TIMESTAMPTZ DEFAULT NOW(),
          updated_at          TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(eleve_id, trimestre, annee_scolaire)
        );
        CREATE INDEX IF NOT EXISTS idx_bulletins_tenant ON bulletins(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_bulletins_eleve  ON bulletins(eleve_id);
      `, { type: QueryTypes.RAW });
      console.log('✅ Table bulletins vérifiée');
    } catch (bulletinsErr) {
      console.warn('⚠️ Note table bulletins:', bulletinsErr.message);
    }

    // Tables emploi du temps (creneaux_horaires + planning)
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS creneaux_horaires (
          id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id      UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          classe_id      UUID         NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          enseignant_id  UUID         REFERENCES employees(id) ON DELETE SET NULL,
          jour           INTEGER      NOT NULL CHECK (jour BETWEEN 0 AND 4),
          heure_debut    VARCHAR(5)   NOT NULL,
          heure_fin      VARCHAR(5)   NOT NULL,
          matiere        VARCHAR(100) NOT NULL,
          couleur        VARCHAR(20)  NOT NULL DEFAULT 'blue',
          annee_scolaire VARCHAR(10)  NOT NULL,
          created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_creneaux_tenant_classe ON creneaux_horaires (tenant_id, classe_id);
        CREATE INDEX IF NOT EXISTS idx_creneaux_enseignant    ON creneaux_horaires (enseignant_id);

        CREATE TABLE IF NOT EXISTS planning_config (
          id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id      UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          annee_scolaire VARCHAR(10)  NOT NULL,
          date_debut     DATE         NOT NULL,
          date_fin       DATE         NOT NULL,
          jours_repos    JSONB        NOT NULL DEFAULT '[]',
          created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          UNIQUE(tenant_id, annee_scolaire)
        );
        CREATE INDEX IF NOT EXISTS idx_planning_config_tenant ON planning_config (tenant_id, annee_scolaire);

        CREATE TABLE IF NOT EXISTS planning_exceptions (
          id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id             UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          creneau_id            UUID         NOT NULL REFERENCES creneaux_horaires(id) ON DELETE CASCADE,
          date_exception        DATE         NOT NULL,
          type_exception        VARCHAR(20)  NOT NULL DEFAULT 'ANNULE',
          matiere_override      VARCHAR(100),
          heure_debut_override  VARCHAR(5),
          heure_fin_override    VARCHAR(5),
          note                  VARCHAR(255),
          created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          UNIQUE(creneau_id, date_exception)
        );
        CREATE INDEX IF NOT EXISTS idx_planning_exceptions_tenant ON planning_exceptions (tenant_id);
        CREATE INDEX IF NOT EXISTS idx_planning_exceptions_date   ON planning_exceptions (date_exception);
      `, { type: QueryTypes.RAW });
      console.log('✅ Tables creneaux_horaires + planning vérifiées');
    } catch (scheduleErr) {
      console.warn('⚠️ Note tables schedule/planning:', scheduleErr.message);
    }

    // Table événements scolaires (agenda admin → portail parent)
    // Si la table a été créée avec des colonnes camelCase (avant les field overrides Sequelize),
    // on la supprime et recrée avec le schéma snake_case correct (table vide → aucune perte).
    try {
      const [colCheck] = await sequelize.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns
         WHERE table_name = 'school_events' AND column_name = 'type_evenement'`,
        { type: QueryTypes.SELECT }
      );
      if (parseInt(colCheck?.cnt ?? '0', 10) === 0) {
        await sequelize.query('DROP TABLE IF EXISTS school_events CASCADE', { type: QueryTypes.RAW });
        console.log('🔄 school_events supprimée (schéma camelCase obsolète), recréation…');
      }
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS school_events (
          id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id      UUID         NOT NULL,
          titre          VARCHAR(255) NOT NULL,
          description    TEXT,
          type_evenement VARCHAR(50)  NOT NULL DEFAULT 'INFO',
          statut         VARCHAR(20)  NOT NULL DEFAULT 'PUBLIE',
          date_debut     DATE         NOT NULL,
          date_fin       DATE,
          heure_debut    VARCHAR(10),
          heure_fin      VARCHAR(10),
          lieu           VARCHAR(255),
          niveaux_cibles TEXT         NOT NULL DEFAULT 'TOUS',
          diffuse        BOOLEAN      NOT NULL DEFAULT false,
          created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_school_events_tenant ON school_events (tenant_id);
        CREATE INDEX IF NOT EXISTS idx_school_events_statut ON school_events (statut);
      `, { type: QueryTypes.RAW });
      console.log('✅ Table school_events vérifiée (schéma snake_case)');
    } catch (schoolEventsErr) {
      console.warn('⚠️ Note table school_events:', schoolEventsErr.message);
    }

    // 2. Connexion & Sync Registry IA (MySQL)
    await sequelize_db_template.authenticate();
    console.log('✅ Registry IA Connecté (MySQL)');
    
    try {
      // alter: false est CRITIQUE ici pour éviter l'erreur sur conversation_id
      await sequelize_db_template.sync({ alter: false }); 
      console.log('✅ Schéma IA Synchronisé');
    } catch (syncErr) {
      console.error('❌ Erreur sync IA:', syncErr.message);
    }

  } catch (error) {
    console.error('❌ Erreur critique Kernel Database:', error.message);
  }
};


// 9F/uJ/mreE7=jHcE

// FJrL$C.!y9^17G&S SECK