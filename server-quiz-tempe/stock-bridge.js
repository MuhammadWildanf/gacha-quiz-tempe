/**
 * Jembatan stok: mesin (WS) <-> quiz-management-tempe (HTTP).
 * Nilai stok resmi ada di quiz-management. File ini hanya meneruskan pesan.
 *
 * Arah pesan:
 *   mesin  -> hello            : server minta stok terbaru dari web, lalu kirim stock_state
 *   mesin  -> stock_event      : hadiah keluar (-1), diteruskan ke web, lalu stock_ack
 *   web    -> /api/internal/stock-push : kirim stock_set ke mesin yang sedang terhubung
 */
const express = require("express");
const WebSocket = require("ws");

const QUIZ_BASE = (process.env.QUIZ_MANAGEMENT_URL || "").replace(/\/$/, "");
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "";

let wssRef = null;

function init(wss) {
    wssRef = wss;
}

function sendTo(ws, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function socketFor(machineId) {
    if (!wssRef) return null;
    for (const client of wssRef.clients) {
        if (client.readyState === WebSocket.OPEN && client.machineId === machineId) return client;
    }
    return null;
}

async function callQuiz(method, path, body) {
    if (!QUIZ_BASE || !INTERNAL_KEY) throw new Error("QUIZ_MANAGEMENT_URL / INTERNAL_API_KEY belum diisi di .env");
    const res = await fetch(QUIZ_BASE + path, {
        method,
        headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(8000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
}

async function onHello(ws, machineId) {
    if (!machineId) return;
    ws.machineId = machineId;
    try {
        const s = await callQuiz("GET", `/api/internal/machines/${encodeURIComponent(machineId)}/stock`);
        sendTo(ws, { type: "stock_state", configured: s.version > 0, stock: s.stock, version: s.version });
    } catch (err) {
        console.error(`⚠️ [STOCK] Gagal mengambil stok ${machineId} dari web: ${err.message}`);
    }
}

async function onStockEvent(ws, data) {
    const machineId = ws.machineId;
    const eventId = String(data.eventId || "");
    if (!machineId || !eventId) return;
    try {
        const r = await callQuiz("POST", "/api/internal/stock-events", {
            machineId,
            eventId,
            baseVersion: Number(data.baseVersion) || 0,
            delta: -1
        });
        sendTo(ws, { type: "stock_ack", eventId, applied: r.applied, stock: r.stock, version: r.version });
    } catch (err) {
        // Tidak di-ack: mesin akan mengirim ulang event ini nanti (eventId mencegah hitungan ganda).
        console.error(`⚠️ [STOCK] Event ${eventId.slice(0, 8)} dari ${machineId} belum tersimpan: ${err.message}`);
    }
}

function requireInternalKey(req, res, next) {
    if (!INTERNAL_KEY) return res.status(500).json({ success: false, message: "INTERNAL_API_KEY belum diisi." });
    if (req.headers["x-internal-key"] !== INTERNAL_KEY) {
        return res.status(401).json({ success: false, message: "Kunci internal salah." });
    }
    next();
}

const router = express.Router();

// Dipanggil quiz-management setelah admin/operator mengubah stok di web.
router.post("/stock-push", requireInternalKey, (req, res) => {
    const machineId = String(req.body?.machineId || "");
    const stock = Number(req.body?.stock);
    const version = Number(req.body?.version);
    if (!machineId || !Number.isInteger(stock) || stock < 0 || !Number.isInteger(version) || version < 1) {
        return res.status(400).json({ success: false, message: "machineId, stock, atau version tidak valid." });
    }
    const ws = socketFor(machineId);
    if (!ws) return res.json({ success: true, delivered: false });
    sendTo(ws, { type: "stock_set", configured: true, stock, version });
    res.json({ success: true, delivered: true });
});

module.exports = { init, onHello, onStockEvent, router };
