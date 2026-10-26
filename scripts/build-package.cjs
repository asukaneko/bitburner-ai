"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const tool = path.join(root, "package", "Bitburner-AI-Patch");
const payload = path.join(tool, "payload");
const app = path.join(payload, "resources", "app");
const manifestPath = path.join(tool, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const previous = new Map(manifest.files.map(entry => [entry.path, entry]));
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
for (const name of ["main.cjs", "provider.cjs", "sessions.cjs"]) copy(path.join(root, "src", name), path.join(app, "bb-ai", name));
for (const name of ["integration.js", "agent.js", "assistant.js"]) copy(path.join(root, "src", name), path.join(app, "dist", "bb-ai", name));
copy(path.join(root, "node_modules", "marked", "lib", "marked.umd.js"), path.join(app, "dist", "bb-ai", "vendor", "marked.umd.js"));
copy(path.join(root, "node_modules", "dompurify", "dist", "purify.min.js"), path.join(app, "dist", "bb-ai", "vendor", "purify.min.js"));
for (const name of ["marked", "dompurify"]) copy(path.join(root, "node_modules", name, "LICENSE"), path.join(tool, "third-party-licenses", name + "-LICENSE.txt"));
copy(path.join(root, "node_modules", "dompurify", "LICENSE-MPL"), path.join(tool, "third-party-licenses", "dompurify-LICENSE-MPL.txt"));

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  });
}
manifest.files = files(payload).sort().map(file => {
  const relative = path.relative(payload, file).split(path.sep).join("/");
  const old = previous.get(relative);
  const sha256 = hash(file);
  const previousSha256 = new Set(old?.previousSha256 || []);
  if (old && old.sha256 !== sha256) previousSha256.add(old.sha256);
  return { path: relative, sha256, originalSha256: old?.originalSha256 ?? null, previousSha256: [...previousSha256] };
});
manifest.source = pkg.repository.url;
manifest.commit = "v" + pkg.version;
manifest.dependencies = Object.fromEntries(["marked", "dompurify"].map(name => [name, JSON.parse(fs.readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8")).version]));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Prepared ${manifest.files.length} files for Bitburner ${manifest.gameVersion}, assistant ${pkg.version}.`);
