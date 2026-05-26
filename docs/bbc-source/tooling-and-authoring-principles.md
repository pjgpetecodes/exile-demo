# Tooling and authoring principles for later mechanics work

## Purpose

This note complements the other BBC-source research by focusing on the **modern support layer** that should stay intact while later adding BBC-inspired mechanics. The target is not only “mechanic parity”; it is a workflow where mechanics remain easy to author, inspect, tune, and regression-check through the current TypeScript tooling.

This should be read alongside:

- `docs\bbc-source\core-movement-fidelity.md`
- `docs\bbc-source\world-systems-fidelity.md`
- `docs\bbc-source\world-systems-and-collectables.md`
- `docs\bbc-source\creature-ecology-and-behavior.md`
- `docs\bbc-source\resources-and-progression-fidelity.md`

## Core principle

Later BBC-inspired work should preserve **modern clarity around authoring and debugging**, even when the game itself becomes more systemic, stateful, and simulation-heavy. The BBC original achieved depth partly through opaque shared state; this project should preserve the depth while keeping the current strengths: typed save data, editor-visible settings, preview toggles, runtime overlays, and data-driven content definitions.

## Source anchors

- The world designer already defines typed save data for buttons, doors, collectables, and full raw world snapshots, then serializes those structures back to JSON in a stable way (`astronaut-game\src\world-designer.ts:22-90`, `astronaut-game\src\world-designer.ts:768-820`).
- The designer already persists working UI state such as camera, collision/creature overlays, sound, magnifier, and expanded viewport, which is exactly the kind of support later mechanics tuning will need (`astronaut-game\src\world-designer.ts:442-477`, `astronaut-game\src\world-designer.ts:2350-2405`).
- The current preview controls already cover window-filling viewport expansion, collision outlines, creature overlays, sprite outlines, per-layer visibility, and preview-mode collision suppression (`astronaut-game\src\world-designer.ts:2546-2565`, `astronaut-game\src\world-designer.ts:9188-9224`, `astronaut-game\src\world-designer.ts:10078-10212`).
- The designer already exposes typed inspectors for creature and collectable behavior instead of forcing raw JSON as the main workflow (`astronaut-game\src\world-designer.ts:9000-9127`, `astronaut-game\src\creature.ts:111-172`, `astronaut-game\src\collectable.ts:27-147`).
- The runtime already supports modern debugging and inspection hooks through debug overlays, debug text, sprite-outline toggles, teleport-memory UX, and a small `__exileDebug` surface (`astronaut-game\src\game.ts:529-553`, `astronaut-game\src\game.ts:1352-1383`, `astronaut-game\src\game.ts:1475-1479`, `astronaut-game\src\game.ts:1678-1705`, `astronaut-game\src\game.ts:4260-4267`).
- Shared types already express mechanic-facing authored state explicitly for creatures, projectile behavior, sound settings, and palette cycling (`astronaut-game\src\types\index.ts:1-105`).
- The designer already supports preset-style content workflows around palette remaps and PNG chunk import/export, which is a useful precedent for future mechanic authoring presets (`astronaut-game\src\world-designer.ts:3180-3200`, `astronaut-game\src\world-designer.ts:6720-6760`, `astronaut-game\src\world-designer.ts:6884-6913`).

## Why tooling matters for BBC-inspired mechanics

The other BBC-source notes point toward more of the following:

- momentum-sensitive movement
- burden and impairment states
- systemic hazard/immunity rules
- ecology relationships
- multi-step world interactions
- persistent progression state

Those mechanics become hard to maintain if they are implemented only as hidden runtime branches in `game.ts`. The modern project is strongest when mechanic state is:

1. **typed**
2. **authorable**
3. **inspectable**
4. **previewable**
5. **persisted in readable data**

That is the support model to keep.

## Principles to preserve and extend

### 1. Preserve fullscreen-style authoring support

The current designer already has an **Expand viewport to window** toggle and keyboard shortcut path via `Alt+Enter`, which makes large-world inspection and placement much easier than a fixed embedded canvas (`astronaut-game\src\world-designer.ts:2550`, `astronaut-game\src\world-designer.ts:9197-9224`, `astronaut-game\src\game.ts:542-548`).

Later mechanics work should treat this as essential support, not a cosmetic option. Mechanics inspired by classic *Exile* often depend on:

- long movement arcs
- offscreen creature staging
- large mechanism chains
- hazard fields and transport routes

### Later recommendation

- Keep the current expanded viewport workflow as the baseline mechanic-debug view.
- If later systems add near-screen/offscreen behavior, expose those ranges in expanded view first.
- Prefer additional mechanic visualization layers over shrinking the play view or hiding context in modal inspectors.

### 2. Keep the world designer as the primary authoring surface

The strongest modernization already in place is that runtime content is authored through `world-designer.ts` and not through opaque hand-edited blobs. Buttons, doors, creatures, collectables, palette variants, and world snapshots already have explicit save shapes and inspector paths (`astronaut-game\src\world-designer.ts:22-90`, `astronaut-game\src\world-designer.ts:9067-9127`).

That should remain true for later BBC-inspired mechanics. New mechanics should enter the project as designer-visible authored fields or authored tables, not as “special objects that only code knows how to interpret.”

### Later recommendation

