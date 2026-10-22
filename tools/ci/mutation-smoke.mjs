#!/usr/bin/env node
// Dev-only mutation testing for the framework's core systems. NOT a CI gate.
// Mutates one file at a time in a temporary copy of the repository and runs
// that file's matching runtime checks; a mutant dies when any check fails,
// survives when every check still passes (equivalent mutants survive too —
// read survivors as "untested or equivalent", never as definite gaps).
//
// Usage:
//   node tools/ci/mutation-smoke.mjs                              # all targets
//   node tools/ci/mutation-smoke.mjs --file core/systems/runtime.lua
//   node tools/ci/mutation-smoke.mjs --limit 20                   # first N per file
//   node tools/ci/mutation-smoke.mjs --min-kill 70                 # exit 1 below rate
//
// The workspace copies the repository without .git, node_modules,
// .reference, artifacts and graphify-out, and symlinks the real
// tools/ci/node_modules, so checks run against the mutated tree only.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import luaparse from "luaparse";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const TARGETS = {
  // timers-runtime-check exercises the timer BAR library, not this file.
  "core/systems/runtime.lua": ["login-runtime-check", "events-runtime-check", "framework-commands-check"],
  "core/systems/database.lua": ["database-runtime-check", "profile-persistence-check"],
  "core/systems/events.lua": ["events-runtime-check", "login-runtime-check"],
};

const SKIP_COPY = new Set([".git", "node_modules", ".reference", "artifacts", "graphify-out"]);

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : fallback;
}
const onlyFile = arg("file");
const limit = Number(arg("limit", 0)) || Infinity;
const minKill = Number(arg("min-kill", 0)) || 0;

// ── Mutation operators ────────────────────────────────────────────────────────
// Operators run against the line with string literals masked, so mutations
// land in code, not text. Each candidate is validated with luaparse; a mutant
// that no longer parses is discarded rather than counted as a survivor.
const OPERATORS = [
  { name: "== to ~=", pattern: /==/g, replace: "~=" },
  { name: "~= to ==", pattern: /~=/g, replace: "==" },
  { name: "<= to <", pattern: /<=/g, replace: "<" },
  { name: ">= to >", pattern: />=/g, replace: ">" },
  { name: "< to <=", pattern: /(?<![=<>])<(?![<=])/g, replace: "<=" },
  { name: "> to >=", pattern: /(?<![=>])>(?![>=])/g, replace: ">=" },
  { name: "and to or", pattern: /\band\b/g, replace: "or" },
  { name: "or to and", pattern: /\bor\b/g, replace: "and" },
  { name: "drop not", pattern: /\bnot\s+/g, replace: "" },
  { name: "true to false", pattern: /\btrue\b/g, replace: "false" },
  { name: "false to true", pattern: /\bfalse\b/g, replace: "true" },
  { name: "number +1", pattern: /\b\d+\b/g, replace: (m) => String(Number(m) + 1), firstOnly: true },
];

