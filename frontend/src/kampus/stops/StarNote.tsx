/* eslint-disable @typescript-eslint/no-explicit-any */
// Yıldız gelmeyen doğrular için olumlu açıklama (prototipte stops.js starNote).
export function StarNote({ r }: { r: any }) {
    if (r.capped) return <p className="star-note">Bugünkü 10 ⭐ hakkını doldurdun. Yarın yine gel! 💎 KP kazanmaya devam edebilirsin.</p>;
    if (r.repeat > 0) return <p className="star-note">{r.cup ? 'Bazı soruların' : 'Bu soruların'} yıldızını daha önce almıştın. Tekrar ederek pekiştirdin! ✓</p>;
    return null;
}
