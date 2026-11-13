const express = require("express");
const http = require("http");
const WebSocket = require("ws");
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
const parsedPort = parseInt(process.env.PORT || "3012", 10);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : 3012;

const VendorClient = require("./vendor-client");
const settings = require("./settings");
const { loadLedger, saveLedger } = require("./ledger");
const { renderDashboard } = require("./views/dashboard");

// --- MODE VALIDASI SCAN TIKET ---
// "LOCAL_FORMAT" = Offline (cek format lokal)
// "VENDOR_API"   = Online (Spesifikasi Vendor v1.0 via HMAC-SHA256)
const SCAN_MODE = process.env.SCAN_MODE || "VENDOR_API";

// Konfigurasi Vendor API v1.0
const VENDOR_BASE_URL = process.env.VENDOR_BASE_URL || "http://localhost:4000";
const VENDOR_API_KEY = process.env.VENDOR_API_KEY || "mk_tempe_gacha_test";
const VENDOR_SECRET = process.env.VENDOR_SECRET || "mock-vendor-secret-key-12345";
const DEVICE_SNS = process.env.DEVICE_SNS || process.env.DEVICE_SN || "gacha-001";

// Deteksi mesin Unity yang mati tanpa mengirim close (kabel putus / hang),
// supaya tiket pending cepat dilepas dan bisa discan ulang.
const WS_HEARTBEAT_MS = 15000;

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
// Ambang menang & jumlah kesempatan dibaca dinamis dari settings.js.
const WIN_PRIZE_DEFAULT = "HADIAH";

// ==========================================
// 2. HELPER LEDGER LOKAL (transaksi gacha)
//    loadLedger/saveLedger ada di ledger.js (mudah diganti SQLite)
// ==========================================
// Lock sederhana agar QR yang sama tidak divalidasi bersamaan dalam satu proses.
const scansInProgress = new Set();

function ensureAttemptData(entry) {
    if (!Number.isInteger(entry.attemptCount) || entry.attemptCount < 0) entry.attemptCount = 0;
    if (!Number.isInteger(entry.maxAttempts) || entry.maxAttempts < 1) entry.maxAttempts = settings.get().maxGameAttempts;
    if (!Array.isArray(entry.attempts)) entry.attempts = [];
    return entry;
}

// Sinkronkan jumlah kesempatan baru ke tiket yang belum selesai (used),
// supaya perubahan dari dashboard langsung terasa untuk sesi yang berjalan.
function applyMaxAttemptsToActiveTickets(maxAttempts) {
    const ledger = loadLedger();
    let changed = 0;
    for (const entry of ledger) {
        if (entry.state === "used") continue;
        const before = entry.maxAttempts;
        ensureAttemptData(entry);
        if (entry.maxAttempts !== maxAttempts) entry.maxAttempts = maxAttempts;
        entry.attemptsRemaining = Math.max(0, entry.maxAttempts - entry.attemptCount);
        if (entry.maxAttempts !== before) changed++;
    }
    if (changed > 0) saveLedger(ledger);
    return changed;
}

// Cari socket mesin yang masih hidup (untuk cek pemilik tiket pending).
function getMachineSocket(machineId) {
    if (!machineId) return null;
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN && client.machineId === machineId) return client;
    }
    return null;
}

