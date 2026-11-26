/**
 * Verifikasi token dari quiz-management-tempe (login admin/operator).
 * Kedua project HARUS memakai JWT_SECRET yang sama di .env.
 */
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error("JWT_SECRET belum diisi di .env");

function requirePermission(permission) {
    return (req, res, next) => {
        const header = req.headers.authorization || "";
        if (!header.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "Token diperlukan." });
        }

        let decoded;
        try {
            decoded = jwt.verify(header.slice(7), SECRET);
        } catch {
            return res.status(401).json({ success: false, message: "Token tidak valid atau sudah kedaluwarsa." });
        }

        const permissions = Array.isArray(decoded.permissions) ? decoded.permissions : [];
        if (!permissions.includes(permission)) {
            return res.status(403).json({ success: false, message: "Akun ini tidak punya izin untuk tindakan ini." });
        }

        req.authUser = { id: decoded.id, username: decoded.username, role: decoded.role };
        next();
    };
}

module.exports = { requirePermission };
