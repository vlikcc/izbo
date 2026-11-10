/* eslint-disable */
// @ts-nocheck — ilkokul-platformu prototipinden (js/data.js) olduğu gibi taşındı.
// Mantık bilerek değiştirilmedi; tipler dışa açılan adlarda gevşek (any) tutuldu.
// Sabit veriler: dersler, karakterler, müfredat ağacı, içerikler ve demo kullanıcılar.
// Gerçek sistemde bu veriler CMS'ten gelir. "Tek içerik kaydı" ilkesi: açık örnek ders,
// öğrenci dersi ve öğretmenin ödev seçtiği ekran aynı TOPICS kaydını kullanır.

// ---- Karakterler ----
// Çizimler hazır olunca `art` alanına görsel yolunu yazın (ör. '/kampus/assets/karakterler/sekiz.png').
// Durum bazlı görseller için: art: { idle: '...', correct: '...', hint: '...', happy: '...' }
// Görseller Google Flow'da (Nano Banana 2.1) referans çizimlerden üretildi, arka planları şeffaf yapıldı.
// Durumlar: idle (bekleme), correct (doğru cevap), hint (ipucu), happy (konu/durak bitti).
// Eski kırpılmış geçici görseller assets/karakterler/eski/ klasöründe.
export const BRAND: any = { name: 'YZ Kampüs', logo: '/kampus/assets/karakterler/logo-maskot.png' };
export const CHARACTERS: any = {
  maskot: { name: 'Maskot', role: 'Rehber',          animal: 'Ana maskot',  color: '#7ED321', art: { idle: '/kampus/assets/karakterler/maskot.png', correct: '/kampus/assets/karakterler/maskot-sevinc.png', happy: '/kampus/assets/karakterler/maskot-sevinc.png', hint: '/kampus/assets/karakterler/maskot-rehber.png' } },
  pitsi:  { name: 'Pitsi',  role: 'Türkçe',          animal: 'Kitap sever', color: '#C86BFA', art: { idle: '/kampus/assets/karakterler/pitsi.png', correct: '/kampus/assets/karakterler/pitsi-sevinc.png', happy: '/kampus/assets/karakterler/pitsi-sevinc.png', hint: '/kampus/assets/karakterler/pitsi-ipucu.png' } },
  lumo:   { name: 'Lumo',   role: 'Matematik',       animal: 'Sayı meraklısı', color: '#FF8A3D', art: { idle: '/kampus/assets/karakterler/lumo.png', correct: '/kampus/assets/karakterler/lumo-sevinc.png', happy: '/kampus/assets/karakterler/hareketli/lumo-sevinc.gif', hint: '/kampus/assets/karakterler/hareketli/lumo-ipucu.gif' } },
  findik: { name: 'Hayat Bilgisi karakteri', role: 'Hayat Bilgisi', animal: 'İsim belirlenmedi', color: '#F28C28', art: '/kampus/assets/karakterler/ders-hayat.png' },
  virak:  { name: 'Fen Bilimleri karakteri', role: 'Fen Bilimleri', animal: 'İsim belirlenmedi', color: '#1E88E5', art: '/kampus/assets/karakterler/ders-fen.png' },
  lale:   { name: 'Lale',   role: 'Sosyal Bilgiler', animal: 'Leylek',      color: '#E0A21B', art: null },
  kenzo:  { name: 'İngilizce karakteri', role: 'İngilizce', animal: 'İsim belirlenmedi', color: '#8E44AD', art: '/kampus/assets/karakterler/ders-ingilizce.png' }
};

// ---- Dersler ----
export const SUBJECTS: any = {
  turkce:    { name: 'Türkçe',          char: 'pitsi',  color: '#C86BFA', house: 'Kütüphane', bg: '#F1E6FB', cardArt: '/kampus/assets/karakterler/ders-turkce.png' },
  matematik: { name: 'Matematik',       char: 'lumo',   color: '#58B947', house: 'Deniz feneri', bg: '#E9F8E3', cardArt: '/kampus/assets/karakterler/ders-matematik.png', pathArt: '/kampus/assets/karakterler/lumo-kartlar.png' },
  hayat:     { name: 'Hayat Bilgisi',   char: 'findik', color: '#F28C28', house: 'Ağaç ev', bg: '#FFF3DD', cardArt: '/kampus/assets/karakterler/ders-hayat.png' },
  fen:       { name: 'Fen Bilimleri',   char: 'virak',  color: '#1E88E5', house: 'Laboratuvar', bg: '#DDEFFC', cardArt: '/kampus/assets/karakterler/ders-fen.png' },
  sosyal:    { name: 'Sosyal Bilgiler', char: 'lale',   color: '#E0A21B', house: 'Harita kulesi' },
  ingilizce: { name: 'İngilizce',       char: 'kenzo',  color: '#8E44AD', house: 'Şarkı evi', bg: '#FCE6EF', cardArt: '/kampus/assets/karakterler/ders-ingilizce.png' },
  din:       { name: 'Din Kültürü ve Ahlak Bilgisi', char: null, color: '#5C8DD6', house: 'Bilgi evi' },
  ihyd:      { name: 'İnsan Hakları, Yurttaşlık ve Demokrasi', char: null, color: '#8C6BB1', house: 'Meclis' },
  trafik:    { name: 'Trafik Güvenliği', char: null, color: '#E25555', house: 'Kavşak' }
};

// Sınıflara göre dersler. ⚠️ MEB güncel haftalık ders çizelgesiyle doğrulanacak (verify: true olanlar özellikle).
export const GRADES: any = {
  1: ['turkce', 'matematik', 'hayat'],
  2: ['turkce', 'matematik', 'hayat', 'ingilizce'],
  3: ['turkce', 'matematik', 'fen', 'hayat', 'ingilizce'],
  4: ['turkce', 'matematik', 'fen', 'sosyal', 'ingilizce', 'din', 'ihyd', 'trafik']
};

// Sınıf + ders için ders başlığı (1. sınıf Türkçe = İlk Okuma-Yazma)
export function courseTitle(grade, subject) {
  if (grade === 1 && subject === 'turkce') return 'Türkçe (İlk Okuma-Yazma)';
  return SUBJECTS[subject].name;
}

// ---- Müfredat ağacı (içeriği hazır olan dersler) ----
export const COURSES: any = {
  '1-turkce': {
    grade: 1, subject: 'turkce',
    units: [{ id: 'u-1-ses1', title: '1. Ses Grubu', topics: ['k-e-sesi', 'k-l-sesi'] }]
  },
  '3-matematik': {
    grade: 3, subject: 'matematik',
    units: [
      { id: 'u-3-tema1', no: 1, title: 'Sayılar ve Nicelikler (1)', topics: ['k-dogal-karsilastirma'] },
      { id: 'u-3-tema3', no: 3, title: 'İşlemlerden Cebirsel Düşünmeye', topics: ['k-toplam-tahmin', 'k-eldeli-toplama'] }
    ]
  }
};

