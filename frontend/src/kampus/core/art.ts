/* eslint-disable */
// @ts-nocheck — ilkokul-platformu prototipinden (js/avatar.js) olduğu gibi taşındı.
// Mantık bilerek değiştirilmedi; tipler dışa açılan adlarda gevşek (any) tutuldu.
import {
  AVATAR_DEFAULT, AVATAR_ITEMS
} from './data';

// Öğrenci avatarı: düz, sade çizim (arka plan → saçın arkası → gövde/kıyafet → boyun → baş → yüz → saç → aksesuar).
// İki kullanım: yuvarlak küçük avatar (üst çubuk, tablo) ve profil şeridindeki büyük büst (arka planı şeridi kaplar).
// Temel parçalar (ten, göz, saç, saç rengi, tişört) ücretsiz; özel parçalar AVATAR_ITEMS içinde, 💎 KP ile açılır.

export const AvatarArt: any = (() => {
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  };
  const DEFAULT_BG = '#7CCBA8';

  // Arka planlar 120x120 için çizilir; şeritte "slice" ile alanı kaplar
  const BG = {
    none: () => `<rect width="120" height="120" fill="${DEFAULT_BG}"/>`,
    'gece-gokyuzu': () => `<rect width="120" height="120" fill="#1F2A5C"/><g fill="#FFE27A">${[[18, 20], [96, 16], [80, 40], [28, 52], [104, 62], [12, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8"/>`).join('')}</g><circle cx="98" cy="26" r="9" fill="#FFF3C4"/><circle cx="102" cy="23" r="8" fill="#1F2A5C"/>`,
    orman: () => `<rect width="120" height="120" fill="#BFE5A8"/><g fill="#6BBF59"><path d="M6 100 L20 56 L34 100Z"/><path d="M86 100 L100 50 L114 100Z"/></g><g fill="#4E9A43"><path d="M-6 104 L8 70 L22 104Z"/><path d="M98 104 L112 68 L126 104Z"/></g>`,
    okyanus: () => `<rect width="120" height="120" fill="#9FD8F0"/><path d="M0 92 Q15 84 30 92 T60 92 T90 92 T120 92 V120 H0Z" fill="#5BB6E0"/><circle cx="98" cy="22" r="9" fill="#FFE27A"/>`,
    gezegenler: () => `<rect width="120" height="120" fill="#2B2560"/><circle cx="20" cy="24" r="8" fill="#FF8A3D"/><ellipse cx="20" cy="24" rx="14" ry="3.2" fill="none" stroke="#FFD08A" stroke-width="2"/><circle cx="102" cy="28" r="6" fill="#58B947"/><circle cx="98" cy="96" r="5" fill="#E25A86"/><g fill="#fff"><circle cx="70" cy="12" r="1.3"/><circle cx="40" cy="8" r="1"/><circle cx="112" cy="56" r="1.2"/></g>`
  };

  // Gövde: düz omuzlar (yamuk), yaka
  function body(cfg, outfit) {
    const shape = 'M24 120 L32 98 C34 91 40 88 48 88 H72 C80 88 86 91 88 98 L96 120Z';
    if (outfit === 'uzay-tulumu') return `<path d="${shape}" fill="#F4F6FB"/><path d="M48 88 C52 96 68 96 72 88" fill="none" stroke="#C9D1E4" stroke-width="4"/>
      <rect x="50" y="100" width="20" height="10" rx="3" fill="#4C8DF0"/><circle cx="80" cy="104" r="4" fill="#E5533D"/>`;
    if (outfit === 'sporcu-formasi') return `<path d="${shape}" fill="#E5533D"/><path d="M44 89 V120 M60 89 V120 M76 89 V120" stroke="#fff" stroke-width="4" opacity=".75"/>
      <text x="60" y="113" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="13" fill="#fff">10</text>`;
    const cape = outfit === 'super-pelerin';
    return `<path d="${shape}" fill="${cfg.shirt}"/><path d="M50 88 L60 97 L70 88" fill="${shade(cfg.shirt, 0.8)}"/>${cape ? `<circle cx="60" cy="106" r="7" fill="#F2B705"/><text x="60" y="110" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="9" fill="#E5533D">S</text>` : ''}`;
  }
  function hairBack(cfg) {
    const c = cfg.hairColor;
    if (cfg.hair === 'uzun') return `<path d="M30 46 C26 66 34 72 30 84 C26 96 32 104 40 108 H80 C88 104 94 96 90 84 C86 72 94 66 90 46 C88 28 76 18 60 18 C44 18 32 28 30 46Z" fill="${c}"/>`;
    if (cfg.hair === 'kivircik') return `<g fill="${c}">${[[34, 58], [86, 58], [32, 70], [88, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8"/>`).join('')}</g>`;
    return '';
  }
  function hairFront(cfg) {
    const c = cfg.hairColor;
    switch (cfg.hair) {
      case 'kel': return '';
      case 'kivircik': return `<g fill="${c}">${[[38, 34], [47, 26], [57, 22], [67, 22], [77, 26], [84, 34], [34, 44], [86, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('')}</g>`;
      case 'topuz': return `<circle cx="60" cy="14" r="10" fill="${c}"/><path d="M36 46 C36 26 46 20 60 20 C74 20 84 26 84 46 C78 36 70 32 60 32 C50 32 42 36 36 46Z" fill="${c}"/>`;
      case 'uzun': return `<path d="M36 50 C34 28 46 20 60 20 C74 20 86 28 84 50 C80 38 72 33 60 33 C48 33 40 38 36 50Z" fill="${c}"/>`;
      default: return `<path d="M35 48 C34 27 46 19 60 19 C75 19 86 27 85 48 C81 39 74 34 64 34 C56 34 50 31 46 28 C44 35 40 40 35 48Z" fill="${c}"/>`;
    }
  }
  // Baş: yuvarlatılmış kare yüz, iri gözler, küçük burun
  function head(cfg) {
    const eye = cfg.eyes || '#4A3426', nose = shade(cfg.skin, 0.82);
    return `<rect x="53" y="74" width="14" height="16" fill="${shade(cfg.skin, 0.92)}"/>
      <circle cx="35" cy="54" r="5" fill="${cfg.skin}"/><circle cx="85" cy="54" r="5" fill="${cfg.skin}"/>
      <rect x="36" y="26" width="48" height="52" rx="17" fill="${cfg.skin}"/>
      <ellipse cx="50" cy="52" rx="6.5" ry="7.5" fill="#fff"/><ellipse cx="70" cy="52" rx="6.5" ry="7.5" fill="#fff"/>
      <ellipse cx="51.5" cy="53" rx="3.3" ry="4.4" fill="${eye}"/><ellipse cx="71.5" cy="53" rx="3.3" ry="4.4" fill="${eye}"/>
      <circle cx="52.6" cy="51.4" r="1.1" fill="#fff"/><circle cx="72.6" cy="51.4" r="1.1" fill="#fff"/>
      <path d="M58 58 Q60 64 62 58 Z" fill="${nose}" stroke="${nose}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M53 67 Q60 71 66 66" fill="none" stroke="${shade(cfg.skin, 0.62)}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  function acc(id) {
    switch (id) {
      case 'roket-gozluk': return `<path d="M34 50 H86" stroke="#3A3F5C" stroke-width="3"/><rect x="40" y="44" width="18" height="15" rx="6" fill="#FF8A3D" stroke="#3A3F5C" stroke-width="2.5"/><rect x="62" y="44" width="18" height="15" rx="6" fill="#FF8A3D" stroke="#3A3F5C" stroke-width="2.5"/><rect x="43" y="47" width="6" height="4" rx="2" fill="#fff" opacity=".7"/><rect x="65" y="47" width="6" height="4" rx="2" fill="#fff" opacity=".7"/>`;
      case 'kasif-sapka': return `<ellipse cx="60" cy="29" rx="36" ry="7" fill="#B98A4E"/><path d="M40 29 C40 12 80 12 80 29Z" fill="#D9A86A"/><rect x="40" y="23" width="40" height="5" fill="#7A5230"/>`;
      case 'yildiz-tac': return `<path d="M40 28 L44 12 L52 22 L60 8 L68 22 L76 12 L80 28Z" fill="#FFC800" stroke="#E0A100" stroke-width="2"/><circle cx="60" cy="20" r="3" fill="#E25A86"/>`;
      case 'kulaklik': return `<path d="M34 54 C32 22 88 22 86 54" fill="none" stroke="#8E5CF7" stroke-width="5"/><rect x="27" y="46" width="11" height="17" rx="5" fill="#8E5CF7"/><rect x="82" y="46" width="11" height="17" rx="5" fill="#8E5CF7"/>`;
      default: return '';
    }
  }
  // Karakter (arka plansız)
  function figure(cfg, eq = {}) {
    const c = { ...AVATAR_DEFAULT, ...cfg };
    const capeBack = eq.outfit === 'super-pelerin' ? `<path d="M30 94 C18 110 20 120 20 120 H100 C100 120 102 110 90 94Z" fill="#E5533D"/>` : '';
    return `${capeBack}${hairBack(c)}${body(c, eq.outfit)}${head(c)}${hairFront(c)}${acc(eq.acc)}`;
  }

  // Yuvarlak küçük avatar
  function svg(cfg, eq = {}, { title = 'Avatar' } = {}) {
    return `<svg viewBox="0 0 120 120" role="img" aria-label="${title}"><defs><clipPath id="avc"><circle cx="60" cy="60" r="60"/></clipPath></defs>
      <g clip-path="url(#avc)">${(BG[eq.bg] || BG.none)()}${figure(cfg, eq)}</g></svg>`;
  }
  // Profil şeridi: arka plan şeridi kaplar, büst ortada ve alttan kesilir
  function banner(cfg, eq = {}, { title = 'Avatar' } = {}) {
    return `<svg class="avb-bg" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${(BG[eq.bg] || BG.none)()}</svg>
      <svg class="avb-fig" viewBox="22 4 76 116" role="img" aria-label="${title}">${figure(cfg, eq)}</svg>`;
  }

  // Mağaza kartındaki küçük önizleme için parçayı tek başına çizer
  function itemIcon(item) {
    const c = AVATAR_DEFAULT;
    if (item.slot === 'bg') return svg(c, { bg: item.id }, { title: item.name });
    if (item.slot === 'acc') return svg({ ...c, hair: 'kel' }, { acc: item.id }, { title: item.name });
    return svg(c, { outfit: item.id }, { title: item.name });
  }

  return { svg, banner, itemIcon };
})();

// Haftanın kupası görseli: kupa gövdesi + temaya özgü amblem (kuyruklu yıldız, ay, güneş, gökkuşağı, Satürn, kuzey ışığı)
export const CupArt: any = (() => {
  const EMBLEM = {
    comet: c => `<circle cx="66" cy="44" r="8" fill="#fff"/><path d="M60 48 L40 62 M62 52 L46 68 M58 44 L36 54" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>`,
    moon: c => `<circle cx="60" cy="50" r="13" fill="#fff"/><circle cx="66" cy="45" r="11" fill="${c}"/><circle cx="46" cy="40" r="1.6" fill="#fff"/><circle cx="72" cy="62" r="1.4" fill="#fff"/>`,
    sun: c => `<circle cx="60" cy="50" r="9" fill="#fff"/><g stroke="#fff" stroke-width="3" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return `<path d="M${60 + Math.cos(r) * 13} ${50 + Math.sin(r) * 13} L${60 + Math.cos(r) * 18} ${50 + Math.sin(r) * 18}"/>`; }).join('')}</g>`,
    rainbow: c => `<g fill="none" stroke-width="3.5" stroke-linecap="round"><path d="M44 60 A16 16 0 0 1 76 60" stroke="#fff"/><path d="M48.5 60 A11.5 11.5 0 0 1 71.5 60" stroke="#FFE27A"/><path d="M53 60 A7 7 0 0 1 67 60" stroke="#A8E6FF"/></g>`,
    saturn: c => `<circle cx="60" cy="50" r="10" fill="#fff"/><ellipse cx="60" cy="50" rx="19" ry="5" fill="none" stroke="#fff" stroke-width="3" transform="rotate(-18 60 50)"/>`,
    aurora: c => `<path d="M42 58 C48 40 54 52 60 38 C66 52 72 40 78 58" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><path d="M46 62 C52 50 58 58 64 48 C68 56 72 52 76 62" fill="none" stroke="#C9F1F5" stroke-width="3" stroke-linecap="round"/>`
  };
  const dark = (hex, f = .72) => { const n = parseInt(hex.slice(1), 16); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * f).toString(16).padStart(2, '0')).join(''); };
  function svg(theme, { off = false, title } = {}) {
    const c = off ? '#C9CED8' : theme.color, d = dark(c), g = off ? '#EEF0F4' : theme.glow;
    return `<svg viewBox="0 0 120 120" role="img" aria-label="${title || theme.name}">
      <circle cx="60" cy="54" r="50" fill="${g}" opacity=".7"/>
      <path d="M34 26 H86 V44 C86 62 74 74 60 74 C46 74 34 62 34 44Z" fill="${c}"/>
      <path d="M34 32 H24 C24 48 30 54 38 56" fill="none" stroke="${d}" stroke-width="5" stroke-linecap="round"/>
      <path d="M86 32 H96 C96 48 90 54 82 56" fill="none" stroke="${d}" stroke-width="5" stroke-linecap="round"/>
      <rect x="54" y="74" width="12" height="14" fill="${d}"/>
      <rect x="40" y="88" width="40" height="8" rx="3" fill="${c}"/><rect x="34" y="96" width="52" height="10" rx="4" fill="${d}"/>
      <path d="M40 30 C40 46 44 58 52 66" fill="none" stroke="#fff" stroke-width="3" opacity=".35" stroke-linecap="round"/>
      ${(EMBLEM[theme.emblem] || (() => ''))(c)}</svg>`;
  }
  return { svg };
})();
