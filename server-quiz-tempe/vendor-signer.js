const crypto = require("crypto");

/**
 * Helper untuk menghitung SHA-256 hash dan HMAC-SHA256 signature sesuai spesifikasi vendor v1.0.
 *
 * String to sign (4 baris dipisah \n):
 * <timestamp>
 * <METHOD>
 * <path>
 * <hash body>
 */
function hashBody(bodyString) {
    return crypto.createHash("sha256").update(bodyString, "utf8").digest("hex");
}

function generateSignature(secret, timestamp, method, path, bodyString) {
    const bodyHash = hashBody(bodyString);
    const toSign = [timestamp, method.toUpperCase(), path, bodyHash].join("\n");
    const signature = crypto.createHmac("sha256", secret).update(toSign, "utf8").digest("hex");
    return {
        bodyHash,
        toSign,
        signature
    };
}

// ========================================================
// TEST VECTOR SESUAI DOKUMENTASI BAGIAN 3.3
// ========================================================
function runTestVector() {
    const testSecret = "test-secret-123";
    const testTimestamp = "1700000000";
    const testMethod = "POST";
    const testPath = "/api/public/device/config";
    const testBody = JSON.stringify({ device_sn: "gacha-test-001" });

    const expectedBodyHash = "b0eaef0b24e40385288c269fe5117df0e7cb96d24d2aace79073ff9b67468e27";
    const expectedSignature = "200174790c5d1a9691e42eefb88a46a4615e2aea5394f86492d122ce45f179f6";

    console.log("=== PENGUJIAN TEST VECTOR VENDOR ===");
    console.log("Secret   :", testSecret);
    console.log("Timestamp:", testTimestamp);
    console.log("Path     :", testPath);
    console.log("Body     :", testBody);

    const result = generateSignature(testSecret, testTimestamp, testMethod, testPath, testBody);

    console.log("\nHasil Body Hash :");
    console.log("  Actual  :", result.bodyHash);
    console.log("  Expected:", expectedBodyHash);
    const hashMatch = result.bodyHash === expectedBodyHash;
    console.log("  Match?  :", hashMatch ? "✅ PASSED" : "❌ FAILED");

    console.log("\nHasil Signature :");
    console.log("  Actual  :", result.signature);
    console.log("  Expected:", expectedSignature);
    const sigMatch = result.signature === expectedSignature;
    console.log("  Match?  :", sigMatch ? "✅ PASSED" : "❌ FAILED");

    return hashMatch && sigMatch;
}

if (require.main === module) {
    const passed = runTestVector();
    if (!passed) {
        process.exit(1);
    }
}

module.exports = {
    hashBody,
    generateSignature
};
