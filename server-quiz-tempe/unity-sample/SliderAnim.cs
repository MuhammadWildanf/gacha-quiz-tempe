using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UIElements;

public class SliderAnim : MonoBehaviour, IDragHandler
{
    public GameManagerGatcha gameManager;
 
    [Header("Parent Size Settings")]
    [SerializeField] private float minX = 100f;  // Batas minimum lebar parent
    [SerializeField] private float maxX = 500f;  // Batas maksimum lebar parent
    [SerializeField] private RectTransform parentRectTransform; // Tarik game object parent ke sini di Inspector
    [SerializeField] private float minWidth = 100f;  // Batas minimum lebar parent
    [SerializeField] private float maxWidth = 500f;  // Batas maksimum lebar parent

    [Header("Animation Settings")]
    [SerializeField] private Animator animator; // Tarik Animator Anda ke sini di Inspector
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
    

    void IDragHandler.OnDrag(PointerEventData eventData)
    {
        Vector3 position = transform.localPosition;
        transform.localPosition = new Vector3(Mathf.Clamp(position.x + eventData.delta.x, minX, maxX), position.y, position.z);

        // 2. Mengubah lebar (width) Parent
        if (parentRectTransform != null)
        {
            // Ambil ukuran parent saat ini
            Vector2 parentSize = parentRectTransform.sizeDelta;

            // Tambahkan delta x dari drag ke lebar parent saat ini
            float newWidth = parentSize.x + eventData.delta.x;

            // Batasi lebarnya sesuai min dan max yang ditentukan
            newWidth = Mathf.Clamp(newWidth, minWidth, maxWidth);

            // Terapkan lebar baru ke parent (tinggi/height tetap sama)
            parentRectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, newWidth);

            if (newWidth >= maxWidth && animator != null)
            {
                // Menjalankan animator dengan set integer "Pertanyaan" menjadi 1
                animator.SetInteger("Pertanyaan", 1);
                // reset posisi slider
                StartCoroutine(ResetRoutine());
                // ATAU jika parameter di Animator Anda berbentuk Trigger, gunakan ini:
                // animator.SetTrigger("Pertanyaan");
                if (gameManager != null)
                {
                    gameManager.Invoke("RestartQuiz", 1.0f);
                }
                
            }

        }
        else
        {
            Debug.LogWarning("Parent RectTransform belum dimasukkan di Inspector!", this);
        }

        //throw new System.NotImplementedException();
    }
    void resetSlide() {
        
        Vector3 position = transform.localPosition;
        transform.localPosition = new Vector3(minX, position.y, position.z);

        //float newWidth = parentSize.x + eventData.delta.x;

        // Batasi lebarnya sesuai min dan max yang ditentukan
        parentRectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, minWidth);
    }
    private IEnumerator ResetRoutine() {
        yield return new WaitForSeconds(1f);
        resetSlide();
    }
}
