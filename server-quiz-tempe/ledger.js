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

const LEDGER_FILE = path.join(__dirname, "tickets_local.json");

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

module.exports = { loadLedger, saveLedger, LEDGER_FILE };
