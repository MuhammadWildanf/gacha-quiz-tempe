# Panduan Lengkap: Membuat UI Panel Pengaturan (Teknisi)

> **CARA CEPAT (disarankan):** copy `Editor/SettingsPanelBuilder.cs` ke
> `Assets/IMAJIWA-LAB/Scripts/Editor/` (bersama `SettingsPanel.cs` dkk),
> buka scene GACHA, klik menu **TEMPE → Build Settings Panel** — seluruh
> Bagian 2–5 di bawah jadi otomatis. Panduan manual tetap ada kalau mau rapi manual.

Target: 1 modal abu teknisi + hotspot pojok tersembunyi, tanpa PIN.
Acuan layar: portrait **1080 x 1920**. Waktu: ±20 menit.
File script yang dipakai: `SettingsPanel.cs`, `SettingsStore.cs`, `MachineConfig.cs`
(ketiganya sudah ada di folder ini — copy ke `Assets/IMAJIWA-LAB/Scripts/`).

> Prasyarat: package **TextMeshPro** sudah ada (project ini memakainya).
> Semua komponen teks/input/dropdown di bawah memakai varian **TextMeshPro**.
> Jangan pakai `InputField` / `Dropdown` / `Text` lama (tidak bisa di-drag ke slot script).

---

## Bagian 1 — Persiapan (2 menit)

1. Buka scene `GACHA`.
2. Cari Canvas **teratas** (yang `Sort Order`-nya paling besar, sejajar `Toast`). Buka Inspector-nya,
   pastikan `Render Mode = Screen Space - Overlay` dan `Reference Resolution = 1080 x 1920`.
3. Copy 5 file ke `Assets/IMAJIWA-LAB/Scripts/` (timpa yang sama nama):
   - `MachineConfig.cs` (baru)
   - `SettingsStore.cs` (baru)
   - `SettingsPanel.cs` (baru)
   - `GachaSession.cs` (timpa — tambah load setting + getter)
   - `BallDispenserManager.cs` (timpa — tambah `SetSerialConfig` + load setting)
   - `ScanToastNotifier.cs` (timpa — tambah `ShowDispenser`, kalau belum)
4. Tunggu compile selesai, pastikan Console tidak ada error merah.

---

## Bagian 2 — Kerangka objek (3 menit)

Di Canvas teratas, buat struktur ini (klik kanan → urutan menu sesuai nama):

```
Canvas (teratas)
├── Toast (sudah ada, jangan dipindah)
└── SettingsRoot (Create Empty, nama persis ini)
    ├── Dim (UI > Image)
    └── Panel (UI > Image)
```

1. `SettingsRoot`: Create Empty sebagai anak Canvas teratas.
2. `Dim`: klik kanan `SettingsRoot` → UI → Image. Rename `Dim`.
3. `Panel`: klik kanan `SettingsRoot` → UI → Image. Rename `Panel`.
4. Taruh script: klik `SettingsRoot` → Add Component → ketik `SettingsPanel`.

---

## Bagian 3 — Dim + Panel / card (3 menit)

### Dim (latar gelap, klik = Batal)
| Properti | Nilai |
|---|---|
| RectTransform | preset **Stretch** (kiri-atas-kanan-bawah, offset 0 semua) |
| Image Color | hitam, Alpha **190** (`0,0,0,190`) |
| Button | Add Component → Button (tanpa teks) |

### Panel (card abu teknisi)
| Properti | Nilai |
|---|---|
| RectTransform | preset **Middle-Center**, Width **900**, Height **1450** |
| Image Color | `#2B2F36` (abu teknisi). Opsional rounded: isi `Source Image` sprite rounded 9-slice |
| Layout | manual saja (drag satu-satu, lihat Bagian 4). Jangan pakai Layout Group dulu supaya tidak lompat-lompat |

### Simpan posisi awal
- `Dim` dan `Panel`: **uncheck** (nonaktif) di Hierarchy. Script yang menyalakan saat dibuka.
- `SettingsRoot` sendiri **tetap aktif** (hotspot dideteksi dari script, bukan tombol).

---

## Bagian 4 — Isi panel satu-per-satu (10 menit)

