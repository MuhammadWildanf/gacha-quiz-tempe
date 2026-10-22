using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Toast notif untuk GachaSession.
/// Pasang di GameObject Toast (Panel) + CanvasGroup.
/// Subscribe ke OnTicketValid / OnTicketRejected / OnConnectionChanged.
/// </summary>
public class ScanToastNotifier : MonoBehaviour
{
    [Header("Referensi")]
    [SerializeField] private GachaSession session;
    [SerializeField] private CanvasGroup toastGroup;
    [SerializeField] private TextMeshProUGUI toastText;
    [SerializeField] private Image toastBg;

    [Header("Waktu")]
    [SerializeField] private float showDuration = 2.5f;
    [SerializeField] private float fadeDuration = 0.3f;
    [SerializeField] private float popDuration = 0.15f;

    [Header("Warna")]
    [SerializeField] private Color validColor = new Color(0.16f, 0.68f, 0.31f, 1f);
    [SerializeField] private Color errorColor = new Color(0.85f, 0.25f, 0.25f, 1f);
    [SerializeField] private Color infoColor = new Color(0.25f, 0.5f, 0.9f, 1f);

    [Header("Opsi")]
    [Tooltip("MATI untuk kasus kamu: hanya tampilkan gagal/offline/sudah dipakai. Valid langsung masuk game tanpa toast.")]
    [SerializeField] private bool showValidToast = false;

    [Header("Config (disarankan)")]
    [Tooltip("Kalau diisi, semua kalimat diambil dari asset ini. Kalau kosong, pakai fallback di bawah.")]
    [SerializeField] private ScanNotifConfig config;

    [Header("Fallback kalau Config kosong (jangan edit kalau sudah pakai Config)")]
    [TextArea] public string msgScanUlang = "Tiket tidak terbaca. Silakan scan ulang dengan jelas.";
    [TextArea] public string msgBukanEvent = "QR tidak valid. Gunakan tiket resmi.";
    [TextArea] public string msgSudahDipakai = "Tiket ini sudah digunakan.";
    [TextArea] public string msgDipakaiMesinLain = "Tiket sedang dipakai di mesin lain.";
    [TextArea] public string msgOffline = "Mesin sedang offline. Mohon hubungi petugas.";
    [TextArea] public string msgGagalKirim = "Gagal menghubungi server. Coba scan lagi.";

    private Coroutine _routine;

    private void Awake()
    {
        if (session == null) session = FindObjectOfType<GachaSession>();
        if (toastGroup == null) toastGroup = GetComponent<CanvasGroup>();
        if (toastBg == null) toastBg = GetComponent<Image>();
        if (toastText == null) toastText = GetComponentInChildren<TextMeshProUGUI>();
        toastGroup.alpha = 0f;
        toastGroup.interactable = false;
        toastGroup.blocksRaycasts = false;
    }

    private void OnEnable()
    {
        if (session == null) return;
        if (showValidToast) session.OnTicketValid.AddListener(ShowValid);
        session.OnTicketRejected.AddListener(ShowError);
        session.OnConnectionChanged.AddListener(ShowInfo);
        session.OnDispenserStatus.AddListener(ShowDispenser);
    }

    private void OnDisable()
    {
        if (session == null) return;
        session.OnTicketValid.RemoveListener(ShowValid);
        session.OnTicketRejected.RemoveListener(ShowError);
        session.OnConnectionChanged.RemoveListener(ShowInfo);
        session.OnDispenserStatus.RemoveListener(ShowDispenser);
    }

    private string Msg(string fallback, System.Func<ScanNotifConfig, string> fromConfig)
    {
        if (config != null) { try { return fromConfig(config) ?? fallback; } catch { } }
        return fallback;
    }

    public void ShowValid(string ticketId)
    {
        Show($"Tiket valid — selamat bermain! ({ticketId})", validColor, showDuration);
    }

    /// <summary>
    /// Notif dispenser (dipanggil otomatis via GachaSession.OnDispenserStatus).
    /// Sukses/proses = hijau, gagal/tidak tersambung = merah.
    /// </summary>
    public void ShowDispenser(string msg)
    {
        string m = (msg ?? "").ToUpperInvariant();
        bool fail = m.Contains("TIDAK TERSAMBUNG") || m.Contains("BELUM SIAP")
            || m.Contains("GAGAL") || m.Contains("PETUGAS");
        Show(msg, fail ? errorColor : validColor, showDuration);
    }

