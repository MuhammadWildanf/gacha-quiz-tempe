const express = require("express");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const crypto = require("crypto");

const app = express();

const PORT = 4000;
const VENDOR_DB_FILE = path.join(__dirname, "vendor_db.json");
const DEVICES_DB_FILE = path.join(__dirname, "devices_db.json");

// Middleware untuk menangkap raw body buffer agar kalkulasi hash SHA-256 persis
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString("utf8");
    }
}));
app.use(express.urlencoded({ extended: true }));

// Kredensial Mock Akun Vendor
const EXPECTED_API_KEY = process.env.VENDOR_API_KEY || "mk_tempe_gacha_test";
const EXPECTED_SECRET = process.env.VENDOR_SECRET || "mock-vendor-secret-key-12345";

// ==========================================
// 0. HELPER DATABASE VENDOR & DEVICES
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

function readDevicesDB() {
    if (!fs.existsSync(DEVICES_DB_FILE)) {
        const initialDevices = {
            "gacha-001": {
                device_sn: "gacha-001",
                device_status: "ACTIVE", // Langsung ACTIVE untuk kemudahan tes lokal
                device_type: "GACHA",
                device_code: "GACHA-001",
                device_name: "Gacha Mesin Utama",
                config_version: "1.0",
                location_name: "Tempe Park Lobby",
                merchant: {
                    name: "Tempe Park"
                }
            }
        };
        writeDevicesDB(initialDevices);
        return initialDevices;
    }
    return JSON.parse(fs.readFileSync(DEVICES_DB_FILE));
}

function writeDevicesDB(data) {
    fs.writeFileSync(DEVICES_DB_FILE, JSON.stringify(data, null, 2));
}

// ==========================================
// 1. MIDDLEWARE AUTENTIKASI HMAC-SHA256 (DOKUMENTASI BAGIAN 3)
// ==========================================
function requireHmacAuth(req, res, next) {
    const apiKey = req.headers["x-api-key"];
    const timestamp = req.headers["x-timestamp"];
    const signature = req.headers["x-signature"];

    if (!apiKey || !timestamp || !signature) {
        console.log("⛔ [MOCK VENDOR] 401: missing authentication headers");
        return res.status(401).json({
            status: 401,
            message: "missing authentication headers",
            message_en: "missing authentication headers",
            data: {}
        });
    }

    if (apiKey !== EXPECTED_API_KEY) {
        console.log(`⛔ [MOCK VENDOR] 401: invalid credentials (unknown API Key: ${apiKey})`);
        return res.status(401).json({
            status: 401,
            message: "invalid credentials",
            message_en: "invalid credentials",
            data: {}
        });
    }

    const currentTs = Math.floor(Date.now() / 1000);
    const reqTs = parseInt(timestamp, 10);
    if (isNaN(reqTs) || Math.abs(currentTs - reqTs) > 300) {
        console.log(`⛔ [MOCK VENDOR] 401: invalid or expired timestamp (${reqTs} vs server ${currentTs})`);
        return res.status(401).json({
            status: 401,
            message: "invalid or expired timestamp",
            message_en: "invalid or expired timestamp",
            data: {}
        });
    }

    const bodyString = req.rawBody || "";
    const bodyHash = crypto.createHash("sha256").update(bodyString, "utf8").digest("hex");
    const toSign = [timestamp, req.method.toUpperCase(), req.path, bodyHash].join("\n");
    const expectedSig = crypto.createHmac("sha256", EXPECTED_SECRET).update(toSign, "utf8").digest("hex");

    if (signature.toLowerCase() !== expectedSig.toLowerCase()) {
        console.log(`⛔ [MOCK VENDOR] 401: signature mismatch!`);
        console.log(`   Client Sig  : ${signature}`);
        console.log(`   Expected Sig: ${expectedSig}`);
        console.log(`   To Sign     :\n${toSign}`);
        return res.status(401).json({
            status: 401,
            message: "invalid credentials",
            message_en: "invalid credentials",
            data: {}
        });
    }

    next();
}

// ==========================================
// 2. ENDPOINT SESUAI SPESIFIKASI RESMI VENDOR v1.0
// ==========================================

