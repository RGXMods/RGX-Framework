# Distribution

RGX-Framework publishes one product: the WoW addon framework. Node tooling,
schemas, documentation, references, and future Studio code never belong in the
World of Warcraft addon archive.

## Current Release

[`v2.7.4`](https://github.com/DonnieDice/RGX-Framework/releases/tag/v2.7.4)
publishes exactly two GitHub assets:

| Asset | Purpose |
|---|---|
| `RGX-Framework-v2.7.4.zip` | The only product archive; install this addon |
| `release.json` | BigWigs packager metadata for automation |

The inspected `v2.7.4` ZIP contains one `RGX-Framework/` root and exactly 100
runtime files. GitHub records the digest on the release asset. To query it with
GitHub CLI:

```bash
gh release view v2.7.4 --repo DonnieDice/RGX-Framework --json assets \
  --jq '.assets[] | select(.name == "RGX-Framework-v2.7.4.zip") | .digest'
```

CurseForge is the currently configured addon service. Wago and WoWInterface are
skipped unless their project IDs and secrets are added to the release pipeline.

## Flavor Metadata

All flavor TOCs ship together and declare the same framework version:

| Client | TOC | Interface |
|---|---|---:|
| Retail | `RGX-Framework.toc` | `120100` |
| Classic Era | `RGX-Framework_Vanilla.toc` | `11509` |
| TBC Classic | `RGX-Framework_TBC.toc` | `20506` |
| Wrath/Titan | `RGX-Framework_Wrath.toc` | `38002` |
| Cataclysm | `RGX-Framework_Cata.toc` | `40402` |
| Mists Classic | `RGX-Framework_Mists.toc` | `50504` |

## Player Allowlist

The player archive has one top-level `RGX-Framework/` directory and only:

```text
RGX-Framework.toc
RGX-Framework_Vanilla.toc
RGX-Framework_TBC.toc
RGX-Framework_Wrath.toc
RGX-Framework_Cata.toc
RGX-Framework_Mists.toc
RGX-Framework.xml
LICENSE.txt
core/**/*.lua
modules/**/*.lua
media/logo.tga
media/fonts/*.ttf
media/fonts/*.otf
media/fonts/README.md
```

It rejects JavaScript, TypeScript, JSON, Rust, Tauri, `node_modules`, `tools/`,
`schemas/`, `docs/`, `.reference/`, and other non-runtime paths. Every Lua/XML
load reference must exist in the inspected ZIP.

## Installation

Extract the archive so the game sees:

```text
World of Warcraft/<client>/Interface/AddOns/RGX-Framework/RGX-Framework.toc
```

Consumer addons declare `## RequiredDeps: RGX-Framework`. Do not copy source
repository folders such as `tools/`, `schemas/`, or `docs/` into AddOns.

## Source-Only Tooling

Schemas, documentation, reference tools, and the temporary MCP conformance
fixture remain available only in the source repository. Public API, MCP, editor,
and contract-bundle distribution belongs to the future RGX Studio product.

## Local Verification

From a framework source checkout:

```bash
cd tools/ci
npm ci
npm run package-check
npm run package-build
```

Generated files are written to `artifacts/`:

```text
RGX-Framework-X.Y.Z.zip
RGX-Framework-X.Y.Z.manifest.json
RGX-Framework-X.Y.Z.sha256
```

These are local/CI verification outputs, not GitHub release assets or a second
product. The builder fixes ZIP timestamps, entry order, permissions, and
compression settings. The manifest records every runtime source digest, source
revision, and `sourceDirty` state. `artifacts/` and `.release/` are generated and
ignored by Git.

## Addon-Service Description

`docs/description.html` is the canonical addon-service description source. The
release workflow packages and uploads the addon but does not update service-page
HTML. Description changes must be applied to the configured service separately
and verified against this file; the GitHub Wiki is generated automatically from
the Markdown pages listed in `tools/wiki/manifest.json`.
