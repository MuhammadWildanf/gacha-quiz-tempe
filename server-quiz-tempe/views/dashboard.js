/**
 * View dashboard gacha — HANYA render HTML.
 * Logic, storage, dan aturan permainan tetap di server.js / settings.js.
 */

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[ch]));
}

function stateLabel(state) {
    if (state === "used") return "Selesai";
    if (state === "retry_allowed") return "Bisa Ulang";
    if (state === "released") return "Siap Scan Ulang";
    return "Diproses";
}

function stateClass(state) {
    if (state === "used") return "b-used";
    if (state === "pending") return "b-pending";
    return "b-skip";
}

function renderRows(ledger) {
    return ledger.map((e) => {
        const isFinishedAttempt = e.state === "used" || e.state === "retry_allowed";
        const scoreTxt = isFinishedAttempt ? `${e.score ?? 0}/${e.maxScore ?? 0}` : "-";
        const winTxt = !isFinishedAttempt ? "-" : (e.isWin
            ? `🏆 MENANG${e.prizeTier ? ` (${esc(e.prizeTier)})` : ""}`
            : (e.state === "retry_allowed" ? "KALAH - bisa ulang" : "KALAH"));
        const attemptTxt = `${e.attemptCount ?? 0}/${e.maxAttempts ?? "-"}`;
        const disp = e.dispenseStatus || (e.isWin ? "pending_dispense" : "-");
        const dispCls = disp === "dispensed" ? "b-used" : (disp === "pending_dispense" ? "b-pending" : "b-skip");
        const guest = e.guestName
            ? `<b>${esc(e.guestName)}</b>${e.ticketType ? ` <small>(${esc(e.ticketType)})</small>` : ""}`
            : "-";
        const modeBadge = e.scanMode === "VENDOR_API"
            ? `<span class="mode-api">API</span>`
            : `<span class="mode-offline">OFFLINE</span>`;

        return `
        <tr>
            <td><code>${esc(e.qrCode)}</code></td>
            <td>${esc(e.ticketId)}</td>
            <td>${guest}</td>
            <td>${modeBadge}</td>
            <td><span class="badge ${stateClass(e.state)}">${stateLabel(e.state)}</span></td>
            <td>${attemptTxt}</td>
            <td>${scoreTxt}</td>
            <td>${winTxt}</td>
            <td><span class="badge ${dispCls}">${esc(disp)}</span></td>
            <td>${esc(e.usedAt)}</td>
            <td>${esc(e.usedByMachine)}</td>
        </tr>`;
    }).join("");
}

/**
 * @param {object} data
 * @param {Array}  data.ledger
 * @param {number} data.totalMachines
 * @param {{maxGameAttempts:number, winMinPercentage:number}} data.settings
 * @param {string} data.scanMode
 * @param {string} data.winPrizeDefault
 * @param {boolean} data.saved
 * @param {string} data.error
 */
