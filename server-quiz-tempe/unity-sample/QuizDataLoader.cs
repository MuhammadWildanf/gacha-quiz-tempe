using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

// ─────────────────────────────────────────
//  DATA MODELS
// ─────────────────────────────────────────

[Serializable]
public class QuizData
{
    public int id;
    public string title;
    public string description;
    public List<QuestionData> questions;
}

[Serializable]
public class QuestionData
{
    public int id;
    public string categoryName;
    public string question;
    public string image;          // null jika tidak ada gambar
    public int timer;             // batas waktu dalam detik
    public List<string> answers;
    public int correctAnswer;     // index jawaban benar (0-based)
}

// ─────────────────────────────────────────
//  QUIZ DATA LOADER
// ─────────────────────────────────────────

public class QuizDataLoader : MonoBehaviour
{
    [Header("API Settings")]
    [Tooltip("URL endpoint untuk mengambil data quiz")]
    public string apiUrl = "http://localhost:3000/api/quiz";

    // Event yang dipanggil saat data berhasil dimuat
    public event Action<QuizData> OnDataLoaded;

    // Event yang dipanggil saat terjadi error
    public event Action<string> OnLoadError;

    // ──────────────────────────────────────
    //  PUBLIC API
    // ──────────────────────────────────────

    /// <summary>
    /// Mulai mengambil data quiz dari server.
    /// Hasil dikembalikan via event OnDataLoaded / OnLoadError.
    /// </summary>
    public void FetchQuizData()
    {
        StartCoroutine(GetQuizCoroutine());
    }

    // ──────────────────────────────────────
    //  INTERNAL
    // ──────────────────────────────────────

    private IEnumerator GetQuizCoroutine()
    {
        Debug.Log($"[QuizDataLoader] Mengambil data dari: {apiUrl}");

        using (UnityWebRequest request = UnityWebRequest.Get(apiUrl))
        {
            request.timeout = 10; // timeout 10 detik
            request.SetRequestHeader("Accept", "application/json");
            request.SetRequestHeader("Content-Type", "application/json");
            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                string json = request.downloadHandler.text;
                Debug.Log($"[QuizDataLoader] Data diterima:\n{json}");

                QuizData data = ParseQuizData(json);

                if (data != null)
                    OnDataLoaded?.Invoke(data);
                else
                    OnLoadError?.Invoke("Gagal mem-parse data JSON dari server.");
            }
            else
            {
                string errorMsg = $"Gagal menghubungi server: {request.error}";
                Debug.LogError($"[QuizDataLoader] {errorMsg}");
                OnLoadError?.Invoke(errorMsg);
            }
        }
    }

    private QuizData ParseQuizData(string json)
    {
        try
        {
            QuizData data = JsonUtility.FromJson<QuizData>(json);
            Debug.Log($"[QuizDataLoader] Quiz dimuat: \"{data.title}\" | " +
                      $"{data.questions.Count} pertanyaan tersedia.");
            return data;
        }
        catch (Exception ex)
        {
            Debug.LogError($"[QuizDataLoader] Error parsing JSON: {ex.Message}");
            return null;
        }
    }
}
