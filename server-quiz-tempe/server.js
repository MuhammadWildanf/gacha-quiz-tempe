const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ==========================================
// ⚙️ KONFIGURASI — Ubah di sini
// ==========================================
const PORT = 3005;
const LEDGER_FILE = path.join(__dirname, "tickets_local.json");

// --- Aturan menang (koin) — SAMAKAN dengan GachaSession.winMinPercentage di Unity ---
// isWin final = (score/maxScore*100 >= WIN_MIN_PERCENTAGE). Bisa diubah tanpa ubah logika.
const WIN_MIN_PERCENTAGE = 80;
// Hadiah default jika Unity kirim isWin=true tanpa prizeTier
const WIN_PRIZE_DEFAULT = "HADIAH";

// Kode event vendor pada payload QR (harus sama dgn yg dicetak vendor)

// --- Format QR vendor (opaque 171 char, base64url -> 128 bytes) ---
// Sample vendor: Y5X01g9AWhfSmj5BTjbhA... (171 char)
// Zona fixed: prefix 21 char [0-20] + middle 83 char di pos 65.
// Zona variabel: batch 43 char [21-63] + serial unik 22 char [149-170].
const VENDOR_LENGTH = 171;
const VENDOR_PREFIX = "Y5X01g9AWhfSmj5BTjbhA";
const VENDOR_MIDDLE = "30sfVreDY0RP7ccjOL5L81Xv_Kw5Cv8Ns1Y-J-K1C9GBKsvVTcPHvI--8gzAfTh4Qx2MYCzQSx2HOuW8RX8";
const VENDOR_MIDDLE_POS = 65;
const VENDOR_CHARSET = /^[A-Za-z0-9\-_]+$/;

// ==========================================
// 1. HELPER VALIDASI QR VENDOR
// ==========================================
// Parse & validasi QR vendor (opaque 171 char).
// Return { valid, reason, ... } atau { valid:false, reason }
function parseVendorQR(raw) {
    if (raw.length !== VENDOR_LENGTH) return { valid: false, reason: "INVALID_FORMAT" };
    if (!VENDOR_CHARSET.test(raw)) return { valid: false, reason: "INVALID_FORMAT" };
    if (!raw.startsWith(VENDOR_PREFIX)) return { valid: false, reason: "INVALID_EVENT" };
    if (raw.indexOf(VENDOR_MIDDLE) !== VENDOR_MIDDLE_POS) return { valid: false, reason: "INVALID_EVENT" };
    return {
        valid: true,
        format: "VENDOR",
        eventCode: VENDOR_PREFIX,
        batch: raw.slice(21, 64),
        serial: raw.slice(149),
        ticketId: raw.slice(149),
        qrCode: raw
    };
}

// Parse & validasi QR. Return { valid, reason, ... } atau { valid:false, reason }
function parseQRCode(qr) {
    const raw = String(qr || "").trim();
    return parseVendorQR(raw);
}

// Analisis detail QR untuk debugging / adaptasi format baru
// Tidak menyimpan ke ledger — hanya menampilkan setiap tahap validasi.
function analyzeVendorQR(raw) {
    const res = {
        input: raw,
        length: raw.length,
        steps: [],
        finalStatus: "INVALID_FORMAT",
        note: "",
        field: null
    };
    const lenOk = raw.length === VENDOR_LENGTH;
    res.steps.push({
        name: `Panjang (${VENDOR_LENGTH} char)`,
        ok: lenOk,
        detail: lenOk ? `${raw.length} char sesuai` : `${raw.length} char ≠ ${VENDOR_LENGTH} — cek hasil scan`
    });
    if (!lenOk) { res.finalStatus = "INVALID_FORMAT"; return res; }

    const charsetOk = VENDOR_CHARSET.test(raw);
    res.steps.push({
        name: "Charset (base64url)",
        ok: charsetOk,
        detail: charsetOk ? "Hanya A-Z a-z 0-9 - _" : "Ada karakter di luar base64url"
    });
    if (!charsetOk) { res.finalStatus = "INVALID_FORMAT"; return res; }

    const prefixOk = raw.startsWith(VENDOR_PREFIX);
    res.steps.push({
        name: "Prefix vendor",
        ok: prefixOk,
        detail: prefixOk ? `${VENDOR_PREFIX} sesuai` : `Prefix ≠ "${VENDOR_PREFIX}" — ubah VENDOR_PREFIX jika vendor ganti event`
    });
    if (!prefixOk) { res.finalStatus = "INVALID_EVENT"; return res; }

    const middleOk = raw.indexOf(VENDOR_MIDDLE) === VENDOR_MIDDLE_POS;
    res.steps.push({
        name: `Blok tengah (pos ${VENDOR_MIDDLE_POS})`,
        ok: middleOk,
        detail: middleOk ? "Blok tengah sesuai" : `Blok tengah tidak di pos ${VENDOR_MIDDLE_POS} — ubah VENDOR_MIDDLE jika vendor ganti event`
    });
    if (!middleOk) { res.finalStatus = "INVALID_EVENT"; return res; }

    res.finalStatus = "VALID";
    res.note = "QR vendor lolos. Siap dipakai gacha.";
    res.field = { eventCode: VENDOR_PREFIX, batch: raw.slice(21, 64), serial: raw.slice(149), seqNumber: raw.slice(149) };
    return res;
}

