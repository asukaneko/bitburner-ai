const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

test("distributable checksums, source copies and script references match", () => {
  const root = path.resolve(__dirname, "..");
  const tool = path.join(root, "package", "Bitburner-AI-Patch");
  const payload = path.join(tool, "payload");
  const manifest = JSON.parse(fs.readFileSync(path.join(tool, "manifest.json"), "utf8"));
  for (const entry of manifest.files) {
    const file = path.resolve(payload, entry.path);
    assert.ok(file.startsWith(payload + path.sep));
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"), entry.sha256, entry.path);
  }
  for (const name of ["main.cjs", "provider.cjs", "sessions.cjs", "agent.js", "integration.js", "assistant.js"]) {
    const target = name.endsWith(".cjs") ? path.join(payload, "resources", "app", "bb-ai", name) : path.join(payload, "resources", "app", "dist", "bb-ai", name);
    assert.deepEqual(fs.readFileSync(target), fs.readFileSync(path.join(root, "src", name)), name);
  }
  const html = fs.readFileSync(path.join(payload, "resources", "app", "index.html"), "utf8");
  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    if (match[1].startsWith("dist/bb-ai/")) assert.ok(fs.existsSync(path.join(payload, "resources", "app", match[1])), match[1]);
  }
});
