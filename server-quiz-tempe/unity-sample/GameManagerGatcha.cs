using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

// ─────────────────────────────────────────
//  GAME MANAGER
// ─────────────────────────────────────────

public class GameManagerGatcha : MonoBehaviour
{
    // ──────────────────────────────────────
    //  INSPECTOR REFERENCES
    // ──────────────────────────────────────

    [Header("Data Loader")]
    [Tooltip("Referensi ke komponen QuizDataLoader di scene")]
    public QuizDataLoader quizDataLoader;

    [Header("Quiz Settings")]
    [Tooltip("Jumlah pertanyaan yang akan ditampilkan (0 = semua pertanyaan)")]
    [Range(0, 50)]
    public int maxQuestions = 5;

    [Tooltip("Poin untuk setiap jawaban benar")]
    public int pointsPerCorrect = 20;

    [Header("Prefabs")]
    [Tooltip("Prefab untuk satu kartu pertanyaan beserta pilihan jawaban")]
    public GameObject questionPrefab;

    [Header("UI - Gameplay")]
    [Tooltip("Parent object tempat question prefab di-spawn")]
    public Transform questionContainer;

    [Tooltip("Text untuk menampilkan nomor soal saat ini, mis: '1 / 5'")]
    public TMP_Text questionNumberText;

    [Tooltip("Text untuk menampilkan skor sementara")]
    public TMP_Text scoreText;

    [Header("UI - Loading")]
    [Tooltip("Panel yang ditampilkan saat data sedang dimuat")]
    public GameObject loadingPanel;

    [Tooltip("Text pesan loading / error")]
    public TMP_Text loadingMessageText;

    [Header("UI - Result")]
    [Tooltip("Panel yang ditampilkan setelah quiz selesai")]
    public GameObject resultPanel;

    [Tooltip("Text Judul Hasil (misal: 'Selamat!' / 'Maaf!')")]
    public TMP_Text resultTitleText;

    [Tooltip("Text skor akhir pada result panel")]
    public TMP_Text finalScoreText;

    [Tooltip("Text deskripsi hasil (misal: 'Ambil hadiahmu dibawah ini')")]
    public TMP_Text resultDescriptionText;

    [Tooltip("Container / Gambar bola gacha & dispenser (AmbilBola)")]
    public GameObject gachaRewardContainer;

    [Tooltip("Poin minimal yang harus dicapai player untuk mendapatkan Gacha")]
    public int minimumScoreToWin = 60;

    [Header("UI - Indicator")]
    [Tooltip("BG indikator jawaban (opsional)")]
    public GameObject BGbenar;
    public GameObject BGSalah;

    // ──────────────────────────────────────
    //  RUNTIME STATE
    // ──────────────────────────────────────

    private QuizData quizData;
    private List<QuestionData> selectedQuestions = new List<QuestionData>();

    private int currentQuestionIndex = 0;
    private int totalScore = 0;

    private GameObject currentQuestionObject;
    private QuestionController currentQuestionController;

    private Coroutine timerCoroutine;

    // ──────────────────────────────────────
    //  UNITY LIFECYCLE
    // ──────────────────────────────────────

    private void Awake()
    {
        // Baca override pointsPerCorrect & maxQuestions dari PlayerPrefs (Settings Panel).
        ApplyGameConfig();

        // Subscribe ke event loader
        if (quizDataLoader != null)
        {
            quizDataLoader.OnDataLoaded += HandleDataLoaded;
            quizDataLoader.OnLoadError += HandleLoadError;
        }
        else
        {
            Debug.LogError("[GameManager] QuizDataLoader tidak ditemukan! Tambahkan referensinya di Inspector.");
        }
    }

    private void Start()
    {
        //ShowLoadingPanel("Memuat pertanyaan...");
        HideResultPanel();
        UpdateScoreUI();

        // quizDataLoader?.FetchQuizData();
    }

    private void OnDestroy()
    {
        if (quizDataLoader != null)
        {
            quizDataLoader.OnDataLoaded -= HandleDataLoaded;
            quizDataLoader.OnLoadError -= HandleLoadError;
        }
    }

    // ──────────────────────────────────────
    //  GAME CONFIG (dari Settings Panel)
    // ──────────────────────────────────────

    /// <summary>
    /// Baca pointsPerCorrect & maxQuestions dari PlayerPrefs, override nilai Inspector.
    /// Dipanggil otomatis di Awake() dan dari SettingsPanel.Save() agar berlaku
    /// di sesi berikutnya tanpa restart atau rebuild.
    /// </summary>
    public void ApplyGameConfig()
    {
        MachineConfig cfg = SettingsStore.Load(new MachineConfig
        {
            pointsPerCorrect = pointsPerCorrect,
            maxQuestions = maxQuestions
        });
        pointsPerCorrect = Mathf.Max(1, cfg.pointsPerCorrect);
        maxQuestions = Mathf.Max(0, cfg.maxQuestions);
        Debug.Log($"[GameManager] Config diterapkan: pointsPerCorrect={pointsPerCorrect}, maxQuestions={maxQuestions}");
    }

