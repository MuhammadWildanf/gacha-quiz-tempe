// Untuk panggilan antar-server (server-quiz-tempe). Bukan untuk browser.
function requireInternalKey(req, res, next) {
    const key = process.env.INTERNAL_API_KEY || '';
    if (!key) return res.status(500).json({ success: false, message: 'INTERNAL_API_KEY belum diisi.' });
    if (req.headers['x-internal-key'] !== key) {
        return res.status(401).json({ success: false, message: 'Kunci internal salah.' });
    }
    next();
}

module.exports = { requireInternalKey };