// 5.1 POST /api/public/device/request
app.post("/api/public/device/request", requireHmacAuth, (req, res) => {
    const { device_sn } = req.body;
    if (!device_sn || typeof device_sn !== "string" || device_sn.length < 3 || device_sn.length > 100) {
        return res.status(400).json({
            status: 400,
            message: "device_sn tidak valid",
            message_en: "invalid device_sn",
            data: {}
        });
    }

    const devices = readDevicesDB();
    if (devices[device_sn]) {
        console.log(`ℹ️ [MOCK VENDOR] Device ${device_sn} sudah terdaftar. Status: ${devices[device_sn].device_status}`);
        return res.status(200).json({
            status: 200,
            message: "sukses",
            message_en: "success",
            data: {
                device_sn: device_sn,
                device_status: devices[device_sn].device_status
            }
        });
    }

    // Daftarkan sebagai PENDING
    devices[device_sn] = {
        device_sn,
        device_status: "PENDING",
        device_type: "GACHA",
        device_code: `GACHA-${device_sn.toUpperCase()}`,
        device_name: `Gacha ${device_sn}`,
        config_version: "1.0",
        location_name: "Tempe Park Area",
        merchant: {
            name: "Tempe Park"
        }
    };
    writeDevicesDB(devices);
    console.log(`📝 [MOCK VENDOR] Device ${device_sn} berhasil didaftarkan (Status: PENDING)`);

    return res.status(201).json({
        status: 201,
        message: "sukses",
        message_en: "success",
        data: {
            device_sn: device_sn,
            device_status: "PENDING"
        }
    });
});

// 5.2 POST /api/public/device/config
app.post("/api/public/device/config", requireHmacAuth, (req, res) => {
    const { device_sn } = req.body;
    const devices = readDevicesDB();
    const dev = devices[device_sn];

    if (!dev) {
        console.log(`❌ [MOCK VENDOR] Device ${device_sn} tidak ditemukan (404)`);
        return res.status(404).json({
            status: 404,
            message: "Device tidak ditemukan",
            message_en: "device not found",
            data: {}
        });
    }

    if (dev.device_status === "PENDING") {
        console.log(`⏳ [MOCK VENDOR] Config device ${device_sn} dicek: status masih PENDING`);
        return res.status(200).json({
            status: 200,
            message: "sukses",
            message_en: "success",
            data: {
                device_status: "PENDING",
                device_sn: dev.device_sn,
                device_type: dev.device_type
            }
        });
    }

    console.log(`✅ [MOCK VENDOR] Config device ${device_sn} dikembalikan (ACTIVE)`);
    return res.status(200).json({
        status: 200,
        message: "sukses",
        message_en: "success",
        data: {
            device_status: dev.device_status,
            device_sn: dev.device_sn,
            device_type: dev.device_type,
            device_code: dev.device_code,
            device_name: dev.device_name,
            config_version: dev.config_version,
            location_name: dev.location_name,
            merchant: dev.merchant
        }
    });
});

// Cache untuk idempotensi retry 60 detik (Spesifikasi Bagian 5.3)
const recentValidations = new Map();

