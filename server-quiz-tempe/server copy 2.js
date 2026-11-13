const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ==========================================
// ⚙️ KONFIGURASI — Ubah di sini
// ==========================================
const PORT = 3012;
const LEDGER_FILE = path.join(__dirname, "tickets_local.json");

const VendorClient = require("./vendor-client");

// --- MODE VALIDASI SCAN TIKET ---
// "LOCAL_FORMAT" = Offline (cek format lokal)
// "VENDOR_API"   = Online (Spesifikasi Vendor v1.0 via HMAC-SHA256)
const SCAN_MODE = process.env.SCAN_MODE || "VENDOR_API";

// Konfigurasi Vendor API v1.0
const VENDOR_BASE_URL = process.env.VENDOR_BASE_URL || "http://localhost:4000";
const VENDOR_API_KEY = process.env.VENDOR_API_KEY || "mk_tempe_gacha_test";
const VENDOR_SECRET = process.env.VENDOR_SECRET || "mock-vendor-secret-key-12345";
const DEVICE_SNS = process.env.DEVICE_SNS || process.env.DEVICE_SN || "gacha-001";

const parsedMaxAttempts = parseInt(process.env.MAX_GAME_ATTEMPTS || "3", 10);
const MAX_GAME_ATTEMPTS =
    Number.isInteger(parsedMaxAttempts) && parsedMaxAttempts > 0
        ? parsedMaxAttempts
        : 3;

// Inisialisasi Vendor Client Multi-Device
const vendorClient = new VendorClient({
    baseUrl: VENDOR_BASE_URL,
    apiKey: VENDOR_API_KEY,
    secret: VENDOR_SECRET,
    deviceSns: DEVICE_SNS
});

// Helper Request ke API Vendor (Wrapper v1.0)
async function validateTicketWithVendor(code, deviceId) {
    return await vendorClient.validateTicket(code, deviceId);
}


// Aturan menang dihitung oleh server dari persentase skor.
const WIN_MIN_PERCENTAGE = 80;
const WIN_PRIZE_DEFAULT = "HADIAH";

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

// Lock sederhana agar QR yang sama tidak divalidasi bersamaan dalam satu proses.
const scansInProgress = new Set();