// ---- Konular ----
// Soru alanları: prompt (ekranda), say (sesli yönerge), options, answer, hints (adım adım), skill (veli/öğretmen raporu için)
export const TOPICS: any = {
  'k-e-sesi': {
    course: '1-turkce', title: '"e" Sesi',
    learned: '"e" sesini ve harfini tanıdın',
    homeTip: 'Evde "e" ile başlayan eşyaları birlikte bulun: ekmek, eldiven, etek…',
    audioFirst: true,
    watch: [
      { visual: '🍎', text: 'Bu bir elma. "Eeelma" derken ilk duyduğumuz ses "e".', say: 'Bu bir elma. Eeelma. Duydun mu? İlk ses, e.' },
      { visual: 'E e', big: true, text: '"e" sesinin harfi böyle yazılır: büyük E, küçük e.', say: 'E sesinin harfi böyle yazılır. Büyük E, küçük e.' },
      { visual: '🏠 🧤', text: '"Ev" ve "eldiven" de "e" sesiyle başlar.', say: 'Ev. Eldiven. Bunlar da e sesiyle başlıyor.' }
    ],
    practice: [
      { id: 'e-p1', prompt: 'Hangisinin adı "e" sesiyle başlar?', say: 'Hangisinin adı e sesiyle başlıyor? Resme dokun.', skill: 'Kelimenin ilk sesini bulma',
        options: [{ v: 'elma', emoji: '🍎', label: 'elma' }, { v: 'kedi', emoji: '🐱', label: 'kedi' }, { v: 'top', emoji: '⚽', label: 'top' }], answer: 'elma',
        hints: ['Her resmin adını yavaşça söyle: eeelma, keeedi, toop. Hangisi "e" ile başladı?', 'Elmanın adını söyle: "Eeelma". İlk ses "e"!'] },
      { id: 'e-p2', prompt: 'Hangisi "e" harfi?', say: 'Hangisi e harfi? Göster bakalım.', skill: '"e" harfini tanıma',
        options: [{ v: 'a', label: 'a' }, { v: 'e', label: 'e' }, { v: 'o', label: 'o' }], answer: 'e', letters: true,
        hints: ['"e" harfi küçük bir yuvarlak gibidir, ortasında bir çizgi vardır.', 'Ortasında çizgi olan harfe dokun.'] },
      { id: 'e-p3', prompt: 'Hangisinin adında "e" sesi var?', say: 'Hangisinin adında e sesi var? Adlarını söyleyerek dinle.', skill: 'Kelimenin içindeki sesi duyma',
        options: [{ v: 'ev', emoji: '🏠', label: 'ev' }, { v: 'balik', emoji: '🐟', label: 'balık' }, { v: 'araba', emoji: '🚗', label: 'araba' }], answer: 'ev',
        hints: ['Adları tek tek söyle: ev, balık, araba. Hangisinde "e" duydun?', '"Eev" derken ilk ses "e"!'] }
    ],
    check: [
      { id: 'e-c1', prompt: 'Duyduğun kelimenin resmi hangisi?', say: 'Ekmek. Duyduğun kelimenin resmine dokun.', skill: 'Duyduğu kelimeyi tanıma',
        options: [{ v: 'ekmek', emoji: '🍞', label: 'ekmek' }, { v: 'ay', emoji: '🌙', label: 'ay' }, { v: 'kus', emoji: '🐦', label: 'kuş' }], answer: 'ekmek',
        hints: ['Kelimeyi bir daha dinle: "ekmek".', 'Sabah kahvaltıda yediğimiz şey!'] },
      { id: 'e-c2', prompt: 'Hangisi küçük "e"?', say: 'Hangisi küçük e harfi?', skill: '"e" harfini tanıma',
        options: [{ v: 'E', label: 'E' }, { v: 'e', label: 'e' }, { v: 'a', label: 'a' }], answer: 'e', letters: true,
        hints: ['Büyük E üç çizgiden oluşur. Küçük e yuvarlaktır.', 'Yuvarlak olan ve ortasında çizgi olana dokun.'] },
      { id: 'e-c3', prompt: 'Hangi resmin adı "e" ile başlar?', say: 'Hangi resmin adı e ile başlıyor?', skill: 'Kelimenin ilk sesini bulma',
        options: [{ v: 'eldiven', emoji: '🧤', label: 'eldiven' }, { v: 'kopek', emoji: '🐶', label: 'köpek' }, { v: 'muz', emoji: '🍌', label: 'muz' }], answer: 'eldiven',
        hints: ['Adları yavaşça söyle: eeeldiven, köööpek, muuuz.', 'Kışın ellerimizi ısıtan şey "e" ile başlar.'] }
    ]
  },

  'k-l-sesi': {
    course: '1-turkce', title: '"l" Sesi ve "el"',
    learned: '"l" sesini öğrendin ve "el" hecesini okudun',
    homeTip: 'Birlikte "el" deyip ellerinizi gösterin; sonra "le" ve "el" hecelerini sırayla söyleyin.',
    audioFirst: true,
    watch: [
      { visual: '🍋', text: 'Bu bir limon. "Llllimon" derken dilimiz üst dişlerimize değer.', say: 'Bu bir limon. Lllimon. İlk ses, l.' },
      { visual: 'L l', big: true, text: '"l" sesinin harfi: büyük L, küçük l.', say: 'L sesinin harfi. Büyük L, küçük l.' },
      { visual: 'e + l = el ✋', big: true, text: '"e" ile "l" birleşince "el" olur.', say: 'E ve l birleşince ne olur? El!' }
    ],
    practice: [
      { id: 'l-p1', prompt: 'Hangisinin adı "l" sesiyle başlar?', say: 'Hangisinin adı l sesiyle başlıyor?', skill: 'Kelimenin ilk sesini bulma',
        options: [{ v: 'limon', emoji: '🍋', label: 'limon' }, { v: 'elma', emoji: '🍎', label: 'elma' }, { v: 'kedi', emoji: '🐱', label: 'kedi' }], answer: 'limon',
        hints: ['Adları yavaşça söyle: llimon, eelma, keedi.', 'Ekşi ve sarı olan meyvenin adı "l" ile başlar.'] },
      { id: 'l-p2', prompt: 'Hangisi "l" harfi?', say: 'Hangisi l harfi?', skill: '"l" harfini tanıma',
        options: [{ v: 'l', label: 'l' }, { v: 'e', label: 'e' }, { v: 't', label: 't' }], answer: 'l', letters: true,
        hints: ['"l" harfi dimdik bir çizgidir.', 'Hiç kıvrımı olmayan, uzun çizgiye dokun.'] },
      { id: 'l-p3', prompt: '"e" ile "l" birleşince ne olur?', say: 'E ve l seslerini birleştir. Hangisini okudun?', skill: 'Sesleri birleştirip hece okuma',
        options: [{ v: 'el', emoji: '✋', label: 'el' }, { v: 'ev', emoji: '🏠', label: 'ev' }, { v: 'at', emoji: '🐴', label: 'at' }], answer: 'el',
        hints: ['Önce "e" de, sonra hemen "l" ekle: e… l…', '"e" ve "l": eeel. Elimizi gösteren resim!'] }
    ],
    check: [
      { id: 'l-c1', prompt: 'Duyduğun hece hangisi?', say: 'Le. Duyduğun heceye dokun.', skill: 'Duyduğu heceyi tanıma',
        options: [{ v: 'le', label: 'le' }, { v: 'el', label: 'el' }], answer: 'le', letters: true,
        hints: ['Hece "l" sesiyle başlıyordu: lle.', 'Önce "l", sonra "e" olan heceye dokun.'] },
      { id: 'l-c2', prompt: 'Hangisinin adında "l" sesi var?', say: 'Hangisinin adında l sesi var?', skill: 'Kelimenin içindeki sesi duyma',
        options: [{ v: 'aslan', emoji: '🦁', label: 'aslan' }, { v: 'ari', emoji: '🐝', label: 'arı' }, { v: 'araba', emoji: '🚗', label: 'araba' }], answer: 'aslan',
        hints: ['Adları söyle: asllan, arı, araba. Hangisinde dilin dişlerine değdi?', 'Ormanlar kralının adında "l" var.'] },
      { id: 'l-c3', prompt: 'Hangi kelime "el"?', say: 'Hangisi el kelimesi? Oku ve dokun.', skill: 'Sesleri birleştirip hece okuma',
        options: [{ v: 'el', label: 'el' }, { v: 'le', label: 'le' }, { v: 'ev', label: 'ev' }], answer: 'el', letters: true,
        hints: ['"el" önce "e", sonra "l" ile yazılır.', 'İlk harfi "e", ikinci harfi "l" olanı bul.'] }
    ]
  },

  'k-dogal-karsilastirma': {
    course: '3-matematik', title: 'Doğal Sayıları Karşılaştırma', code: 'MAT.3.1.3',
    learned: 'Doğal sayıları basamaklarına bakarak karşılaştırmayı öğrendin',
    homeTip: 'Market fiyatlarından iki tanesini seçip hangisinin daha pahalı olduğunu basamaklarına bakarak birlikte bulun.',
    watch: [
      { visual: '98 ? 95', big: true, text: 'İki sayıyı karşılaştırırken en büyük basamaktan başlarız.' },
      { visual: '9 onluk = 9 onluk', big: true, text: '98 ve 95 sayılarında onluklar aynı: ikisinde de 9 onluk var.' },
      { visual: '8 birlik > 5 birlik', big: true, text: 'Onluklar eşitse birliklere bakarız. 8, 5\'ten büyük. O hâlde 98 > 95.' },
      { visual: '<   >   =', big: true, text: 'İşaretin açık ağzı her zaman büyük sayıya bakar. Sayılar aynıysa = koyarız.' }
    ],
    compare: { title: 'Sayıları karşılaştır', prompt: 'İki sayının arasına doğru işareti yerleştir.',
      items: [[98, 95], [64, 46], [312, 321], [505, 505], [87, 178], [430, 403]] },
    // ---- Patika durakları (MEB TYMM 3. sınıf, MAT.3.1.3: 1000'e kadar olan sayıları sıralayabilme) ----
    // 🎧 Konu Anlatımı videoyla verilir. Video hazır olunca: video: { src: '/kampus/assets/videolar/....mp4', poster, captions (.vtt) }
    // Aşağıdaki sahneler videonun senaryosudur; oynatıcıda kapalı "Video metni" olarak da görünür.
    lesson: [
      { visual: { kind: 'pair', a: 342, b: 324, labelA: '📚 Mavi raf', labelB: '📚 Sarı raf' },
        text: 'Kütüphanede iki raf var. Mavi rafta 342, sarı rafta 324 kitap var. Hangisinde daha çok kitap var? Birlikte bulalım!' },
      { visual: { kind: 'place', rows: [342, 324], focus: 0 },
        text: 'Karşılaştırmaya en büyük basamaktan, yüzler basamağından başlarız. İki sayıda da 3 yüzlük var. Yüzlükler eşit.' },
      { visual: { kind: 'place', rows: [342, 324], focus: 1 },
        text: 'Yüzlükler eşitse onluklara bakarız. 342 sayısında 4 onluk, 324 sayısında 2 onluk var. 4 onluk daha çok!' },
      { visual: { kind: 'pair', a: 342, b: 324, sign: '>' },
        text: 'O hâlde 342, 324\'ten büyüktür. İşaretin açık ağzı her zaman büyük sayıya bakar: 342 > 324.' },
      { visual: { kind: 'line', from: 320, to: 350, step: 10, marks: [324, 342] },
        text: 'Sayı doğrusunda da görebiliriz: sağa gittikçe sayılar büyür. 342, 324\'ün sağında.' },
      { visual: { kind: 'pair', a: 105, b: 98, sign: '>', note: '3 basamak · 2 basamak' },
        text: 'Basamak sayıları farklıysa daha kolay: üç basamaklı bir sayı, iki basamaklı bir sayıdan her zaman büyüktür.' }
    ],
    // ✏️ Alıştırmalar: Doğru–Yanlış, Eşleştirme, Cevabı Yaz
    exercises: [
      { id: 'dk-a1', type: 'tf', prompt: '506 sayısı 560 sayısından büyüktür.', answer: false, skill: 'Üç basamaklı sayıları karşılaştırma',
        hints: ['Yüzlükler aynı: ikisinde de 5 yüzlük var. Şimdi onluklara bak.', '506\'da 0 onluk, 560\'ta 6 onluk var. 560 daha büyük, yani bu cümle yanlış.'] },
      { id: 'dk-a2', type: 'match', prompt: 'Sayı çiftlerini, hangi basamakta ayrıldıklarıyla eşleştir.', skill: 'Basamaklara göre karşılaştırma',
        pairs: [['418 ile 481', 'Onluklarda ayrılır'], ['702 ile 699', 'Yüzlüklerde ayrılır'], ['250 ile 250', 'Sayılar eşittir']],
        hints: ['Her çiftte önce yüzlüklere bak. Aynıysa onluklara geç.', '702 ile 699\'da yüzlükler farklı: 7 ve 6. 418 ile 481\'de yüzlükler aynı, onluklar farklı.'] },
      { id: 'dk-a3', type: 'write', input: 'sign', prompt: 'Boşluğa <, > ya da = yaz:  815 ☐ 851', answer: '<', skill: 'Karşılaştırma işaretini kullanma',
        hints: ['Yüzlükler aynı. Onluklara bak: 1 onluk ve 5 onluk.', '815 daha küçük. Açık ağız 851\'e bakmalı: <'] },
      { id: 'dk-a4', type: 'tf', prompt: 'Basamak sayısı daha çok olan doğal sayı daha büyüktür.', answer: true, skill: 'Basamak sayısına göre karşılaştırma',
        hints: ['Örneğin 105 ile 98\'i düşün. Hangisinin basamağı çok?', '105 üç basamaklı, 98 iki basamaklı. 105 daha büyük. Yani cümle doğru.'] },
      { id: 'dk-a5', type: 'write', input: 'number', prompt: 'Elif 278, Mert 287 ceviz topladı. Daha çok ceviz toplayan kaç ceviz topladı?', answer: '287', skill: 'Karşılaştırma problemleri',
        hints: ['278 ile 287\'yi karşılaştır. Yüzlükler aynı mı?', 'Onluklara bak: 7 onluk ve 8 onluk. 287 daha büyük.'] },
      { id: 'dk-a6', type: 'match', prompt: 'Sayıları sıralamadaki yerleriyle eşleştir.', skill: 'Sayıları sıralama',
        pairs: [['En küçük', '196'], ['Ortanca', '619'], ['En büyük', '691']],
        hints: ['Önce yüzlüklere bak: 1 yüzlüklü sayı en küçüktür.', '619 ile 691\'de yüzlükler aynı. Onluklara bak: 1 onluk ve 9 onluk.'] }
    ],
    // ✅ Mini Test: her denemede bu havuzdan 5 soru seçilir; bir önceki denemenin soruları mümkün olduğunca tekrar gelmez.
    testPool: [
      { id: 'dk-t1', type: 'choice', prompt: 'Hangisi en büyük?', options: [{ v: '709', label: '709' }, { v: '790', label: '790' }, { v: '97', label: '97' }], answer: '790', skill: 'Üç basamaklı sayıları karşılaştırma' },
      { id: 'dk-t2', type: 'choice', prompt: '463 ☐ 436', letters: true, options: [{ v: '<', label: '<' }, { v: '>', label: '>' }, { v: '=', label: '=' }], answer: '>', skill: 'Karşılaştırma işaretini kullanma' },
      { id: 'dk-t3', type: 'tf', prompt: '300 > 299', answer: true, skill: 'Karşılaştırma işaretini kullanma' },
      { id: 'dk-t4', type: 'choice', prompt: 'Hangisi 528\'den küçüktür?', options: [{ v: '582', label: '582' }, { v: '529', label: '529' }, { v: '518', label: '518' }], answer: '518', skill: 'Üç basamaklı sayıları karşılaştırma' },
      { id: 'dk-t5', type: 'tf', prompt: '640 ile 604 sayılarının onlar basamağındaki rakamlar aynıdır.', answer: false, skill: 'Basamaklara göre karşılaştırma' },
      { id: 'dk-t6', type: 'write', input: 'sign', prompt: 'Boşluğa işaret yaz:  999 ☐ 1000', answer: '<', skill: 'Karşılaştırma işaretini kullanma' },
      { id: 'dk-t7', type: 'choice', prompt: 'Küçükten büyüğe doğru sıralanmış olan hangisi?', options: [{ v: 'a', label: '135 < 153 < 315' }, { v: 'b', label: '153 < 135 < 315' }, { v: 'c', label: '315 < 153 < 135' }], answer: 'a', skill: 'Sayıları sıralama' },
      { id: 'dk-t8', type: 'choice', prompt: 'A okulunda 412, B okulunda 421 öğrenci var. Hangi okulda daha az öğrenci var?', options: [{ v: 'a', label: 'A okulu' }, { v: 'b', label: 'B okulu' }, { v: 'e', label: 'Eşit' }], answer: 'a', skill: 'Karşılaştırma problemleri' },
      { id: 'dk-t9', type: 'tf', prompt: '875 sayısı 857 sayısından büyüktür.', answer: true, skill: 'Üç basamaklı sayıları karşılaştırma' },
      { id: 'dk-t10', type: 'write', input: 'number', prompt: '860 ile 806 sayılarından büyük olanı yaz.', answer: '860', skill: 'Üç basamaklı sayıları karşılaştırma' },
      { id: 'dk-t11', type: 'choice', prompt: '3☐5 > 365 olması için kutuya hangi rakam gelmeli?', options: [{ v: '5', label: '5' }, { v: '6', label: '6' }, { v: '8', label: '8' }], answer: '8', skill: 'Basamaklara göre karşılaştırma' },
      { id: 'dk-t12', type: 'write', input: 'sign', prompt: 'Boşluğa işaret yaz:  270 ☐ 270', answer: '=', skill: 'Karşılaştırma işaretini kullanma' },
      { id: 'dk-t13', type: 'choice', prompt: 'Hangi sayı 450 ile 460 arasındadır?', options: [{ v: '445', label: '445' }, { v: '456', label: '456' }, { v: '465', label: '465' }], answer: '456', skill: 'Sayıları sıralama' },
      { id: 'dk-t14', type: 'tf', prompt: '98 sayısı 102 sayısından büyüktür.', answer: false, skill: 'Basamak sayısına göre karşılaştırma' }
    ],
    // 📖 Konu Özeti: hızlı gözden geçirme
    summary: {
      idea: 'İki sayıyı karşılaştırırken en büyük basamaktan başlarız. Basamaklar eşitse bir sağdaki basamağa geçeriz.',
      points: [
        'Basamak sayısı çok olan sayı daha büyüktür: 105 > 98',
        'Basamak sayıları aynıysa önce yüzlüklere, sonra onluklara, sonra birliklere bakarız.',
        'İşaretin açık ağzı büyük sayıya bakar: < küçüktür, > büyüktür, = eşittir.'
      ],
      example: { title: '342 ile 324', lines: ['Yüzlükler: 3 = 3 → eşit', 'Onluklar: 4 > 2 → 342 büyük', 'Sonuç: 342 > 324'] }
    },
    worksheet: { file: '/kampus/assets/calisma-kagitlari/3-mat-dogal-sayilari-karsilastirma.pdf', preview: '/kampus/assets/calisma-kagitlari/3-mat-dogal-sayilari-karsilastirma-onizleme.png', title: 'Doğal Sayıları Karşılaştırma — Çalışma Kâğıdı', pages: 1 },
    practice: [
      { id: 'dk-p1', prompt: 'Hangisi daha büyük?', skill: 'Üç basamaklı sayıları karşılaştırma',
        options: [{ v: '213', label: '213' }, { v: '231', label: '231' }], answer: '231',
        hints: ['Önce yüzlüklere bak: ikisinde de 2 yüzlük var.', 'Şimdi onluklara bak: 213\'te 1 onluk, 231\'de 3 onluk var.'] },
      { id: 'dk-p2', prompt: '458 ☐ 485', skill: 'Karşılaştırma işaretini kullanma',
        options: [{ v: '<', label: '<' }, { v: '>', label: '>' }, { v: '=', label: '=' }], answer: '<', letters: true,
        hints: ['Yüzlükler aynı. Onluklara bak: 5 onluk ve 8 onluk.', '458 daha küçük. Açık ağız büyük sayıya, 485\'e bakmalı: <'] },
      { id: 'dk-p3', prompt: 'Ayşe 126 sayfa, Can 162 sayfa kitap okudu. Kim daha çok okudu?', skill: 'Karşılaştırma problemleri',
        options: [{ v: 'ayse', label: 'Ayşe' }, { v: 'can', label: 'Can' }, { v: 'esit', label: 'Eşit okudular' }], answer: 'can',
        hints: ['126 ile 162\'yi karşılaştır. Yüzlükler aynı mı?', 'Onluklara bak: 126\'da 2 onluk, 162\'de 6 onluk var. 162 daha büyük.'] }
    ],
    check: [
      { id: 'dk-c1', prompt: 'Hangisi en küçük?', skill: 'Basamak sayısına göre karşılaştırma',
        options: [{ v: '409', label: '409' }, { v: '490', label: '490' }, { v: '94', label: '94' }], answer: '94',
        hints: ['Basamak sayılarına bak: hangisi iki basamaklı?', 'İki basamaklı bir sayı, üç basamaklı sayılardan küçüktür.'] },
      { id: 'dk-c2', prompt: '700 ☐ 699', skill: 'Karşılaştırma işaretini kullanma',
        options: [{ v: '<', label: '<' }, { v: '>', label: '>' }, { v: '=', label: '=' }], answer: '>', letters: true,
        hints: ['Yüzlüklere bak: 7 yüzlük ve 6 yüzlük.', '700 daha büyük. Açık ağız 700\'e bakmalı: >'] },
      { id: 'dk-c3', prompt: '350 ☐ 350', skill: 'Karşılaştırma işaretini kullanma',
        options: [{ v: '<', label: '<' }, { v: '>', label: '>' }, { v: '=', label: '=' }], answer: '=', letters: true,
        hints: ['Bütün basamakları tek tek karşılaştır.', 'Sayılar tamamen aynı. Aynı sayılar arasına = konur.'] }
    ]
  },

  'k-eldeli-toplama': {
    course: '3-matematik', title: 'Eldeli Toplama', code: 'MAT.3.2.2',
    learned: 'Eldeli toplamada eldeyi onlar basamağına taşımayı öğrendin',
    homeTip: 'Market fişindeki iki fiyatı birlikte alt alta yazıp toplayın; eldeyi küçük bir yıldızla işaretleyin.',
    watch: [
      { visual: '27 + 15', big: true, text: 'Toplamaya birler basamağından başlarız: 7 + 5 = 12.' },
      { visual: '12 = 1 onluk + 2 birlik', big: true, text: '2\'yi birler basamağına yazarız. 1 onluğu onlar basamağına "elde" olarak taşırız.' },
      { visual: '2 + 1 + 1 = 4  →  42', big: true, text: 'Onlar basamağı: 2 + 1 + elde 1 = 4. Sonuç: 42.' }
    ],
    practice: [
      { id: 'm-p1', prompt: '27 + 15 = ?', skill: 'İki basamaklı eldeli toplama',
        options: [{ v: '32', label: '32' }, { v: '42', label: '42' }, { v: '312', label: '312' }, { v: '41', label: '41' }], answer: '42',
        hints: ['Önce birler basamağı: 7 + 5 kaç eder?', '7 + 5 = 12. 2\'yi yaz, 1 elde. Onlar: 2 + 1 + 1 = 4. Sonuç 42.'] },
      { id: 'm-p2', prompt: '48 + 36 = ?', skill: 'İki basamaklı eldeli toplama',
        options: [{ v: '74', label: '74' }, { v: '84', label: '84' }, { v: '714', label: '714' }, { v: '85', label: '85' }], answer: '84',
        hints: ['8 + 6 kaç eder? 10\'dan büyükse elde var demektir.', '8 + 6 = 14: 4\'ü yaz, 1 elde. 4 + 3 + 1 = 8. Sonuç 84.'] },
      { id: 'm-p3', prompt: 'Sepette 38 elma vardı. 25 elma daha eklendi. Sepette kaç elma oldu?', skill: 'Toplama problemleri',
        options: [{ v: '53', label: '53' }, { v: '63', label: '63' }, { v: '513', label: '513' }, { v: '13', label: '13' }], answer: '63',
        hints: ['Önce sepette kaç elma vardı? 38. Şimdi eklenenleri de sayalım: 38 + 25.', '8 + 5 = 13: 3\'ü yaz, 1 elde. 3 + 2 + 1 = 6. Sonuç 63.'] },
      { id: 'm-p4', prompt: '156 + 27 = ?', skill: 'Üç basamaklı eldeli toplama',
        options: [{ v: '173', label: '173' }, { v: '183', label: '183' }, { v: '1713', label: '1713' }, { v: '184', label: '184' }], answer: '183',
        hints: ['Birler: 6 + 7 kaç eder?', '6 + 7 = 13: 3 yaz, 1 elde. Onlar: 5 + 2 + 1 = 8. Yüzler: 1. Sonuç 183.'] }
    ],
    check: [
      { id: 'm-c1', prompt: '35 + 47 = ?', skill: 'İki basamaklı eldeli toplama',
        options: [{ v: '72', label: '72' }, { v: '82', label: '82' }, { v: '712', label: '712' }, { v: '83', label: '83' }], answer: '82',
        hints: ['Birler: 5 + 7 = 12. Elde var mı?', '2 yaz, 1 elde. 3 + 4 + 1 = 8. Sonuç 82.'] },
      { id: 'm-c2', prompt: '209 + 64 = ?', skill: 'Üç basamaklı eldeli toplama',
        options: [{ v: '263', label: '263' }, { v: '273', label: '273' }, { v: '2613', label: '2613' }, { v: '283', label: '283' }], answer: '273',
        hints: ['Birler: 9 + 4 = 13. 3 yaz, 1 elde.', 'Onlar: 0 + 6 + 1 = 7. Yüzler: 2. Sonuç 273.'] },
      { id: 'm-c3', prompt: 'Kütüphanede 128 hikâye kitabı ve 45 masal kitabı var. Toplam kaç kitap var?', skill: 'Toplama problemleri',
        options: [{ v: '163', label: '163' }, { v: '173', label: '173' }, { v: '1613', label: '1613' }, { v: '183', label: '183' }], answer: '173',
        hints: ['Hikâye ve masal kitaplarını topla: 128 + 45.', '8 + 5 = 13: 3 yaz, 1 elde. 2 + 4 + 1 = 7. Yüzler: 1. Sonuç 173.'] }
    ]
  },

  'k-toplam-tahmin': {
    course: '3-matematik', title: 'Toplamı Tahmin Etme', code: 'MAT.3.2.1',
    learned: 'Sayıları en yakın onluğa yuvarlayarak toplamı tahmin etmeyi öğrendin',
    homeTip: 'Alışverişte iki ürünün fiyatını yuvarlayıp "yaklaşık ne kadar tutar?" diye birlikte tahmin edin.',
    watch: [
      { visual: '38 → 40', big: true, text: '38, 40\'a 30\'dan daha yakındır. Bu yüzden 38\'i 40\'a yuvarlarız.' },
      { visual: '21 → 20', big: true, text: 'Birler basamağı 5\'ten küçükse aşağı, 5 ya da büyükse yukarı yuvarlarız.' },
      { visual: '40 + 20 = 60', big: true, text: '38 + 21 toplamı yaklaşık 60\'tır. Gerçek sonuç 59, tahminimiz çok yakın!' }
    ],
    practice: [
      { id: 't-p1', prompt: '52 en yakın hangi onluğa yuvarlanır?', skill: 'En yakın onluğa yuvarlama',
        options: [{ v: '50', label: '50' }, { v: '60', label: '60' }], answer: '50',
        hints: ['Birler basamağına bak: 2. Bu 5\'ten küçük mü?', '2, 5\'ten küçük: aşağı yuvarlarız. 52 → 50.'] },
      { id: 't-p2', prompt: '38 + 21 toplamının tahmini hangisi?', skill: 'Toplamı tahmin etme',
        options: [{ v: '50', label: '50' }, { v: '60', label: '60' }, { v: '70', label: '70' }], answer: '60',
        hints: ['Önce iki sayıyı da yuvarla: 38 → ?, 21 → ?', '38 → 40, 21 → 20. 40 + 20 = 60.'] },
      { id: 't-p3', prompt: '67 + 29 yaklaşık kaç eder?', skill: 'Toplamı tahmin etme',
        options: [{ v: '80', label: '80' }, { v: '90', label: '90' }, { v: '100', label: '100' }], answer: '100',
        hints: ['67 hangi onluğa yakın? 29 hangi onluğa yakın?', '67 → 70, 29 → 30. 70 + 30 = 100.'] }
    ],
    check: [
      { id: 't-c1', prompt: '43 en yakın hangi onluğa yuvarlanır?', skill: 'En yakın onluğa yuvarlama',
        options: [{ v: '40', label: '40' }, { v: '50', label: '50' }], answer: '40',
        hints: ['Birler basamağı 3. 5\'ten küçük mü?', '3 küçük: aşağı yuvarla. 43 → 40.'] },
      { id: 't-c2', prompt: '18 + 31 yaklaşık kaç eder?', skill: 'Toplamı tahmin etme',
        options: [{ v: '40', label: '40' }, { v: '50', label: '50' }, { v: '60', label: '60' }], answer: '50',
        hints: ['18 → ?, 31 → ?', '18 → 20, 31 → 30. 20 + 30 = 50.'] },
      { id: 't-c3', prompt: '76 + 14 yaklaşık kaç eder?', skill: 'Toplamı tahmin etme',
        options: [{ v: '80', label: '80' }, { v: '90', label: '90' }, { v: '100', label: '100' }], answer: '90',
        hints: ['76 → ?, 14 → ?', '76 → 80, 14 → 10. 80 + 10 = 90.'] }
    ]
  },

  // ---- Pilot buluşma ----
  'b-pazar-yeri': {
    meeting: true, grade: 3, chars: ['pitsi', 'lumo'],
    title: 'Pazar Yeri Telaşı',
    learned: 'Alışveriş listesini okuyup fiyatları topladın ve paranın yetip yetmediğini buldun',
    homeTip: 'Bir sonraki alışverişte listeyi çocuğunuz okusun, toplamı birlikte hesaplayın.',
    watch: [
      { char: 'pitsi', visual: '📝', text: 'Maskotumuz bize bir alışveriş listesi bırakmış! Önce birlikte okuyalım.' },
      { char: 'pitsi', visual: '🍅 Domates – 24 TL\n🥒 Salatalık – 18 TL\n🍞 Ekmek – 15 TL', list: true, text: 'Listede domates, salatalık ve ekmek var.' },
      { char: 'lumo', visual: '💰 60 TL', big: true, text: 'Cebimizde 60 lira var. Hepsine yeter mi? Hadi hesaplayalım!' }
    ],
    practice: [
      { id: 'b-p1', char: 'pitsi', prompt: 'Listede kaç ürün var?', skill: 'Listeyi okuyup anlama',
        options: [{ v: '2', label: '2' }, { v: '3', label: '3' }, { v: '4', label: '4' }], answer: '3',
        hints: ['Listeyi satır satır oku: domates, salatalık…', 'Domates, salatalık, ekmek: 1, 2, 3!'] },
      { id: 'b-p2', char: 'lumo', prompt: 'Domates (24 TL) ve salatalık (18 TL) birlikte kaç lira?', skill: 'Toplama problemleri',
        options: [{ v: '32', label: '32 TL' }, { v: '42', label: '42 TL' }, { v: '312', label: '312 TL' }], answer: '42',
        hints: ['Birler: 4 + 8 = 12. Elde var mı?', '2 yaz, 1 elde. 2 + 1 + 1 = 4. Toplam 42 TL.'] },
      { id: 'b-p3', char: 'lumo', prompt: 'Ekmeği (15 TL) de ekleyelim: 42 + 15 = ?', skill: 'Toplama problemleri',
        options: [{ v: '47', label: '47 TL' }, { v: '57', label: '57 TL' }, { v: '67', label: '67 TL' }], answer: '57',
        hints: ['Birler: 2 + 5 = 7. Onlar: 4 + 1 = ?', '4 + 1 = 5. Toplam 57 TL.'] },
      { id: 'b-p4', char: 'pitsi', prompt: '60 liramız var, alışveriş 57 lira tuttu. Paramız yeter mi?', skill: 'Sonucu yorumlama',
        options: [{ v: 'yeter3', label: 'Evet, 3 TL artar' }, { v: 'eksik3', label: 'Hayır, 3 TL eksik' }, { v: 'tam', label: 'Evet, tam yeter' }], answer: 'yeter3',
        hints: ['57, 60\'tan küçük mü büyük mü?', '57 < 60. 60 − 57 = 3. Paramız yeter, 3 TL artar.'] }
    ],
    check: []
  }
};

