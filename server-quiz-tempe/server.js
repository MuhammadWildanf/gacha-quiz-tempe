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
const PORT = 3005;
const LEDGER_FILE = path.join(__dirname, "tickets_local.json");

// --- MODE VALIDASI SCAN TIKET ---
// "LOCAL_FORMAT" = Offline (cek 171 char + prefix + checksum lokal)
// "VENDOR_API"   = Online (request validasi ke API Vendor dengan Secret/Bearer Token)
const SCAN_MODE = process.env.SCAN_MODE || "LOCAL_FORMAT";

// Konfigurasi jika SCAN_MODE = "VENDOR_API"
const VENDOR_API_URL = process.env.VENDOR_API_URL || "http://localhost:4000/api/v1/validate-ticket";
const VENDOR_CLAIM_URL = process.env.VENDOR_CLAIM_URL || "http://localhost:4000/api/v1/claim-ticket";
const VENDOR_API_TOKEN = process.env.VENDOR_API_TOKEN || "mock-secret-vendor-token-12345";
const VENDOR_AUTH_HEADER = process.env.VENDOR_AUTH_HEADER || "Authorization"; // "Authorization" atau "X-Secret-Token"
const VENDOR_AUTH_PREFIX = process.env.VENDOR_AUTH_PREFIX || "Bearer "; // "Bearer " atau "" jika custom header

// --- Helper Request ke API Vendor ---

async function validateTicketWithVendor(code, deviceId) {
    try {
        const headers = {
            "Content-Type": "application/json"
        };

        if (VENDOR_API_TOKEN) {
            const prefix = VENDOR_AUTH_PREFIX.trim();

            headers[VENDOR_AUTH_HEADER] = prefix
                ? `${prefix} ${VENDOR_API_TOKEN}`.trim()
                : VENDOR_API_TOKEN;
        }

        console.log(
            `🌐 [VENDOR API] Mengirim validasi ke: ${VENDOR_API_URL}`
        );

        console.log(
            `   Headers: ${VENDOR_AUTH_HEADER}: ${headers[VENDOR_AUTH_HEADER]
                ? headers[VENDOR_AUTH_HEADER].substring(0, 15) + "..."
                : "none"
            }`
        );

        console.log(
            `   Payload: { code: "${code}", deviceId: "${deviceId}" }`
        );

        const response = await fetch(VENDOR_API_URL, {
            method: "POST",
            headers,
            body: JSON.stringify({ code, deviceId }),
            signal: AbortSignal.timeout(6000)
        });

        const data = await response.json();

        return {
            httpStatus: response.status,
            ...data
        };
    } catch (err) {
        console.error(
            `❌ [VENDOR API ERROR] ${err.message}`
        );

        return {
            success: false,
            valid: false,
            reason: "VENDOR_API_ERROR",
            message: `Gagal terhubung ke API Vendor (${err.message})`
        };
    }
}


