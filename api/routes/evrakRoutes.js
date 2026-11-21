import express from 'express';
import { authMiddleware } from '../auth.js';
import { upload } from '../utils/shared.js';
import * as ctrl from '../controllers/evrakController.js';

const router = express.Router();

router.get('/api/evrak-havuzu', authMiddleware, ctrl.listEvrakHavuzu);
router.post('/api/evrak-havuzu/upload', authMiddleware, upload.array('files', 50), ctrl.uploadEvrakHavuzu);
router.get('/api/evrak-havuzu/:id/file', authMiddleware, ctrl.getEvrakFile);
router.put('/api/evrak-havuzu/:id', authMiddleware, ctrl.updateEvrakHavuzu);
router.post('/api/evrak-havuzu/:id/reanalyze', authMiddleware, ctrl.reanalyzeEvrak);
router.post('/api/evrak-havuzu/:id/approve', authMiddleware, ctrl.approveEvrak);
router.post('/api/evrak-havuzu/bulk-approve', authMiddleware, ctrl.bulkApproveEvrak);
router.delete('/api/evrak-havuzu/:id', authMiddleware, ctrl.deleteEvrakHavuzu);

export default router;