// 5.3 POST /api/public/ticket/validate
app.post("/api/public/ticket/validate", requireHmacAuth, (req, res) => {
    const { qr_code, device_sn } = req.body;
    console.log(`\n🔍 [MOCK VENDOR] Request validate ticket: QR="${qr_code}", Device="${device_sn}"`);

    if (!qr_code || !device_sn) {
        return res.status(400).json({
            status: 400,
            message: "qr_code dan device_sn wajib diisi",
            message_en: "qr_code and device_sn are required",
            data: {}
        });
    }

    const devices = readDevicesDB();
    const dev = devices[device_sn];
    if (!dev) {
        return res.status(404).json({
            status: 404,
            message: "Device tidak ditemukan",
            message_en: "device not found",
            data: {}
        });
    }

    if (dev.device_status !== "ACTIVE") {
        return res.status(403).json({
            status: 403,
            message: "Device belum aktif",
            message_en: "device is pending",
            data: {}
        });
    }

    // Cek idempotensi retry dalam rentang 60 detik
    const now = Date.now();
    if (recentValidations.has(qr_code)) {
        const lastEntry = recentValidations.get(qr_code);
        if (now - lastEntry.time < 60000) {
            console.log(`🔁 [MOCK VENDOR] Idempotent retry untuk QR="${qr_code}" dalam 60s -> return 200 OK.`);
            return res.status(200).json(lastEntry.response);
        }
    }

    const db = readVendorDB();
    const guest = db.find(g => g.qrCode === qr_code);

    if (!guest) {
        console.log(`❌ [MOCK VENDOR] Tiket tidak ditemukan: ${qr_code}`);
        return res.status(404).json({
            status: 404,
            message: "Tiket tidak ditemukan",
            message_en: "ticket not found",
            data: {}
        });
    }

    if (guest.status === "USED" || (guest.maxPlay !== undefined && guest.maxPlay <= 0)) {
        console.log(`❌ [MOCK VENDOR] Tiket sudah divalidasi / digunakan (409): ${guest.name}`);
        return res.status(409).json({
            status: 409,
            message: "Tiket sudah divalidasi / sudah digunakan",
            message_en: "ticket already used",
            data: {}
        });
    }

    // Potong kuota main atau tandai used
    if (guest.maxPlay > 1) {
        guest.maxPlay -= 1;
    } else {
        guest.maxPlay = 0;
        guest.status = "USED";
    }
    writeVendorDB(db);

    const nowFormatted = new Date().toISOString().replace("T", " ").substring(0, 19);
    const todayFormatted = nowFormatted.substring(0, 10);

    const responseData = {
        status: 200,
        message: "success",
        message_en: "",
        validation: {},
        data: {
            tickets: [
                {
                    ticket_name: guest.ticketType === "VIP" ? "Tiket VIP Tempe" : "Tiket Masuk Reguler",
                    visit_date: todayFormatted,
                    validated_at: nowFormatted
                }
            ]
        }
    };

    recentValidations.set(qr_code, {
        time: now,
        response: responseData
    });

    console.log(`✅ [MOCK VENDOR] Validasi BERHASIL untuk: ${guest.name} (${guest.ticketType})`);
    return res.status(200).json(responseData);
});

// Endpoint reset status tiket test (agar test script bisa dijalankan berulang-ulang)
app.get("/api/mock/reset-test-ticket", (req, res) => {
    const db = readVendorDB();
    const t = db.find(g => g.qrCode === "TIK-REG-003");
    if (t) {
        t.status = "AVAILABLE";
        t.maxPlay = 1;
        writeVendorDB(db);
    }
    res.send("Reset OK");
});

// Endpoint switch status device di mock server (untuk simulasi PENDING -> ACTIVE di pengujian)
app.get("/api/mock/toggle-device/:sn", (req, res) => {
    const { sn } = req.params;
    const devices = readDevicesDB();
    if (!devices[sn]) {
        return res.status(404).send("Device not found in DB");
    }
    devices[sn].device_status = devices[sn].device_status === "ACTIVE" ? "PENDING" : "ACTIVE";
    writeDevicesDB(devices);
    res.send(`Device ${sn} status now: ${devices[sn].device_status}`);
});

// ==========================================
// 3. DASHBOARD HTML & CETAK QR CODE
// ==========================================
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

    let lastSeq = 0;
    for (let p of data) {
        const match = String(p.qrCode || "").match(/TPM-\d{6}-(\d{6})-/);
        if (match) lastSeq = Math.max(lastSeq, parseInt(match[1]));
    }
    const seq = String(lastSeq + 1).padStart(6, "0");
    const checksum = computeChecksum(yymmdd, seq);
    return `TPM-${yymmdd}-${seq}-${checksum}`;
}

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