Semua anak dari `Panel`. Buat via klik kanan `Panel` → UI → ….
Urutan dari atas ke bawah (Y kira-kira, sesuaikan di Game View):

| # | Objek | Cara buat | Setting penting |
|---|---|---|---|
| 1 | `Title` | UI → Text - TextMeshPro | Teks `PENGATURAN MESIN`, putih, Bold, **48**, alignment tengah, rect atas panel (Y +640, tinggi 80) |
| 2 | `MachineBadge` | UI → Text - TextMeshPro | Teks `-`, abu muda `#AAAAAA`, **28**, di bawah Title. (Diisi otomatis? Tidak — kosongkan, hanya info. Boleh hapus baris ini kalau mau simpel) |
| 3 | `LblServer` | TMP Text | `Server WS (ws://ip:port)`, `#CCCCCC`, **28**, rata kiri |
| 4 | `ServerInput` | UI → Input Field - TextMeshPro | Placeholder `ws://192.168.88.32:3005`, Content Type **Standard**, text **30**, background putih, text color hitam |
| 5 | `LblQuiz` | TMP Text | `API Kuis (http://ip:port/api/quiz)` |
| 6 | `QuizInput` | TMP InputField | Placeholder `http://192.168.88.32:3011/api/quiz` |
| 7 | `LblMID` | TMP Text | `Machine ID (unik per mesin)` |
| 8 | `MidInput` | TMP InputField | Placeholder `GAME-01`, Content Type **Single Line**, Character Limit **20** |
| 9 | `AutoToggle` | UI → Toggle | Label `Auto-detect COM`, teks putih **30**. Biarkan **mati** (OFF) karena scanner menempati COM lain |
| 10 | `LblCOM` | TMP Text | `Port Dispenser (Arduino)` |
| 11 | `ComDropdown` | UI → Dropdown - TextMeshPro | **Hapus semua Options** di Inspector (diisi otomatis). Template default cukup |
| 12 | `RefreshBtn` | UI → Button - TextMeshPro | Teks `Refresh`, lebar ~250, di kanan dropdown |
| 13 | `WsStatus` | TMP Text | Teks `-`, **28** (diisi otomatis ● Terhubung/Terputus) |
| 14 | `DispenserStatus` | TMP Text | Teks `-`, **28** |
| 15 | `TestBtn` | Button-TMP | Teks `Test PUSH`, background abu muda, teks hitam |
| 16 | `Footer` | TMP Text | Teks `-`, kuning muda `#FFE082`, **26**, 2 baris (pesan Simpan/Gagal tampil di sini) |
| 17 | `SaveBtn` | Button-TMP | Teks `Simpan`, background hijau `#1E7E34`, teks putih, Bold |
| 18 | `BatalBtn` | Button-TMP | Teks `Batal`, background abu `#6C757D`, teks putih |
| 19 | `XBtn` | Button-TMP | Teks `X`, kecil 80x80, pojok kanan-atas panel |

Tips cepat: buat 1 label + 1 input yang rapi, lalu **Duplicate (Ctrl+D)** untuk label/input berikutnya, tinggal ganti teksnya.

---

## Bagian 5 — Wiring ke script (3 menit)

Klik `SettingsRoot` (yang ada `SettingsPanel`). Drag dari Hierarchy ke slot:

| Slot script | Drag objek |
|---|---|
| Dim Object | `Dim` |
| Panel Object | `Panel` |
| Server Url Input | `ServerInput` |
| Quiz Url Input | `QuizInput` |
| Machine Id Input | `MidInput` |
| Auto Detect Toggle | `AutoToggle` |
| Com Dropdown | `ComDropdown` |
| Ws Status Text | `WsStatus` |
| Dispenser Status Text | `DispenserStatus` |
| Footer Text | `Footer` |
| Refresh Button | `RefreshBtn` |
| Test Button | `TestBtn` |
| Save Button | `SaveBtn` |
| Cancel Button | `BatalBtn` |
| Close Button | `XBtn` |
| Dim Button | `Dim` (iya, objek yang sama — klik latar = Batal) |

> Tombol tidak perlu dihubungkan manual via OnClick — script mendaftarkan sendiri di `Awake()`.
> Hotspot pojok juga tidak butuh objek — murni deteksi posisi tap di `Update()`.

