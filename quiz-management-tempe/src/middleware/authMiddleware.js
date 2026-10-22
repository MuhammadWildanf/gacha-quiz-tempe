const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const protect = async (req, res, next) => {
    let token = req.cookies.token;

    if (!token) {
        if (req.originalUrl.startsWith('/api')) {
            return res.status(401).json({ message: 'Not authorized, no token' });
        }
        return res.redirect('/auth/login');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey123');

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, name: true, email: true, role: true }
        });

        if (!user) {
            res.clearCookie('token');
            if (req.originalUrl.startsWith('/api')) {
                return res.status(401).json({ message: 'User not found' });
            }
            return res.redirect('/auth/login');
        }

        req.user = user;
        // Make user object available in EJS templates automatically
        res.locals.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.clearCookie('token');
        if (req.originalUrl.startsWith('/api')) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
        return res.redirect('/auth/login');
    }
};

module.exports = { protect };