// Bangun payload scan_result VALID yang seragam (scan baru / resume / main lagi).
function buildScanSuccess(entry, qrCode, now, resumed, message) {
    return {
        type: "scan_result",
        success: true,
        reason: "VALID",
        resumed: Boolean(resumed),
        message,
        ticketId: entry.ticketId || qrCode,
        guestName: entry.guestName || null,
        usedAt: entry.usedAt || now,
        attemptCount: entry.attemptCount,
        maxAttempts: entry.maxAttempts,
        attemptsRemaining: Math.max(0, entry.maxAttempts - entry.attemptCount)
    };
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
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
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

                // Tiket sudah selesai (menang / kesempatan habis) → tolak permanen.
                if (existing && existing.state === "used") {
                    ws.send(JSON.stringify({
                        type: "scan_result", success: false, reason: "ALREADY_USED",
                        message: "Tiket ini sudah menyelesaikan permainan dan tidak bisa digunakan kembali."
                    }));
                    return;
                }

                // Kesempatan bermain habis → kunci tiket.
                if (existing && existing.attemptCount >= existing.maxAttempts) {
                    existing.state = "used";
                    existing.completedAt = existing.completedAt || now;
                    saveLedger(ledger);
                    ws.send(JSON.stringify({
                        type: "scan_result", success: false, reason: "ATTEMPTS_EXHAUSTED",
                        message: "Kesempatan bermain tiket ini sudah habis."
                    }));
                    return;
                }

                // ============================================================
                // PENTING: tiket yang SUDAH ADA di ledger berarti sudah pernah
                // lolos validasi (kuota Vendor sudah terpakai saat scan pertama).
                // Jangan panggil Vendor API lagi untuk tiket ini — Vendor akan
                // menjawab 409 ALREADY_USED walaupun pemain belum selesai / masih
                // punya kesempatan. Lanjut/tolak diputuskan dari ledger lokal.
                // ============================================================
                if (existing && existing.state === "pending") {
                    const sameMachine = existing.usedByMachine === machineId;
                    const ownerOnline = getMachineSocket(existing.usedByMachine);

                    if (!sameMachine && ownerOnline) {
                        ws.send(JSON.stringify({
                            type: "scan_result", success: false, reason: "PENDING",
                            message: `Tiket ini sedang diproses di mesin ${existing.usedByMachine}.`
                        }));
                        return;
                    }

                    // Resume sesi mesin yang sama, atau ambil alih tiket "yatim"
                    // (Unity mati / putus tanpa sempat mengirim close).
                    existing.usedByMachine = machineId;
                    existing.usedAt = existing.usedAt || now;
                    existing.inProgress = true;
                    saveLedger(ledger);
                    console.log(`♻️ [WS] Resume sesi QR ${scannedQr} di mesin ${machineId}. ` +
                        `Percobaan selesai ${existing.attemptCount}/${existing.maxAttempts}; Vendor API dilewati.`);

                    ws.send(JSON.stringify(buildScanSuccess(
                        existing, scannedQr, now, true,
                        "Sesi permainan sebelumnya ditemukan. Silakan lanjutkan permainan."
                    )));
                    return;
                }

                // state "retry_allowed" (kalah, masih ada kesempatan) atau
                // "released" (terputus sebelum attempt selesai) → boleh main lagi
                // TANPA Vendor. attemptCount TIDAK di-reset.
                if (existing) {
                    existing.state = "pending";
                    existing.usedByMachine = machineId;
                    existing.usedAt = now;
                    existing.inProgress = true;
                    saveLedger(ledger);
                    console.log(`🔁 [WS] QR ${scannedQr} bermain lagi di mesin ${machineId}. ` +
                        `Percobaan selesai ${existing.attemptCount}/${existing.maxAttempts}; Vendor API dilewati.`);

                    ws.send(JSON.stringify(buildScanSuccess(
                        existing, scannedQr, now, true,
                        `Lanjut bermain. Kesempatan tersisa ${Math.max(0, existing.maxAttempts - existing.attemptCount)}x.`
                    )));
                    return;
                }

                // === Tiket BARU (belum pernah ada di ledger) → validasi Vendor ===
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
                const guestName = vendorRes.data?.guestName || null;
                const ticketType = vendorRes.data?.ticketType || null;
                const successMessage = vendorRes.message || "Tiket valid, selamat gacha!";

                existing = ensureAttemptData({
                    qrCode: scannedQr, ticketId, guestName, ticketType,
                    scanMode: SCAN_MODE, state: "pending", usedAt: now,
                    usedByMachine: machineId, attemptCount: 0,
                    maxAttempts: settings.get().maxGameAttempts, attempts: [],
                    inProgress: true
                });
                ledger.push(existing);
                saveLedger(ledger);

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

                // Terima finish dari sesi yang masih berjalan — termasuk sesi yang
                // sempat "released" karena koneksi putus lalu tersambung lagi
                // (inProgress), supaya hasil kemenangan tidak hilang.
                const canAcceptFinish = entry.state === "pending" ||
                    (entry.inProgress === true && entry.state !== "used");

                if (!canAcceptFinish) {
                    console.log(`ℹ️ [WS] game_finish ${scannedQr} ditolak karena status: ${entry.state}.`);
                    return;
                }

                if (entry.usedByMachine && entry.usedByMachine !== machineId) {
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
                const finalWin = pct >= settings.get().winMinPercentage;
                const prizeTier = finalWin
                    ? (String(data.prizeTier || "").trim() || WIN_PRIZE_DEFAULT)
                    : "";

                entry.usedByMachine = machineId;
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
                entry.inProgress = false;
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
        // CATATAN: entri TIDAK dihapus. Kalau dihapus, scan ulang akan memanggil
        // Vendor API lagi dan ditolak ALREADY_USED (kuota vendor sudah terpakai
        // saat scan pertama). Simpan sebagai "released" / "retry_allowed".
        const mid = ws.machineId;
        const anotherSocketForMachine = mid && [...wss.clients].some(
            client => client !== ws &&
                client.readyState === WebSocket.OPEN &&
                client.machineId === mid
        );

        if (mid && !anotherSocketForMachine) {
            const ledger = loadLedger();
            let released = 0;
            const now = getTimestamp();
            for (const e of ledger) {
                if (e.state === "pending" && e.usedByMachine === mid) {
                    released++;
                    ensureAttemptData(e);
                    e.state = e.attemptCount > 0 ? "retry_allowed" : "released";
                    e.usedByMachine = null;
                    e.releasedAt = now;
                }
            }
            if (released > 0) {
                saveLedger(ledger);
                console.log(`♻️ [WS] Mesin ${mid} terputus → ${released} tiket pending dilepas ` +
                    `(histori attempt tetap disimpan, bisa discan ulang tanpa Vendor).`);
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
// 3b. HEARTBEAT — deteksi mesin mati tanpa close
// ==========================================
const wsHeartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
        if (client.isAlive === false) {
            console.log("💀 [WS] Mesin tidak merespons ping → koneksi diputus, tiket pending akan dilepas.");
            return client.terminate();
        }
        client.isAlive = false;
        try { client.ping(); } catch (err) { /* biarkan, akan diterminate di tick berikutnya */ }
    });
}, WS_HEARTBEAT_MS);