function renderDashboard({ ledger, totalMachines, settings, scanMode, winPrizeDefault, saved, error }) {
    const rows = renderRows(ledger);
    const totalUsed = ledger.filter((e) => e.state === "used").length;
    const totalWin = ledger.filter((e) => e.state === "used" && e.isWin).length;
    const totalPendingDispense = ledger.filter((e) => e.dispenseStatus === "pending_dispense").length;
    const totalPending = ledger.filter((e) => e.state === "pending").length;
    const modeClass = scanMode === "VENDOR_API" ? "mode-pill-api" : "mode-pill-local";

    const banner = saved
        ? `<div class="alert alert-ok">✅ Pengaturan disimpan. Berlaku langsung tanpa restart.</div>`
        : (error ? `<div class="alert alert-err">⛔ ${esc(error)}</div>` : "");

    return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Local Server - Ledger Gacha</title>
        <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; background: #f4f5f7; color: #222; }
            h2 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            .stats { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
            .card { background: #fff; border-radius: 8px; padding: 15px 25px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); text-align: center; min-width: 150px; }
            .card h1 { margin: 5px 0; font-size: 36px; }
            .card p { margin: 0; font-size: 13px; color: #777; }
            .settings { background: #fff; border-radius: 8px; padding: 16px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
            .settings h3 { margin: 0 0 12px; font-size: 16px; }
            .settings form { display: flex; gap: 18px; align-items: flex-end; flex-wrap: wrap; }
            .settings label { display: flex; flex-direction: column; gap: 5px; font-size: 13px; color: #555; }
            .settings input { width: 150px; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; }
            .settings button { padding: 9px 18px; border: 0; border-radius: 6px; background: #1e7e34; color: #fff; font-size: 14px; font-weight: bold; cursor: pointer; }
            .settings button:hover { background: #166a2a; }
            .hint { font-size: 12px; color: #888; margin: 10px 0 0; }
            .alert { padding: 10px 14px; border-radius: 6px; margin-bottom: 15px; font-size: 14px; }
            .alert-ok { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .alert-err { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
            th, td { border: 1px solid #ddd; padding: 9px 12px; font-size: 13px; }
            th { background: #343a40; color: white; text-align: left; }
            tr:hover { background: #f5f5f5; }
            .note { font-size: 12px; color: #999; margin-top: 10px; line-height: 1.6; }
            .empty { text-align: center; color: #999; padding: 25px; }
            .badge { padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: bold; }
            .b-used { background: #d4edda; color: #155724; }
            .b-pending { background: #fff3cd; color: #856404; }
            .b-skip { background: #e2e3e5; color: #555; }
            .mode-pill { color: #fff; padding: 4px 12px; border-radius: 15px; font-size: 14px; font-weight: bold; }
            .mode-pill-api { background: #17a2b8; }
            .mode-pill-local { background: #28a745; }
            .mode-api { background: #17a2b8; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
            .mode-offline { background: #6c757d; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
        </style>
    </head>
    <body>
        <h2>💻 Local Server — Riwayat Scan Gacha <span class="mode-pill ${modeClass}">Mode: ${esc(scanMode)}</span></h2>

        ${banner}

        <div class="settings">
            <h3>⚙️ Pengaturan Permainan</h3>
            <form method="POST" action="/settings">
                <label>
                    Kesempatan bermain (attempt)
                    <input type="number" name="maxGameAttempts" min="1" max="50" step="1" value="${esc(settings.maxGameAttempts)}" required>
                </label>
                <label>
                    Ambang menang (%)
                    <input type="number" name="winMinPercentage" min="0" max="100" step="1" value="${esc(settings.winMinPercentage)}" required>
                </label>
                <button type="submit">Simpan Pengaturan</button>
            </form>
            <p class="hint">Berlaku langsung tanpa restart. Tiket yang belum selesai ikut menyesuaikan jumlah kesempatan. Hadiah menang default: <b>${esc(winPrizeDefault)}</b>.</p>
        </div>

        <div class="stats">
            <div class="card">
                <p>Total QR Discan</p>
                <h1 style="color:#333">${ledger.length}</h1>
            </div>
            <div class="card">
                <p>Selesai Game</p>
                <h1 style="color:#1e7e34">${totalUsed}</h1>
            </div>
            <div class="card">
                <p>Menang 🏆</p>
                <h1 style="color:#6f42c1">${totalWin}</h1>
            </div>
            <div class="card">
                <p>Pending Dispense</p>
                <h1 style="color:#ff8c00">${totalPendingDispense}</h1>
            </div>
            <div class="card">
                <p>Sedang Diproses</p>
                <h1 style="color:#ff8c00">${totalPending}</h1>
            </div>
            <div class="card">
                <p>Mesin Unity Aktif</p>
                <h1 style="color:#007bff">${totalMachines}</h1>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>QR Code</th><th>Ticket ID</th><th>Pengunjung</th><th>Mode</th><th>Status</th>
                    <th>Percobaan</th><th>Koin</th><th>Hasil</th><th>Dispense</th><th>Waktu Scan</th><th>Mesin</th>
                </tr>
            </thead>
            <tbody>
                ${rows || '<tr><td colspan="11" class="empty">Belum ada QR yang discan di sistem ini</td></tr>'}
            </tbody>
        </table>

        <p class="note">
            🔄 Auto-refresh tiap 10 detik (berhenti saat form sedang diisi).
            Maksimal kesempatan: <b>${esc(settings.maxGameAttempts)}x</b>.
            Ambang menang: <b>${esc(settings.winMinPercentage)}%</b>.
            Pengaturan tersimpan di <code>settings_local.json</code>.
        </p>

        <script>
            // Auto-refresh, tapi jangan ganggu operator yang sedang mengisi form.
            setInterval(function () {
                var el = document.activeElement;
                if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
                location.reload();
            }, 10000);
        </script>
    </body>
    </html>
    `;
}

module.exports = { renderDashboard, esc };
