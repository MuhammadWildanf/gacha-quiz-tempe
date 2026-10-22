using System;

[Serializable]
public class ScanQrMessage
{
    public string type = "scan_qr";
    public string qrCode;
    public string machineId;
}

[Serializable]
public class GameFinishMessage
{
    public string type = "game_finish";
    public string qrCode;
    public string machineId;
    // Hasil quiz dari GameManagerGatcha.EndQuiz() (totalScore = koin)
    public int score;
    public int maxScore;
    public bool isWin;
    public string prizeTier;
}

[Serializable]
public class ServerMessage
{
    public string type;
    public bool success;
    public string reason;
    public string message;
    public string ticketId;
    public string usedAt;
    public string qrCode;
    public string machineId;
    public int count;
    // Hasil + status dispense (untuk platform & UI)
    public int score;
    public int maxScore;
    public bool isWin;
    public string prizeTier;
    public string dispenseStatus;
}