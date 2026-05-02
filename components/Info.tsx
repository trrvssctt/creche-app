import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Info as InfoIcon, AlertTriangle, Zap, Tag, Wrench,
  CheckCheck, RefreshCw, Loader2, Send, Trash2, Users, User as UserIcon,
  Plus, X, ChevronDown, ShieldAlert, Megaphone, Clock
} from 'lucide-react';
import { User, UserRole } from '../types';
import { apiClient } from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: 'INFO' | 'WARNING' | 'UPDATE' | 'PROMO' | 'MAINTENANCE';
  targetPlan: string | null;
  isPinned: boolean;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
}

interface TenantNotification {
  id: string;
  tenantId: string;
  targetUserId: string | null;
  title: string;
  body: string;
  type: 'INFO' | 'WARNING' | 'URGENT' | 'PAYROLL' | 'HR' | 'LEAVE';
  actionLink: string | null;
  createdBy: string | null;
  expiresAt: string | null;
  createdAt: string;
  isRead: boolean;
  sender?: { id: string; name: string; email: string };
  targetUser?: { id: string; name: string; email: string } | null;
}

interface TenantUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  role: string;
}

interface InfoProps {
  user: User;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const READ_KEY = 'gsp_read_announcements';
const getReadIds = (): string[] => {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]'); } catch { return []; }
};

