import express from 'express';
import { authMiddleware } from '../auth.js';
import * as elogoCtrl from '../controllers/elogoUyumsoftController.js';
import * as gibCtrl from '../controllers/gibController.js';

const router = express.Router();

router.get('/api/integrator/ayarlar', authMiddleware, elogoCtrl.getIntegratorSettings);
router.post('/api/integrator/ayarlar', authMiddleware, elogoCtrl.saveIntegratorSettings);
router.get('/api/auto-sync/settings', authMiddleware, elogoCtrl.getAutoSyncSettings);
router.post('/api/auto-sync/settings', authMiddleware, elogoCtrl.saveAutoSyncSettings);
router.post('/api/auto-sync/run-now', authMiddleware, elogoCtrl.runAutoSyncNow);
router.get('/api/auto-sync/logs', authMiddleware, elogoCtrl.getAutoSyncLogs);
router.post('/api/elogo/fatura-gonder/:id', authMiddleware, elogoCtrl.sendElogoInvoice);
router.get('/api/elogo/gelen-faturalar', authMiddleware, elogoCtrl.getElogoGelenFaturalar);
router.get('/api/elogo/giden-faturalar', authMiddleware, elogoCtrl.getElogoGidenFaturalar);
router.get('/api/uyumsoft/giden-faturalar', authMiddleware, elogoCtrl.getUyumsoftGidenFaturalar);
router.get('/api/uyumsoft/giden-esmm', authMiddleware, elogoCtrl.getUyumsoftGidenEsmm);
router.get('/api/elogo/fatura-pdf/:uuid', elogoCtrl.getElogoFaturaPdf);
router.get('/api/uyumsoft/esmm-pdf/:uuid', elogoCtrl.getUyumsoftEsmmPdf);
router.get('/api/uyumsoft/gelen-faturalar', authMiddleware, elogoCtrl.getUyumsoftGelenFaturalar);
router.get('/api/uyumsoft/fatura-pdf/:uuid', elogoCtrl.getUyumsoftFaturaPdf);
router.post('/api/gib/create-draft', authMiddleware, gibCtrl.gibCreateDraft);
router.post('/api/gib/recipient-info', authMiddleware, gibCtrl.gibRecipientInfo);
router.post('/api/gib/invoices', authMiddleware, gibCtrl.gibGetInvoices);
router.post('/api/gib/download-pdf', authMiddleware, gibCtrl.gibDownloadPdf);
router.post('/api/gib/invoice-details', authMiddleware, gibCtrl.gibInvoiceDetails);
router.post('/api/gib/force-logout', authMiddleware, gibCtrl.gibForceLogout);
router.post('/api/gib/logout', authMiddleware, gibCtrl.gibLogout);
router.get('/api/gib/session-status', authMiddleware, gibCtrl.gibSessionStatus);
router.get('/api/cron/sync-elogo', elogoCtrl.cronSyncElogo);
router.get('/api/gib/dijital/captcha', gibCtrl.gibDijitalCaptcha);
router.post('/api/gib/dijital/login', gibCtrl.gibDijitalLogin);
router.post('/api/gib/dijital/tebligatlar', gibCtrl.gibDijitalTebligatlar);
router.post('/api/gib/dijital/tebligat-belgeleri', gibCtrl.gibDijitalTebligatBelgeleri);
router.post('/api/gib/dijital/tebligat-indir', gibCtrl.gibDijitalTebligatIndir);

export default router;
