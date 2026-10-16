import { Router } from 'express';
import { checkHealth } from '../controllers/health.controller';

const router = Router();

// GET /api/health
router.get('/', checkHealth);

export default router;