app.get("/qr-all", async (req, res) => {
    let data = readVendorDB();
    let qrImages = [];
    for (let guest of data) {
        const dataUrl = await QRCode.toDataURL(guest.qrCode, { width: 200, margin: 2 });
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

    res.send(`
    <html>
    <head>
        <title>Cetak QR Code</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #fff; text-align: center; }
            .qr-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; }
            .qr-card { width: 220px; border: 2px solid #333; border-radius: 10px; padding: 15px; }
            .qr-card img { width: 180px; height: 180px; }
        </style>
    </head>
    <body>
        <h2>QR Code (${data.length} tiket)</h2>
        <div class="qr-grid">${cards}</div>
        <br><button onclick="window.print()">🖨️ Cetak</button>
    </body>
    </html>
    `);
});

app.get("/", (req, res) => {
    let data = readVendorDB();
    let devices = readDevicesDB();

    let devRows = Object.values(devices).map(d => `
        <tr>
            <td><b>${d.device_sn}</b></td>
            <td><span style="color:${d.device_status === 'ACTIVE' ? 'green' : 'orange'}; font-weight:bold;">${d.device_status}</span></td>
            <td>${d.device_name || "-"}</td>
            <td>${d.location_name || "-"}</td>
            <td><a href="/api/mock/toggle-device/${d.device_sn}">[Toggle Active/Pending]</a></td>
        </tr>
    `).join("");

    let rows = data.map(p => `
        <tr>
            <td>${p.id}</td>
            <td><b>${p.name}</b></td>
            <td>${p.company}</td>
            <td><code>${p.qrCode}</code></td>
            <td style="text-align:center"><a href="/qr/${p.id}" target="_blank"><img src="/qr/${p.id}" style="width:48px;height:48px;"></a></td>
            <td>${p.ticketType}</td>
            <td>${p.maxPlay}x</td>
            <td><span style="color:${p.status === 'AVAILABLE' ? 'green' : 'red'}; font-weight:bold;">${p.status}</span></td>
            <td><a href="/delete/${p.id}" onclick="return confirm('Hapus tiket?')">❌ Hapus</a></td>
        </tr>
    `).join("");

    res.send(`
    <html>
    <head>
        <title>Mock Vendor API v1.0</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; }
            table { border-collapse: collapse; width: 100%; margin-top: 15px; background: #fff; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; font-size: 14px; }
            th { background-color: #343a40; color: white; }
            .box { background: #fff; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            button { background: #28a745; color: white; border: none; padding: 8px 16px; cursor: pointer; border-radius: 4px; }
        </style>
    </head>
    <body>
        <h2>🏢 Mock Server Vendor API v1.0 (HMAC-SHA256 Auth)</h2>

        <div class="box">
            <h3>📱 Status Devices</h3>
            <table>
                <tr><th>Serial Number</th><th>Status</th><th>Nama Mesin</th><th>Lokasi</th><th>Aksi</th></tr>
                ${devRows}
            </table>
        </div>

        <div class="box">
            <h3>🎟️ Terbitkan Tiket Baru</h3>
            <form action="/add" method="POST">
                Nama: <input type="text" name="name" required>
                Tipe: <select name="ticketType"><option value="REGULER">REGULER</option><option value="VIP">VIP</option></select>
                Max Play: <input type="number" name="maxPlay" value="1" min="1" max="10">
                <button type="submit">Terbitkan</button>
            </form>
        </div>

        <div class="box">
            <h3>📋 Daftar Tiket Pengunjung</h3>
            <div style="margin-bottom:10px;"><a href="/qr-all" target="_blank">🖨️ Cetak Semua QR</a></div>
            <table>
                <tr><th>ID</th><th>Nama</th><th>Perusahaan</th><th>QR Code</th><th>QR Image</th><th>Tipe</th><th>Sisa Main</th><th>Status</th><th>Aksi</th></tr>
                ${rows}
            </table>
        </div>
    </body>
    </html>
    `);
});

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
    res.redirect("/");
});

app.get("/delete/:id", (req, res) => {
    let data = readVendorDB();
    let id = parseInt(req.params.id);
    data = data.filter(p => p.id !== id);
    writeVendorDB(data);
    res.redirect("/");
});

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🏢 [MOCK VENDOR SERVER v1.0] Aktif di http://localhost:${PORT}`);
    console.log(`Endpoint:`);
    console.log(`  POST /api/public/device/request`);
    console.log(`  POST /api/public/device/config`);
    console.log(`  POST /api/public/ticket/validate`);
    console.log(`========================================\n`);
    readVendorDB();
    readDevicesDB();
});
