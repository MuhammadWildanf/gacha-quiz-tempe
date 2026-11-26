/**
 * Pengaturan runtime Gacha (bisa diubah dari dashboard tanpa restart).
 *
 * Urutan prioritas:
 *   1. settings_local.json  (hasil simpan dari dashboard — paling tinggi)
 *   2. .env                 (MAX_GAME_ATTEMPTS — nilai awal)
 *   3. default kode         (3x main)
 *
 * Soal, poin, dan ambang menang TIDAK di sini — lihat game-config.js (dari Unity).
 */
const fs = require("fs");
const path = require("path");

// Sama seperti ledger: bisa diarahkan ke volume persisten lewat DATA_DIR.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SETTINGS_FILE = path.join(DATA_DIR, "settings_local.json");

const LIMITS = {
    maxGameAttempts: { min: 1, max: 50 }
};

function toInt(value, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) ? n : fallback;
}

function clamp(value, { min, max }) {
    return Math.min(max, Math.max(min, value));
}

function createSettingsStore(envDefaults = {}) {
    const current = {
        maxGameAttempts: clamp(toInt(envDefaults.maxGameAttempts, 3), LIMITS.maxGameAttempts)
    };

    function load() {
        if (!fs.existsSync(SETTINGS_FILE)) return;
        try {
            const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
            if (raw.maxGameAttempts !== undefined) {
                current.maxGameAttempts = clamp(toInt(raw.maxGameAttempts, current.maxGameAttempts), LIMITS.maxGameAttempts);
            }
        } catch (err) {
            console.error(`⚠️ [SETTINGS] Gagal membaca ${path.basename(SETTINGS_FILE)}: ${err.message}. Memakai nilai default.`);
        }
    }

    function save() {
        const content = JSON.stringify(current, null, 2);
        // Tulis atomik agar settings tidak korup saat listrik mati.
        const tmpFile = `${SETTINGS_FILE}.tmp`;
        try {
            fs.writeFileSync(tmpFile, content);
            fs.renameSync(tmpFile, SETTINGS_FILE);
        } catch (err) {
            try { fs.unlinkSync(tmpFile); } catch { /* abaikan */ }
            fs.writeFileSync(SETTINGS_FILE, content);
        }
    }

    function get() {
        return { ...current };
    }

    /**
     * Update sebagian/semua pengaturan. Melempar Error dengan pesan siap tampil
     * kalau ada nilai yang tidak valid.
     */
    function update(patch = {}) {
        const next = { ...current };

        if (patch.maxGameAttempts !== undefined && patch.maxGameAttempts !== "") {
            const n = Number(patch.maxGameAttempts);
            if (!Number.isInteger(n) || n < LIMITS.maxGameAttempts.min || n > LIMITS.maxGameAttempts.max) {
                throw new Error(`Kesempatan bermain harus angka bulat ${LIMITS.maxGameAttempts.min}-${LIMITS.maxGameAttempts.max}.`);
            }
            next.maxGameAttempts = n;
        }

        Object.assign(current, next);
        save();
        return get();
    }

    load();

    return { get, update, reload: load, limits: LIMITS, file: SETTINGS_FILE };
}

module.exports = createSettingsStore({
    maxGameAttempts: process.env.MAX_GAME_ATTEMPTS
});
module.exports.createSettingsStore = createSettingsStore;
module.exports.SETTINGS_FILE = SETTINGS_FILE;
