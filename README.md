# Pelan Dewan 3D

Lakar pelan 2D dewan dan lihat terus dalam 3D (Three.js). Dibina untuk merancang **Dewan Sri Pekan, SK Bandar Tawau**:
susunan kerusi, kawasan VIP, zon penting dan aliran pergerakan penerima anugerah.

## Cara buka
**Dalam talian:** https://altrabird.github.io/Pelan-Dewan-3D/ (pelan disimpan dalam pelayar setiap pengguna; kongsi pelan dengan butang **Simpan** → fail `.json`).

**Luar talian:** dwiklik **`Mula.bat`**. Ia memulakan pelayan tempatan (perlu Python) dan membuka `http://localhost:8765/`.
Tiada internet diperlukan — Three.js disimpan dalam `vendor/`.

## Cara guna
| Buat | Bagaimana |
|---|---|
| Tambah objek | Klik butang di panel **Tambah** (kerusi, pentas, sofa VIP, meja, rostrum, bendera…) |
| Alih / ubah saiz / putar | Seret objek · petak biru = saiz (blok kerusi tambah baris/lajur) · bulatan = putar (lekap 15°) |
| Kawasan di sisi dewan | **Kawasan luar di sisi dewan → Kiri / Kanan / Belakang / Depan**: satu klik tambah kawasan 15 m rapat ke dinding dewan. Boleh guna semua sisi serentak; ringkasan tempat duduk dipecahkan ikut kawasan |
| Kawasan luar dewan | **Luar dewan → Kawasan Luar**: dataran / padang / jalan tar / jubin / pasir. Pilih dengan klik pada **tepinya**; seret = semua di atasnya ikut bergerak (cth. pindah semua kanopi ke kiri dewan) |
| Kanopi | **Kanopi Besar (6×6 m)** / **Kanopi Kecil (3×3 m)**, boleh ubah saiz. Letak blok kerusi di bawahnya; seret kanopi = kerusi ikut. Tahan `Shift` untuk alih kanopi sahaja |
| Lukis dinding | Alat **Dinding**: klik setiap sudut, klik titik pertama untuk tutup, dwiklik untuk tamat |
| Lukis aliran | Alat **Aliran**: klik setiap titik mengikut urutan. Klik petak titik → tulis nota langkah (cth. “3. Naik tangga”) |
| Lakaran / imbasan | **Lakaran latar → Import gambar**: letak foto lakaran tangan atau pelan, tetapkan lebar sebenar (m), surih di atasnya |
| Lihat aliran dalam 3D | **▶ Main aliran** (orang bergerak ikut laluan) · **Pandangan berjalan** = pandangan mata penerima |
| Orang dalam 3D | Setiap kerusi & sofa diisi penonton (murid berpakaian sekolah & bertudung, guru, ibu bapa, VIP berbaju Melayu & bersongkok) mengikut label blok. **👥 Penonton** = tunjuk / sembunyi. Aliran dimainkan oleh orang sebenar yang berjalan (animasi CC0) |
| Simpan | Auto-simpan dalam pelayar. **Simpan** = fail `.json` (kongsi dengan guru lain) · **Gambar 2D / 3D** = PNG untuk cetak |

Pintasan: `V` pilih · `W` dinding · `L` aliran · `R` putar · anak panah = alih · `Del` padam · `Ctrl+Z / Ctrl+Y` · `Ctrl+D` duplikat ·
roda tetikus = zum · seret ruang kosong / klik kanan = gerak pelan · tahan `Alt` = tanpa lekap.

## Templat Dewan Sri Pekan
Ukuran dalam templat ialah **anggaran** (dewan 18 m × 32 m, pentas 12 m × 6 m, tinggi 1 m) — ukur dewan sebenar dan
betulkan dinding/pentas. Templat mengandungi: pentas + backdrop + rostrum + meja hadiah, tangga kiri/kanan/VIP, zon VIP
(sofa + kerusi tetamu kehormat), blok Penerima Anugerah, Guru, Ibu Bapa, Murid (298 tempat duduk dalam dewan; jumlah keseluruhan 730), zon media,
meja pendaftaran, pintu, kawasan luar di **kiri, kanan dan belakang serentak**: 4 kanopi besar murid di kiri + 4 di kanan (432 tempat duduk, skrin LED luar di setiap sisi), dan di belakang kanopi pendaftaran, kanopi jamuan serta jalan turun kenderaan VIP, dan dua aliran: **Penerima Anugerah** (8 langkah) dan **VIP**.

## Untuk pembangun
- Tiada build step. `js/plan.js` = model data (tulen, tanpa DOM) · `js/editor2d.js` = kanvas 2D · `js/view3d.js` = Three.js ·
  `js/models.js` = model 3D · `js/main.js` = UI.
- Model orang: aset CC0 Quaternius, dibina dengan `art/build_people.py` (lihat `CREDITS.md`).
- Ujian: `npm test` (model) dan `python tests/e2e.py` (pelayar, perlu pelayan di :8765; tangkapan skrin ke `tests/shots/`).