- Add new mechanic knobs to typed designer data before adding one-off runtime conditionals.
- Prefer explicit inspector controls for common mechanic settings, with raw JSON only as an escape hatch.
- Keep conversion/authoring flows readable enough that a world designer can set up a mechanic without opening `game.ts`.

### 3. Treat typed save data as the source of truth

The current code already does the right thing structurally: authored world data is converted into typed runtime entities, and the designer serializes normalized shapes back to JSON (`astronaut-game\src\world-designer.ts:761-820`, `astronaut-game\src\game.ts:586-618`, `astronaut-game\src\creature.ts:111-172`, `astronaut-game\src\collectable.ts:27-147`).

That pattern is especially important for later fidelity work because BBC-inspired mechanics tend to accumulate state quickly.

### Later recommendation

- Extend save schemas with explicit mechanic fields rather than burying mechanic state inside ad hoc `state` blobs whenever a field is broadly useful.
- Keep runtime-only transient state separate from authored/persisted state.
- Make sure any new persistent mechanic can round-trip cleanly through designer -> JSON -> runtime -> designer.

## Specific support areas to preserve

### Fullscreen / expanded viewport support

Mechanics that depend on traversal, pursuit, transport, or multi-room causality need room to inspect:

- movement envelopes
- mechanism chains
- teleport entry/exit relationships
- offscreen creature wake ranges
- large hazard layouts

The current expanded viewport path already solves part of that. Later work should extend it with mechanic-specific overlays rather than replacing it with more hidden internal state.

### Typed save data

`ButtonSaveData`, `DoorSaveData`, `CollectableSaveData`, `CreatureSaveData`, and the shared types in `types\index.ts` are already the correct shape of modernization: explicit, inspectable, and versionable. That is the right place for mechanic growth.

Examples of later mechanic data that should stay typed:

- impairment/daze configuration
- hazard-response tags
- trigger filters and thresholds
- ecology relationship tags
- teleport restrictions
- conversion/reaction definitions
- progression/capability flags

### Presets

The project already has useful precedent for preset-driven workflows through palette tooling and PNG chunk import/export presets (`astronaut-game\src\world-designer.ts:6887-6913`). BBC-inspired mechanics work should extend that idea.

### Later recommendation

Add presets for repeated mechanic authoring tasks, for example:

- creature behavior presets for patrol / ambush / turret / scavenger roles
- collectable presets for hazard, carried-resource, immunity, explosive, or reward items
- trigger presets for weight-activated, projectile-activated, or timed mechanisms
- mechanic test-room presets for common debugging layouts

The goal is to reduce “field soup” in the inspector and make systemic content reproducible.

### Overlays and debug aids

The current project already has:

- collision outlines
- sprite outlines
- creature overlays
- debug text mode
- layer visibility toggles
- magnifier support
- preview-collision disable mode
- small debug hooks on `window.__exileDebug` (`astronaut-game\src\world-designer.ts:2549-2565`, `astronaut-game\src\game.ts:529-553`, `astronaut-game\src\game.ts:1678-1705`, `astronaut-game\src\game.ts:4260-4267`)

That is an excellent base. Mechanics work should add more of this style, not less.

### Later recommendation

Expose mechanic overlays for things like:

- trigger volumes and trigger-source matches
- active mechanism links and timers
- current burden / impairment / mobility modifiers
- creature target / prey / habitat state
- hazard material tags and immunity matches
- teleport destinations, restrictions, and recall slots
- transformation candidates and failed-rule reasons

The best debugging overlay is one that explains *why* a mechanic did or did not fire.

### Data-driven workflows

The existing designer/import/export path already favors reusable data transformations over manual code editing. That principle should stay central for mechanics work.

### Later recommendation

- Prefer rule tables, typed config objects, and authored definitions over hardcoded object-ID conditionals.
- Keep content import/export compatible with future mechanic metadata instead of making mechanics editor-only state.
- Preserve stable serialization so mechanic-heavy diffs stay reviewable.

## Practical guardrails for later mechanics work

1. **Do not bypass the designer for common mechanic setup.** If a mechanic is meant to appear in multiple places, it should become authorable.
2. **Do not hide meaningful state only in runtime booleans.** If designers or testers need to reason about it, expose it.
3. **Do not collapse everything into one generic JSON blob.** Keep common mechanic concepts typed.
4. **Do not sacrifice current modern affordances for “authentic” opacity.** Preserve convenience such as teleport memory, expanded view, and live overlays even when BBC-inspired constraints are added elsewhere.
5. **Do add mechanic-specific presets, overlays, and inspectors early.** Tooling should land with the mechanic, not after it becomes hard to debug.

## Recommended later authoring/debug additions

When later mechanics work starts, the following support additions would give the best return without changing the core modernization strategy:

1. A mechanic overlay menu grouped by system: movement, hazards, creatures, teleports, triggers, persistence.
2. Preset packs for common authored mechanic roles instead of repeated manual field entry.
3. A visible runtime inspector for the currently selected entity's authored state vs transient state.
4. A small event log for “why this rule fired” or “why this interaction was rejected.”
5. Data validators that flag incomplete mechanic definitions before save.

## Bottom line

The BBC source should influence later mechanics, but the current project's editor/debug infrastructure should influence **how those mechanics are built**. Expanded viewport support, typed save data, presets, overlays, inspectors, and data-driven serialization are not side features; they are the modernization layer that keeps BBC-inspired systems understandable and sustainable in this codebase.
