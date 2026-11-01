using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

// ─────────────────────────────────────────
//  QUESTION CONTROLLER
//  Pasang script ini di root prefab pertanyaan.
// ─────────────────────────────────────────

public class QuestionController : MonoBehaviour
{
    // ──────────────────────────────────────
    //  INSPECTOR REFERENCES
    // ──────────────────────────────────────

    [Header("Question UI")]
    [Tooltip("Text untuk menampilkan teks pertanyaan")]
    public TMP_Text questionText;

    [Tooltip("Image untuk menampilkan gambar soal (opsional)")]
    public Image questionImage;

    [Tooltip("GameObject yang membungkus questionImage (disembunyikan jika tidak ada gambar)")]
    public GameObject questionImageContainer;

    [Header("Timer UI")]
    [Tooltip("Slider untuk menampilkan sisa waktu")]
    public Slider timerSlider;
    public Color ColGreen;
    public Color ColRed;

    [Tooltip("Text angka sisa waktu")]
    public TMP_Text timerText;

    [Header("Answer Buttons")]
    [Tooltip("List button pilihan jawaban (A, B, C, D) — urut sesuai index)")]
    public List<Button> answerButtons;

    [Tooltip("List text pada setiap button jawaban")]
    public List<TMP_Text> answerTexts;

    [Header("Answer Feedback Sprites")]
    [Tooltip("Sprite default tombol jawaban saat baru muncul")]
    public Sprite defaultSprite;

    [Tooltip("Sprite tombol ketika jawaban BENAR")]
    public Sprite correctSprite;
   // public GameObject benar;

    [Tooltip("Sprite tombol ketika jawaban SALAH")]
    public Sprite wrongSprite;
    //public GameObject salah;
    // ──────────────────────────────────────
    //  RUNTIME STATE
    // ──────────────────────────────────────

    private GameManagerGatcha gameManager;
    private QuestionData questionData;
    private bool answered = false;

    // ──────────────────────────────────────
    //  INIT
    // ──────────────────────────────────────

    private void Awake()
    {
        gameManager = FindObjectOfType<GameManagerGatcha>();

        if (gameManager == null)
            Debug.LogError("[QuestionController] GameManager tidak ditemukan di scene!");
    }

    /// <summary>
    /// Dipanggil oleh GameManager setelah prefab di-spawn.
    /// Mengisi semua elemen UI dengan data pertanyaan.
    /// </summary>
    public void Initialize(QuestionData data)
    {
        questionData = data;
        answered = false;

        // reset hasil jawaban
        gameManager.resetIndikatorJawaban();
        // Teks pertanyaan
        if (questionText != null)
            questionText.text = data.question;

        // Gambar pertanyaan (opsional)
        bool hasImage = !string.IsNullOrEmpty(data.image);
        if (questionImageContainer != null)
            questionImageContainer.SetActive(hasImage);

        // Timer slider
        if (timerSlider != null)
        {
            timerSlider.minValue = 0f;
            timerSlider.maxValue = data.timer;
            timerSlider.value = data.timer;
        }

        if (timerText != null)
            timerText.text = data.timer.ToString();

        // Isi dan daftarkan tombol jawaban
        for (int i = 0; i < answerButtons.Count; i++)
        {
            if (i < data.answers.Count)
            {
                answerButtons[i].gameObject.SetActive(true);

                // Isi teks
                if (i < answerTexts.Count && answerTexts[i] != null)
                    answerTexts[i].text = data.answers[i];

                // Reset tombol menggunakan SPRITE DEFAULT
                SetButtonSprite(answerButtons[i], defaultSprite, false);
                //answerTexts[i].color = 

                // Daftarkan klik — capture index lokal
                int capturedIndex = i;
                answerButtons[i].onClick.RemoveAllListeners();
                answerButtons[i].onClick.AddListener(() => OnAnswerSelected(capturedIndex));
                answerButtons[i].interactable = true;
            }
            else
            {
                // Sembunyikan tombol berlebih jika jawaban < 4
                answerButtons[i].gameObject.SetActive(false);
            }
        }
    }

    // ──────────────────────────────────────
    //  TIMER UPDATE
    // ──────────────────────────────────────

    public void UpdateTimerUI(float remaining, float total)
    {
        if (timerSlider != null)
            timerSlider.value = remaining;

        if (timerText != null)
            timerText.text = Mathf.CeilToInt(remaining).ToString();

        // Ubah warna timer saat sisa waktu < 30%
        if (timerText != null)
        {
            timerText.color = (remaining / total < 0.3f) ? ColRed : ColGreen;
        }
    }
    // ──────────────────────────────────────
    //  ANSWER SELECTION
    // ──────────────────────────────────────

    private void OnAnswerSelected(int index)
    {
        if (answered) return;
        answered = true;

        // HAPUS atau COMMENT baris btn.interactable = false
        // foreach (var btn in answerButtons) btn.interactable = false;

        // Kirim ke GameManager untuk dihitung
        gameManager?.SubmitAnswer(index);
    }

    /// <summary>
    /// Tampilkan feedback visual benar/salah menggunakan SPRITE setelah jawaban masuk.
    /// </summary>
    public void ShowAnswerFeedback(int selectedIndex, int correctIndex, bool isCorrect)
    {
        for (int i = 0; i < answerButtons.Count; i++)
        {
            if (!answerButtons[i].gameObject.activeSelf) continue;

            if (i == correctIndex)
            {
                // JAWABAN BENAR: Ganti ke sprite benar, warna TERANG (false)
                SetButtonSprite(answerButtons[i], correctSprite, false);
                answerTexts[i].color = Color.white;
                
            }
            else if (i == selectedIndex && !isCorrect)
            {
                // JAWABAN SALAH YANG DIPILIH PEMAIN: Ganti ke sprite salah, warna TERANG (false)
                SetButtonSprite(answerButtons[i], wrongSprite, false);
                answerTexts[i].color = Color.white;
                

            }
            else
            {
                // JAWABAN SALAH YANG TIDAK DIPILIH: Tetap sprite default, tapi REDUP (true)
                SetButtonSprite(answerButtons[i], defaultSprite, true);
                
            }
        }
        gameManager.jawaban(isCorrect);
    }

    // ──────────────────────────────────────
    //  HELPER (MENGGANTI SPRITE & REDUP)
    // ──────────────────────────────────────

    private void SetButtonSprite(Button button, Sprite targetSprite, bool isDimmed)
    {
        if (targetSprite == null) return;

        // 1. Matikan transisi bawaan button agar Unity tidak menimpa warna/redup kita
        button.transition = Selectable.Transition.None;

        // 2. Ambil komponen Image utama pada Button
        Image img = button.GetComponent<Image>();

        if (img != null)
        {
            img.sprite = targetSprite;

            // 3. Jika isDimmed true, warnanya agak abu-abu gelap. Jika false, putih terang.
            img.color = isDimmed ? new Color(0.5f, 0.5f, 0.5f, 1f) : Color.white;
        }
    }
}