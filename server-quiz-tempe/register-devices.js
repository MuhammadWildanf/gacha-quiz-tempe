const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const VendorClient = require("./vendor-client");

async function registerAll() {
    console.log("==========================================");
    console.log("🚀 PENDAFTARAN RESMI DEVICE KE VENDOR API");
    console.log("==========================================");

    const baseUrl = process.env.VENDOR_BASE_URL || "http://localhost:4000";
    const apiKey = process.env.VENDOR_API_KEY;
    const secret = process.env.VENDOR_SECRET;
    const deviceSns = process.env.DEVICE_SNS || "gacha-001,gacha-002,gacha-003";

    console.log("Base URL   :", baseUrl);
    console.log("API Key    :", apiKey ? `${apiKey.substring(0, 10)}...` : "(belum diisi)");
    console.log("Daftar SN  :", deviceSns);
    console.log("------------------------------------------");

    if (!apiKey || !secret) {
        console.error("❌ ERROR: VENDOR_API_KEY atau VENDOR_SECRET belum diisi di file .env!");
        process.exit(1);
    }

    const client = new VendorClient({
        baseUrl,
        apiKey,
        secret,
        deviceSns
    });

    console.log(`\n⏳ Mendaftarkan total ${client.deviceList.length} device sekaligus ke vendor...\n`);

    for (let i = 0; i < client.deviceList.length; i++) {
        const sn = client.deviceList[i];
        console.log(`[${i + 1}/${client.deviceList.length}] Mengirim request pendaftaran untuk: ${sn}`);
        const res = await client.requestDevice(sn);
        console.log(`       Status Response: ${res.status} (${res.message || res.message_en || "OK"})`);
        console.log(`       Device Status  : ${client.devices[sn]?.status || "PENDING"}\n`);
    }

    console.log("==========================================");
    console.log("✅ PENDAFTARAN SELESAI!");
    console.log("Silakan kabari vendor agar mengaktifkan (ACTIVE) nomor seri tersebut:");
    console.log(`👉 ${client.deviceList.join(", ")}`);
    console.log("==========================================");
}

registerAll().catch(console.error);
