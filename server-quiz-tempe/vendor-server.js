const express = require("express");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const app = express();

// ==========================================
// ⚙️ KONFIGURASI — Ubah di sini
// ==========================================
const PORT = 4000;
const VENDOR_DB_FILE = path.join(__dirname, "vendor_db.json");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ==========================================
// 0. HELPER DATABASE VENDOR
// ==========================================
function readVendorDB() {
    if (!fs.existsSync(VENDOR_DB_FILE)) {
        const initialData = [
            {
                id: 101,
                name: "Budi Santoso",
                company: "PT. Maju Bersama",
                qrCode: "QR-GUEST-001",
                ticketType: "VIP",
                maxPlay: 3,
                status: "AVAILABLE"
            },
            {
                id: 102,
                name: "Siti Aminah",
                company: "CV. Sukses Jaya",
                qrCode: "QR-GUEST-002",
                ticketType: "REGULER",
                maxPlay: 1,
                status: "AVAILABLE"
            },
            {
                id: 103,
                name: "Andi Saputra",
                company: "PT. Berkah Abadi",
                qrCode: "QR-GUEST-003",
                ticketType: "REGULER",
                maxPlay: 1,
                status: "AVAILABLE"
            }
        ];
        writeVendorDB(initialData);
        return initialData;
    }
    return JSON.parse(fs.readFileSync(VENDOR_DB_FILE));
}

function writeVendorDB(data) {
    fs.writeFileSync(VENDOR_DB_FILE, JSON.stringify(data, null, 2));
}

// Auto-generate QR code format: TPM-TANGGAL-NOURUT-CHECKSUM
// Contoh: TPM-260909-000001-3613
// Struktur disepakati dengan sistem gacha (local server) — jangan diubah sendiri.
function computeChecksum(yymmdd, seq) {
    const payload = String(yymmdd) + String(seq).padStart(6, "0");
    let sum = 0;
    for (let i = 0; i < payload.length; i++) {
        sum += parseInt(payload[i]) * (i + 1);
    }
    return String(((sum * 31) + 17) % 10000).padStart(4, "0");
}

function generateTicketQR(data) {
    const now = new Date();
    const yymmdd = String(now.getFullYear()).slice(2)
        + String(now.getMonth() + 1).padStart(2, "0")
        + String(now.getDate()).padStart(2, "0");

    // nomor urut = urutan tiket terakhir yg pernah dibuat + 1
    let lastSeq = 0;
    for (let p of data) {
        const match = String(p.qrCode || "").match(/TPM-\d{6}-(\d{6})-/);
        if (match) lastSeq = Math.max(lastSeq, parseInt(match[1]));
    }
    const seq = String(lastSeq + 1).padStart(6, "0");
    const checksum = computeChecksum(yymmdd, seq);

    return `TPM-${yymmdd}-${seq}-${checksum}`;
}

// ==========================================
// 1. API UNTUK LOCAL SERVER (SYNC & REAL-TIME VALIDATION)
// ==========================================
const VENDOR_SECRET_TOKEN = process.env.VENDOR_SECRET_TOKEN || "mock-secret-vendor-token-12345";

