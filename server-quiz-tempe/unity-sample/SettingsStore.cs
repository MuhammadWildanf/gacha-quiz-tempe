using UnityEngine;

/// <summary>
/// Load/save MachineConfig di PlayerPrefs (per mesin, tetap setelah tutup & update build).
/// Key prefix: mp_cfg_*
/// </summary>
public static class SettingsStore
{
    private const string K_WS = "mp_cfg_ws";
    private const string K_QUIZ = "mp_cfg_quiz";
    private const string K_MID = "mp_cfg_mid";
    private const string K_COM = "mp_cfg_com";
    private const string K_AUTO = "mp_cfg_auto";
    private const string K_BAUD = "mp_cfg_baud";
    private const string K_STOCK = "mp_cfg_stock";
    private const string K_STOCK_LOW = "mp_cfg_stock_low";

    public static bool HasSaved()
    {
        return PlayerPrefs.HasKey(K_WS) || PlayerPrefs.HasKey(K_MID) || PlayerPrefs.HasKey(K_COM);
    }

    public static MachineConfig Load(MachineConfig defaults)
    {
        MachineConfig cfg = (defaults ?? new MachineConfig()).Clone();
        if (!HasSaved()) return cfg; // build pertama: pakai default Inspector
        cfg.serverWsUrl = PlayerPrefs.GetString(K_WS, cfg.serverWsUrl);
        cfg.quizApiUrl = PlayerPrefs.GetString(K_QUIZ, cfg.quizApiUrl);
        cfg.machineId = PlayerPrefs.GetString(K_MID, cfg.machineId);
        cfg.dispenserPort = PlayerPrefs.GetString(K_COM, cfg.dispenserPort);
        cfg.dispenserAutoDetect = PlayerPrefs.GetInt(K_AUTO, cfg.dispenserAutoDetect ? 1 : 0) == 1;
        cfg.dispenserBaudRate = PlayerPrefs.GetInt(K_BAUD, cfg.dispenserBaudRate);
        if (cfg.dispenserBaudRate <= 0) cfg.dispenserBaudRate = 115200;
        cfg.ballStock = PlayerPrefs.GetInt(K_STOCK, cfg.ballStock);
        if (cfg.ballStock < 0) cfg.ballStock = 0;
        cfg.ballLowThreshold = PlayerPrefs.GetInt(K_STOCK_LOW, cfg.ballLowThreshold);
        if (cfg.ballLowThreshold < 0) cfg.ballLowThreshold = 5;
        return cfg;
    }

    public static void Save(MachineConfig cfg)
    {
        if (cfg == null) return;
        PlayerPrefs.SetString(K_WS, cfg.serverWsUrl.Trim());
        PlayerPrefs.SetString(K_QUIZ, cfg.quizApiUrl.Trim());
        PlayerPrefs.SetString(K_MID, cfg.machineId.Trim());
        PlayerPrefs.SetString(K_COM, cfg.dispenserPort.Trim());
        PlayerPrefs.SetInt(K_AUTO, cfg.dispenserAutoDetect ? 1 : 0);
        PlayerPrefs.SetInt(K_BAUD, cfg.dispenserBaudRate);
        PlayerPrefs.SetInt(K_STOCK, Mathf.Max(0, cfg.ballStock));
        PlayerPrefs.SetInt(K_STOCK_LOW, Mathf.Max(0, cfg.ballLowThreshold));
        PlayerPrefs.Save();
        Debug.Log("[Settings] Tersimpan ke PlayerPrefs (permanen per mesin).");
    }

    /// <summary> moderate: kembalikan ke default pabrik (hapus override mesin). Perlu restart scene/play. </summary>
    public static void ClearSaved()
    {
        PlayerPrefs.DeleteKey(K_WS);
        PlayerPrefs.DeleteKey(K_QUIZ);
        PlayerPrefs.DeleteKey(K_MID);
        PlayerPrefs.DeleteKey(K_COM);
        PlayerPrefs.DeleteKey(K_AUTO);
        PlayerPrefs.DeleteKey(K_BAUD);
        PlayerPrefs.DeleteKey(K_STOCK);
        PlayerPrefs.DeleteKey(K_STOCK_LOW);
        PlayerPrefs.Save();
    }
}