    // ──────────────────────────────────────
    //  DATA HANDLING
    // ──────────────────────────────────────

    private void HandleDataLoaded(QuizData data)
    {
        quizData = data;
        Debug.Log($"[GameManager] Data quiz diterima: {data.questions.Count} pertanyaan total.");

        PrepareQuestions();
        HideLoadingPanel();
        StartQuiz();
    }

    private void HandleLoadError(string errorMessage)
    {
        Debug.LogError($"[GameManager] {errorMessage}");
        ShowLoadingPanel($"⚠ Gagal memuat data:\n{errorMessage}\n\nPeriksa koneksi ke server.");
    }

    // ──────────────────────────────────────
    //  QUIZ SETUP
    // ──────────────────────────────────────

    /// <summary>
    /// Pilih pertanyaan dari list sesuai maxQuestions.
    /// Jika maxQuestions == 0 atau melebihi jumlah soal, ambil semua.
    /// </summary>
    private void PrepareQuestions()
    {
        selectedQuestions.Clear();

        // Salin list agar bisa di-shuffle tanpa mengubah data asli
        List<QuestionData> pool = new List<QuestionData>(quizData.questions);

        // Shuffle (Fisher-Yates) agar urutan acak setiap sesi
        for (int i = pool.Count - 1; i > 0; i--)
        {
            int j = Random.Range(0, i + 1);
            (pool[i], pool[j]) = (pool[j], pool[i]);
        }

        int count = (maxQuestions <= 0 || maxQuestions > pool.Count)
            ? pool.Count
            : maxQuestions;

        for (int i = 0; i < count; i++)
            selectedQuestions.Add(pool[i]);

        Debug.Log($"[GameManager] {selectedQuestions.Count} pertanyaan dipilih untuk sesi ini.");
    }

    // ──────────────────────────────────────
    //  QUIZ FLOW
    // ──────────────────────────────────────

    private void StartQuiz()
    {
        currentQuestionIndex = 0;
        totalScore = 0;
        UpdateScoreUI();
        ShowQuestion(currentQuestionIndex);
    }

    private void ShowQuestion(int index)
    {
        // Hapus pertanyaan sebelumnya
        if (currentQuestionObject != null)
            Destroy(currentQuestionObject);

        StopTimer();

        if (index >= selectedQuestions.Count)
        {
            EndQuiz();
            return;
        }

        QuestionData questionData = selectedQuestions[index];

        // Perbarui counter nomor soal
        if (questionNumberText != null)
            questionNumberText.text = $"{index + 1} / {selectedQuestions.Count}";

        // Spawn prefab pertanyaan
        currentQuestionObject = Instantiate(questionPrefab, questionContainer);
        currentQuestionController = currentQuestionObject.GetComponent<QuestionController>();

        if (currentQuestionController == null)
        {
            Debug.LogError("[GameManager] Prefab tidak memiliki komponen QuestionController!");
            return;
        }

        // Inisialisasi isi pertanyaan (teks + pilihan jawaban)
        currentQuestionController.Initialize(questionData);

        // Mulai timer
        timerCoroutine = StartCoroutine(QuestionTimer(questionData.timer));
    }

    // ──────────────────────────────────────
    //  JAWABAN & TIMER
    // ──────────────────────────────────────

    /// <summary>
    /// Dipanggil oleh QuestionController saat pemain memilih jawaban.
    /// </summary>
    /// <param name="selectedIndex">Index jawaban yang dipilih (0-based)</param>
    public void SubmitAnswer(int selectedIndex)
    {
        StopTimer();

        QuestionData current = selectedQuestions[currentQuestionIndex];
        bool isCorrect = (selectedIndex == current.correctAnswer);

        if (isCorrect)
        {
            totalScore += pointsPerCorrect;
            Debug.Log($"[GameManager] ✓ Jawaban benar! +{pointsPerCorrect} poin. Total: {totalScore}");
        }
        else
        {
            Debug.Log($"[GameManager] ✗ Jawaban salah. Total tetap: {totalScore}");
        }

        // Tampilkan feedback di QuestionController (highlight benar/salah)
        currentQuestionController?.ShowAnswerFeedback(selectedIndex, current.correctAnswer, isCorrect);

        UpdateScoreUI();

        // Jeda sebentar sebelum soal berikutnya
        StartCoroutine(NextQuestionDelay(1.5f));
    }

