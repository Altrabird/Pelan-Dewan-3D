# Pelan Dewan 3D

Lakar pelan 2D dewan dan lihat terus dalam 3D (Three.js). Dibina untuk merancang **Dewan Sri Pekan, SK Bandar Tawau**:
susunan kerusi, kawasan VIP, zon penting dan aliran pergerakan penerima anugerah.

## Cara buka
Dwiklik **`Mula.bat`**. Ia memulakan pelayan tempatan (perlu Python) dan membuka `http://localhost:8765/`.
Tiada internet diperlukan — Three.js disimpan dalam `vendor/`.

## Cara guna
| Buat | Bagaimana |
|---|---|
| Tambah objek | Klik butang di panel **Tambah** (kerusi, pentas, sofa VIP, meja, rostrum, bendera…) |
| Alih / ubah saiz / putar | Seret objek · petak biru = saiz (blok kerusi tambah baris/lajur) · bulatan = putar (lekap 15°) |
| Lukis dinding | Alat **Dinding**: klik setiap sudut, klik titik pertama untuk tutup, dwiklik untuk tamat |
| Lukis aliran | Alat **Aliran**: klik setiap titik mengikut urutan. Klik petak titik → tulis nota langkah (cth. “3. Naik tangga”) |
| Lakaran / imbasan | **Lakaran latar → Import gambar**: letak foto lakaran tangan atau pelan, tetapkan lebar sebenar (m), surih di atasnya |
| Lihat aliran dalam 3D | **▶ Main aliran** (orang bergerak ikut laluan) · **Pandangan berjalan** = pandangan mata penerima |
| Simpan | Auto-simpan dalam pelayar. **Simpan** = fail `.json` (kongsi dengan guru lain) · **Gambar 2D / 3D** = PNG untuk cetak |

Pintasan: `V` pilih · `W` dinding · `L` aliran · `R` putar · anak panah = alih · `Del` padam · `Ctrl+Z / Ctrl+Y` · `Ctrl+D` duplikat ·
roda tetikus = zum · seret ruang kosong / klik kanan = gerak pelan · tahan `Alt` = tanpa lekap.

## Templat Dewan Sri Pekan
Ukuran dalam templat ialah **anggaran** (dewan 18 m × 32 m, pentas 12 m × 6 m, tinggi 1 m) — ukur dewan sebenar dan
betulkan dinding/pentas. Templat mengandungi: pentas + backdrop + rostrum + meja hadiah, tangga kiri/kanan/VIP, zon VIP
(sofa + kerusi tetamu kehormat), blok Penerima Anugerah, Guru, Ibu Bapa, Murid (298 tempat duduk), zon media,
meja pendaftaran, pintu, dan dua aliran: **Penerima Anugerah** (8 langkah) dan **VIP**.

## Untuk pembangun
- Tiada build step. `js/plan.js` = model data (tulen, tanpa DOM) · `js/editor2d.js` = kanvas 2D · `js/view3d.js` = Three.js ·
  `js/models.js` = model 3D · `js/main.js` = UI.
- Ujian: `npm test` (model) dan `python tests/e2e.py` (pelayar, perlu pelayan di :8765; tangkapan skrin ke `tests/shots/`).
