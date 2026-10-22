using UnityEngine;

/// <summary>
/// Helper TEST sementara tanpa hardware Arduino/ESP32.
/// Tempel di GameObject mana saja, tekan Play, lalu:
/// - Tekan T = simulasi MENANG (panggil BallDispenserManager.TriggerDispenser)
/// - Tekan C = cek status koneksi
/// Lihat hasil di Console + di layar (OnGUI).
/// Hapus script ini kalau hardware sudah datang.
/// </summary>
public class DispenserTestHelper : MonoBehaviour
{
    [Tooltip("Tombol simulasi menang")]
    [SerializeField] private KeyCode testWinKey = KeyCode.T;
    [Tooltip("Tombol cek koneksi")]
    [SerializeField] private KeyCode checkKey = KeyCode.C;

    private string lastStatus = "Belum test. Tekan T (simulasi menang) atau C (cek koneksi).";
    private GachaSession session;

    private void Start()
    {
        session = FindObjectOfType<GachaSession>();
        CheckConnection("START");
    }

    private void Update()
    {
        if (Input.GetKeyDown(checkKey)) CheckConnection("MANUAL");
        if (Input.GetKeyDown(testWinKey)) SimulateWin();
    }

    [ContextMenu("Cek Koneksi")]
    public void CheckConnection(string context = "MENU")
    {
        if (BallDispenserManager.Instance == null)
        {
            lastStatus = $"[{context}] GAGAL: BallDispenserManager tidak ada di scene! Buat GameObject DispenserManager.";
            Debug.LogWarning("[TEST-DISPENSER] " + lastStatus);
            return;
        }

        bool ok = BallDispenserManager.Instance.IsHardwareConnected();
        if (ok)
            lastStatus = $"[{context}] TERHUBUNG: IsHardwareConnected()=true. Siap PUSH.";
        else
            lastStatus = $"[{context}] TIDAK TERHUBUNG (wajar tanpa alat): IsHardwareConnected()=false. Integrasi OK, tinggal colok ESP32.";

        Debug.Log("[TEST-DISPENSER] " + lastStatus);
    }

    [ContextMenu("Simulasi Menang")]
    public void SimulateWin()
    {
        Debug.Log("[TEST-DISPENSER] Simulasi MENANG dipencet (tombol T).");

        // 1) Jalur asli game: kasih tau GachaSession ada kemenangan (buat UI/toast)
        if (session != null)
            Debug.Log("[TEST-DISPENSER] GachaSession ketemu, jalur OnWinConfirmed bisa dipakai buat notif.");

        // 2) Jalur dispenser: panggil persis seperti saat menang beneran
        if (BallDispenserManager.Instance == null)
        {
            lastStatus = "SIMULASI MENANG: GAGAL - Manager tidak ada di scene.";
            Debug.LogError("[TEST-DISPENSER] " + lastStatus);
            return;
        }

        BallDispenserManager.Instance.TriggerDispenser();

        // Tanpa alat, TriggerDispenser akan log:
        // "[Dispenser] Gagal trigger: Port Serial tidak tersambung!"
        // Itu artinya INTEGRASI BERHASIL (perintah sampai ke manager).
        // Kalau ada alat, lognya: "[Dispenser] Perintah 'PUSH' berhasil dikirim ke ESP32."
        lastStatus = "SIMULASI MENANG: TriggerDispenser() dipanggil. Cek Console ada log [Dispenser] = integrasi OK.";
        Debug.Log("[TEST-DISPENSER] " + lastStatus);
    }

    private void OnGUI()
    {
        GUILayout.BeginArea(new Rect(10, 10, 460, 110), GUI.skin.box);
        GUILayout.Label("<b>TEST DISPENSER (hapus kalau alat datang)</b>");
        GUILayout.Label(lastStatus);
        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Cek Koneksi (C)")) CheckConnection("BUTTON");
        if (GUILayout.Button("Simulasi Menang (T)")) SimulateWin();
        GUILayout.EndHorizontal();
        GUILayout.EndArea();
    }
}