// Ders evleri için konu sayısı
export function courseTopics(courseId) {
  const c = COURSES[courseId];
  return c ? c.units.flatMap(u => u.topics) : [];
}
// Konunun karakteri
export function topicChar(topic, q) {
  if (q && q.char) return q.char;
  if (topic.meeting) return topic.chars[0];
  return SUBJECTS[COURSES[topic.course].subject].char;
}

// ---- Konu durakları (patika) ----
// Her konu dört duraktan oluşur; öğrenci durakları istediği sırada çalışır.
// Ders Araçları patikanın üstündeki yardımcı düğmedir.
export const STOP_TYPES: any = {
  // Patikada her konu bir gezegen, dört durak onun uydusu. Uydu görselleri: gri (başlanmamış) ve renkli (tamamlandı).
  anlatim:   { icon: '🎧', label: 'Konu Anlatımı', color: '#1E9BEA', kp: 10, art: '/kampus/assets/patika/uydu-anlatim.png', artOff: '/kampus/assets/patika/uydu-anlatim-gri.png' },
  alistirma: { icon: '✏️', label: 'Alıştırmalar',  color: '#FF7A1A', kp: 10, art: '/kampus/assets/patika/uydu-alistirma.png', artOff: '/kampus/assets/patika/uydu-alistirma-gri.png' },
  minitest:  { icon: '✅', label: 'Mini Test',     color: '#8E4FE0', kp: 10, art: '/kampus/assets/patika/uydu-minitest.png', artOff: '/kampus/assets/patika/uydu-minitest-gri.png' },
  calisma:   { icon: '🖨️', label: 'Çalışma Kâğıdı', color: '#1AA6B7', sheet: true },
  ozet:      { icon: '📖', label: 'Konu Özeti',    color: '#1CB8A8', kp: 5, art: '/kampus/assets/patika/uydu-ozet.png', artOff: '/kampus/assets/patika/uydu-ozet-gri.png' }
};
// Konunun dört uydusu. Çalışma Kâğıdı uydu değildir; gezegenin yanındaki yazıcı düğmesiyle açılır ve ilerlemeye sayılmaz.
export const STOP_ORDER: any = ['anlatim', 'alistirma', 'minitest', 'ozet'];
export const MINITEST_SIZE: any = 5;

