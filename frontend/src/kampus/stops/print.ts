/* eslint-disable @typescript-eslint/no-explicit-any */
// Yazdırma yardımcıları (prototipte stops.js printSummary ve Çalışma Kâğıdı "Yazdır").
// Gizli çerçeve doğrudan document.body'ye eklenir; .kampus stillerine ihtiyacı yoktur.
import { BRAND, COURSES, SUBJECTS, TOPICS, esc, planTopic, toast } from '../core';

function hiddenFrame(): HTMLIFrameElement {
    const fr = document.createElement('iframe');
    fr.setAttribute('aria-hidden', 'true');
    fr.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    return fr;
}

// ---------- Konu Özeti: yazdırılabilir A4 sayfa ----------
// Özet gizli bir çerçevede sade bir sayfa olarak hazırlanır ve tarayıcının yazdırma penceresi açılır (PDF olarak da kaydedilebilir).
export function printSummary(topic: any, S: any) {
    const pt = planTopic(topic.course, Object.keys(TOPICS).find((id) => TOPICS[id] === topic));
    const sub = SUBJECTS[COURSES[topic.course].subject];
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(topic.title)} · Konu Özeti</title>
      <style>
        @page{size:A4;margin:16mm}
        body{font-family:"Nunito","Segoe UI",Arial,sans-serif;color:#1B2559;margin:0}
        header{border-bottom:3px solid ${sub.color};padding-bottom:10px;margin-bottom:16px}
        .k{font-size:12pt;color:#5A6385;margin:0}
        h1{font-size:24pt;margin:4px 0 0}
        .tag{display:inline-block;font-size:10pt;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#6A3FD8;margin-bottom:4px}
        .idea{border:2px solid #E2D5FF;background:#F7F2FF;border-radius:12px;padding:12px 16px;font-size:15pt;font-weight:700;line-height:1.4}
        ul{font-size:13pt;line-height:1.6;padding-left:22px}
        .ex{border:2px dashed #C9B5FF;border-radius:12px;padding:10px 16px;font-size:14pt}
        .ex p{margin:4px 0}
        footer{margin-top:24px;font-size:10pt;color:#8A93A8;border-top:1px solid #E7ECF5;padding-top:8px}
        *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      </style></head><body>
      <header><p class="k">${esc(BRAND.name)} · ${COURSES[topic.course].grade}. Sınıf ${esc(sub.name)}${pt ? ` · ${pt.theme.no}. Tema · ${esc(pt.theme.title)}` : ''}</p>
        <h1>${esc(topic.title)} — Konu Özeti</h1></header>
      <span class="tag">Ana fikir</span><div class="idea">${esc(S.idea)}</div>
      ${S.points && S.points.length ? `<ul>${S.points.map((p: any) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      ${S.example ? `<span class="tag">Örnek · ${esc(S.example.title)}</span><div class="ex">${S.example.lines.map((l: any) => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
      <footer>Adım Soyadım: ______________________ &nbsp;&nbsp; Tarih: ____ / ____ / ______${topic.code ? ` &nbsp;&nbsp; MEB öğrenme çıktısı: ${esc(topic.code)}` : ''}</footer>
      </body></html>`;
    const fr = hiddenFrame();
    document.body.appendChild(fr);
    fr.onload = () => {
        try { fr.contentWindow?.focus(); fr.contentWindow?.print(); } catch { toast('Yazdırma açılamadı.'); }
        setTimeout(() => fr.remove(), 60000);
    };
    fr.srcdoc = html;
}

// PDF'i gizli bir çerçevede açıp yazdırma penceresini çağırır; tarayıcı izin vermezse PDF yeni sekmede açılır.
export function printPdf(file: string) {
    const fr = hiddenFrame();
    fr.src = file;
    document.body.appendChild(fr);
    fr.onload = () => {
        try { fr.contentWindow?.focus(); fr.contentWindow?.print(); } catch { window.open(file, '_blank', 'noopener'); }
        setTimeout(() => fr.remove(), 60000);
    };
}
