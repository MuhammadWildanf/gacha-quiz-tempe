using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Panel PENGATURAN teknisi (tema abu, beda dari layar hijau pengunjung).
/// - Hotspot tersembunyi: ketuk sekali pojok kanan-atas (bisa diganti di Inspector).
///   Tidak butuh GameObject tombol — murni deteksi posisi layar, hidup di semua layar.
/// - Isi: URL Server WS, URL API Kuis, Machine ID, Auto-detect + dropdown COM + Refresh,
///   status live, tombol Test PUSH, Simpan / Batal.
/// - Simpan → PlayerPrefs → langsung berlaku (reconnect WS + buka ulang COM), tanpa rebuild/restart.
/// - Butuh 1 tambahan di QuizDataLoader (file milik game): method publik
///     public void SetApiUrl(string url) { apiUrl = url; }
///   Kalau belum ada, URL kuis tetap dicatat tersimpan tapi baru berlaku setelah setter ditambah.
/// Letak di Hierarchy: Canvas teratas (Order tertinggi), sejajar Toast. Bukan anak ScanScreen.
/// </summary>
public class SettingsPanel : MonoBehaviour
{
    [Header("Root UI (drag dari Hierarchy)")]
    [SerializeField] private GameObject dimObject;
    [SerializeField] private GameObject panelObject;

    [Header("Input")]
    [SerializeField] private TMP_InputField serverUrlInput;
    [SerializeField] private TMP_InputField quizUrlInput;
    [SerializeField] private TMP_InputField machineIdInput;
    [SerializeField] private Toggle autoDetectToggle;
    [SerializeField] private TMP_Dropdown comDropdown;

    [Header("Input Stok (opsional — boleh kosong)")]
    [Tooltip("Isi sesuai bola di tabung (misal 50). Kalau kosong di Inspector, stok tetap jalan via Save.")]
    [SerializeField] private TMP_InputField stockInput;

    [Header("Input Game (opsional — boleh kosong)")]
    [Tooltip("Poin per jawaban benar (misal 20). Kosong = pertahankan nilai sebelumnya.")]
    [SerializeField] private TMP_InputField pointsPerCorrectInput;
    [Tooltip("Jumlah soal per sesi (0 = semua soal). Kosong = pertahankan nilai sebelumnya.")]
    [SerializeField] private TMP_InputField maxQuestionsInput;

    [Header("Label status")]
    [SerializeField] private TMP_Text wsStatusText;
    [SerializeField] private TMP_Text dispenserStatusText;
    [SerializeField] private TMP_Text stockStatusText;
    [SerializeField] private TMP_Text footerText;

    [Header("Tombol")]
    [SerializeField] private Button refreshButton;
    [SerializeField] private Button testButton;
    [SerializeField] private Button saveButton;
    [SerializeField] private Button cancelButton;
    [SerializeField] private Button closeButton;
    [SerializeField] private Button dimButton;

    [Header("Hotspot (ketuk sekali langsung buka)")]
    [Tooltip("Lebar area pojok. 300 = segede telapak tangan, gampang kena.")]
    [SerializeField] private int cornerSize = 300;
    [Tooltip("Jarak area dari tepi layar. 0 = mepet ujung. Isi misal 100 untuk geser ke dalam.")]
    [SerializeField] private int cornerMargin = 0;
    [Tooltip("Pojok pembuka panel. Default kanan-atas (skip QR di kiri-bawah, biar tidak tubrukan).")]
    [SerializeField] private HotCorner hotCorner = HotCorner.TopRight;
    [Tooltip("Jalan pintas teknisi berkibord (scanner = keyboard, jadi selalu tersedia).")]
    [SerializeField] private KeyCode openKey = KeyCode.F12;

    public enum HotCorner { TopRight, TopLeft }

    private bool _open;
    private List<string> _ports = new List<string>();

    private void Awake()
    {
        RegisterButtons();
        SetVisible(false);
        GachaSession.IsSettingsUiOpen = IsOpen;
    }

    private void OnDestroy()
    {
        GachaSession.IsSettingsUiOpen = null;
    }