function analyzeQR(qr) {
    const raw = String(qr || "").trim();
    return analyzeVendorQR(raw);
}

// ==========================================
// 2. HELPER LEDGER LOKAL (transaksi gacha)
// ==========================================
function loadLedger() {
    if (!fs.existsSync(LEDGER_FILE)) return [];
    return JSON.parse(fs.readFileSync(LEDGER_FILE));
}

function saveLedger(data) {
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(data, null, 2));
}

// Bikin timestamp yang mudah dibaca: "09/09/2026 17:30:00"
function getTimestamp() {
    return new Date().toLocaleString("id-ID", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
    });
}

// ==========================================
// 3. WEBSOCKET - KOMUNIKASI DENGAN UNITY
// ==========================================
function broadcast(payload) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(payload));
        }
    });
}

wss.on("connection", (ws) => {
    const totalMachines = wss.clients.size;
    ws.machineId = null;
    console.log(`🎮 [WS] Mesin Unity terhubung! Total mesin aktif: ${totalMachines}`);

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);

            // ----------------------------------------
            // EVENT: Mesin Unity scan QR
            // ----------------------------------------
            if (data.type === "scan_qr") {
                const scannedQr = data.qrCode;
                const machineId = data.machineId;
                const now = getTimestamp();
                ws.machineId = machineId;

                console.log(`\n🔍 [WS] [${now}] Mesin [${machineId}] scan: ${scannedQr}`);

                // --- LANGKAH 1: Validasi struktur QR (tanpa data vendor) ---
                const parsed = parseQRCode(scannedQr);
                if (!parsed.valid) {
                    console.log(`❌ [WS] QR ditolak: ${parsed.reason}`);
                    ws.send(JSON.stringify({
                        type: "scan_result",
                        success: false,
                        reason: parsed.reason,
                        message: reasonMessage(parsed.reason)
                    }));
                    return;
                }

                // --- LANGKAH 2: Cek status tiket di ledger (pending/used/bebas) ---
                const ledger = loadLedger();
                const existing = ledger.find(e => e.qrCode === scannedQr);

                // Sudah selesai dipakai → tolak permanen
                if (existing && existing.state === "used") {
                    console.log(`❌ [WS] QR ${scannedQr} sudah SELESAI dipakai gacha.`);
                    ws.send(JSON.stringify({
                        type: "scan_result",
                        success: false,
                        reason: "ALREADY_USED",
                        message: "Tiket ini sudah pernah digunakan."
                    }));
                    return;
                }

                // Sedang diproses mesin LAIN → tolak sementara
                if (existing && existing.state === "pending" && existing.usedByMachine !== machineId) {
                    console.log(`⏳ [WS] QR ${scannedQr} sedang diproses di mesin ${existing.usedByMachine}.`);
                    ws.send(JSON.stringify({
                        type: "scan_result",
                        success: false,
                        reason: "PENDING",
                        message: `Tiket ini sedang diproses di mesin ${existing.usedByMachine}.`
                    }));
                    return;
                }

                // --- LANGKAH 3: Claim / re-claim (state = "pending" sampai game selesai) ---
                if (existing && existing.state === "pending" && existing.usedByMachine === machineId) {
                    existing.usedAt = now; // mesin yang sama mengulang sesi tiket yang belum selesai
                    saveLedger(ledger);
                    console.log(`🔁 [WS] QR ${scannedQr} di-claim ULANG oleh ${machineId} (sesi belum selesai).`);
                } else {
                    ledger.push({
                        qrCode: scannedQr,
                        ticketId: parsed.ticketId,
                        state: "pending",
                        usedAt: now,
                        usedByMachine: machineId
                    });
                    saveLedger(ledger);
                    console.log(`✅ [WS] QR ${scannedQr} (tiket ${parsed.ticketId}) di-claim ${machineId} — menunggu game selesai.`);
                }

                // Kirim sukses ke mesin yang scan
                ws.send(JSON.stringify({
                    type: "scan_result",
                    success: true,
                    reason: "VALID",
                    message: "Tiket valid, selamat gacha!",
                    ticketId: parsed.ticketId,
                    usedAt: now
                }));

                // Broadcast ke semua mesin (sinkron status claim/pending)
                broadcast({
                    type: "ticket_claimed",
                    qrCode: scannedQr,
                    ticketId: parsed.ticketId,
                    machineId: machineId,
                    usedAt: now
                });
            }

            // ----------------------------------------
            // EVENT: Mesin Unity memberitahu game SELESAI
            // → baru saat inilah tiket dikunci permanen (state = used)
            // ----------------------------------------
            else if (data.type === "game_finish") {
                const scannedQr = data.qrCode;
                const machineId = data.machineId;
                const now = getTimestamp();
                ws.machineId = machineId;

                const ledger = loadLedger();
                const entry = ledger.find(e => e.qrCode === scannedQr);

                if (!entry) {
                    console.log(`⚠️ [WS] game_finish ${scannedQr} — tidak ditemukan di ledger. Diabaikan.`);
                    return;
                }
                if (entry.state === "used") {
                    console.log(`ℹ️ [WS] game_finish ${scannedQr} — sudah berstatus used sebelumnya.`);
                    return;
                }
                if (entry.usedByMachine !== machineId) {
                    console.log(`⚠️ [WS] game_finish ${scannedQr} dari ${machineId}, tapi pemegangnya ${entry.usedByMachine}.`);
                    return;
                }

                // --- Hasil quiz dari Unity (GameManagerGatcha totalScore = koin) ---
                // Unity kirim {score, maxScore, isWin, prizeTier}, tapi server verifikasi ulang
                // agar tidak bisa dicurangi dari client. Data lama tanpa skor tetap didukung.
                const score = Number.isFinite(Number(data.score)) ? Number(data.score) : 0;
                const maxScore = Number.isFinite(Number(data.maxScore)) ? Number(data.maxScore) : 0;
                const pct = maxScore > 0 ? (score / maxScore * 100) : 0;
                const serverWin = pct >= WIN_MIN_PERCENTAGE;
                // Menang hanya jika Unity klaim menang DAN lolos threshold server
                const clientWin = data.isWin === true || data.isWin === 1 || data.isWin === "true";
                const finalWin = (maxScore > 0) ? (serverWin && clientWin) : clientWin;
                const prizeTier = finalWin ? (String(data.prizeTier || "").trim() || WIN_PRIZE_DEFAULT) : "";

                entry.state = "used";
                entry.finishedAt = now;
                entry.score = score;
                entry.maxScore = maxScore;
                entry.isWin = finalWin;
                entry.prizeTier = prizeTier;
                // Status untuk platform dispenser (polling via GET /api/results)
                entry.dispenseStatus = finalWin ? "pending_dispense" : "skipped";
                saveLedger(ledger);

                console.log(`🎉 [WS] [${now}] Game ${scannedQr} (tiket ${entry.ticketId}) SELESAI di ${machineId} skor ${score}/${maxScore} (${pct.toFixed(0)}%) → ${finalWin ? "MENANG 🏆" : "kalah"} → tiket dikunci used.`);
                broadcast({
                    type: "ticket_finished",
                    qrCode: scannedQr,
                    ticketId: entry.ticketId,
                    machineId: machineId,
                    finishedAt: now,
                    score,
                    maxScore,
                    isWin: finalWin,
                    prizeTier,
                    dispenseStatus: entry.dispenseStatus
                });
            }

        } catch (err) {
            console.error("❌ [WS] Error parsing pesan dari Unity:", err);
        }
    });

    ws.on("close", () => {
        const totalMachines = wss.clients.size;
        console.log(`🔌 [WS] Mesin Unity terputus. Sisa mesin aktif: ${totalMachines}`);

        // RILIS tiket "pending" milik mesin yang terputus,
        // supaya tiket tidak terbakar apabila game belum selesai.
        const mid = ws.machineId;
        if (mid) {
            const ledger = loadLedger();
            let released = 0;
            const remaining = [];
            for (const e of ledger) {
                if (e.state === "pending" && e.usedByMachine === mid) released++;
                else remaining.push(e);
            }
            if (released > 0) {
                saveLedger(remaining);
                console.log(`♻️ [WS] Mesin ${mid} terputus → ${released} tiket pending dilepas kembali (bisa discan ulang).`);
                broadcast({
                    type: "tickets_released",
                    count: released,
                    machineId: mid
                });
            }
        }
    });
});

