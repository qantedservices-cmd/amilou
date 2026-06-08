#!/usr/bin/env node
/**
 * Import Notion export into Outline via API
 */
const fs = require("fs");
const path = require("path");

const API_URL = "https://doc.aamilou.com/api";
const API_KEY = "ol_api_uEU61wlOcnvbHZBMPsakImbEqp4JTVsk6HNngQ";

const exportDir = process.argv[2];
if (!exportDir) {
  console.error("Usage: node import-notion-to-outline.js <folder>");
  process.exit(1);
}

function cleanNotionName(name) {
  return name.replace(/\s+[0-9a-f]{16,}$/i, "").trim();
}

function isNotionIndexPage(content) {
  const lines = content.split("\n").filter(l => l.trim());
  const bodyLines = lines.filter(l => !l.startsWith("# "));
  if (bodyLines.length === 0) return true;
  return bodyLines.every(l => l.trim().match(/^\[.*\]\(.*\)$/));
}

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${API_KEY}`,
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(endpoint, body, retries = 3) {
  await sleep(1000); // rate limit
  const res = await fetch(`${API_URL}/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (res.status === 429 && retries > 0) {
    console.log(" (rate limited, waiting...)");
    await sleep(15000);
    return api(endpoint, body, retries - 1);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${endpoint} failed (${res.status}): ${text.substring(0, 200)}`);
  }
  return (await res.json()).data;
}

async function createCollection(name) {
  const data = await api("collections.create", { name: name.substring(0, 100), permission: "read_write" });
  return data.id;
}

async function createDocument(title, content, collectionId, parentDocumentId) {
  const data = await api("documents.create", {
    title: title.substring(0, 100),
    text: content || " ",
    collectionId,
    parentDocumentId: parentDocumentId || undefined,
    publish: true,
  });
  return data.id;
}

async function importDir(dirPath, collectionId, parentDocId, depth = 0) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const indent = "  ".repeat(depth);

  const folders = [];
  const mdFiles = {};

  for (const entry of entries) {
    if (entry.isDirectory()) {
      folders.push(entry.name);
    } else if (entry.name.endsWith(".md")) {
      const cleanedName = cleanNotionName(path.basename(entry.name, ".md"));
      mdFiles[cleanedName] = path.join(dirPath, entry.name);
    }
  }

  const processedMdNames = new Set();

  for (const folderName of folders.sort((a, b) => a.localeCompare(b))) {
    const cleaned = cleanNotionName(folderName);
    const fullPath = path.join(dirPath, folderName);

    // Check for matching .md with content
    let content = "";
    if (mdFiles[cleaned]) {
      const raw = fs.readFileSync(mdFiles[cleaned], "utf-8");
      if (!isNotionIndexPage(raw)) {
        // Remove the title line (Outline adds it automatically)
        content = raw.replace(/^# .+\n\n?/, "");
      }
      processedMdNames.add(cleaned);
    }

    console.log(`${indent}+ ${cleaned}`);
    const docId = await createDocument(cleaned, content || " ", collectionId, parentDocId);
    await importDir(fullPath, collectionId, docId, depth + 1);
  }

  for (const [cleaned, filePath] of Object.entries(mdFiles)) {
    if (processedMdNames.has(cleaned)) continue;
    const raw = fs.readFileSync(filePath, "utf-8");
    if (!raw.trim() || isNotionIndexPage(raw)) continue;
    const content = raw.replace(/^# .+\n\n?/, "");
    console.log(`${indent}  - ${cleaned}`);
    await createDocument(cleaned, content, collectionId, parentDocId);
  }
}

async function main() {
  const absPath = path.resolve(exportDir);
  console.log(`Import: ${absPath}\n`);

  // Test API
  const collections = await api("collections.list", { limit: 1 });
  console.log(`Connected OK\n`);

  // Each top-level folder = a collection
  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = cleanNotionName(entry.name);
    console.log(`[COLLECTION] ${name}`);
    const collectionId = await createCollection(name);
    await importDir(path.join(absPath, entry.name), collectionId, null, 1);
    console.log("");
  }

  console.log("Done!");
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