wss.on("close", () => clearInterval(wsHeartbeat));

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
        : entry.state === "released" ? "RELEASED"
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
    const entry = ledger.find(e => e.qrCode === qrCode);
    if (!entry) {
        return res.json({ success: false, message: "Tiket tidak ditemukan." });
    }
    ensureAttemptData(entry);
    if (entry.state === "used") {
        return res.json({ success: false, message: "Tiket sudah selesai (used), tidak bisa dilepas." });
    }
    if (entry.state !== "pending") {
        return res.json({
            success: true,
            message: `Tiket sudah berstatus ${entry.state} dan bisa discan ulang tanpa Vendor.`,
            entry
        });
    }
    entry.state = entry.attemptCount > 0 ? "retry_allowed" : "released";
    entry.usedByMachine = null;
    entry.inProgress = false;
    entry.releasedAt = getTimestamp();
    saveLedger(ledger);
    console.log(`♻️ [API] Tiket ${qrCode} dilepas manual → ${entry.state}.`);
    res.json({ success: true, message: "Tiket dilepas dan bisa discan ulang (tanpa validasi Vendor).", entry });
});

// ==========================================
// 4b. API UNTUK PLATFORM DISPENSER (PULL MODEL)
// Pihak platform polling ke sini untuk tahu siapa yang menang.
// ==========================================
// Aturan main & threshold (dinamis dari settings.js)
app.get("/api/config", (req, res) => {
    const cfg = settings.get();
    res.json({
        success: true,
        winMinPercentage: cfg.winMinPercentage,
        winPrizeDefault: WIN_PRIZE_DEFAULT,
        maxGameAttempts: cfg.maxGameAttempts
    });
});

