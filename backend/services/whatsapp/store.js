/**
 * Persistance WhatsApp : compte lié par établissement + journal des messages (statut, ack).
 * Tables créées dans config/database.js (whatsapp_accounts, whatsapp_messages).
 */

import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

export const MessageStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
};

// Ack whatsapp-web.js : -1 erreur, 0 en attente, 1 serveur, 2 distribué, 3 lu, 4 écouté
export function ackToStatus(ack) {
  if (ack === -1) return MessageStatus.FAILED;
  if (ack >= 3) return MessageStatus.READ;
  if (ack === 2) return MessageStatus.DELIVERED;
  return MessageStatus.SENT;
}

export async function upsertAccount(tenantId, { phone, pushname }) {
  await sequelize.query(
    `INSERT INTO whatsapp_accounts (tenant_id, phone, pushname, linked_at, updated_at)
     VALUES (:tenantId, :phone, :pushname, NOW(), NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       linked_at  = CASE WHEN whatsapp_accounts.phone IS DISTINCT FROM EXCLUDED.phone
                         THEN NOW() ELSE whatsapp_accounts.linked_at END,
       phone      = EXCLUDED.phone,
       pushname   = EXCLUDED.pushname,
       updated_at = NOW()`,
    { replacements: { tenantId, phone: phone || null, pushname: pushname || null }, type: QueryTypes.RAW }
  );
}

export async function deleteAccount(tenantId) {
  await sequelize.query(`DELETE FROM whatsapp_accounts WHERE tenant_id = :tenantId`,
    { replacements: { tenantId }, type: QueryTypes.RAW });
}

export async function getAccount(tenantId) {
  const [row] = await sequelize.query(
    `SELECT tenant_id, phone, pushname, linked_at FROM whatsapp_accounts WHERE tenant_id = :tenantId`,
    { replacements: { tenantId }, type: QueryTypes.SELECT }
  );
  return row || null;
}

export async function listAccountTenantIds() {
  const rows = await sequelize.query(`SELECT tenant_id FROM whatsapp_accounts`, { type: QueryTypes.SELECT });
  return rows.map(r => r.tenant_id);
}

export async function insertMessage(m) {
  const [row] = await sequelize.query(
    `INSERT INTO whatsapp_messages
       (tenant_id, phone, kind, body, filename, category, reference, recipient_name, status, error, created_by)
     VALUES (:tenantId, :phone, :kind, :body, :filename, :category, :reference, :recipientName, :status, :error, :createdBy)
     RETURNING id`,
    {
      replacements: {
        tenantId: m.tenantId,
        phone: m.phone,
        kind: m.kind || 'text',
        body: m.body || '',
        filename: m.filename || null,
        category: m.category || null,
        reference: m.reference || null,
        recipientName: m.recipientName || null,
        status: m.status || MessageStatus.QUEUED,
        error: m.error || null,
        createdBy: m.createdBy || null,
      },
      type: QueryTypes.SELECT,
    }
  );
  return row.id;
}

export async function markSent(id, { chatId, waMessageId, ack }) {
  await sequelize.query(
    `UPDATE whatsapp_messages
     SET status = :status, chat_id = :chatId, wa_message_id = :waMessageId, ack = :ack,
         error = NULL, sent_at = NOW(), updated_at = NOW()
     WHERE id = :id`,
    { replacements: { id, chatId, waMessageId, ack: ack ?? 1, status: ackToStatus(ack ?? 1) }, type: QueryTypes.RAW }
  );
}

export async function markFailed(id, error) {
  await sequelize.query(
    `UPDATE whatsapp_messages SET status = 'FAILED', error = :error, updated_at = NOW() WHERE id = :id`,
    { replacements: { id, error: String(error).slice(0, 2000) }, type: QueryTypes.RAW }
  );
}

export async function updateAck(waMessageId, ack) {
  // Un ack ne fait jamais reculer le statut (READ ne redevient pas DELIVERED)
  await sequelize.query(
    `UPDATE whatsapp_messages SET ack = :ack, status = :status, updated_at = NOW()
     WHERE wa_message_id = :waMessageId AND (ack IS NULL OR ack < :ack OR :ack = -1)`,
    { replacements: { waMessageId, ack, status: ackToStatus(ack) }, type: QueryTypes.RAW }
  );
}

export async function countSentToday(tenantId) {
  const [row] = await sequelize.query(
    `SELECT COUNT(*)::int AS n FROM whatsapp_messages
     WHERE tenant_id = :tenantId AND sent_at >= date_trunc('day', NOW())`,
    { replacements: { tenantId }, type: QueryTypes.SELECT }
  );
  return row?.n || 0;
}

/** Au démarrage : la file est en mémoire, les messages QUEUED d'un process précédent sont perdus. */
export async function failStaleQueued() {
  await sequelize.query(
    `UPDATE whatsapp_messages SET status = 'FAILED', error = 'Interrompu par un redémarrage du serveur', updated_at = NOW()
     WHERE status = 'QUEUED'`,
    { type: QueryTypes.RAW }
  );
}

export async function listMessages(tenantId, { limit = 50, offset = 0, status, ids } = {}) {
  const where = ['tenant_id = :tenantId'];
  const replacements = { tenantId, limit, offset };
  if (status) { where.push('status = :status'); replacements.status = status; }
  if (ids?.length) { where.push('id IN (:ids)'); replacements.ids = ids; }
  const rows = await sequelize.query(
    `SELECT id, phone, kind, LEFT(body, 300) AS body, filename, category, reference, recipient_name,
            status, ack, error, created_at, sent_at
     FROM whatsapp_messages WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT }
  );
  const [{ total }] = await sequelize.query(
    `SELECT COUNT(*)::int AS total FROM whatsapp_messages WHERE ${where.join(' AND ')}`,
    { replacements, type: QueryTypes.SELECT }
  );
  return { rows, total };
}
