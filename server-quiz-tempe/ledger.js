/**
 * Penyimpanan ledger transaksi gacha (JSON file).
 *
 * Sengaja diisolasi di satu modul supaya mudah diganti ke SQLite nanti
 * tanpa mengubah logic di server.js. API yang dipakai server:
 *   - loadLedger() -> Array entri
 *   - saveLedger(array) -> void
 */
const fs = require("fs");
const path = require("path");

// Di VPS/Docker, arahkan DATA_DIR ke volume persisten (mis. /app/data)
// supaya ledger tidak hilang setiap container di-rebuild.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const LEDGER_FILE = path.join(DATA_DIR, "tickets_local.json");

function loadLedger() {
    if (!fs.existsSync(LEDGER_FILE)) return [];
    try {
        const raw = fs.readFileSync(LEDGER_FILE, "utf8").trim();
        if (!raw) return [];
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error(`⚠️ [LEDGER] Gagal membaca ${path.basename(LEDGER_FILE)}: ${err.message}. Dianggap kosong.`);
        return [];
    }
}

function saveLedger(data) {
    const content = JSON.stringify(data, null, 2);
    // Tulis atomik: file sementara lalu rename, supaya ledger tidak korup
    // kalau listrik mati / PC crash saat menyimpan.
    const tmpFile = `${LEDGER_FILE}.tmp`;
    try {
        fs.writeFileSync(tmpFile, content);
        fs.renameSync(tmpFile, LEDGER_FILE);
    } catch (err) {
        try { fs.unlinkSync(tmpFile); } catch { /* abaikan */ }
        fs.writeFileSync(LEDGER_FILE, content);
    }
}

// Cek folder data benar-benar bisa ditulis. Kalau tidak, tiket TIDAK akan
// tersimpan dan scan ulang akan selalu memanggil Vendor (ALREADY_USED).
function checkWritable() {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        const probe = path.join(DATA_DIR, `.write-test-${process.pid}`);
        fs.writeFileSync(probe, "ok");
        fs.unlinkSync(probe);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

module.exports = { loadLedger, saveLedger, checkWritable, LEDGER_FILE, DATA_DIR };
