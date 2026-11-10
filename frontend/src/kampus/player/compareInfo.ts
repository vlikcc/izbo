// Karşılaştırma etkinliği için soruya özel ipuçları (en büyük basamaktan başlayarak). Prototipte player.js compareInfo.

export function compareInfo(a: number, b: number): { sign: '<' | '>' | '='; hints: string[] } {
    const sign = a < b ? '<' : a > b ? '>' : '=';
    const sa = String(a), sb = String(b);
    let h1: string;
    if (sa.length !== sb.length) h1 = `${a} ${sa.length} basamaklı, ${b} ${sb.length} basamaklı. Basamağı çok olan sayı daha büyüktür.`;
    else {
        const P = sa.length === 3 ? ['yüzlük', 'onluk', 'birlik'] : sa.length === 2 ? ['onluk', 'birlik'] : ['birlik'];
        const D = sa.length === 3 ? ['yüzlüklere', 'onluklara', 'birliklere'] : sa.length === 2 ? ['onluklara', 'birliklere'] : ['birliklere'];
        const i = [...sa].findIndex((d, k) => d !== sb[k]);
        if (i === -1) h1 = 'Basamakları tek tek karşılaştır. Hepsi aynı mı?';
        else if (i === 0) h1 = `Önce ${D[0]} bak: ${a} sayısında ${sa[0]} ${P[0]}, ${b} sayısında ${sb[0]} ${P[0]} var.`;
        else h1 = `İkisinde de ${sa[i - 1]} ${P[i - 1]} var. Şimdi ${D[i]} bak.`;
    }
    const big = Math.max(a, b);
    const h2 = sign === '=' ? 'Sayılar tamamen aynı. Aralarına = koyarız.' : `${big} daha büyük. İşaretin açık ağzı ${big} sayısına bakmalı: ${sign}`;
    return { sign, hints: [h1, h2] };
}
