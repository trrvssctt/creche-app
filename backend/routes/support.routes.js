import { Router } from 'express';
import { SupportController } from '../controllers/SupportController.js';
import { checkRole } from '../middlewares/rbac.js';

const router = Router();

// Routes tenant (accessible à tout utilisateur authentifié + tenantIsolation déjà appliqué)
router.post('/', SupportController.createTicket);
router.get('/', SupportController.getMyTickets);
router.get('/:id', SupportController.getTicket);

export default router;