---

## Bagian 6 — Setter URL kuis (2 menit, wajib)

`QuizDataLoader.cs` (file milik game, di `Assets/IMAJIWA-LAB/Scripts/`) belum punya setter,
jadi URL kuis hanya tersimpan tapi tidak terpakai sampai ini ditambah. Buka file itu,
tambah 1 method di dalam class:

```csharp
public void SetApiUrl(string url)
{
    apiUrl = url;   // sesuaikan nama field kalau di file-mu beda (misal ApiUrl)
    FetchQuizData(); // opsional: langsung muat ulang soal; hapus baris ini kalau method-nya beda nama
}
```

Kalau nama field/metode beda, sesuaikan. `SettingsPanel` otomatis memakai method ini bila ada
(dicari via refleksi, jadi tidak bikin error compile kalau belum ditambah — hanya warning di Console).

---

## Bagian 7 — Testing (5 menit)

1. **Play.** Panel tidak terlihat (benar). Hotspot tidak terlihat (benar).
2. **Buka:** tap/klik pojok **kiri-atas 3x** lalu **kanan-atas 3x** dalam 6 detik.
   Gagal buka? Klik terlalu tengah (area hanya 220 px dari sudut) atau jeda > 6 detik (hitungan reset diam-diam, ulangi).
3. **Isi live:** input terisi nilai sekarang, dropdown COM ada isi, status WS hijau.
4. **Refresh:** cabut-colok USB → Refresh → daftar berubah.
5. **Test:** tekan Test PUSH → motor muter (tanpa alat: log `tidak tersambung`, wajar).
6. **Simpan salah:** isi URL tanpa `ws://` → footer merah + nilai lama dipertahankan.
7. **Simpan benar:** ganti Machine ID → footer hijau → cek `GachaSession` (Machine Id berubah) + reconnect WS di Console.
8. **Batal:** ubah sesuatu → Batal → buka lagi → nilai kembali seperti semula.
9. **Persist:** Stop → Play lagi → nilai tetap (PlayerPrefs). Build update → nilai mesin tetap.
10. **Reset pabrik (kalau perlu):** tidak ada tombolnya di UI — pakai `SettingsStore.ClearSaved()` via ContextMenu sementara, atau hapus PlayerPrefs manual. Jangan taruh tombol reset di panel (bahaya kepencet).

---

## Troubleshooting

| Gejala | Penyebab umum | Fix |
|---|---|---|
| Slot script tidak bisa di-drop | Objek dibuat dari komponen lama (non-TMP) | Hapus, buat ulang yang ada tulisan **TextMeshPro** |
| Panel tidak pernah terbuka | Tap tidak di sudut / > 6 detik / script tidak di `SettingsRoot` yang aktif | Klik 220 px dari sudut, cepat, pastikan `SettingsRoot` aktif |
| Dropdown selalu `(tidak ada COM)` | Tidak ada USB serial / driver belum install | Install driver CH340/CP210x, colok alat, Refresh |
| Test gagal terus | Salah COM (kena scanner) / port dikunci Serial Monitor | Pilih COM Arduino (CH340/CP210x), tutup Serial Monitor, Refresh, Test lagi |
| URL kuis tidak berubah | Setter Bagian 6 belum ditambah | Tambah `SetApiUrl`, Play ulang |
| Scan mengetik ke kolom panel | Scanner HID mengetik ke input yang fokus | Jangan scan saat panel terbuka; klik Batal dulu. Ini perilaku bawaan scanner keyboard |
| PlayerPrefs tidak persist di build | Build di-run sebagai user berbeda / registry dibersihkan | Normal per OS-user; tiap akun Windows = setting sendiri |
| Tulisan terpotong di build | Lihat panduan Canvas: Overlay + Scale With Screen Size + Reference 1080x1920 + Match 0.5/Height | Samakan 2 Canvas |

---

## File terkait di repo ini

- `MachineConfig.cs`, `SettingsStore.cs`, `SettingsPanel.cs` (baru)
- `GachaSession.cs` (tambah load + getter), `BallDispenserManager.cs` (tambah `SetSerialConfig` + load)
- `DispenserTestHelper.cs` (sementara — hapus saat live, kotak test-nya mengganggu teknisi)