function reasonMessage(reason) {
    const map = {
        INVALID_FORMAT: "QR tidak dikenali. Scan kode dari tiket resmi.",
        INVALID_EVENT: "QR ini bukan untuk event ini.",
        ALREADY_USED: "Tiket ini sudah pernah digunakan.",
        PENDING: "Tiket ini sedang diproses di mesin lain."
    };
    return map[reason] || "QR ditolak.";
}

// ==========================================
// 4. API TAMBAHAN (Cek status via Browser)
// ==========================================
// Ledger transaksi gacha
app.get("/api/ledger", (req, res) => {
    res.json(loadLedger());
});

// Cek status sebuah QR (dipakai/tidak, struktur valid/tidak)
app.get("/api/ledger/:qrCode", (req, res) => {
    const qrCode = req.params.qrCode;
    const parsed = parseQRCode(qrCode);

    let status;
    if (!parsed.valid) {
        status = "INVALID";
    } else {
        const ledger = loadLedger();
        const entry = ledger.find(e => e.qrCode === qrCode);
        status = entry ? (entry.state === "used" ? "USED" : "PENDING") : "AVAILABLE";
    }

    res.json({
        success: true,
        qrCode,
        parsed,
        status
    });
});

// Rilis manual tiket yang masih "pending" (game tidak selesai)
app.get("/api/release/:qrCode", (req, res) => {
    const qrCode = req.params.qrCode;
    const ledger = loadLedger();
    const idx = ledger.findIndex(e => e.qrCode === qrCode && e.state === "pending");
    if (idx === -1) {
        return res.json({ success: false, message: "Tiket tidak ditemukan atau bukan berstatus pending." });
    }
    const [entry] = ledger.splice(idx, 1);
    saveLedger(ledger);
    console.log(`♻️ [API] Tiket ${qrCode} dilepas manual.`);
    res.json({ success: true, message: "Tiket dilepas dan bisa discan ulang.", entry });
});

