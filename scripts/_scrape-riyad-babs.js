#!/usr/bin/env node
/**
 * Scrapes bab (sub-chapter) structure for Riyad As-Salihin from sunnah.com
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const existingData = require('./data/riyad-full.json');

const chaptersMap = {};
existingData.chapters.forEach(c => {
  chaptersMap[c.id] = { bookId: c.id, arabic: c.arabic, english: c.english };
});

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function parseBook(html) {
  const babs = [];
  // Normalize line endings and join lines so we can match multi-line patterns
  const fullHtml = html;

  // The HTML has echapno+englishchapter on one line, then arabic on a line 2 lines later
  // Pattern (multiline): echapno line + optional blank line + arabicchapter line
  // Use a regex that allows newlines between them
  const chapterRegex = /<div class=echapno>\((\d+)\)<\/div><div class=englishchapter>([^<]+)<\/div>[\s\S]{0,200}?<div class="arabicchapter arabic">[-\s]*([^<]+)<\/div>/g;

  let match;
  const chapters = [];

  while ((match = chapterRegex.exec(fullHtml)) !== null) {
    chapters.push({
      babNumber: parseInt(match[1]),
      babNameEn: match[2].trim(),
      babNameAr: match[3].trim().replace(/^[-\s]+/, '').trim(),
      position: match.index
    });
  }

  for (let i = 0; i < chapters.length; i++) {
    const chap = chapters[i];
    const nextChap = chapters[i + 1];

    const segmentStart = chap.position;
    const segmentEnd = nextChap ? nextChap.position : fullHtml.length;
    const segment = fullHtml.substring(segmentStart, segmentEnd);

    const hadithNums = [];
    let hMatch;
    const segHadithRegex = /Riyad as-Salihin (\d+)/g;
    while ((hMatch = segHadithRegex.exec(segment)) !== null) {
      hadithNums.push(parseInt(hMatch[1]));
    }

    const uniqueNums = [...new Set(hadithNums)].sort((a, b) => a - b);

    babs.push({
      babNumber: chap.babNumber,
      babNameAr: chap.babNameAr,
      babNameEn: chap.babNameEn,
      hadithStart: uniqueNums.length > 0 ? uniqueNums[0] : null,
      hadithEnd: uniqueNums.length > 0 ? uniqueNums[uniqueNums.length - 1] : null,
    });
  }

  return babs;
}

async function main() {
  const result = {
    source: 'sunnah.com',
    fetchedAt: new Date().toISOString(),
    books: []
  };

  const bookNums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  for (const bookNum of bookNums) {
    const url = bookNum === 0
      ? 'https://sunnah.com/riyadussalihin/introduction'
      : `https://sunnah.com/riyadussalihin/${bookNum}`;

    console.log(`Fetching book ${bookNum}: ${url}`);

    try {
      const { status, body } = await fetchPage(url);
      console.log(`  Status: ${status}, size: ${body.length}`);

      if (status === 200) {
        const babs = parseBook(body);
        console.log(`  Found ${babs.length} babs`);

        const chapInfo = chaptersMap[bookNum] || {};

        result.books.push({
          bookNumber: bookNum,
          bookNameAr: chapInfo.arabic || '',
          bookNameEn: chapInfo.english || '',
          sunnahComUrl: url,
          babs: babs
        });

        if (babs.length > 0) {
          console.log(`  First bab: (${babs[0].babNumber}) ${babs[0].babNameEn}`);
          console.log(`  Last bab: (${babs[babs.length-1].babNumber}) ${babs[babs.length-1].babNameEn}`);
        }
      } else {
        result.books.push({
          bookNumber: bookNum,
          bookNameAr: chaptersMap[bookNum] && chaptersMap[bookNum].arabic || '',
          bookNameEn: chaptersMap[bookNum] && chaptersMap[bookNum].english || '',
          error: `HTTP ${status}`,
          babs: []
        });
      }

      await new Promise(r => setTimeout(r, 600));

    } catch (err) {
      console.error(`  Error: ${err.message}`);
      result.books.push({
        bookNumber: bookNum,
        bookNameAr: chaptersMap[bookNum] && chaptersMap[bookNum].arabic || '',
        bookNameEn: chaptersMap[bookNum] && chaptersMap[bookNum].english || '',
        error: err.message,
        babs: []
      });
    }
  }

  const totalBabs = result.books.reduce((sum, b) => sum + b.babs.length, 0);
  console.log(`\nTotal babs found: ${totalBabs}`);

  const outputPath = path.join(__dirname, 'data', 'riyad-babs.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Saved to ${outputPath}`);
}

main().catch(console.error);
