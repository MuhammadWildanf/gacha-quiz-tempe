using System;
using System.IO.Ports;
using System.Threading;
using UnityEngine;

/// <summary>
/// BallDispenserManager
/// Script singleton untuk komunikasi Serial USB antara game Unity dan hardware Ball Dispenser (ESP32).
/// Mendukung Auto-Detect COM Port dan thread-safe triggering.
/// </summary>
public class BallDispenserManager : MonoBehaviour
{
    public static BallDispenserManager Instance { get; private set; }

    [Header("Serial Configuration")]
    [Tooltip("Jika centang aktif, script akan otomatis memilih COM Port pertama yang aktif.")]
    [SerializeField] private bool autoDetectPort = true;

    [Tooltip("COM Port manual jika autoDetect dimatikan, misal: COM3, COM4, dsb.")]
    [SerializeField] private string fallbackPortName = "COM3";

    [Tooltip("Baud rate ESP32 controller (Default: 115200).")]
    [SerializeField] private int baudRate = 115200;

    [Header("Stok Bola (tabung fisik = angka sistem)")]
    [Tooltip("Isi sesuai bola di tabung (misal 50). Berkurang 1 tiap PUSH menang. 0 = tolak trigger.")]
    [SerializeField] private int ballStock = 50;
    [Tooltip("Batas peringatan stok menipis.")]
    [SerializeField] private int lowStockThreshold = 5;

    [Header("Debug Status")]
    [SerializeField] private bool isConnected = false;
    [SerializeField] private string activePort = "";

    /// <summary>Sisa stok. Bind ke UI via GachaSession.OnStockChanged atau baca GetStock().</summary>
    public event System.Action<int> StockChanged;

