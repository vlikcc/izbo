#!/usr/bin/env node
// YZ Kampüs içerik kataloğunu sunucu için dışa aktarır.
//
// Ön yüz (frontend/src/kampus/core/data.ts + content.ts) konu, kitap, oyun, avatar ve değerlendirme
// verilerinin tek kaynağıdır. Sunucu ödül verirken soru kimliklerini doğrulamak ve cevapları kendisi
// puanlamak için bu verilerin cevap anahtarlı bir kopyasına ihtiyaç duyar. Bu betik o kopyayı üretir:
//   src/Services/ContentService/ContentService/Kampus/Catalog/kampus-catalog.json
//
// Kullanım (depo kökünden):
//   node scripts/kampus/export-catalog.mjs [frontend/src/kampus/core]
// esbuild, frontend/node_modules içinden alınır (önce `cd frontend && npm install`).
// İçerik değiştiğinde yeniden çalıştırılıp çıktı commit edilmelidir.

import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const coreDir = path.resolve(process.argv[2] || path.join(repo, 'frontend', 'src', 'kampus', 'core'));
const frontendDir = path.resolve(coreDir, '..', '..', '..');
const out = path.join(repo, 'src', 'Services', 'ContentService', 'ContentService', 'Kampus', 'Catalog', 'kampus-catalog.json');

const require = createRequire(path.join(frontendDir, 'package.json'));
const esbuild = require('esbuild');

const entry = `
  export * from ${JSON.stringify(path.join(coreDir, 'data.ts'))};
  import ${JSON.stringify(path.join(coreDir, 'content.ts'))};
`;

const work = mkdtempSync(path.join(tmpdir(), 'kampus-catalog-'));
try {
  const bundle = path.join(work, 'bundle.mjs');
  await esbuild.build({
    stdin: { contents: entry, resolveDir: coreDir, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error'
  });
  const D = await import(pathToFileURL(bundle).href);

  // Sunucunun puanlama için ihtiyaç duyduğu alanlar; anlatım metinleri ve görseller alınmaz.
  const question = q => {
    const r = { id: q.id, type: q.type || 'choice' };
    if (q.skill) r.skill = q.skill;
    if (r.type === 'match') r.pairs = q.pairs.length;
    else r.answer = Array.isArray(q.answer) ? q.answer.map(String) : [String(q.answer)];
    if (q.options) r.options = q.options.map(o => Array.isArray(o) ? { v: o[0], label: o[1] } : { v: o.v, label: o.label });
    return r;
  };

  const topics = {};
  for (const [id, t] of Object.entries(D.TOPICS)) {
    const course = D.COURSES[t.course] || {};
    const c = D.stopContent(t);
    topics[id] = {
      course: t.course,
      grade: course.grade ?? Number(String(t.course).split('-')[0]),
      subject: course.subject ?? String(t.course).split('-').slice(1).join('-'),
      title: t.title,
      meeting: !!t.meeting,
      stops: D.topicStops(t).map(s => s.id),
      exercises: c.exercises.map(question),
      testPool: c.testPool.map(question),
      // Konu oynatıcısı (İzle → Uygula → Kontrol): ödev sonuçları bu soruları kullanır.
      practice: (t.practice || []).map(question),
      check: (t.check || []).map(question)
    };
  }

  const courses = Object.fromEntries(Object.entries(D.COURSES).map(([id, c]) => [id, {
    grade: c.grade, subject: c.subject, topics: D.courseTopics(id)
  }]));

  const catalog = {
    generatedFrom: 'frontend/src/kampus/core (data.ts, content.ts)',
    grades: D.GRADES,
    courses,
    topics,
    stopTypes: Object.fromEntries(Object.entries(D.STOP_TYPES).map(([id, s]) => [id, { kp: s.kp || 0, sheet: !!s.sheet }])),
    minitestSize: D.MINITEST_SIZE,
    kpRules: D.KP_RULES,
    starDailyMax: D.STAR_DAILY_MAX,
    cup: {
      winners: D.CUP_WINNERS, groupSize: D.CUP_GROUP_SIZE,
      themes: D.CUP_THEMES.map(t => ({ id: t.id, name: t.name })),
      taskPool: D.CUP_TASK_POOL.map(t => ({ id: t.id, stops: t.stops, label: t.label, icon: t.icon })),
      weeklyTasks: D.CUP_WEEKLY_TASKS, bonusTasks: D.CUP_BONUS_TASKS,
      nickAdjectives: D.NICK_ADJ.map(a => a[0]),
      nickNouns: D.NICK_NOUN.map(n => ({ name: n[0], emoji: n[1] }))
    },
    books: D.BOOKS.map(b => ({ id: b.id, title: b.title, grade: b.grade, questions: b.questions.map(q => ({ id: q.id, answer: String(q.answer) })) })),
    games: D.GAMES.map(g => ({ id: g.id, title: g.title, subject: g.subject, rounds: g.rounds })),
    avatar: { default: D.AVATAR_DEFAULT, base: { ...D.AVATAR_BASE, hair: D.AVATAR_BASE.hair.map(h => h[0]) }, items: D.AVATAR_ITEMS },
    assessSkills: Object.fromEntries(Object.entries(D.ASSESS_SKILLS).map(([k, s]) => [k, {
      subject: s.subject, name: s.name, can: s.can || null, study: s.study || null, course: s.course, topicId: s.topicId || null
    }])),
    assessBank: D.ASSESS_BANK.map(q => ({ ...question(q), grade: q.grade, skill: q.skill, prompt: q.prompt, input: q.input || null }))
  };

  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(catalog, null, 1) + '\n');
  console.log(`Wrote ${path.relative(repo, out)}: ${Object.keys(topics).length} topics, ${catalog.books.length} books, ${catalog.assessBank.length} bank questions`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