// Pengaturan runtime (dipakai dashboard / operator)
app.get("/api/settings", (req, res) => {
    res.json({ success: true, data: settings.get(), limits: settings.limits });
});

app.post("/api/settings", (req, res) => {
    try {
        const updated = settings.update({
            maxGameAttempts: req.body?.maxGameAttempts,
            winMinPercentage: req.body?.winMinPercentage
        });
        const synced = applyMaxAttemptsToActiveTickets(updated.maxGameAttempts);
        console.log(`⚙️ [SETTINGS] maxAttempts=${updated.maxGameAttempts}, winMin=${updated.winMinPercentage}%` +
            (synced > 0 ? `, ${synced} tiket aktif disesuaikan.` : "."));
        res.json({ success: true, message: "Pengaturan disimpan.", data: updated, syncedTickets: synced });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// Form dari dashboard (redirect balik ke root)
app.post("/settings", (req, res) => {
    try {
        const updated = settings.update({
            maxGameAttempts: req.body?.maxGameAttempts,
            winMinPercentage: req.body?.winMinPercentage
        });
        const synced = applyMaxAttemptsToActiveTickets(updated.maxGameAttempts);
        console.log(`⚙️ [SETTINGS] maxAttempts=${updated.maxGameAttempts}, winMin=${updated.winMinPercentage}%` +
            (synced > 0 ? `, ${synced} tiket aktif disesuaikan.` : "."));
        res.redirect("/?saved=1");
    } catch (err) {
        res.redirect(`/?error=${encodeURIComponent(err.message)}`);
    }
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
        maxAttempts: e.maxAttempts ?? settings.get().maxGameAttempts,
        attemptsRemaining: Math.max(0, (e.maxAttempts ?? settings.get().maxGameAttempts) - (e.attemptCount ?? 1)),
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

// Dashboard ringkasan ledger lokal (view dipisah di views/dashboard.js)
app.get("/", (req, res) => {
    res.send(renderDashboard({
        ledger: loadLedger(),
        totalMachines: wss.clients.size,
        settings: settings.get(),
        scanMode: SCAN_MODE,
        winPrizeDefault: WIN_PRIZE_DEFAULT,
        saved: req.query.saved === "1",
        error: typeof req.query.error === "string" ? req.query.error : ""
    }));
});

server.listen(PORT, async () => {
    console.log(`========================================`);
    console.log("VENDOR_BASE_URL =", VENDOR_BASE_URL);
    console.log("DEVICE_SNS      =", vendorClient.deviceList.join(", "));
    console.log(`WebSocket       : ws://localhost:${PORT}`);
    console.log(`Dashboard       : http://localhost:${PORT}`);
    console.log(`API Ledger      : http://localhost:${PORT}/api/ledger`);
    console.log(`API Results     : http://localhost:${PORT}/api/results (untuk platform dispenser)`);
    const cfg = settings.get();
    console.log(`API Config      : http://localhost:${PORT}/api/config (threshold menang ${cfg.winMinPercentage}%, max attempt ${cfg.maxGameAttempts}x)`);
    console.log(`API Settings    : http://localhost:${PORT}/api/settings (GET/POST, ubah dari dashboard)`);
    console.log(`========================================\n`);

    // Inisialisasi Device ke Vendor API
    console.log(`🚀 [INIT] Melakukan registrasi & inisialisasi (${vendorClient.deviceList.length} device) ke Vendor API...`);
    await vendorClient.requestAllDevices();
    vendorClient.startConfigPolling(30);
});