async function claimTicketWithVendor(code, deviceId, score, isWin) {
    if (!VENDOR_CLAIM_URL) return;
    try {
        const headers = { "Content-Type": "application/json" };
        if (VENDOR_API_TOKEN) {
            headers[VENDOR_AUTH_HEADER] = `${VENDOR_AUTH_PREFIX}${VENDOR_API_TOKEN}`.trim();
        }
        await fetch(VENDOR_CLAIM_URL, {
            method: "POST",
            headers,
            body: JSON.stringify({ code, deviceId, score, isWin }),
            signal: AbortSignal.timeout(6000)
        });
        console.log(`✅ [VENDOR API] Klaim game selesai terkirim ke vendor.`);
    } catch (err) {
        console.error(`⚠️ [VENDOR API] Gagal kirim klaim tiket ke vendor: ${err.message}`);
    }
}

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

    ws.on("message", async (message) => {
        try {
            const data = JSON.parse(message);

            // ----------------------------------------
            // EVENT: Mesin Unity scan QR
            // ----------------------------------------
            if (data.type === "scan_qr") {
                const scannedQr = (data.qrCode || "").trim();
                const machineId = data.machineId || "UNKNOWN_DEVICE";
                const now = getTimestamp();
                ws.machineId = machineId;

                console.log(`\n🔍 [WS] [${now}] Mesin [${machineId}] scan: ${scannedQr} (Mode: ${SCAN_MODE})`);

                const ledger = loadLedger();
                const existing = ledger.find(e => e.qrCode === scannedQr);

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

                // Sudah selesai dipakai di sistem kita → tolak permanen
                if (existing && existing.state === "used") {
                    console.log(`❌ [WS] QR ${scannedQr} sudah SELESAI dipakai gacha di sistem lokal.`);
                    ws.send(JSON.stringify({
                        type: "scan_result",
                        success: false,
                        reason: "ALREADY_USED",
                        message: "Tiket ini sudah pernah digunakan."
                    }));
                    return;
                }

                let ticketId = scannedQr;
                let guestName = null;
                let ticketType = null;
                let successMessage = "Tiket valid, selamat gacha!";

                // ========================================
                // 1. JIKA SCAN_MODE = "VENDOR_API"
                // ========================================
                if (SCAN_MODE === "VENDOR_API") {
                    console.log(`🌐 [WS] Meminta validasi online ke API Vendor...`);
                    const vendorRes = await validateTicketWithVendor(scannedQr, machineId);

                    if (!vendorRes.success || !vendorRes.valid) {
                        const reason = vendorRes.reason || "INVALID_TICKET";
                        const msg = vendorRes.message || "Tiket ditolak oleh sistem vendor.";
                        console.log(`❌ [WS] Ditolak oleh API Vendor: ${reason} - ${msg}`);
                        ws.send(JSON.stringify({
                            type: "scan_result",
                            success: false,
                            reason: reason,
                            message: msg
                        }));
                        return;
                    }

                    // Tiket dikonfirmasi valid oleh vendor
                    ticketId = String(vendorRes.data?.ticketId || scannedQr);
                    guestName = vendorRes.data?.guestName || null;
                    ticketType = vendorRes.data?.ticketType || null;
                    if (vendorRes.message) successMessage = vendorRes.message;
                    console.log(`✅ [WS] Vendor konfirmasi VALID: TicketId=${ticketId}, Guest=${guestName || "-"}`);
                }
                // ========================================
                // 2. JIKA SCAN_MODE = "LOCAL_FORMAT" (Offline)
                // ========================================
                else {
                    const parsed = parseQRCode(scannedQr);
                    if (!parsed.valid) {
                        console.log(`❌ [WS] QR ditolak format lokal: ${parsed.reason}`);
                        ws.send(JSON.stringify({
                            type: "scan_result",
                            success: false,
                            reason: parsed.reason,
                            message: reasonMessage(parsed.reason)
                        }));
                        return;
                    }
                    ticketId = parsed.ticketId;
                }

                // --- LANGKAH: Simpan riwayat scan ke ledger sistem kita ---
                if (existing && existing.state === "pending" && existing.usedByMachine === machineId) {
                    existing.usedAt = now; // mesin yang sama mengulang sesi tiket yang belum selesai
                    saveLedger(ledger);
                    console.log(`🔁 [WS] QR ${scannedQr} di-claim ULANG oleh ${machineId} (sesi belum selesai).`);
                } else {
                    ledger.push({
                        qrCode: scannedQr,
                        ticketId: ticketId,
                        guestName: guestName,
                        ticketType: ticketType,
                        scanMode: SCAN_MODE,
                        state: "pending",
                        usedAt: now,
                        usedByMachine: machineId
                    });
                    saveLedger(ledger);
                    console.log(`💾 [LEDGER SISTEM] Scan tersimpan di sistem lokal! Tiket: ${ticketId}, Mode: ${SCAN_MODE}`);
                }

                // Kirim sukses ke mesin yang scan
                ws.send(JSON.stringify({
                    type: "scan_result",
                    success: true,
                    reason: "VALID",
                    message: successMessage,
                    ticketId: ticketId,
                    guestName: guestName,
                    usedAt: now
                }));

                // Broadcast ke semua mesin (sinkron status claim/pending)
                broadcast({
                    type: "ticket_claimed",
                    qrCode: scannedQr,
                    ticketId: ticketId,
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
                const score = Number.isFinite(Number(data.score)) ? Number(data.score) : 0;
                const maxScore = Number.isFinite(Number(data.maxScore)) ? Number(data.maxScore) : 0;
                const pct = maxScore > 0 ? (score / maxScore * 100) : 0;
                const serverWin = pct >= WIN_MIN_PERCENTAGE;
                const clientWin = data.isWin === true || data.isWin === 1 || data.isWin === "true";
                const finalWin = (maxScore > 0) ? (serverWin && clientWin) : clientWin;
                const prizeTier = finalWin ? (String(data.prizeTier || "").trim() || WIN_PRIZE_DEFAULT) : "";

                entry.state = "used";
                entry.finishedAt = now;
                entry.score = score;
                entry.maxScore = maxScore;
                entry.isWin = finalWin;
                entry.prizeTier = prizeTier;
                entry.dispenseStatus = finalWin ? "pending_dispense" : "skipped";
                saveLedger(ledger);

                console.log(`🎉 [WS] [${now}] Game ${scannedQr} (tiket ${entry.ticketId}) SELESAI di ${machineId} skor ${score}/${maxScore} (${pct.toFixed(0)}%) → ${finalWin ? "MENANG 🏆" : "kalah"} → status lokal: used.`);

                // Jika mode VENDOR_API, kabari vendor bahwa game selesai untuk potong kuota
                if (SCAN_MODE === "VENDOR_API") {
                    claimTicketWithVendor(scannedQr, machineId, score, finalWin);
                }

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
                    dispenseStatus: entry.dispenseStatus,
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
        const guest = e.guestName ? `<b>${e.guestName}</b>${e.ticketType ? ` <small>(${e.ticketType})</small>` : ""}` : "-";
        const modeBadge = e.scanMode === "VENDOR_API" ? `<span style="background:#17a2b8; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px;">API</span>` : `<span style="background:#6c757d; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px;">OFFLINE</span>`;

        return `
        <tr>
            <td><code>${e.qrCode}</code></td>
            <td>${e.ticketId}</td>
            <td>${guest}</td>
            <td>${modeBadge}</td>
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
                <th>QR Code</th><th>Ticket ID</th><th>Pengunjung</th><th>Mode</th><th>Status</th><th>Koin</th><th>Hasil</th><th>Dispense</th><th>Waktu Scan</th><th>Mesin</th>
            </tr>
            ${rows || '<tr><td colspan="10" class="empty">Belum ada QR yang discan di sistem ini</td></tr>'}
        </table>

        <p class="note">🔄 Auto-refresh tiap 10 detik. Mode saat ini: <b>${SCAN_MODE}</b> | Target Vendor: ${SCAN_MODE === "VENDOR_API" ? VENDOR_API_URL : "Pola Offline (171 char)"}</p>
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
    console.log("SCAN_MODE =", SCAN_MODE);
    console.log("VENDOR_API_URL =", VENDOR_API_URL);
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