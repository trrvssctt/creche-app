import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen, GraduationCap, CheckCircle2, AlertCircle, Clock,
  Search, X, Printer, Send, Eye, Edit3,
  Baby, Users, Award, RefreshCw,
  CheckSquare, Circle, MinusCircle, Save, Lock, Archive,
  ChevronLeft, ChevronRight, Phone, Calendar, MapPin,
  ArrowRight, User as UserIcon, BarChart2,
} from 'lucide-react';
import { authBridge } from '../services/authBridge';
import { apiClient } from '../services/api';
import { useToast } from './ToastProvider';
import { User, NiveauScolaire, Trimestre, NiveauCompetence } from '../types';
import { useAnnee } from '../contexts/AnneeContext';

// ─── Types locaux ─────────────────────────────────────────────────────────────

type CycleType = 'MATERNELLE' | 'ELEMENTAIRE' | 'CRECHE';

interface CompetenceForm {
  libelle: string;
  niveau: NiveauCompetence | '';
}

interface DomaineForm {
  nom: string;
  competences: CompetenceForm[];
}

interface SousMatiereForm {
  nom: string;
  coefficient: number;
  note: number | '';
}

interface MatiereForm {
  nom: string;
  coefficient: number;
  sousMatieres: SousMatiereForm[];
  appreciation: string;
}

