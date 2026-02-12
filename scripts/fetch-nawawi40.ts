/**
 * Fetch Nawawi 40 Hadith texts from fawazahmed0 CDN
 * Updates nawawi40-items.json with Arabic and French texts
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fetch-nawawi40.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1'

interface HadithEdition {
  hadiths: Array<{
    hadithnumber: number
    text: string
  }>
}

async function fetchJSON(url: string): Promise<any> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  return response.json()
}

async function main() {
  console.log('Fetching Nawawi 40 Hadith from fawazahmed0 CDN...')

  const dataPath = path.join(__dirname, 'data', 'nawawi40-items.json')
  const existing = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  // Try to fetch Arabic edition
  try {
    console.log('Fetching Arabic edition...')
    const arData: HadithEdition = await fetchJSON(
      `${CDN_BASE}/editions/ara-nawawi40.json`
    )
    if (arData.hadiths) {
      for (const hadith of arData.hadiths) {
        const item = existing.items.find((i: any) => i.itemNumber === hadith.hadithnumber)
        if (item && hadith.text) {
          item.textAr = hadith.text.trim()
        }
      }
      console.log(`  Updated ${arData.hadiths.length} Arabic texts`)
    }
  } catch (e) {
    console.log('  Arabic edition not available, keeping existing texts')
  }

  // Try to fetch French edition
  try {
    console.log('Fetching French edition...')
    const frData: HadithEdition = await fetchJSON(
      `${CDN_BASE}/editions/fra-nawawi40.json`
    )
    if (frData.hadiths) {
      for (const hadith of frData.hadiths) {
        const item = existing.items.find((i: any) => i.itemNumber === hadith.hadithnumber)
        if (item && hadith.text) {
          item.textFr = hadith.text.trim()
        }
      }
      console.log(`  Updated ${frData.hadiths.length} French texts`)
    }
  } catch (e) {
    console.log('  French edition not available, keeping existing texts')
  }

  // Try English too
  try {
    console.log('Fetching English edition...')
    const enData: HadithEdition = await fetchJSON(
      `${CDN_BASE}/editions/eng-nawawi40.json`
    )
    if (enData.hadiths) {
      for (const hadith of enData.hadiths) {
        const item = existing.items.find((i: any) => i.itemNumber === hadith.hadithnumber)
        if (item && hadith.text) {
          item.textEn = hadith.text.trim()
        }
      }
      console.log(`  Updated ${enData.hadiths.length} English texts`)
    }
  } catch (e) {
    console.log('  English edition not available')
  }

  fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2), 'utf-8')
  console.log(`\nSaved to ${dataPath}`)
}

main().catch(console.error)
