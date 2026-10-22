// ============================================================================
// CARA PAKAI (salah satu):
// A. Otomatis saat Play: copy SettingsPanelBootstrap.cs, tempel ke GameObject
//    mana saja (misal DispenserManager). Tidak butuh file ini sama sekali.
// B. Via menu: simpan file ini di folder "Editor", klik TEMPE -> Build Settings Panel.
// ============================================================================
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using TMPro;

public static class SettingsPanelBuilder
{
    [MenuItem("TEMPE/Build Settings Panel")]
    public static void Build()
    {
        Canvas canvas = PickTopCanvas();
        if (canvas == null)
        {
            Debug.LogError("[Builder] Tidak ada Canvas di scene. Batal.");
            return;
        }

        GameObject old = GameObject.Find("SettingsRoot");
        if (old != null) Undo.DestroyObjectImmediate(old);

        TMP_FontAsset font = ResolveFont();
        SettingsPanelRefs refs = SettingsPanelFactory.Build(canvas, font);
        Undo.RegisterCreatedObject(refs.root, "Build Settings Panel");

        SettingsPanel panel = Undo.AddComponent<SettingsPanel>(refs.root);
        panel.Wire(
            refs.dim, refs.panel,
            refs.server, refs.quiz, refs.mid,
            refs.auto, refs.com,
            refs.ws, refs.disp, refs.footer,
            refs.refresh, refs.test, refs.save, refs.cancel, refs.close, refs.dimBtn);

        EditorSceneManager.MarkSceneDirty(EditorSceneManager.GetActiveScene());
        Selection.activeGameObject = refs.root;
        Debug.Log("[Builder] SettingsRoot jadi di Canvas '" + canvas.name + "'. Play → tap pojok kiri 3x + kanan 3x untuk buka.");
    }

    private static Canvas PickTopCanvas()
    {
        Canvas[] all = Object.FindObjectsOfType<Canvas>();
        Canvas best = null;
        foreach (Canvas c in all)
        {
            if (best == null || c.sortingOrder > best.sortingOrder) best = c;
        }
        return best;
    }

    private static TMP_FontAsset ResolveFont()
    {
        TextMeshProUGUI any = Object.FindObjectOfType<TextMeshProUGUI>();
        if (any != null && any.font != null) return any.font;
        string[] guids = AssetDatabase.FindAssets("LiberationSans SDF");
        foreach (string g in guids)
        {
            TMP_FontAsset f = AssetDatabase.LoadAssetAtPath<TMP_FontAsset>(AssetDatabase.GUIDToAssetPath(g));
            if (f != null) return f;
        }
        return null;
    }
}
#endif
