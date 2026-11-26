const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { SECRET } = require('../middleware/authMiddleware');
const loginAttempts = require('../services/loginAttempts');

const TOKEN_TTL = '7d';

// Render Login Page
const getLogin = (req, res) => {
    // If user is already logged in, redirect to dashboard
    if (req.cookies.token) {
        try {
            jwt.verify(req.cookies.token, SECRET);
            return res.redirect('/admin/dashboard');
        } catch (e) {
            res.clearCookie('token');
        }
    }
    res.render('login', { error: null });
};

// Handle Post Login
const postLogin = async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const { password } = req.body;

    try {
        if (!username || !password) {
            return res.render('login', { error: 'Please provide username and password' });
        }

        if (loginAttempts.isLocked(username)) {
            return res.render('login', { error: 'Too many failed attempts. Try again in a few minutes.' });
        }

        const user = await prisma.user.findUnique({ where: { username } });
        const isMatch = user && user.isActive && await bcrypt.compare(password, user.password);

        if (!isMatch) {
            loginAttempts.recordFailure(username);
            return res.render('login', { error: 'Invalid username or password' });
        }

        loginAttempts.recordSuccess(username);
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET,
            { expiresIn: TOKEN_TTL }
        );

        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { error: 'An error occurred during login. Please try again.' });
    }
};

// Handle Logout
const logout = (req, res) => {
    res.clearCookie('token');
    res.redirect('/auth/login');
};

module.exports = {
    getLogin,
    postLogin,
    logout
};
