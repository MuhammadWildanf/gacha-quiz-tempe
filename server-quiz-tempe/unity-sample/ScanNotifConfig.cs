using UnityEngine;

/// <summary>
/// Satu sumber kata notif untuk semua mesin/scene.
/// Buat via: Right-click Project > Create > TempePark > Notif Config
/// Lalu drag ke ScanToastNotifier.
/// </summary>
[CreateAssetMenu(fileName = "ScanNotifConfig", menuName = "TempePark/Notif Config")]
public class ScanNotifConfig : ScriptableObject
{
    [Header("Gagal (merah)")]
    [TextArea] public string scanUlang = "Tiket tidak terbaca. Silakan scan ulang dengan jelas.";
    [TextArea] public string tidakValid = "QR tidak valid. Gunakan tiket resmi.";
    [TextArea] public string sudahDipakai = "Tiket ini sudah digunakan.";
    [TextArea] public string dipakaiMesinLain = "Tiket sedang dipakai di mesin lain.";

    [Header("Offline (biru/merah)")]
    [TextArea] public string offline = "Mesin sedang offline. Mohon hubungi petugas.";
    [TextArea] public string gagalKirim = "Gagal menghubungi server. Coba scan lagi.";
    public bool tampilkanInfoKoneksi = false;
}