export function topicStops(topic) {
  if (!topic || topic.meeting) return [];
  return STOP_ORDER.map(id => ({ id, ...STOP_TYPES[id] }));
}

// Durak içerikleri. Yeni biçimde yazılmış konular (lesson/exercises/testPool/summary) doğrudan kullanılır;
// eski biçimdeki konular (watch/practice/check) otomatik dönüştürülür.
export function stopContent(topic) {
  const choice = q => ({ ...q, type: q.type || 'choice' });
  const lesson = topic.lesson || (topic.watch || []).map(sl => ({ text: sl.text, say: sl.say, visual: { kind: 'text', text: sl.visual } }));
  const exercises = (topic.exercises || topic.practice || []).map(choice);
  const testPool = (topic.testPool || [...(topic.check || []), ...(topic.practice || [])]).map(choice);
  const summary = topic.summary || {
    idea: topic.learned + '.',
    points: (topic.watch || []).slice(0, 3).map(sl => sl.text),
    example: topic.watch && topic.watch[0] ? { title: 'Örnek', lines: [topic.watch[0].visual] } : null
  };
  return { lesson, exercises, testPool, summary };
}

// ---- Değerlendirmelerde ölçülen beceriler (sonuç ekranındaki geri bildirim cümleleri) ----
export const ASSESS_SKILLS: any = {
  karsilastirma: { subject: 'matematik', name: 'Sayıları karşılaştırma', can: 'Sayıları karşılaştırabiliyorsun', study: 'sayı karşılaştırmayı', course: '3-matematik', topicId: 'k-dogal-karsilastirma' },
  basamak:       { subject: 'matematik', name: 'Basamak değeri', can: 'Basamak değerini biliyorsun', study: 'basamak değerini', course: '3-matematik', topicId: 'p-cozumleme' },
  ritmik:        { subject: 'matematik', name: 'Ritmik sayma', can: 'Ritmik sayabiliyorsun', study: 'ritmik saymayı', course: '3-matematik', topicId: 'p-ritmik' },
  tekcift:       { subject: 'matematik', name: 'Tek ve çift sayılar', can: 'Tek ve çift sayıları ayırt edebiliyorsun', study: 'tek ve çift sayıları', course: '3-matematik', topicId: 'p-tek-cift' },
  kesir:         { subject: 'matematik', name: 'Bütün, yarım, çeyrek', course: '3-matematik', topicId: 'p-butun-yarim-ceyrek' },
  saat:          { subject: 'matematik', name: 'Saati okuma', course: '3-matematik', topicId: 'p-saat' },
  para:          { subject: 'matematik', name: 'Paralarımız', course: '3-matematik', topicId: 'p-paralar' },
  okuma:         { subject: 'turkce', name: 'Okuduğunu anlama', can: 'Okuduğunu anlıyorsun', study: 'okuduğunu anlamayı', course: '3-turkce' },
  kelime:        { subject: 'turkce', name: 'Eş ve zıt anlamlı kelimeler', can: 'Eş ve zıt anlamlı kelimeleri biliyorsun', study: 'eş ve zıt anlamlı kelimeleri', course: '3-turkce' },
  saglik:        { subject: 'hayat', name: 'Sağlığını koruma', can: 'Sağlığını korumayı biliyorsun', study: 'sağlıklı yaşam davranışlarını', course: '3-hayat' },
  guvenlik:      { subject: 'hayat', name: 'Güvenlik ve trafik', can: 'Güvenlik ve trafik kurallarını biliyorsun', study: 'güvenlik ve trafik kurallarını', course: '3-hayat' },
  afet:          { subject: 'hayat', name: 'Afetlerde yapılacaklar', can: 'Afetlerde ne yapacağını biliyorsun', study: 'afetlerde yapılacakları', course: '3-hayat' }
};
// ---- Süreç değerlendirmesi soru havuzu (öğretmen beceri seçer, sistem her beceriden soru çeker) ----
// grade: hangi sınıf düzeyi için. Bütün sınıfa aynı sorular gider; böylece sonuçlar karşılaştırılabilir.
export const ASSESS_BANK: any = [
  { id: 'b-k1', grade: 3, skill: 'karsilastirma', type: 'choice', prompt: 'Hangisi en büyük?', options: [{ v: '519', label: '519' }, { v: '591', label: '591' }, { v: '195', label: '195' }], answer: '591' },
  { id: 'b-k2', grade: 3, skill: 'karsilastirma', type: 'write', input: 'sign', prompt: 'Boşluğa işaret yaz:  408 ☐ 480', answer: '<' },
  { id: 'b-k3', grade: 3, skill: 'karsilastirma', type: 'tf', prompt: '999 sayısı 1000 sayısından küçüktür.', answer: true },
  { id: 'b-k4', grade: 3, skill: 'karsilastirma', type: 'choice', prompt: 'Küçükten büyüğe sıralanmış olan hangisi?', options: [{ v: 'a', label: '246 < 264 < 426' }, { v: 'b', label: '264 < 246 < 426' }, { v: 'c', label: '426 < 264 < 246' }], answer: 'a' },
  { id: 'b-b1', grade: 3, skill: 'basamak', type: 'choice', prompt: '674 sayısında 6 rakamının basamak değeri kaçtır?', options: [{ v: '6', label: '6' }, { v: '60', label: '60' }, { v: '600', label: '600' }], answer: '600' },
  { id: 'b-b2', grade: 3, skill: 'basamak', type: 'write', input: 'number', prompt: '3 yüzlük, 5 onluk ve 0 birlikten oluşan sayıyı yaz.', answer: '350' },
  { id: 'b-b3', grade: 3, skill: 'basamak', type: 'tf', prompt: '508 sayısının onlar basamağında 0 rakamı vardır.', answer: true },
  { id: 'b-b4', grade: 3, skill: 'basamak', type: 'write', input: 'number', prompt: '400 + 60 + 2 kaçtır?', answer: '462' },
  { id: 'b-r1', grade: 3, skill: 'ritmik', type: 'write', input: 'number', prompt: 'Sekizer ileri say:  8, 16, 24, ☐', answer: '32' },
  { id: 'b-r2', grade: 3, skill: 'ritmik', type: 'choice', prompt: 'Onar geri say:  370, 360, 350, ☐', options: [{ v: '340', label: '340' }, { v: '345', label: '345' }, { v: '250', label: '250' }], answer: '340' },
  { id: 'b-r3', grade: 3, skill: 'ritmik', type: 'tf', prompt: '6, 12, 18, 24 dizisinde altışar ileri sayılmıştır.', answer: true },
  { id: 'b-r4', grade: 3, skill: 'ritmik', type: 'choice', prompt: '900, 800, 700, ☐', options: [{ v: '650', label: '650' }, { v: '600', label: '600' }, { v: '500', label: '500' }], answer: '600' },
  { id: 'b-t1', grade: 3, skill: 'tekcift', type: 'choice', prompt: 'Hangisi tek sayıdır?', options: [{ v: '64', label: '64' }, { v: '70', label: '70' }, { v: '87', label: '87' }], answer: '87' },
  { id: 'b-t2', grade: 3, skill: 'tekcift', type: 'tf', prompt: '0 bir çift sayıdır.', answer: true },
  { id: 'b-t3', grade: 3, skill: 'tekcift', type: 'tf', prompt: 'Bir tek ve bir çift sayının toplamı çift sayıdır.', answer: false },
  { id: 'b-t4', grade: 3, skill: 'tekcift', type: 'choice', prompt: '5 + 7 toplamı nasıl bir sayıdır?', options: [{ v: 'tek', label: 'Tek' }, { v: 'cift', label: 'Çift' }], answer: 'cift' },
  // Türkçe (okuma, söz varlığı)
  { id: 'b-o1', grade: 3, skill: 'okuma', type: 'choice', prompt: 'Ece sabah erken kalktı, kahvaltısını yaptı ve bisikletiyle parka gitti. Parkta arkadaşı Can\'ı gördü.  Ece parka neyle gitti?', options: [{ v: 'a', label: 'Yürüyerek' }, { v: 'b', label: 'Bisikletle' }, { v: 'c', label: 'Otobüsle' }], answer: 'b' },
  { id: 'b-o2', grade: 3, skill: 'okuma', type: 'tf', prompt: 'Kuşlar kışın sıcak ülkelere göç eder. Bazı kuşlar ise bulunduğu yerde kalır.  Metne göre bütün kuşlar göç eder.', answer: false },
  { id: 'b-o3', grade: 3, skill: 'okuma', type: 'choice', prompt: 'Ali bahçeye üç fidan dikti. Her gün fidanlarını suladı. Bahar gelince fidanlar çiçek açtı.  Metnin konusu nedir?', options: [{ v: 'a', label: 'Ali\'nin fidan yetiştirmesi' }, { v: 'b', label: 'Baharın gelmesi' }, { v: 'c', label: 'Ali\'nin okula gitmesi' }], answer: 'a' },
  { id: 'b-o4', grade: 3, skill: 'okuma', type: 'write', input: 'number', prompt: 'Zeynep kütüphaneden 2 masal, 3 şiir kitabı aldı.  Zeynep toplam kaç kitap aldı?', answer: '5' },
  { id: 'b-k1', grade: 3, skill: 'kelime', type: 'choice', prompt: '"Büyük" kelimesinin zıt anlamlısı hangisidir?', options: [{ v: 'kucuk', label: 'küçük' }, { v: 'iri', label: 'iri' }, { v: 'genis', label: 'geniş' }], answer: 'kucuk' },
  { id: 'b-k2', grade: 3, skill: 'kelime', type: 'tf', prompt: '"Okul" ile "mektep" eş anlamlı kelimelerdir.', answer: true },
  { id: 'b-k3', grade: 3, skill: 'kelime', type: 'choice', prompt: '"Cevap" kelimesinin eş anlamlısı hangisidir?', options: [{ v: 'soru', label: 'soru' }, { v: 'yanit', label: 'yanıt' }, { v: 'sual', label: 'sual' }], answer: 'yanit' },
  { id: 'b-k4', grade: 3, skill: 'kelime', type: 'tf', prompt: '"Sıcak" kelimesinin zıt anlamlısı "ılık"tır.', answer: false },
  // Hayat Bilgisi (HB.3.2.1 sağlık, HB.3.2.2–3 güvenlik ve trafik, HB.3.5.3 afetler)
  { id: 'b-s1', grade: 3, skill: 'saglik', type: 'choice', prompt: 'Hangisi sağlığımızı korumak için yapılır?', options: [{ v: 'a', label: 'Yemekten önce ellerimizi yıkamak' }, { v: 'b', label: 'Gece geç saatlere kadar uyanık kalmak' }, { v: 'c', label: 'Çok şekerli yiyecekler yemek' }], answer: 'a' },
  { id: 'b-s2', grade: 3, skill: 'saglik', type: 'tf', prompt: 'Dişlerimizi günde en az iki kez fırçalamalıyız.', answer: true },
  { id: 'b-s3', grade: 3, skill: 'saglik', type: 'tf', prompt: 'Düzenli spor yapmak sağlığımıza zarar verir.', answer: false },
  { id: 'b-s4', grade: 3, skill: 'saglik', type: 'choice', prompt: 'Dengeli beslenmek için hangisi doğrudur?', options: [{ v: 'a', label: 'Her öğünde yalnızca aynı yiyeceği yemek' }, { v: 'b', label: 'Sebze, meyve ve süt ürünleri tüketmek' }, { v: 'c', label: 'Kahvaltı yapmamak' }], answer: 'b' },
  { id: 'b-g1', grade: 3, skill: 'guvenlik', type: 'choice', prompt: 'Karşıdan karşıya nereden geçmeliyiz?', options: [{ v: 'a', label: 'Yaya geçidinden' }, { v: 'b', label: 'Park etmiş araçların arasından' }, { v: 'c', label: 'Virajlardan' }], answer: 'a' },
  { id: 'b-g2', grade: 3, skill: 'guvenlik', type: 'tf', prompt: 'Yayalar için kırmızı ışık yanarken karşıya geçilebilir.', answer: false },
  { id: 'b-g3', grade: 3, skill: 'guvenlik', type: 'choice', prompt: 'Tanımadığın biri seni arabasına çağırırsa ne yaparsın?', options: [{ v: 'a', label: 'Arabaya binerim' }, { v: 'b', label: 'Hayır der, güvendiğim bir büyüğe haber veririm' }, { v: 'c', label: 'Adresimi söylerim' }], answer: 'b' },
  { id: 'b-g4', grade: 3, skill: 'guvenlik', type: 'tf', prompt: 'Arabanın arka koltuğunda da emniyet kemeri takılmalıdır.', answer: true },
  { id: 'b-a1', grade: 3, skill: 'afet', type: 'choice', prompt: 'Deprem anında ne yapmalıyız?', options: [{ v: 'a', label: 'Çök, kapan, tutun' }, { v: 'b', label: 'Merdivenlerden koşarak inmek' }, { v: 'c', label: 'Asansöre binmek' }], answer: 'a' },
  { id: 'b-a2', grade: 3, skill: 'afet', type: 'tf', prompt: 'Afet ve acil durum çantası afetten önce hazırlanır.', answer: true },
  { id: 'b-a3', grade: 3, skill: 'afet', type: 'choice', prompt: 'Hangisi afetten sonra yapılır?', options: [{ v: 'a', label: 'Afet çantası hazırlamak' }, { v: 'b', label: 'Toplanma alanına gitmek' }, { v: 'c', label: 'Dolapları duvara sabitlemek' }], answer: 'b' },
  { id: 'b-a4', grade: 3, skill: 'afet', type: 'tf', prompt: 'Yangın anında binadan çıkmak için asansör kullanılır.', answer: false }
];