function ensureAttemptData(entry) {
    if (!Number.isInteger(entry.attemptCount) || entry.attemptCount < 0) entry.attemptCount = 0;
    if (!Number.isInteger(entry.maxAttempts) || entry.maxAttempts < 1) entry.maxAttempts = MAX_GAME_ATTEMPTS;
    if (!Array.isArray(entry.attempts)) entry.attempts = [];
    return entry;
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

    ws.on("message", async (message) => {
        try {
            const data = JSON.parse(message);

            // ----------------------------------------
            // EVENT: Mesin Unity scan QR
            // ----------------------------------------
            if (data.type === "scan_qr") {
                const scannedQr = String(data.qrCode || "").trim();
                const machineId = String(data.machineId || "UNKNOWN_DEVICE");
                const now = getTimestamp();
                ws.machineId = machineId;

                if (!scannedQr) {
                    ws.send(JSON.stringify({ type: "scan_result", success: false, reason: "EMPTY_QR", message: "QR Code kosong." }));
                    return;
                }

                console.log(`\n🔍 [WS] [${now}] Mesin [${machineId}] scan: ${scannedQr} (Mode: ${SCAN_MODE})`);

                const ledger = loadLedger();
                let existing = ledger.find(e => e.qrCode === scannedQr);

                if (scansInProgress.has(scannedQr)) {
                    ws.send(JSON.stringify({ type: "scan_result", success: false, reason: "PENDING", message: "QR sedang divalidasi. Silakan coba kembali." }));
                    return;
                }

                if (existing) ensureAttemptData(existing);

                if (existing && existing.state === "pending" && existing.usedByMachine !== machineId) {
                    ws.send(JSON.stringify({
                        type: "scan_result", success: false, reason: "PENDING",
                        message: `Tiket ini sedang diproses di mesin ${existing.usedByMachine}.`
                    }));
                    return;
                }

                if (existing && existing.state === "used") {
                    ws.send(JSON.stringify({
                        type: "scan_result", success: false, reason: "ALREADY_USED",
                        message: "Tiket ini sudah menyelesaikan permainan dan tidak bisa digunakan kembali."
                    }));
                    return;
                }

                if (existing && existing.state === "retry_allowed" && existing.attemptCount >= existing.maxAttempts) {
                    existing.state = "used";
                    saveLedger(ledger);
                    ws.send(JSON.stringify({
                        type: "scan_result", success: false, reason: "ATTEMPTS_EXHAUSTED",
                        message: "Kesempatan bermain tiket ini sudah habis."
                    }));
                    return;
                }

                let vendorRes;
                scansInProgress.add(scannedQr);
                try {
                    console.log("🌐 [WS] Meminta validasi online ke API Vendor...");
                    vendorRes = await validateTicketWithVendor(scannedQr, machineId);
                } catch (err) {
                    console.error(`❌ [WS] Gagal menghubungi Vendor API: ${err.message}`);
                    ws.send(JSON.stringify({
                        type: "scan_result", success: false, reason: "VENDOR_UNAVAILABLE",
                        message: "Server validasi tiket sedang tidak tersedia. Silakan coba lagi."
                    }));
                    return;
                } finally {
                    scansInProgress.delete(scannedQr);
                }

                if (!vendorRes || !vendorRes.success || !vendorRes.valid) {
                    const reason = vendorRes?.reason || "INVALID_TICKET";
                    const msg = vendorRes?.message || "Tiket ditolak oleh sistem vendor.";
                    ws.send(JSON.stringify({ type: "scan_result", success: false, reason, message: msg }));
                    return;
                }

                const ticketId = String(vendorRes.data?.ticketId || scannedQr);
                const guestName = vendorRes.data?.guestName || existing?.guestName || null;
                const ticketType = vendorRes.data?.ticketType || existing?.ticketType || null;
                const successMessage = vendorRes.message || "Tiket valid, selamat gacha!";

                if (existing) {
                    existing.ticketId = ticketId;
                    existing.guestName = guestName;
                    existing.ticketType = ticketType;
                    existing.scanMode = SCAN_MODE;
                    existing.state = "pending";
                    existing.usedAt = now;
                    existing.usedByMachine = machineId;
                    saveLedger(ledger);
                    console.log(`🔁 [WS] QR ${scannedQr} diaktifkan kembali. Percobaan ${existing.attemptCount + 1}/${existing.maxAttempts}.`);
                } else {
                    existing = ensureAttemptData({
                        qrCode: scannedQr, ticketId, guestName, ticketType,
                        scanMode: SCAN_MODE, state: "pending", usedAt: now,
                        usedByMachine: machineId, attemptCount: 0,
                        maxAttempts: MAX_GAME_ATTEMPTS, attempts: []
                    });
                    ledger.push(existing);
                    saveLedger(ledger);
                }

                ws.send(JSON.stringify({
                    type: "scan_result", success: true, reason: "VALID",
                    message: successMessage, ticketId, guestName, usedAt: now,
                    attemptCount: existing.attemptCount,
                    maxAttempts: existing.maxAttempts,
                    attemptsRemaining: Math.max(0, existing.maxAttempts - existing.attemptCount)
                }));

                broadcast({
                    type: "ticket_claimed", qrCode: scannedQr, ticketId,
                    machineId, usedAt: now,
                    attemptCount: existing.attemptCount,
                    maxAttempts: existing.maxAttempts,
                    attemptsRemaining: Math.max(0, existing.maxAttempts - existing.attemptCount)
                });
            }

            else if (data.type === "game_finish") {
                const scannedQr = String(data.qrCode || "").trim();
                const machineId = String(data.machineId || "");
                const now = getTimestamp();
                ws.machineId = machineId;

                const ledger = loadLedger();
                const entry = ledger.find(e => e.qrCode === scannedQr);

                if (!entry) {
                    console.log(`⚠️ [WS] game_finish ${scannedQr} — tidak ditemukan di ledger. Diabaikan.`);
                    return;
                }

                ensureAttemptData(entry);

                if (entry.state !== "pending") {
                    console.log(`ℹ️ [WS] game_finish ${scannedQr} ditolak karena status: ${entry.state}.`);
                    return;
                }

                if (entry.usedByMachine !== machineId) {
                    console.log(`⚠️ [WS] game_finish ${scannedQr} dari ${machineId}, pemegangnya ${entry.usedByMachine}.`);
                    return;
                }

                // Server menghitung hasil dari skor; nilai isWin dari Unity tidak dipercaya.
                const score = Number(data.score);
                const maxScore = Number(data.maxScore);

                if (!Number.isFinite(score) || !Number.isFinite(maxScore) ||
                    maxScore <= 0 || score < 0 || score > maxScore) {
                    ws.send(JSON.stringify({
                        type: "game_finish_result", success: false,
                        reason: "INVALID_SCORE",
                        message: "Data skor tidak valid. Hasil permainan tidak disimpan."
                    }));
                    console.log(`❌ [WS] Skor tidak valid untuk ${scannedQr}: ${data.score}/${data.maxScore}`);
                    return;
                }

                const pct = (score / maxScore) * 100;
                const finalWin = pct >= WIN_MIN_PERCENTAGE;
                const prizeTier = finalWin
                    ? (String(data.prizeTier || "").trim() || WIN_PRIZE_DEFAULT)
                    : "";

                entry.attemptCount += 1;
                const attemptRecord = {
                    attempt: entry.attemptCount,
                    finishedAt: now,
                    machineId,
                    score,
                    maxScore,
                    percentage: Number(pct.toFixed(2)),
                    isWin: finalWin,
                    prizeTier
                };
                entry.attempts.push(attemptRecord);

                entry.finishedAt = now;
                entry.score = score;
                entry.maxScore = maxScore;
                entry.isWin = finalWin;
                entry.prizeTier = prizeTier;
                entry.attemptsRemaining = Math.max(0, entry.maxAttempts - entry.attemptCount);

                const attemptsExhausted = entry.attemptCount >= entry.maxAttempts;
                const isFinal = finalWin || attemptsExhausted;
                entry.state = isFinal ? "used" : "retry_allowed";
                entry.dispenseStatus = finalWin ? "pending_dispense" : "skipped";

                if (isFinal) {
                    entry.completedAt = now;
                } else {
                    entry.usedByMachine = null;
                }

                saveLedger(ledger);

                const outcome = finalWin ? "MENANG 🏆"
                    : attemptsExhausted ? "KALAH - KESEMPATAN HABIS"
                        : "KALAH - BOLEH COBA LAGI";

                console.log(
                    `🎮 [WS] [${now}] QR ${scannedQr} percobaan ${entry.attemptCount}/${entry.maxAttempts}, ` +
                    `skor ${score}/${maxScore} (${pct.toFixed(0)}%) → ${outcome} → ${entry.state}.`
                );

                const resultPayload = {
                    type: "ticket_finished",
                    qrCode: scannedQr,
                    ticketId: entry.ticketId,
                    machineId,
                    finishedAt: now,
                    score,
                    maxScore,
                    percentage: Number(pct.toFixed(2)),
                    isWin: finalWin,
                    prizeTier,
                    dispenseStatus: entry.dispenseStatus,
                    state: entry.state,
                    attemptCount: entry.attemptCount,
                    maxAttempts: entry.maxAttempts,
                    attemptsRemaining: entry.attemptsRemaining,
                    canRetry: entry.state === "retry_allowed"
                };

                ws.send(JSON.stringify({ type: "game_finish_result", success: true, ...resultPayload }));
                broadcast(resultPayload);
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
        const anotherSocketForMachine = mid && [...wss.clients].some(
            client => client !== ws &&
                client.readyState === WebSocket.OPEN &&
                client.machineId === mid
        );

        if (mid && !anotherSocketForMachine) {
            const ledger = loadLedger();
            let released = 0;
            const remaining = [];
            for (const e of ledger) {
                if (e.state === "pending" && e.usedByMachine === mid) {
                    released++;
                    ensureAttemptData(e);
                    if (e.attemptCount > 0) {
                        e.state = "retry_allowed";
                        e.usedByMachine = null;
                        remaining.push(e);
                    }
                    // Reservation tanpa attempt selesai dihapus agar dapat scan ulang dari awal.
                } else {
                    remaining.push(e);
                }
            }
            if (released > 0) {
                saveLedger(remaining);
                console.log(`♻️ [WS] Mesin ${mid} terputus → ${released} tiket pending dilepas tanpa menghapus histori attempt.`);
                broadcast({
                    type: "tickets_released",
                    count: released,
                    machineId: mid
                });
            }
        }
    });
});

// ==========================================
// 4. API TAMBAHAN (Cek status via Browser)
// ==========================================
// Ledger transaksi gacha
app.get("/api/ledger", (req, res) => {
    res.json(loadLedger());
});

// Cek status sebuah QR di ledger
app.get("/api/ledger/:qrCode", (req, res) => {
    const qrCode = req.params.qrCode;
    const ledger = loadLedger();
    const entry = ledger.find(e => e.qrCode === qrCode);
    const status = !entry ? "NOT_IN_LEDGER"
        : entry.state === "used" ? "USED"
            : entry.state === "retry_allowed" ? "RETRY_ALLOWED"
                : "PENDING";

    res.json({
        success: true,
        qrCode,
        status,
        entry: entry || null
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
    const entry = ledger[idx];
    ensureAttemptData(entry);
    if (entry.attemptCount > 0) {
        entry.state = "retry_allowed";
        entry.usedByMachine = null;
    } else {
        ledger.splice(idx, 1);
    }
    saveLedger(ledger);
    console.log(`♻️ [API] Tiket ${qrCode} dilepas manual.`);
    res.json({ success: true, message: "Tiket dilepas dan bisa discan ulang.", entry });
});

// ==========================================
// 4b. API UNTUK PLATFORM DISPENSER (PULL MODEL)
// Pihak platform polling ke sini untuk tahu siapa yang menang.
// ==========================================
// Aturan main & threshold
app.get("/api/config", (req, res) => {
    res.json({
        success: true,
        winMinPercentage: WIN_MIN_PERCENTAGE,
        winPrizeDefault: WIN_PRIZE_DEFAULT,
        maxGameAttempts: MAX_GAME_ATTEMPTS
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
        attemptCount: e.attemptCount ?? 1,
        maxAttempts: e.maxAttempts ?? MAX_GAME_ATTEMPTS,
        attemptsRemaining: Math.max(0, (e.maxAttempts ?? MAX_GAME_ATTEMPTS) - (e.attemptCount ?? 1)),
        attempts: Array.isArray(e.attempts) ? e.attempts : [],
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
        const isFinishedAttempt = e.state === "used" || e.state === "retry_allowed";
        const scoreTxt = isFinishedAttempt ? `${e.score ?? 0}/${e.maxScore ?? 0}` : "-";
        const winTxt = !isFinishedAttempt ? "-" : (e.isWin
            ? `🏆 MENANG${e.prizeTier ? ` (${e.prizeTier})` : ""}`
            : (e.state === "retry_allowed" ? "KALAH - bisa ulang" : "KALAH"));
        const attemptTxt = `${e.attemptCount ?? 0}/${e.maxAttempts ?? MAX_GAME_ATTEMPTS}`;
        const disp = e.dispenseStatus || (e.isWin ? "pending_dispense" : "-");
        const dispCls = disp === "dispensed" ? "b-used" : (disp === "pending_dispense" ? "b-pending" : "b-skip");
        const stateLabel = e.state === "used" ? "Selesai" : e.state === "retry_allowed" ? "Bisa Ulang" : "Diproses";
        const guest = e.guestName ? `<b>${e.guestName}</b>${e.ticketType ? ` <small>(${e.ticketType})</small>` : ""}` : "-";
        const modeBadge = e.scanMode === "VENDOR_API" ? `<span style="background:#17a2b8; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px;">API</span>` : `<span style="background:#6c757d; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px;">OFFLINE</span>`;

        return `
        <tr>
            <td><code>${e.qrCode}</code></td>
            <td>${e.ticketId}</td>
            <td>${guest}</td>
            <td>${modeBadge}</td>
            <td><span class="badge ${e.state === "used" ? "b-used" : e.state === "retry_allowed" ? "b-skip" : "b-pending"}">${stateLabel}</span></td>
            <td>${attemptTxt}</td>
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
            .mode-pill { background: ${SCAN_MODE === "VENDOR_API" ? "#17a2b8" : "#28a745"}; color: #fff; padding: 4px 12px; border-radius: 15px; font-size: 14px; font-weight: bold; }
        </style>
    </head>
    <body>
        <h2>💻 Local Server — Riwayat Scan Gacha <span class="mode-pill">Mode: ${SCAN_MODE}</span></h2>
        
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
                <th>QR Code</th><th>Ticket ID</th><th>Pengunjung</th><th>Mode</th><th>Status</th><th>Percobaan</th><th>Koin</th><th>Hasil</th><th>Dispense</th><th>Waktu Scan</th><th>Mesin</th>
            </tr>
            ${rows || '<tr><td colspan="11" class="empty">Belum ada QR yang discan di sistem ini</td></tr>'}
        </table>

        <p class="note">🔄 Auto-refresh tiap 10 detik. Maksimal kesempatan: <b>${MAX_GAME_ATTEMPTS}x</b>. Target Vendor API: <b>${VENDOR_BASE_URL}</b></p>
    </body>
    </html>
    `);
});

server.listen(PORT, async () => {
    console.log(`========================================`);
    console.log("VENDOR_BASE_URL =", VENDOR_BASE_URL);
    console.log("DEVICE_SNS      =", vendorClient.deviceList.join(", "));
    console.log(`WebSocket       : ws://localhost:${PORT}`);
    console.log(`Dashboard       : http://localhost:${PORT}`);
    console.log(`API Ledger      : http://localhost:${PORT}/api/ledger`);
    console.log(`API Results     : http://localhost:${PORT}/api/results (untuk platform dispenser)`);
    console.log(`API Config      : http://localhost:${PORT}/api/config (threshold menang ${WIN_MIN_PERCENTAGE}%, max attempt ${MAX_GAME_ATTEMPTS}x)`);
    console.log(`========================================\n`);

    // Inisialisasi Device ke Vendor API
    console.log(`🚀 [INIT] Melakukan registrasi & inisialisasi (${vendorClient.deviceList.length} device) ke Vendor API...`);
    await vendorClient.requestAllDevices();
    vendorClient.startConfigPolling(30);
});