const ANNOUNCE_TYPE_CONFIG = {
  INFO:        { icon: InfoIcon,     color: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',   label: 'Information' },
  WARNING:     { icon: AlertTriangle, color: 'bg-amber-50 border-amber-200', text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700', label: 'Avertissement' },
  UPDATE:      { icon: Zap,          color: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700', label: 'Mise à jour' },
  PROMO:       { icon: Tag,          color: 'bg-green-50 border-green-200',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700',  label: 'Offre' },
  MAINTENANCE: { icon: Wrench,       color: 'bg-slate-50 border-slate-200',  text: 'text-slate-700',  badge: 'bg-slate-100 text-slate-600',  label: 'Maintenance' }
};

const NOTIF_TYPE_CONFIG = {
  INFO:    { color: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',    label: 'Info' },
  WARNING: { color: 'bg-amber-50 border-amber-200', text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',  label: 'Avertissement' },
  URGENT:  { color: 'bg-red-50 border-red-200',     text: 'text-red-700',    badge: 'bg-red-100 text-red-700',      label: 'Urgent' },
  PAYROLL: { color: 'bg-violet-50 border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', label: 'Paie' },
  HR:      { color: 'bg-teal-50 border-teal-200',   text: 'text-teal-700',   badge: 'bg-teal-100 text-teal-700',    label: 'RH' },
  LEAVE:   { color: 'bg-green-50 border-green-200', text: 'text-green-700',  badge: 'bg-green-100 text-green-700',  label: 'Congé' }
};

const NOTIF_TYPES = ['INFO', 'WARNING', 'URGENT', 'PAYROLL', 'HR', 'LEAVE'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// ─── Component ───────────────────────────────────────────────────────────────

const Info: React.FC<InfoProps> = ({ user }) => {
  const roles = Array.isArray(user.roles) ? user.roles : [user.role];
  const isAdmin = roles.includes(UserRole.ADMIN) || roles.includes(UserRole.HR_MANAGER);
  const planId = (user as any).planId || 'BASIC';

  // Tab state
  const [activeTab, setActiveTab] = useState<'tenant' | 'system'>('tenant');

  // ── System Announcements ──
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnounce, setLoadingAnnounce] = useState(true);
  const [readIds, setReadIds] = useState<string[]>(getReadIds());

  // ── Tenant Notifications ──
  const [notifications, setNotifications] = useState<TenantNotification[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(true);

  // ── Admin: Send form ──
  const [showSendForm, setShowSendForm] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    body: '',
    type: 'INFO' as typeof NOTIF_TYPES[number],
    targetUserId: '' // '' = broadcast
  });

  // ─── Fetch system announcements ───────────────────────────────────────────
  const fetchAnnouncements = useCallback(async () => {
    setLoadingAnnounce(true);
    try {
      const data = await apiClient.get(`/announcements?planId=${planId}`);
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch {
      setAnnouncements([]);
    } finally {
      setLoadingAnnounce(false);
    }
  }, [planId]);

  // ─── Fetch tenant notifications ───────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setLoadingNotif(true);
    try {
      const data = await apiClient.get('/hr/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoadingNotif(false);
    }
  }, []);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ─── Fetch users list when admin opens send form ──────────────────────────
  useEffect(() => {
    if (showSendForm && isAdmin && tenantUsers.length === 0) {
      setLoadingUsers(true);
      apiClient.get('/hr/notifications/users')
        .then(d => setTenantUsers(Array.isArray(d) ? d : []))
        .catch(() => setTenantUsers([]))
        .finally(() => setLoadingUsers(false));
    }
  }, [showSendForm, isAdmin]);

  // ─── System announcements actions ─────────────────────────────────────────
  const handleMarkAnnounceRead = (id: string) => {
    const ids = getReadIds();
    if (!ids.includes(id)) localStorage.setItem(READ_KEY, JSON.stringify([...ids, id]));
    setReadIds(getReadIds());
    window.dispatchEvent(new Event('storage'));
  };

  const handleMarkAllAnnounceRead = () => {
    localStorage.setItem(READ_KEY, JSON.stringify(announcements.map(a => a.id)));
    setReadIds(getReadIds());
    window.dispatchEvent(new Event('storage'));
  };

  // ─── Tenant notification actions ──────────────────────────────────────────
  const handleMarkRead = async (id: string) => {
    try {
      await apiClient.post(`/hr/notifications/${id}/read`, {});
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post('/hr/notifications/read-all', {});
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette notification ?')) return;
    try {
      await apiClient.delete(`/hr/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* silent */ }
  };

  // ─── Send notification ────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);
    if (!form.title.trim() || !form.body.trim()) {
      setSendError('Titre et message requis');
      return;
    }
    setSending(true);
    try {
      const payload: any = { title: form.title, body: form.body, type: form.type };
      if (form.targetUserId) payload.targetUserId = form.targetUserId;
      const created = await apiClient.post('/hr/notifications', payload);
      setNotifications(prev => [created as TenantNotification, ...prev]);
      setForm({ title: '', body: '', type: 'INFO', targetUserId: '' });
      setShowSendForm(false);
    } catch (err: any) {
      setSendError(err.message || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  // ─── Counts ───────────────────────────────────────────────────────────────
  const announceUnread = announcements.filter(a => !readIds.includes(a.id)).length;
  const notifUnread = notifications.filter(n => !n.isRead).length;
  const totalUnread = announceUnread + notifUnread;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-2xl">
            <Bell size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-widest">Notifications</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {totalUnread > 0 ? `${totalUnread} non lue${totalUnread > 1 ? 's' : ''}` : 'Tout est à jour'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowSendForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              style={{ backgroundColor: 'var(--primary-kernel)', color: '#fff' }}
            >
              {showSendForm ? <X size={13} /> : <Plus size={13} />}
              {showSendForm ? 'Fermer' : 'Envoyer'}
            </button>
          )}
        </div>
      </div>

      {/* ── Admin Send Form ─────────────────────────────────────────────────── */}
      {isAdmin && showSendForm && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone size={16} className="text-indigo-600" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-700">Nouvelle notification</span>
          </div>

          <form onSubmit={handleSend} className="space-y-3">
            {/* Destinataire */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Destinataire</label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Loader2 size={13} className="animate-spin" /> Chargement…
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={form.targetUserId}
                    onChange={e => setForm(f => ({ ...f, targetUserId: e.target.value }))}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">Tous les employés (broadcast)</option>
                    {tenantUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Type</label>
              <div className="flex flex-wrap gap-2">
                {NOTIF_TYPES.map(t => {
                  const cfg = NOTIF_TYPE_CONFIG[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                        form.type === t ? cfg.badge + ' border-current' : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Titre */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Titre</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Mise à jour de la politique de congés"
                maxLength={255}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Message */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Message</label>
              <textarea
                rows={3}
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Rédigez votre notification ici…"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            </div>

            {sendError && (
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{sendError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowSendForm(false); setSendError(null); }}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary-kernel)' }}
              >
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Envoyer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('tenant')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'tenant' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Megaphone size={12} />
          Internes
          {notifUnread > 0 && (
            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded-full">{notifUnread}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'system' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldAlert size={12} />
          Système
          {announceUnread > 0 && (
            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded-full">{announceUnread}</span>
          )}
        </button>
      </div>

      {/* ── Tab: Tenant Notifications ────────────────────────────────────── */}
      {activeTab === 'tenant' && (
        <>
          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              {notifUnread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                >
                  <CheckCheck size={12} /> Tout lu
                </button>
              )}
              <button
                onClick={fetchNotifications}
                className="p-1.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {loadingNotif ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-indigo-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <div className="p-5 bg-slate-100 rounded-3xl">
                <Megaphone size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aucune notification</p>
              <p className="text-[10px] text-slate-400">
                {isAdmin ? 'Cliquez sur "Envoyer" pour notifier vos employés.' : 'Votre responsable n\'a pas encore envoyé de notification.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(notif => {
                const cfg = NOTIF_TYPE_CONFIG[notif.type] || NOTIF_TYPE_CONFIG.INFO;
                const isBroadcast = notif.targetUserId === null;

                return (
                  <div
                    key={notif.id}
                    onClick={() => !notif.isRead && handleMarkRead(notif.id)}
                    className={`relative p-5 rounded-3xl border transition-all ${cfg.color} ${
                      notif.isRead ? 'opacity-60' : 'shadow-sm hover:shadow-md cursor-pointer'
                    }`}
                  >
                    {/* Unread dot */}
                    {!notif.isRead && (
                      <span className="absolute top-4 right-10 w-2.5 h-2.5 bg-rose-500 rounded-full" />
                    )}

                    {/* Admin: delete button */}
                    {isAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(notif.id); }}
                        className="absolute top-3.5 right-3.5 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}

                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                          {isBroadcast ? (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/60 text-slate-500">
                              <Users size={9} /> Tous
                            </span>
                          ) : isAdmin && notif.targetUser ? (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/60 text-slate-500">
                              <UserIcon size={9} /> {notif.targetUser.name}
                            </span>
                          ) : null}
                        </div>

                        <p className={`text-sm font-black ${cfg.text}`}>{notif.title}</p>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.body}</p>

                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                            <Clock size={10} /> {formatDateTime(notif.createdAt)}
                          </span>
                          {notif.sender && (
                            <span className="text-[10px] text-slate-400 font-bold">par {notif.sender.name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Tab: System Announcements ────────────────────────────────────── */}
      {activeTab === 'system' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {announcements.length} annonce{announcements.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              {announceUnread > 0 && (
                <button
                  onClick={handleMarkAllAnnounceRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                >
                  <CheckCheck size={12} /> Tout lu
                </button>
              )}
              <button
                onClick={fetchAnnouncements}
                className="p-1.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {loadingAnnounce ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-indigo-400" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <div className="p-5 bg-slate-100 rounded-3xl">
                <Bell size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aucune annonce système</p>
              <p className="text-[10px] text-slate-400">Vous serez informé ici des mises à jour importantes de la plateforme.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map(item => {
                const isRead = readIds.includes(item.id);
                const cfg = ANNOUNCE_TYPE_CONFIG[item.type] || ANNOUNCE_TYPE_CONFIG.INFO;
                const Icon = cfg.icon;

                return (
                  <div
                    key={item.id}
                    onClick={() => !isRead && handleMarkAnnounceRead(item.id)}
                    className={`relative p-5 rounded-3xl border transition-all cursor-pointer ${cfg.color} ${
                      isRead ? 'opacity-60' : 'shadow-sm hover:shadow-md'
                    } ${item.isPinned ? 'ring-2 ring-offset-1 ring-indigo-300' : ''}`}
                  >
                    {!isRead && (
                      <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                    )}
                    {item.isPinned && (
                      <span className="absolute top-4 right-8 text-[9px] font-black uppercase tracking-widest text-indigo-500">Épinglé</span>
                    )}

                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 flex-shrink-0">
                        <Icon size={18} className={cfg.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                          {item.targetPlan && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/60 text-slate-600">
                              Plan {item.targetPlan}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm font-black ${cfg.text}`}>{item.title}</p>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.body}</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-bold">
                          {formatDate(item.createdAt)} · par {item.createdBy}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Info;
