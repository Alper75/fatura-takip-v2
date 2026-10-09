import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'personnel_module_secret_88';

export const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: {
    satisFaturalari: true,
    alisFaturalari: true,
    teklifSiparis: true,
    cariler: true,
    bankaFinans: true,
    nakitAkisi: true,
    stokYonetimi: true,
    muhasebeLuca: true,
    entegrator: true,
    personelIK: true,
    kullaniciYonetimi: true,
    sirketAyarlari: true
  },
  admin: {
    satisFaturalari: true,
    alisFaturalari: true,
    teklifSiparis: true,
    cariler: true,
    bankaFinans: true,
    nakitAkisi: true,
    stokYonetimi: true,
    muhasebeLuca: true,
    entegrator: true,
    personelIK: true,
    kullaniciYonetimi: true,
    sirketAyarlari: true
  },
  muhasebe: {
    satisFaturalari: true,
    alisFaturalari: true,
    teklifSiparis: false,
    cariler: true,
    bankaFinans: true,
    nakitAkisi: true,
    stokYonetimi: true,
    muhasebeLuca: true,
    entegrator: true,
    personelIK: false,
    kullaniciYonetimi: false,
    sirketAyarlari: false
  },
  satis: {
    satisFaturalari: true,
    alisFaturalari: false,
    teklifSiparis: true,
    cariler: true,
    bankaFinans: false,
    nakitAkisi: false,
    stokYonetimi: true,
    muhasebeLuca: false,
    entegrator: false,
    personelIK: false,
    kullaniciYonetimi: false,
    sirketAyarlari: false
  },
  depo: {
    satisFaturalari: false,
    alisFaturalari: false,
    teklifSiparis: false,
    cariler: false,
    bankaFinans: false,
    nakitAkisi: false,
    stokYonetimi: true,
    muhasebeLuca: false,
    entegrator: false,
    personelIK: false,
    kullaniciYonetimi: false,
    sirketAyarlari: false
  },
  personnel: {
    satisFaturalari: false,
    alisFaturalari: false,
    teklifSiparis: false,
    cariler: false,
    bankaFinans: false,
    nakitAkisi: false,
    stokYonetimi: false,
    muhasebeLuca: false,
    entegrator: false,
    personelIK: false,
    kullaniciYonetimi: false,
    sirketAyarlari: false
  }
};

export const resolvePermissions = (role, customPermissions) => {
  const base = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.personnel;
  if (!customPermissions) return { ...base };

  let parsed = {};
  if (typeof customPermissions === 'string') {
    try {
      parsed = JSON.parse(customPermissions);
    } catch {
      parsed = {};
    }
  } else if (typeof customPermissions === 'object') {
    parsed = customPermissions;
  }

  return { ...base, ...parsed };
};

const generateToken = (user) => {
  const permissions = resolvePermissions(user.role, user.permissions);

  return jwt.sign(
    { 
      id: user.id, 
      tc: user.tc, 
      name: user.name || '', 
      email: user.email || '', 
      role: user.role, 
      companyId: user.company_id,
      permissions
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('[Auth] Token Validation Error:', error.message);
    return null;
  }
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
};

const adminMiddleware = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
  }
};

const superAdminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Forbidden: Super Admin access required' });
  }
};

// RBAC Middleware: Check if user has permission for a specific module
const permissionMiddleware = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    // Super admin and company admin always bypass
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      return next();
    }
    // Check module permission
    if (req.user.permissions && req.user.permissions[permissionKey] === true) {
      return next();
    }
    return res.status(403).json({ 
      success: false, 
      message: `Bu işlem için yetkiniz bulunmamaktadır (${permissionKey}).` 
    });
  };
};

const rolesMiddleware = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (req.user.role === 'super_admin' || allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Bu işlem için rol yetkiniz yetersizdir.' });
  };
};

export {
  generateToken,
  verifyToken,
  authMiddleware,
  adminMiddleware,
  superAdminMiddleware,
  permissionMiddleware,
  rolesMiddleware,
  bcrypt
};
