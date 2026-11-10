/* eslint-disable */
// @ts-nocheck — ilkokul-platformu prototipinden (js/content-mat3-tema1.js) olduğu gibi taşındı.
// Mantık bilerek değiştirilmedi; tipler dışa açılan adlarda gevşek (any) tutuldu.
import {
  TOPICS
} from './data';

// 3. sınıf Matematik · 1. Tema: Sayılar ve Nicelikler (1) — örnek olarak hazırlanan tam tema.
// Kaynak: MEB TYMM, https://tymm.meb.gov.tr/ilkokul-matematik-dersi/unite/249 (MAT.3.1.1 – MAT.3.1.8)
// "Doğal Sayıları Karşılaştırma" (MAT.3.1.3) data.js içinde; buradaki konular TOPICS'e eklenir.
// Her konu: lesson (video metni / senaryosu), exercises (6 alıştırma, ipuçlarıyla), testPool (Mini Test havuzu), summary.

(() => {
  const o = (...xs) => xs.map(x => ({ v: String(x), label: String(x) }));
  const ch = (id, prompt, options, answer, extra = {}) => ({ id, type: 'choice', prompt, options: Array.isArray(options[0]) ? options.map(([v, label]) => ({ v, label })) : o(...options), answer: String(answer), ...extra });
  const tf = (id, prompt, answer, hints) => ({ id, type: 'tf', prompt, answer, hints });
  const wr = (id, prompt, answer, hints, input = 'number') => ({ id, type: 'write', input, prompt, answer: String(answer), hints });
  const mt = (id, prompt, pairs, hints) => ({ id, type: 'match', prompt, pairs, hints });
  const sk = (skill, list) => list.map(q => ({ ...q, skill }));
  const lesson = texts => texts.map(text => ({ text }));
  const base = (title, code, learned, homeTip) => ({ course: '3-matematik', title, code, learned, homeTip });

  Object.assign(TOPICS, {
    // ---- MAT.3.1.1 ----
    'p-1000e-kadar': {
      ...base('1000\'e Kadar Sayılar', 'MAT.3.1.1', '1000\'e kadar olan sayıları okumayı ve yazmayı öğrendin',
        'Evdeki kitapların sayfa numaralarından birkaçını birlikte sesli okuyun: "üç yüz altmış beş" gibi.'),
      lesson: lesson([
        'Lumo\'nun okulunda 365 öğrenci var. Bu sayıyı 3 yüzlük, 6 onluk ve 5 birlik blokla gösterebiliriz.',
        '365 sayısını "üç yüz altmış beş" diye okuruz. Önce yüzleri, sonra onları, en son birleri söyleriz.',
        'Sayı yazarken boş kalan basamağa 0 koyarız: dört yüz yedi = 407.',
        '10 tane yüzlük bir araya gelince 1000 olur. 1000 "bin" diye okunur.'
      ]),
      exercises: sk('Sayıları okuma ve yazma', [
        tf('k1-a1', '"Altı yüz on iki" sayısı 612 diye yazılır.', true, ['Önce yüzler: altı yüz → 6. Sonra on → 1 onluk, iki → 2 birlik.', '6 yüzlük, 1 onluk, 2 birlik: 612. Cümle doğru.']),
        mt('k1-a2', 'Sayıları okunuşlarıyla eşleştir.', [['508', 'beş yüz sekiz'], ['580', 'beş yüz seksen'], ['850', 'sekiz yüz elli']], ['Önce yüzler basamağına bak: 5 mi, 8 mi?', '508\'de onlar basamağı 0, yani okunuşunda "seksen" yok.']),
        wr('k1-a3', 'Dört yüz yedi sayısını rakamla yaz.', 407, ['Yüzler: dört → 4. Onlar basamağında hiç onluk yok.', 'Boş kalan basamağa 0 yazarız: 407.']),
        tf('k1-a4', '3 yüzlük, 2 onluk ve 9 birlik 329 sayısını gösterir.', true, ['Yüzlükler 3, onluklar 2, birlikler 9.', 'Sırayla yaz: 3, 2, 9 → 329. Cümle doğru.']),
        mt('k1-a5', 'Blokları sayılarla eşleştir.', [['2 yüzlük 4 onluk', '240'], ['2 yüzlük 4 birlik', '204'], ['4 yüzlük 2 onluk', '420']], ['Hangi basamakta kaç tane var, ona bak.', '2 yüzlük 4 birlikte hiç onluk yok: onlar basamağına 0 yazılır → 204.']),
        wr('k1-a6', 'Okunuşu "bin" olan sayıyı rakamla yaz.', 1000, ['10 tane yüzlük bir araya gelince kaç olur?', 'Bin; 1 ve üç tane 0 ile yazılır: 1000.'])
      ]),
      testPool: sk('Sayıları okuma ve yazma', [
        ch('k1-t1', 'Yedi yüz otuz sayısı hangisidir?', [703, 730, 7030], 730),
        ch('k1-t2', '6 yüzlük, 0 onluk ve 8 birlik hangi sayıdır?', [68, 608, 680], 608),
        tf('k1-t3', '915 sayısı "dokuz yüz on beş" diye okunur.', true),
        wr('k1-t4', 'Üç yüz elli bir sayısını rakamla yaz.', 351),
        ch('k1-t5', '480 sayısının okunuşu hangisidir?', [['a', 'dört yüz sekiz'], ['b', 'dört yüz seksen'], ['c', 'sekiz yüz kırk']], 'b'),
        tf('k1-t6', '10 tane yüzlük 100 eder.', false),
        wr('k1-t7', '2 yüzlük, 7 onluk ve 3 birlikten oluşan sayıyı yaz.', 273),
        ch('k1-t8', 'Bir kutuda 1 yüzlük ve 5 onluk kalem var. Kutuda kaç kalem var?', [105, 150, 15], 150),
        tf('k1-t9', '806 sayısında hiç onluk yoktur.', true),
        wr('k1-t10', 'Sekiz yüz sayısını rakamla yaz.', 800)
      ]),
      summary: {
        idea: 'Üç basamaklı sayılar yüzlük, onluk ve birliklerden oluşur. Okurken ve yazarken yüzlerden başlarız.',
        points: ['365: üç yüz altmış beş → 3 yüzlük, 6 onluk, 5 birlik', 'Boş kalan basamağa 0 yazılır: dört yüz yedi = 407', '10 yüzlük = 1000 (bin)'],
        example: { title: 'Dört yüz yirmi', lines: ['4 yüzlük → 400', '2 onluk → 20', '0 birlik → 420'] }
      }
    },

    // ---- MAT.3.1.2 ----
    'p-cozumleme': {
      ...base('Basamak ve Basamak Değeri', 'MAT.3.1.2', 'Üç basamaklı sayıları basamaklarına ayırmayı öğrendin',
        'Bir fiyat etiketindeki sayıyı birlikte yüzlük, onluk ve birlik olarak söyleyin: 256 = 200 + 50 + 6.'),
      lesson: lesson([
        '256 sayısını basamaklarına ayıralım: 2 yüzler, 5 onlar, 6 birler basamağında.',
        'Basamak değeri, rakamın bulunduğu yere göre değeridir: 256\'da 2\'nin basamak değeri 200, 5\'in 50, 6\'nın 6.',
        '256 = 200 + 50 + 6. Bunu 100 + 100 + 50 + 6 diye de yazabiliriz.',
        'Aynı rakam farklı basamakta farklı değer alır: 333\'te en soldaki 3, 300 değerindedir.'
      ]),
      exercises: sk('Basamak değeri', [
        tf('k2-a1', '472 sayısında 7 rakamının basamak değeri 70\'tir.', true, ['7 hangi basamakta? Yüzler mi, onlar mı?', '7 onlar basamağında: 7 onluk = 70. Cümle doğru.']),
        mt('k2-a2', '836 sayısındaki rakamları basamak değerleriyle eşleştir.', [['8', '800'], ['3', '30'], ['6', '6']], ['En soldaki rakam yüzler basamağındadır.', '8 yüzler → 800, 3 onlar → 30, 6 birler → 6.']),
        wr('k2-a3', '600 + 40 + 9 kaçtır?', 649, ['6 yüzlük, 4 onluk, 9 birlik var.', 'Sırayla yaz: 649.']),
        tf('k2-a4', '509 sayısında onlar basamağındaki rakam 5\'tir.', false, ['509\'u sağdan say: birler, onlar, yüzler.', 'Onlar basamağında 0 var. 5 yüzler basamağında. Cümle yanlış.']),
        mt('k2-a5', 'Sayıları çözümlenmiş hâlleriyle eşleştir.', [['318', '300 + 10 + 8'], ['381', '300 + 80 + 1'], ['813', '800 + 10 + 3']], ['Önce yüzler basamağına bak: 3 mü, 8 mi?', '318 ile 381\'de yüzlük aynı; onlar basamağına bak: 1 ve 8.']),
        wr('k2-a6', '745 sayısında yüzler basamağındaki rakamın basamak değeri kaçtır?', 700, ['Yüzler basamağındaki rakam 7.', '7 yüzlük = 700.'])
      ]),
      testPool: sk('Basamak değeri', [
        ch('k2-t1', '927 sayısında 2 rakamının basamak değeri kaçtır?', [2, 20, 200], 20),
        ch('k2-t2', '400 + 5 hangi sayıdır?', [45, 405, 450], 405),
        tf('k2-t3', '681 = 600 + 80 + 1', true),
        wr('k2-t4', '163 sayısının birler basamağındaki rakamı yaz.', 3),
        ch('k2-t5', 'Hangi sayıda 4 rakamının basamak değeri 400\'dür?', [145, 514, 451], 451),
        tf('k2-t6', '256 sayısı 100 + 100 + 50 + 6 olarak da yazılabilir.', true),
        wr('k2-t7', '5 yüzlük ve 12 birlik kaçtır?', 512),
        ch('k2-t8', '777 sayısında basamak değeri en büyük olan 7 hangi basamaktadır?', [['b', 'Birler'], ['o', 'Onlar'], ['y', 'Yüzler']], 'y'),
        tf('k2-t9', '390 sayısında 9 rakamının basamak değeri 9\'dur.', false),
        wr('k2-t10', '300 + 70 kaçtır?', 370)
      ]),
      summary: {
        idea: 'Bir rakamın değeri bulunduğu basamağa göre değişir. Sayıyı yüzlük, onluk ve birliklerine ayırarak çözümleriz.',
        points: ['256 → 2 yüzlük, 5 onluk, 6 birlik', 'Basamak değerleri: 200, 50 ve 6', '256 = 200 + 50 + 6'],
        example: { title: '472', lines: ['4 → yüzler basamağı → 400', '7 → onlar basamağı → 70', '2 → birler basamağı → 2'] }
      }
    },

    // ---- MAT.3.1.3 (b, c, ç) ----
    'p-yuvarlama': {
      ...base('En Yakın Onluk ve Yüzlük', 'MAT.3.1.3', 'Sayıları en yakın onluğa ve yüzlüğe yuvarlamayı öğrendin',
        'Alışverişte fiyatları en yakın onluğa yuvarlayarak toplamı birlikte tahmin edin: 47 TL ≈ 50 TL.'),
      lesson: lesson([
        '47 sayısı sayı doğrusunda 40 ile 50 arasındadır. Hangisine daha yakın?',
        '47, 50\'ye 3 adım, 40\'a 7 adım uzaklıkta. En yakın onluğu 50\'dir.',
        'Birler basamağı 5 ya da daha büyükse yukarı, 5\'ten küçükse aşağı yuvarlarız: 45 → 50, 43 → 40.',
        'En yakın yüzlüğe yuvarlarken onlar basamağına bakarız: 362\'de onlar 6, en yakın yüzlüğü 400. 328\'in ise 300.'
      ]),
      exercises: sk('Yuvarlama', [
        tf('k3-a1', '73 sayısının en yakın onluğu 70\'tir.', true, ['73 hangi iki onluk arasında? 70 ile 80.', 'Birler basamağı 3, 5\'ten küçük: aşağı yuvarlanır → 70.']),
        mt('k3-a2', 'Sayıları en yakın onluklarıyla eşleştir.', [['46', '50'], ['84', '80'], ['25', '30']], ['Birler basamağına bak: 5 ve üzeri mi?', '46 → 50, 84 → 80, 25 → 30 (5 yukarı yuvarlanır).']),
        wr('k3-a3', 'En yakın onluğa yuvarla: 138', 140, ['138, 130 ile 140 arasında.', 'Birler 8, 5\'ten büyük: 140.']),
        tf('k3-a4', '450 sayısının en yakın yüzlüğü 400\'dür.', false, ['En yakın yüzlük için onlar basamağına bak.', 'Onlar 5: yukarı yuvarlanır → 500. Cümle yanlış.']),
        mt('k3-a5', 'Sayıları en yakın yüzlükleriyle eşleştir.', [['149', '100'], ['251', '300'], ['682', '700']], ['Onlar basamağına bak: 5 ve üzeri ise yukarı.', '149\'da onlar 4 → 100; 251\'de onlar 5 → 300; 682\'de onlar 8 → 700.']),
        wr('k3-a6', 'En yakın yüzlüğe yuvarla: 815', 800, ['815, 800 ile 900 arasında.', 'Onlar basamağı 1, 5\'ten küçük: 800.'])
      ]),
      testPool: sk('Yuvarlama', [
        ch('k3-t1', '67 sayısının en yakın onluğu hangisidir?', [60, 70, 100], 70),
        ch('k3-t2', '342 sayısının en yakın yüzlüğü hangisidir?', [300, 340, 400], 300),
        tf('k3-t3', '95 sayısının en yakın onluğu 100\'dür.', true),
        wr('k3-t4', 'En yakın onluğa yuvarla: 254', 250),
        ch('k3-t5', 'En yakın onluğu 40 olan sayı hangisidir?', [34, 36, 45], 36),
        tf('k3-t6', '709 sayısının en yakın yüzlüğü 800\'dür.', false),
        wr('k3-t7', 'En yakın yüzlüğe yuvarla: 550', 600),
        ch('k3-t8', '188 sayısı hangi iki onluk arasındadır?', [['a', '170 ile 180'], ['b', '180 ile 190'], ['c', '100 ile 200']], 'b'),
        tf('k3-t9', '12 sayısının en yakın onluğu 10\'dur.', true),
        wr('k3-t10', 'En yakın yüzlüğe yuvarla: 961', 1000)
      ]),
      summary: {
        idea: 'En yakın onluğa yuvarlarken birlere, en yakın yüzlüğe yuvarlarken onlara bakarız. 5 ve üzeri ise yukarı, 5\'ten küçükse aşağı yuvarlarız.',
        points: ['47 → 50 (birler 7)', '43 → 40 (birler 3)', '362 → 400, 328 → 300'],
        example: { title: '138', lines: ['En yakın onluk: birler 8 → 140', 'En yakın yüzlük: onlar 3 → 100'] }
      }
    },

    // ---- MAT.3.1.4 ----
    'p-ritmik': {
      ...base('Ritmik Sayma', 'MAT.3.1.4', 'İleriye ve geriye doğru ritmik saymayı öğrendin',
        'Merdiven çıkarken ya da yürürken birlikte altışar, yedişer sayın; sonra aynı sayıdan geriye sayın.'),
      lesson: lesson([
        'Bir kutuda 6 yumurta var. Kutuları sayarken altışar sayarız: 6, 12, 18, 24…',
        'Her adımda aynı sayı kadar artırırsak ileriye doğru ritmik saymış oluruz.',
        'Geriye sayarken her adımda aynı sayı kadar azaltırız: 90, 81, 72, 63 → dokuzar geriye.',
        'Onar ve yüzer de sayabiliriz: 230, 240, 250… ve 100, 200, 300…'
      ]),
      exercises: sk('Ritmik sayma', [
        tf('k4-a1', '7, 14, 21, 28 dizisinde yedişer ileri sayılmıştır.', true, ['Ardışık sayıların farkına bak: 14 − 7 kaç?', 'Her adımda 7 artıyor. Cümle doğru.']),
        mt('k4-a2', 'Dizileri sayma kurallarıyla eşleştir.', [['8, 16, 24', 'Sekizer ileri'], ['60, 54, 48', 'Altışar geri'], ['300, 400, 500', 'Yüzer ileri']], ['Sayılar artıyor mu, azalıyor mu?', '60, 54, 48 azalıyor: her adımda 6 eksiliyor.']),
        wr('k4-a3', 'Dokuzar ileri say: 9, 18, 27, ☐', 36, ['Her adımda 9 ekle.', '27 + 9 = 36.']),
        tf('k4-a4', '80, 72, 64, 56 dizisinde sekizer geriye sayılmıştır.', true, ['80 − 72 kaç?', 'Her adımda 8 azalıyor. Cümle doğru.']),
        mt('k4-a5', 'Eksik sayıları eşleştir.', [['6, 12, ☐, 24', '18'], ['70, 63, ☐, 49', '56'], ['540, 550, ☐', '560']], ['Önce her dizinin kuralını bul.', '6\'şar ileri → 18; 7\'şer geri → 56; 10\'ar ileri → 560.']),
        wr('k4-a6', 'Yedişer geri say: 70, 63, 56, ☐', 49, ['Her adımda 7 çıkar.', '56 − 7 = 49.'])
      ]),
      testPool: sk('Ritmik sayma', [
        ch('k4-t1', '6, 12, 18, ☐  Sıradaki sayı hangisi?', [22, 24, 26], 24),
        ch('k4-t2', 'Onar ileri say: 470, 480, ☐', [481, 490, 580], 490),
        tf('k4-t3', '45, 54, 63, 72 dizisinde dokuzar ileri sayılmıştır.', true),
        wr('k4-t4', 'Sekizer ileri say: 32, 40, ☐', 48),
        ch('k4-t5', 'Yüzer geri say: 900, 800, ☐', [790, 700, 600], 700),
        tf('k4-t6', '28, 35, 42 dizisinde altışar ileri sayılmıştır.', false),
        wr('k4-t7', 'Altışar geri say: 60, 54, 48, ☐', 42),
        ch('k4-t8', 'Hangisi yedişer ileri sayma dizisidir?', [['a', '7, 14, 21'], ['b', '7, 17, 27'], ['c', '7, 12, 17']], 'a'),
        tf('k4-t9', '81, 72, 63 dizisinde dokuzar geri sayılmıştır.', true),
        wr('k4-t10', 'Sekizer ileri say: 64, 72, 80, ☐', 88)
      ]),
      summary: {
        idea: 'Ritmik saymada her adımda aynı sayı kadar artırır ya da azaltırız.',
        points: ['Altışar ileri: 6, 12, 18, 24', 'Dokuzar geri: 90, 81, 72, 63', 'Onar ve yüzer: 230, 240, 250 · 100, 200, 300'],
        example: { title: 'Yedişer ileri', lines: ['7 → 14 → 21 → 28', 'Her adımda +7'] }
      }
    },

    // ---- MAT.3.1.5 ----
    'p-tek-cift': {
      ...base('Tek ve Çift Sayılar', 'MAT.3.1.5', 'Sayıları tek ve çift olarak ayırmayı öğrendin',
        'Evdeki çorap, kaşık gibi eşyaları ikişer eşleyin: artan kalıyorsa sayı tek, kalmıyorsa çifttir.'),
      lesson: lesson([
        '8 elmayı iki arkadaş eşit paylaşabilir: 4 + 4. Artan yoksa sayı çifttir.',
        '7 elmayı paylaşırsak 1 elma artar. Artan varsa sayı tektir.',
        'Birler basamağı 0, 2, 4, 6 ya da 8 olan sayılar çifttir. 1, 3, 5, 7 ya da 9 olanlar tektir.',
        '0 da bir çift sayıdır. 346 çift, 573 tektir: yalnızca birler basamağına bakarız.'
      ]),
      exercises: sk('Tek ve çift sayılar', [
        tf('k5-a1', '14 bir çift sayıdır.', true, ['14\'ü iki eşit parçaya ayırabilir misin?', '14 = 7 + 7, artan yok. Cümle doğru.']),
        mt('k5-a2', 'Sayıları açıklamalarıyla eşleştir.', [['48', 'Çift, birler basamağı 8'], ['71', 'Tek, birler basamağı 1'], ['90', 'Çift, birler basamağı 0']], ['Her sayının birler basamağına bak.', '71\'in birler basamağı 1: tek sayı.']),
        wr('k5-a3', '25 ile 30 arasındaki çift sayılardan en büyüğünü yaz.', 28, ['25 ile 30 arasındaki sayılar: 26, 27, 28, 29.', 'Çift olanlar 26 ve 28. En büyüğü 28.']),
        tf('k5-a4', '0 bir tek sayıdır.', false, ['0\'ın birler basamağına bak.', '0 bir çift sayıdır. Cümle yanlış.']),
        mt('k5-a5', 'Bilyeleri iki kişiye paylaştır, sonucu eşleştir.', [['10 bilye', '5 + 5, çift'], ['13 bilye', '6 + 6, 1 artar, tek'], ['16 bilye', '8 + 8, çift']], ['İkiye eşit bölünebiliyor mu?', '13 bilye paylaşılınca 1 bilye artar.']),
        wr('k5-a6', '457 sayısından hemen sonra gelen çift sayıyı yaz.', 458, ['457\'nin birler basamağı 7: tek.', 'Bir sonraki sayı 458 ve birler basamağı 8: çift.'])
      ]),
      testPool: sk('Tek ve çift sayılar', [
        ch('k5-t1', 'Hangisi çift sayıdır?', [133, 245, 388], 388),
        ch('k5-t2', 'Hangisi tek sayıdır?', [506, 617, 720], 617),
        tf('k5-t3', '1000 bir çift sayıdır.', true),
        wr('k5-t4', '20 ile 25 arasındaki tek sayılardan en küçüğünü yaz.', 21),
        tf('k5-t5', 'Birler basamağı 5 olan sayılar çifttir.', false),
        ch('k5-t6', '17 kalem iki arkadaşa eşit paylaştırılırsa ne olur?', [['a', 'Artan olmaz'], ['b', '1 kalem artar'], ['c', '2 kalem artar']], 'b'),
        wr('k5-t7', '600 ile 610 arasında kaç tane tek sayı vardır?', 5),
        ch('k5-t8', '0\'dan başlayarak ikişer ileri sayarsak hangi sayılara ulaşırız?', [['a', 'Tek sayılara'], ['b', 'Çift sayılara'], ['c', 'Her ikisine']], 'b'),
        tf('k5-t9', '845 bir tek sayıdır.', true),
        wr('k5-t10', '90 ile 100 arasındaki en büyük tek sayıyı yaz.', 99)
      ]),
      summary: {
        idea: 'Eşit paylaşılabilen, artanı olmayan sayılar çifttir. Paylaşınca 1 artan sayılar tektir.',
        points: ['Çift: birler basamağı 0, 2, 4, 6, 8', 'Tek: birler basamağı 1, 3, 5, 7, 9', '0 bir çift sayıdır'],
        example: { title: '346 ve 573', lines: ['346 → birler 6 → çift', '573 → birler 3 → tek'] }
      }
    },

    // ---- MAT.3.1.6 ----
    'p-tek-cift-toplam': {
      ...base('Tek ve Çift Sayıların Toplamı', 'MAT.3.1.6', 'Tek ve çift sayıların toplamının tek mi çift mi olacağını bulmayı öğrendin',
        'Yemekte tabağa konan iki grup çatalı sayın: iki grup da tekse toplamın çift çıktığını birlikte görün.'),
      lesson: lesson([
        '4 + 6 = 10. Çift ile çiftin toplamı çift oldu.',
        '3 + 5 = 8. İki tek sayının artan birer tanesi birleşip bir çift oluşturur: tek + tek = çift.',
        '4 + 3 = 7. Çift ile tekin toplamı tektir; artan 1 tek başına kalır.',
        'Genelleme: çift + çift = çift, tek + tek = çift, tek + çift = tek.'
      ]),
      exercises: sk('Tek ve çift sayıların toplamı', [
        tf('k6-a1', '7 + 9 toplamı çift sayıdır.', true, ['7 ve 9 tek mi, çift mi?', 'Tek + tek = çift. 7 + 9 = 16. Cümle doğru.']),
        mt('k6-a2', 'Toplamları sonuçlarıyla eşleştir.', [['6 + 8', '14, çift'], ['5 + 8', '13, tek'], ['5 + 7', '12, çift']], ['Önce toplamı bul.', '5 + 8 = 13: tek ile çiftin toplamı tektir.']),
        wr('k6-a3', 'Topla: 9 + 6 = ☐', 15, ['9 tek, 6 çift: sonuç tek olmalı.', '9 + 6 = 15.']),
        tf('k6-a4', 'Bir tek ve bir çift sayının toplamı çifttir.', false, ['4 + 3\'ü düşün.', '4 + 3 = 7, tek. Cümle yanlış.']),
        mt('k6-a5', 'Toplama kurallarını eşleştir.', [['Çift + çift', 'Sonuç her zaman çift'], ['Tek + çift', 'Sonuç her zaman tek'], ['Tek + tek', 'İki artan birleşir, sonuç çift']], ['Her kural için küçük bir örnek dene: 2 + 4, 3 + 4, 3 + 5.', 'Tek + çift tek, diğer ikisi çift çıkar.']),
        wr('k6-a6', '11 ile hangi sayıyı toplarsak 20 eder?', 9, ['20\'den 11 çıkar.', '20 − 11 = 9. 11 ve 9 tek, toplamları çift: 20.'])
      ]),
      testPool: sk('Tek ve çift sayıların toplamı', [
        ch('k6-t1', '8 + 5 toplamı nasıl bir sayıdır?', [['tek', 'Tek'], ['cift', 'Çift']], 'tek'),
        ch('k6-t2', '13 + 7 toplamı nasıl bir sayıdır?', [['tek', 'Tek'], ['cift', 'Çift']], 'cift'),
        tf('k6-t3', '12 + 14 toplamı çift sayıdır.', true),
        wr('k6-t4', 'Topla: 6 + 7 = ☐', 13),
        tf('k6-t5', 'İki tek sayının toplamı tek sayıdır.', false),
        ch('k6-t6', 'Hangi toplam tektir?', [['a', '3 + 5'], ['b', '4 + 6'], ['c', '4 + 5']], 'c'),
        ch('k6-t7', 'Hangi toplam çifttir?', [['a', '9 + 9'], ['b', '2 + 7'], ['c', '6 + 1']], 'a'),
        tf('k6-t8', '15 + 4 toplamı tek sayıdır.', true),
        wr('k6-t9', 'Ali 8, Ece 9 bilye topladı. İkisi toplam kaç bilye topladı?', 17),
        ch('k6-t10', 'Tek ile çift sayının toplamı için hangisi doğrudur?', [['a', 'Her zaman tek'], ['b', 'Her zaman çift'], ['c', 'Bazen tek, bazen çift']], 'a')
      ]),
      summary: {
        idea: 'Toplanan sayıların tek ya da çift olması, toplamın tek mi çift mi olacağını gösterir.',
        points: ['Çift + çift = çift: 4 + 6 = 10', 'Tek + tek = çift: 3 + 5 = 8', 'Tek + çift = tek: 4 + 3 = 7'],
        example: { title: '7 + 9', lines: ['İki tek sayı', 'Artan 1\'ler birleşir', '7 + 9 = 16 → çift'] }
      }
    },

    // ---- MAT.3.1.7 ----
    'p-oruntu': {
      ...base('Şekil Örüntüleri', 'MAT.3.1.7', 'Sayı ve şekil örüntülerinin kuralını bulup sürdürmeyi öğrendin',
        'Boncuk ya da legolarla birlikte bir örüntü dizin, çocuğunuz kuralı bulup bir sonraki adımı eklesin.'),
      lesson: lesson([
        'Örüntü, belli bir kurala göre devam eden dizidir: 🔺🔵🔺🔵…',
        'Sayı örüntüsünde kuralı bulmak için ardışık sayılara bakarız: 3, 6, 9, 12 → her adımda 3 artıyor.',
        'Şekiller de sayıya dönüşebilir: 1 kare, 3 kare, 5 kare… her adımda 2 kare ekleniyor.',
        'Kuralı bulunca örüntüyü sürdürebiliriz: 3, 6, 9, 12, 15, 18.'
      ]),
      exercises: sk('Örüntüler', [
        tf('k7-a1', '2, 4, 6, 8 örüntüsünün kuralı "her adımda 2 artır"dır.', true, ['Ardışık sayıların farkına bak.', 'Her adımda 2 artıyor. Cümle doğru.']),
        mt('k7-a2', 'Örüntüleri kurallarıyla eşleştir.', [['5, 10, 15, 20', 'Her adımda 5 artıyor'], ['30, 27, 24, 21', 'Her adımda 3 azalıyor'], ['🔺🔵🔺🔵', 'Şekiller sırayla tekrar ediyor']], ['Sayılar artıyor mu, azalıyor mu, yoksa tekrar mı ediyor?', '30, 27, 24: her adımda 3 eksiliyor.']),
        wr('k7-a3', 'Örüntüyü sürdür: 4, 8, 12, 16, ☐', 20, ['Kural: her adımda kaç artıyor?', '16 + 4 = 20.']),
        tf('k7-a4', '1, 3, 5, 7 örüntüsünün 5. adımı 8\'dir.', false, ['Her adımda 2 artıyor.', '7 + 2 = 9. Cümle yanlış.']),
        mt('k7-a5', 'Örüntülerdeki eksik adımları eşleştir.', [['10, 20, ☐, 40', '30'], ['50, 45, ☐, 35', '40'], ['1, 4, 7, ☐', '10']], ['Önce her örüntünün kuralını bul.', '10\'ar ileri → 30; 5\'er geri → 40; 3\'er ileri → 10.']),
        wr('k7-a6', '1. adımda 1 kare, 2. adımda 3 kare, 3. adımda 5 kare var. 4. adımda kaç kare olur?', 7, ['Her adımda kaç kare ekleniyor?', 'Her adımda 2 kare: 5 + 2 = 7.'])
      ]),
      testPool: sk('Örüntüler', [
        ch('k7-t1', 'Örüntüyü sürdür: 7, 14, 21, ☐', [27, 28, 29], 28),
        ch('k7-t2', '⭐⭐🌙 ⭐⭐🌙 ⭐⭐☐  Kutuya ne gelir?', [['y', '⭐'], ['a', '🌙'], ['g', '☀️']], 'a'),
        tf('k7-t3', '40, 36, 32, 28 örüntüsünde her adımda 4 azalıyor.', true),
        wr('k7-t4', 'Örüntüyü sürdür: 100, 90, 80, ☐', 70),
        ch('k7-t5', '3, 8, 13, 18 örüntüsünün kuralı nedir?', [['a', 'Her adımda 3 artıyor'], ['b', 'Her adımda 5 artıyor'], ['c', 'Her adımda 8 artıyor']], 'b'),
        tf('k7-t6', '2, 4, 8, 10 bir "her adımda 2 artır" örüntüsüdür.', false),
        wr('k7-t7', '1. adımda 2, 2. adımda 4, 3. adımda 6 çubuk var. 5. adımda kaç çubuk olur?', 10),
        ch('k7-t8', 'Hangisi "her adımda 6 artır" örüntüsüdür?', [['a', '6, 12, 18'], ['b', '6, 10, 14'], ['c', '6, 16, 26']], 'a'),
        tf('k7-t9', '9, 9, 9, 9 örüntüsünde sayılar tekrar ediyor.', true),
        wr('k7-t10', 'Örüntüyü sürdür: 55, 50, 45, ☐', 40)
      ]),
      summary: {
        idea: 'Bir örüntüyü sürdürmek için önce kuralını buluruz: artıyor mu, azalıyor mu, tekrar mı ediyor?',
        points: ['Artan: 3, 6, 9, 12 → her adımda +3', 'Azalan: 30, 27, 24 → her adımda −3', 'Tekrar eden: 🔺🔵🔺🔵'],
        example: { title: 'Kare örüntüsü', lines: ['1 → 3 → 5 → 7 kare', 'Kural: her adımda 2 kare eklenir'] }
      }
    },

    // ---- MAT.3.1.8 ----
    'p-nesne-tahmin': {
      ...base('Nesne Sayısını Tahmin Etme', 'MAT.3.1.8', 'Bir çokluğun parçasına bakarak 100\'e kadar nesne sayısını tahmin etmeyi öğrendin',
        'Bir kavanozdaki makarna ya da fasulyelerin sayısını önce tahmin edin, sonra birlikte sayıp karşılaştırın.'),
      lesson: lesson([
        'Kavanozda kaç şeker var? Saymadan önce tahmin edelim.',
        'Önce bir parçayı sayarız: kavanozun dörtte birinde 10 şeker var. Bütün kavanozda yaklaşık 40 şeker olur.',
        'Sonra sayarak kontrol ederiz: 38 şeker. Tahminimiz 40, sonuca çok yakın!',
        'Tahmin, rastgele bir sayı söylemek değildir; parça ile bütün arasındaki ilişkiye bakarak düşünürüz.'
      ]),
      exercises: sk('Nesne sayısını tahmin etme', [
        tf('k8-a1', 'Tahmin ederken hiç düşünmeden bir sayı söyleriz.', false, ['Tahmin ederken neye bakıyorduk?', 'Bir parçayı sayıp bütünü düşünürüz. Cümle yanlış.']),
        mt('k8-a2', 'Parçadaki boncuk sayısını, bütün için tahminle eşleştir.', [['Yarısında 25 boncuk', 'Bütününde yaklaşık 50'], ['Dörtte birinde 10 boncuk', 'Bütününde yaklaşık 40'], ['Yarısında 40 boncuk', 'Bütününde yaklaşık 80']], ['Yarısı ise iki katını, dörtte biri ise dört katını düşün.', '25 + 25 = 50; 10 + 10 + 10 + 10 = 40; 40 + 40 = 80.']),
        wr('k8-a3', 'Bir tabağın yarısında 15 kurabiye var. Bütün tabakta yaklaşık kaç kurabiye vardır?', 30, ['Tabağın iki yarısı var.', '15 + 15 = 30.']),
        tf('k8-a4', 'Tahminimiz 50, saydığımızda 48 çıktı. Tahminimiz sonuca yakındır.', true, ['50 ile 48 arasında kaç fark var?', 'Sadece 2 fark var. Cümle doğru.']),
        mt('k8-a5', 'Tahmin ve sayma sonuçlarını karşılaştır.', [['Tahmin 30, sayma 31', 'Tahmin çok yakın'], ['Tahmin 20, sayma 60', 'Tahmin az kaldı'], ['Tahmin 90, sayma 40', 'Tahmin çok fazla']], ['Tahmini sayma sonucuyla karşılaştır: küçük mü, büyük mü?', '20, 60\'tan çok küçük; 90, 40\'tan çok büyük.']),
        wr('k8-a6', 'Bir rafın dörtte birinde 20 kitap var. Bütün rafta yaklaşık kaç kitap vardır?', 80, ['Rafın dört eşit parçası var.', '20 + 20 + 20 + 20 = 80.'])
      ]),
      testPool: sk('Nesne sayısını tahmin etme', [
        ch('k8-t1', 'Kutunun yarısında 30 kalem var. Bütün kutuda yaklaşık kaç kalem vardır?', [30, 45, 60], 60),
        ch('k8-t2', 'Tahminim 70, saydım 72 çıktı. Hangisi doğrudur?', [['a', 'Tahminim çok az'], ['b', 'Tahminim sonuca çok yakın'], ['c', 'Tahminim çok fazla']], 'b'),
        tf('k8-t3', 'Bir çokluğun bir parçasını sayarak bütününü tahmin edebiliriz.', true),
        wr('k8-t4', 'Bahçenin yarısında 45 lale var. Bütün bahçede yaklaşık kaç lale vardır?', 90),
        ch('k8-t5', 'Tahminim 25, saydım 50 çıktı. Tahminim nasıl?', [['a', 'Sonuçtan az'], ['b', 'Sonuçla eşit'], ['c', 'Sonuçtan fazla']], 'a'),
        tf('k8-t6', 'Tahmin, saymadan önce yapılır.', true),
        wr('k8-t7', 'Bir torbanın dörtte birinde 15 bilye var. Bütün torbada yaklaşık kaç bilye vardır?', 60),
        ch('k8-t8', 'Tahminim 80, saydım 60 çıktı. Hangisi doğrudur?', [['a', 'Tahminim sonuçtan fazla'], ['b', 'Tahminim sonuçtan az'], ['c', 'Tahminim sonuçla eşit']], 'a'),
        tf('k8-t9', 'Tahminimiz sayma sonucundan farklı çıkarsa hata yapmış oluruz.', false),
        wr('k8-t10', 'Bir sayfanın yarısında 12 yıldız var. Bütün sayfada yaklaşık kaç yıldız vardır?', 24)
      ]),
      summary: {
        idea: 'Tahmin ederken çokluğun bir parçasını sayar, bütünü buna göre düşünürüz. Sonra sayarak tahminimizi kontrol ederiz.',
        points: ['Yarısında 25 → bütününde yaklaşık 50', 'Dörtte birinde 10 → bütününde yaklaşık 40', 'Tahmini sayma sonucuyla az, çok ya da yakın diye karşılaştırırız'],
        example: { title: 'Şeker kavanozu', lines: ['Dörtte birinde 10 şeker', 'Tahmin: yaklaşık 40', 'Sayınca 38 → tahmin çok yakın'] }
      }
    }
  });

})();