export const ASSESS_KINDS: any = {
  tema:  { label: 'Tema / Ünite Değerlendirme', short: 'Tema Değerlendirme', icon: '🏁', desc: 'Bir tema bittiğinde birden fazla konuyu birlikte ölçer.' },
  surec: { label: 'Süreç Değerlendirme', short: 'Süreç Değerlendirme', icon: '🧭', desc: 'Öğretmeninin atadığı karma değerlendirme: Türkçe, Matematik, Hayat Bilgisi gibi derslerden sorular birlikte gelir. Sonuç, hangi beceriyi tekrar edeceğini gösterir.' }
};

// Süreç değerlendirmesi birden çok dersi kapsar (karma)
export const KARMA: any = { name: 'Karma', char: 'maskot', color: '#7C5CF0' };
export const examSubject: any = e => e.kind === 'surec' ? KARMA : SUBJECTS[e.subject];
export const examSubjects: any = e => [...new Set((e.skills || []).map(k => ASSESS_SKILLS[k] && ASSESS_SKILLS[k].subject).filter(Boolean))];

// ---- Hareketli karakterler (GIF): patikada çalışılan tema ve kartlarda kullanılır ----
export const SUBJECT_GIFS: any = {
  matematik: ['/kampus/assets/karakterler/hareketli/lumo-sevinc.gif', '/kampus/assets/karakterler/hareketli/lumo-ipucu.gif']
};

// ---- Konu gezegenleri: yüzeyindeki sahne konuyu çağrıştırır. Görseli olmayan konularda simgeli yedek gezegen çizilir. ----
// badge: konu tamamlanınca kazanılan rozetin kendine özgü adı (konu başlığından ayrı bir unvan).
export const TOPIC_PLANETS: any = {
  'p-1000e-kadar': { badge: 'Sayı Mimarı', art: '/kampus/assets/patika/gezegen-p-1000e-kadar.png' },
  'p-cozumleme': { badge: 'Basamak Şifre Ustası', art: '/kampus/assets/patika/gezegen-p-cozumleme.png' },
  'k-dogal-karsilastirma': { badge: 'Denge Kaptanı', art: '/kampus/assets/patika/gezegen-k-dogal-karsilastirma.png' },
  'p-ritmik': { badge: 'Ritim Roketi', art: '/kampus/assets/patika/gezegen-p-ritmik.png' },
  'p-yuvarlama': { badge: 'Yuvarlama Pusulası', art: '/kampus/assets/patika/gezegen-p-yuvarlama.png' },
  'p-tek-cift': { badge: 'Çift Çorap Dedektifi', art: '/kampus/assets/patika/gezegen-p-tek-cift.png' },
  'p-tek-cift-toplam': { badge: 'Toplam Sihirbazı', art: '/kampus/assets/patika/gezegen-p-tek-cift-toplam.png' },
  'p-oruntu': { badge: 'Örüntü Kâşifi', art: '/kampus/assets/patika/gezegen-p-oruntu.png' },
  'p-nesne-tahmin': { badge: 'Kavanoz Tahmincisi', art: '/kampus/assets/patika/gezegen-p-nesne-tahmin.png' }
};

