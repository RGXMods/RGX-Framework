# Published compatibility verification — 2.7.12

## Status

Publication is verified. Working behavior across every published dependent
addon and live client is **not verified**. This report is evidence inventory,
not a release approval. Canonical follow-up: GitLab Framework #45.

## Published artifact and workflow

- Tag `v2.7.12`: `91af119dc4d50edc5b0a166aa4adc2622d4b91dc`.
- GitHub release run `37114456144` uploaded the providers, then failed its
  post-upload check: expected six flavor rows/entries, received seven.
- Corrected checker merged in `e6a89cf`; that change is not in the immutable
  release tag. Re-running the old tag does not pick up the correction.
- Fresh downloaded ZIP and `release.json` pass the current package inventory
  (108 runtime files) and metadata (seven flavor entries) checks.
- Local uncommitted test installs are not replacements for published assets.

## Cumulative source scope

`git diff --stat v2.7.9..v2.7.12` reports 108 changed tracked files, including
tooling/docs; not all are player runtime changes. Important runtime boundaries
include database adoption/defaults, compatibility-first load order, locales,
aura access, controls, layout, headers, and module metadata.

The font-file split already exists at `v2.7.9`. In this exact range, only
`modules/fonts/init.lua` changes in that directory: registry metadata adds its
library category and dropdown dependency. This does not prove the older font
implementation is correct; it identifies the correct audit baseline.

Locales are new in this range. `RGX-Framework.xml` loads locale/overrides before
string-consuming modules. Language rendering/fallback still needs actual
client evidence. TOC inventory/Interfaces passing does not prove gameplay
capabilities or UI behavior on every flavor.

## Dropdown evidence

- Retail dump: 12.1.0, `live@36dd01db2d8f`,
  `Resources/FrameXML.lua:4569` lists `UIDropDownMenu_Initialize`;
  line 2825 lists `MenuUtil.CreateContextMenu`.
- Retail confirmation source: 12.1.0.69404, `live` commit
  `81d15e42f16f3473131880500e7a8c8eb88fa5e6`.
  `Blizzard_SharedXML/Mainline/UIDropDownMenu.lua:77` defines the initializer,
  line 1049 defines `ToggleDropDownMenu`; `UIDropDownMenuTemplates.xml:146`
  defines the legacy template. `Blizzard_Menu/MenuUtil.lua` implements the
  modern context-menu API at that same commit.
- Thus complete hard-removal is not established for this target. Inventory
  and source presence do not establish safe use beside protected UI.
- The published module already prefers modern selection dropdowns and uses
  `MenuUtil.CreateContextMenu`. Legacy runtime wrappers are capability-specific
  helpers; they are not translations of legacy initializer callbacks into
  modern menu descriptions.
- A real-source regression did expose a pre-existing gap: context-menu
  availability depended on probing a selection-dropdown template it never
  uses. The local fix gates context menus only on their actual modern API.
  A second check rejects a partial legacy API lacking `ToggleDropDownMenu`.
- Legacy paths remain for clients that support them. No wholesale deletion or
  API-semantic substitution is justified by the evidence above.

## Resize evidence

Forever 1.60.1.70170 source, commit
`9a789c074b8e73c5d604ef2d6af3bb5b3aefb348`, generated
`SimpleFrameAPIDocumentation.lua:1445–1455` documents
`SetResizeBounds(minWidth, minHeight, maxWidth, maxHeight)`.
The five synced flavor widget inventories all list this setter.

The reported book crash is reproduced by running real consumer `EnsureFrame`
with only that supported setter. Local correction uses the framework adapter
when present, otherwise the supported native setter for already-published
framework versions. The exact 640×420 to 1400×1000 bounds are retained.

## Remaining live-client gates

For each actual published dependent product/flavor, record its release tag,
TOC/dependency, loaded module inventory and tested framework artifact hash.
Then verify startup, saved-settings restoration/reset, dropdown opening and
selection, font preview/application, scrolling/resize/show/hide, and any
combat/restricted paths that product actually uses. Record client build and
results individually. Headless fixtures or a release upload cannot satisfy
these gates, and a beta-only consumer does not prove a live product works.
