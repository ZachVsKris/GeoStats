import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript");
} catch {
  const globalPath = path.resolve(path.dirname(process.execPath), "../lib/node_modules/typescript");
  ts = require(globalPath);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["app", "components", "lib"];
const files = [];
for (const relative of roots) {
  const start = path.join(root, relative);
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(full);
    }
  }
}

const failures = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      isolatedModules: true,
    },
  });
  for (const diagnostic of result.diagnostics ?? []) {
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    failures.push(`${path.relative(root, file)}: ${message}`);
  }
}
assert.equal(failures.length, 0, failures.join("\n"));
console.log(`TypeScript/TSX syntax transpilation passed for ${files.length} files.`);
