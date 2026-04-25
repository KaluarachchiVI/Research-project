/**
 * Export Cursor agent transcripts to Markdown files.
 * Run from project root: node scripts/export-chats-to-markdown.js
 * Output: exported-chats/*.md (one file per main chat, readable in any editor/window)
 */

const fs = require("fs");
const path = require("path");

const TRANSCRIPTS_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME,
  ".cursor",
  "projects",
  "c-Users-ASUS-TUF-Desktop-Research-project",
  "agent-transcripts"
);
const OUT_DIR = path.join(__dirname, "..", "exported-chats");

function extractText(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c && c.type === "text" && c.text)
    .map((c) => c.text.trim())
    .join("\n\n");
}

function exportOneTranscript(jsonlPath) {
  const name = path.basename(path.dirname(jsonlPath));
  const raw = fs.readFileSync(jsonlPath, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim());
  const blocks = [];

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const role = obj.role;
      const text = extractText(obj.message?.content || []);
      if (!text) continue;
      const label = role === "user" ? "**You**" : "**Assistant**";
      blocks.push(`${label}\n\n${text}`);
    } catch (_) {
      // skip malformed lines
    }
  }

  if (blocks.length === 0) return null;
  const md = `# Chat: ${name}\n\n${blocks.join("\n\n---\n\n")}\n`;
  return { name, md };
}

function main() {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    console.error("Transcripts dir not found:", TRANSCRIPTS_DIR);
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const dirs = fs.readdirSync(TRANSCRIPTS_DIR, { withFileTypes: true });
  let count = 0;

  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const chatDir = path.join(TRANSCRIPTS_DIR, d.name);
    const jsonlFile = path.join(chatDir, `${d.name}.jsonl`);
    if (!fs.existsSync(jsonlFile)) continue; // skip subagent folders that have different structure
    const result = exportOneTranscript(jsonlFile);
    if (!result) continue;
    const outPath = path.join(OUT_DIR, `${result.name}.md`);
    fs.writeFileSync(outPath, result.md, "utf8");
    console.log("Exported:", result.name);
    count++;
  }

  console.log("\nDone. Exported", count, "chats to:", OUT_DIR);
}

main();