interface BulletinLocal {
  id?: string;
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  niveau: NiveauScolaire;
  trimestre: Trimestre;
  anneeScolaire: string;
  domaines?: DomaineForm[];
  appreciationGenerale?: string;
  matieres?: MatiereForm[];
  moyenneGenerale?: number;
  rang?: number;
  publie: boolean;
  datePublication?: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

// ANNEE_COURANTE provient du contexte useAnnee() dans le composant

const TRIMESTRES: { value: Trimestre; label: string; mois: string }[] = [
  { value: 'T1', label: 'Trimestre 1', mois: 'Décembre' },
  { value: 'T2', label: 'Trimestre 2', mois: 'Mars' },
  { value: 'T3', label: 'Trimestre 3', mois: 'Juin' },
];

const NIVEAUX: { value: NiveauScolaire; label: string; cycle: CycleType }[] = [
  { value: 'CRECHE', label: 'Crèche',         cycle: 'CRECHE' },
  { value: 'PS',     label: 'Petite Section',  cycle: 'MATERNELLE' },
  { value: 'MS',     label: 'Moyenne Section', cycle: 'MATERNELLE' },
  { value: 'GS',     label: 'Grande Section',  cycle: 'MATERNELLE' },
  { value: 'CP',     label: 'CP',              cycle: 'ELEMENTAIRE' },
  { value: 'CE1',    label: 'CE1',             cycle: 'ELEMENTAIRE' },
  { value: 'CE2',    label: 'CE2',             cycle: 'ELEMENTAIRE' },
  { value: 'CM1',    label: 'CM1',             cycle: 'ELEMENTAIRE' },
  { value: 'CM2',    label: 'CM2',             cycle: 'ELEMENTAIRE' },
];

const CYCLE_CONFIG: Record<CycleType, { label: string; color: string; bg: string; border: string; dot: string }> = {
  CRECHE:      { label: 'Crèche',      color: 'text-rose-600',   bg: 'bg-rose-50',    border: 'border-rose-200',   dot: 'bg-rose-500' },
  MATERNELLE:  { label: 'Maternelle',  color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-200', dot: 'bg-purple-500' },
  ELEMENTAIRE: { label: 'Élémentaire', color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-200', dot: 'bg-indigo-500' },
};

function getCycle(niveau: NiveauScolaire): CycleType {
  return NIVEAUX.find(n => n.value === niveau)?.cycle ?? 'MATERNELLE';
}

// ─── Compétences Maternelle ───────────────────────────────────────────────────

const DOMAINES_CRECHE: DomaineForm[] = [
  { nom: 'Éveil Sensoriel', competences: [
    { libelle: 'Réactions aux stimuli visuels', niveau: '' },
    { libelle: 'Réactions aux stimuli sonores', niveau: '' },
    { libelle: 'Exploration tactile des objets', niveau: '' },
    { libelle: 'Coordination œil-main', niveau: '' },
  ]},
  { nom: 'Motricité Globale', competences: [
    { libelle: 'Tenue de tête et du buste', niveau: '' },
    { libelle: 'Retournements / roulades', niveau: '' },
    { libelle: 'Position assise stable', niveau: '' },
    { libelle: 'Déplacements (4 pattes / marche)', niveau: '' },
  ]},
  { nom: 'Communication & Éveil Social', competences: [
    { libelle: 'Sourires et vocalises spontanées', niveau: '' },
    { libelle: 'Réponse à son prénom', niveau: '' },
    { libelle: 'Imitation de sons / gestes', niveau: '' },
    { libelle: 'Interactions avec les adultes', niveau: '' },
  ]},
  { nom: 'Autonomie & Vie Quotidienne', competences: [
    { libelle: 'Tenue du biberon / cuillère', niveau: '' },
    { libelle: 'Signalement des besoins', niveau: '' },
    { libelle: 'Rythme sommeil / éveil', niveau: '' },
  ]},
];

const DOMAINES_PS: DomaineForm[] = [
  { nom: 'Motricité Globale', competences: [
    { libelle: 'Courir sans tomber', niveau: '' },
    { libelle: 'Sauter à pieds joints', niveau: '' },
    { libelle: 'Monter et descendre des escaliers', niveau: '' },
    { libelle: 'Lancer et attraper une balle', niveau: '' },
  ]},
  { nom: 'Motricité Fine & Graphisme', competences: [
    { libelle: 'Tenir le crayon correctement', niveau: '' },
    { libelle: 'Tracer des traits et des ronds', niveau: '' },
    { libelle: "Découper le long d'un trait", niveau: '' },
    { libelle: 'Coller avec de la colle', niveau: '' },
  ]},
  { nom: 'Langage Oral', competences: [
    { libelle: "S'exprimer en phrases courtes", niveau: '' },
    { libelle: 'Écouter une histoire sans interrompre', niveau: '' },
    { libelle: 'Répondre à des questions simples', niveau: '' },
    { libelle: 'Mémoriser une comptine', niveau: '' },
  ]},
  { nom: 'Découverte du Monde', competences: [
    { libelle: 'Reconnaître les couleurs primaires', niveau: '' },
    { libelle: 'Trier des objets par forme', niveau: '' },
    { libelle: 'Comprendre les notions grand/petit', niveau: '' },
    { libelle: "Dénombrer jusqu'à 5", niveau: '' },
  ]},
  { nom: 'Vie Sociale & Autonomie', competences: [
    { libelle: 'Respecter les règles de vie de classe', niveau: '' },
    { libelle: 'Attendre son tour', niveau: '' },
    { libelle: 'Jouer avec les autres sans conflit majeur', niveau: '' },
    { libelle: "S'habiller et se déshabiller seul", niveau: '' },
  ]},
  { nom: 'Activités Artistiques', competences: [
    { libelle: 'Chanter une chanson connue', niveau: '' },
    { libelle: 'Participer aux activités de dessin/peinture', niveau: '' },
    { libelle: 'Explorer différents matériaux', niveau: '' },
  ]},
];

const DOMAINES_MS: DomaineForm[] = [
  { nom: 'Motricité Globale', competences: [
    { libelle: 'Galoper, sauter, courir avec aisance', niveau: '' },
    { libelle: 'Tenir en équilibre sur un pied', niveau: '' },
    { libelle: 'Réaliser un parcours moteur', niveau: '' },
    { libelle: 'Maîtriser la balle (lancer précis)', niveau: '' },
  ]},
  { nom: 'Motricité Fine & Graphisme', competences: [
    { libelle: 'Utiliser les ciseaux avec précision', niveau: '' },
    { libelle: 'Reproduire des motifs graphiques', niveau: '' },
    { libelle: 'Assembler et coller avec soin', niveau: '' },
    { libelle: 'Maîtrise du tracé (pression, direction)', niveau: '' },
  ]},
  { nom: 'Langage Oral', competences: [
    { libelle: 'Raconter un événement vécu', niveau: '' },
    { libelle: 'Décrire une image avec détails', niveau: '' },
    { libelle: 'Écoute active et réponses pertinentes', niveau: '' },
    { libelle: 'Poser des questions sur le monde', niveau: '' },
  ]},
  { nom: 'Langage Écrit & Lecture Précoce', competences: [
    { libelle: 'Reconnaître son prénom écrit', niveau: '' },
    { libelle: 'Écrire son prénom en capitales', niveau: '' },
    { libelle: 'Reconnaître quelques lettres', niveau: '' },
    { libelle: "Initiation à l'écriture cursive", niveau: '' },
  ]},
  { nom: 'Logique & Mathématiques', competences: [
    { libelle: "Compter jusqu'à 10 avec correspondance", niveau: '' },
    { libelle: 'Sérier et classer des objets', niveau: '' },
    { libelle: 'Comparer des quantités (plus / moins)', niveau: '' },
    { libelle: 'Reproduire une suite rythmique', niveau: '' },
  ]},
  { nom: 'Vie Sociale & Autonomie', competences: [
    { libelle: 'Gérer de petits conflits avec les mots', niveau: '' },
    { libelle: 'Aider ses camarades', niveau: '' },
    { libelle: 'Respecter les adultes et les règles', niveau: '' },
    { libelle: 'Autonomie dans les gestes quotidiens', niveau: '' },
  ]},
];

const DOMAINES_GS: DomaineForm[] = [
  { nom: 'Motricité & Psychomotricité', competences: [
    { libelle: 'Enchaîner des mouvements complexes', niveau: '' },
    { libelle: 'Équilibre sur pied et poutre', niveau: '' },
    { libelle: 'Participer aux activités collectives', niveau: '' },
    { libelle: 'Endurance et coordination', niveau: '' },
  ]},
  { nom: 'Graphisme & Écriture', competences: [
    { libelle: 'Écriture cursive : lettres minuscules', niveau: '' },
    { libelle: 'Copier des mots en cursive', niveau: '' },
    { libelle: 'Reproduire des modèles complexes', niveau: '' },
    { libelle: 'Dictée de syllabes simples', niveau: '' },
  ]},
  { nom: 'Langage Oral', competences: [
    { libelle: 'S\'exprimer clairement et structurément', niveau: '' },
    { libelle: 'Mémoriser et réciter des poèmes', niveau: '' },
    { libelle: 'Raconter une histoire inventée', niveau: '' },
    { libelle: "Reformuler les propos d'un camarade", niveau: '' },
  ]},
  { nom: 'Lecture & Conscience Phonologique', competences: [
    { libelle: 'Reconnaître les sons et syllabes', niveau: '' },
    { libelle: 'Déchiffrer des syllabes simples', niveau: '' },
    { libelle: 'Associer sons et lettres (correspondances)', niveau: '' },
    { libelle: 'Lecture globale de mots familiers', niveau: '' },
  ]},
  { nom: 'Mathématiques', competences: [
    { libelle: "Compter jusqu'à 30 et au-delà", niveau: '' },
    { libelle: 'Effectuer des additions simples', niveau: '' },
    { libelle: 'Reconnaître pair / impair', niveau: '' },
    { libelle: 'Mesurer et comparer des grandeurs', niveau: '' },
  ]},
  { nom: 'Découverte du Monde', competences: [
    { libelle: 'Observer et formuler des hypothèses', niveau: '' },
    { libelle: 'Situer dans le temps (avant / après)', niveau: '' },
    { libelle: 'Distinguer vivant / non-vivant', niveau: '' },
    { libelle: 'Décrire son environnement proche', niveau: '' },
  ]},
  { nom: 'Vie Sociale & Responsabilités', competences: [
    { libelle: 'Assumer des responsabilités de classe', niveau: '' },
    { libelle: "Participer à un projet collectif", niveau: '' },
    { libelle: 'Entraide et coopération', niveau: '' },
    { libelle: 'Respect du travail personnel et des autres', niveau: '' },
  ]},
];

function getDomainesParNiveau(niveau: NiveauScolaire): DomaineForm[] {
  const deep = (src: DomaineForm[]): DomaineForm[] =>
    src.map(d => ({
      nom: d.nom,
      competences: d.competences.map(c => ({ libelle: c.libelle, niveau: '' as NiveauCompetence | '' })),
    }));
  if (niveau === 'CRECHE') return deep(DOMAINES_CRECHE);
  if (niveau === 'PS')     return deep(DOMAINES_PS);
  if (niveau === 'MS')     return deep(DOMAINES_MS);
  return deep(DOMAINES_GS);
}

// ─── Matières Élémentaire ─────────────────────────────────────────────────────

function getMatieresParNiveau(niveau: NiveauScolaire): MatiereForm[] {
  const sm = (nom: string, coeff: number): SousMatiereForm => ({ nom, coefficient: coeff, note: '' });

  const CP: MatiereForm[] = [
    { nom: 'Français', coefficient: 3, appreciation: '', sousMatieres: [
      sm('Lecture & Déchiffrage', 1.5), sm('Écriture & Copie', 1), sm('Expression Orale', 0.5),
    ]},
    { nom: 'Mathématiques', coefficient: 3, appreciation: '', sousMatieres: [
      sm('Numération & Dénombrement', 1.5), sm('Calcul Mental', 1), sm('Géométrie & Formes', 0.5),
    ]},
    { nom: 'Découverte du Monde', coefficient: 1, appreciation: '', sousMatieres: [
      sm('Sciences & Vie', 0.5), sm('Vivre Ensemble', 0.5),
    ]},
    { nom: 'Éducation Physique & Sportive', coefficient: 1, appreciation: '', sousMatieres: [sm('EPS', 1)]},
    { nom: 'Arts & Culture', coefficient: 0.5, appreciation: '', sousMatieres: [sm('Arts Plastiques', 0.5)]},
  ];

  const CE1_CE2: MatiereForm[] = [
    { nom: 'Français', coefficient: 4, appreciation: '', sousMatieres: [
      sm('Lecture & Compréhension', 1), sm('Grammaire', 0.75), sm('Conjugaison', 0.75),
      sm('Orthographe & Dictée', 1), sm('Expression Écrite', 0.5),
    ]},
    { nom: 'Mathématiques', coefficient: 4, appreciation: '', sousMatieres: [
      sm('Numération & Calcul', 1.5), sm('Problèmes', 1.5), sm('Géométrie & Mesure', 1),
    ]},
    { nom: 'Sciences & Vie', coefficient: 1, appreciation: '', sousMatieres: [
      sm('Sciences & Technologie', 0.5), sm('Éducation Civique', 0.5),
    ]},
    { nom: 'Histoire & Géographie', coefficient: 1, appreciation: '', sousMatieres: [
      sm('Histoire', 0.5), sm('Géographie', 0.5),
    ]},
    { nom: 'Anglais', coefficient: 1, appreciation: '', sousMatieres: [sm('Anglais', 1)]},
    { nom: 'Éducation Physique & Sportive', coefficient: 0.5, appreciation: '', sousMatieres: [sm('EPS', 0.5)]},
    { nom: 'Arts & Culture', coefficient: 0.5, appreciation: '', sousMatieres: [sm('Arts Plastiques', 0.5)]},
  ];

  const CM1_CM2: MatiereForm[] = [
    { nom: 'Français', coefficient: 4, appreciation: '', sousMatieres: [
      sm('Lecture & Compréhension', 1), sm('Grammaire', 0.75), sm('Conjugaison', 0.75),
      sm('Orthographe', 1), sm('Rédaction', 0.5),
    ]},
    { nom: 'Mathématiques', coefficient: 4, appreciation: '', sousMatieres: [
      sm('Calcul & Numération', 1.5), sm('Problèmes', 1.5), sm('Géométrie & Mesures', 1),
    ]},
    { nom: 'Sciences & Technologie', coefficient: 1.5, appreciation: '', sousMatieres: [
      sm('Sciences & Vie', 1), sm('Technologie', 0.5),
    ]},
    { nom: 'Histoire & Géographie', coefficient: 1.5, appreciation: '', sousMatieres: [
      sm('Histoire', 0.75), sm('Géographie', 0.75),
    ]},
    { nom: 'Anglais', coefficient: 1.5, appreciation: '', sousMatieres: [sm('Anglais', 1.5)]},
    { nom: 'Morale & Instruction Civique', coefficient: 1, appreciation: '', sousMatieres: [sm('Morale & Civisme', 1)]},
    { nom: 'Éducation Physique & Sportive', coefficient: 0.5, appreciation: '', sousMatieres: [sm('EPS', 0.5)]},
  ];

  if (niveau === 'CP') return CP;
  if (niveau === 'CE1' || niveau === 'CE2') return CE1_CE2;
  return CM1_CM2;
}

// ─── Calculs ──────────────────────────────────────────────────────────────────

function calcMoyenneMatiere(m: MatiereForm): number {
  const sms = m.sousMatieres.filter(s => s.note !== '');
  if (!sms.length) return 0;
  const totalPts = sms.reduce((acc, s) => acc + (Number(s.note) * s.coefficient), 0);
  const totalCoeff = sms.reduce((acc, s) => acc + s.coefficient, 0);
  return totalCoeff > 0 ? Math.round((totalPts / totalCoeff) * 100) / 100 : 0;
}

function calcMoyenneGenerale(matieres: MatiereForm[]): number {
  const actives = matieres.filter(m => m.sousMatieres.some(s => s.note !== ''));
  if (!actives.length) return 0;
  const totalPts = actives.reduce((acc, m) => acc + calcMoyenneMatiere(m) * m.coefficient, 0);
  const totalCoeff = actives.reduce((acc, m) => acc + m.coefficient, 0);
  return totalCoeff > 0 ? Math.round((totalPts / totalCoeff) * 100) / 100 : 0;
}

function moyenneColor(moy: number): string {
  if (moy >= 16) return 'text-emerald-600';
  if (moy >= 14) return 'text-blue-600';
  if (moy >= 12) return 'text-amber-600';
  if (moy >= 10) return 'text-orange-600';
  return 'text-rose-600';
}

function moyenneBg(moy: number): string {
  if (moy >= 16) return 'bg-emerald-50 border-emerald-200';
  if (moy >= 14) return 'bg-blue-50 border-blue-200';
  if (moy >= 12) return 'bg-amber-50 border-amber-200';
  if (moy >= 10) return 'bg-orange-50 border-orange-200';
  return 'bg-rose-50 border-rose-200';
}

function appreciationFromMoyenne(moy: number): string {
  if (moy >= 18) return 'Excellent';
  if (moy >= 16) return 'Très bien';
  if (moy >= 14) return 'Bien';
  if (moy >= 12) return 'Assez bien';
  if (moy >= 10) return 'Passable';
  return 'Insuffisant';
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props { user: User }

export default function Bulletins({ user }: Props) {
  const { addToast } = useToast();
  const { annee: ANNEE_COURANTE, isReadOnly, isAnneeCloturee } = useAnnee();
  const canModify = authBridge.hasPermission(user.role, 'bulletins', 'write') && !isReadOnly;

  // ── Navigation état ────────────────────────────────────────────────────────
  const [viewStep, setViewStep] = useState<'CLASSES' | 'ELEVES'>('CLASSES');
  const [selectedClasse, setSelectedClasse] = useState<NiveauScolaire | null>(null);

  // ── Données ────────────────────────────────────────────────────────────────
  const [eleves, setEleves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrimestre, setSelectedTrimestre] = useState<Trimestre>('T1');
  const [search, setSearch] = useState('');
  const [bulletins, setBulletins] = useState<Record<string, BulletinLocal>>({});

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [modalMode, setModalMode] = useState<'EDIT' | 'VIEW' | null>(null);
  const [selectedEleve, setSelectedEleve] = useState<any>(null);
  const [bulletinForm, setBulletinForm] = useState<BulletinLocal | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailEleve, setDetailEleve] = useState<any>(null);

  // ── Chargement ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchEleves = async () => {
      try {
        const data = await apiClient.get('/eleves');
        // Accepter les élèves ACTIFS, INSCRITS ou ADMIS
        const filtered = Array.isArray(data) ? data.filter((e: any) => 
          ['ACTIF', 'INSCRIT', 'ADMIS'].includes(e.statut) || !e.statut
        ) : [];
        setEleves(filtered);
      } catch {
        setEleves([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEleves();
  }, []);

  // Charger les bulletins pour le trimestre et l'année en cours
  useEffect(() => {
    const fetchBulletins = async () => {
      try {
        const data = await apiClient.get('/bulletins', {
          params: {
            anneeScolaire: ANNEE_COURANTE,
            trimestre: selectedTrimestre
          }
        });
        if (Array.isArray(data)) {
          const map: Record<string, BulletinLocal> = {};
          data.forEach((b: any) => {
            map[bulletinKey(b.eleveId, b.trimestre)] = {
              ...b,
              eleveNom: b.eleve?.nom || '',
              elevePrenom: b.eleve?.prenom || ''
            };
          });
          setBulletins(map);
        }
      } catch (err) {
        console.error('Erreur chargement bulletins:', err);
      }
    };
    fetchBulletins();
  }, [selectedTrimestre]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function bulletinKey(eleveId: string, trimestre: Trimestre) { return `${eleveId}_${trimestre}`; }
  function getBulletin(eleveId: string): BulletinLocal | undefined {
    return bulletins[bulletinKey(eleveId, selectedTrimestre)];
  }
  const niveauLabel = (n: NiveauScolaire) => NIVEAUX.find(x => x.value === n)?.label ?? n;

  // ── Statistiques par classe (pour les cartes) ──────────────────────────────

  const classeStats = useMemo(() => {
    return NIVEAUX.map(n => {
      const elevesNiveau = eleves.filter(e => e.niveau === n.value);
      const total = elevesNiveau.length;
      if (total === 0) return null;
      const publies    = elevesNiveau.filter(e =>  getBulletin(e.id)?.publie).length;
      const brouillons = elevesNiveau.filter(e => { const b = getBulletin(e.id); return b && !b.publie; }).length;
      const aFaire     = total - publies - brouillons;
      const pctPublie  = total > 0 ? Math.round((publies / total) * 100) : 0;
      return { ...n, total, publies, brouillons, aFaire, pctPublie };
    }).filter(Boolean) as (typeof NIVEAUX[0] & { total: number; publies: number; brouillons: number; aFaire: number; pctPublie: number })[];
  }, [eleves, bulletins, selectedTrimestre]);

  // KPIs globaux
  const statsGlobales = useMemo(() => {
    const total     = eleves.length;
    const publies   = eleves.filter(e => getBulletin(e.id)?.publie).length;
    const brouillons = eleves.filter(e => { const b = getBulletin(e.id); return b && !b.publie; }).length;
    const aFaire    = total - publies - brouillons;
    return { total, publies, brouillons, aFaire };
  }, [eleves, bulletins, selectedTrimestre]);

  // ── Élèves dans la classe sélectionnée (filtrés + recherche) ──────────────

  const elevesInClasse = useMemo(() => {
    if (!selectedClasse) return [];
    return eleves.filter(e => {
      const matchNiveau = e.niveau === selectedClasse;
      const matchSearch = !search
        || `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase())
        || e.matricule?.toLowerCase().includes(search.toLowerCase());
      return matchNiveau && matchSearch;
    });
  }, [eleves, selectedClasse, search]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  function enterClasse(niveau: NiveauScolaire) {
    setSelectedClasse(niveau);
    setSearch('');
    setViewStep('ELEVES');
  }

  function backToClasses() {
    setViewStep('CLASSES');
    setSelectedClasse(null);
    setSearch('');
  }

  // ── Ouverture modals bulletin ──────────────────────────────────────────────

  function openEdit(eleve: any) {
    const existing = getBulletin(eleve.id);
    const cycle = getCycle(eleve.niveau || 'PS');
    let form: BulletinLocal;
    if (existing) {
      form = JSON.parse(JSON.stringify(existing));
    } else {
      form = {
        eleveId: eleve.id,
        eleveNom: eleve.nom,
        elevePrenom: eleve.prenom,
        niveau: eleve.niveau || 'PS',
        trimestre: selectedTrimestre,
        anneeScolaire: ANNEE_COURANTE,
        publie: false,
      };
      if (cycle === 'MATERNELLE' || cycle === 'CRECHE') {
        form.domaines = getDomainesParNiveau(eleve.niveau || 'PS');
        form.appreciationGenerale = '';
      } else {
        form.matieres = getMatieresParNiveau(eleve.niveau || 'CP');
        form.moyenneGenerale = 0;
        form.appreciationGenerale = '';
      }
    }
    setSelectedEleve(eleve);
    setBulletinForm(form);
    setModalMode('EDIT');
  }

  function openView(eleve: any) {
    const existing = getBulletin(eleve.id);
    if (!existing) return;
    setSelectedEleve(eleve);
    setBulletinForm(JSON.parse(JSON.stringify(existing)));
    setModalMode('VIEW');
  }

  // ── Sauvegarde ─────────────────────────────────────────────────────────────

  async function handleSave(publish = false) {
    if (!bulletinForm) return;
    setSaving(true);
    try {
      const updated = { ...bulletinForm };
      if (updated.matieres) {
        updated.moyenneGenerale = calcMoyenneGenerale(updated.matieres);
        if (!updated.appreciationGenerale)
          updated.appreciationGenerale = appreciationFromMoyenne(updated.moyenneGenerale);
      }
      if (publish) {
        updated.publie = true;
        updated.datePublication = new Date().toISOString().split('T')[0];
      }

      // Persister dans le backend
      const saved = await apiClient.post('/bulletins', updated);

      setBulletins(prev => ({ ...prev, [bulletinKey(saved.eleveId, saved.trimestre)]: saved }));
      setModalMode(null);
      addToast(publish
        ? `Bulletin de ${updated.elevePrenom} ${updated.eleveNom} publié ✓`
        : 'Bulletin enregistré', 'success');
    } catch (err: any) {
      addToast(err.message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpublish(eleve: any) {
    const existing = getBulletin(eleve.id);
    if (!existing) return;

    try {
      const updated = { ...existing, publie: false, datePublication: undefined };
      const saved = await apiClient.post('/bulletins', updated);
      
      setBulletins(prev => ({ ...prev, [bulletinKey(saved.eleveId, saved.trimestre)]: saved }));
      addToast('Bulletin dépublié', 'info');
    } catch (err: any) {
      addToast(err.message || 'Erreur lors de la dépublication', 'error');
    }
  }

  function handlePrint() { window.print(); }

  // ── Compétences sélecteur ──────────────────────────────────────────────────

  const COMP_OPTS: { value: NiveauCompetence; label: string; color: string; icon: React.ReactNode }[] = [
    { value: 'ACQUIS',     label: 'Acquis',     color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: <CheckSquare size={13} /> },
    { value: 'EN_COURS',   label: 'En cours',   color: 'bg-amber-100 text-amber-700 border-amber-300',       icon: <Circle size={13} /> },
    { value: 'NON_ACQUIS', label: 'Non acquis', color: 'bg-rose-100 text-rose-700 border-rose-300',           icon: <MinusCircle size={13} /> },
  ];

  function setCompetenceNiveau(di: number, ci: number, niveau: NiveauCompetence) {
    setBulletinForm(prev => {
      if (!prev?.domaines) return prev;
      const domaines = prev.domaines.map((d, i) => i !== di ? d : {
        ...d,
        competences: d.competences.map((c, j) => j !== ci ? c : { ...c, niveau }),
      });
      return { ...prev, domaines };
    });
  }

  function setNote(mi: number, si: number, note: string) {
    setBulletinForm(prev => {
      if (!prev?.matieres) return prev;
      const matieres = prev.matieres.map((m, i) => i !== mi ? m : {
        ...m,
        sousMatieres: m.sousMatieres.map((s, j) =>
          j !== si ? s : { ...s, note: note === '' ? '' : Math.min(20, Math.max(0, parseFloat(note) || 0)) }
        ),
      });
      return { ...prev, matieres };
    });
  }

  // ── Badge statut bulletin ──────────────────────────────────────────────────

  function statutBulletin(eleve: any) {
    const b = getBulletin(eleve.id);
    if (!b)       return { label: 'À faire',   color: 'bg-slate-100 text-slate-500 border-slate-200',     icon: <Clock size={10} /> };
    if (b.publie) return { label: 'Publié',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={10} /> };
    return         { label: 'Brouillon', color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: <Edit3 size={10} /> };
  }

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #bulletin-print, #bulletin-print * { visibility: visible; }
          #bulletin-print { position: absolute; inset: 0; }
        }
      `}</style>

      {/* ════ HEADER ════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">

          {/* Titre + breadcrumb */}
          <div className="flex items-center gap-3">
            {viewStep === 'ELEVES' && (
              <button
                onClick={backToClasses}
                className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
              <BookOpen size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                <span
                  className={viewStep === 'CLASSES' ? 'text-slate-800' : 'cursor-pointer hover:text-indigo-600 transition-colors'}
                  onClick={viewStep === 'ELEVES' ? backToClasses : undefined}
                >
                  Bulletins Scolaires
                </span>
                {viewStep === 'ELEVES' && selectedClasse && (
                  <>
                    <ChevronRight size={12} />
                    <span className="text-indigo-600">{niveauLabel(selectedClasse)}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.25em]">Année {ANNEE_COURANTE}</p>
                {isAnneeCloturee && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-full text-[8px] font-black uppercase tracking-widest">
                    <Archive size={9}/> Clôturée
                  </span>
                )}
                {!isAnneeCloturee && isReadOnly && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[8px] font-black uppercase tracking-widest">
                    <Lock size={9}/> Lecture seule
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sélecteur trimestre */}
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-2xl p-1">
            {TRIMESTRES.map(t => (
              <button
                key={t.value}
                onClick={() => setSelectedTrimestre(t.value)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedTrimestre === t.value
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
                <span className="block text-[7px] font-medium normal-case opacity-70">{t.mois}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* ════ KPIs globaux ═════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total élèves',      value: statsGlobales.total,      icon: Users,       color: 'text-slate-600',   bg: 'bg-white',        border: 'border-slate-100' },
            { label: 'Bulletins publiés', value: statsGlobales.publies,    icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50',   border: 'border-emerald-100' },
            { label: 'Brouillons',        value: statsGlobales.brouillons, icon: Edit3,        color: 'text-amber-600',   bg: 'bg-amber-50',     border: 'border-amber-100' },
            { label: 'À remplir',         value: statsGlobales.aFaire,     icon: Clock,        color: 'text-rose-500',    bg: 'bg-rose-50',      border: 'border-rose-100' },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-2xl p-4 border ${k.border} flex items-center gap-4`}>
              <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center border ${k.border}`}>
                <k.icon size={18} className={k.color} />
              </div>
              <div>
                <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ════ VUE 1 : LISTE DES CLASSES ════════════════════════════════════════ */}
        {viewStep === 'CLASSES' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <RefreshCw size={22} className="animate-spin text-indigo-400" />
                <span className="ml-3 text-sm text-slate-400">Chargement…</span>
              </div>
            ) : classeStats.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-200">
                <GraduationCap size={40} className="mx-auto text-slate-200 mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Aucun élève actif trouvé</p>
              </div>
            ) : (
              <>
                {/* Grouper par cycle */}
                {(['CRECHE', 'MATERNELLE', 'ELEMENTAIRE'] as CycleType[]).map(cycle => {
                  const classes = classeStats.filter(c => c.cycle === cycle);
                  if (classes.length === 0) return null;
                  const cfg = CYCLE_CONFIG[cycle];
                  return (
                    <div key={cycle}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <h2 className={`text-[10px] font-black uppercase tracking-[0.3em] ${cfg.color}`}>
                          {cfg.label}
                        </h2>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {classes.map(classe => (
                          <div
                            key={classe.value}
                            onClick={() => enterClasse(classe.value)}
                            className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer group"
                          >
                            {/* En-tête carte classe */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-11 h-11 ${cfg.bg} ${cfg.color} rounded-xl flex items-center justify-center font-black text-base border ${cfg.border}`}>
                                  {classe.label.slice(0, 2)}
                                </div>
                                <div>
                                  <h3 className="font-black text-slate-900 text-base">{classe.label}</h3>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    {classe.total} élève{classe.total > 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="w-8 h-8 bg-slate-50 group-hover:bg-indigo-600 rounded-xl flex items-center justify-center transition-colors">
                                <ArrowRight size={14} className="text-slate-400 group-hover:text-white transition-colors" />
                              </div>
                            </div>

                            {/* Barre de progression bulletins */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mb-1.5">
                                <span>Bulletins {TRIMESTRES.find(t => t.value === selectedTrimestre)?.label}</span>
                                <span className={classe.pctPublie === 100 ? 'text-emerald-600' : 'text-slate-500'}>
                                  {classe.publies}/{classe.total} publiés
                                </span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    classe.pctPublie === 100 ? 'bg-emerald-500' :
                                    classe.pctPublie > 50  ? 'bg-blue-500' :
                                    classe.pctPublie > 0   ? 'bg-amber-500' : 'bg-slate-200'
                                  }`}
                                  style={{ width: `${classe.pctPublie}%` }}
                                />
                              </div>
                            </div>

                            {/* Mini stats */}
                            <div className="flex gap-2 mt-3">
                              {classe.publies > 0 && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[8px] font-black border border-emerald-100">
                                  <CheckCircle2 size={9} /> {classe.publies} publiés
                                </span>
                              )}
                              {classe.brouillons > 0 && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-[8px] font-black border border-amber-100">
                                  <Edit3 size={9} /> {classe.brouillons} brouillons
                                </span>
                              )}
                              {classe.aFaire > 0 && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[8px] font-black">
                                  <Clock size={9} /> {classe.aFaire} à faire
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ════ VUE 2 : ÉLÈVES D'UNE CLASSE ══════════════════════════════════════ */}
        {viewStep === 'ELEVES' && selectedClasse && (
          <>
            {/* En-tête classe + recherche */}
            <div className="flex items-center gap-4">
              {/* Infos classe */}
              <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${CYCLE_CONFIG[getCycle(selectedClasse)].bg} ${CYCLE_CONFIG[getCycle(selectedClasse)].border}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm ${CYCLE_CONFIG[getCycle(selectedClasse)].color}`}>
                  {niveauLabel(selectedClasse).slice(0, 2)}
                </div>
                <div>
                  <p className={`text-sm font-black ${CYCLE_CONFIG[getCycle(selectedClasse)].color}`}>{niveauLabel(selectedClasse)}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    {elevesInClasse.length} élève{elevesInClasse.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Barre de recherche */}
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un élève par nom ou matricule…"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                />
              </div>
            </div>

            {/* Tableau des élèves */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw size={20} className="animate-spin text-indigo-400" />
                <span className="ml-3 text-sm text-slate-400">Chargement…</span>
              </div>
            ) : elevesInClasse.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <GraduationCap size={36} className="mx-auto text-slate-200 mb-3" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Aucun élève trouvé</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                {/* En-tête tableau */}
                <div className="grid grid-cols-[2.5fr_1fr_1.5fr_1.2fr_auto] gap-0 border-b border-slate-100 bg-slate-50 px-5 py-3">
                  {['Élève', 'Matricule', 'Statut bulletin', 'Note / Progression', 'Actions'].map(h => (
                    <div key={h} className="text-[8px] font-black text-slate-400 uppercase tracking-[0.25em]">{h}</div>
                  ))}
                </div>

                {/* Lignes */}
                <div className="divide-y divide-slate-50">
                  {elevesInClasse.map((eleve, idx) => {
                    const statut   = statutBulletin(eleve);
                    const b        = getBulletin(eleve.id);
                    const cycle    = getCycle(eleve.niveau || 'PS');
                    const isMat    = cycle === 'MATERNELLE' || cycle === 'CRECHE';
                    const cycleC   = CYCLE_CONFIG[cycle];

                    return (
                      <div
                        key={eleve.id}
                        className="grid grid-cols-[2.5fr_1fr_1.5fr_1.2fr_auto] gap-0 items-center px-5 py-3.5 hover:bg-slate-50 transition-colors"
                      >
                        {/* Col 1: Élève */}
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-white shrink-0 ${isMat ? 'bg-purple-500' : 'bg-indigo-600'}`}>
                            {eleve.prenom?.[0]}{eleve.nom?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{eleve.prenom} {eleve.nom}</p>
                            <p className="text-[8px] font-bold text-slate-400">
                              {eleve.parent1?.nom ? `${eleve.parent1.prenom || ''} ${eleve.parent1.nom}` : '—'}
                              {eleve.parent1?.whatsapp || eleve.parent1?.telephone ? ` · ${eleve.parent1.whatsapp || eleve.parent1.telephone}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Col 2: Matricule */}
                        <div className="font-mono text-[10px] font-bold text-slate-400">{eleve.matricule ?? '—'}</div>

                        {/* Col 3: Statut bulletin */}
                        <div>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border ${statut.color}`}>
                            {statut.icon}
                            {statut.label}
                          </span>
                        </div>

                        {/* Col 4: Note / Progression */}
                        <div>
                          {b && !isMat && b.moyenneGenerale !== undefined && b.moyenneGenerale > 0 ? (
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-sm font-black ${moyenneBg(b.moyenneGenerale)} ${moyenneColor(b.moyenneGenerale)}`}>
                              <Award size={12} />
                              {b.moyenneGenerale.toFixed(2)}
                              <span className="text-[9px] font-medium opacity-60">/20</span>
                            </div>
                          ) : b && isMat && b.domaines ? (() => {
                            const total  = b.domaines.reduce((s, d) => s + d.competences.length, 0);
                            const acquis = b.domaines.reduce((s, d) => s + d.competences.filter(c => c.niveau === 'ACQUIS').length, 0);
                            const pct    = total > 0 ? Math.round((acquis / total) * 100) : 0;
                            return (
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[9px] font-black text-emerald-600">{pct}%</span>
                              </div>
                            );
                          })() : (
                            <span className="text-[9px] text-slate-300 font-bold">—</span>
                          )}
                        </div>

                        {/* Col 5: Actions */}
                        <div className="flex items-center gap-1.5 justify-end">
                          {/* Profil élève */}
                          <button
                            onClick={() => setDetailEleve(eleve)}
                            title="Profil de l'élève"
                            className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-400 rounded-lg transition-colors"
                          >
                            <UserIcon size={13} />
                          </button>
                          {/* Saisir / Modifier */}
                          {canModify && !b?.publie && (
                            <button
                              onClick={() => openEdit(eleve)}
                              title={b ? 'Modifier le bulletin' : 'Saisir le bulletin'}
                              className="w-8 h-8 flex items-center justify-center bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-lg transition-colors"
                            >
                              <Edit3 size={13} />
                            </button>
                          )}
                          {/* Voir */}
                          {b && (
                            <button
                              onClick={() => openView(eleve)}
                              title="Voir le bulletin"
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-400 rounded-lg transition-colors"
                            >
                              <Eye size={13} />
                            </button>
                          )}
                          {/* Dépublier */}
                          {canModify && b?.publie && (
                            <button
                              onClick={() => handleUnpublish(eleve)}
                              title="Dépublier"
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-colors"
                            >
                              <Lock size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer tableau */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {elevesInClasse.length} élève{elevesInClasse.length > 1 ? 's' : ''} · {TRIMESTRES.find(t => t.value === selectedTrimestre)?.label}
                  </span>
                  <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      {elevesInClasse.filter(e => getBulletin(e.id)?.publie).length} publiés
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      {elevesInClasse.filter(e => { const b = getBulletin(e.id); return b && !b.publie; }).length} brouillons
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                      {elevesInClasse.filter(e => !getBulletin(e.id)).length} à faire
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ════ MODAL PROFIL ÉLÈVE ════════════════════════════════════════════════ */}
      {detailEleve && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">

            {/* Header */}
            <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white ${getCycle(detailEleve.niveau || 'PS') !== 'ELEMENTAIRE' ? 'bg-purple-500' : 'bg-indigo-600'}`}>
                  {detailEleve.prenom?.[0]}{detailEleve.nom?.[0]}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">{detailEleve.prenom} {detailEleve.nom}</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    {niveauLabel(detailEleve.niveau)} · {detailEleve.matricule ?? '—'}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border ${CYCLE_CONFIG[getCycle(detailEleve.niveau || 'PS')].color} ${CYCLE_CONFIG[getCycle(detailEleve.niveau || 'PS')].bg} ${CYCLE_CONFIG[getCycle(detailEleve.niveau || 'PS')].border}`}>
                      {CYCLE_CONFIG[getCycle(detailEleve.niveau || 'PS')].label}
                    </span>
                    {detailEleve.statut && (
                      <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {detailEleve.statut}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDetailEleve(null)}
                className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-7 py-5 space-y-5">

              {/* Informations personnelles */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Date de naissance', value: detailEleve.dateNaissance ? new Date(detailEleve.dateNaissance).toLocaleDateString('fr-FR') : null, icon: <Calendar size={12} /> },
                  { label: 'Lieu de naissance', value: detailEleve.lieuNaissance, icon: <MapPin size={12} /> },
                  { label: 'Date admission',    value: detailEleve.dateAdmission  ? new Date(detailEleve.dateAdmission).toLocaleDateString('fr-FR') : null, icon: <Calendar size={12} /> },
                  { label: 'Année scolaire',    value: detailEleve.anneeScolaire, icon: <BookOpen size={12} /> },
                ].filter(i => i.value).map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-slate-400">{item.icon}</span>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{item.label}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Options */}
              <div className="flex gap-2 flex-wrap">
                {detailEleve.cantine && (
                  <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={10} /> Cantine
                  </span>
                )}
                {detailEleve.transportBus && (
                  <span className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={10} /> Transport bus
                  </span>
                )}
                {detailEleve.regimeFinancier && detailEleve.regimeFinancier !== 'NORMAL' && (
                  <span className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={10} /> {detailEleve.regimeFinancier === 'CAS_SOCIAL_PARTIEL' ? 'Cas social (partiel)' : 'Cas social (total)'}
                    {detailEleve.remisePct > 0 ? ` — ${detailEleve.remisePct}%` : ''}
                  </span>
                )}
                {detailEleve.besoinSpecifique && (
                  <span className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <Baby size={10} /> Besoins spécifiques
                  </span>
                )}
              </div>

              {/* Parent */}
              {detailEleve.parent1 && (
                <div className="border border-slate-100 rounded-2xl p-4">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3 flex items-center gap-1.5">
                    <Users size={10} /> Parent / Tuteur principal
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-500 text-sm">
                      {detailEleve.parent1.prenom?.[0]}{detailEleve.parent1.nom?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-800">
                        {detailEleve.parent1.prenom} {detailEleve.parent1.nom}
                        <span className="ml-2 text-[8px] font-bold text-slate-400 uppercase">
                          {detailEleve.parent1.lien === 'MERE' ? 'Mère' : detailEleve.parent1.lien === 'PERE' ? 'Père' : 'Tuteur'}
                        </span>
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {(detailEleve.parent1.whatsapp || detailEleve.parent1.telephone) && (
                          <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                            <Phone size={10} /> {detailEleve.parent1.whatsapp || detailEleve.parent1.telephone}
                          </span>
                        )}
                        {detailEleve.parent1.email && (
                          <span className="text-[10px] text-slate-400 font-bold">{detailEleve.parent1.email}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bulletins résumé */}
              <div className="border border-slate-100 rounded-2xl p-4">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3 flex items-center gap-1.5">
                  <BarChart2 size={10} /> Bulletins — {ANNEE_COURANTE}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {TRIMESTRES.map(t => {
                    const b = bulletins[bulletinKey(detailEleve.id, t.value)];
                    const cycle = getCycle(detailEleve.niveau || 'PS');
                    const isMat = cycle === 'MATERNELLE' || cycle === 'CRECHE';
                    return (
                      <div key={t.value} className={`rounded-xl p-3 border text-center ${
                        !b ? 'bg-slate-50 border-slate-100' :
                        b.publie ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                      }`}>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t.label}</p>
                        {!b ? (
                          <p className="text-xs font-bold text-slate-300 mt-1">—</p>
                        ) : !isMat && b.moyenneGenerale ? (
                          <p className={`text-sm font-black mt-1 ${moyenneColor(b.moyenneGenerale)}`}>
                            {b.moyenneGenerale.toFixed(1)}<span className="text-[8px]">/20</span>
                          </p>
                        ) : b.publie ? (
                          <CheckCircle2 size={16} className="mx-auto mt-1 text-emerald-600" />
                        ) : (
                          <Edit3 size={16} className="mx-auto mt-1 text-amber-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-2">
              {canModify && (
                <button
                  onClick={() => { setDetailEleve(null); openEdit(detailEleve); }}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Edit3 size={13} /> Saisir bulletin
                </button>
              )}
              <button
                onClick={() => setDetailEleve(null)}
                className="px-5 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL SAISIE / VUE BULLETIN ══════════════════════════════════════ */}
      {modalMode && bulletinForm && selectedEleve && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-6" id="bulletin-print">

            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black ${getCycle(bulletinForm.niveau) !== 'ELEMENTAIRE' ? 'bg-purple-500' : 'bg-indigo-600'}`}>
                  {bulletinForm.elevePrenom?.[0]}{bulletinForm.eleveNom?.[0]}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    {bulletinForm.elevePrenom} {bulletinForm.eleveNom}
                  </h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    {niveauLabel(bulletinForm.niveau)} · {TRIMESTRES.find(t => t.value === bulletinForm.trimestre)?.label} · {bulletinForm.anneeScolaire}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors print:hidden">
                  <Printer size={16} />
                </button>
                <button onClick={() => setModalMode(null)} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors print:hidden">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="px-8 py-6 space-y-6">

              {/* En-tête imprimable */}
              <div className="hidden print:block text-center mb-6">
                <p className="text-lg font-black uppercase tracking-widest">Le Toit des Anges</p>
                <p className="text-sm text-slate-500">469 Cité Cheikh Omar TALL, Ouakam – Dakar</p>
                <p className="text-xl font-black mt-4 uppercase border-b-2 border-slate-800 pb-2">
                  Bulletin de {getCycle(bulletinForm.niveau) === 'ELEMENTAIRE' ? 'Notes' : 'Compétences'} — {TRIMESTRES.find(t => t.value === bulletinForm.trimestre)?.label}
                </p>
                <p className="text-sm mt-2">
                  Élève : <strong>{bulletinForm.elevePrenom} {bulletinForm.eleveNom}</strong> · Niveau : <strong>{niveauLabel(bulletinForm.niveau)}</strong> · Année : <strong>{bulletinForm.anneeScolaire}</strong>
                </p>
              </div>

              {/* ─── MATERNELLE / CRÈCHE : compétences ──────────────────────── */}
              {(getCycle(bulletinForm.niveau) === 'MATERNELLE' || getCycle(bulletinForm.niveau) === 'CRECHE') && bulletinForm.domaines && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Baby size={15} className="text-purple-500" />
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">Évaluation par domaines</h3>
                    <div className="flex items-center gap-2 ml-auto text-[9px] font-bold text-slate-400">
                      {COMP_OPTS.map(o => (
                        <span key={o.value} className={`px-2 py-0.5 rounded border ${o.color} flex items-center gap-1`}>
                          {o.icon}{o.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {bulletinForm.domaines.map((domaine, di) => (
                    <div key={di} className="border border-slate-100 rounded-2xl overflow-hidden">
                      <div className="px-5 py-3 bg-purple-50 border-b border-purple-100">
                        <h4 className="text-[10px] font-black text-purple-700 uppercase tracking-[0.2em]">{domaine.nom}</h4>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {domaine.competences.map((comp, ci) => (
                          <div key={ci} className="flex items-center justify-between px-5 py-3">
                            <p className="text-sm text-slate-700 font-medium flex-1 pr-4">{comp.libelle}</p>
                            {modalMode === 'EDIT' && !bulletinForm.publie ? (
                              <div className="flex gap-1.5">
                                {COMP_OPTS.map(o => (
                                  <button
                                    key={o.value}
                                    onClick={() => setCompetenceNiveau(di, ci, o.value)}
                                    className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                                      comp.niveau === o.value
                                        ? o.color + ' shadow-sm scale-105'
                                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    {o.icon}
                                    <span className="hidden sm:inline">{o.label}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                comp.niveau
                                  ? COMP_OPTS.find(o => o.value === comp.niveau)?.color ?? 'bg-slate-100 text-slate-400 border-slate-200'
                                  : 'bg-slate-100 text-slate-300 border-slate-200'
                              }`}>
                                {comp.niveau ? COMP_OPTS.find(o => o.value === comp.niveau)?.label : '—'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ─── ÉLÉMENTAIRE : notes ──────────────────────────────────────── */}
              {getCycle(bulletinForm.niveau) === 'ELEMENTAIRE' && bulletinForm.matieres && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <GraduationCap size={15} className="text-indigo-600" />
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">Notes par matière</h3>
                  </div>

                  {/* Tableau récapitulatif en vue lecture */}
                  {modalMode === 'VIEW' && (
                    <div className="border border-slate-100 rounded-2xl overflow-hidden mb-2">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-indigo-50 border-b border-indigo-100">
                            <th className="text-left px-5 py-3 text-[9px] font-black text-indigo-600 uppercase tracking-widest">Matière</th>
                            <th className="text-center px-3 py-3 text-[9px] font-black text-indigo-600 uppercase tracking-widest">Coeff.</th>
                            <th className="text-center px-3 py-3 text-[9px] font-black text-indigo-600 uppercase tracking-widest">Moyenne</th>
                            <th className="text-left px-5 py-3 text-[9px] font-black text-indigo-600 uppercase tracking-widest">Appréciation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {bulletinForm.matieres.map((m, mi) => {
                            const moy = calcMoyenneMatiere(m);
                            const hasNote = m.sousMatieres.some(s => s.note !== '');
                            return (
                              <tr key={mi} className="hover:bg-slate-50">
                                <td className="px-5 py-2.5 font-bold text-slate-800 text-sm">{m.nom}</td>
                                <td className="px-3 py-2.5 text-center text-xs font-bold text-slate-400">{m.coefficient}</td>
                                <td className="px-3 py-2.5 text-center">
                                  {hasNote ? (
                                    <span className={`font-black text-sm ${moyenneColor(moy)}`}>
                                      {moy.toFixed(2)}<span className="text-[9px] opacity-60">/20</span>
                                    </span>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-5 py-2.5 text-xs text-slate-500 italic">{m.appreciation || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {bulletinForm.matieres.map((matiere, mi) => {
                    const moy = calcMoyenneMatiere(matiere);
                    const hasSomeNote = matiere.sousMatieres.some(s => s.note !== '');
                    return (
                      <div key={mi} className="border border-slate-100 rounded-2xl overflow-hidden">
                        <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                          <div>
                            <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em]">{matiere.nom}</h4>
                            <p className="text-[9px] text-indigo-400 font-bold">Coefficient total : {matiere.coefficient}</p>
                          </div>
                          {hasSomeNote && (
                            <div className={`px-3 py-1.5 rounded-xl border text-sm font-black ${moyenneBg(moy)} ${moyenneColor(moy)}`}>
                              {moy.toFixed(2)} <span className="text-[9px] font-medium">/20</span>
                            </div>
                          )}
                        </div>
                        <div className="divide-y divide-slate-50">
                          {matiere.sousMatieres.map((sm, si) => (
                            <div key={si} className="flex items-center px-5 py-3 gap-4">
                              <p className="text-sm text-slate-700 font-medium flex-1">{sm.nom}</p>
                              <span className="text-[9px] font-bold text-slate-400">coeff {sm.coefficient}</span>
                              {modalMode === 'EDIT' && !bulletinForm.publie ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min={0} max={20} step={0.25}
                                    value={sm.note}
                                    onChange={e => setNote(mi, si, e.target.value)}
                                    placeholder="—"
                                    className="w-16 text-center border border-slate-200 rounded-lg py-1.5 text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                  />
                                  <span className="text-xs text-slate-300">/20</span>
                                </div>
                              ) : (
                                <span className={`w-16 text-center text-sm font-black ${sm.note !== '' ? moyenneColor(Number(sm.note)) : 'text-slate-300'}`}>
                                  {sm.note !== '' ? `${Number(sm.note).toFixed(2)}` : '—'}
                                  <span className="text-[9px] text-slate-300"> /20</span>
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {modalMode === 'EDIT' && !bulletinForm.publie && (
                          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                            <input
                              type="text"
                              value={matiere.appreciation}
                              onChange={e => {
                                setBulletinForm(prev => {
                                  if (!prev?.matieres) return prev;
                                  const matieres = prev.matieres.map((m, i) =>
                                    i === mi ? { ...m, appreciation: e.target.value } : m
                                  );
                                  return { ...prev, matieres };
                                });
                              }}
                              placeholder="Appréciation du professeur…"
                              className="w-full bg-transparent border-0 text-xs text-slate-500 italic focus:outline-none focus:ring-0 placeholder:text-slate-300"
                            />
                          </div>
                        )}
                        {modalMode === 'VIEW' && matiere.appreciation && (
                          <div className="px-5 py-2 bg-slate-50 border-t border-slate-100">
                            <p className="text-xs text-slate-500 italic">"{matiere.appreciation}"</p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Moyenne générale */}
                  {(() => {
                    const moy = calcMoyenneGenerale(bulletinForm.matieres);
                    if (!bulletinForm.matieres.some(m => m.sousMatieres.some(s => s.note !== ''))) return null;
                    return (
                      <div className={`flex items-center justify-between px-6 py-4 rounded-2xl border-2 ${moyenneBg(moy)}`}>
                        <div className="flex items-center gap-3">
                          <Award size={20} className={moyenneColor(moy)} />
                          <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Moyenne Générale</p>
                            <p className="text-[9px] text-slate-400">{appreciationFromMoyenne(moy)}</p>
                          </div>
                        </div>
                        <p className={`text-3xl font-black ${moyenneColor(moy)}`}>
                          {moy.toFixed(2)}<span className="text-base font-medium ml-1">/20</span>
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Appréciation générale */}
              <div className="border border-slate-100 rounded-2xl p-5">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">
                  Appréciation générale du conseil de classe
                </label>
                {modalMode === 'EDIT' && !bulletinForm.publie ? (
                  <textarea
                    rows={3}
                    value={bulletinForm.appreciationGenerale ?? ''}
                    onChange={e => setBulletinForm(prev => prev ? { ...prev, appreciationGenerale: e.target.value } : prev)}
                    placeholder="Appréciation de l'enseignant(e)…"
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  />
                ) : (
                  <p className="text-sm text-slate-700 italic">
                    {bulletinForm.appreciationGenerale || <span className="text-slate-300">Aucune appréciation saisie</span>}
                  </p>
                )}
              </div>

              {bulletinForm.publie && bulletinForm.datePublication && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold">
                  <CheckCircle2 size={14} />
                  Publié le {bulletinForm.datePublication}
                </div>
              )}
            </div>

            {/* Footer modal */}
            {modalMode === 'EDIT' && !bulletinForm.publie && (
              <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-end gap-3 print:hidden">
                <button
                  onClick={() => setModalMode(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-700 text-sm font-black uppercase tracking-widest hover:bg-slate-300 transition-colors flex items-center gap-2"
                >
                  <Save size={14} /> Enregistrer
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-md"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  Publier & Notifier
                </button>
              </div>
            )}
            {modalMode === 'VIEW' && (
              <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-end gap-3 print:hidden">
                {canModify && bulletinForm.publie && (
                  <button
                    onClick={() => { handleUnpublish(selectedEleve); setModalMode(null); }}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <Lock size={14} /> Dépublier
                  </button>
                )}
                <button
                  onClick={handlePrint}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black uppercase tracking-widest hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  <Printer size={14} /> Imprimer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
