const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const quizRoutes = require('./routes/quizRoutes');
const questionRoutes = require('./routes/questionRoutes');
const apiRoutes = require('./routes/apiRoutes');
const { adminRouter: gachaAdminRoutes, apiRouter: gachaApiRoutes } = require('./routes/gachaRoutes');
const { adminRouter: boothAdminRoutes, apiRouter: boothApiRoutes } = require('./routes/boothRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const { adminRouter: stockLogAdminRoutes, apiRouter: stockLogApiRoutes } = require('./routes/stockLogRoutes');
const authApiRoutes = require('./routes/authApiRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();

// Set View Engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static assets from src/public
app.use(express.static(path.join(__dirname, 'public')));

// Serve static files from root uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Configure Express Session (useful for flash messages or session states if needed)
app.use(session({
    secret: require('./middleware/authMiddleware').SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Route Definitions
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/quizzes', quizRoutes);
app.use('/admin/quizzes', questionRoutes); // Connect question endpoints under /admin/quizzes
app.use('/admin', gachaAdminRoutes);
app.use('/admin', boothAdminRoutes);
app.use('/admin', userRoutes);
app.use('/admin', roleRoutes);
app.use('/admin', categoryRoutes);
app.use('/admin', stockLogAdminRoutes);
app.use('/admin', auditRoutes);
app.use('/api', apiRoutes);
app.use('/api', gachaApiRoutes);
app.use('/api', boothApiRoutes);
app.use('/api', authApiRoutes);
app.use('/api', stockLogApiRoutes);

// Home route redirects to admin dashboard (which will redirect to login if not authenticated)
app.get('/', (req, res) => {
    res.redirect('/admin/dashboard');
});

module.exports = app;
