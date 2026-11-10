// Sayı doğrusu SVG'si (prototipte stops.js numberLineSvg). Kod içinde üretilir, <RawHtml/> ile basılır.
// clickable: her çentiğe dokunulabilir .nl-hit alanı eklenir (data-n = sayı).

export function numberLineSvg(from: number, to: number, step: number, marks: number[], clickable = false): string {
    const W = 620, pad = 30, y = 70, span = to - from;
    const x = (n: number) => pad + (n - from) / span * (W - 2 * pad);
    const minor = span <= 40 ? 1 : step / 10 >= 1 ? step / 10 : 1;
    let ticks = '';
    for (let n = from; n <= to + 1e-9; n += minor) {
        const major = Math.abs((n - from) % step) < 1e-9;
        ticks += `<line x1="${x(n)}" x2="${x(n)}" y1="${y - (major ? 12 : 6)}" y2="${y + (major ? 12 : 6)}" stroke="#1B2559" stroke-width="${major ? 2.5 : 1.2}"/>`;
        if (major) ticks += `<text x="${x(n)}" y="${y + 34}" text-anchor="middle" font-size="16" font-weight="700" fill="#1B2559">${Math.round(n)}</text>`;
        if (clickable) ticks += `<rect class="nl-hit" data-n="${Math.round(n)}" x="${x(n) - 7}" y="${y - 30}" width="14" height="60" fill="transparent"/>`;
    }
    const cols = ['#FF8A3D', '#1E88E5', '#8E5CF7', '#58B947'];
    const pins = marks.map((m, i) => `<g><circle cx="${x(m)}" cy="${y}" r="9" fill="${cols[i % 4]}" stroke="#fff" stroke-width="3"/>
      <text x="${x(m)}" y="${y - 22}" text-anchor="middle" font-size="18" font-weight="800" fill="${cols[i % 4]}">${m}</text></g>`).join('');
    return `<svg class="vz-line" viewBox="0 0 ${W} 120" role="img" aria-label="${from} ile ${to} arası sayı doğrusu${marks.length ? ', işaretli: ' + marks.join(', ') : ''}">
      <line x1="${pad - 14}" x2="${W - pad + 14}" y1="${y}" y2="${y}" stroke="#1B2559" stroke-width="3"/>
      <path d="M${W - pad + 14} ${y} l-10 -7 v14z" fill="#1B2559"/>${ticks}${pins}</svg>`;
}
