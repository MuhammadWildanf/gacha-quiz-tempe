const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ==========================================
// ⚙️ KONFIGURASI
// ==========================================
const LOCAL_PORT = 3005; // Harus sama dengan PORT di local-server.js
const MACHINE_ID = "TEST-01";

// Reset ledger supaya bisa tes dari awal
fs.writeFileSync(path.join(__dirname, "tickets_local.json"), "[]");
console.log("🧹 Ledger di-reset.\n");

const ws = new WebSocket(`ws://localhost:${LOCAL_PORT}`);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

ws.on("open", () => {
    console.log("Terhubung ke server.\nKetik:");
    console.log("  scan <QR_CODE>          → simulasi scan ");
    console.log("  finish <QR> <skor> <max> [menang?] → kirim game_finish + skor koin");
    console.log("    contoh: finish <QR> 80 100 win   → menang (skor 80/100)");
    console.log("    contoh: finish <QR> 40 100       → kalah (otomatis)");
    console.log("  quit\n");
    prompt();
});

ws.on("message", (raw) => {
    const d = JSON.parse(raw);
    if (d.type === "scan_result") {
        if (d.success) console.log(`<<< ✅ SUKSES: ${d.message} (ticketId=${d.ticketId})`);
        else console.log(`<<< ❌ GAGAL: ${d.message} [${d.reason}]`);
    } else if (d.type === "ticket_claimed") {
        console.log(`<<< 📢 CLAIM: ${d.qrCode} oleh ${d.machineId} (pending)`);
    } else if (d.type === "ticket_finished") {
        console.log(`<<< 🎉 FINISH: ${d.qrCode} skor ${d.score}/${d.maxScore} menang=${d.isWin} → ${d.dispenseStatus}`);
    } else if (d.type === "dispense_result") {
        console.log(`<<< 📦 DISPENSE: ${d.qrCode} status=${d.dispenseStatus} hadiah=${d.prizeTier}`);
    } else if (d.type === "tickets_released") {
        console.log(`<<< ♻️  RELEASE: ${d.count} tiket dari ${d.machineId} dilepas`);
    }
    prompt();
});

ws.on("error", () => {
    console.error("❌ Tidak bisa konek. Pastikan local-server.js berjalan! (npm run start-local)");
    process.exit(1);
});

function prompt() {
    rl.question("> ", handleInput);
}

function handleInput(line) {
    const [cmd, ...args] = line.trim().split(/\s+/);
    if (cmd === "quit" || cmd === "exit") { rl.close(); process.exit(0); }
    if (cmd === "scan") {
        const qr = args.join(" ");
        if (!qr) { console.log("Format: scan <QR_CODE>"); return prompt(); }
        ws.send(JSON.stringify({ type: "scan_qr", qrCode: qr, machineId: MACHINE_ID }));
        console.log(`>>> [SCAN] ${qr}`);
    } else if (cmd === "finish") {
        // finish <QR> [skor] [maxScore] [win|lose] — skor meniru totalScore koin dari GameManagerGatcha
        const qr = args[0];
        if (!qr) { console.log("Format: finish <QR> [skor] [max] [win]"); return prompt(); }
        const score = args[1] !== undefined ? parseInt(args[1], 10) : 80;
        const maxScore = args[2] !== undefined ? parseInt(args[2], 10) : 100;
        const flag = String(args[3] || "").toLowerCase();
        const isWin = flag ? (flag === "win" || flag === "menang" || flag === "1" || flag === "true")
            : (maxScore > 0 ? (score / maxScore * 100 >= 80) : score >= 80);
        ws.send(JSON.stringify({
            type: "game_finish", qrCode: qr, machineId: MACHINE_ID,
            score, maxScore, isWin, prizeTier: isWin ? "HADIAH" : ""
        }));
        console.log(`>>> [FINISH] ${qr} skor ${score}/${maxScore} isWin=${isWin}`);
    } else if (cmd) {
        console.log("Perintah tidak dikenali. Ketik: scan <QR> / finish <QR> [skor] [max] [win] / quit");
    }
    prompt();
}