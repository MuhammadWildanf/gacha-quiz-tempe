/**
 * Konfigurasi permainan global (sama untuk semua mesin).
 * Nilai yang valid berasal dari panel Unity (admin), lalu disimpan di sini.
 *
 * Stok TIDAK ada di sini — stok per mesin.
 *
 * Urutan prioritas:
 *   1. game_config.json  (hasil simpan dari Unity — paling tinggi)
 *   2. default kode      (10 soal, 10 poin/benar, menang >= 70 poin)
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const CONFIG_FILE = path.join(DATA_DIR, "game_config.json");

const DEFAULTS = {
    pointsPerCorrect: 10,
    maxQuestions: 10,
    minimumScoreToWin: 70
};

const LIMITS = {
    pointsPerCorrect: { min: 1, max: 1000 },
    maxQuestions: { min: 0, max: 500 },      // 0 = semua soal
    minimumScoreToWin: { min: 1, max: 100000 }
};

function toInt(value, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) ? n : fallback;
}

function inRange(n, { min, max }) {
    return Number.isInteger(n) && n >= min && n <= max;
}

let current = { ...DEFAULTS };

function load() {
    if (!fs.existsSync(CONFIG_FILE)) return;
    try {
        const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
        for (const key of Object.keys(DEFAULTS)) {
            if (raw[key] !== undefined) current[key] = toInt(raw[key], current[key]);
        }
    } catch (err) {
        console.error(`⚠️ [GAME-CONFIG] Gagal membaca ${path.basename(CONFIG_FILE)}: ${err.message}. Memakai nilai default.`);
    }
}

function save() {
    const content = JSON.stringify(current, null, 2);
    const tmpFile = `${CONFIG_FILE}.tmp`;
    try {
        fs.writeFileSync(tmpFile, content);
        fs.renameSync(tmpFile, CONFIG_FILE);
    } catch (err) {
        try { fs.unlinkSync(tmpFile); } catch { /* abaikan */ }
        fs.writeFileSync(CONFIG_FILE, content);
    }
}

function get() {
    return { ...current };
}

/**
 * Update semua nilai game sekaligus. Melempar Error bila ada nilai tidak valid.
 * Mengembalikan { config, warning } — warning berisi peringatan yang tidak memblokir simpan.
 */
function update(patch = {}) {
    const next = { ...current };

    for (const key of Object.keys(DEFAULTS)) {
        const n = toInt(patch[key], NaN);
        if (!Number.isInteger(n) || !inRange(n, LIMITS[key])) {
            throw new Error(`${key} harus bilangan bulat ${LIMITS[key].min}-${LIMITS[key].max}.`);
        }
        next[key] = n;
    }

    current = next;
    save();

    let warning = null;
    const maxScore = next.maxQuestions > 0 ? next.maxQuestions * next.pointsPerCorrect : null;
    if (maxScore !== null && next.minimumScoreToWin > maxScore) {
        warning = `Skor maks ${maxScore} lebih kecil dari target menang ${next.minimumScoreToWin}, jadi tidak ada yang bisa menang.`;
    }

    return { config: get(), warning };
}

load();

module.exports = { get, update, reload: load, limits: LIMITS, defaults: DEFAULTS, file: CONFIG_FILE };
