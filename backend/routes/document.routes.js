
import { Router } from 'express';
import { DocumentController } from '../controllers/DocumentController.js';
import { checkPermission } from '../middlewares/rbac.js';

const router = Router();

/**
 * @route POST /api/documents/upload
 * @desc  Upload d'un document (Multer doit être configuré au niveau de l'app)
 */
// Allow HR_MANAGER to upload employee documents as well
router.post('/upload', checkPermission(['ADMIN', 'MANAGER', 'SALES', 'HR_MANAGER']), DocumentController.upload);

/**
 * @route GET /api/documents/entity/:type/:id
 * @desc  Liste les fichiers d'une entité
 */
router.get('/entity/:type/:id', DocumentController.getEntityDocuments);

/**
 * @route GET /api/documents/download/:id
 * @desc  Téléchargement sécurisé
 */
router.get('/download/:id', DocumentController.download);

export default router;
