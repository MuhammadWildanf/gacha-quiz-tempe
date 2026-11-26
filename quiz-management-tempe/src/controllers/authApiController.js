const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { SECRET } = require('../middleware/authMiddleware');
const { getPermissionsForRole } = require('../services/authz');
const loginAttempts = require('../services/loginAttempts');

const API_TOKEN_TTL_SECONDS = 12 * 60 * 60;

// POST /api/auth/login — dipakai Unity (panel settings mesin)
const postApiLogin = async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const { password } = req.body;

    try {
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
        }

        if (loginAttempts.isLocked(username)) {
            return res.status(429).json({ success: false, message: 'Terlalu banyak percobaan gagal. Coba lagi beberapa menit.' });
        }

        const user = await prisma.user.findUnique({ where: { username } });
        const isMatch = user && user.isActive && await bcrypt.compare(password, user.password);

        if (!isMatch) {
            loginAttempts.recordFailure(username);
            return res.status(401).json({ success: false, message: 'Username atau password salah.' });
        }

        loginAttempts.recordSuccess(username);
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        const permissions = await getPermissionsForRole(user.role);
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, permissions },
            SECRET,
            { expiresIn: API_TOKEN_TTL_SECONDS }
        );

        res.json({
            success: true,
            token,
            expiresIn: API_TOKEN_TTL_SECONDS,
            user: { username: user.username, name: user.name, role: user.role, permissions }
        });
    } catch (error) {
        console.error('API login error:', error.message);
        res.status(500).json({ success: false, message: 'Server gagal memproses login.' });
    }
};

module.exports = { postApiLogin };