    public void ShowError(string raw)
    {
        Show(FriendlyMessage(raw), errorColor, showDuration);
        StopCoroutineSafe(ShakeRoutine());
    }

    public void ShowInfo(string msg)
    {
        if (config != null && !config.tampilkanInfoKoneksi) return;
        // Biru koneksi: hanya tampilkan saat putus, biar tidak muncul tiap awal play
        if (msg.Contains("terputus") || msg.Contains("Terputus") || msg.Contains("OFFLINE"))
            Show(Msg(msgOffline, c => c.offline), infoColor, 2f);
    }

    // Terjemahkan reason teknis (TOO_SHORT / OFFLINE / ALREADY_USED / dll)
    // jadi bahasa pengunjung. Sumber: Config asset (kalau diisi), else fallback.
    private string FriendlyMessage(string raw)
    {
        string scanUlang = Msg(msgScanUlang, c => c.scanUlang);
        if (string.IsNullOrEmpty(raw)) return scanUlang;
        string m = raw.ToUpperInvariant();
        if (m.Contains("OFFLINE") || m.Contains("TERPUTUS") || m.Contains("TIDAK TERHUBUNG"))
            return Msg(msgOffline, c => c.offline);
        if (m.Contains("SEND_FAIL") || m.Contains("GAGAL KIRIM"))
            return Msg(msgGagalKirim, c => c.gagalKirim);
        if (m.Contains("ALREADY_USED") || m.Contains("SUDAH PERNAH") || m.Contains("SUDAH DIGUNAKAN") || m.Contains("DIGUNAKAN"))
            return Msg(msgSudahDipakai, c => c.sudahDipakai);
        if (m.Contains("PENDING") || m.Contains("DIPROSES") || m.Contains("MESIN LAIN"))
            return Msg(msgDipakaiMesinLain, c => c.dipakaiMesinLain);
        if (m.Contains("INVALID_EVENT") || m.Contains("BUKAN UNTUK EVENT") || m.Contains("TIDAK VALID"))
            return Msg(msgBukanEvent, c => c.tidakValid);
        // TOO_SHORT, TOO_LONG, INVALID_FORMAT, format lokal, dll → scan ulang
        if (m.Contains("TOO_") || m.Contains("INVALID") || m.Contains("FORMAT") || m.Contains("DITOLAK"))
            return scanUlang;
        return raw; // fallback: tampilkan apa adanya
    }

    public void Show(string msg, Color bg, float dur)
    {
        if (_routine != null) StopCoroutine(_routine);
        _routine = StartCoroutine(ToastRoutine(msg, bg, dur));
    }

    private IEnumerator ToastRoutine(string msg, Color bg, float dur)
    {
        toastText.text = msg;
        if (toastBg != null) toastBg.color = bg;

        // muncul
        toastGroup.alpha = 1f;
        transform.localScale = Vector3.one * 0.95f;
        float t = 0f;
        while (t < popDuration)
        {
            t += Time.unscaledDeltaTime;
            transform.localScale = Vector3.Lerp(Vector3.one * 0.95f, Vector3.one, t / popDuration);
            yield return null;
        }
        transform.localScale = Vector3.one;

        yield return new WaitForSecondsRealtime(Mathf.Max(0.1f, dur));

        // fade out
        t = 0f;
        while (t < fadeDuration)
        {
            t += Time.unscaledDeltaTime;
            toastGroup.alpha = 1f - (t / fadeDuration);
            yield return null;
        }
        toastGroup.alpha = 0f;
        _routine = null;
    }

    private IEnumerator ShakeRoutine()
    {
        RectTransform rt = transform as RectTransform;
        if (rt == null) yield break;
        Vector2 start = rt.anchoredPosition;
        float t = 0f;
        while (t < 0.3f)
        {
            t += Time.unscaledDeltaTime;
            rt.anchoredPosition = start + Vector2.right * Mathf.Sin(t * 50f) * 8f * (1f - t / 0.3f);
            yield return null;
        }
        rt.anchoredPosition = start;
    }

    private void StopCoroutineSafe(IEnumerator routine)
    {
        StartCoroutine(routine);
    }
}