    private void RegisterButtons()
    {
        if (refreshButton != null) refreshButton.onClick.AddListener(RefreshPorts);
        if (testButton != null) testButton.onClick.AddListener(TestDispenser);
        if (saveButton != null) saveButton.onClick.AddListener(Save);
        if (cancelButton != null) cancelButton.onClick.AddListener(Close);
        if (closeButton != null) closeButton.onClick.AddListener(Close);
        if (dimButton != null) dimButton.onClick.AddListener(Close);
        if (autoDetectToggle != null) autoDetectToggle.onValueChanged.AddListener(_ => OnAutoChanged());
    }

    /// <summary>
    /// Wiring dari code (dipakai factory/bootstrap/builder) — alternatif drag Inspector.
    /// Aman dipanggil setelah Awake; listener tombol didaftarkan ulang sekali.
    /// </summary>
    public void Wire(
        GameObject dim, GameObject panel,
        TMP_InputField server, TMP_InputField quiz, TMP_InputField mid,
        Toggle auto, TMP_Dropdown com,
        TMP_Text ws, TMP_Text disp, TMP_Text footer,
        Button refresh, Button test, Button save, Button cancel, Button close, Button dimBtn,
        TMP_InputField stock = null, TMP_Text stockStatus = null)
    {
        dimObject = dim;
        panelObject = panel;
        serverUrlInput = server;
        quizUrlInput = quiz;
        machineIdInput = mid;
        autoDetectToggle = auto;
        comDropdown = com;
        wsStatusText = ws;
        dispenserStatusText = disp;
        stockStatusText = stockStatus;
        stockInput = stock;
        footerText = footer;
        refreshButton = refresh;
        testButton = test;
        saveButton = save;
        cancelButton = cancel;
        closeButton = close;
        dimButton = dimBtn;
        RegisterButtons();
        SetVisible(false);
    }

    private void Update()
    {
        CheckHotspot();
        if (_open) RefreshStatusLabels();
    }

    /// <summary>True saat panel pengaturan sedang terbuka.</summary>
    public bool IsOpen() { return _open; }

    // ------------------------------------------------ hotspot pojok
    // 2 cara buka (keduanya tersembunyi dari pengunjung):
    //  1) Ketuk SEKALI pojok yang dipilih (default kanan-atas)  ← utama
    //  2) Kibord: F12
    private void CheckHotspot()
    {
        if (Input.GetKeyDown(openKey) && !_open) { Open(); return; }
        if (_open) return;

        bool down = false;
        Vector2 pos = Vector2.zero;
        if (Input.GetMouseButtonDown(0)) { down = true; pos = Input.mousePosition; }
        if (Input.touchCount > 0)
        {
            foreach (Touch t in Input.touches)
                if (t.phase == TouchPhase.Began) { down = true; pos = t.position; break; }
        }
        if (!down) return;

        float m = Mathf.Max(0, cornerMargin);
        bool top = pos.y >= Screen.height - m - cornerSize && pos.y <= Screen.height - m;
        bool inHot = top && (hotCorner == HotCorner.TopRight
            ? (pos.x >= Screen.width - m - cornerSize && pos.x <= Screen.width - m)
            : (pos.x >= m && pos.x <= m + cornerSize));
        if (inHot) Open();
    }

    // ------------------------------------------------ buka/tutup
    public void Open()
    {
        GachaSession session = FindObjectOfType<GachaSession>();
        if (session != null && !session.IsPlayingGame()) session.SetScanningEnabled(false);
        FillFromLive();
        SetVisible(true);
        _open = true;
        Debug.Log("[Settings] Panel dibuka (scan di-pause).");
    }

    public void Close()
    {
        SetVisible(false);
        _open = false;
        GachaSession session = FindObjectOfType<GachaSession>();
        // Lanjutkan scan hanya jika tidak sedang main (jangan aktifkan scanner di tengah game).
        if (session != null && !session.IsPlayingGame()) session.SetScanningEnabled(true);
        Debug.Log("[Settings] Panel ditutup.");
    }

    private void SetVisible(bool v)
    {
        if (dimObject != null) dimObject.SetActive(v);
        if (panelObject != null) panelObject.SetActive(v);
    }