// ---- 💎 KP (Kampüs Puanı) ve ⭐ Kupa Yıldızı ----
// KP harcanabilir bakiyedir, haftalar arasında birikir (avatar parçaları); çalışmayı tamamlamanın ödülüdür.
// ⭐ Kupa Yıldızı doğru cevap sayısından gelir (soru başına 1) ve her pazartesi sıfırlanır.
export const KP_RULES: any = { anlatim: 10, alistirma: 10, minitest: 10, ozet: 5, kitapBitir: 5, kitapSoru: 3, kitapMax: 20, oyun: 5, gunluk: 5, bonus: 5 };
export const KP_TABLE: any = [
  ['🎧', 'Konu anlatımını ilk kez tamamla', '+10 💎', '—'],
  ['✏️', 'Alıştırmayı ilk kez tamamla', '+10 💎', 'ilk denemede doğru her soru 1 ⭐'],
  ['✅', 'Yeni bir mini test setini tamamla', '+10 💎', 'her doğru cevap 1 ⭐'],
  ['📖', 'Konu özetini ilk kez tamamla', '+5 💎', '—'],
  ['📚', 'Bir kitabı ilk kez bitir', '+5 💎', '—'],
  ['❓', 'Kitap sorusunu ilk kez doğru cevapla', '+3 💎 (en fazla 15)', '1 ⭐'],
  ['🎮', 'Eğitici oyun turu (günde bir kez)', '+5 💎', 'her doğru cevap 1 ⭐'],
  ['🎯', 'Günlük görevi tamamla', '+5 💎', '—'],
  ['🎁', 'Haftanın bonus görevini tamamla', '+5 💎', '—']
];
// Haftanın kupası: her hafta farklı bir kupa. Her grubun ilk 5'i (5. sıradaki eşitlik dahil) o haftanın kupasını kazanır.
export const CUP_WINNERS: any = 5;        // 12+ kişilik grupta ilk 5; 6–11 kişide ilk 3; 1–5 kişide ilk 1 (eşitlik dahil)
export const CUP_GROUP_SIZE: any = 20;   // gruplar katılım sırasıyla 20'şer kişi dolar
export const STAR_DAILY_MAX: any = 10;   // günde en fazla 10 ⭐
// Takma ad listeleri (sıfat + isim). Takma adlar yalnızca bu listelerden oluşur; serbest metin yok.
export const NICK_ADJ: any = [['Cesur'], ['Meraklı'], ['Neşeli'], ['Mavi'], ['Hızlı'], ['Parlak'], ['Sakin'], ['Uçan'], ['Gizemli'], ['Akıllı'], ['Renkli'], ['Sevimli'], ['Minik'], ['Bulut'], ['Yıldızlı'], ['Güneşli']];
export const NICK_NOUN: any = [['Yunus', '🐬'], ['Balina', '🐋'], ['Kartal', '🦅'], ['Tavşan', '🐰'], ['Roket', '🚀'], ['Sincap', '🐿️'], ['Baykuş', '🦉'], ['Pusula', '🧭'], ['Panda', '🐼'], ['Tilki', '🦊'], ['Kaplumbağa', '🐢'], ['Fener', '🔦'], ['Kuyrukluyıldız', '☄️'], ['Penguen', '🐧'], ['Ahtapot', '🐙'], ['Zürafa', '🦒']];
export const CUP_THEMES: any = [
  { id: 'kuyruklu-yildiz', name: 'Kuyruklu Yıldız Kupası', color: '#FFB300', glow: '#FFE27A', emblem: 'comet' },
  { id: 'ay-isigi', name: 'Ay Işığı Kupası', color: '#7C8CF8', glow: '#DDE3FF', emblem: 'moon' },
  { id: 'gunes', name: 'Güneş Kupası', color: '#FF8A3D', glow: '#FFD8A8', emblem: 'sun' },
  { id: 'gokkusagi', name: 'Gökkuşağı Kupası', color: '#E25A86', glow: '#FFD3E2', emblem: 'rainbow' },
  { id: 'saturn', name: 'Satürn Kupası', color: '#1AA6B7', glow: '#C9F1F5', emblem: 'saturn' },
  { id: 'kuzey-isigi', name: 'Kuzey Işığı Kupası', color: '#34B256', glow: '#CFF2D8', emblem: 'aurora' }
];
// Karma katılım görevi havuzu: her hafta üçü seçilir (anlatım, alıştırma, mini test, özet, kitap, oyun).
// Katılım görevi: iki kısa zorunlu görev (1. sabit: alıştırma ya da mini test; 2. haftaya göre değişir) + isteğe bağlı bonus görev.
export const CUP_TASK_POOL: any = [
  { id: 'calis', stops: ['alistirma', 'minitest'], label: 'Bir alıştırma ya da mini test bitir', icon: '✏️' },
  { id: 'anlatim', stops: ['anlatim'], label: 'Bir konu anlatımı dinle', icon: '🎧' },
  { id: 'ozet', stops: ['ozet'], label: 'Bir konu özeti oku', icon: '📖' },
  { id: 'kitap', stops: ['kitap'], label: 'Bir kitap oku ve anlama sorularını tamamla', icon: '📚' },
  { id: 'oyun', stops: ['oyun'], label: 'Bir oyun turunu bitir', icon: '🎮' }
];
export const CUP_WEEKLY_TASKS: any = ['anlatim', 'kitap', 'oyun'];          // 2. görev haftadan haftaya döner
export const CUP_BONUS_TASKS: any = ['ozet', 'oyun', 'anlatim', 'kitap'];   // bonus görev (2. görevden farklı olanı seçilir)

// ---- E-Kütüphane: örnek kitaplar (her kitapta 5 anlama sorusu) ----
export const BOOKS: any = [
  { id: 'kayip-kitap', title: 'Kayıp Kitap', cover: '📕', color: '#E25A86', grade: 3,
    pages: [
      'Ece okul kütüphanesinde en sevdiği kitabı arıyordu. Kitabın adı "Bulut Gemisi"ydi ve kırmızı bir kapağı vardı.',
      'Rafları tek tek dolaştı. Masal rafında yoktu, bilim rafında da yoktu. Ece biraz üzüldü.',
      'Kütüphaneci Ayşe Hanım, "Kitapları alfabe sırasıyla dizdik. B harfine bakmayı denedin mi?" dedi.',
      'Ece B harfinin olduğu rafa gitti. Kırmızı kapaklı kitap oradaydı! Sevinçle kitabı aldı ve okumaya başladı.',
      'O günden sonra Ece, aradığı kitapları bulmak için önce alfabe sırasına bakmayı hiç unutmadı.'
    ],
    questions: [
      { id: 'q1', prompt: 'Ece hangi kitabı arıyordu?', options: [['a', 'Bulut Gemisi'], ['b', 'Sayı Avcıları'], ['c', 'Ormandaki Sesler']], answer: 'a' },
      { id: 'q2', prompt: 'Kitabın kapağı ne renkti?', options: [['a', 'Mavi'], ['b', 'Kırmızı'], ['c', 'Yeşil']], answer: 'b' },
      { id: 'q3', prompt: 'Ece\'ye kim yardım etti?', options: [['a', 'Annesi'], ['b', 'Sınıf arkadaşı'], ['c', 'Kütüphaneci Ayşe Hanım']], answer: 'c' },
      { id: 'q4', prompt: 'Kitaplar nasıl dizilmişti?', options: [['a', 'Renklerine göre'], ['b', 'Alfabe sırasıyla'], ['c', 'Boylarına göre']], answer: 'b' },
      { id: 'q5', prompt: 'Ece bu olaydan ne öğrendi?', options: [['a', 'Kitap aramadan önce alfabe sırasına bakmayı'], ['b', 'Kütüphaneye hiç gitmemeyi'], ['c', 'Sadece masal okumayı']], answer: 'a' }
    ] },
  { id: 'sayi-avcilari', title: 'Sayı Avcıları', cover: '📘', color: '#1E88E5', grade: 3,
    pages: [
      'Can ile Defne hafta sonu pazara gittiler. Amaçları, pazarda gördükleri en büyük sayıyı bulmaktı.',
      'Domatesçinin tabelasında 25 lira yazıyordu. Defne, "Bu büyük bir sayı!" dedi.',
      'Can biraz ileride 120 kilogramlık bir patates çuvalı gördü. "120, 25\'ten çok daha büyük!" diye bağırdı.',
      'En sonunda pazarın girişindeki tabelayı fark ettiler: "Bugün 850 kişi bizi ziyaret etti."',
      'Can ile Defne güldüler. Günün en büyük sayısı 850\'ydi. Bir sonraki hafta yeni sayılar avlamak için sözleştiler.'
    ],
    questions: [
      { id: 'q1', prompt: 'Can ile Defne nereye gittiler?', options: [['a', 'Parka'], ['b', 'Pazara'], ['c', 'Okula']], answer: 'b' },
      { id: 'q2', prompt: 'Domatesçinin tabelasında kaç lira yazıyordu?', options: [['a', '25'], ['b', '52'], ['c', '120']], answer: 'a' },
      { id: 'q3', prompt: 'Patates çuvalı kaç kilogramdı?', options: [['a', '25'], ['b', '850'], ['c', '120']], answer: 'c' },
      { id: 'q4', prompt: 'Günün en büyük sayısı hangisiydi?', options: [['a', '850'], ['b', '120'], ['c', '25']], answer: 'a' },
      { id: 'q5', prompt: 'Çocuklar bir sonraki hafta ne yapmaya karar verdi?', options: [['a', 'Pazara hiç gitmemeye'], ['b', 'Yeni sayılar avlamaya'], ['c', 'Patates almaya']], answer: 'b' }
    ] }
];

// ---- Oyunlar: eğitici oyunlar (bir tur birkaç kısa sorudan oluşur) ----
export const GAMES: any = [
  { id: 'sayi-balonlari', title: 'Sayı Balonları', icon: '🎈', subject: 'matematik', desc: 'Büyük sayıyı taşıyan balonu patlat! 8 soru.', rounds: 8 }
];

// ---- Avatar ----
// Temel parçalar ücretsiz; özel kıyafet, aksesuar ve arka planlar 💎 KP ile açılır (price = KP).
export const AVATAR_DEFAULT: any = { skin: '#F6CBA8', hair: 'kisa', hairColor: '#6B3E26', shirt: '#4C8DF0', eyes: '#4A3426' };
export const AVATAR_BASE: any = {
  skin: ['#FBE0C8', '#F6CBA8', '#E0A77E', '#B97A53', '#8A5638'],
  hair: [['kisa', 'Kısa'], ['uzun', 'Uzun'], ['kivircik', 'Kıvırcık'], ['topuz', 'Topuz'], ['kel', 'Saçsız']],
  hairColor: ['#2B1D14', '#6B3E26', '#C2662D', '#E8B84A', '#7A5CF0'],
  shirt: ['#4C8DF0', '#34B256', '#FF7A1A', '#E25A86', '#8E5CF7', '#F2B705'],
  eyes: ['#4A3426', '#2F6FBF', '#4E8F2A', '#6B4E9B', '#2B1D14']
};
export const AVATAR_ITEMS: any = [
  { id: 'roket-gozluk', slot: 'acc', name: 'Roket Gözlüğü', price: 30 },
  { id: 'kasif-sapka', slot: 'acc', name: 'Kâşif Şapkası', price: 35 },
  { id: 'yildiz-tac', slot: 'acc', name: 'Yıldız Taç', price: 40 },
  { id: 'kulaklik', slot: 'acc', name: 'Müzik Kulaklığı', price: 25 },
  { id: 'uzay-tulumu', slot: 'outfit', name: 'Uzay Tulumu', price: 50 },
  { id: 'super-pelerin', slot: 'outfit', name: 'Süper Pelerin', price: 45 },
  { id: 'sporcu-formasi', slot: 'outfit', name: 'Sporcu Forması', price: 30 },
  { id: 'gece-gokyuzu', slot: 'bg', name: 'Gece Gökyüzü', price: 20 },
  { id: 'orman', slot: 'bg', name: 'Orman', price: 20 },
  { id: 'okyanus', slot: 'bg', name: 'Okyanus', price: 20 },
  { id: 'gezegenler', slot: 'bg', name: 'Gezegenler', price: 25 }
];

// ---- Ders araçları (patikanın üstündeki yardımcı düğme) ----
// Bir derste uygun araç yoksa düğme görünmez.
export const SUBJECT_TOOLS: any = {
  matematik: [
    { id: 'sayi-dogrusu', icon: '📏', label: 'Sayı doğrusu' },
    { id: 'taban-bloklari', icon: '🧱', label: 'Yüzlük–onluk–birlik blokları' }
  ]
};