// ==========================================
// 4b. API UNTUK PLATFORM DISPENSER (PULL MODEL)
// Pihak platform polling ke sini untuk tahu siapa yang menang.
// ==========================================
// Aturan main & threshold (biar platform/Unity bisa sinkron tanpa tanya manual)
app.get("/api/config", (req, res) => {
    res.json({
        success: true,
        winMinPercentage: WIN_MIN_PERCENTAGE,
        winPrizeDefault: WIN_PRIZE_DEFAULT,
        vendorLength: VENDOR_LENGTH
    });
});

// Daftar hasil game — default hanya pemenang yang belum di-dispense.
// Contoh: GET /api/results → pending_dispense saja
//         GET /api/results?status=all → semua yg sudah finish
//         GET /api/results?status=dispensed|skipped|pending_dispense
//         GET /api/results?since=<finishedAt substring>&limit=50
function toResultRow(e) {
    return {
        qrCode: e.qrCode,
        ticketId: e.ticketId,
        machineId: e.usedByMachine,
        finishedAt: e.finishedAt,
        score: e.score ?? 0,
        maxScore: e.maxScore ?? 0,
        isWin: e.isWin === true,
        prizeTier: e.prizeTier || "",
        dispenseStatus: e.dispenseStatus || (e.isWin ? "pending_dispense" : "skipped"),
        idempotencyKey: e.qrCode
    };
}

