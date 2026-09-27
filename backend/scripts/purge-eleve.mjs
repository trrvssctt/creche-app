/**
 * Suppression complète d'un élève de test et de tout ce qui s'y rattache.
 *
 *   node scripts/purge-eleve.mjs <eleveId>                                   # simulation (rien n'est modifié)
 *   node scripts/purge-eleve.mjs <eleveId> --apply --confirm=<MATRICULE>     # suppression réelle
 *
 * - Sauvegarde toutes les lignes concernées dans scripts/backup-eleve-<id>-<date>.json
 * - Une seule transaction : tout est supprimé, ou rien (ROLLBACK en cas d'erreur)
 * - Dépendances trouvées via les clés étrangères de la base (récursif), plus les
 *   références sans clé étrangère : colonnes eleve_id, communication_logs.target_eleve_id,
 *   ventes qui citent l'élève, messages WhatsApp liés, users.eleve_ids (retrait seulement)
 * - Affiche à la fin les autres mentions de l'élève non supprimées, à vérifier à la main
 *
 * Lancer depuis backend/ (utilise la base configurée dans config/database.js).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const [, , ELEVE_ID, ...flags] = process.argv;
const APPLY = flags.includes('--apply');
const CONFIRM = (flags.find(f => f.startsWith('--confirm=')) || '').split('=')[1];

if (!/^[0-9a-f-]{36}$/i.test(ELEVE_ID || '')) {
  console.error('Usage : node scripts/purge-eleve.mjs <eleveId> [--apply --confirm=<MATRICULE>]');
  process.exit(1);
}

const q = (sql, replacements = {}, transaction) =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
const ident = name => `"${String(name).replace(/"/g, '""')}"`;

async function run(t) {
  // ── 1. L'élève ─────────────────────────────────────────────────────────────
  // Simulation : transaction en lecture seule, aucune écriture possible
  if (!APPLY) await sequelize.query('SET TRANSACTION READ ONLY', { transaction: t });
  const [eleve] = await q(`SELECT * FROM eleves WHERE id = :id ${APPLY ? 'FOR UPDATE' : ''}`, { id: ELEVE_ID }, t);
  if (!eleve) throw new Error(`Élève ${ELEVE_ID} introuvable.`);
  console.log(`Élève : ${eleve.prenom} ${eleve.nom} — matricule ${eleve.matricule} — ${eleve.statut} ${eleve.annee_scolaire} — créé le ${new Date(eleve.created_at).toLocaleString('fr-FR')}`);
  if (APPLY && CONFIRM !== eleve.matricule) {
    throw new Error(`--confirm=${CONFIRM || '(absent)'} ne correspond pas au matricule ${eleve.matricule}. Rien n'a été supprimé.`);
  }
  const TENANT = eleve.tenant_id;
  const matriculeCompact = String(eleve.matricule || '').replace(/-/g, '').toUpperCase();

  // ── 2. Schéma : colonnes et clés étrangères ────────────────────────────────
  const columns = await q(`SELECT table_name, column_name, data_type FROM information_schema.columns
                           WHERE table_schema = 'public'`, {}, t);
  const colsOf = tbl => columns.filter(c => c.table_name === tbl);
  const hasCol = (tbl, col) => columns.some(c => c.table_name === tbl && c.column_name === col);
  const fks = await q(`
    SELECT cl.relname AS child, a.attname AS child_col, pl.relname AS parent, af.attname AS parent_col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_class pl ON pl.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a  ON a.attrelid = c.conrelid  AND a.attnum  = c.conkey[1]
    JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1`, {}, t);

  // ── 3. Lignes à supprimer : table → Map(clé → ligne) ───────────────────────
  const found = new Map();   // table → Map(key, row)
  const order = [];          // ordre de découverte (parents d'abord)
  const keyOf = (tbl, row) => (hasCol(tbl, 'id') ? String(row.id) : JSON.stringify(row));
  const add = (tbl, rows, why) => {
    if (!rows.length) return [];
    if (!found.has(tbl)) { found.set(tbl, new Map()); order.push(tbl); }
    const m = found.get(tbl);
    const fresh = rows.filter(r => !m.has(keyOf(tbl, r)));
    fresh.forEach(r => m.set(keyOf(tbl, r), r));
    if (fresh.length) console.log(`  + ${String(fresh.length).padStart(3)} × ${tbl.padEnd(28)} (${why})`);
    return fresh;
  };

  console.log('\nRecherche des références :');
  add('eleves', [eleve], 'élève');

  // Colonnes eleve_id (avec ou sans clé étrangère)
  for (const c of columns.filter(c => c.column_name === 'eleve_id' && c.table_name !== 'eleves')) {
    add(c.table_name, await q(`SELECT * FROM ${ident(c.table_name)} WHERE eleve_id::text = :id`, { id: ELEVE_ID }, t), 'eleve_id');
  }
  if (hasCol('communication_logs', 'target_eleve_id')) {
    add('communication_logs', await q(`SELECT * FROM communication_logs WHERE target_eleve_id::text = :id`, { id: ELEVE_ID }, t), 'envoi individuel');
  }

  // Ventes / factures qui citent l'élève (id ou matricule) dans une colonne texte/json
  if (columns.some(c => c.table_name === 'sales')) {
    const textCols = colsOf('sales').filter(c => /json|text|character|uuid/.test(c.data_type)).map(c => `${ident(c.column_name)}::text`);
    const where = textCols.map(c => `${c} LIKE :like OR ${c} ILIKE :mat`).join(' OR ');
    add('sales', await q(`SELECT * FROM sales WHERE tenant_id = :tenant AND (${where})`,
      { tenant: TENANT, like: `%${ELEVE_ID}%`, mat: `%${eleve.matricule}%` }, t), 'vente citant l\'élève');
  }

  // Dépendances par clés étrangères, en cascade (ex. lignes de vente, allocations de paiement…)
  for (let i = 0; i < order.length; i++) {
    const parent = order[i];
    const parentKeys = [...found.get(parent).values()].map(r => r.id).filter(Boolean).map(String);
    if (!parentKeys.length) continue;
    for (const fk of fks.filter(f => f.parent === parent && f.parent_col === 'id' && !(f.child === parent && f.child_col === 'id'))) {
      const rows = await q(`SELECT * FROM ${ident(fk.child)} WHERE ${ident(fk.child_col)}::text IN (:keys)`, { keys: parentKeys }, t);
      add(fk.child, rows, `→ ${parent}.${fk.parent_col} via ${fk.child_col}`);
    }
  }

  // Messages WhatsApp liés (références construites par l'application)
  if (columns.some(c => c.table_name === 'whatsapp_messages')) {
    const saleRefs = [...(found.get('sales')?.values() || [])].map(s => s.reference).filter(Boolean);
    const patterns = [`%${ELEVE_ID}%`, ...(matriculeCompact ? [`%${matriculeCompact}%`] : []), ...saleRefs.map(r => `%${r}%`)];
    const where = patterns.map((_, k) => `reference LIKE :p${k}`).join(' OR ');
    const repl = Object.fromEntries(patterns.map((p, k) => [`p${k}`, p]));
    add('whatsapp_messages', await q(`SELECT * FROM whatsapp_messages WHERE tenant_id = :tenant AND (${where})`,
      { tenant: TENANT, ...repl }, t), 'message WhatsApp lié');
  }

  // Comptes parents : on retire seulement l'élève de la liste (le compte n'est pas supprimé)
  const parentUsers = hasCol('users', 'eleve_ids')
    ? await q(`SELECT id, name, email, eleve_ids FROM users WHERE eleve_ids::text LIKE :like`, { like: `%${ELEVE_ID}%` }, t)
    : [];

  // ── 4. Récapitulatif ───────────────────────────────────────────────────────
  console.log('\nÀ supprimer :');
  let total = 0;
  for (const tbl of order) { const n = found.get(tbl).size; total += n; console.log(`  ${tbl.padEnd(30)} ${n}`); }
  console.log(`  ${'TOTAL'.padEnd(30)} ${total}`);
  if (parentUsers.length) {
    console.log('\nComptes parents dont l\'élève sera retiré (comptes conservés) :');
    parentUsers.forEach(u => console.log(`  ${u.email || u.name} — eleve_ids = ${JSON.stringify(u.eleve_ids)}`));
  }

  // Autres mentions sans lien connu : signalées, pas supprimées
  const covered = new Set(order);
  const leftovers = [];
  const byTable = {};
  for (const c of columns.filter(c => /json|text|character|uuid/.test(c.data_type))) (byTable[c.table_name] ||= []).push(c.column_name);
  for (const [tbl, cols] of Object.entries(byTable)) {
    if (covered.has(tbl) || tbl === 'users') continue;
    const where = cols.map(c => `${ident(c)}::text LIKE :like`).join(' OR ');
    try {
      const [{ n }] = await q(`SELECT COUNT(*)::int AS n FROM ${ident(tbl)} WHERE ${where}`, { like: `%${ELEVE_ID}%` }, t);
      if (n) leftovers.push(`${tbl} (${n})`);
    } catch { /* vue ou table inaccessible */ }
  }
  if (leftovers.length) console.log(`\n⚠️  Autres mentions de l'id (non supprimées, à vérifier) : ${leftovers.join(', ')}`);

  // ── 5. Sauvegarde ──────────────────────────────────────────────────────────
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const backupFile = path.join(dir, `backup-eleve-${ELEVE_ID}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({
    eleveId: ELEVE_ID, createdAt: new Date().toISOString(), applied: APPLY,
    tables: Object.fromEntries(order.map(tbl => [tbl, [...found.get(tbl).values()]])),
    parentUsers,
  }, null, 2));
  console.log(`\nSauvegarde : ${backupFile}`);

  if (!APPLY) {
    console.log(`\nSIMULATION — rien n'a été modifié. Pour supprimer :\n  node scripts/purge-eleve.mjs ${ELEVE_ID} --apply --confirm=${eleve.matricule}`);
    return false;
  }

  // ── 6. Suppression : enfants d'abord, élève en dernier ─────────────────────
  for (const u of parentUsers) {
    const type = columns.find(c => c.table_name === 'users' && c.column_name === 'eleve_ids')?.data_type;
    if (type === 'ARRAY') {
      await sequelize.query(`UPDATE users SET eleve_ids = array_remove(eleve_ids, CAST(:id AS uuid)) WHERE id = :uid`, { replacements: { id: ELEVE_ID, uid: u.id }, transaction: t });
    } else if (type === 'jsonb' || type === 'json') {
      await sequelize.query(`UPDATE users SET eleve_ids = (COALESCE(eleve_ids::jsonb, '[]'::jsonb) - :id)::${type} WHERE id = :uid`, { replacements: { id: ELEVE_ID, uid: u.id }, transaction: t });
    }
  }
  for (const tbl of [...order].reverse()) {
    const rows = [...found.get(tbl).values()];
    if (hasCol(tbl, 'id')) {
      await sequelize.query(`DELETE FROM ${ident(tbl)} WHERE id::text IN (:ids)`, { replacements: { ids: rows.map(r => String(r.id)) }, transaction: t });
    } else {
      console.warn(`  ⚠️ ${tbl} n'a pas de colonne id : ${rows.length} ligne(s) laissée(s), à supprimer à la main`);
    }
    console.log(`  - ${tbl} : ${rows.length} supprimée(s)`);
  }
  return true;
}

try {
  const applied = await sequelize.transaction(async t => run(t));
  if (applied) console.log('\n✅ Suppression validée (COMMIT).');
} catch (err) {
  console.error(`\n❌ Annulé (ROLLBACK) : ${err.message}`);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
