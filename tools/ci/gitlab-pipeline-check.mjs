#!/usr/bin/env node
// Targeted rule/needs regression for the shared include, not a general GitLab
// evaluator. Real MR pipeline creation remains the integration acceptance gate.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const config = load(readFileSync(join(ROOT, ".gitlab/ci/addon.yml"), "utf8"));
function matches(expression, context) {
  switch (expression) {
    case undefined: return true;
    case '$CI_PIPELINE_SOURCE == "merge_request_event"': return context.source === "merge_request_event";
    case '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH': return Boolean(context.branch) && context.branch === "main";
    case '$CI_COMMIT_TAG': return Boolean(context.tag);
    default: throw new Error(`Uncovered shared pipeline rule: ${expression}`);
  }
}
function selected(job, context) {
  // GitLab jobs without rules use except:merge_requests by default.
  if (!job.rules) return context.source !== "merge_request_event";
  for (const rule of job.rules) {
    if (!matches(rule.if, context)) continue;
    if (rule.exists && !context.hasContractTools) continue;
    return rule.when !== "never";
  }
  return false;
}

let checks = 0;
for (const hasContractTools of [true, false]) {
  for (const scenario of [
    { source: "merge_request_event", branch: "", tag: "", contract: true, mirror: false },
    { source: "push", branch: "task/example", tag: "", contract: false, mirror: false },
    { source: "push", branch: "main", tag: "", contract: true, mirror: true },
    { source: "push", branch: "", tag: "v2.7.9", contract: true, mirror: true },
    { source: "web", branch: "task/example", tag: "", contract: false, mirror: false },
  ]) {
    const context = { ...scenario, hasContractTools };
    const jobs = new Set(Object.entries(config)
      .filter(([name, job]) => name.includes(":") && selected(job, context))
      .map(([name]) => name));
    assert(jobs.has("addon:validate"), `${scenario.source}: missing required addon:validate job`);
    assert.equal(jobs.has("contract:bundle"), scenario.contract && hasContractTools);
    assert.equal(jobs.has("mirror:github"), scenario.mirror);
    for (const name of jobs) {
      for (const dependency of config[name].needs ?? []) {
        const required = typeof dependency === "string" ? dependency : dependency.job;
        assert(jobs.has(required), `${name} needs absent job ${required}`);
      }
    }
    checks++;
  }
}
assert.deepEqual(config["contract:bundle"].needs, ["addon:validate"]);
assert.deepEqual(config["mirror:github"].needs, ["addon:validate"]);
for (const command of config["addon:validate"].script) {
  assert(!/\n\s*&&/.test(command), "YAML folding must not put && at the start of a shell line");
}
console.log(`GITLAB PIPELINE RULES OK  ${checks} source/tooling scenarios; required validation preserved`);
