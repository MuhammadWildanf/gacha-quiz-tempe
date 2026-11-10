const VendorClient = require("./vendor-client");

async function runTest() {
    console.log("=== MEMULAI TEST INTEGRASI CLIENT VENDOR ===");

    const client = new VendorClient({
        baseUrl: "http://localhost:4000",
        apiKey: "mk_tempe_gacha_test",
        secret: "mock-vendor-secret-key-12345",
        deviceSn: "gacha-001"
    });

    // 0. Auto-reset tiket test agar TEST 3 selalu berhasil (AVAILABLE)
    try {
        await fetch("http://localhost:4000/api/mock/reset-test-ticket");
    } catch (e) {}

    // 1. Test Device Request
    console.log("\n--- TEST 1: DEVICE REQUEST ---");
    const reqRes = await client.requestDevice("gacha-001");
    console.log("Status:", reqRes.status, reqRes.message);

    // 2. Test Device Config
    console.log("\n--- TEST 2: DEVICE CONFIG ---");
    const confRes = await client.getDeviceConfig("gacha-001");
    console.log("Device status:", client.devices["gacha-001"]?.status);

    // 3. Test Validate Ticket (Valid)
    console.log("\n--- TEST 3: VALIDATE TICKET (VALID) ---");
    const valRes = await client.validateTicket("TIK-REG-003");
    console.log("Result:", valRes);

    // 4. Test Tiket Sudah Digunakan (409)
    console.log("\n--- TEST 4: VALIDATE TICKET USED (SHOULD BE 409) ---");
    const valResUsed = await client.validateTicket("TIK-USED-004");
    console.log("Result (expected 409):", valResUsed);

    // Simulasi scan tiket tidak dikenal
    console.log("\n--- TEST 5: UNKNOWN TICKET (404) ---");
    const valResUnknown = await client.validateTicket("QR-TIDAK-ADA");
    console.log("Result (expected 404):", valResUnknown);

    console.log("\n=== TEST INTEGRASI CLIENT SELESAI ===");
}

if (require.main === module) {
    runTest().catch(console.error);
}
