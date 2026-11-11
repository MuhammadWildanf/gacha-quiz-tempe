using System;
using System.Text;
using UnityEngine;

public class QrScannerInput : MonoBehaviour
{
    public event Action<string> OnScanned;

    [SerializeField] private bool scanEnabled = true;
    [SerializeField] private float pendingTimeout = 0.5f;

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

    private void Update()
    {
        if (!scanEnabled)
            return;

        foreach (char c in Input.inputString)
        {
            if (c == '\r' || c == '\n')
            {
                Submit();
                continue;
            }

            if (c == '\b')
            {
                if (_buffer.Length > 0)
                    _buffer.Length--;
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

        if (string.IsNullOrEmpty(code))
            return;

        Debug.Log($"[2/6][SCAN] Langsung teruskan ke Server/API: {Short(code)}");
        OnScanned?.Invoke(code);
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