    private SerialPort serialPort;
    private readonly object lockObject = new object();

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);
        // Override default Inspector dengan setting per mesin (PlayerPrefs) bila ada.
        try
        {
            MachineConfig stored = SettingsStore.Load(new MachineConfig
            {
                dispenserPort = fallbackPortName,
                dispenserAutoDetect = autoDetectPort,
                dispenserBaudRate = baudRate,
                ballStock = ballStock,
                ballLowThreshold = lowStockThreshold
            });
            fallbackPortName = stored.dispenserPort;
            autoDetectPort = stored.dispenserAutoDetect;
            baudRate = stored.dispenserBaudRate;
            ballStock = Mathf.Max(0, stored.ballStock);
            lowStockThreshold = Mathf.Max(0, stored.ballLowThreshold);
        }
        catch (System.Exception e) { Debug.LogWarning("[Dispenser] [BOOT] Gagal load setting COM: " + e.Message); }
        Debug.Log($"[Dispenser] [BOOT] Inisialisasi... autoDetect={autoDetectPort} fallback={fallbackPortName} baud={baudRate} stok={ballStock}");
        InitializeSerialConnection();
    }

    /// <summary>
    /// Ubah konfigurasi serial saat runtime (dari panel pengaturan) lalu buka ulang port.
    /// Dipakai SettingsPanel agar ganti COM tidak perlu rebuild/restart.
    /// </summary>
    public void SetSerialConfig(string portName, bool autoDetect, int baud)
    {
        if (!string.IsNullOrWhiteSpace(portName)) fallbackPortName = portName.Trim();
        autoDetectPort = autoDetect;
        if (baud > 0) baudRate = baud;
        InitializeSerialConnection();
    }

    /// <summary>
    /// Daftar COM yang terlihat sistem saat ini (untuk dropdown panel pengaturan).
    /// </summary>
    public static string[] GetAvailablePorts()
    {
        try { return SerialPort.GetPortNames(); }
        catch { return new string[0]; }
    }

    /// <summary>
    /// Memulai inisialisasi koneksi Serial Port.
    /// </summary>
    public void InitializeSerialConnection()
    {
        ClosePort();

        string[] availablePorts = SerialPort.GetPortNames();
        Debug.Log($"[Dispenser] [1/3] Cari COM... ketemu {availablePorts.Length}: {(availablePorts.Length > 0 ? string.Join(",", availablePorts) : "(kosong)")}");

        if (availablePorts.Length == 0)
        {
            Debug.LogWarning("[Dispenser] [1/3] ❌ Tidak ada COM port terdeteksi! Colok kabel data ESP32, bukan kabel charger.");
            isConnected = false;
            activePort = "None";
            return;
        }

        string targetPort = fallbackPortName;

        if (autoDetectPort)
        {
            // Ambil COM Port pertama yang tersedia
            targetPort = availablePorts[0];
        }
        else
        {
            // Validasi apakah fallback port ada di daftar sistem
            if (!Array.Exists(availablePorts, p => p.Equals(fallbackPortName, StringComparison.OrdinalIgnoreCase)))
            {
                Debug.LogWarning($"[Dispenser] [2/3] Port {fallbackPortName} tidak ada di sistem. Pakai fallback: {availablePorts[0]}");
                targetPort = availablePorts[0];
            }
        }

        Debug.Log($"[Dispenser] [2/3] Membuka {targetPort} baud {baudRate} ...");
        try
        {
            serialPort = new SerialPort(targetPort, baudRate)
            {
                ReadTimeout = 500,
                WriteTimeout = 1000,
                DtrEnable = true, // Menjaga stabilitas handshake USB Serial
                RtsEnable = true
            };

            serialPort.Open();
            try { serialPort.DiscardInBuffer(); } catch { }
            try { serialPort.DiscardOutBuffer(); } catch { }
            isConnected = true;
            activePort = targetPort;
            Debug.Log($"[Dispenser] [3/3] ✅ Terhubung via {targetPort} (baud {baudRate}) — siap terima PUSH.");
        }
        catch (Exception ex)
        {
            isConnected = false;
            activePort = "Error";
            Debug.LogError($"[Dispenser] [2/3] ❌ Gagal buka {targetPort}: {ex.Message}");
        }
    }

    /// <summary>
    /// Panggil fungsi ini dari script game saat event menang / vault terbuka.
    /// Contoh: BallDispenserManager.Instance.TriggerDispenser();
    /// CATATAN: versi mentah tanpa cek stok (dipakai tombol Test).
    /// Untuk game menang pakai TryTriggerWithStock() agar stok ikut berkurang 1.
    /// </summary>
    public void TriggerDispenser()
    {
        if (!isConnected || serialPort == null || !serialPort.IsOpen)
        {
            Debug.LogWarning($"[Dispenser] [KIRIM] ❌ Gagal trigger: port tidak tersambung (activePort={activePort}). Cek kabel + COM.");
            return;
        }

        Debug.Log($"[Dispenser] [KIRIM] 📤 Antri PUSH via {activePort} ...");
        // Kirim perintah trigger di thread background agar tidak blocking frame rate game
        string portSnapshot = activePort;
        ThreadPool.QueueUserWorkItem(_ =>
        {
            lock (lockObject)
            {
                try
                {
                    // Cek ulang DI DALAM lock: port bisa ditutup/reopen
                    // (Save panel / cabut USB) antara cek awal dan eksekusi.
                    var sp = serialPort;
                    if (sp == null || !sp.IsOpen)
                    {
                        Debug.LogWarning($"[Dispenser] [KIRIM] ❌ Gagal: port {portSnapshot} tertutup saat eksekusi (cek kabel/COM).");
                        return;
                    }
                    try { sp.DiscardOutBuffer(); } catch { }
                    try
                    {
                        sp.WriteLine("PUSH");
                        Debug.Log($"[Dispenser] [KIRIM] ✅ 'PUSH' terkirim ke ESP32 via {portSnapshot}. Tunggu bola keluar.");
                    }
                    catch (TimeoutException)
                    {
                        Debug.LogWarning($"[Dispenser] [KIRIM] ⏳ Timeout/buffer penuh via {portSnapshot} — retry 1x setelah 150ms...");
                        // Buffer penuh / ESP32 sibuk (motor jalan / reboot):
                        // coba sekali lagi setelah jeda singkat.
                        try
                        {
                            Thread.Sleep(150);
                            if (sp == null || !sp.IsOpen) return;
                            sp.WriteLine("PUSH");
                            Debug.Log($"[Dispenser] [KIRIM] ✅ 'PUSH' terkirim via {portSnapshot} (retry 1x). Tunggu bola keluar.");
                        }
                        catch (Exception ex2)
                        {
                            Debug.LogError($"[Dispenser] [KIRIM] ❌ Gagal setelah retry via {portSnapshot}: {ex2.Message}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[Dispenser] [KIRIM] ❌ Gagal kirim serial via {portSnapshot}: {ex.Message}");
                }
            }
        });
    }

    /// <summary>
    /// Cek status apakah hardware saat ini terhubung.
    /// </summary>
    public bool IsHardwareConnected()
    {
        return isConnected && serialPort != null && serialPort.IsOpen;
    }

    // ------------------------------------------------ STOK BOLA
    // Stok otoritatif per mesin (PlayerPrefs). Samakan dengan isi tabung fisik.
    // Hanya berkurang lewat TryTriggerWithStock() = menang beneran.
    // Tombol Test / TriggerDispenser() mentah TIDAK mengurangi stok.
    // ------------------------------------------------
    public int GetStock()
    {
        lock (lockObject) { return ballStock; }
    }

    public bool IsStockEmpty()
    {
        lock (lockObject) { return ballStock <= 0; }
    }

    public bool IsStockLow()
    {
        lock (lockObject) { return ballStock > 0 && ballStock <= lowStockThreshold; }
    }

    /// <summary>Set stok manual (isi ulang tabung). Misal isi 50 → panggil SetStock(50).</summary>
    public void SetStock(int value, string reason = "")
    {
        int v = Mathf.Max(0, value);
        lock (lockObject) { ballStock = v; }
        PersistStock();
        Debug.Log($"[Dispenser] [STOK] 🎱 Stok di-set {v} {reason} — sisa={v}");
        try { StockChanged?.Invoke(v); } catch { }
    }

    [ContextMenu("Isi Stok 50")]
    private void CtxRefill50() { SetStock(50, "(context menu)"); }

    [ContextMenu("Cek Stok")]
    private void CtxCheckStock() { Debug.Log($"[Dispenser] [STOK] Sisa={GetStock()}"); }

    /// <summary>
    /// Jalur game menang: cek stok → kirim PUSH → kurangi 1.
    /// Return false jika stok habis / hardware putus (tidak ada PUSH, stok utuh).
    /// </summary>
    public bool TryTriggerWithStock(string qrShort, out int remaining)
    {
        lock (lockObject)
        {
            if (ballStock <= 0)
            {
                remaining = 0;
                Debug.LogWarning($"[Dispenser] [STOK] ⛔ Stok HABIS (0) — PUSH {qrShort} ditolak. Isi ulang tabung!");
                return false;
            }
        }
        if (!IsHardwareConnected())
        {
            lock (lockObject) { remaining = ballStock; }
            Debug.LogWarning($"[Dispenser] [STOK] ❌ Hardware putus — PUSH {qrShort} batal, stok utuh ({remaining}).");
            return false;
        }
        // Kirim PUSH dulu (tanpa potong stok di dalam thread).
        TriggerDispenser();
        lock (lockObject)
        {
            ballStock = Mathf.Max(0, ballStock - 1);
            remaining = ballStock;
        }
        PersistStock();
        Debug.Log($"[Dispenser] [STOK] 🎱 Berkurang 1 untuk {qrShort} — sisa={remaining}" + (remaining == 0 ? " ⛔ HABIS!" : (remaining <= lowStockThreshold ? $" ⚠️ menipis (batas {lowStockThreshold})!" : "")));
        try { StockChanged?.Invoke(remaining); } catch { }
        return true;
    }

    private void PersistStock()
    {
        try
        {
            MachineConfig cfg = SettingsStore.Load(new MachineConfig());
            cfg.ballStock = GetStock();
            cfg.ballLowThreshold = lowStockThreshold;
            SettingsStore.Save(cfg);
        }
        catch (System.Exception e) { Debug.LogWarning("[Dispenser] [STOK] Gagal simpan stok: " + e.Message); }
    }

    private void OnDestroy()
    {
        ClosePort();
    }

    private void OnApplicationQuit()
    {
        ClosePort();
    }

    private void ClosePort()
    {
        lock (lockObject)
        {
            if (serialPort != null)
            {
                try
                {
                    if (serialPort.IsOpen)
                    {
                        serialPort.Close();
                    }
                    serialPort.Dispose();
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[Dispenser] Error saat menutup port: {ex.Message}");
                }
                finally
                {
                    serialPort = null;
                    isConnected = false;
                }
            }
        }
    }
}
