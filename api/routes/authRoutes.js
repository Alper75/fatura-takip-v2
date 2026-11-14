import express from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { client, initDb } from '../db.js';
import {
  generateToken,
  authMiddleware,
  adminMiddleware,
  superAdminMiddleware,
  resolvePermissions,
  bcrypt
} from '../auth.js';
import { n } from '../utils/shared.js';

const router = express.Router();

router.post('/api/auth/login', async (req, res) => {
  const { tc, password } = req.body;
  if (!tc || !password) return res.status(400).json({ success: false, message: 'TC ve şifre gereklidir.' });
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM users WHERE tc = ?',
      args: [tc]
    });
    const user = rs.rows[0];
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Geçersiz TC veya şifre.' });
    }

    if (user.status === 'passive') {
      return res.status(403).json({ success: false, message: 'Kullanıcı hesabınız devre dışı bırakılmıştır. Lütfen yöneticinizle iletişime geçin.' });
    }

    // Check Company Status & Info
    const compRs = await client.execute({
      sql: 'SELECT id, name, tax_no, address, email, company_type, status FROM companies WHERE id = ?',
      args: [user.company_id || 1]
    });
    const company = compRs.rows[0];
    if (company && company.status === 'passive') {
      return res.status(403).json({ success: false, message: 'Şirket hesabınız pasif durumdadır. Lütfen yönetici ile iletişime geçin.' });
    }

    const permissions = resolvePermissions(user.role, user.permissions);
    const token = generateToken(user);
    res.json({ 
      success: true, 
      token, 
      user: { 
        id: user.id, 
        tc: user.tc, 
        name: user.name || '',
        email: user.email || '',
        role: user.role, 
        companyId: user.company_id, 
        permissions,
        mustChangePassword: !!user.must_change_password 
      },
      company: company || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Profile / Session Refresh
router.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT id, tc, name, email, role, company_id, permissions, must_change_password, status FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const user = rs.rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

    const [compRs, vRs] = await Promise.all([
      client.execute({
        sql: 'SELECT id, name, tax_no, address, email, company_type, status FROM companies WHERE id = ?',
        args: [user.company_id || 1]
      }),
      client.execute({
        sql: 'SELECT * FROM company_vehicles WHERE company_id = ?',
        args: [user.company_id || 1]
      })
    ]);
    const company = compRs.rows[0] ? { ...compRs.rows[0], vehicles: vRs.rows || [] } : null;

    const permissions = resolvePermissions(user.role, user.permissions);
    res.json({
      success: true,
      user: {
        id: user.id,
        tc: user.tc,
        name: user.name || '',
        email: user.email || '',
        role: user.role,
        companyId: user.company_id,
        permissions,
        mustChangePassword: !!user.must_change_password,
        status: user.status || 'active'
      },
      company
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- RBAC: COMPANY USERS MANAGEMENT ---

// List all company users
router.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: `
        SELECT u.id, u.tc, u.name, u.email, u.role, u.permissions, u.status, u.must_change_password, u.created_at,
               p.first_name, p.last_name, p.position, p.department
        FROM users u
        LEFT JOIN personnel p ON p.user_id = u.id
        WHERE u.company_id = ?
        ORDER BY u.created_at DESC
      `,
      args: [req.user.companyId]
    });

    const users = rs.rows.map(u => ({
      id: u.id,
      tc: u.tc,
      name: u.name || (u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.tc),
      email: u.email || '',
      role: u.role,
      permissions: resolvePermissions(u.role, u.permissions),
      status: u.status || 'active',
      mustChangePassword: !!u.must_change_password,
      createdAt: u.created_at,
      position: u.position || '',
      department: u.department || ''
    }));

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new company user with role and permissions
router.post('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  const { tc, name, email, password, role = 'personnel', permissions } = req.body;
  if (!tc || !password) {
    return res.status(400).json({ success: false, message: 'Kullanıcı adı/TC ve şifre gereklidir.' });
  }

  try {
    const existing = await client.execute({
      sql: 'SELECT id FROM users WHERE tc = ?',
      args: [tc]
    });
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Bu kullanıcı adı/TC ile kayıtlı bir hesap zaten var.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const permString = permissions ? (typeof permissions === 'string' ? permissions : JSON.stringify(permissions)) : null;

    const result = await client.execute({
      sql: `
        INSERT INTO users (tc, password, role, company_id, name, email, permissions, status, must_change_password)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0)
      `,
      args: [tc, hashedPassword, role, req.user.companyId, name || '', email || '', permString]
    });

    res.json({ 
      success: true, 
      message: 'Kullanıcı başarıyla oluşturuldu.',
      userId: Number(result.lastInsertRowid)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user role, permissions, status, name, email
router.put('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, email, role, permissions, status } = req.body;

  try {
    const existing = await client.execute({
      sql: 'SELECT id, role, company_id FROM users WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    // Protect admin from accidentally locking self out
    if (Number(id) === req.user.id && role && role !== req.user.role && req.user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Kendi yönetici rolünüzü değiştiremezsiniz.' });
    }

    const permString = permissions !== undefined ? (typeof permissions === 'string' ? permissions : JSON.stringify(permissions)) : null;

    await client.execute({
      sql: `
        UPDATE users 
        SET name = COALESCE(?, name),
            email = COALESCE(?, email),
            role = COALESCE(?, role),
            permissions = COALESCE(?, permissions),
            status = COALESCE(?, status)
        WHERE id = ? AND company_id = ?
      `,
      args: [
        name !== undefined ? name : null, 
        email !== undefined ? email : null, 
        role || null, 
        permString, 
        status || null, 
        id, 
        req.user.companyId
      ]
    });

    res.json({ success: true, message: 'Kullanıcı bilgileri ve yetkileri güncellendi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reset user password
router.put('/api/admin/users/:id/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { newPassword = '123456' } = req.body;

  try {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await client.execute({
      sql: 'UPDATE users SET password = ?, must_change_password = 1 WHERE id = ? AND company_id = ?',
      args: [hashedPassword, id, req.user.companyId]
    });

    res.json({ success: true, message: `Şifre sıfırlandı. Yeni geçici şifre: ${newPassword}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete user
router.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;

  if (Number(id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'Kendi hesabınızı silemezsiniz.' });
  }

  try {
    await client.execute({
      sql: 'DELETE FROM users WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });

    res.json({ success: true, message: 'Kullanıcı hesabı silindi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ success: false, message: 'Yeni şifre gereklidir.' });
  try {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await client.execute({
      sql: 'UPDATE users SET password = ?, must_change_password = 0 WHERE id = ? AND company_id = ?',
      args: [hashedPassword, req.user.id, req.user.companyId]
    });
    res.json({ success: true, message: 'Şifre başarıyla değiştirildi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/api/personnel/me', authMiddleware, async (req, res) => {
  try {
    const rs = await client.execute({
      sql: 'SELECT * FROM personnel WHERE user_id = ? AND company_id = ?',
      args: [req.user.id, req.user.companyId]
    });
    res.json({ success: true, personnel: rs.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- MY COMPANY (All Users) ---
router.get('/api/my-company', authMiddleware, async (req, res) => {
  try {
    const compId = req.user.companyId || 1;
    const [rs, vRs] = await Promise.all([
      client.execute({
        sql: 'SELECT id, name, tax_no, address, email, company_type, status FROM companies WHERE id = ?',
        args: [compId]
      }),
      client.execute({
        sql: 'SELECT * FROM company_vehicles WHERE company_id = ?',
        args: [compId]
      })
    ]);
    if (rs.rows.length === 0) return res.status(404).json({ success: false, message: 'Şirket bulunamadı.' });
    
    const company = rs.rows[0];
    company.vehicles = vRs.rows || [];

    res.json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/api/my-company', authMiddleware, async (req, res) => {
  const { name, tax_no, address, email, company_type } = req.body;
  const compId = req.user.companyId || 1;
  try {
    const existing = await client.execute({
      sql: 'SELECT * FROM companies WHERE id = ?',
      args: [compId]
    });
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Şirket bulunamadı.' });
    const current = existing.rows[0];

    await client.execute({
      sql: 'UPDATE companies SET name = ?, tax_no = ?, address = ?, email = ?, company_type = ? WHERE id = ?',
      args: [
        name !== undefined ? name : current.name,
        tax_no !== undefined ? n(tax_no) : current.tax_no,
        address !== undefined ? n(address) : current.address,
        email !== undefined ? n(email) : current.email,
        company_type !== undefined ? company_type : current.company_type || 'BİLANÇO',
        compId
      ]
    });
    res.json({ success: true, message: 'Şirket bilgileri güncellendi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- VEHICLES ---
router.post('/api/vehicles', authMiddleware, async (req, res) => {
  const { plate, type, brand_model } = req.body;
  if (!plate || !type) return res.status(400).json({ success: false, message: 'Plaka ve araç türü gereklidir.' });
  try {
    await client.execute({
      sql: 'INSERT INTO company_vehicles (company_id, plate, type, brand_model) VALUES (?, ?, ?, ?)',
      args: [req.user.companyId, plate.toUpperCase().replace(/\s+/g, ''), type, brand_model || '']
    });
    res.json({ success: true, message: 'Araç kaydedildi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/api/vehicles/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await client.execute({
      sql: 'DELETE FROM company_vehicles WHERE id = ? AND company_id = ?',
      args: [id, req.user.companyId]
    });
    res.json({ success: true, message: 'Araç silindi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


router.get('/api/super/companies', authMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const rs = await client.execute('SELECT * FROM companies ORDER BY name ASC');
    res.json({ success: true, data: rs.rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/api/super/companies', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { name, tax_no, address, email, admin_tc, admin_password, company_type } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Şirket adı zorunludur.' });

  try {
    // 1. Create Company
    const compResult = await client.execute({
      sql: 'INSERT INTO companies (name, tax_no, address, email, status, company_type) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      args: [n(name), n(tax_no), n(address), n(email), 'active', company_type || 'BİLANÇO']
    });
    
    const newCompanyId = compResult.rows[0].id;

    // 2. Create Admin User if provided
    if (admin_tc && admin_password) {
      const hashedPassword = bcrypt.hashSync(admin_password, 10);
      await client.execute({
        sql: 'INSERT INTO users (tc, password, role, must_change_password, company_id) VALUES (?, ?, ?, ?, ?)',
        args: [admin_tc, hashedPassword, 'admin', 0, newCompanyId]
      });
    }

    res.json({ success: true, message: 'Şirket ve yönetici hesabı başarıyla oluşturuldu.', companyId: newCompanyId });
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
});

router.put('/api/super/companies/:id', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, tax_no, address, email, status, company_type } = req.body;
  try {
    await client.execute({
      sql: 'UPDATE companies SET name = ?, tax_no = ?, address = ?, email = ?, status = ?, company_type = ? WHERE id = ?',
      args: [n(name), n(tax_no), n(address), n(email), status || 'active', company_type || 'BİLANÇO', id]
    });
    res.json({ success: true, message: 'Şirket güncellendi.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.delete('/api/super/companies/:id', authMiddleware, superAdminMiddleware, async (req, res) => {
  const { id } = req.params;
  if (String(id) === '1') return res.status(400).json({ success: false, message: 'Varsayılan şirket silinemez.' });
  
  try {
    // 1. Manually delete all associated data (Cascade)
    const tables = [
      'users', 'personnel', 'pointage', 'leaves', 'documents', 
      'assets', 'trainings', 'payroll', 'requests', 'announcements', 
      'cariler', 'cari_hareketler', 'satis_faturalari', 'alis_faturalari', 
      'cek_senetler', 'banka_hesaplari', 'masraf_kurallari', 
      'kesilecek_faturalar', 'gider_kategorileri'
    ];

    const deleteStatements = tables.map(t => ({
      sql: `DELETE FROM ${t} WHERE company_id = ?`,
      args: [id]
    }));

    // Add company deletion itself
    deleteStatements.push({
      sql: 'DELETE FROM companies WHERE id = ?',
      args: [id]
    });

    await client.batch(deleteStatements);
    res.json({ success: true, message: 'Şirket ve tüm bağlı veriler başarıyla silindi.' });
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
});

// --- GİDER KATEGORİLERİ ---

router.get('/api/admin/db-init', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await initDb();
    res.json({ success: true, message: 'Veritabanı şeması başarıyla başlatıldı ve güncellendi.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Veritabanı başlatma hatası: ' + error.message });
  }
});

// Upgrade to Super Admin Route (Constraint Fix + Role Update)
// NOTE: We use a secret param to allow browser access without Bearer token
router.get('/api/admin/upgrade-to-super', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== 'super_upgrade_88') {
    return res.status(401).json({ success: false, message: 'Unauthorized: Geçersiz anahtar.' });
  }

  try {
    console.log('Starting Super Admin Upgrade...');
    await client.execute({
      sql: "UPDATE users SET role = 'super_admin' WHERE tc = 'admin'",
      args: []
    });

    res.json({ 
      success: true, 
      message: 'Başarıyla Süper Admin yapıldınız! Lütfen sayfayı yenileyin veya çıkış-giriş yapın.' 
    });
  } catch (error) {
    console.error('UPGRADE ERROR:', error);
    res.status(500).json({ success: false, message: 'Yükseltme hatası: ' + error.message });
  }
});

// Health/Debug Check Route
router.get('/api/debug/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'online', 
    env: { 
      turso_url: !!process.env.TURSO_URL, 
      turso_token: !!process.env.TURSO_AUTH_TOKEN 
    } 
  });
});
// --- QUOTATIONS (TEKLIFLER) ---

export default router;
