const crypto = require("crypto");

/**
 * Client untuk berkomunikasi dengan Vendor API Spesifikasi v1.0
 * Menggunakan otentikasi HMAC-SHA256 (X-Api-Key, X-Timestamp, X-Signature)
 * Mendukung multiple device_sn (misal: gacha-001, gacha-002, dst).
 */
class VendorClient {
    constructor(config = {}) {
        this.baseUrl = (config.baseUrl || "http://localhost:4000").replace(/\/+$/, "");
        this.apiKey = config.apiKey || "";
        this.secret = config.secret || "";

        // Daftar serial number device
        const rawSns = config.deviceSns || config.deviceSn || "gacha-001";
        this.deviceList = (Array.isArray(rawSns) ? rawSns : rawSns.split(","))
            .map(s => s.trim())
            .filter(Boolean);

        if (this.deviceList.length === 0) {
            this.deviceList = ["gacha-001"];
        }

        // Status per device: { "gacha-001": { status: "PENDING", config: null }, ... }
        this.devices = {};
        for (const sn of this.deviceList) {
            this.devices[sn] = {
                status: "UNKNOWN",
                config: null
            };
        }

        this.pollInterval = null;
    }

    /**
     * Memanggil endpoint vendor dengan HMAC-SHA256 Signature
     */
    async call(path, payload = {}) {
        const bodyString = JSON.stringify(payload);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const method = "POST";

        // Hash SHA-256 dari body string (hex lowercase)
        const bodyHash = crypto.createHash("sha256").update(bodyString, "utf8").digest("hex");

        // Susun string to sign 4 baris: <timestamp>\n<METHOD>\n<path>\n<hash body>
        const toSign = [timestamp, method, path, bodyHash].join("\n");

        // Hitung HMAC-SHA256 signature
        const signature = crypto.createHmac("sha256", this.secret).update(toSign, "utf8").digest("hex");

        const url = `${this.baseUrl}${path}`;
        const headers = {
            "Content-Type": "application/json",
            "X-Api-Key": this.apiKey,
            "X-Timestamp": timestamp,
            "X-Signature": signature
        };

        const response = await fetch(url, {
            method,
            headers,
            body: bodyString,
            signal: AbortSignal.timeout(10000)
        });

        let json = {};
        try {
            json = await response.json();
        } catch (e) {
            json = { status: response.status, message: "Non-JSON response from server" };
        }

        return {
            httpStatus: response.status,
            ...json
        };
    }

    /**
     * 5.1 POST /api/public/device/request
     * Mendaftarkan satu device_sn ke vendor
     */
    async requestDevice(deviceSn) {
        const sn = deviceSn || this.deviceList[0];
        try {
            console.log(`📱 [VENDOR API] Mendaftarkan device: ${sn}...`);
            const res = await this.call("/api/public/device/request", {
                device_sn: sn
            });

            if (!this.devices[sn]) {
                this.devices[sn] = { status: "UNKNOWN", config: null };
            }

            if (res.status === 201 || res.status === 200) {
                this.devices[sn].status = res.data?.device_status || "PENDING";
                console.log(`✅ [VENDOR API] Device ${sn} terdaftar. Status: ${this.devices[sn].status}`);
            } else {
                console.error(`⚠️ [VENDOR API] Gagal request device ${sn} (${res.status}): ${res.message || res.message_en}`);
            }
            return res;
        } catch (err) {
            console.error(`❌ [VENDOR API] Error saat request device ${sn}: ${err.message}`);
            return { status: 500, message: err.message };
        }
    }

    /**
     * Mendaftarkan seluruh device di daftar sekaligus
     */
    async requestAllDevices() {
        for (const sn of this.deviceList) {
            await this.requestDevice(sn);
        }
    }

    /**
     * 5.2 POST /api/public/device/config
     * Mengambil status & konfigurasi satu device
     */
    async getDeviceConfig(deviceSn) {
        const sn = deviceSn || this.deviceList[0];
        try {
            const res = await this.call("/api/public/device/config", {
                device_sn: sn
            });

            if (!this.devices[sn]) {
                this.devices[sn] = { status: "UNKNOWN", config: null };
            }

            if (res.status === 200 && res.data) {
                this.devices[sn].status = res.data.device_status;
                if (res.data.device_status === "ACTIVE") {
                    this.devices[sn].config = res.data;
                    console.log(`🎉 [VENDOR API] Device ${sn} ACTIVE! (${res.data.device_name || "-"} @ ${res.data.location_name || "-"})`);
                }
            }
            return res;
        } catch (err) {
            console.error(`❌ [VENDOR API] Error saat cek config device ${sn}: ${err.message}`);
            return { status: 500, message: err.message };
        }
    }

    /**
     * Polling device config untuk semua device yang statusnya belum ACTIVE.
     * Otomatis berhenti ketika semua device sudah ACTIVE.
     */
    startConfigPolling(intervalSeconds = 30) {
        if (this.pollInterval) clearInterval(this.pollInterval);

        const checkAll = async () => {
            const pendingList = this.deviceList.filter(sn => this.devices[sn]?.status !== "ACTIVE");
            if (pendingList.length === 0) {
                console.log(`🔒 [VENDOR API] Semua device sudah ACTIVE (${this.deviceList.join(", ")}). Polling dihentikan.`);
                clearInterval(this.pollInterval);
                this.pollInterval = null;
                return;
            }

            console.log(`⏳ [VENDOR API] Memeriksa status device belum aktif: ${pendingList.join(", ")}...`);
            for (const sn of pendingList) {
                await this.getDeviceConfig(sn);
            }
        };

        checkAll();
        this.pollInterval = setInterval(checkAll, intervalSeconds * 1000);
    }

    /**
     * 5.3 POST /api/public/ticket/validate
     * Memvalidasi tiket QR pengunjung untuk device tertentu
     */
    async validateTicket(qrCode, targetDeviceSn) {
        // Jika target device tidak ditentukan, gunakan device pertama
        const deviceSn = targetDeviceSn || this.deviceList[0];

        try {
            console.log(`🔍 [VENDOR API] Memvalidasi tiket: ${qrCode} (Device: ${deviceSn})...`);
            const res = await this.call("/api/public/ticket/validate", {
                qr_code: qrCode,
                device_sn: deviceSn
            });

            if (res.status === 200) {
                const ticketInfo = res.data?.tickets?.[0] || {};
                return {
                    success: true,
                    valid: true,
                    httpStatus: 200,
                    message: res.message || "Tiket valid",
                    data: {
                        ticketId: qrCode,
                        ticketName: ticketInfo.ticket_name || "Tiket Masuk",
                        visitDate: ticketInfo.visit_date,
                        validatedAt: ticketInfo.validated_at,
                        deviceSn: deviceSn
                    }
                };
            }

            // Penolakan tiket
            let reason = "INVALID_TICKET";
            if (res.status === 409) reason = "ALREADY_USED";
            else if (res.status === 404) reason = "NOT_FOUND";
            else if (res.status === 403) reason = "DEVICE_NOT_ACTIVE";

            return {
                success: false,
                valid: false,
                httpStatus: res.status,
                reason,
                message: res.message || res.message_en || "Tiket tidak dapat digunakan."
            };
        } catch (err) {
            console.error(`❌ [VENDOR API] Error saat validasi tiket: ${err.message}`);
            return {
                success: false,
                valid: false,
                httpStatus: 500,
                reason: "VENDOR_API_ERROR",
                message: `Gagal terhubung ke API Vendor (${err.message})`
            };
        }
    }
}

module.exports = VendorClient;
