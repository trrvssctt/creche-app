/**
 * uploadService.ts
 * Service d'upload vers S3 MamuteCloud via l'API backend.
 * Remplace tous les appels directs à Cloudinary dans le frontend.
 */

import { apiClient } from './api';

export interface UploadResult {
  url: string;
  key: string;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
}

export interface StorageInfo {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  usedMB: number;
  limitMB: number;
  usedPercent: number;
}

/**
 * Upload un fichier vers le bucket S3 MamuteCloud via /api/upload.
 *
 * @param file   - Objet File sélectionné par l'utilisateur
 * @param folder - Sous-dossier cible (logos, images, documents, employees, leaves…)
 * @returns URL publique du fichier uploadé
 */
export const uploadFile = async (file: File, folder: string = 'uploads'): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  // Utiliser request() directement pour envoyer FormData (sans JSON.stringify)
  const result = await apiClient.request('/upload', { method: 'POST', body: formData });
  return result as UploadResult;
};

/**
 * Récupère les infos de stockage S3 du tenant courant.
 */
export const getStorageUsage = async (): Promise<StorageInfo> => {
  return apiClient.get('/upload/storage') as Promise<StorageInfo>;
};