    // ------------------------------------------------ isi + status
    private void FillFromLive()
    {
        GachaSession session = FindObjectOfType<GachaSession>();
        MachineConfig defaults = new MachineConfig();
        if (session != null)
        {
            defaults.serverWsUrl = session.GetServerUrl();
            defaults.machineId = session.GetMachineId();
        }
        if (BallDispenserManager.Instance != null)
        {
            // Nilai live COM dibaca lewat ActivePort di bawah (status), default dari store.
        }
        MachineConfig cfg = SettingsStore.Load(defaults);
        if (serverUrlInput != null) serverUrlInput.text = cfg.serverWsUrl;
        if (quizUrlInput != null) quizUrlInput.text = cfg.quizApiUrl;
        if (machineIdInput != null) machineIdInput.text = cfg.machineId;
        if (autoDetectToggle != null) autoDetectToggle.isOn = cfg.dispenserAutoDetect;
        if (stockInput != null) stockInput.text = cfg.ballStock.ToString();
        // Game config
        if (pointsPerCorrectInput != null) pointsPerCorrectInput.text = cfg.pointsPerCorrect.ToString();
        if (maxQuestionsInput != null) maxQuestionsInput.text = cfg.maxQuestions.ToString();
        RefreshPorts();
        // Pilih port tersimpan / aktif di dropdown
        string want = !string.IsNullOrEmpty(cfg.dispenserPort) ? cfg.dispenserPort : ActiveDispenserPort();
        if (comDropdown != null && !string.IsNullOrEmpty(want))
        {
            int idx = _ports.FindIndex(p => p.Equals(want, System.StringComparison.OrdinalIgnoreCase));
            if (idx >= 0) comDropdown.value = idx;
        }
        OnAutoChanged();
        int stokLive = BallDispenserManager.Instance != null ? BallDispenserManager.Instance.GetStock() : cfg.ballStock;
        if (stockInput == null)
            SetFooter($"Siap. Stok saat ini: {stokLive} (kolom input belum dipasang — isi via panel Stok / Inspector DispenserManager).");
        else
            SetFooter("Siap. Ubah lalu Simpan — langsung berlaku tanpa rebuild.");
        RefreshStatusLabels();
    }

    private void RefreshPorts()
    {
        _ports = new List<string>(BallDispenserManager.GetAvailablePorts());
        if (comDropdown == null) return;
        comDropdown.ClearOptions();
        if (_ports.Count == 0)
        {
            comDropdown.AddOptions(new List<string> { "(tidak ada COM terdeteksi)" });
            comDropdown.value = 0;
            comDropdown.interactable = false;
        }
        else
        {
            comDropdown.AddOptions(_ports);
            comDropdown.interactable = true;
        }
        RefreshStatusLabels();
    }

    private void OnAutoChanged()
    {
        if (comDropdown != null && autoDetectToggle != null)
            comDropdown.interactable = !autoDetectToggle.isOn && _ports.Count > 0;
    }

    private void RefreshStatusLabels()
    {
        GachaSession session = FindObjectOfType<GachaSession>();
        if (wsStatusText != null)
        {
            bool ok = session != null && session.IsWsConnected();
            wsStatusText.text = ok ? "● Server: Terhubung" : "● Server: Terputus";
            wsStatusText.color = ok ? Color.green : Color.red;
        }
        if (dispenserStatusText != null)
        {
            bool ok = BallDispenserManager.Instance != null && BallDispenserManager.Instance.IsHardwareConnected();
            string port = ActiveDispenserPort();
            int stok = BallDispenserManager.Instance != null ? BallDispenserManager.Instance.GetStock() : 0;
            string stokTxt = stok <= 0 ? "• Stok: HABIS!" : $"• Stok: {stok}";
            dispenserStatusText.text = ok ? $"● Dispenser: {port} Terhubung {stokTxt}" : $"● Dispenser: {port} Tidak tersambung {stokTxt}";
            dispenserStatusText.color = ok ? Color.green : Color.red;
            if (stok <= 0) dispenserStatusText.color = Color.red;
        }
        if (stockStatusText != null)
        {
            int stok = BallDispenserManager.Instance != null ? BallDispenserManager.Instance.GetStock() : 0;
            bool empty = stok <= 0;
            stockStatusText.text = empty ? "● Stok: HABIS — isi ulang!" : $"● Stok bola: {stok}";
            stockStatusText.color = empty ? Color.red : (stok <= 5 ? new Color(1f, 0.55f, 0f) : Color.green);
        }
    }