    private IEnumerator QuestionTimer(int seconds)
    {
        float remaining = seconds;

        while (remaining > 0f)
        {
            remaining -= Time.deltaTime;
            currentQuestionController?.UpdateTimerUI(remaining, seconds);
            yield return null;
        }

        // Waktu habis — otomatis dianggap salah
        Debug.Log("[GameManager] ⏰ Waktu habis! Jawaban dianggap salah.");
        currentQuestionController?.ShowAnswerFeedback(-1, selectedQuestions[currentQuestionIndex].correctAnswer, false);
        UpdateScoreUI();

        yield return new WaitForSeconds(2f);
        MoveToNextQuestion();
    }

    private void StopTimer()
    {
        if (timerCoroutine != null)
        {
            StopCoroutine(timerCoroutine);
            timerCoroutine = null;
        }
    }

    private IEnumerator NextQuestionDelay(float delay)
    {
        yield return new WaitForSeconds(delay);
        MoveToNextQuestion();
    }

    private void MoveToNextQuestion()
    {
        currentQuestionIndex++;
        ShowQuestion(currentQuestionIndex);
    }

    // ──────────────────────────────────────
    //  END QUIZ
    // ──────────────────────────────────────

    private void EndQuiz()
    {
        /*  Debug.Log($"[GameManager] Quiz selesai! Skor akhir: {totalScore}");

         if (currentQuestionObject != null)
             Destroy(currentQuestionObject);

         ShowResultPanel();
         resetIndikatorJawaban(); */

        if (currentQuestionObject != null)
            Destroy(currentQuestionObject);

        ShowResultPanel();
        resetIndikatorJawaban();

        // TAMBAHKAN INI — kirim skor ke server:
        int maxScore = selectedQuestions.Count * pointsPerCorrect;
        var session = FindObjectOfType<GachaSession>();
        if (session != null)
            session.FinishQuiz(totalScore, maxScore);

    }

    // ──────────────────────────────────────
    //  UI HELPERS
    // ──────────────────────────────────────

    private void UpdateScoreUI()
    {
        if (scoreText != null)
            scoreText.text = $"Skor: {totalScore}";
    }

    private void ShowLoadingPanel(string message)
    {
        if (loadingPanel != null) loadingPanel.SetActive(true);
        if (loadingMessageText != null) loadingMessageText.text = message;
    }

    private void HideLoadingPanel()
    {
        if (loadingPanel != null) loadingPanel.SetActive(false);
    }

    private void ShowResultPanel()
    {
        if (resultPanel != null)
            resultPanel.SetActive(true);

        // Tampilkan teks skor akhir
        if (finalScoreText != null)
            finalScoreText.text = $"Poin mu {totalScore}";

        // --- DINAMISASI HASIL MENANG VS KALAH ---
        bool isWin = totalScore >= minimumScoreToWin;

        if (isWin)
        {
            // Tampilan Menang (Dapat Gacha)
            if (resultTitleText != null)
                resultTitleText.text = "Selamat!";

            if (resultDescriptionText != null)
                resultDescriptionText.text = "Ambil hadiahmu dibawah ini";

            if (gachaRewardContainer != null)
                gachaRewardContainer.SetActive(true);
        }
        else
        {
            // Tampilan Kalah (Tidak Dapat Gacha)
            if (resultTitleText != null)
                resultTitleText.text = "Jangan Berkecil Hati!";

            if (resultDescriptionText != null)
                resultDescriptionText.text = "Poin kamu belum cukup untuk ambil gacha.";

            if (gachaRewardContainer != null)
                gachaRewardContainer.SetActive(false);
        }
    }

    private void HideResultPanel()
    {
        if (resultPanel != null) resultPanel.SetActive(false);
    }

    // ──────────────────────────────────────
    //  PUBLIC: Restart (hubungkan ke tombol)
    // ──────────────────────────────────────

    /// <summary>
    /// Restart quiz dengan mengambil data ulang dari server.
    /// Hubungkan ke tombol "Main Lagi" di result panel.
    /// </summary>
    public void RestartQuiz()
    {
        HideResultPanel();
        ShowLoadingPanel("Memuat ulang pertanyaan...");
        currentQuestionIndex = 0;
        totalScore = 0;
        UpdateScoreUI();
        quizDataLoader?.FetchQuizData();
    }

    public void resetIndikatorJawaban()
    {
        BGbenar.SetActive(false);
        BGSalah.SetActive(false);
    }
    public void jawaban(bool isCorrect)
    {
        if (isCorrect == true)
        {
            BGbenar.SetActive(true);
            BGSalah.SetActive(false);
        }
        else
        {
            BGSalah.SetActive(true);
            BGbenar.SetActive(false);
        }
    }
}
