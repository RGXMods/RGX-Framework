#!/usr/bin/env node
// Negative conformance for the capability registry gate: malformed implementation
// claims, matrix/status/evidence errors and broken dependency sequencing must fail.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CHECK = join(ROOT, "tools/ci/capability-registry-check.mjs");
const plan = JSON.parse(readFileSync(join(ROOT, "contract/capability-plan.json"), "utf8"));
const domain = JSON.parse(readFileSync(join(ROOT, "contract/domain-research.json"), "utf8"));
const api = JSON.parse(readFileSync(join(ROOT, "contract/schemas/rgx-api.catalog.json"), "utf8"));
const registry = join(ROOT, "contract/schemas/rgx-capability.registry.json");
const temp = mkdtempSync(join(tmpdir(), "rgx-capability-fixtures-"));
const clone = (value) => JSON.parse(JSON.stringify(value));

function run(name, mutate, expected) {
  const candidatePlan = clone(plan);
  const candidateDomain = clone(domain);
  mutate(candidatePlan, candidateDomain);
  const planPath = join(temp, `${name}.json`);
  const domainPath = join(temp, `${name}-domain.json`);
  writeFileSync(planPath, JSON.stringify(candidatePlan));
  writeFileSync(domainPath, JSON.stringify(candidateDomain));
  const result = spawnSync(process.execPath, [CHECK], {
    cwd: ROOT,
    env: {
      ...process.env,
      RGX_CAPABILITY_PLAN: planPath,
      RGX_DOMAIN_RESEARCH: domainPath,
      RGX_API_CATALOG: join(ROOT, "contract/schemas/rgx-api.catalog.json"),
      RGX_CAPABILITY_REGISTRY_OUT: registry,
    },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0 || !output.includes(expected)) {
    console.error(`FAIL ${name}: expected rejection containing ${expected}\n${output}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}: rejected with ${expected}`);
}

try {
  const basePlan = join(temp, "base.json");
  const baseDomain = join(temp, "base-domain.json");
  writeFileSync(basePlan, JSON.stringify(plan));
  writeFileSync(baseDomain, JSON.stringify(domain));
  const base = spawnSync(process.execPath, [CHECK], {
    cwd: ROOT,
    env: {
      ...process.env,
      RGX_CAPABILITY_PLAN: basePlan,
      RGX_DOMAIN_RESEARCH: baseDomain,
      RGX_API_CATALOG: join(ROOT, "contract/schemas/rgx-api.catalog.json"),
      RGX_CAPABILITY_REGISTRY_OUT: registry,
    },
    encoding: "utf8",
  });
  if (base.status !== 0) {
    console.error(`base registry fixture failed:\n${base.stdout}\n${base.stderr}`);
    process.exit(1);
  }

  run("fake-implementation", (candidate) => {
    candidate.candidates.push({
      id: "test.fake",
      name: "Fake implementation",
      classification: "Library",
      owner: "libraries/does-not-exist.lua",
      purpose: "Prove implementation claims require real owners and tests",
      status: "Implemented",
      publicContract: "Fake()",
    });
  }, "implementation claim has no test coverage");

  run("missing-owner", (candidate) => {
    candidate.candidates.push({
      id: "test.missing-owner",
      name: "Missing owner with coverage",
      classification: "Library",
      owner: "libraries/does-not-exist.lua",
      purpose: "Prove a partial implementation cannot point at a nonexistent owner",
      status: "Partially implemented",
      clientSupport: { assessment: "declared-matrix", validation: "fixture only" },
      testCoverage: ["Independent owner-existence fixture"],
    });
  }, "implemented owner does not exist");

  run("unknown-matrix-id", (candidate) => {
    candidate.replacementMatrix[0].capabilityId = "missing.capability";
  }, "unknown capability missing.capability");

  run("invalid-matrix-status", (candidate) => {
    candidate.replacementMatrix[0].status = "Shipped";
  }, "invalid status Shipped");

  run("bad-evidence", (_, candidateDomain) => {
    candidateDomain[0].apiEvidence[0] = "forever-ui:NotAFile.lua:not-a-line";
  }, "malformed or unowned evidence");

  run("missing-sequence-prerequisite", (candidate) => {
    candidate.implementationSequence = candidate.implementationSequence.filter((step) => step.capabilityId !== "library.serialization");
  }, "prerequisite library.serialization is missing from the implementation sequence");

  if (!process.exitCode) console.log("CAPABILITY REGISTRY FIXTURES OK (6 rejection paths plus valid baseline)");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
