
import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap, Users, Clock, TrendingUp, ArrowLeft,
  RefreshCw, ChevronRight, Baby, Phone, BookOpen,
  UserCheck, UserX, Search, Plus, Edit3, Trash2,
  Filter, Calendar, User as UserIcon, MoreVertical,
  ArrowRight, ShieldCheck, Info, Save, X
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import { User, Eleve, NiveauScolaire, StatutAdmission } from '../types';
import { POSTES_CRECHE } from './rh/EmployeeList';
import { useAnnee } from '../contexts/AnneeContext';
import { useNiveaux, NiveauDef } from '../contexts/NiveauxContext';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MATIERES_DEFAUT = ['Cours', 'Travaux Pratiques', 'Projet', 'Évaluation'];

// ANNEE_COURANTE provient du contexte useAnnee() dans le composant

const STATUTS_INSCRITS: StatutAdmission[] = ['INSCRIT', 'ACTIF'];
const STATUTS_CANDIDATURES: StatutAdmission[] = ['EN_ATTENTE', 'ADMIS'];

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnseignantMatiere {
  enseignantId: string;
  matiere: string;
}

interface Classe {
  id: string;
  nom: string;
  niveau: NiveauScolaire;
  enseignantId?: string;
  enseignant?: { nom: string; prenom: string; firstName?: string; lastName?: string };
  enseignantsMatiere?: EnseignantMatiere[];
  capaciteMax: number;
  anneeScolaire: string;
  description?: string;
  nbEleves?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAdmissionStatut(d: any): StatutAdmission {
  const s = d.statut || '';
  if (['EN_ATTENTE', 'ADMIS', 'INSCRIT', 'ACTIF', 'RADIE', 'SUSPENDU'].includes(s)) return s as StatutAdmission;
  return 'EN_ATTENTE';
}

function computeCA(services: any[], niveau: NiveauScolaire, nbInscrits: number): number {
  let total = 0;
  for (const s of services) {
    const niveaux: string[] = s.niveauxCibles || s.niveaux_cibles || [];
    const matchNiveau = niveaux.length === 0 || niveaux.includes(niveau);
    if (!matchNiveau) continue;
    const type = (s.typeOffre || s.type_offre || '').toUpperCase();
    const price = Number(s.price || 0);
    const duree = Number(s.dureeMois || s.duree_mois || 1);
    if (type === 'MENSUALITE') {
      total += price * duree * nbInscrits;
    } else if (type === 'INSCRIPTION' || type === 'REINSCRIPTION') {
      total += price * nbInscrits;
    }
  }
  return total;
}

// ─── Composant ───────────────────────────────────────────────────────────────

interface ClassesProps {
  user: User;
  currency: string;
}

const Classes: React.FC<ClassesProps> = ({ user, currency }) => {
  const addToast = useToast();
  const { annee: ANNEE_COURANTE, isReadOnly } = useAnnee();
  const { niveaux: NIVEAUX_DEF } = useNiveaux();
  const CYCLES = Array.from(new Set(NIVEAUX_DEF.map(n => n.cycle)));
  const isAdmin = user.role === 'ADMIN' && !isReadOnly;

  // ── État ───────────────────────────────────────────────────────────────────
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation
  const [viewMode, setViewMode] = useState<'NIVEAUX' | 'CLASSES'>('NIVEAUX');
  const [selectedNiveau, setSelectedNiveau] = useState<NiveauScolaire | null>(null);
  const [detailSearch, setDetailSearch] = useState('');

  // Modals
  const [showClasseModal, setShowClasseModal] = useState(false);
  const [editingClasse, setEditingClasse] = useState<Partial<Classe> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newMatiereEntry, setNewMatiereEntry] = useState<EnseignantMatiere>({ enseignantId: '', matiere: '' });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [elevesData, admissionsData, servicesData, classesData, empData, contractsData] = await Promise.all([
        apiClient.get('/eleves').catch(() => []),
        apiClient.get('/customers').catch(() => []),
        apiClient.get('/services').catch(() => []),
        apiClient.get('/classes', { params: { anneeScolaire: ANNEE_COURANTE } }).catch(() => []),
        apiClient.get('/hr/employees').catch(() => []),
        apiClient.get('/hr/contracts').catch(() => []),
      ]);
      setEleves(Array.isArray(elevesData) ? elevesData : (elevesData?.rows ?? []));
      setAdmissions(Array.isArray(admissionsData) ? admissionsData : (admissionsData?.rows ?? []));
      setServices(Array.isArray(servicesData) ? servicesData : (servicesData?.rows ?? []));
      setClasses(Array.isArray(classesData) ? classesData : (classesData?.rows ?? []));
      setEmployees(Array.isArray(empData) ? empData : (empData?.rows ?? []));
      setContracts(Array.isArray(contractsData) ? contractsData : (contractsData?.rows ?? []));
    } catch (err) {
      console.error('Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Actions CRUD Classes ────────────────────────────────────────────────────

  const handleSaveClasse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClasse?.nom || !editingClasse?.niveau) {
      addToast('Nom et niveau requis', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const payload = { ...editingClasse, anneeScolaire: ANNEE_COURANTE };
      if (editingClasse.id) {
        await apiClient.put(`/classes/${editingClasse.id}`, payload);
        addToast('Classe mise à jour', 'success');
      } else {
        await apiClient.post('/classes', payload);
        addToast('Classe créée', 'success');
      }
      setShowClasseModal(false);
      setEditingClasse(null);
      setNewMatiereEntry({ enseignantId: '', matiere: '' });
      fetchAll();
    } catch (err: any) {
      addToast(err.message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClasse = async (id: string) => {
    if (!window.confirm('Supprimer cette classe ?')) return;
    try {
      await apiClient.delete(`/classes/${id}`);
      addToast('Classe supprimée', 'success');
      fetchAll();
    } catch (err: any) {
      addToast(err.message || 'Erreur lors de la suppression', 'error');
    }
  };

  const handleAssignClasse = async (eleveId: string, classeId: string | null) => {
    try {
      await apiClient.put(`/eleves/${eleveId}`, { classeId });
      addToast('Affectation mise à jour', 'success');
      fetchAll();
    } catch (err: any) {
      addToast('Erreur d\'affectation', 'error');
    }
  };

  // ── Mémos / Stats ──────────────────────────────────────────────────────────

  const globalStats = useMemo(() => {
    const totalInscrits     = eleves.filter(e => STATUTS_INSCRITS.includes(e.statut)).length;
    const totalCA = NIVEAUX_DEF.reduce((sum, n) => {
      const inscrits = eleves.filter(e => e.niveau === n.value && STATUTS_INSCRITS.includes(e.statut));
      return sum + computeCA(services, n.value, inscrits.length);
    }, 0);
    return { totalInscrits, totalCA, totalClasses: classes.length };
  }, [eleves, services, classes]);

  const statsParNiveau = useMemo(() => {
    return NIVEAUX_DEF.map(n => {
      const inscrits     = eleves.filter(e => e.niveau === n.value && STATUTS_INSCRITS.includes(e.statut));
      const ca           = computeCA(services, n.value, inscrits.length);
      const classesNiv   = classes.filter(c => c.niveau === n.value);
      return { ...n, inscrits, ca, classes: classesNiv };
    });
  }, [eleves, services, classes]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading && eleves.length === 0) {
    return (
      <div className="py-32 flex flex-col items-center gap-4 text-slate-400">
        <RefreshCw size={32} className="animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest">Initialisation du module...</p>
      </div>
    );
  }

  // ── Données dérivées pour la vue détail ──────────────────────────────────
  const detailDef = selectedNiveau ? NIVEAUX_DEF.find(n => n.value === selectedNiveau)! : null;
  const elevesNiveau = selectedNiveau ? eleves.filter(e => e.niveau === selectedNiveau) : [];
  const classesNiveau = selectedNiveau ? classes.filter(c => c.niveau === selectedNiveau) : [];
  const filteredEleves = detailSearch
    ? elevesNiveau.filter(e => `${e.nom} ${e.prenom}`.toLowerCase().includes(detailSearch.toLowerCase()))
    : elevesNiveau;

  // ── VUE PRINCIPALE (GRILLE DES NIVEAUX) ───────────────────────────────────

  return (
    <div className="pb-20">

      {/* Bannière lecture seule */}
      {isReadOnly && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800">
          <span className="text-[15px]">🔒</span>
          <p className="text-[11px] font-bold">
            <strong>Mode lecture seule — {ANNEE_COURANTE}.</strong> Cette année est terminée, aucune classe ne peut être créée ou modifiée.
          </p>
        </div>
      )}

      {/* ── VUE DÉTAIL NIVEAU ─────────────────────────────────────────────── */}
      {selectedNiveau && detailDef && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <button onClick={() => setSelectedNiveau(null)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 shadow-sm transition-all">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-xl text-sm font-black border ${detailDef.accentBg} ${detailDef.accentText} ${detailDef.accentBorder}`}>
                    {detailDef.label}
                  </span>
                  Gestion {detailDef.label}
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  {elevesNiveau.length} élèves inscrits · {classesNiveau.length} classes physiques
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <button
                  onClick={() => { setEditingClasse({ niveau: selectedNiveau, nom: `${detailDef.label} ` }); setShowClasseModal(true); }}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
                >
                  <Plus size={14} /> Créer une sous-classe
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {classesNiveau.map(c => (
              <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">
                    {c.nom.split(' ').pop() || 'A'}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setEditingClasse(c); setShowClasseModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 size={14} /></button>
                    <button onClick={() => handleDeleteClasse(c.id)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="text-lg font-black text-slate-900">{c.nom}</p>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Effectif</p>
                    <p className="text-xl font-black text-slate-800">{c.nbEleves || 0} <span className="text-[10px] text-slate-300 font-bold">/ {c.capaciteMax}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Prof. Principal</p>
                    <p className="text-[10px] font-bold text-slate-600">{c.enseignant ? `${c.enseignant.firstName || c.enseignant.prenom || ''} ${c.enseignant.lastName || c.enseignant.nom || ''}`.trim() : 'Non affecté'}</p>
                    {(c.enseignantsMatiere || []).length > 0 && (
                      <p className="text-[8px] font-black text-indigo-500 mt-0.5">+{c.enseignantsMatiere!.length} intervenant{c.enseignantsMatiere!.length > 1 ? 's' : ''}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 h-1.5 bg-slate-50 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, ((c.nbEleves || 0) / c.capaciteMax) * 100)}%` }} />
                </div>
              </div>
            ))}
            {classesNiveau.length === 0 && (
              <div className="col-span-full py-10 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 text-center">
                <Info size={24} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aucune classe physique créée pour ce niveau</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden mt-8">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Liste des élèves & affectation</h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text" placeholder="Filtrer..."
                  value={detailSearch} onChange={e => setDetailSearch(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl pl-9 pr-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4 text-left">Élève</th>
                  <th className="px-6 py-4 text-left">Matricule</th>
                  <th className="px-6 py-4 text-left">Statut</th>
                  <th className="px-6 py-4 text-left">Classe Affectée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredEleves.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4 font-black text-slate-800">{e.prenom} {e.nom}</td>
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400 font-mono">{e.matricule}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${STATUTS_INSCRITS.includes(e.statut) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400'}`}>
                        {e.statut}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={e.classeId || ''}
                        onChange={(opt) => handleAssignClasse(e.id, opt.target.value || null)}
                        className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="">Non affecté</option>
                        {classesNiveau.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VUE PRINCIPALE (GRILLE DES NIVEAUX) ──────────────────────────── */}
      {!selectedNiveau && (
      <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header & Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-4">
            <BookOpen className="text-indigo-600" size={32} />
            Espace Pédagogique
          </h2>
          <div className="flex items-center gap-3 mt-1">
             <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Gestion des classes physiques et effectifs</p>
             <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
             <p className="text-indigo-600 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Année {ANNEE_COURANTE}</p>
          </div>
        </div>
        
        <div className="flex gap-2 p-1 bg-white border border-slate-100 rounded-2xl shadow-sm">
           <button onClick={() => setViewMode('NIVEAUX')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'NIVEAUX' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}>Par Niveau</button>
           <button onClick={() => setViewMode('CLASSES')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'CLASSES' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}>Toutes les classes</button>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         {[
           { label: 'Inscrits & Actifs', value: globalStats.totalInscrits, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
           { label: 'Classes Physiques', value: globalStats.totalClasses, icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
           { label: 'CA Prévisionnel', value: globalStats.totalCA.toLocaleString('fr-FR') + ' ' + currency, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
           { label: 'Capacité Totale', value: classes.reduce((s, c) => s + c.capaciteMax, 0), icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
         ].map(k => (
           <div key={k.label} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
             <div className={`w-12 h-12 ${k.bg} rounded-xl flex items-center justify-center shrink-0 shadow-sm`}>
               <k.icon className={k.color} size={22} />
             </div>
             <div>
               <p className="text-2xl font-black text-slate-900 leading-none">{k.value}</p>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{k.label}</p>
             </div>
           </div>
         ))}
      </div>

      {viewMode === 'NIVEAUX' ? (
        <div className="space-y-12">
          {CYCLES.map(cycle => {
            const niveaux = statsParNiveau.filter(n => n.cycle === cycle);
            return (
              <div key={cycle} className="space-y-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.4em]">{cycle}</h3>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {niveaux.map(n => (
                     <button
                       key={n.value}
                       onClick={() => setSelectedNiveau(n.value)}
                       className={`bg-white p-8 rounded-[3rem] border ${n.accentBorder} text-left group hover:shadow-2xl hover:-translate-y-1 transition-all relative overflow-hidden`}
                     >
                        <div className="flex items-center justify-between mb-8">
                           <span className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${n.accentBg} ${n.accentText} ${n.accentBorder}`}>
                             {n.label}
                           </span>
                           <div className="w-10 h-10 bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white rounded-2xl flex items-center justify-center transition-all">
                             <ChevronRight size={18} />
                           </div>
                        </div>
                        
                        <div className="flex items-end justify-between">
                           <div>
                              <p className="text-4xl font-black text-slate-900 tracking-tighter">{n.inscrits.length}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Élèves inscrits</p>
                           </div>
                           <div className="text-right">
                              <p className="text-lg font-black text-slate-700">{n.classes.length}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sous-classes</p>
                           </div>
                        </div>

                        {/* Progression bar for level CA vs total ? or capacity */}
                        <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                             <TrendingUp size={12} className="text-indigo-500" /> Prévisionnel
                           </span>
                           <span className="text-sm font-black text-slate-900">{n.ca.toLocaleString('fr-FR')} {currency}</span>
                        </div>
                     </button>
                   ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VUE TOUTES LES CLASSES (TABLEAU) */
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between flex-wrap gap-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Registre Global des Classes ({classes.length})</h3>
            <button
               onClick={() => { setEditingClasse({ nom: '', niveau: 'PS' as any }); setShowClasseModal(true); }}
               className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-2"
            >
              <Plus size={14} /> Nouvelle Classe
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5 text-left">Classe / Nom</th>
                <th className="px-8 py-5 text-left">Niveau</th>
                <th className="px-8 py-5 text-left">Équipe Pédagogique</th>
                <th className="px-8 py-5 text-left">Effectif</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {classes.map(c => {
                const def = NIVEAUX_DEF.find(n => n.value === c.niveau);
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-8 py-5">
                       <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${def?.accentBg || 'bg-slate-100'} ${def?.accentText || 'text-slate-600'}`}>
                            {c.nom.charAt(0)}
                          </div>
                          <span className="font-black text-slate-900">{c.nom}</span>
                       </div>
                    </td>
                    <td className="px-8 py-5">
                       <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${def?.accentBg} ${def?.accentText} ${def?.accentBorder}`}>
                         {def?.label}
                       </span>
                    </td>
                    <td className="px-8 py-5">
                       <div className="flex flex-col gap-0.5">
                         <div className="flex items-center gap-2">
                           <UserIcon size={14} className="text-slate-300" />
                           <span className="text-[11px] font-bold text-slate-600">{c.enseignant ? `${c.enseignant.firstName || c.enseignant.prenom || ''} ${c.enseignant.lastName || c.enseignant.nom || ''}`.trim() : 'Non assigné'}</span>
                         </div>
                         {(c.enseignantsMatiere || []).length > 0 && (
                           <span className="text-[9px] font-black text-indigo-500 ml-6">
                             +{c.enseignantsMatiere!.length} intervenant{c.enseignantsMatiere!.length > 1 ? 's' : ''}
                           </span>
                         )}
                       </div>
                    </td>
                    <td className="px-8 py-5">
                       <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-900">{c.nbEleves || 0}</span>
                          <span className="text-xs text-slate-300 font-bold">/ {c.capaciteMax}</span>
                       </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setEditingClasse(c); setShowClasseModal(true); }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit3 size={16} /></button>
                          <button onClick={() => handleDeleteClasse(c.id)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
      )}

      {/* ── MODAL CLASSE ── */}
      {showClasseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-10 border-b border-slate-50">
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{editingClasse?.id ? 'Modifier la classe' : 'Nouvelle classe'}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Créez une section physique (ex: CE1 A, CE1 B)</p>
            </div>
            
            <form onSubmit={handleSaveClasse} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
                  Niveau Scolaire
                  {selectedNiveau && !editingClasse?.id && (
                    <span className="ml-2 text-indigo-500 normal-case font-bold">— verrouillé</span>
                  )}
                </label>
                {selectedNiveau && !editingClasse?.id ? (
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black text-slate-500 cursor-not-allowed flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border ${NIVEAUX_DEF.find(n => n.value === selectedNiveau)?.accentBg} ${NIVEAUX_DEF.find(n => n.value === selectedNiveau)?.accentText} ${NIVEAUX_DEF.find(n => n.value === selectedNiveau)?.accentBorder}`}>
                      {NIVEAUX_DEF.find(n => n.value === selectedNiveau)?.label}
                    </span>
                  </div>
                ) : (
                  <select
                    value={editingClasse?.niveau || ''}
                    onChange={e => setEditingClasse({ ...editingClasse, niveau: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10"
                    required
                  >
                    <option value="">Sélectionner un niveau</option>
                    {NIVEAUX_DEF.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Nom de la classe (ex: CE1 A)</label>
                <input
                  type="text"
                  value={editingClasse?.nom || ''}
                  onChange={e => setEditingClasse({ ...editingClasse, nom: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10"
                  placeholder="Nom de la section"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Capacité Max</label>
                  <input
                    type="number"
                    value={editingClasse?.capaciteMax || 30}
                    onChange={e => setEditingClasse({ ...editingClasse, capaciteMax: parseInt(e.target.value) || 30 })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Année Scolaire</label>
                  <input
                    type="text"
                    value={ANNEE_COURANTE}
                    disabled
                    className="w-full bg-slate-100 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>

              {(() => {
                const niveauModal = editingClasse?.niveau as NiveauScolaire | undefined;
                const allActiveEmployees = employees.filter(emp =>
                  contracts.some(c => String(c.employeeId) === String(emp.id) && c.status === 'ACTIVE')
                );
                const enseignantsDispo = allActiveEmployees;
                const posteLabels = '';

                const autresClasses = classes.filter(c => c.id !== editingClasse?.id);
                const affectationsParEnseignant: Record<string, string[]> = {};
                for (const c of autresClasses) {
                  if (c.enseignantId) {
                    if (!affectationsParEnseignant[c.enseignantId]) affectationsParEnseignant[c.enseignantId] = [];
                    affectationsParEnseignant[c.enseignantId].push(c.nom);
                  }
                }

                const selectedEmp = enseignantsDispo.find(e => e.id === editingClasse?.enseignantId);
                const affectationsSelected = selectedEmp ? (affectationsParEnseignant[selectedEmp.id] ?? []) : [];

                return (
                  <>
                    {/* ── Professeur Principal ── */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Professeur Principal</label>
                        {niveauModal && (
                          <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">
                            {enseignantsDispo.length} disponible{enseignantsDispo.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {niveauModal && posteLabels && (
                        <p className="text-[9px] text-slate-400 font-bold px-2">Postes compatibles : {posteLabels}</p>
                      )}
                      <select
                        value={editingClasse?.enseignantId || ''}
                        onChange={e => setEditingClasse({ ...editingClasse, enseignantId: e.target.value || undefined })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10"
                      >
                        <option value="">— Aucun professeur principal —</option>
                        {enseignantsDispo.map(emp => {
                          const poste = POSTES_CRECHE.find(p => p.value === emp.position);
                          const nom = `${emp.prenom || emp.firstName || ''} ${emp.nom || emp.lastName || ''}`.trim();
                          const autresAffect = affectationsParEnseignant[emp.id];
                          const suffixe = autresAffect?.length ? ` (aussi dans : ${autresAffect.join(', ')})` : '';
                          return (
                            <option key={emp.id} value={emp.id}>
                              {nom}{poste ? ` · ${poste.label}` : ''}{suffixe}
                            </option>
                          );
                        })}
                      </select>
                      {affectationsSelected.length > 0 && (
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest px-2">
                          ℹ Déjà responsable de : {affectationsSelected.join(', ')}
                        </p>
                      )}
                      {niveauModal && enseignantsDispo.length === 0 && (
                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest px-2">
                          ⚠ Aucun enseignant avec un contrat actif pour ce niveau
                        </p>
                      )}
                    </div>

                    {/* ── Autres intervenants par matière ── */}
                    <div className="space-y-3 pt-2 border-t border-slate-50">
                      <div className="flex items-center gap-2 px-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Autres Intervenants</label>
                        <span className="text-[8px] text-slate-300 font-bold">— anglais, EPS, musique…</span>
                      </div>

                      {(editingClasse?.enseignantsMatiere || []).length > 0 && (
                        <div className="space-y-2">
                          {(editingClasse!.enseignantsMatiere || []).map((em, idx) => {
                            const emp = employees.find(e => String(e.id) === String(em.enseignantId));
                            const empNom = emp
                              ? `${emp.prenom || emp.firstName || ''} ${emp.nom || emp.lastName || ''}`.trim()
                              : 'Inconnu';
                            return (
                              <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                                    {em.matiere}
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-700">{empNom}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEditingClasse({
                                    ...editingClasse,
                                    enseignantsMatiere: (editingClasse!.enseignantsMatiere || []).filter((_, i) => i !== idx)
                                  })}
                                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {niveauModal && (
                        <div className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest px-1">Matière</p>
                            <select
                              value={newMatiereEntry.matiere}
                              onChange={e => setNewMatiereEntry(p => ({ ...p, matiere: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-3 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-500/10"
                            >
                              <option value="">— Matière —</option>
                              {MATIERES_DEFAUT.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest px-1">Enseignant</p>
                            <select
                              value={newMatiereEntry.enseignantId}
                              onChange={e => setNewMatiereEntry(p => ({ ...p, enseignantId: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-3 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-500/10"
                            >
                              <option value="">— Enseignant —</option>
                              {allActiveEmployees.map(emp => {
                                const nom = `${emp.prenom || emp.firstName || ''} ${emp.nom || emp.lastName || ''}`.trim();
                                return <option key={emp.id} value={emp.id}>{nom}</option>;
                              })}
                            </select>
                          </div>
                          <button
                            type="button"
                            disabled={!newMatiereEntry.matiere || !newMatiereEntry.enseignantId}
                            onClick={() => {
                              setEditingClasse({
                                ...editingClasse,
                                enseignantsMatiere: [...(editingClasse?.enseignantsMatiere || []), { ...newMatiereEntry }]
                              });
                              setNewMatiereEntry({ enseignantId: '', matiere: '' });
                            }}
                            className="p-3 bg-indigo-600 text-white rounded-xl disabled:opacity-30 hover:bg-slate-900 transition-all shrink-0 self-end"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => { setShowClasseModal(false); setEditingClasse(null); setNewMatiereEntry({ enseignantId: '', matiere: '' }); }}
                  className="flex-1 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Classes;
