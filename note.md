1. Langkah Agar Script Berjalan Otomatis (Startup)
Script .bat tidak akan jalan sendiri hanya dengan disimpan. Anda harus:
1. Klik kanan pada file start-unity-only.bat Anda.
2. Pilih Create Shortcut (Buat Pintasan).
3. Tekan tombol Windows + R di keyboard, ketik shell:startup, lalu tekan Enter. Folder Startup Windows akan terbuka.
4. Pindahkan/Copy Shortcut yang tadi Anda buat ke dalam folder Startup tersebut.
- Catatan: Jangan pindahkan file aslinya, cukup Shortcut-nya saja agar file asli tetap rapi di folder project.
2. Langkah Agar PC Langsung Masuk ke Desktop (Auto-Login)
Jika PC Anda meminta password/PIN saat dinyalakan, script di folder Startup tidak akan jalan sampai Anda mengetikkan password. Untuk mesin Kiosk/TV, biasanya kita setting agar PC langsung masuk ke Windows tanpa ngetik password:
1. Tekan Windows + R, ketik netplwiz, lalu Enter.
2. Hilangkan centang pada "Users must enter a user name and password to use this computer".
3. Klik Apply dan masukkan password user Anda.
(Jika opsi centang tidak ada, Anda perlu melakukan sedikit tweak di Registry atau via Settings > Accounts > Sign-in options).