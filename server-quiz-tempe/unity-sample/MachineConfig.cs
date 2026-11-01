using System;

/// <summary>
/// Data pengaturan per mesin. Disimpan di PlayerPrefs via SettingsStore.
/// Inspector = default pabrik (build pertama). Nilai tersimpan = override per mesin.
/// </summary>
[Serializable]
public class MachineConfig
{
    public string serverWsUrl = "ws://localhost:3005";
    public string quizApiUrl = "http://localhost:3011/api/quiz";
    public string machineId = "GAME-01";
    public string dispenserPort = "COM3";
    public bool dispenserAutoDetect = false;
    public int dispenserBaudRate = 115200;
    // Stok bola di tabung. Diisi fisik 50 → input 50 di sistem.
    // Berkurang 1 tiap menang beneran (PUSH terkirim). 0 = tolak trigger.
    public int ballStock = 50;
    public int ballLowThreshold = 5;

    // Pengaturan game kuis — override Inspector, berlaku tanpa rebuild.
    public int pointsPerCorrect = 20; // poin per jawaban benar
    public int maxQuestions = 5;      // jumlah soal per sesi (0 = semua)

    public MachineConfig Clone()
    {
        return (MachineConfig)MemberwiseClone();
    }

    public bool IsValid(out string error)
    {
        if (string.IsNullOrWhiteSpace(serverWsUrl) ||
            (!serverWsUrl.StartsWith("ws://") && !serverWsUrl.StartsWith("wss://")))
        {
            error = "URL Server harus ws:// atau wss:// (contoh ws://192.168.88.32:3005)";
            return false;
        }
        if (string.IsNullOrWhiteSpace(quizApiUrl) ||
            (!quizApiUrl.StartsWith("http://") && !quizApiUrl.StartsWith("https://")))
        {
            error = "URL Kuis harus http:// atau https:// (contoh http://192.168.88.32:3011/api/quiz)";
            return false;
        }
        if (string.IsNullOrWhiteSpace(machineId))
        {
            error = "Machine ID tidak boleh kosong (contoh GAME-01). Tiap mesin harus beda.";
            return false;
        }
        if (!dispenserAutoDetect && string.IsNullOrWhiteSpace(dispenserPort))
        {
            error = "Port dispenser kosong. Pilih COM atau nyalakan Auto-detect.";
            return false;
        }
        if (ballStock < 0)
        {
            error = "Stok bola tidak boleh minus. Isi sesuai jumlah di tabung (misal 50).";
            return false;
        }
        error = null;
        return true;
    }
}