function maskStrings(line) {
  // Same-length masking so match offsets apply to the original line.
  return line.replace(/(["'])((?:\\.|(?!\1).)*?)\1/g, (whole) => "\x01".repeat(whole.length));
}

function mutantsFor(text) {
  const lines = text.split("\n");
  const mutants = [];
  let inLongComment = false;
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber];
    const trimmed = line.trim();
    if (inLongComment) {
      if (trimmed.includes("]]")) inLongComment = false;
      continue;
    }
    if (trimmed.startsWith("--")) {
      // --[[ ... ]] and --[==[ ... ]==] style blocks span lines.
      if (trimmed.startsWith("--[") && !trimmed.includes("]]")) inLongComment = true;
      continue;
    }
    if (trimmed.length === 0) continue;
    const masked = maskStrings(line);
    for (const op of OPERATORS) {
      const regex = new RegExp(op.pattern.source, op.pattern.flags);
      let match;
      let usedFirstOnly = false;
      while ((match = regex.exec(masked)) !== null) {
        if (op.firstOnly) {
          if (usedFirstOnly) break;
          usedFirstOnly = true;
        }
        const start = match.index;
        const end = start + match[0].length;
        const replacement = typeof op.replace === "function" ? op.replace(match[0]) : op.replace;
        if (replacement === match[0]) continue;
        const mutated =
          line.slice(0, start) + replacement + line.slice(end);
        mutants.push({
          lineNumber: lineNumber + 1,
          line: trimmed,
          description: `${match[0]} -> ${replacement} (${op.name})`,
          text: lines.map((l, i) => (i === lineNumber ? mutated : l)).join("\n"),
        });
      }
    }
  }
  return mutants;
}

function parses(text) {
  try {
    luaparse.parse(text, { luaVersion: "5.1" });
    return true;
  } catch {
    return false;
  }
}

// ── Workspace ────────────────────────────────────────────────────────────────
const workspace = mkdtempSync(join(tmpdir(), "rgx-mutation-"));
try {
  cpSync(ROOT, workspace, {
    recursive: true,
    filter: (source) => {
      const rel = relative(ROOT, source);
      if (!rel || rel === ".") return true;
      // Skip excluded names at any depth (tools/ci/node_modules included).
      return !rel.split("/").some((segment) => SKIP_COPY.has(segment));
    },
  });
  const nodeModules = join(ROOT, "tools", "ci", "node_modules");
  if (existsSync(nodeModules)) {
    symlinkSync(nodeModules, join(workspace, "tools", "ci", "node_modules"), "junction");
  }

  const files = onlyFile ? [onlyFile] : Object.keys(TARGETS);
  let totals = { valid: 0, killed: 0, survived: 0 };
  const survivorReport = [];

  for (const file of files) {
    const checks = TARGETS[file];
    if (!checks) {
      console.error(`no mutation target configured for ${file}`);
      process.exit(2);
    }
    const original = readFileSync(join(ROOT, file), "utf8");
    const candidates = mutantsFor(original).slice(0, limit);
    const valid = candidates.filter((m) => parses(m.text));
    let killed = 0;
    console.log(`\n== ${file}: ${valid.length} valid mutants (of ${candidates.length} candidates) ==`);

    const checkOverride = arg("checks");
    const effectiveChecks = checkOverride ? checkOverride.split(",") : checks;
    for (const mutant of valid) {
      const target = join(workspace, file);
      writeFileSync(target, mutant.text);
      let survived = true;
      for (const check of effectiveChecks) {
        const script = join(workspace, "tools", "ci", `${check}.mjs`);
        if (!existsSync(script)) continue;
        const run = spawnSync(process.execPath, [script], { encoding: "utf8" });
        if (process.argv.includes("--debug-line")) {
          const dl = Number(arg("debug-line"));
          if (mutant.lineNumber === dl) {
            console.log("DBGLINE", JSON.stringify({
              check, status: run.status, desc: mutant.description,
              tail: (((run.stdout || "") + (run.stderr || "")).trim().split("\n").pop() || "").slice(0, 140),
            }));
          }
        }
        if (run.status !== 0) {
          survived = false;
          break;
        }
      }
      writeFileSync(target, original);
      if (survived) {
        survivorReport.push({ file, ...mutant });
      } else {
        killed++;
      }
    }

    const survivedCount = valid.length - killed;
    const rate = valid.length ? Math.round((killed / valid.length) * 100) : 0;
    totals.valid += valid.length;
    totals.killed += killed;
    totals.survived += survivedCount;
    console.log(`KILLED ${killed}/${valid.length} (${rate}%)`);
  }

  const overall = totals.valid ? Math.round((totals.killed / totals.valid) * 100) : 0;
  console.log(`\n== OVERALL: killed ${totals.killed}/${totals.valid} (${overall}%), survived ${totals.survived} ==`);
  if (survivorReport.length) {
    console.log("\nSurviving mutants (untested or equivalent):");
    for (const s of survivorReport) {
      console.log(`  ${s.file}:${s.lineNumber}  [${s.description}]  ${s.line.slice(0, 100)}`);
    }
  }
  if (minKill && overall < minKill) {
    console.error(`\nMUTATION SMOKE BELOW TARGET: ${overall}% < ${minKill}%`);
    process.exit(1);
  }
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
