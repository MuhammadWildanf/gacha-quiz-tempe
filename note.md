# Panduan Auto-Start Gacha System

## Yang Berjalan Otomatis Saat PC Menyala
| Service | Port | Script |
|---------|------|--------|
| server-quiz-tempe | 3005 | `server-quiz-tempe/server.js` |
| quiz-management-tempe | 3011 | `quiz-management-tempe/server.js` |
| Unity EXE | — | `UnityBuild/*.exe` (auto-detect) |

---

## Setup Sekali (Pertama Kali)

### 1. Pasang Shortcut ke Startup
**Klik kanan** `install-startup.bat` → **Run as administrator**

Script ini otomatis:
- Membuat shortcut `GachaAutoStart.lnk` di folder Startup Windows
- Mulai sekarang setiap PC menyala → kedua server + Unity jalan otomatis

> Untuk cek: `Win+R` → ketik `shell:startup` → harus ada `GachaAutoStart.lnk`

### 2. Taruh Hasil Build Unity
Letakkan **seluruh folder hasil Build Unity** di:
```
E:\web\2026\tempe-park\Gacha\UnityBuild\
```
EXE akan terdeteksi otomatis. Tidak perlu edit `.bat`.

### 3. Aktifkan Auto-Login (agar startup berjalan tanpa input password)
1. `Win+R` → ketik `netplwiz` → Enter
2. Hilangkan centang **"Users must enter a user name and password..."**
3. Klik Apply → masukkan password → OK

### 4. Power Plan (agar PC tidak tidur)
- Control Panel → Power Options → pilih **High Performance**
- Set **"Turn off display"** = **Never**
- Set **"Sleep"** = **Never**

---

## File-File Penting
| File | Fungsi |
|------|--------|
| `start-gacha.bat` | **Script utama** — jalankan server + Unity |
| `install-startup.bat` | Pasang ke Windows Startup (jalankan sekali) |
| `stop-gacha.bat` | Matikan semua server |
| `start-server-only.bat` | Jalankan server saja (tanpa Unity) |
| `start-unity-only.bat` | Jalankan Unity saja (Unity di TV, server di PC lain) |

---

## Log
Log disimpan di folder `logs\`:
- `logs\startup.log` — log startup utama
- `logs\server-3005.log` — output server-quiz
- `logs\mgmt-3011.log` — output quiz-management

---

## Troubleshooting
| Masalah | Solusi |
|---------|--------|
| Server tidak jalan | Cek `logs\server-3005.log` / `logs\mgmt-3011.log` |
| Unity tidak muncul | Pastikan ada `.exe` di `UnityBuild\` |
| Script tidak auto-run | Jalankan `install-startup.bat` sebagai Administrator |
| PC minta password saat booting | Aktifkan Auto-Login via `netplwiz` |
| Port sudah dipakai proses lain | Jalankan `stop-gacha.bat` lalu coba lagi |
