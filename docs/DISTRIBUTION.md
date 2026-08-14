# Distribution

RGX-Framework publishes one product: the WoW addon framework. Node tooling,
schemas, documentation, references, and future Studio code never belong in its
World of Warcraft addon archive.

## Release Assets

For framework version `X.Y.Z`, the release workflow publishes:

| Asset | Audience | Contents |
|---|---|---|
| BigWigs `RGX-Framework-*.zip` | Players | The only published product archive; uploaded to GitHub and addon services |
| `release.json` | Automation | BigWigs packager release metadata |

The BigWigs ZIP is the distribution-service payload and is built with
`.pkgmeta`. CI independently enforces the exact runtime allowlist and can
reproduce the same package boundary as `RGX-Framework-X.Y.Z.zip` plus an
inventory manifest and checksums. These are verification sidecars, not a second
product.

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

Install the archive by extracting `RGX-Framework/` under the game's
`Interface/AddOns/` directory.

## Source Tooling

Schemas, documentation, reference tools, and the temporary MCP conformance
fixture remain available only in the source repository. Public API, MCP, editor,
and contract-bundle distribution belongs to the future RGX Studio product.

## Checksums

On a POSIX shell:

```bash
sha256sum -c RGX-Framework-X.Y.Z.sha256
```

On PowerShell, compare each value with:

```powershell
Get-FileHash -Algorithm SHA256 .\RGX-Framework-X.Y.Z.zip
```

The JSON manifest also records a SHA-256 digest for every runtime source file.
`sourceDirty` is `false` for release builds; local
builds from an uncommitted worktree record `true` so the base commit is not
mistaken for the exact artifact contents.

## Local Build

From a framework source checkout:

```bash
cd tools/ci
npm ci
npm run package-check
npm run package-build
```

Generated files are written to `artifacts/`. The builder fixes ZIP timestamps,
entry order, permissions, and compression settings, so repeated builds of the
same source revision produce identical bytes. `artifacts/` and `.release/` are
generated directories and are not committed.
