import express from 'express';
import { authMiddleware } from '../auth.js';
import { upload } from '../utils/shared.js';
import * as ctrl from '../controllers/invoiceController.js';

const router = express.Router();

router.post('/api/luca/mark-transferred', authMiddleware, ctrl.markLucaTransferred);
router.get('/api/faturalar/:id/odemeler', authMiddleware, ctrl.getFaturaOdemeler);
router.post('/api/faturalar/:id/odeme-ekle', authMiddleware, ctrl.addFaturaOdeme);
router.delete('/api/faturalar/:faturaId/odemeler/:paymentId', authMiddleware, ctrl.deleteFaturaOdeme);
router.post('/api/invoices/import-satis', authMiddleware, ctrl.importSatis);
router.post('/api/invoices/bulk-import-satis', authMiddleware, ctrl.bulkImportSatis);
router.post('/api/invoices/import-from-logo', authMiddleware, ctrl.importFromLogo);
router.post('/api/invoices/parse-xml', authMiddleware, upload.single('file'), ctrl.parseInvoiceXml);
router.get('/api/satis-faturalari', authMiddleware, ctrl.getSatisFaturalari);
router.post('/api/satis-faturalari', authMiddleware, ctrl.createSatisFatura);
router.put('/api/satis-faturalari/:id', authMiddleware, ctrl.updateSatisFatura);
router.delete('/api/satis-faturalari/:id', authMiddleware, ctrl.deleteSatisFatura);
router.get('/api/alis-faturalari', authMiddleware, ctrl.getAlisFaturalari);
router.get('/api/alis-faturalari/:id', authMiddleware, ctrl.getAlisFaturaById);
router.post('/api/alis-faturalari', authMiddleware, ctrl.createAlisFatura);
router.put('/api/alis-faturalari/:id', authMiddleware, ctrl.updateAlisFatura);
router.delete('/api/alis-faturalari/:id', authMiddleware, ctrl.deleteAlisFatura);

export default router;
