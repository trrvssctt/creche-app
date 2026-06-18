import { Router } from 'express';
import { UploadController, uploadMiddleware } from '../controllers/UploadController.js';

const router = Router();

// POST /api/upload  — upload un fichier vers S3 MamuteCloud
router.post('/', uploadMiddleware, UploadController.uploadFile);

// GET /api/upload/storage  — espace de stockage du tenant
router.get('/storage', UploadController.getStorageUsage);

// POST /api/upload/request-storage  — demande d'extension de quota
router.post('/request-storage', UploadController.requestStorageExtension);

export default router;
