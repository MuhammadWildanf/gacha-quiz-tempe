const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

// Render Login Page
const getLogin = (req, res) => {
    // If user is already logged in, redirect to dashboard
    if (req.cookies.token) {
        try {
            jwt.verify(req.cookies.token, process.env.JWT_SECRET || 'supersecretkey123');
            return res.redirect('/admin/dashboard');
        } catch (e) {
            res.clearCookie('token');
        }
    }
    res.render('login', { error: null });
};

// Handle Post Login
const postLogin = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.render('login', { error: 'Please provide email and password' });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.render('login', { error: 'Invalid email or password' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'supersecretkey123',
            { expiresIn: '7d' }
        );

        // Set HttpOnly cookie
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