app.get("/api/results", (req, res) => {
    const status = String(req.query.status || "pending_dispense");
    const since = String(req.query.since || "");
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || "50", 10) || 50));
    const ledger = loadLedger();
    let rows = ledger
        .filter(e => e.state === "used" && e.finishedAt)
        .map(toResultRow);
    // Data lama (sebelum ada skor) tidak punya dispenseStatus → anggap skipped agar tidak double keluar
    rows = rows.map(r => {
        if (!r.dispenseStatus) r.dispenseStatus = r.isWin ? "pending_dispense" : "skipped";
        return r;
    });
    if (status !== "all") rows = rows.filter(r => r.dispenseStatus === status);
    if (since) rows = rows.filter(r => String(r.finishedAt || "") >= since);
    rows = rows.slice(-limit);
    res.json({ success: true, status, count: rows.length, data: rows });
});

// Detail 1 tiket untuk platform
app.get("/api/results/:qrCode", (req, res) => {
    const qrCode = req.params.qrCode;
    const entry = loadLedger().find(e => e.qrCode === qrCode);
    if (!entry || entry.state !== "used") {
        return res.status(404).json({ success: false, message: "Tiket tidak ditemukan atau game belum selesai." });
    }
    res.json({ success: true, data: toResultRow(entry) });
});

// ACK dari platform: "barang untuk tiket ini SUDAH keluar"
// Body: { qrCode, platformRef? } — idempotent, aman dipanggil 2x.
app.post("/api/dispense-ack", (req, res) => {
    const qrCode = String(req.body?.qrCode || "").trim();
    const platformRef = String(req.body?.platformRef || "").trim();
    if (!qrCode) return res.status(400).json({ success: false, message: "qrCode wajib diisi." });
    const ledger = loadLedger();
    const entry = ledger.find(e => e.qrCode === qrCode);
    if (!entry || entry.state !== "used") {
        return res.status(404).json({ success: false, message: "Tiket tidak ditemukan atau game belum selesai." });
    }
    if (entry.isWin !== true) {
        return res.status(400).json({ success: false, message: "Tiket ini kalah, tidak perlu dispense." });
    }
    if (entry.dispenseStatus === "dispensed") {
        return res.json({ success: true, message: "Sudah di-ACK sebelumnya (idempotent).", data: toResultRow(entry) });
    }
    entry.dispenseStatus = "dispensed";
    entry.dispensedAt = getTimestamp();
    if (platformRef) entry.platformRef = platformRef;
    saveLedger(ledger);
    console.log(`📦 [API] Dispense ACK ${qrCode} (tiket ${entry.ticketId}) → dispensed.`);
    broadcast({
        type: "dispense_result",
        qrCode,
        ticketId: entry.ticketId,
        machineId: entry.usedByMachine,
        dispenseStatus: "dispensed",
        prizeTier: entry.prizeTier || "",
        score: entry.score ?? 0,
        maxScore: entry.maxScore ?? 0,
        isWin: true
    });
    res.json({ success: true, message: "Dispense dicatat.", data: toResultRow(entry) });
});

