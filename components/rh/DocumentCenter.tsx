
import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  Search,
  Filter,
  Download,
  Plus,
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  ShieldCheck,
  Clock,
  Trash2,
  Eye,
  Users,
  Loader2,
  Upload,
  Lock,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HRModal from './HRModal';
import { apiClient } from '../../services/api';
import { authBridge } from '../../services/authBridge';
import { uploadFile, getStorageUsage, StorageInfo } from '../../services/uploadService';

interface DocumentCenterProps {
  onNavigate: (tab: string, meta?: any) => void;
}

interface EmployeeDocument {
  id: number;
  name: string;
  type: string;
  category: string | null;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  employee?: {
    firstName: string;
    lastName: string;
    departmentId: number;
  };
  uploader?: {
    firstName: string;
    lastName: string;
  };
}

interface DocumentListResponse {
  rows: EmployeeDocument[];
  count: number;
  page: number;
  perPage: number;
}

interface UploadFormData {
  employeeId: string;
  name: string;
  type: string;
  category: string;
  file: File | null;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  departmentId?: number;
}

const DocumentCenter: React.FC<DocumentCenterProps> = ({ onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<EmployeeDocument | null>(null);

  // État quota de stockage
  const [storageInfo, setStorageInfo] = useState<(StorageInfo & { documentQuotaBytes?: number; documentQuotaExceeded?: boolean; documentUsedPercent?: number }) | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [showStorageRequestModal, setShowStorageRequestModal] = useState(false);
  const [storageRequestMsg, setStorageRequestMsg] = useState('');
  const [requestingStorage, setRequestingStorage] = useState(false);
  const [storageRequestSent, setStorageRequestSent] = useState(false);

  // État pour le formulaire d'upload
  const [uploadData, setUploadData] = useState<UploadFormData>({
    employeeId: '',
    name: '',
    type: '',
    category: '',
    file: null
  });

  const categories = ['All', 'Identité', 'Contrat', 'Diplôme', 'Finance', 'Santé'];
  const perPage = 12;
  const maxFileSize = 20 * 1024 * 1024; // 20MB
  const acceptedFileTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
  
  // Calculs statistiques sécurisés
  const totalSize = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
  const totalDocuments = documents.length;
  const averageDocSize = totalDocuments > 0 ? totalSize / totalDocuments : 0;
  

  // Charger les documents
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        perPage: perPage.toString(),
        sortBy: 'uploaded_at',
        sortDir: 'DESC'
      });
      
      if (searchTerm.trim()) {
        params.append('q', searchTerm.trim());
      }
      
      if (filterCategory !== 'All') {
        params.append('category', filterCategory);
      }
      
      const response: DocumentListResponse = await apiClient.get(`/hr/employee-documents?${params}`);
      setDocuments(response.rows);
      setTotalCount(response.count);
    } catch (err: any) {
      console.error('Erreur lors du chargement des documents:', err);
      setError(err.message || 'Erreur lors du chargement des documents');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, filterCategory]);

  // Charger les employés
  const fetchEmployees = useCallback(async () => {
    try {
      setLoadingEmployees(true);
      const response = await apiClient.get('/hr/employees');
      setEmployees(response.rows || response);
    } catch (error: any) {
      console.error('Erreur lors du chargement des employés:', error);
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  // Charger le quota de stockage réel depuis l'API
  const fetchStorageInfo = useCallback(async () => {
    try {
      const info = await getStorageUsage() as StorageInfo & {
        documentQuotaBytes?: number;
        documentQuotaExceeded?: boolean;
        documentUsedPercent?: number;
      };
      setStorageInfo(info);
      setQuotaExceeded(info.documentQuotaExceeded ?? false);
    } catch {
      // Silencieux — le blocage backend reste actif
    }
  }, []);

  // Soumettre la demande d'extension de stockage
  const handleRequestStorage = async () => {
    setRequestingStorage(true);
    try {
      await apiClient.post('/upload/request-storage', { message: storageRequestMsg });
      setStorageRequestSent(true);
      setTimeout(() => {
        setShowStorageRequestModal(false);
        setStorageRequestSent(false);
        setStorageRequestMsg('');
      }, 3000);
    } catch (err: any) {
      showStyledError(err.message || 'Erreur lors de l\'envoi de la demande.');
      setShowStorageRequestModal(false);
    } finally {
      setRequestingStorage(false);
    }
  };

  // Charger les documents au montage et quand les filtres changent
  useEffect(() => {
    fetchDocuments();
    fetchEmployees();
    fetchStorageInfo();
  }, [fetchDocuments, fetchEmployees, fetchStorageInfo]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory]);

  // Ouvrir le modal de confirmation de suppression
  const handleDeleteClick = (document: EmployeeDocument) => {
    setDocumentToDelete(document);
    setShowDeleteModal(true);
  };

  // Confirmer et supprimer le document
  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    
    try {
      await apiClient.delete(`/hr/employee-documents/${documentToDelete.id}`);
      setDocuments(docs => docs.filter(doc => doc.id !== documentToDelete.id));
      setShowDeleteModal(false);
      setDocumentToDelete(null);
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      showStyledError('Erreur lors de la suppression du document');
      setShowDeleteModal(false);
      setDocumentToDelete(null);
    }
  };

  // Afficher une erreur stylisée
  const showStyledError = (message: string) => {
    setUploadError(message);
    setShowErrorModal(true);
  };

  // Valider un fichier
  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `Le fichier est trop volumineux (${formatFileSize(file.size)}). Taille maximale : ${formatFileSize(maxFileSize)}.`;
    }
    
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFileTypes.includes(fileExtension)) {
      return `Type de fichier non supporté (${fileExtension}). Types acceptés : ${acceptedFileTypes.join(', ')}.`;
    }
    
    return null;
  };

  // Gérer l'ajout de fichier
  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      showStyledError(error);
      return;
    }
    
    setUploadData(prev => ({
      ...prev,
      file,
      name: prev.name || file.name.split('.').slice(0, -1).join('.')
    }));
  };

  // Gérer le drag & drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Gérer l'upload d'un document
  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!uploadData.file || !uploadData.employeeId || !uploadData.name.trim() || !uploadData.category) {
      showStyledError('Veuillez remplir tous les champs requis');
      return;
    }
    
    const fileError = validateFile(uploadData.file);
    if (fileError) {
      showStyledError(fileError);
      return;
    }
    
    setUploading(true);
    setUploadError(null);
    
    try {
      const session = authBridge.getSession();
      if (!session) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      // Upload vers S3 MamuteCloud via le backend
      const uploadResult = await uploadFile(uploadData.file, 'employee_documents');

      // Sauvegarder les métadonnées en base via l'API
      const documentData = {
        employeeId: uploadData.employeeId,
        name: uploadData.name.trim(),
        type: uploadData.type || 'OTHER',
        category: uploadData.category,
        fileUrl: uploadResult.url,
        mimeType: uploadData.file.type,
        fileSize: uploadData.file.size
      };

      await apiClient.post('/hr/employee-documents', documentData);

      setIsModalOpen(false);
      setUploadData({ employeeId: '', name: '', type: '', category: '', file: null });
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      fetchDocuments();
      
    } catch (error: any) {
      console.error('Erreur lors de l\'upload:', error);
      const errorMessage = error.message || 'Erreur lors de l\'upload du document';
      showStyledError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Fonction pour formater la taille de fichier
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Success Alert */}
      <AnimatePresence>
        {showSuccessAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 font-black uppercase text-[10px] tracking-widest"
          >
            <CheckCircle2 size={20} /> Document indexé et sécurisé dans le coffre-fort
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('rh')}
            className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Centre Documentaire</h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.3em]">Gestion électronique des documents RH</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl text-slate-500">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">Stockage Sécurisé AES-256</span>
          </div>
          <button
            onClick={() => { if (!quotaExceeded) setIsModalOpen(true); else setShowStorageRequestModal(true); }}
            className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl active:scale-95 ${
              quotaExceeded
                ? 'bg-rose-500 text-white hover:bg-rose-600 cursor-not-allowed'
                : 'bg-slate-900 text-white hover:bg-indigo-600'
            }`}
          >
            {quotaExceeded ? <Lock size={16} /> : <Plus size={16} />}
            {quotaExceeded ? 'Quota Atteint' : 'Ajouter un Fichier'}
          </button>
        </div>
      </div>

      {/* Bannière quota atteint */}
      <AnimatePresence>
        {quotaExceeded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-rose-50 border border-rose-200 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-4"
          >
            <div className="w-12 h-12 bg-rose-100 text-rose-500 rounded-2xl flex items-center justify-center shrink-0">
              <HardDrive size={24} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="text-sm font-black text-rose-800 uppercase tracking-tight">
                Quota de stockage atteint — 5 Go utilisés
              </p>
              <p className="text-[10px] font-bold text-rose-600 mt-1">
                Les nouveaux uploads sont bloqués. Demandez une extension d'espace pour continuer.
              </p>
            </div>
            <button
              onClick={() => setShowStorageRequestModal(true)}
              className="px-6 py-3 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-rose-600 transition-all shadow-lg shrink-0"
            >
              <Send size={14} /> Demander plus d'espace
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className={`bg-white p-6 rounded-[2rem] border shadow-sm ${quotaExceeded ? 'border-rose-200' : 'border-slate-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${quotaExceeded ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-600'}`}>
              <HardDrive size={24} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${quotaExceeded ? 'text-rose-500' : 'text-slate-400'}`}>
              {storageInfo ? storageInfo.documentUsedPercent : Math.round((storageInfo?.usedBytes ?? 0) / (5 * 1024 * 1024 * 1024) * 100)}% utilisé
            </span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stockage Utilisé</p>
          <p className="text-2xl font-black text-slate-900">
            {storageInfo ? `${storageInfo.usedMB >= 1024 ? (storageInfo.usedMB / 1024).toFixed(2) + ' Go' : storageInfo.usedMB + ' Mo'}` : '…'} / 5 Go
          </p>
          <div className="mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${quotaExceeded ? 'bg-rose-500' : 'bg-indigo-500'}`}
              style={{ width: `${Math.min(storageInfo?.documentUsedPercent ?? 0, 100)}%` }}
            />
          </div>
          {quotaExceeded && (
            <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-2">⚠ Quota 5 Go atteint</p>
          )}
        </div>
        
        {['Identité', 'Contrat', 'Diplôme'].map((cat, i) => {
          const catDocs = documents.filter(doc => doc.category === cat);
          const catSize = catDocs.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
          const iconColors = [
            { bg: 'bg-emerald-50', text: 'text-emerald-600' },
            { bg: 'bg-amber-50', text: 'text-amber-600' },
            { bg: 'bg-purple-50', text: 'text-purple-600' }
          ];
          return (
            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${iconColors[i].bg} ${iconColors[i].text} rounded-2xl flex items-center justify-center`}>
                  <FolderOpen size={24} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {catDocs.length} fichier{catDocs.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{cat}</p>
              <p className="text-2xl font-black text-slate-900">{formatFileSize(catSize)}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${iconColors[i].text.replace('text-', 'bg-')} transition-all duration-500`}
                    style={{ 
                      width: `${Math.min((catSize / Math.max(documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0), 1)) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
                <span className="text-[8px] font-bold text-slate-400">
                  {catSize > 0 ? Math.round((catSize / Math.max(documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0), 1)) * 100) : 0}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher un document ou un employé..." 
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 px-6 py-4 rounded-2xl">
            <Filter size={18} className="text-slate-400" />
            <select 
              className="bg-transparent border-none focus:ring-0 font-black text-[10px] uppercase tracking-widest text-slate-600"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'All' ? 'Toutes les Catégories' : cat}</option>
              ))}
            </select>
          </div>
          <div className="bg-slate-50 px-4 py-2 rounded-xl">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
              {totalCount} document{totalCount > 1 ? 's' : ''} trouvé{totalCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-slate-500 font-medium">Chargement des documents...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500" />
            <div>
              <p className="text-slate-900 font-bold mb-2">Erreur de chargement</p>
              <p className="text-slate-500 mb-4">{error}</p>
              <button 
                onClick={fetchDocuments}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-700 transition-all"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4 text-center">
            <FileText className="w-12 h-12 text-slate-300" />
            <div>
              <p className="text-slate-900 font-bold mb-2">Aucun document trouvé</p>
              <p className="text-slate-500 mb-4">
                {searchTerm || filterCategory !== 'All' 
                  ? 'Aucun document ne correspond à vos critères de recherche' 
                  : 'Commencez par ajouter des documents'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
              <div className="flex items-start justify-between mb-8">
                <div className="w-16 h-16 bg-slate-50 text-indigo-500 rounded-[1.5rem] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <FileText size={32} />
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.open(doc.fileUrl, '_blank')}
                    className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all"
                  >
                    <Eye size={18} />
                  </button>
                  <a 
                    href={doc.fileUrl} 
                    download={doc.name}
                    className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all"
                  >
                    <Download size={18} />
                  </a>
                </div>
              </div>

              <div className="space-y-1 mb-6">
                <h3 className="text-sm font-black text-slate-900 truncate uppercase tracking-tight" title={doc.name}>
                  {doc.name}
                </h3>
                <p className="text-indigo-600 font-black uppercase text-[10px] tracking-widest">
                  {doc.category || doc.type}
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                    <Users size={14} />
                  </div>
                  <span className="text-xs font-bold">
                    {doc.employee ? `${doc.employee.firstName} ${doc.employee.lastName}` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                    <Clock size={14} />
                  </div>
                  <span className="text-xs font-bold">
                    Ajouté le {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {formatFileSize(doc.fileSize)}
                </span>
                <button 
                  onClick={() => handleDeleteClick(doc)}
                  className="text-rose-500 hover:text-rose-700 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Pagination */}
      {totalCount > perPage && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
          >
            Précédent
          </button>
          <span className="px-4 py-2 text-sm font-medium text-slate-600">
            Page {currentPage} sur {Math.ceil(totalCount / perPage)}
          </span>
          <button 
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage >= Math.ceil(totalCount / perPage)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Upload Modal */}
      <HRModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setUploadData({
            employeeId: '',
            name: '',
            type: '',
            category: '',
            file: null
          });
        }} 
        title="Ajouter un Document"
        size="md"
        footer={
          <div className="flex justify-end gap-4">
            <button 
              onClick={() => {
                setIsModalOpen(false);
                setUploadData({
                  employeeId: '',
                  name: '',
                  type: '',
                  category: '',
                  file: null
                });
              }} 
              className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
              disabled={uploading}
            >
              Annuler
            </button>
            <button 
              onClick={handleUploadDoc} 
              disabled={uploading || !uploadData.file || !uploadData.employeeId || !uploadData.name.trim() || !uploadData.category}
              className="px-4 md:px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Upload en cours...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Uploader & Indexer
                </>
              )}
            </button>
          </div>
        }
      >
        <form className="space-y-6" onSubmit={handleUploadDoc}>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Employé Concerné *
            </label>
            <select 
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
              value={uploadData.employeeId}
              onChange={(e) => setUploadData(prev => ({ ...prev, employeeId: e.target.value }))}
              required
              disabled={loadingEmployees}
            >
              <option value="">
                {loadingEmployees ? 'Chargement...' : 'Sélectionner un employé'}
              </option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                  {emp.email ? ` (${emp.email})` : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Nom du Document *
            </label>
            <input 
              type="text"
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
              placeholder="Ex: CNI_Jean_Dupont"
              value={uploadData.name}
              onChange={(e) => setUploadData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Catégorie de Document *
            </label>
            <select 
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
              value={uploadData.category}
              onChange={(e) => setUploadData(prev => ({ ...prev, category: e.target.value }))}
              required
            >
              <option value="">Sélectionner une catégorie</option>
              {categories.filter(c => c !== 'All').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Type (optionnel)
            </label>
            <select 
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm"
              value={uploadData.type}
              onChange={(e) => setUploadData(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="">Sélectionner un type de document</option>
              <option value="ID_CARD">Pièce d'identité</option>
              <option value="CONTRACT">Contrat</option>
              <option value="DIPLOMA">Diplôme</option>
              <option value="BANK_DETAILS">Informations bancaires</option>
              <option value="MEDICAL">Médical</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Fichier *
            </label>
            <div 
              className={`p-12 border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${
                dragActive ? 'border-indigo-500 bg-indigo-100' :
                uploadData.file ? 'border-indigo-500 bg-indigo-50' : 
                'border-slate-200 bg-slate-50/50 hover:border-indigo-500'
              }`}
              onClick={() => document.getElementById('file-input')?.click()}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input 
                id="file-input"
                type="file"
                className="hidden"
                accept={acceptedFileTypes.join(',')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileSelect(file);
                  }
                }}
              />
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 group-hover:scale-110 shadow-sm transition-transform ${
                uploadData.file ? 'bg-indigo-500 text-white' : 'bg-white text-slate-300'
              }`}>
                {uploadData.file ? <CheckCircle2 size={40} /> : <Plus size={40} />}
              </div>
              {dragActive ? (
                <div>
                  <p className="text-sm font-bold text-indigo-600">Relâchez pour ajouter le fichier</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                    Drag & Drop activé
                  </p>
                </div>
              ) : uploadData.file ? (
                <div>
                  <p className="text-sm font-bold text-indigo-600 mb-1">{uploadData.file.name}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {formatFileSize(uploadData.file.size)} - Cliquez pour changer
                  </p>
                  <p className="text-[8px] text-emerald-600 font-bold uppercase tracking-widest mt-1">
                    ✓ Fichier validé
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-600">Cliquez ou glissez-déposez vos fichiers</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                    {acceptedFileTypes.join(', ').toUpperCase()} (Max {formatFileSize(maxFileSize)})
                  </p>
                </div>
              )}
            </div>
          </div>
        </form>
      </HRModal>

      {/* Modal d'erreur stylisé */}
      <HRModal
        isOpen={showErrorModal}
        onClose={() => {
          setShowErrorModal(false);
          setUploadError(null);
        }}
        title="Erreur d'Upload"
        size="sm"
        footer={
          <div className="flex justify-end">
            <button
              onClick={() => {
                setShowErrorModal(false);
                setUploadError(null);
              }}
              className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all"
            >
              Compris
            </button>
          </div>
        }
      >
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-3 uppercase tracking-tight">
            Upload Impossible
          </h3>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-4">
            <p className="text-sm text-rose-700 font-medium leading-relaxed">
              {uploadError}
            </p>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Veuillez corriger le problème et réessayer
          </p>
        </div>
      </HRModal>

      {/* Modal de confirmation de suppression */}
      <HRModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDocumentToDelete(null);
        }}
        title="Confirmer la Suppression"
        size="sm"
        footer={
          <div className="flex justify-end gap-4">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setDocumentToDelete(null);
              }}
              className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={confirmDeleteDocument}
              className="px-8 py-3 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all flex items-center gap-2"
            >
              <Trash2 size={16} />
              Supprimer
            </button>
          </div>
        }
      >
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-3 uppercase tracking-tight">
            Supprimer le Document
          </h3>
          {documentToDelete && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
              <p className="text-sm font-bold text-slate-700 mb-2">
                {documentToDelete.name}
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <span className="px-2 py-1 bg-indigo-100 text-indigo-600 rounded-lg font-medium">
                  {documentToDelete.category || documentToDelete.type}
                </span>
                <span>•</span>
                <span>{formatFileSize(documentToDelete.fileSize)}</span>
              </div>
            </div>
          )}
          <p className="text-sm text-slate-600 font-medium leading-relaxed mb-2">
            Êtes-vous sûr de vouloir supprimer ce document ?
          </p>
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
            ⚠️ Cette action est irréversible
          </p>
        </div>
      </HRModal>

      {/* Modal demande d'extension de stockage */}
      <HRModal
        isOpen={showStorageRequestModal}
        onClose={() => {
          if (!requestingStorage) {
            setShowStorageRequestModal(false);
            setStorageRequestMsg('');
            setStorageRequestSent(false);
          }
        }}
        title="Demande d'extension de stockage"
        size="sm"
        footer={
          storageRequestSent ? null : (
            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowStorageRequestModal(false);
                  setStorageRequestMsg('');
                }}
                disabled={requestingStorage}
                className="px-8 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleRequestStorage}
                disabled={requestingStorage}
                className="px-8 py-3 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
              >
                {requestingStorage ? (
                  <><Loader2 size={14} className="animate-spin" /> Envoi en cours…</>
                ) : (
                  <><Send size={14} /> Envoyer la demande</>
                )}
              </button>
            </div>
          )
        }
      >
        {storageRequestSent ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">Demande envoyée !</h3>
            <p className="text-sm text-slate-500 font-medium">
              Notre équipe traitera votre demande sous 24h.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
              <HardDrive size={18} className="text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-rose-800 uppercase tracking-tight mb-1">
                  Quota de 5 Go atteint
                </p>
                <p className="text-[10px] text-rose-600 font-bold">
                  Utilisation actuelle : {storageInfo
                    ? (storageInfo.usedMB >= 1024
                      ? (storageInfo.usedMB / 1024).toFixed(2) + ' Go'
                      : storageInfo.usedMB + ' Mo')
                    : '–'} / 5 Go
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Message (optionnel)
              </label>
              <textarea
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-rose-400 transition-all font-medium text-sm resize-none"
                rows={4}
                placeholder="Décrivez vos besoins (ex. : volume estimé, contexte métier…)"
                value={storageRequestMsg}
                onChange={(e) => setStorageRequestMsg(e.target.value)}
              />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Un ticket de support sera automatiquement créé et transmis à notre équipe.
            </p>
          </div>
        )}
      </HRModal>
    </div>
  );
};

export default DocumentCenter;
