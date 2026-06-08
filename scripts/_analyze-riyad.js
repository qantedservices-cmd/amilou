const d = require('./data/riyad-full.json');

const perChapter = {};
for (const h of d.hadiths) {
  if (!perChapter[h.chapterId]) {
    perChapter[h.chapterId] = { count: 0, first: h.idInBook, last: h.idInBook };
  }
  perChapter[h.chapterId].count++;
  perChapter[h.chapterId].last = Math.max(perChapter[h.chapterId].last, h.idInBook);
  perChapter[h.chapterId].first = Math.min(perChapter[h.chapterId].first, h.idInBook);
}

for (const ch of d.chapters) {
  const info = perChapter[ch.id] || { count: 0, first: 0, last: 0 };
  console.log(`${ch.id} | ${info.count} hadiths | #${info.first}-${info.last} | ${ch.arabic} | ${ch.english}`);
}
console.log('Total:', d.hadiths.length);