// ---- MEB öğretim programı (TYMM, tymm.meb.gov.tr, Kasım 2026'da çekildi) ----
// Konu adları öğrenme çıktılarından çocuk diline uyarlandı; `code` MEB öğrenme çıktısı kodudur.
// İçeriği hazır olan konular TOPICS'te; diğerleri patikada "hazırlanıyor" olarak görünür.
export const MEB_PLAN: any = {
  '3-matematik': {
    source: 'https://tymm.meb.gov.tr/ogretim-programlari/ilkokul-matematik-dersi/4',
    themes: [
      { no: 1, title: 'Sayılar ve Nicelikler (1)', topics: [
        { id: 'p-1000e-kadar', title: '1000\'e Kadar Sayılar', code: 'MAT.3.1.1' },
        { id: 'p-cozumleme', title: 'Basamak ve Basamak Değeri', code: 'MAT.3.1.2' },
        { id: 'k-dogal-karsilastirma', title: 'Doğal Sayıları Karşılaştırma', code: 'MAT.3.1.3' },
        { id: 'p-yuvarlama', title: 'En Yakın Onluk ve Yüzlük', code: 'MAT.3.1.3' },
        { id: 'p-ritmik', title: 'Ritmik Sayma', code: 'MAT.3.1.4' },
        { id: 'p-tek-cift', title: 'Tek ve Çift Sayılar', code: 'MAT.3.1.5' },
        { id: 'p-tek-cift-toplam', title: 'Tek ve Çift Sayıların Toplamı', code: 'MAT.3.1.6' },
        { id: 'p-oruntu', title: 'Şekil Örüntüleri', code: 'MAT.3.1.7' },
        { id: 'p-nesne-tahmin', title: 'Nesne Sayısını Tahmin Etme', code: 'MAT.3.1.8' }] },
      { no: 2, title: 'Sayılar ve Nicelikler (2)', topics: [
        { id: 'p-butun-yarim-ceyrek', title: 'Bütün, Yarım ve Çeyrek', code: 'MAT.3.1.9' },
        { id: 'p-birim-kesir', title: 'Birim Kesirler', code: 'MAT.3.1.10' },
        { id: 'p-pay-payda', title: 'Pay ve Payda', code: 'MAT.3.1.11' },
        { id: 'p-saat', title: 'Saati Okuma ve Yazma', code: 'MAT.3.1.12' },
        { id: 'p-zaman-birimleri', title: 'Zaman Ölçü Birimleri', code: 'MAT.3.1.13' },
        { id: 'p-sure-tahmin', title: 'Süreleri Tahmin Etme', code: 'MAT.3.1.14' },
        { id: 'p-uzunluk-kutle', title: 'Uzunluk ve Kütle Birimleri', code: 'MAT.3.1.15' },
        { id: 'p-paralar', title: 'Paralarımız', code: 'MAT.3.1.16' }] },
      { no: 3, title: 'İşlemlerden Cebirsel Düşünmeye', topics: [
        { id: 'k-toplam-tahmin', title: 'Toplamı Tahmin Etme', code: 'MAT.3.2.1' },
        { id: 'k-eldeli-toplama', title: 'Eldeli Toplama', code: 'MAT.3.2.2' },
        { id: 'p-carpma-bolme-tahmin', title: 'Çarpma ve Bölmede Tahmin', code: 'MAT.3.2.3' },
        { id: 'p-carpma-bolme', title: 'Çarpma ve Bölme', code: 'MAT.3.2.4' },
        { id: 'p-yonerge', title: 'Yönergeleri Takip Etme', code: 'MAT.3.2.5' },
        { id: 'p-problemler', title: 'Günlük Yaşam Problemleri', code: 'MAT.3.2.6' },
        { id: 'p-problem-kur', title: 'Problem Kuralım', code: 'MAT.3.2.7' },
        { id: 'p-esitlik', title: 'Eşitliğin Anlamı', code: 'MAT.3.2.8' }] },
      { no: 4, title: 'Nesnelerin Geometrisi (1)', topics: [
        { id: 'p-cisimler', title: 'Geometrik Cisimler', code: 'MAT.3.3.1' },
        { id: 'p-sekiller', title: 'Kenar Sayısına Göre Şekiller', code: 'MAT.3.3.2' },
        { id: 'p-cizim', title: 'Şekil ve Cisim Çizme', code: 'MAT.3.3.3' },
        { id: 'p-cevre', title: 'Çevre Uzunluğunu Tahmin Etme', code: 'MAT.3.3.4' },
        { id: 'p-sivi', title: 'Sıvı Ölçme', code: 'MAT.3.3.5' }] },
      { no: 5, title: 'Nesnelerin Geometrisi (2)', topics: [
        { id: 'p-simetri', title: 'Simetri Doğruları', code: 'MAT.3.3.6' },
        { id: 'p-simetri-tamamla', title: 'Simetriği Tamamlama', code: 'MAT.3.3.7' },
        { id: 'p-simetri-kodlama', title: 'Kodlama ile Simetri', code: 'MAT.3.3.8' }] },
      { no: 6, title: 'Veriye Dayalı Araştırma', topics: [
        { id: 'p-veri', title: 'Veri Toplama ve Karar Verme', code: 'MAT.3.4.1' }] }
    ]
  }
};
export function planTopic(cid, id) {
  const plan = MEB_PLAN[cid]; if (!plan) return null;
  for (const th of plan.themes) { const t = th.topics.find(x => x.id === id); if (t) return { theme: th, topic: t }; }
  return null;
}

// Örnek dersler (kayıtsız)
export const SAMPLE_TOPICS: any = ['k-e-sesi', 'k-eldeli-toplama'];

