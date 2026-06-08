#!/usr/bin/env node
/**
 * Import Notion export (Markdown) into Alexandrie
 *
 * Roles: 1 = workspace, 2 = category, 0 = document
 * Structure: root folders → workspace, sub-folders → category, .md files → document
 */

const fs = require("fs");
const path = require("path");

const API_URL = process.env.ALEX_API_URL || "https://api-not.aamilou.com/api";
const USERNAME = process.env.ALEX_USERNAME || "";
const PASSWORD = process.env.ALEX_PASSWORD || "";

const exportDir = process.argv[2];

if (!exportDir || !USERNAME || !PASSWORD) {
  console.error("Usage: ALEX_USERNAME=x ALEX_PASSWORD=x node import-notion-to-alexandrie.js <folder>");
  process.exit(1);
}

function cleanNotionName(name) {
  return name.replace(/\s+[0-9a-f]{16,}$/i, "").trim();
}

// Check if .md content is just a Notion index page (only links to sub-pages)
function isNotionIndexPage(content) {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return true;
  // Remove the title line
  const bodyLines = lines.filter((l) => !l.startsWith("# "));
  if (bodyLines.length === 0) return true;
  // If every body line is a markdown link, it's just an index
  const allLinks = bodyLines.every((l) => l.trim().match(/^\[.*\]\(.*\)$/));
  return allLinks;
}

let cookies = "";

async function login() {
  const res = await fetch(`${API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  const setCookies = res.headers.getSetCookie?.() || [];
  cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookies) throw new Error("No cookies received");
  console.log("Logged in\n");
}

async function createNode({ name, parentId, content, role }) {
  const body = { name: name.substring(0, 50), role, accessibility: 1 };
  if (parentId) body.parent_id = parentId;
  if (content) body.content = content;

  const res = await fetch(`${API_URL}/nodes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`  FAILED "${name}" (role=${role}): ${await res.text()}`);
    return null;
  }

  const data = await res.json();
  const node = data.result || data.data || data;
  return node.id || node.Id || null;
}

async function importDir(dirPath, parentId, depth = 0) {
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

  // Process folders as workspaces (depth 0) or categories (depth 1+)
  for (const folderName of folders.sort((a, b) => a.localeCompare(b))) {
    const cleanedFolder = cleanNotionName(folderName);
    const fullPath = path.join(dirPath, folderName);

    // Determine role: root = workspace (1), deeper = category (2)
    const role = depth === 0 ? 1 : 2;
    const roleLabel = role === 1 ? "WS" : "CAT";

    // Check for matching .md with real content
    let folderContent = null;
    if (mdFiles[cleanedFolder]) {
      const raw = fs.readFileSync(mdFiles[cleanedFolder], "utf-8");
      if (!isNotionIndexPage(raw)) {
        folderContent = raw;
      }
      processedMdNames.add(cleanedFolder);
    }

    console.log(`${indent}[${roleLabel}] ${cleanedFolder}`);
    const nodeId = await createNode({ name: cleanedFolder, parentId, content: folderContent, role });
    if (nodeId) {
      await importDir(fullPath, nodeId, depth + 1);
    }
  }

  // Process remaining .md files as documents (role 0)
  for (const [cleanedName, filePath] of Object.entries(mdFiles)) {
    if (processedMdNames.has(cleanedName)) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.trim() || isNotionIndexPage(content)) {
      console.log(`${indent}  [SKIP] ${cleanedName} (index/empty)`);
      continue;
    }

    console.log(`${indent}  [DOC] ${cleanedName}`);
    await createNode({ name: cleanedName, parentId, content, role: 0 });
  }
}

async function main() {
  const absPath = path.resolve(exportDir);
  if (!fs.existsSync(absPath)) {
    console.error(`Not found: ${absPath}`);
    process.exit(1);
  }

  console.log(`Import: ${absPath}\n`);
  await login();
  await importDir(absPath, null, 0);
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