// Middleware verifikasi Bearer Token / Secret Token dari Vendor
function requireVendorAuth(req, res, next) {
    const authHeader = req.headers["authorization"] || req.headers["x-secret-token"];
    if (!authHeader) {
        console.log("⛔ [VENDOR API] Request ditolak: Header Authorization / Secret-Token tidak ada.");
        return res.status(401).json({
            success: false,
            valid: false,
            reason: "UNAUTHORIZED",
            message: "Missing Authorization header or Secret-Token"
        });
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
    if (token !== VENDOR_SECRET_TOKEN) {
        console.log(`⛔ [VENDOR API] Request ditolak: Token tidak valid (${token}).`);
        return res.status(403).json({
            success: false,
            valid: false,
            reason: "FORBIDDEN",
            message: "Invalid Secret/Bearer Token"
        });
    }

    next();
}

// ENDPOINT REAL-TIME VALIDASI TIKET DARI UNITY / LOCAL SERVER
app.post("/api/v1/validate-ticket", requireVendorAuth, (req, res) => {
    const { code, deviceId } = req.body;
    console.log(`\n🔍 [VENDOR API] Validasi tiket dari device [${deviceId}]: code = "${code}"`);

    if (!code) {
        return res.status(400).json({
            success: false,
            valid: false,
            reason: "INVALID_PARAM",
            message: "Parameter 'code' wajib disertakan"
        });
    }

    const db = readVendorDB();
    const guest = db.find(g => g.qrCode === code);

    if (!guest) {
        console.log(`❌ [VENDOR API] Tiket "${code}" TIDAK TERDAFTAR di sistem vendor.`);
        return res.status(404).json({
            success: false,
            valid: false,
            reason: "NOT_FOUND",
            message: "Tiket tidak terdaftar di sistem vendor."
        });
    }

    if (guest.status === "USED" || (guest.maxPlay !== undefined && guest.maxPlay <= 0)) {
        console.log(`❌ [VENDOR API] Tiket "${code}" (${guest.name}) SUDAH HABIS / PERNAH DIGUNAKAN.`);
        return res.status(400).json({
            success: false,
            valid: false,
            reason: "ALREADY_USED",
            message: `Tiket milik ${guest.name} sudah pernah digunakan.`,
            data: {
                ticketId: guest.id,
                guestName: guest.name,
                ticketType: guest.ticketType,
                status: guest.status
            }
        });
    }

    console.log(`✅ [VENDOR API] Tiket VALID! Pengunjung: ${guest.name} (${guest.ticketType}), Sisa main: ${guest.maxPlay}x`);
    return res.json({
        success: true,
        valid: true,
        reason: "VALID",
        message: `Tiket valid untuk ${guest.name}`,
        data: {
            ticketId: String(guest.id),
            guestName: guest.name,
            company: guest.company,
            ticketType: guest.ticketType,
            remainingPlay: guest.maxPlay
        }
    });
});

// ENDPOINT KLAIM / GAME FINISH (Potong kuota / tandai status used)
app.post("/api/v1/claim-ticket", requireVendorAuth, (req, res) => {
    const { code, deviceId, score, isWin } = req.body;
    console.log(`\n🎟️ [VENDOR API] Claim tiket [${code}] dari device [${deviceId}], score: ${score}, isWin: ${isWin}`);

    const db = readVendorDB();
    const guest = db.find(g => g.qrCode === code);

    if (!guest) {
        return res.status(404).json({ success: false, message: "Tiket tidak ditemukan" });
    }

    // Kurangi jatah main
    if (guest.maxPlay > 1) {
        guest.maxPlay -= 1;
        console.log(`ℹ️ [VENDOR API] Kuota main ${guest.name} berkurang. Sisa: ${guest.maxPlay}x`);
    } else {
        guest.maxPlay = 0;
        guest.status = "USED";
        console.log(`🔒 [VENDOR API] Kuota main ${guest.name} habis. Status diubah menjadi USED.`);
    }

    writeVendorDB(db);

    return res.json({
        success: true,
        message: "Tiket berhasil di-claim di sistem vendor",
        data: {
            ticketId: guest.id,
            guestName: guest.name,
            status: guest.status,
            remainingPlay: guest.maxPlay
        }
    });
});

app.get("/api/get-all-tickets", (req, res) => {
    console.log("🏢 [VENDOR] Local Server sedang menarik (sync) data tiket...");
    res.json({
        success: true,
        message: "Data tiket berhasil ditarik",
        data: readVendorDB()
    });
});

// ==========================================
// 1b. QR CODE GENERATION
// ==========================================

// Generate QR Code image (PNG) untuk satu pengunjung
app.get("/qr/:id", async (req, res) => {
    let data = readVendorDB();
    let id = parseInt(req.params.id);
    let guest = data.find(p => p.id === id);

    if (!guest) {
        return res.status(404).json({ success: false, message: "Pengunjung tidak ditemukan" });
    }

    try {
        const qrBuffer = await QRCode.toBuffer(guest.qrCode, {
            type: "png",
            width: 400,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" }
        });
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Disposition", `inline; filename="${guest.qrCode}.png"`);
        res.send(qrBuffer);
    } catch (err) {
        res.status(500).json({ success: false, message: "Gagal generate QR code" });
    }
});

// Halaman cetak semua QR code sekaligus (print-ready)
app.get("/qr-all", async (req, res) => {
    let data = readVendorDB();

    let qrImages = [];
    for (let guest of data) {
        const dataUrl = await QRCode.toDataURL(guest.qrCode, {
            width: 200,
            margin: 2
        });
        qrImages.push({ ...guest, qrDataUrl: dataUrl });
    }

    let cards = qrImages.map(g => `
        <div class="qr-card">
            <img src="${g.qrDataUrl}" alt="${g.qrCode}">
            <div class="info">
                <b>${g.name}</b><br>
                <span class="qr-label">${g.qrCode}</span>
            </div>
        </div>
    `).join("");

    const html = `
    <html>
    <head>
        <title>Cetak QR Code Semua Pengunjung</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; padding: 20px; background: #fff; }
            h2 { text-align: center; margin-bottom: 20px; }
            .qr-grid {
                display: flex; flex-wrap: wrap; justify-content: center; gap: 20px;
            }
            .qr-card {
                width: 220px; border: 2px solid #333; border-radius: 10px;
                padding: 15px; text-align: center; background: #fff;
            }
            .qr-card img { width: 180px; height: 180px; }
            .info { margin-top: 10px; font-size: 14px; }
            .qr-label { font-size: 11px; color: #666; }
            @media print {
                body { padding: 10px; }
                .qr-card { page-break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <h2>QR Code Semua Pengunjung (${data.length} tiket)</h2>
        <div class="qr-grid">${cards}</div>
        <br><center><button onclick="window.print()">🖨️ Cetak Semua QR Code</button></center>
    </body>
    </html>
    `;
    res.send(html);
});

// ==========================================
// 2. DASHBOARD CRUD VENDOR (WEB BROWSER)
// ==========================================
app.get("/", (req, res) => {
    let data = readVendorDB();

    let rows = data.map(p => `
        <tr>
            <td>${p.id}</td>
            <td><b>${p.name}</b></td>
            <td>${p.company}</td>
            <td><code>${p.qrCode}</code></td>
            <td style="text-align:center"><a href="/qr/${p.id}" target="_blank"><img src="/qr/${p.id}" alt="QR ${p.name}" title="Klik untuk lihat QR besar" style="width:48px;height:48px;border:1px solid #ddd;border-radius:4px;"></a></td>
            <td>
                <span style="
                    background:${p.ticketType === 'VIP' ? '#ffd700' : '#6c757d'};
                    color:${p.ticketType === 'VIP' ? '#000' : '#fff'};
                    padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: bold;">
                    ${p.ticketType}
                </span>
            </td>
            <td style="text-align:center"><b>${p.maxPlay}x</b></td>
            <td><span style="color:green; font-weight:bold;">${p.status}</span></td>
            <td>
                <a class="delete" href="/delete/${p.id}" onclick="return confirm('Hapus tiket ${p.name}?')">❌ Hapus</a>
            </td>
        </tr>
    `).join("");

    const html = `
    <html>
    <head>
        <title>Dashboard Vendor Tiket</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; }
            h2 { color: #333; }
            table { border-collapse: collapse; width: 100%; margin-top: 15px; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
            th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 14px; }
            th { background-color: #343a40; color: white; }
            tr:hover { background: #f1f1f1; }
            .form-box { background: #fff; padding: 20px; border-radius: 8px; max-width: 500px; margin-bottom: 25px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
            .form-box h3 { margin-top: 0; }
            label { font-size: 13px; font-weight: bold; display: block; margin-top: 10px; }
            input, select { padding: 8px 10px; margin-top: 4px; width: 100%; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
            button { background: #28a745; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; margin-top: 15px; font-size: 14px; }
            button:hover { background: #218838; }
            a.delete { color: red; text-decoration: none; font-size: 13px; }
            a.delete:hover { text-decoration: underline; }
            .total { font-size: 13px; color: #555; margin-top: 5px; }
        </style>
    </head>
    <body>
        <h2>🏢 Dashboard Vendor Tiket (Simulasi)</h2>

        <div class="form-box">
            <h3>➕ Tambah Pengunjung Baru</h3>
            <form action="/add" method="POST">
                <label>Nama Pengunjung:</label>
                <input type="text" name="name" placeholder="Misal: Rina Marlina" required>

                <label>Perusahaan / Asal:</label>
                <input type="text" name="company" placeholder="Misal: PT. Maju Bersama">

                <label>QR Code Tiket:</label>
                <input type="text" value="Auto-generate: TPM-TANGGAL-NOURUT-CHECKSUM" disabled style="background:#eee; color:#666;">

                <label>Jenis Tiket:</label>
                <select name="ticketType">
                    <option value="REGULER">REGULER (Main 1x)</option>
                    <option value="VIP">VIP (Main lebih dari 1x)</option>
                </select>

                <label>Jumlah Kesempatan Main (Max Play):</label>
                <input type="number" name="maxPlay" value="1" min="1" max="10">

                <button type="submit">🎟️ Simpan & Terbitkan Tiket</button>
            </form>
        </div>

        <h3>📋 Daftar Tiket Diterbitkan</h3>
        <p class="total">Total: <b>${data.length}</b> tiket terdaftar</p>
        <div style="margin: 12px 0;">
            <a href="/qr-all" style="background:#007bff; color:white; padding:10px 20px; text-decoration:none; border-radius:4px; font-size:14px;">🖨️ Cetak Semua QR Code</a>
        </div>
        <table>
            <tr>
                <th>ID</th>
                <th>Nama</th>
                <th>Perusahaan</th>
                <th>QR Code</th>
                <th style="text-align:center">QR Image</th>
                <th>Jenis Tiket</th>
                <th>Max Play</th>
                <th>Status Awal</th>
                <th>Aksi</th>
            </tr>
            ${rows}
        </table>
    </body>
    </html>
    `;
    res.send(html);
});

// Proses Tambah Data
app.post("/add", (req, res) => {
    let data = readVendorDB();
    let newId = data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 101;

    data.push({
        id: newId,
        name: req.body.name,
        company: req.body.company || "-",
        qrCode: generateTicketQR(data),
        ticketType: req.body.ticketType || "REGULER",
        maxPlay: parseInt(req.body.maxPlay) || 1,
        status: "AVAILABLE"
    });

    writeVendorDB(data);
    const last = data[data.length - 1];
    console.log(`✅ [VENDOR] Tiket baru ditambahkan: ${last.name} (${last.qrCode})`);
    res.redirect("/");
});

// Proses Hapus Data
app.get("/delete/:id", (req, res) => {
    let data = readVendorDB();
    let id = parseInt(req.params.id);
    let target = data.find(p => p.id === id);

    data = data.filter(p => p.id !== id);
    writeVendorDB(data);
    console.log(`🗑️  [VENDOR] Tiket dihapus: ${target?.name} (${target?.qrCode})`);
    res.redirect("/");
});

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🏢 [VENDOR SERVER] Aktif!`);
    console.log(`Buka browser: http://localhost:${PORT}`);
    console.log(`Cetak QR    : http://localhost:${PORT}/qr-all`);
    console.log(`API Sync   : http://localhost:${PORT}/api/get-all-tickets`);
    console.log(`========================================\n`);
    readVendorDB(); // inisialisasi dummy data jika belum ada
});
