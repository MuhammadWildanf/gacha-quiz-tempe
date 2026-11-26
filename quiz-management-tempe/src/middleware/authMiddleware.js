const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { getPermissionsForRole } = require('../services/authz');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET belum diisi di .env');

function getToken(req) {
    if (req.cookies && req.cookies.token) return req.cookies.token;
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) return header.slice(7);
    return null;
}

function isApi(req) {
    return req.originalUrl.startsWith('/api');
}

const protect = async (req, res, next) => {
    const token = getToken(req);

    if (!token) {
        if (isApi(req)) return res.status(401).json({ message: 'Not authorized, no token' });
        return res.redirect('/auth/login');
    }

    try {
        const decoded = jwt.verify(token, SECRET);

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, name: true, username: true, role: true, isActive: true }
        });

        if (!user || !user.isActive) {
            res.clearCookie('token');
            if (isApi(req)) return res.status(401).json({ message: 'User not found or inactive' });
            return res.redirect('/auth/login');
        }

        const permissions = await getPermissionsForRole(user.role);
        req.user = { ...user, permissions };
        res.locals.user = req.user;
        res.locals.can = (key) => permissions.includes(key);
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        res.clearCookie('token');
        if (isApi(req)) return res.status(401).json({ message: 'Not authorized, token failed' });
        return res.redirect('/auth/login');
    }
};

// Pakai setelah protect. Semua izin yang disebut harus dimiliki.
function requirePermission(...keys) {
    return (req, res, next) => {
        const allowed = req.user && keys.every(key => req.user.permissions.includes(key));
        if (allowed) return next();

        if (isApi(req)) return res.status(403).json({ message: 'Forbidden' });

        const perms = (req.user && req.user.permissions) || [];
        const fallback = perms.includes('dashboard.view') ? '/admin/dashboard'
            : perms.includes('quiz.manage') ? '/admin/quizzes'
            : null;

        if (fallback && req.path !== fallback && !req.originalUrl.startsWith(fallback)) {
            return res.redirect(fallback);
        }
        return res.status(403).send('Akses ditolak. Hubungi admin untuk hak akses.');
    };
}

module.exports = { protect, requirePermission, SECRET };
