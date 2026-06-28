import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';
import crypto from 'crypto';

export class SchoolEventController {
  static async list(req, res) {
    try {
      const events = await sequelize.query(
        `SELECT id, tenant_id, titre, description, type_evenement, statut,
                date_debut, date_fin, heure_debut, heure_fin, lieu,
                niveaux_cibles, diffuse, created_at, updated_at
         FROM school_events
         WHERE tenant_id = :tenantId
         ORDER BY date_debut ASC`,
        { replacements: { tenantId: req.user.tenantId }, type: QueryTypes.SELECT }
      );
      res.json(events.map(rowToJson));
    } catch (err) {
      console.error('[SchoolEvent.list]', err.message, err.parent?.message || '');
      if (err.message?.includes('does not exist') || err.parent?.code === '42P01') return res.json([]);
      res.status(500).json({ error: 'ListError', message: err.message });
    }
  }

  static async upsert(req, res) {
    try {
      const tenantId = req.user.tenantId;
      const id       = req.params.id;

      const {
        titre        = '',
        description  = '',
        typeEvenement = 'INFO',
        statut       = 'BROUILLON',
        dateDebut,
        dateFin,
        heureDebut,
        heureFin,
        lieu,
        niveauxCibles,
        diffuse,
      } = req.body;

      if (!titre || !dateDebut) {
        return res.status(400).json({ error: 'ValidationError', message: 'titre et dateDebut sont obligatoires' });
      }

      const niveaux = Array.isArray(niveauxCibles)
        ? niveauxCibles.join(',')
        : (niveauxCibles || 'TOUS');

      if (id) {
        // ── UPDATE ──────────────────────────────────────────────────────────
        await sequelize.query(
          `UPDATE school_events
           SET titre          = :titre,
               description    = :description,
               type_evenement = :typeEvenement,
               statut         = :statut,
               date_debut     = :dateDebut,
               date_fin       = :dateFin,
               heure_debut    = :heureDebut,
               heure_fin      = :heureFin,
               lieu           = :lieu,
               niveaux_cibles = :niveaux,
               diffuse        = :diffuse,
               updated_at     = NOW()
           WHERE id = :id AND tenant_id = :tenantId`,
          {
            replacements: {
              titre, description, typeEvenement, statut, dateDebut,
              dateFin:    dateFin    || null,
              heureDebut: heureDebut || null,
              heureFin:   heureFin   || null,
              lieu:       lieu       || null,
              niveaux,
              diffuse: !!diffuse,
              id, tenantId,
            },
            type: QueryTypes.RAW,
          }
        );
        const rows = await sequelize.query(
          'SELECT * FROM school_events WHERE id = :id AND tenant_id = :tenantId',
          { replacements: { id, tenantId }, type: QueryTypes.SELECT }
        );
        if (!rows.length) return res.status(404).json({ error: 'NotFound' });
        return res.json(rowToJson(rows[0]));
      }

      // ── INSERT ────────────────────────────────────────────────────────────
      const newId = crypto.randomUUID();
      await sequelize.query(
        `INSERT INTO school_events
           (id, tenant_id, titre, description, type_evenement, statut,
            date_debut, date_fin, heure_debut, heure_fin, lieu, niveaux_cibles, diffuse,
            created_at, updated_at)
         VALUES
           (:id, :tenantId, :titre, :description, :typeEvenement, :statut,
            :dateDebut, :dateFin, :heureDebut, :heureFin, :lieu, :niveaux, :diffuse,
            NOW(), NOW())`,
        {
          replacements: {
            id: newId, tenantId, titre, description, typeEvenement, statut,
            dateDebut,
            dateFin:    dateFin    || null,
            heureDebut: heureDebut || null,
            heureFin:   heureFin   || null,
            lieu:       lieu       || null,
            niveaux,
            diffuse: !!diffuse,
          },
          type: QueryTypes.RAW,
        }
      );

      const rows = await sequelize.query(
        'SELECT * FROM school_events WHERE id = :id',
        { replacements: { id: newId }, type: QueryTypes.SELECT }
      );
      res.status(201).json(rowToJson(rows[0]));
    } catch (err) {
      console.error('[SchoolEvent.upsert] message:', err.message);
      console.error('[SchoolEvent.upsert] parent :', err.parent?.message || '');
      console.error('[SchoolEvent.upsert] sql    :', err.sql || '');
      res.status(500).json({ error: 'UpsertError', message: err.message, detail: err.parent?.message });
    }
  }

  static async remove(req, res) {
    try {
      await sequelize.query(
        'DELETE FROM school_events WHERE id = :id AND tenant_id = :tenantId',
        { replacements: { id: req.params.id, tenantId: req.user.tenantId }, type: QueryTypes.RAW }
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('[SchoolEvent.remove]', err.message);
      res.status(500).json({ error: 'DeleteError', message: err.message });
    }
  }
}

function rowToJson(row) {
  if (!row) return null;
  return {
    id:            row.id,
    tenantId:      row.tenant_id,
    titre:         row.titre,
    description:   row.description,
    typeEvenement: row.type_evenement,
    statut:        row.statut,
    dateDebut:     row.date_debut,
    dateFin:       row.date_fin,
    heureDebut:    row.heure_debut,
    heureFin:      row.heure_fin,
    lieu:          row.lieu,
    niveauxCibles: row.niveaux_cibles,
    diffuse:       row.diffuse,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}