// Dashboard ringkasan ledger lokal
app.get("/", (req, res) => {
    const ledger = loadLedger();
    const totalMachines = wss.clients.size;

    let rows = ledger.map(e => {
        const scoreTxt = e.state === "used" ? `${e.score ?? 0}/${e.maxScore ?? 0}` : "-";
        const winTxt = e.state !== "used" ? "-" : (e.isWin ? `🏆 MENANG${e.prizeTier ? ` (${e.prizeTier})` : ""}` : "kalah");
        const disp = e.dispenseStatus || (e.isWin ? "pending_dispense" : "-");
        const dispCls = disp === "dispensed" ? "b-used" : (disp === "pending_dispense" ? "b-pending" : "b-skip");
        return `
        <tr>
            <td><code>${e.qrCode}</code></td>
            <td>${e.ticketId}</td>
            <td><span class="badge ${e.state === "used" ? "b-used" : "b-pending"}">${e.state === "used" ? "Selesai" : "Diproses"}</span></td>
            <td>${scoreTxt}</td>
            <td>${winTxt}</td>
            <td><span class="badge ${dispCls}">${disp}</span></td>
            <td>${e.usedAt}</td>
            <td>${e.usedByMachine}</td>
        </tr>`;
    }).join("");

    res.send(`
    <html>
    <head>
        <title>Local Server - Ledger Gacha</title>
        <meta http-equiv="refresh" content="10">
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; }
            .stats { display: flex; gap: 15px; margin-bottom: 20px; }
            .card { background: #fff; border-radius: 8px; padding: 15px 25px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); text-align: center; }
            .card h1 { margin: 5px 0; font-size: 36px; }
            .card p { margin: 0; font-size: 13px; color: #777; }
            table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
            th, td { border: 1px solid #ddd; padding: 9px 12px; font-size: 13px; }
            th { background: #343a40; color: white; }
            tr:hover { background: #f5f5f5; }
            .note { font-size: 12px; color: #999; margin-top: 10px; }
            .empty { text-align:center; color:#999; padding:25px; }
            .badge { padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: bold; }
            .b-used { background: #d4edda; color: #155724; }
            .b-pending { background: #fff3cd; color: #856404; }
            .b-skip { background: #e2e3e5; color: #555; }
        </style>
    </head>
    <body>
        <h2>💻 Local Server — Ledger Gacha (Validasi Struktur QR)</h2>
        
        <div class="stats">
            <div class="card">
                <p>Total QR Discan</p>
                <h1 style="color:#333">${ledger.length}</h1>
            </div>
            <div class="card">
                <p>Selesai Game</p>
                <h1 style="color:#1e7e34">${ledger.filter(e => e.state === "used").length}</h1>
            </div>
            <div class="card">
                <p>Menang 🏆</p>
                <h1 style="color:#6f42c1">${ledger.filter(e => e.state === "used" && e.isWin).length}</h1>
            </div>
            <div class="card">
                <p>Pending Dispense</p>
                <h1 style="color:#ff8c00">${ledger.filter(e => e.dispenseStatus === "pending_dispense").length}</h1>
            </div>
            <div class="card">
                <p>Sedang Diproses</p>
                <h1 style="color:#ff8c00">${ledger.filter(e => e.state === "pending").length}</h1>
            </div>
            <div class="card">
                <p>Mesin Unity Aktif</p>
                <h1 style="color:#007bff">${totalMachines}</h1>
            </div>
        </div>

        <table>
            <tr>
                <th>QR Code</th><th>Ticket ID</th><th>Status</th><th>Koin</th><th>Hasil</th><th>Dispense</th><th>Waktu Scan</th><th>Mesin</th>
            </tr>
            ${rows || '<tr><td colspan="8" class="empty">Belum ada QR yang digunakan gacha</td></tr>'}
        </table>

        <p class="note">🔄 Halaman auto-refresh tiap 10 detik. Rilis manual: /api/release/:qrCode | Platform: GET /api/results (menang) → POST /api/dispense-ack | Threshold menang: ${WIN_MIN_PERCENTAGE}% | Format vendor ${VENDOR_LENGTH} char.</p>
    </body>
    </html>
    `);
});

