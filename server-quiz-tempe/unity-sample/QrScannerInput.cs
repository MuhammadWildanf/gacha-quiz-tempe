using System;
using System.Text;
using UnityEngine;

public class QrScannerInput : MonoBehaviour
{
    public event Action<string> OnScanned;
    public event Action<string, string> OnScanRejected;

    [SerializeField] private bool scanEnabled = true;
    [Tooltip("QR vendor 171 char — scan pendek/potong langsung dibuang (hanya berlaku jika validateFormatLocally aktif)")]
    [SerializeField] private int minChars = 171;
    [SerializeField] private float pendingTimeout = 0.5f;

    [Header("Mode Validasi")]
    [Tooltip("TRUE = Cek ketat offline 171 char di Unity. FALSE = Mode API / Fleksibel (loloskan scan dan serahkan validasi ke JS Server / API Vendor).")]
    [SerializeField] private bool validateFormatLocally = true;

    [Header("Format Vendor (mirror server.js parseVendorQR)")]
    [Tooltip("Harus sama dengan VENDOR_PREFIX di server.js")]
    [SerializeField] private string vendorPrefix = "Y5X01g9AWhfSmj5BTjbhA";
    [Tooltip("Harus sama dengan VENDOR_MIDDLE di server.js")]
    [SerializeField] private string vendorMiddle = "30sfVreDY0RP7ccjOL5L81Xv_Kw5Cv8Ns1Y-J-K1C9GBKsvVTcPHvI--8gzAfTh4Qx2MYCzQSx2HOuW8RX8";
    [Tooltip("Harus sama dengan VENDOR_MIDDLE_POS di server.js")]
    [SerializeField] private int vendorMiddlePos = 65;

    private StringBuilder _buffer = new StringBuilder();
    private float _lastInputTime = -1f;

    public bool ScanEnabled
    {
        get => scanEnabled;
        set
        {
            scanEnabled = value;
            if (!value) ClearBuffer();
        }
    }

    public int MinChars
    {
        get => minChars;
        set => minChars = value;
    }

    private void Update()
    {
        if (!scanEnabled) return;

        foreach (char c in Input.inputString)
        {
            if (c == '\r' || c == '\n')
            {
                Submit();
                continue;
            }
            if (c == '\b')
            {
                if (_buffer.Length > 0) _buffer.Length--;
                continue;
            }
            _buffer.Append(c);
            _lastInputTime = Time.unscaledTime;
        }

        if (_buffer.Length > 0 && Time.unscaledTime - _lastInputTime > pendingTimeout)
        {
            ClearBuffer();
        }
    }

    private void Submit()
    {
        string code = _buffer.ToString().Trim();
        ClearBuffer();
        if (string.IsNullOrEmpty(code) || code.Length < 3) return;

        if (validateFormatLocally)
        {
            string rejectReason = ValidateFormat(code);
            if (rejectReason != null)
            {
                Debug.LogWarning($"[2/6][SCAN] ⛔ DITOLAK-LOKAL {rejectReason} code={Short(code)} — cek minChars/prefix/middle.");
                OnScanRejected?.Invoke(code, rejectReason);
                return;
            }
            Debug.Log($"[2/6][SCAN] ✅ Format lokal lolos {Short(code)} → teruskan ke GachaSession.");
        }
        else
        {
            Debug.Log($"[2/6][SCAN] 🌐 Mode Fleksibel/API: Langsung kirim scan {Short(code)} ke JS Server.");
        }

        OnScanned?.Invoke(code);
    }

    // Mirror server.js parseVendorQR — urutan cek sama persis.
    // Return null jika lolos, atau reason string jika ditolak.
    public string ValidateFormat(string code)
    {
        if (code.Length != minChars)
        {
            if (code.Length < minChars)
                return $"TOO_SHORT len={code.Length} min={minChars}";
            return $"TOO_LONG len={code.Length} min={minChars}";
        }
        if (!IsBase64Url(code))
            return "INVALID_FORMAT charset bukan base64url [A-Za-z0-9-_]";
        if (!code.StartsWith(vendorPrefix))
            return "INVALID_EVENT prefix tidak cocok";
        if (code.IndexOf(vendorMiddle) != vendorMiddlePos)
            return $"INVALID_EVENT middle tidak di pos {vendorMiddlePos}";
        return null;
    }

    private static bool IsBase64Url(string s)
    {
        foreach (char c in s)
        {
            bool ok = (c >= 'A' && c <= 'Z')
                || (c >= 'a' && c <= 'z')
                || (c >= '0' && c <= '9')
                || c == '-' || c == '_';
            if (!ok) return false;
        }
        return true;
    }

    private void ClearBuffer()
    {
        _buffer.Length = 0;
        _lastInputTime = -1f;
    }

    private static string Short(string s)
    {
        if (string.IsNullOrEmpty(s)) return "(kosong)";
        if (s.Length <= 16) return $"{s} (len={s.Length})";
        return $"{s.Substring(0, 8)}...{s.Substring(s.Length - 6)} (len={s.Length})";
    }
}