// ---- Demo veriler ----
// Demo hesaplar: T.C. kimlik numaraları test amaçlı (10000001xxx), algoritmaya uygun üretildi; gerçek kişilere ait değildir.
// Örnek öğrenci (Deniz): T.C. 12345678910 / Admin123. Diğer demo hesapların şifresi: Kampus2026.
// 12345678910 kontrol hanesi algoritmasından geçmez; yalnızca demo istisnası olarak kabul edilir (Store.DEMO_TCS). Şifreler SHA-256(tc + ':' + şifre) karması olarak tutulur.
// Gerçek sistemde karma sunucuda bcrypt/argon2 ile yapılmalı; T.C. kimlik no KVKK kapsamında özel nitelikli kişisel veridir.
export function buildSeed() {
  const day = 864e5, now = Date.now();
  const iso = t => new Date(t).toISOString();
  const day0 = n => iso(now + n * day).slice(0, 10);
  const ans = (spec) => spec; // okunabilirlik için
  return {
    session: null,
    users: [
      { id: 'ali',    role: 'ogrenci', name: 'Ali',    grade: 1, classId: '1-A', tc: '10000001068', passHash: '0c2cfca667ab2e93d473f92230b942a388a4ece229f6a7b86e0a067f87eecd20' },
      { id: 'mert',   role: 'ogrenci', name: 'Mert',   grade: 1, classId: '1-A', tc: '10000001136', passHash: '9077ac2d8391e51f9860b7519a3828e228b222734321eede1df4e76f8e8c1ffd' },
      { id: 'elif',   role: 'ogrenci', name: 'Elif',   grade: 1, classId: '1-A', tc: '10000001204', passHash: '6dc7abb2ff2575f4f5d666f00a2695216e7e889ab1138b2cf9b8ce96a447965a' },
      { id: 'zeynep', role: 'ogrenci', name: 'Zeynep', grade: 3, classId: '3-B', tc: '10000001372', nick: 'Minik Baykuş', emoji: '🦊', cupDemo: 35, passHash: '6905464f7141e991ccde769731a1c36a69980c98623592b6db97fe36cd78186b' },
      { id: 'can',    role: 'ogrenci', name: 'Can',    grade: 3, classId: '3-B', tc: '10000001440', nick: 'Hızlı Roket', emoji: '🚀', cupDemo: 50, passHash: 'e83b1c0be597b76b3a54c4fc34c214dc848bf41cfbc942609294fe6aa980a89a' },
      { id: 'defne',  role: 'ogrenci', name: 'Defne',  grade: 3, classId: '3-B', tc: '10000001518', nick: 'Meraklı Panda', emoji: '🐛', cupDemo: 25, passHash: '97297a1ab23d92240986f8f1c82f74fe7cc63b6ed033497aa45a51d9138eb226' },
      { id: 'deniz',  role: 'ogrenci', name: 'Deniz',  grade: 3, classId: '3-A', tc: '12345678910', nick: 'Cesur Yunus', passHash: 'fafadd7853271a00dfc1a84c357e04d6b5f1037972df6d0c7f40fda16a2d52ec', avatar: '/kampus/assets/karakterler/avatar-deniz.png', stars: 120, league: { name: 'Bronz Lig', rank: 8, points: 60 } },
      { id: 'ada',    role: 'ogrenci', name: 'Ada',    grade: 3, classId: '3-C', tc: '10000001754', nick: 'Yıldızlı Tilki', emoji: '⭐', cupDemo: 10, passHash: 'f40e9cd8f8812fd84f745cd0ee75caf55229d66b4e288b238f8957916ce93a11', stars: 60, league: { name: 'Bronz Lig', rank: 12, points: 60 } },
      { id: 'ogretmen', role: 'ogretmen', name: 'Ayşe Yılmaz', email: 'ogretmen@ornek.com', tc: '10000001822', passHash: 'd2c394a68c43afac501b563887b1eb1b64f942f0697fb2d1ff806d27c84ced6a', classes: ['1-A', '3-A', '3-B'] },
      { id: 'veli',     role: 'veli', name: 'Selin Kaya', email: 'veli@ornek.com', tc: '10000001990', passHash: '0fbb8eea99b42e6b1209873e9da2c93b578fc214b7c2fb5762ff74928b008f6a', children: ['ali', 'zeynep'] }
    ],
    classes: [
      { id: '1-A', name: '1-A', grade: 1, teacherId: 'ogretmen' },
      { id: '3-B', name: '3-B', grade: 3, teacherId: 'ogretmen' },
      { id: '3-A', name: '3-A', grade: 3, teacherId: 'ogretmen' },
      { id: '3-C', name: '3-C', grade: 3, teacherId: null }
    ],
    // Değerlendirmeler (Sınavlar sekmesi). kind: 'tema' = Tema / Ünite Değerlendirme, 'surec' = Süreç Değerlendirme (öğretmen atar).
    // Durum öğrenciye göre hesaplanır: Yakında (opensAt gelecekte) · Başla / Devam et · Sonucu gör.
    exams: [
      { id: 'd-mat-t1', kind: 'tema', classIds: ['3-A', '3-B'], subject: 'matematik', theme: { no: 1, title: 'Sayılar ve Nicelikler (1)' },
        title: 'Sayılar ve Nicelikler (1)', opensAt: day0(-1), closesAt: day0(7), skills: ['karsilastirma', 'basamak', 'ritmik', 'tekcift'],
        questions: [
          { id: 'dt1', skill: 'karsilastirma', type: 'choice', prompt: 'Hangisi en büyük?', options: [{ v: '489', label: '489' }, { v: '498', label: '498' }, { v: '948', label: '948' }], answer: '948' },
          { id: 'dt2', skill: 'karsilastirma', type: 'write', input: 'sign', prompt: 'Boşluğa <, > ya da = yaz:  726 ☐ 762', answer: '<' },
          { id: 'dt3', skill: 'basamak', type: 'choice', prompt: '583 sayısında 8 rakamının basamak değeri kaçtır?', options: [{ v: '8', label: '8' }, { v: '80', label: '80' }, { v: '800', label: '800' }], answer: '80' },
          { id: 'dt4', skill: 'basamak', type: 'write', input: 'number', prompt: '4 yüzlük, 0 onluk ve 7 birlikten oluşan sayıyı yaz.', answer: '407' },
          { id: 'dt5', skill: 'ritmik', type: 'choice', prompt: '30, 36, 42, 48, ☐  Sıradaki sayı hangisi?', options: [{ v: '52', label: '52' }, { v: '54', label: '54' }, { v: '56', label: '56' }], answer: '54' },
          { id: 'dt6', skill: 'ritmik', type: 'tf', prompt: '700, 600, 500, 400 dizisinde yüzer geriye sayılmıştır.', answer: true },
          { id: 'dt7', skill: 'tekcift', type: 'choice', prompt: 'Hangisi çift sayıdır?', options: [{ v: '35', label: '35' }, { v: '47', label: '47' }, { v: '58', label: '58' }], answer: '58' },
          { id: 'dt8', skill: 'tekcift', type: 'tf', prompt: 'İki tek sayının toplamı çift sayıdır.', answer: true }
        ] },
      { id: 'd-mat-t2', kind: 'tema', classIds: ['3-A', '3-B'], subject: 'matematik', theme: { no: 2, title: 'Sayılar ve Nicelikler (2)' },
        title: 'Sayılar ve Nicelikler (2)', opensAt: day0(12), closesAt: day0(20), skills: ['kesir', 'saat', 'para'], questions: [] },
      { id: 'd-karma-s1', kind: 'surec', subject: 'karma', classIds: ['3-A'], teacherId: 'ogretmen', assignedBy: 'Ayşe Yılmaz', createdAt: iso(now - 4 * day),
        title: 'Karma kontrol 1', opensAt: day0(-4), closesAt: day0(3), skills: ['karsilastirma', 'basamak', 'okuma', 'saglik'],
        questions: [
          { id: 'ds1', skill: 'karsilastirma', type: 'tf', prompt: '640 sayısı 604 sayısından büyüktür.', answer: true },
          { id: 'ds2', skill: 'karsilastirma', type: 'choice', prompt: 'Hangisi en küçük?', options: [{ v: '310', label: '310' }, { v: '301', label: '301' }, { v: '130', label: '130' }], answer: '130' },
          { id: 'ds3', skill: 'okuma', type: 'choice', prompt: 'Ece sabah erken kalktı, kahvaltısını yaptı ve bisikletiyle parka gitti. Parkta arkadaşı Can\'ı gördü.  Ece parka neyle gitti?', options: [{ v: 'a', label: 'Yürüyerek' }, { v: 'b', label: 'Bisikletle' }, { v: 'c', label: 'Otobüsle' }], answer: 'b' },
          { id: 'ds4', skill: 'basamak', type: 'choice', prompt: '352 sayısında yüzler basamağındaki rakam hangisi?', options: [{ v: '3', label: '3' }, { v: '5', label: '5' }, { v: '2', label: '2' }], answer: '3' },
          { id: 'ds5', skill: 'saglik', type: 'tf', prompt: 'Dişlerimizi günde en az iki kez fırçalamalıyız.', answer: true },
          { id: 'ds6', skill: 'basamak', type: 'write', input: 'number', prompt: '700 + 20 + 9 kaçtır?', answer: '729' },
          { id: 'ds7', skill: 'okuma', type: 'tf', prompt: 'Kuşlar kışın sıcak ülkelere göç eder. Bazı kuşlar ise bulunduğu yerde kalır.  Metne göre bütün kuşlar göç eder.', answer: false },
          { id: 'ds8', skill: 'saglik', type: 'choice', prompt: 'Hangisi sağlığımızı korumak için yapılır?', options: [{ v: 'a', label: 'Yemekten önce ellerimizi yıkamak' }, { v: 'b', label: 'Gece geç saatlere kadar uyanık kalmak' }, { v: 'c', label: 'Çok şekerli yiyecekler yemek' }], answer: 'a' }
        ] },
      { id: 'd-karma-s2', kind: 'surec', subject: 'karma', classIds: ['3-A', '3-B'], teacherId: 'ogretmen', assignedBy: 'Ayşe Yılmaz', createdAt: iso(now - 0.2 * day),
        title: 'Karma kontrol 2', opensAt: day0(0), closesAt: day0(4), skills: ['ritmik', 'kelime', 'guvenlik'],
        questions: [
          { id: 'dr1', skill: 'ritmik', type: 'write', input: 'number', prompt: 'Altışar ileri say:  6, 12, 18, ☐', answer: '24' },
          { id: 'dr2', skill: 'kelime', type: 'choice', prompt: '"Büyük" kelimesinin zıt anlamlısı hangisidir?', options: [{ v: 'kucuk', label: 'küçük' }, { v: 'iri', label: 'iri' }, { v: 'genis', label: 'geniş' }], answer: 'kucuk' },
          { id: 'dr3', skill: 'guvenlik', type: 'choice', prompt: 'Karşıdan karşıya nereden geçmeliyiz?', options: [{ v: 'a', label: 'Yaya geçidinden' }, { v: 'b', label: 'Park etmiş araçların arasından' }, { v: 'c', label: 'Virajlardan' }], answer: 'a' },
          { id: 'dr4', skill: 'ritmik', type: 'choice', prompt: 'Dokuzar geri say:  90, 81, 72, ☐', options: [{ v: '62', label: '62' }, { v: '63', label: '63' }, { v: '64', label: '64' }], answer: '63' },
          { id: 'dr5', skill: 'kelime', type: 'tf', prompt: '"Okul" ile "mektep" eş anlamlı kelimelerdir.', answer: true },
          { id: 'dr6', skill: 'guvenlik', type: 'tf', prompt: 'Arabanın arka koltuğunda da emniyet kemeri takılmalıdır.', answer: true }
        ] }
    ],
    // Deniz karma süreç değerlendirmesini çözmüş: karşılaştırma, okuma ve sağlık iyi; basamak değeri tekrar edilecek.
    // Yıldız Kupası'nda bireysel üyeler (okul hesabı olmadan katılan 3. sınıflar). Gerçek kişiler değildir.
    boardMembers: [
      { id: 'b1', grade: 3, nick: 'Bulut Kız', emoji: '☁️', points: 75 },
      { id: 'b2', grade: 3, nick: 'Hızlı Tavşan', emoji: '🐰', points: 60 },
      { id: 'b3', grade: 3, nick: 'Çınar', emoji: '🌳', points: 45 },
      { id: 'b4', grade: 3, nick: 'Mavi Balina', emoji: '🐋', points: 35 },
      { id: 'b5', grade: 3, nick: 'Gezgin', emoji: '🧭', points: 25 },
      { id: 'b6', grade: 3, nick: 'Arı Maya', emoji: '🐝', points: 25 }
    ],
    // Konu Koleksiyonu: Deniz 1000'e Kadar Sayılar ve Basamak Değeri'nin dört uydusunu bitirmiş → 2 gezegen, Kampüs Seviyesi 2.
    collection: { deniz: [
      { topicId: 'p-1000e-kadar', at: iso(now - 6 * day) },
      { topicId: 'p-cozumleme', at: iso(now - 3 * day) }
    ] },
    levelUp: {},
    cup: { deniz: { '2026-11-02': { at: iso(now - 6 * day) } } },  // Yıldız Kupası katılımları: cup[öğrenci][hafta] = { at }
    // Biten haftaların sonucu. Deniz geçen hafta grubunda 3. olup Kuzey Işığı Kupası'nı kazandı.
    cupResults: { deniz: { '2026-11-02': { cup: 'kuzey-isigi', rank: 3, size: 22, group: 2, won: true, stars: 41 } } },
    rewards: [],  // 💎 KP / ⭐ Kupa Yıldızı ödül defteri
    books: {}, bookLog: [], gameLog: [],
    avatars: {},  // Avatar: { custom, cfg, owned, eq }
    examResults: { deniz: { 'd-karma-s1': { idx: 8, done: true, at: iso(now - 2 * day), answers: {
      ds1: { given: 'true', ok: true }, ds2: { given: '130', ok: true }, ds3: { given: 'b', ok: true }, ds4: { given: '5', ok: false },
      ds5: { given: 'true', ok: true }, ds6: { given: '7209', ok: false }, ds7: { given: 'false', ok: true }, ds8: { given: 'a', ok: true } } } } },
    assignments: [
      { id: 'a1', teacherId: 'ogretmen', classId: '3-B', topicId: 'k-eldeli-toplama', due: iso(now + 3 * day).slice(0, 10), createdAt: iso(now - 2 * day) },
      { id: 'a2', teacherId: 'ogretmen', classId: '1-A', topicId: 'k-e-sesi', due: iso(now + 2 * day).slice(0, 10), createdAt: iso(now - 1 * day) },
      { id: 'a3', teacherId: 'ogretmen', classId: '3-A', topicId: 'k-eldeli-toplama', title: 'Toplama alıştırması', due: iso(now + 1 * day).slice(0, 10), createdAt: iso(now - 1 * day) }
    ],
    attempts: [
      { id: 't1', studentId: 'can', topicId: 'k-eldeli-toplama', assignmentId: 'a1', completedAt: iso(now - 1 * day),
        answers: ans({ 'm-p1': { step: 'practice', wrong: 0, hints: 0, picks: [] }, 'm-p2': { step: 'practice', wrong: 0, hints: 0, picks: [] },
          'm-p3': { step: 'practice', wrong: 1, hints: 1, picks: ['53'] }, 'm-p4': { step: 'practice', wrong: 0, hints: 0, picks: [] },
          'm-c1': { step: 'check', wrong: 0, hints: 0, picks: [] }, 'm-c2': { step: 'check', wrong: 0, hints: 0, picks: [] }, 'm-c3': { step: 'check', wrong: 0, hints: 0, picks: [] } }) },
      { id: 't2', studentId: 'defne', topicId: 'k-eldeli-toplama', assignmentId: 'a1', completedAt: iso(now - 0.5 * day),
        answers: ans({ 'm-p1': { step: 'practice', wrong: 1, hints: 1, picks: ['32'] }, 'm-p2': { step: 'practice', wrong: 0, hints: 0, picks: [] },
          'm-p3': { step: 'practice', wrong: 2, hints: 2, picks: ['53', '13'] }, 'm-p4': { step: 'practice', wrong: 0, hints: 1, picks: [] },
          'm-c1': { step: 'check', wrong: 0, hints: 0, picks: [] }, 'm-c2': { step: 'check', wrong: 1, hints: 1, picks: ['263'] }, 'm-c3': { step: 'check', wrong: 1, hints: 1, picks: ['163'] } }) },
      { id: 't3', studentId: 'mert', topicId: 'k-e-sesi', assignmentId: 'a2', completedAt: iso(now - 0.3 * day),
        answers: ans({ 'e-p1': { step: 'practice', wrong: 0, hints: 0, picks: [] }, 'e-p2': { step: 'practice', wrong: 1, hints: 1, picks: ['a'] }, 'e-p3': { step: 'practice', wrong: 1, hints: 0, picks: ['balik'] },
          'e-c1': { step: 'check', wrong: 0, hints: 0, picks: [] }, 'e-c2': { step: 'check', wrong: 1, hints: 1, picks: ['E'] }, 'e-c3': { step: 'check', wrong: 0, hints: 0, picks: [] } }) },
      { id: 't5', studentId: 'deniz', topicId: 'k-toplam-tahmin', assignmentId: null, completedAt: iso(now - 0.05 * day),
        answers: ans({ 't-p1': { step: 'practice', wrong: 0, hints: 0, picks: [] }, 't-p2': { step: 'practice', wrong: 0, hints: 0, picks: [] }, 't-p3': { step: 'practice', wrong: 0, hints: 0, picks: [] },
          't-c1': { step: 'check', wrong: 0, hints: 0, picks: [] }, 't-c2': { step: 'check', wrong: 0, hints: 0, picks: [] }, 't-c3': { step: 'check', wrong: 0, hints: 0, picks: [] } }) },
      { id: 't4', studentId: 'zeynep', topicId: 'k-toplam-tahmin', assignmentId: null, completedAt: iso(now - 4 * day),
        answers: ans({ 't-p1': { step: 'practice', wrong: 0, hints: 0, picks: [] }, 't-p2': { step: 'practice', wrong: 0, hints: 0, picks: [] }, 't-p3': { step: 'practice', wrong: 1, hints: 1, picks: ['90'] },
          't-c1': { step: 'check', wrong: 0, hints: 0, picks: [] }, 't-c2': { step: 'check', wrong: 0, hints: 0, picks: [] }, 't-c3': { step: 'check', wrong: 1, hints: 0, picks: ['80'] } }) }
    ],
    // Deniz, karşılaştırma konusunun anlatımını bitirmiş; alıştırmaları yarım bırakmış (Devam et örneği)
    stops: { deniz: { 'p-1000e-kadar': ['anlatim', 'alistirma', 'minitest', 'ozet'], 'p-cozumleme': ['anlatim', 'alistirma', 'minitest', 'ozet'], 'k-dogal-karsilastirma': ['anlatim'] } },
    stopAnswers: {},
    stopLog: [{ sid: 'deniz', topicId: 'k-dogal-karsilastirma', stopId: 'anlatim', at: iso(now - 0.2 * day) }],
    minitest: {},
    inprogress: { deniz: { topicId: 'k-dogal-karsilastirma', stopId: 'alistirma', at: iso(now - 0.1 * day) } },
    prefs: { sound: true, voice: true, navCollapsed: false }
  };
}

// ---- 1. sınıf Sesler haritası ----
// ⚠️ Ses grubu sırası MEB güncel ilk okuma-yazma programıyla doğrulanacak.
export const SOUND_GROUPS: any = [
  { title: '1. Grup', sounds: [
    { l: 'e', word: 'elma', emoji: '🍎', topic: 'k-e-sesi' }, { l: 'l', word: 'limon', emoji: '🍋', topic: 'k-l-sesi' },
    { l: 'a', word: 'arı', emoji: '🐝' }, { l: 'k', word: 'kedi', emoji: '🐱' }, { l: 'i', word: 'inek', emoji: '🐄' }, { l: 'n', word: 'nane', emoji: '🌿' } ] },
  { title: '2. Grup', sounds: [
    { l: 'o', word: 'okul', emoji: '🏫' }, { l: 'm', word: 'muz', emoji: '🍌' }, { l: 'u', word: 'uçak', emoji: '✈️' },
    { l: 't', word: 'top', emoji: '⚽' }, { l: 'ü', word: 'üzüm', emoji: '🍇' }, { l: 'y', word: 'yıldız', emoji: '⭐' } ] },
  { title: '3. Grup', sounds: [
    { l: 'ö', word: 'ördek', emoji: '🦆' }, { l: 'r', word: 'roket', emoji: '🚀' }, { l: 'ı', word: 'ıhlamur', emoji: '🍵' },
    { l: 'd', word: 'deniz', emoji: '🌊' }, { l: 's', word: 'saat', emoji: '⏰' }, { l: 'b', word: 'balık', emoji: '🐟' } ] }
];
