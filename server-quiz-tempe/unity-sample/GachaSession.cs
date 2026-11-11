using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Events;

public class GachaSession : MonoBehaviour
{
    [Header("Konfigurasi Server")]
    [SerializeField] private string serverUrl = "ws://192.168.1.10:3005";
    [SerializeField] private string machineId = "GAME-01";
    [SerializeField] private bool debugLog = true;

    [Header("Navigasi Layar")]
    [Tooltip("GameObject layar Scan/Gacha — dimatikan saat tiket VALID (HomeScreen sudah aktif dari awal)")]
    [SerializeField] private GameObject scanScreenObject;

    [Header("Animasi Tutup Scan (hanya saat menutup)")]
    [Tooltip("Opsional: Animator di ScanScreen dengan trigger Close. Kalau kosong, pakai animasi kode (fade+slide).")]
    [SerializeField] private Animator scanAnimator;
    [SerializeField] private string closeTriggerName = "Close";
    [Tooltip("Durasi animasi tutup (detik). Berlaku untuk Animator maupun animasi kode.")]
    [SerializeField] private float closeDuration = 0.45f;
    [Tooltip("Geser ke atas saat menutup (pixel). 0 = hanya fade+scale.")]
    [SerializeField] private float closeSlideUpPixels = 120f;
    [SerializeField] private AnimationCurve closeEase = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);

    [Header("Aturan Menang (koin) — bisa diubah di Inspector")]
    [Tooltip("Persentase minimal dari skor maksimal agar dianggap MENANG. Misal 80 = butuh >=80% (dgn 5 soal x 20 poin = butuh >=80 poin).")]
    [SerializeField] private float winMinPercentage = 80f;
    [Tooltip("Nama hadiah/tier yang dikirim ke server saat menang. Kosongkan jika hanya butuh status menang/kalah.")]
    [SerializeField] private string winPrizeTier = "HADIAH";

    [Header("Dispenser Fisik (USB Serial langsung, tanpa server)")]
    [Tooltip("Trigger BallDispenserManager saat menang terkonfirmasi server. Matikan untuk test tanpa hardware.")]
    [SerializeField] private bool triggerDispenserOnWin = true;
    [Tooltip("Jeda tampil hasil/toast sebelum balik ke layar scan (detik). Kasih 4-5 agar toast dispenser kebaca.")]
    [SerializeField] private float resultDelay = 4f;

    [Header("Stok Bola (samakan dengan isi tabung)")]
    [Tooltip("ON = menang cek stok dulu, kirim PUSH lalu stok -1. Stok 0 = tolak + suruh hubungi petugas.")]
    [SerializeField] private bool useStock = true;

    [Header("Debug Shortcut")]
    [Tooltip("Paksa buka HomeScreen (tanpa scan) — default F1")]
    [SerializeField] private KeyCode debugOpenHomeKey = KeyCode.F1;
    [Tooltip("Simulasi scan VALID lokal (tanpa server) — default F2")]
    [SerializeField] private KeyCode debugValidScanKey = KeyCode.F2;
    [Tooltip("AKTIFKAN untuk test build: F1/F2 tetap hidup di build rilis. MATIKAN sebelum mesin live (pengunjung berkibord bisa bypass scan)!")]
    [SerializeField] private bool allowDebugKeysInRelease = true;

    [Header("Debug Skip Pojok (setara F1 — ketuk sekali, tanpa QR)")]
    [Tooltip("Pojok skip. Default kiri-bawah (panel pengaturan di kanan-atas, biar tidak tubrukan).")]
    [SerializeField] private SkipCorner skipCorner = SkipCorner.BottomLeft;
    [Tooltip("Lebar area pojok dalam pixel.")]
    [SerializeField] private int skipCornerSize = 300;
    [Tooltip("Jarak area dari tepi layar. 0 = mepet ujung. Isi misal 100 untuk geser ke dalam.")]
    [SerializeField] private int skipCornerMargin = 0;

    public enum SkipCorner { BottomLeft, BottomRight, TopLeft, TopRight }

    /// <summary>Hook agar skip tidak mencuri tap saat UI pengaturan terbuka.
    /// Diisi SettingsPanel saat enable (tanpa GachaSession perlu kenal file itu).</summary>
    public static System.Func<bool> IsSettingsUiOpen;

    [Header("Event untuk Game (assign di Inspector atau subscribe dari script)")]
    public UnityEvent<string> OnTicketValid;
    public UnityEvent<string> OnTicketRejected;
    public UnityEvent<string> OnConnectionChanged;
    public UnityEvent OnScanOverflow;
    [Tooltip("Dipanggil saat server konfirmasi MENANG (ticket_finished isWin=true, mesin sendiri). Bisa di-bind ke UI/audio.")]
    public UnityEvent<string> OnWinConfirmed;
    [Tooltip("Status dispenser buat UI: 'Sedang mengeluarkan hadiah...' / 'Hadiah keluar!' / 'Gagal...'. Bind ke Toast/Text.")]
    public UnityEvent<string> OnDispenserStatus;
    [Tooltip("Sisa stok bola tiap berubah (menang -1 / isi ulang). Bind ke Text/angka UI.")]
    public UnityEvent<int> OnStockChanged;
    [Tooltip("Semua log (VALID/DITOLAK/CLAIM/FINISH/dll) — bind ke UI Text/ScrollView")]
    public UnityEvent<string> OnLog;

    [Header("Riwayat Log (lihat via Console / UI OnLog, bukan Inspector)")]
    [SerializeField] private int maxLogHistory = 100;
    [HideInInspector] // disembunyikan: List yang update tiap detik saat Play bikin Inspector ListView crash (NRE VirtualizationController)
    public System.Collections.Generic.List<string> logHistory = new System.Collections.Generic.List<string>();

    public string StatusText => _statusText;
    public bool StatusOk => _statusOk;
    public string LastLog => logHistory.Count > 0 ? logHistory[logHistory.Count - 1] : "";
    public string ConnectionStatus => _connectionText;

    private QrWebSocketClient _ws;
    private QrScannerInput _scanner;
    private bool _busy;
    private bool _scanBlocked;
    private bool _playing;
    private string _currentQrCode;
    // Hasil quiz terakhir (diisi FinishQuiz sebelum BackToScan mengirim game_finish)
    private int _pendingScore;
    private int _pendingMaxScore;
    private bool _pendingIsWin;
    private string _pendingPrizeTier;
    private bool _hasPendingResult;
    private string _connectionText = "Menghubungkan...";
    private string _statusText;
    private bool _statusOk;
    // Idempotency: QR yang sudah di-trigger dispenser (cegah double PUSH:
    // FinishQuiz optimis + ticket_finished server). QR tidak akan keluar 2x.
    private readonly System.Collections.Generic.HashSet<string> _dispensedQr = new System.Collections.Generic.HashSet<string>();

    private void Awake()
    {
        // Override default Inspector dengan setting per mesin (PlayerPrefs) bila ada.
        // Build pertama (belum pernah disimpan) = pakai nilai Inspector apa adanya.
        try
        {
            MachineConfig stored = SettingsStore.Load(new MachineConfig
            {
                serverWsUrl = serverUrl,
                machineId = machineId
            });
            serverUrl = stored.serverWsUrl;
            machineId = stored.machineId;
            if (SettingsStore.HasSaved())
                Debug.Log($"[Settings] Dimuat dari mesin: {serverUrl} / {machineId}");
        }
        catch (System.Exception e) { Debug.LogWarning("[Settings] Gagal load: " + e.Message); }

        _ws = gameObject.AddComponent<QrWebSocketClient>();
        _scanner = gameObject.AddComponent<QrScannerInput>();
        _scanner.OnScanned += HandleScannedCode;
        Log($"[BOOT] Mesin {machineId} siap. Server={serverUrl} | Menang>={winMinPercentage}% ({winPrizeTier}) | Stok={(BallDispenserManager.Instance != null ? BallDispenserManager.Instance.GetStock().ToString() : "-")}");
        if (BallDispenserManager.Instance != null)
        {
            BallDispenserManager.Instance.StockChanged -= ForwardStock;
            BallDispenserManager.Instance.StockChanged += ForwardStock;
        }
        _ws.OnConnected += () => { SetConnectionText("Terhubung ke server"); Log("[1/6][WS] ✅ Terhubung ke server — siap scan QR."); };
        _ws.OnDisconnected += () => { SetConnectionText("Server terputus — menunggu reconnect..."); Log("[1/6][WS] ❌ Server terputus — mencoba reconnect otomatis..."); };
        _ws.OnMessage += HandleServerMessage;
    }

    private void Start()
    {
        Log($"[1/6][WS] Menghubungkan ke {serverUrl} ...");
        _ws.Connect(serverUrl);
        if (BallDispenserManager.Instance != null)
        {
            BallDispenserManager.Instance.StockChanged -= ForwardStock;
            BallDispenserManager.Instance.StockChanged += ForwardStock;
            try { OnStockChanged?.Invoke(BallDispenserManager.Instance.GetStock()); } catch { }
        }
    }

    private void ForwardStock(int sisa)
    {
        Log($"[6/6][STOK] 🎱 Update stok: sisa={sisa}");
        try { OnStockChanged?.Invoke(sisa); } catch { }
    }

    /// <summary>Sisa bola saat ini (otoritatif di BallDispenserManager).</summary>
    public int GetStock() { return BallDispenserManager.Instance != null ? BallDispenserManager.Instance.GetStock() : 0; }

    /// <summary>Isi ulang stok manual (tabung diisi fisik 50 → panggil SetStock(50)).</summary>
    public void SetStock(int value)
    {
        if (BallDispenserManager.Instance == null) { Log("[6/6][STOK] ❌ SetStock gagal: Manager tidak ada."); return; }
        BallDispenserManager.Instance.SetStock(value, "(set manual)");
    }

    private void Update()
    {
        if (!DebugKeysAllowed()) return;
        if (Input.GetKeyDown(debugOpenHomeKey)) DebugOpenHomescreen();
        else if (Input.GetKeyDown(debugValidScanKey)) DebugSimulateValidScan();
        CheckSkipCorner();
    }

    // Tombol skip tersembunyi: ketuk SEKALI pojok yang dipilih → mulai tanpa QR.
    // Mati saat game jalan / panel pengaturan terbuka / debug tidak diizinkan.
    private void CheckSkipCorner()
    {
        if (_playing) return;
        if (IsSettingsUiOpen != null && IsSettingsUiOpen()) return;

        bool down = false;
        Vector2 pos = Vector2.zero;
        if (Input.GetMouseButtonDown(0)) { down = true; pos = Input.mousePosition; }
        if (Input.touchCount > 0)
        {
            foreach (Touch t in Input.touches)
                if (t.phase == TouchPhase.Began) { down = true; pos = t.position; break; }
        }
        if (!down) return;

        float sm = Mathf.Max(0, skipCornerMargin);
        bool top = pos.y >= Screen.height - sm - skipCornerSize && pos.y <= Screen.height - sm;
        bool bottom = pos.y >= sm && pos.y <= sm + skipCornerSize;
        bool left = pos.x >= sm && pos.x <= sm + skipCornerSize;
        bool right = pos.x >= Screen.width - sm - skipCornerSize && pos.x <= Screen.width - sm;
        bool inside = false;
        switch (skipCorner)
        {
            case SkipCorner.TopLeft: inside = top && left; break;
            case SkipCorner.TopRight: inside = top && right; break;
            case SkipCorner.BottomRight: inside = bottom && right; break;
            default: inside = bottom && left; break;
        }
        if (!inside) return;

        Debug.Log("[DebugSkip] Pojok skip diketuk → mulai game tanpa QR (setara F1).");
        DebugOpenHomescreen();
    }

    public void SetMachineConfig(string url, string machine)
    {
        serverUrl = url;
        machineId = machine;
        _ws.Connect(url);
    }

    // Getter live untuk panel pengaturan (tanpa bongkar field private).
    public string GetServerUrl() { return serverUrl; }
    public string GetMachineId() { return machineId; }
    public bool IsWsConnected() { return _ws != null && _ws.IsConnected; }
    public bool IsPlayingGame() { return _playing; }

    /// <summary>True jika tombol debug (F1/F2/skip pojok) boleh hidup:
    /// Editor/debug build, atau rilis dengan allowDebugKeysInRelease dicentang.</summary>
    public bool DebugKeysAllowed() { return Debug.isDebugBuild || allowDebugKeysInRelease; }

    public void SetScanningEnabled(bool enabled)
    {
        _scanBlocked = !enabled;
        _scanner.ScanEnabled = enabled;
        if (!enabled) _busy = false;
    }

    // ------------------------------------------------
    // NAVIGASI LAYAR
    // HomeScreen sudah aktif dari awal. Saat scan VALID,
    // cukup matikan layar Scan. Gagal / QR invalid / sudah
    // pernah dipakai → layar Scan TIDAK dimatikan.
    // ------------------------------------------------
    private Coroutine _closeScanRoutine;
    private CanvasGroup _scanCanvasGroup;
    private RectTransform _scanRect;
    private Vector2 _scanAnchoredPos;

    public void StartGame()
    {
        if (_playing) return;
        _playing = true;
        SetScanningEnabled(false);
        if (scanScreenObject != null)
        {
            if (_closeScanRoutine != null) StopCoroutine(_closeScanRoutine);
            _closeScanRoutine = StartCoroutine(CloseScanScreenRoutine());
        }
        Log("[4/6][GAME] ▶️ Game dimulai — layar scan ditutup, scanner di-pause.");
    }

    // ------------------------------------------------
    // HASIL QUIZ (koin) → penentu menang/kalah
    // Dipanggil dari GameManagerGatcha.EndQuiz() tepat setelah
    // GameObject result panel / koin tampil:
    //   FindObjectOfType<GachaSession>().FinishQuiz(totalScore, maxScore);
    // ------------------------------------------------
    public bool IsWin(int coins, int maxScore)
    {
        float pct = maxScore > 0 ? (float)coins / (float)maxScore * 100f : 0f;
        return pct >= winMinPercentage;
    }

    public void FinishQuiz(int coins, int maxScore)
    {
        if (!_playing) return;
        bool win = IsWin(coins, maxScore);
        _pendingScore = coins;
        _pendingMaxScore = maxScore;
        _pendingIsWin = win;
        _pendingPrizeTier = win ? winPrizeTier : "";
        _hasPendingResult = true;
        float pct = maxScore > 0 ? (float)coins / (float)maxScore * 100f : 0f;
        Log($"[5/6][HASIL] 🧮 Quiz selesai: {coins}/{maxScore} ({pct:F0}%) threshold {winMinPercentage}% → {(win ? "MENANG 🏆 lanjut kirim finish" : "KALAH, tidak trigger dispenser")}");
        // SINGLE-TRIGGER: jalur QR jangan trigger di sini — tunggu konfirmasi
        // server via ticket_finished (single source of truth). Kalau trigger di sini
        // DAN di ticket_finished, Arduino terima 2x "PUSH" (±4 detik terpisah
        // karena resultDelay) → 2 bola keluar. Trigger lokal hanya untuk
        // mode debug/bypass tanpa QR (_currentQrCode kosong, tidak ada broadcast).
        if (win && string.IsNullOrEmpty(_currentQrCode)) TryTriggerDispenser("DEBUG-LOCAL");
        // Jeda dulu agar toast hasil + dispenser kebaca, baru balik ke scan.
        // Selama jeda, scan tetap diblokir (_playing masih true).
        if (_backRoutine != null) StopCoroutine(_backRoutine);
        _backRoutine = StartCoroutine(DelayedBackToScan());
    }

    private Coroutine _backRoutine;

    private System.Collections.IEnumerator DelayedBackToScan()
    {
        yield return new WaitForSecondsRealtime(Mathf.Max(0.5f, resultDelay));
        _backRoutine = null;
        BackToScan();
    }

    public void BackToScan()
    {
        if (!_playing) return;
        _playing = false;
        SendGameFinish();        // Buka kembali TANPA animasi (sesuai request: animasi hanya saat menutup)
        if (_closeScanRoutine != null) { StopCoroutine(_closeScanRoutine); _closeScanRoutine = null; }
        if (scanScreenObject != null)
        {
            scanScreenObject.SetActive(true);
            ResetScanScreenVisual(); // kembalikan alpha/scale/posisi agar tidak nyangkut transparan
        }
        SetScanningEnabled(true);
        Log("[6/6][SIAP] ✅ Siklus selesai — kembali ke layar scan, menunggu QR berikutnya.");
    }

    private IEnumerator CloseScanScreenRoutine()
    {
        GameObject target = scanScreenObject;

        // 1) Kalau pakai Animator: tinggal fire trigger, tunggu durasi, lalu matikan.
        if (scanAnimator != null)
        {
            scanAnimator.ResetTrigger(closeTriggerName);
            scanAnimator.SetTrigger(closeTriggerName);
            yield return new WaitForSecondsRealtime(Mathf.Max(0.01f, closeDuration));
            target.SetActive(false);
            _closeScanRoutine = null;
            yield break;
        }

        // 2) Animasi kode: fade 1->0 + scale 1->0.92 + slide ke atas. Tanpa butuh plugin/Animator.
        _scanCanvasGroup = target.GetComponent<CanvasGroup>();
        if (_scanCanvasGroup == null) _scanCanvasGroup = target.AddComponent<CanvasGroup>();
        _scanRect = target.GetComponent<RectTransform>();
        if (_scanRect != null) _scanAnchoredPos = _scanRect.anchoredPosition;
        Vector3 startScale = target.transform.localScale;

        // Pastikan interaktif mati duluan supaya tidak bisa diklik saat animasi
        _scanCanvasGroup.interactable = false;
        _scanCanvasGroup.blocksRaycasts = false;

        float t = 0f;
        float dur = Mathf.Max(0.01f, closeDuration);
        while (t < dur)
        {
            t += Time.unscaledDeltaTime; // tetap jalan walau Time.timeScale = 0
            float k = closeEase.Evaluate(Mathf.Clamp01(t / dur));
            _scanCanvasGroup.alpha = 1f - k;
            target.transform.localScale = startScale * (1f - 0.08f * k);
            if (_scanRect != null)
                _scanRect.anchoredPosition = _scanAnchoredPos + Vector2.up * (closeSlideUpPixels * k);
            yield return null;
        }

        target.SetActive(false);
        _closeScanRoutine = null;
    }

    private void ResetScanScreenVisual()
    {
        if (scanScreenObject == null) return;
        if (_scanCanvasGroup == null) _scanCanvasGroup = scanScreenObject.GetComponent<CanvasGroup>();
        if (_scanCanvasGroup != null)
        {
            _scanCanvasGroup.alpha = 1f;
            _scanCanvasGroup.interactable = true;
            _scanCanvasGroup.blocksRaycasts = true;
        }
        scanScreenObject.transform.localScale = Vector3.one;
        if (_scanRect == null) _scanRect = scanScreenObject.GetComponent<RectTransform>();
        if (_scanRect != null) _scanRect.anchoredPosition = _scanAnchoredPos;
    }

    private void SendGameFinish()
    {
        if (string.IsNullOrEmpty(_currentQrCode)) return;
        string finQr = _currentQrCode;
        _currentQrCode = null;
        int score = _hasPendingResult ? _pendingScore : 0;
        int maxScore = _hasPendingResult ? _pendingMaxScore : 0;
        bool isWin = _hasPendingResult && _pendingIsWin;
        string prize = _hasPendingResult ? _pendingPrizeTier : "";
        _hasPendingResult = false;
        if (_ws == null || !_ws.IsConnected)
        {
            Log($"[5/6][FINISH] ❌ Gagal kirim game_finish ({ShortQr(finQr)}), server terputus. Tiket pending akan dilepas server saat mesin disconnect.");
            return;
        }
        var msg = new GameFinishMessage { qrCode = finQr, machineId = machineId, score = score, maxScore = maxScore, isWin = isWin, prizeTier = prize };
        Log($"[5/6][FINISH] 📤 Kirim game_finish {ShortQr(finQr)} skor {score}/{maxScore} isWin={isWin} → menunggu konfirmasi server...");
        _ws.Send(JsonUtility.ToJson(msg));
    }

    // ------------------------------------------------
    // DISPENSER FISIK (USB Serial langsung ke ESP32)
    // - Jalur QR: hanya via ticket_finished server + mesin sendiri (1x).
    // - Jalur debug/bypass tanpa QR: via FinishQuiz lokal (1x).
    // Aman tanpa hardware: hanya Log + skip jika Manager tidak ada / tidak tersambung.
    // ------------------------------------------------
    private void TryTriggerDispenser(string qrCode)
    {
        if (!triggerDispenserOnWin) { Log("[6/6][DISPENSER] ⏭️ Skip: triggerDispenserOnWin MATI di Inspector (mode test tanpa hardware)."); return; }
        if (BallDispenserManager.Instance == null)
        {
            Log("[6/6][DISPENSER] ❌ Skip trigger: BallDispenserManager tidak ada di scene (tambah GameObject DispenserManager).");
            try { OnDispenserStatus?.Invoke("Dispenser belum siap, hubungi petugas."); } catch { }
            return;
        }
        if (!BallDispenserManager.Instance.IsHardwareConnected())
        {
            Log("[6/6][DISPENSER] ❌ Skip trigger: hardware tidak tersambung (cek kabel data + COM port).");
            try { OnDispenserStatus?.Invoke("Dispenser tidak tersambung, hubungi petugas."); } catch { }
            return;
        }
        string shortQr = ShortQr(qrCode);
        // Cek stok dulu: 0 = jangan PUSH sama sekali.
        if (useStock && BallDispenserManager.Instance.IsStockEmpty())
        {
            Log($"[6/6][STOK] ⛔ Stok HABIS — {shortQr} menang tapi PUSH ditolak. Hubungi petugas isi ulang!");
            try { OnDispenserStatus?.Invoke("Stok bola habis, hubungi petugas."); } catch { }
            return;
        }
        try { OnDispenserStatus?.Invoke("Menang! Sedang mengeluarkan hadiah..."); } catch { }
        if (useStock)
        {
            Log($"[6/6][DISPENSER] 📤 Mengirim PUSH ke Arduino untuk {shortQr} (stok-1) ...");
            bool ok = BallDispenserManager.Instance.TryTriggerWithStock(shortQr, out int sisa);
            if (!ok)
            {
                if (BallDispenserManager.Instance.IsStockEmpty())
                {
                    try { OnDispenserStatus?.Invoke("Stok bola habis, hubungi petugas."); } catch { }
                }
                return;
            }
            Log($"[6/6][STOK] 🎱 Stok berkurang 1 — sisa={sisa}");
            if (sisa <= 0) try { OnDispenserStatus?.Invoke("Hadiah keluar! Stok habis, hubungi petugas."); } catch { }
            else try { OnDispenserStatus?.Invoke($"Hadiah sedang keluar, silakan ambil di bawah! (Sisa {sisa})"); } catch { }
            return;
        }
        Log($"[6/6][DISPENSER] 📤 Mengirim PUSH ke Arduino untuk {shortQr} (tanpa cek stok) ...");
        BallDispenserManager.Instance.TriggerDispenser();
        Log($"[6/6][DISPENSER] ✅ PUSH dikirim untuk {shortQr} — cek log [Dispenser] berikutnya untuk konfirmasi serial.");
        // Optimistic: port sudah open = WriteLine hampir pasti sukses.
        // Konfirmasi fisik (bola jatuh) tetap dari ESP32, bukan dari serial.
        try { OnDispenserStatus?.Invoke("Hadiah sedang keluar, silakan ambil di bawah!"); } catch { }
    }

    public void DebugOpenHomescreen()
    {
        Log("[DEBUG] ⏭️ Bypass F1: paksa mulai game (tanpa scan).");
        StartGame();
    }

    public void DebugSimulateValidScan()
    {
        if (_playing) return;
        Log("[DEBUG] ⏭️ Bypass F2: simulasi scan VALID lokal (tanpa server).");
        _busy = false;
        _currentQrCode = null; // jangan kirim game_finish untuk tiket debug
        _hasPendingResult = false;
        SetStatus(true, "Tiket valid — selamat bermain!");
        OnTicketValid?.Invoke("DEBUG-000001");
        StartGame();
    }

    private void HandleLocalReject(string qrCode, string reason)
    {
        // QR dibuang di QrScannerInput karena < minChars — tidak sampai ke server.
        // Samakan respon dengan reject server supaya UI selalu dapat feedback.
        string msg = $"QR ditolak (format lokal): {reason}";
        Log($"[2/6][DITOLAK-LOKAL] ⛔ {reason} code={ShortQr(qrCode)} — tidak dikirim ke server.");
        SetStatus(false, msg);
        OnTicketRejected?.Invoke(msg);
    }

    private void HandleScannedCode(string qrCode)
    {
        if (_busy || _scanBlocked || _playing)
        {
            Log($"[2/6][BLOKIR] ⏳ Scan {ShortQr(qrCode)} diabaikan (busy={_busy}, scannerBlocked={_scanBlocked}, playing={_playing}). Tunggu BackToScan selesai.");
            OnScanOverflow?.Invoke();
            return;
        }
        if (!_ws.IsConnected)
        {
            string msg = "Server tidak terhubung. Tunggu reconnect...";
            Log($"[2/6][DITOLAK] ⛔ OFFLINE code={ShortQr(qrCode)} — server putus, QR tidak diproses.");
            SetStatus(false, msg);
            OnTicketRejected?.Invoke(msg);
            return;
        }
        _busy = true;
        _currentQrCode = qrCode;
        _hasPendingResult = false;
        Log($"[2/6][SCAN] 📥 Scan masuk {ShortQr(qrCode)} (len={qrCode?.Length ?? 0}) → validasi lokal lolos, kirim ke server...");
        SendScan(qrCode);
    }

    private void SendScan(string qrCode)
    {
        var msg = new ScanQrMessage { type = "scan_qr", qrCode = qrCode, machineId = machineId };
        bool sent = _ws.Send(JsonUtility.ToJson(msg));
        if (!sent)
        {
            _busy = false;
            string err = "Gagal kirim ke server";
            Log($"[2/6][SCAN] ❌ SEND_FAIL code={ShortQr(qrCode)} — WebSocket tidak open.");
            SetStatus(false, err);
            OnTicketRejected?.Invoke(err);
        }
        else
        {
            Log($"[2/6][SCAN] 📤 scan_qr terkirim (mesin {machineId}) → menunggu scan_result dari server...");
        }
    }

    private void HandleServerMessage(string raw)
    {
        try
        {
            var msg = JsonUtility.FromJson<ServerMessage>(raw);
            if (msg == null || msg.type == null) return;

            if (msg.type == "scan_result")
            {
                _busy = false;
                if (msg.success)
                {
                    SetStatus(true, "Tiket valid — selamat bermain!");
                    Log($"[3/6][SERVER] ✅ VALID ticketId={msg.ticketId} ({ShortQr(msg.qrCode)}) → mulai game...");
                    OnTicketValid?.Invoke(msg.ticketId);
                    StartGame();
                }
                else
                {
                    SetStatus(false, msg.message);
                    Log($"[3/6][SERVER] ⛔ DITOLAK reason={msg.reason} msg={msg.message} — tetap di layar scan.");
                    OnTicketRejected?.Invoke(msg.message);
                }
            }
            else if (msg.type == "ticket_claimed")
            {
                Log($"[3/6][SERVER] 📢 CLAIM {ShortQr(msg.qrCode)} di-claim mesin {msg.machineId} (pending — menunggu game selesai)");
            }
            else if (msg.type == "ticket_finished")
            {
                Log($"[5/6][SERVER] 🏁 FINISH {ShortQr(msg.qrCode)} di mesin {msg.machineId} skor {msg.score}/{msg.maxScore} menang={msg.isWin} → dikunci used");
                // Trigger dispenser HANYA untuk kemenangan mesin sendiri.
                // ticket_finished di-broadcast ke semua mesin, jadi wajib filter machineId
                // agar mesin lain tidak ikut mengeluarkan bola.
                if (msg.machineId != machineId)
                {
                    Log($"[6/6][DISPENSER] ⏭️ Skip: finish milik mesin {msg.machineId}, bukan {machineId} — tidak trigger.");
                }
                else if (msg.isWin && msg.machineId == machineId)
                {
                    // Guard idempotency: broadcast ganda / retry tidak boleh PUSH 2x.
                    if (!string.IsNullOrEmpty(msg.qrCode) && _dispensedQr.Contains(msg.qrCode))
                    {
                        Log($"[6/6][DISPENSER] ⏭️ Skip duplikat ticket_finished untuk {ShortQr(msg.qrCode)} (sudah di-trigger).");
                    }
                    else
                    {
                        if (!string.IsNullOrEmpty(msg.qrCode))
                        {
                            _dispensedQr.Add(msg.qrCode);
                            if (_dispensedQr.Count > 200) _dispensedQr.Clear();
                        }
                        try { OnWinConfirmed?.Invoke(msg.qrCode); } catch { }
                        TryTriggerDispenser(msg.qrCode);
                    }
                }
                else
                {
                    Log("[6/6][DISPENSER] ⏭️ Skip: hasil KALAH — tidak trigger dispenser.");
                }
            }
            else if (msg.type == "dispense_result")
            {
                Log($"[6/6][SERVER] 📦 DISPENSE {ShortQr(msg.qrCode)} status={msg.dispenseStatus} hadiah={msg.prizeTier}");
            }
            else if (msg.type == "tickets_released")
            {
                Log($"[SERVER] ♻️ RELEASE {msg.count} tiket pending milik mesin {msg.machineId} dilepas kembali (bisa discan ulang)");
            }
            else if (msg.type == "ticket_used")
            {
                Log($"[SERVER] 📢 BROADCAST {ShortQr(msg.qrCode)} dipakai di mesin {msg.machineId}");
            }
        }
        catch (Exception e)
        {
            Debug.LogException(e);
        }
    }

    private void SetConnectionText(string text)
    {
        _connectionText = text;
        OnConnectionChanged?.Invoke(text);
    }

    private void SetStatus(bool ok, string text)
    {
        _statusOk = ok;
        _statusText = text;
    }

    private void Log(string msg)
    {
        // Satu pintu log: Console + riwayat + UI (OnLog) selalu terisi,
        // walau debugLog dimatikan. Format: [jam] [TAG] isi
        // Contoh urutan normal: [1/6][WS] → [2/6][SCAN] → [3/6][SERVER]
        // → [4/6][GAME] → [5/6][HASIL/FINISH] → [6/6][DISPENSER/SIAP]
        string line = $"[{System.DateTime.Now:HH:mm:ss}] [GachaSession] {msg}";
        logHistory.Add(line);
        if (logHistory.Count > maxLogHistory) logHistory.RemoveAt(0);
        try { OnLog?.Invoke(line); } catch { }
        if (debugLog) Debug.Log(line);
    }

    // QR vendor 171 char — tampilkan ringkas di console biar kebaca.
    // Contoh: Y5X01g9A...P4cnU (len=171)
    private static string ShortQr(string qr)
    {
        if (string.IsNullOrEmpty(qr)) return "(kosong)";
        if (qr.Length <= 16) return qr;
        return $"{qr.Substring(0, 8)}...{qr.Substring(qr.Length - 6)} (len={qr.Length})";
    }

    private void OnDestroy()
    {
        if (_scanner != null)
        {
            _scanner.OnScanned -= HandleScannedCode;
        }
        if (_ws != null) _ws.OnMessage -= HandleServerMessage;
        if (BallDispenserManager.Instance != null)
            BallDispenserManager.Instance.StockChanged -= ForwardStock;
    }
}