    private string ActiveDispenserPort()
    {
        // Baca port aktif asli (field private vendor) via refleksi agar status jujur.
        try
        {
            var inst = BallDispenserManager.Instance;
            if (inst != null)
            {
                var f = typeof(BallDispenserManager).GetField("activePort",
                    System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                string v = f != null ? (f.GetValue(inst) as string) : null;
                if (!string.IsNullOrEmpty(v)) return v;
            }
        }
        catch { }
        if (_ports.Count > 0 && comDropdown != null && comDropdown.interactable)
        {
            int i = Mathf.Clamp(comDropdown.value, 0, _ports.Count - 1);
            return _ports[i];
        }
        return "(auto)";
    }

    private void SetFooter(string s)
    {
        if (footerText != null) footerText.text = s;
        Debug.Log("[Settings] " + s);
    }

    // ------------------------------------------------ aksi
    private void TestDispenser()
    {
        if (BallDispenserManager.Instance == null)
        {
            SetFooter("GAGAL: BallDispenserManager tidak ada di scene.");
            return;
        }
        // Test manual TIDAK mengurangi stok (biar teknisi bisa tes tanpa isi ulang).
        BallDispenserManager.Instance.TriggerDispenser();
        int stok = BallDispenserManager.Instance.GetStock();
        SetFooter($"Perintah PUSH dikirim (test, stok utuh {stok}). Lihat Console + motor. Tanpa alat = log 'tidak tersambung' (wajar).");
    }

    /// <summary>Isi ulang stok dari tombol (bind ke Button, tanpa perlu Save).</summary>
    public void RefillStock(int value)
    {
        if (BallDispenserManager.Instance == null) { SetFooter("GAGAL: Manager tidak ada."); return; }
        BallDispenserManager.Instance.SetStock(value, "(refill manual)");
        if (stockInput != null) stockInput.text = value.ToString();
        SetFooter($"Stok diisi {value}.");
        RefreshStatusLabels();
    }

    private void Save()
    {
        int stokParsed = -1;
        if (stockInput != null && !string.IsNullOrWhiteSpace(stockInput.text))
        {
            if (!int.TryParse(stockInput.text.Trim(), out stokParsed) || stokParsed < 0)
            {
                SetFooter("GAGAL: Stok harus angka >= 0 (samakan dengan isi tabung, misal 50).");
                return;
            }
        }

        // --- Parse game config ---
        int ppcParsed = -1;
        if (pointsPerCorrectInput != null && !string.IsNullOrWhiteSpace(pointsPerCorrectInput.text))
        {
            if (!int.TryParse(pointsPerCorrectInput.text.Trim(), out ppcParsed) || ppcParsed < 1)
            {
                SetFooter("GAGAL: Poin per benar harus angka >= 1 (misal 20).");
                return;
            }
        }

        int maxQParsed = -1;
        if (maxQuestionsInput != null && !string.IsNullOrWhiteSpace(maxQuestionsInput.text))
        {
            if (!int.TryParse(maxQuestionsInput.text.Trim(), out maxQParsed) || maxQParsed < 0)
            {
                SetFooter("GAGAL: Max soal harus angka >= 0 (0 = semua soal).");
                return;
            }
        }

        MachineConfig cfg = new MachineConfig
        {
            serverWsUrl = serverUrlInput != null ? serverUrlInput.text.Trim() : "",
            quizApiUrl = quizUrlInput != null ? quizUrlInput.text.Trim() : "",
            machineId = machineIdInput != null ? machineIdInput.text.Trim() : "",
            dispenserAutoDetect = autoDetectToggle != null && autoDetectToggle.isOn,
            dispenserPort = "",
            dispenserBaudRate = 115200
        };
        if (_ports.Count > 0 && comDropdown != null)
        {
            int i = Mathf.Clamp(comDropdown.value, 0, _ports.Count - 1);
            cfg.dispenserPort = _ports[i];
        }
        // Stok: kalau input diisi → pakai itu; kalau input kosong (tidak di-drag di UI) → pertahankan stok berjalan.
        if (stokParsed >= 0) cfg.ballStock = stokParsed;
        else if (BallDispenserManager.Instance != null) cfg.ballStock = BallDispenserManager.Instance.GetStock();

        // Game config: kalau input diisi → pakai itu; kalau kosong → pertahankan nilai berjalan.
        GameManagerGatcha gm = FindObjectOfType<GameManagerGatcha>();
        if (ppcParsed >= 1) cfg.pointsPerCorrect = ppcParsed;
        else if (gm != null) cfg.pointsPerCorrect = gm.pointsPerCorrect;

        if (maxQParsed >= 0) cfg.maxQuestions = maxQParsed;
        else if (gm != null) cfg.maxQuestions = gm.maxQuestions;

        string err;
        if (!cfg.IsValid(out err))
        {
            SetFooter("GAGAL: " + err);
            return;
        }

        SettingsStore.Save(cfg);

        // 1) Server WS + Machine ID → reconnect langsung
        GachaSession session = FindObjectOfType<GachaSession>();
        if (session != null) session.SetMachineConfig(cfg.serverWsUrl, cfg.machineId);

        // 2) Dispenser → buka ulang COM langsung
        if (BallDispenserManager.Instance != null)
            BallDispenserManager.Instance.SetSerialConfig(cfg.dispenserPort, cfg.dispenserAutoDetect, cfg.dispenserBaudRate);

        // 2b) Stok → terapkan langsung (isi ulang tabung = input angka baru + Save)
        if (BallDispenserManager.Instance != null && stokParsed >= 0)
            BallDispenserManager.Instance.SetStock(cfg.ballStock, "(dari Settings-Save)");

        // 3) URL kuis → dorong ke QuizDataLoader bila ada setter-nya
        PushQuizUrl(cfg.quizApiUrl);

        // 4) Game config → terapkan ke GameManagerGatcha langsung (berlaku sesi berikutnya)
        if (gm != null) gm.ApplyGameConfig();

        SetFooter($"Tersimpan • {cfg.machineId} • {cfg.serverWsUrl} • COM {cfg.dispenserPort}{(cfg.dispenserAutoDetect ? " (auto)" : "")} • Stok {cfg.ballStock} • Poin/benar {cfg.pointsPerCorrect} • Max soal {cfg.maxQuestions}");
        RefreshStatusLabels();
    }

    // QuizDataLoader milik project game (bukan repo ini). Didorong via refleksi agar
    // SettingsPanel tetap compile walau file itu belum ditambah setter.
    // Tambahkan di QuizDataLoader.cs aslinya:
    //   public string apiUrl; // (sudah ada sebagai Api Url)
    //   public void SetApiUrl(string url) { apiUrl = url; }
    private void PushQuizUrl(string url)
    {
        try
        {
            System.Type t = null;
            foreach (var asm in System.AppDomain.CurrentDomain.GetAssemblies())
            {
                t = asm.GetType("QuizDataLoader");
                if (t != null) break;
            }
            if (t == null) { Debug.LogWarning("[Settings] QuizDataLoader tidak ketemu di scene-build; URL kuis tersimpan tapi butuh setter manual."); return; }
            Object loader = FindObjectOfType(t) as Object;
            if (loader == null) { Debug.LogWarning("[Settings] QuizDataLoader tidak ada di scene aktif."); return; }
            var m = t.GetMethod("SetApiUrl", new System.Type[] { typeof(string) });
            if (m != null) { m.Invoke(loader, new object[] { url }); Debug.Log("[Settings] URL kuis didorong ke QuizDataLoader."); return; }
            var f = t.GetField("apiUrl") ?? t.GetField("ApiUrl") ?? t.GetField("apiURL");
            if (f != null) { f.SetValue(loader, url); Debug.Log("[Settings] URL kuis di-set via field apiUrl (tambah SetApiUrl agar rapi)."); return; }
            Debug.LogWarning("[Settings] QuizDataLoader tanpa SetApiUrl/apiUrl — tambahkan setter 3 baris (lihat komentar).");
        }
        catch (System.Exception e) { Debug.LogWarning("[Settings] Gagal dorong URL kuis: " + e.Message); }
    }
}
