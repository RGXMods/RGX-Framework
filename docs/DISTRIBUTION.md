# Distribution

RGX-Framework publishes separate player and contract SDK artifacts. Node tooling,
schemas, documentation, references, and future Studio code never belong in the
World of Warcraft addon archive.

## Release Assets

For framework version `X.Y.Z`, the release workflow publishes:

| Asset | Audience | Contents |
|---|---|---|
| BigWigs `RGX-Framework-*.zip` | Players | The upload sent to CurseForge and other addon services |
| `RGX-Framework-runtime-X.Y.Z.zip` | Players and package verification | Canonical deterministic player archive |
| `RGX-Developer-X.Y.Z.zip` | Addon and Studio tooling authors | Data-only contract SDK: canonical schema/docs, Studio roadmap, provenance, inventory, and license. No MCP or executable tooling. |
| `RGX-Artifacts-X.Y.Z.json` | Automation | Version, Interface, source revision, file inventory, sizes, and SHA-256 hashes |
| `RGX-Artifacts-X.Y.Z.sha256` | Everyone | SHA-256 checksums for the two canonical ZIPs and JSON manifest |

The BigWigs ZIP is the distribution-service payload. CI builds it with the
same `.pkgmeta` used by releases and inspects the actual archive before release.
The deterministic runtime ZIP provides a stable independently verifiable copy
of the same player allowlist.

## Player Allowlist

The player archive has one top-level `RGX-Framework/` directory and only:

```text
RGX-Framework.toc
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

Install the runtime ZIP by extracting `RGX-Framework/` under the game's
`Interface/AddOns/` directory. Do not place `RGX-Developer/` there.

## Contract SDK Artifact

`RGX-Developer-X.Y.Z.zip` retains its filename for release compatibility, but
its role is a data-only contract SDK. It contains no Node entrypoint, MCP server,
`.mcp.json`, tests, or executable transport. Tools consume the canonical schema
and documentation directly from this artifact.

The current `tools/rgx-mcp/` remains in the framework source checkout only as a
temporary contract-conformance fixture used by CI. Public API/MCP/editor tooling
belongs to RGX Studio after production gate #30. RGX-Framework remains the
authoritative producer of runtime semantics and versioned contract data.

## Checksums

On a POSIX shell:

```bash
sha256sum -c RGX-Artifacts-X.Y.Z.sha256
```

On PowerShell, compare each value with:

```powershell
Get-FileHash -Algorithm SHA256 .\RGX-Developer-X.Y.Z.zip
```

The JSON manifest also records a SHA-256 digest for every canonical source file
inside each artifact. `sourceDirty` is `false` for release artifacts; local
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