// ==========================================
// 5. DEBUG FORMAT QR (cek format baru tanpa simpan ke ledger)
// ==========================================
function renderDebug(qr, page = "http") {
    let resultHtml = "";
    if (qr) {
        const a = analyzeQR(qr);
        const boxColor = a.finalStatus === "VALID" ? "#1e7e34" : "#a03232";
        const steps = a.steps.map(s => `
            <tr>
                <td>${s.name}</td>
                <td><span class="badge ${s.ok ? "ok" : "no"}">${s.ok ? "PASS" : "GAGAL"}</span></td>
                <td>${s.detail}</td>
            </tr>
        `).join("");

        const fieldHtml = a.field ? `
            <div class="field-box">
                Kode Event: <b>${a.field.eventCode}</b> |
                ${a.field.dateLabel ? `Tanggal Terbit: <b>${a.field.dateLabel}</b> | ` : ""}
                Nomor Urut Tiket: <b>${a.field.seqNumber}</b>
                ${a.field.batch ? `<br>Batch: <code>${a.field.batch}</code> | Serial: <code>${a.field.serial}</code>` : ""}
            </div>` : "";

        resultHtml = `
            <div class="result" style="border-color:${boxColor}">
                <div style="font-size:26px; font-weight:bold; color:${boxColor}">${a.finalStatus}</div>
                <div style="font-size:12px; color:#666; margin-top:4px">Panjang string: ${a.length} karakter</div>
                ${fieldHtml}
                <table>
                    <tr><th style="width:250px">Tahap Validasi</th><th style="width:80px">Status</th><th>Detail</th></tr>
                    ${steps}
                </table>
                <div class="note-debug">${a.note || "Simpan pengaturan QR jika format berubah."}</div>
            </div>`;
    }

    const paper = `
        <html>
        <head>
            <meta charset="utf-8"><title>Debug Format QR — Vendor</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 25px; background:#f5f6f8; }
                h2 { color:#333; }
                .card { background:#fff; border-radius:10px; padding:20px; box-shadow:0 1px 4px rgba(0,0,0,.12); max-width:780px; margin:auto; }
                input[type=text] { width:100%; padding:10px; font-size:16px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; }
                button { background:#007bff; color:#fff; border:0; padding:10px 22px; border-radius:6px; font-size:15px; margin-top:12px; cursor:pointer; }
                table { border-collapse:collapse; width:100%; margin-top:15px; }
                th, td { border:1px solid #ddd; padding:8px 10px; font-size:13px; text-align:left; }
                th { background:#343a40; color:#fff; }
                .badge { padding:2px 10px; border-radius:10px; font-size:11px; font-weight:bold; }
                .badge.ok { background:#d4edda; color:#155724; }
                .badge.no { background:#f8d7da; color:#721c24; }
                .result { border:3px solid #ccc; border-radius:10px; padding:15px; margin-top:20px; background:#fff; }
                .field-box { background:#fff3cd; border-radius:6px; padding:8px 12px; margin-top:10px; font-size:14px; }
                .note-debug { margin-top:12px; font-size:12px; color:#777; }
                .samples { margin-top:14px; font-size:12px; color:#555; }
                .samples a { margin-right:10px; }
                .back { display:inline-block; margin-top:15px; font-size:13px; color:#666; text-decoration:none; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>🔍 Debug Format QR</h2>
                <p style="font-size:14px; color:#666">
                    Tempel/paste hasil scan QR di sini (atau ketik langsung) untuk melihat tahap-tahap validasi —
                    <b>tanpa menyimpan ke ledger.</b>
                    Jika format QR dari vendor berubah, gunakan halaman ini untuk mengecek & menyesuaikan.
                </p>
                <form method="POST" action="/debug">
                    <input type="text" name="qr" value="${qr || ""}" placeholder="Tempel QR vendor 171 karakter" autofocus>
                    <button type="submit">Analisis</button>
                </form>

                <div class="samples">
                    Coba: <a href="/debug?qr=Y5X01g9AWhfSmj5BTjbhAErFJEk7scb7-VqSazrL0z_5W6ABqslrARtYkC-9nYWD_30sfVreDY0RP7ccjOL5L81Xv_Kw5Cv8Ns1Y-J-K1C9GBKsvVTcPHvI--8gzAfTh4Qx2MYCzQSx2HOuW8RX8-2ouKPG83CIzdBYMGiP4cnU">QR vendor valid</a>
                    <a href="/debug?qr=X5X01g9AWhfSmj5BTjbhAErFJEk7scb7-VqSazrL0z_5W6ABqslrARtYkC-9nYWD_30sfVreDY0RP7ccjOL5L81Xv_Kw5Cv8Ns1Y-J-K1C9GBKsvVTcPHvI--8gzAfTh4Qx2MYCzQSx2HOuW8RX8-2ouKPG83CIzdBYMGiP4cnU">prefix salah</a>
                </div>
                ${qr ? resultHtml : ""}
                <a class="back" href="/">← Kembali ke Dashboard</a>
            </div>
        </body>
        </html>
    `;
    return paper;
}

app.get("/debug", (req, res) => {
    res.send(renderDebug((req.query.qr || "").toString()));
});

app.post("/debug", (req, res) => {
    res.send(renderDebug((req.body.qr || "").toString(), null, "post"));
});

server.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`💻 [LOCAL SERVER] Aktif (tanpa sync vendor)`);
    console.log(`WebSocket    : ws://localhost:${PORT}`);
    console.log(`Dashboard    : http://localhost:${PORT}`);
    console.log(`Debug Format : http://localhost:${PORT}/debug`);
    console.log(`API Ledger   : http://localhost:${PORT}/api/ledger`);
    console.log(`API Results  : http://localhost:${PORT}/api/results (untuk platform dispenser)`);
    console.log(`API Config   : http://localhost:${PORT}/api/config (threshold menang ${WIN_MIN_PERCENTAGE}%)`);
    console.log(`Format QR    : Vendor ${VENDOR_LENGTH} char`);
    console.log(`Vendor prefix: ${VENDOR_PREFIX} | middle@${VENDOR_MIDDLE_POS} len=${VENDOR_MIDDLE.length}`);
    console.log(`========================================\n`);
});