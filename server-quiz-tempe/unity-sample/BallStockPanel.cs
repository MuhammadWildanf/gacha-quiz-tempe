using UnityEngine;

/// <summary>
/// Panel stok bola darurat (langsung muncul, tanpa drag UI).
/// Tempel di GameObject mana saja → Play → muncul box di layar.
/// - Lihat sisa stok live
/// - Ketik angka (misal 50) → tombol Set = isi ulang tabung
/// - Tombol +10 / -1 / Isi 50 buat cepat
/// Hapus file ini kalau input stok sudah dipasang permanen di SettingsPanel.
/// </summary>
public class BallStockPanel : MonoBehaviour
{
    [Tooltip("Posisi box di layar.")]
    [SerializeField] private Rect boxRect = new Rect(10, 130, 300, 150);
    [Tooltip("Stok default saat tombol Isi 50 dipencet.")]
    [SerializeField] private int defaultFull = 50;

    private string _input = "50";
    private bool _started;

    private void Start()
    {
        _started = true;
        if (BallDispenserManager.Instance != null)
            _input = BallDispenserManager.Instance.GetStock().ToString();
    }

    private void OnGUI()
    {
        if (BallDispenserManager.Instance == null)
        {
            GUILayout.BeginArea(new Rect(10, 130, 300, 60), GUI.skin.box);
            GUILayout.Label("<b>STOK BOLA</b>");
            GUILayout.Label("Manager tidak ada di scene!");
            GUILayout.EndArea();
            return;
        }

        int stok = BallDispenserManager.Instance.GetStock();
        string warna = stok <= 0 ? "<color=red><b>HABIS</b></color>" : $"<b>{stok}</b>";
        GUILayout.BeginArea(boxRect, GUI.skin.box);
        GUILayout.Label($"<b>STOK BOLA: {warna}</b>");
        GUILayout.BeginHorizontal();
        GUILayout.Label("Isi:", GUILayout.Width(30));
        _input = GUILayout.TextField(_input, GUILayout.Width(60));
        if (GUILayout.Button("Set")) ApplyInput();
        GUILayout.EndHorizontal();
        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Isi 50")) SetStock(defaultFull);
        if (GUILayout.Button("+10")) SetStock(stok + 10);
        if (GUILayout.Button("-1")) SetStock(stok - 1);
        GUILayout.EndHorizontal();
        if (stok <= 0) GUILayout.Label("<color=red>Stok habis — PUSH ditolak!</color>");
        GUILayout.EndArea();
    }

    private void ApplyInput()
    {
        if (int.TryParse(_input.Trim(), out int v) && v >= 0) SetStock(v);
        else Debug.LogWarning("[STOK-UI] Input harus angka >= 0 (misal 50).");
    }

    private void SetStock(int v)
    {
        BallDispenserManager.Instance.SetStock(v, "(dari BallStockPanel)");
        _input = v.ToString();
    }
}
