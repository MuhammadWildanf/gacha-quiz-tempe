using UnityEngine;
using System.Collections; // Menggunakan Coroutine wajib menyertakan System.Collections

public class ObjectTimerHandler : MonoBehaviour
{
    [Header("Settings")]
    [SerializeField] private float duration = 5f; // Durasi waktu (10 detik)
    [SerializeField] private Animator animator;     // Referensi ke komponen Animator

    [SerializeField] private GachaSession gachaSession;
    // Fungsi ini otomatis berjalan saat Game Object ini aktif/muncul di scene
    private void OnEnable()
    {
        StartCoroutine(ShowAndHideRoutine());
    }

    private IEnumerator ShowAndHideRoutine()
    {
        // 1. Menunggu selama durasi yang ditentukan (10 detik)
        yield return new WaitForSeconds(duration);

        // 2. Jalankan parameter Animator TERLEBIH DAHULU sebelum script mati
        if (animator != null)
        {
            animator.SetInteger("Pertanyaan", 0);
        }
        else
        {
            Debug.LogWarning("Animator belum dimasukkan di Inspector!", this);
        }

        // 3. BARU SETELAH ITU men-disable diri sendiri (Game Object ini)
        this.gameObject.SetActive(false);
        if (gachaSession != null) gachaSession.BackToScan();
        else Debug.LogWarning("GachaSession belum di-assign di Inspector!", this);
    }

    // Jika objek di-disable secara manual sebelum 10 detik, pastikan coroutine berhenti
    private void OnDisable()
    {
        StopAllCoroutines();
    }
}