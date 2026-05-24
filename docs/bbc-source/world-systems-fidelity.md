# BBC Micro Exile: world-systems fidelity roadmap

## Purpose

This synthesis turns the earlier research in [world-systems-and-collectables.md](world-systems-and-collectables.md) and [unified-world-physics.md](unified-world-physics.md) into a practical later roadmap for modern Exile-style world interactions. The target is not literal BBC parity; it is a modern, typed, authorable mechanism layer that preserves Exile's “world of interacting systems” identity (`original_source.asm:994-1076`, `original_source.asm:11980-12652`, `astronaut-game\src\game.ts:586-618`, `astronaut-game\src\world-designer.ts:22-90`).

## Core fidelity thesis

The BBC original treats switches, doors, teleports, collectables, hazards, and conversion chains as one systemic layer instead of separate puzzle widgets or inventory scripts. The modern project already has a strong foundation for that idea through typed save data, runtime button/door classes, collectable runtime state, and designer inspectors; the later job is to connect those pieces with more explicit authored rules instead of piling on one-off logic (`original_source.asm:404-533`, `original_source.asm:994-1076`, `astronaut-game\src\button.ts:15-139`, `astronaut-game\src\door.ts:3-144`, `astronaut-game\src\collectable.ts:27-147`, `astronaut-game\src\world-designer.ts:768-797`, `astronaut-game\src\world-designer.ts:9067-9127`).

## What should be preserved

### Switches and doors are world mechanisms

BBC switches trigger from qualifying object contact, not just explicit player use, and dispatch through a switch-effects table. BBC doors also react to pressure/beam state, carry lock/open bits, and share timing state through `door_timer` (`original_source.asm:1023-1024`, `original_source.asm:11980-12061`, `original_source.asm:12451-12597`).

That mechanism-first framing is the important part to preserve. In the current TypeScript project, buttons already own linked-door references and state, while doors already own lock/open/animation state and runtime presentation (`astronaut-game\src\button.ts:23-139`, `astronaut-game\src\door.ts:12-144`). `game.ts` currently toggles linked doors from astronaut contact and opens unlocked horizontal doors on overlap, which is a good modern starting point but still narrower than BBC-style systemic triggering (`astronaut-game\src\game.ts:1607-1639`).

### Teleports are both player affordances and world objects

The BBC source has both player recall teleporting and world teleport beams. Player teleport recall is constrained by state such as “not holding anything,” and beam teleports are authored destinations that can teleport touched objects and be toggled on/off (`original_source.asm:1038-1048`, `original_source.asm:1801-1833`, `original_source.asm:12604-12652`).

The modern game already has a cleaner recall UX: the player can save up to six locations and recall them later from `game.ts` (`astronaut-game\src\game.ts:1352-1383`). Preserve that convenience. The BBC behavior worth carrying forward is the existence of authored world teleports as reusable mechanisms, not the old UI friction.

### Transformation chains are progression content

The BBC original repeatedly uses object-to-object conversion rules:

- mushroom ball + fireball -> coronium crystal (`original_source.asm:11535-11555`)
- red drop + yellow ball -> coronium boulder (`original_source.asm:11699-11724`)
- disturbed full flask near fire -> empty flask after consuming the hazard (`original_source.asm:11076-11107`)

Those rules matter because they turn “collectables” into a world-chemistry layer. The current project already supports loose objects with type, weight, held/stored state, projectile payload state, and grenade/explosion metadata (`astronaut-game\src\collectable.ts:27-147`). Later fidelity work should preserve the chain-reaction structure while expressing it through explicit authored reaction rules.

### Hazards are interesting when paired with capability state

BBC Exile couples hazard behavior to persistent immunity and material state: mushroom contact raises daze unless immunity has been collected, fire checks fire immunity before damaging the player, and coronium is simultaneously cargo, hazard, and explosion material unless radiation protection or water cancels its threat (`original_source.asm:1013-1022`, `original_source.asm:1025-1028`, `original_source.asm:10471-10499`, `original_source.asm:10756-10801`, `original_source.asm:12195-12219`).

That pairing is more important than copying any single hazard. Preserve the pattern of “danger + persistent countermeasure + material-specific reaction.”

### Persistence should remain world-stateful

The BBC persistent bytes track keys, weapons, suit/immunity flags, mushroom daze, teleports used, pocket contents, door timing, and weapon energy as long-lived world state (`original_source.asm:994-1076`). The current project already serializes button, door, and collectable state through typed save data and rehydrates runtime entities from those assets (`astronaut-game\src\game.ts:586-618`, `astronaut-game\src\world-designer.ts:22-90`, `astronaut-game\src\world-designer.ts:768-805`).

That is the correct modernization path: preserve persistent capability/world-state changes, but express them as readable authored data instead of opaque bytes.

## What should be modernized

### Preserve the structure, not the BBC encoding

Do **not** recreate bit-packed handler flags or hidden global bytes directly. The modern layer should keep explicit fields, typed save data, and inspectable runtime state (`astronaut-game\src\world-designer.ts:22-90`, `astronaut-game\src\collectable.ts:60-95`, `astronaut-game\src\button.ts:43-63`, `astronaut-game\src\door.ts:22-40`).

### Preserve modern UX

The current inventory and teleport affordances are strengths: the player can hold, store, cycle, arm, release, and throw loose items; designer tooling can also author and inspect that state directly (`astronaut-game\src\game.ts:3705-3811`, `astronaut-game\src\world-designer.ts:9067-9127`). Later fidelity work should add more world interactions without making basic control/inspection opaque again.

### Prefer authored systems over hardcoded scene scripts

Current button/door links, collectable persistence, and designer inspectors already point in the right direction (`astronaut-game\src\button.ts:25-27`, `astronaut-game\src\door.ts:11-20`, `astronaut-game\src\world-designer.ts:22-81`). The later win is to widen that authoring model to teleports, transformation rules, hazard tags, and persistent progression flags.

## Typed/authored systems the project should grow into later

### 1. Mechanism triggers

Later content likely needs a typed trigger/mechanism layer rather than “astronaut touched button” checks in `game.ts`:

- trigger source tags: astronaut, loose item, projectile, explosion impulse, beam
- thresholds: minimum weight, minimum impulse, allowed/disallowed source types
- effects: toggle door, set door state, enable beam, start timer, emit conversion event

This directly extends the current `Button`/`Door` authoring model instead of replacing it (`original_source.asm:11980-12061`, `original_source.asm:12451-12597`, `astronaut-game\src\game.ts:1607-1639`, `astronaut-game\src\button.ts:125-139`, `astronaut-game\src\world-designer.ts:22-58`).

### 2. Teleport definitions

Later world teleports should become authored content with fields such as:

- teleport id / destination id
- active/inactive state
- allowed target types
- carry restrictions
- entry/exit momentum behavior
- persistence rules

This would complement, not replace, the current player recall memory system in `game.ts` (`original_source.asm:1801-1833`, `original_source.asm:12604-12652`, `astronaut-game\src\game.ts:1352-1383`).

### 3. Transformation-rule tables

Item transformation chains should become data, not scattered conditionals. A later authored rule likely needs:

- source object/material
- other object/material or hazard type
- optional context conditions
- output object/state
- side effects: destroy source, spawn particles, trigger explosion, set persistence flag

That is the cleanest modern equivalent of the BBC conversion chains (`original_source.asm:11076-11107`, `original_source.asm:11535-11555`, `original_source.asm:11699-11724`) and fits naturally beside current collectable typing/state (`astronaut-game\src\collectable.ts:27-147`, `astronaut-game\src\world-designer.ts:60-81`).

### 4. Hazard-response profiles

Hazards should later read from explicit response data:

- damage type or material tag
- immunity/countermeasure requirement
- alternate reactions underwater/in vacuum/in special media
- object-side reactions such as ignite, dissolve, explode, convert, daze

This preserves the BBC “material world” feel without hardcoding every case into the main loop (`original_source.asm:10471-10499`, `original_source.asm:10756-10801`, `original_source.asm:12195-12219`).

### 5. Persistent progression state

The long-lived state layer should eventually distinguish at least:

- capability unlocks
- mechanism states
- consumable or rotating world slots
- inventory/storage state
- hazard/immunity state
- authored one-shot progression flags

The existing typed save path already serializes much of the loose-object side of this (`astronaut-game\src\world-designer.ts:768-805`, `astronaut-game\src\game.ts:626-633`), so later work should extend that model rather than introduce a parallel hidden-state system.

## Practical preserve-vs-modernize guidance

### Preserve

- Pressure/reactive mechanisms over “press use near object” logic.
- Multi-step item chains over isolated pickups.
- Hazard/immunity pairings over flat damage zones.
- Persistent capability/world changes over disposable score items.
- World objects that can be carried, thrown, transformed, or routed through mechanisms (`original_source.asm:994-1076`, `original_source.asm:10756-10801`, `original_source.asm:11980-12652`).

### Modernize

- Keep typed save data and inspector-driven authoring (`astronaut-game\src\world-designer.ts:22-90`, `astronaut-game\src\world-designer.ts:9067-9127`).
- Keep the current hold/store/cycle/throw affordances (`astronaut-game\src\game.ts:3705-3811`).
- Keep the current teleport-memory UX for the player (`astronaut-game\src\game.ts:1352-1383`).
- Surface later system rules through explicit fields, readable JSON, and debugging overlays instead of BBC-style hidden encodings.

## Later implementation directions

### Phase 1: normalize authoring boundaries

Keep `ButtonSaveData`, `DoorSaveData`, and `CollectableSaveData` as the nucleus, then add new typed world-system definitions instead of overloading those types with unrelated flags (`astronaut-game\src\world-designer.ts:22-81`).

### Phase 2: route runtime interactions through typed systems

Move later switch, teleport, hazard, and conversion logic behind reusable evaluators instead of embedding more special cases in `game.ts`. The current interaction points to grow from are button/door collision handling, teleport recall handling, and collectable handling (`astronaut-game\src\game.ts:1352-1383`, `astronaut-game\src\game.ts:1607-1639`, `astronaut-game\src\game.ts:3705-3811`).

### Phase 3: make transformation and hazard logic authorable

Add data-driven reaction tables for conversion, immunity, and hazard responses so world content can express “A meeting B becomes C” without bespoke code paths for each new interaction (`original_source.asm:10471-10499`, `original_source.asm:11076-11107`, `original_source.asm:11535-11724`).

### Phase 4: treat persistence as first-class system state

Persist mechanism state, player capability state, teleport state, and authored world flags alongside loose object state, using explicit save structures rather than implicit globals (`original_source.asm:994-1076`, `astronaut-game\src\game.ts:586-618`, `astronaut-game\src\world-designer.ts:768-805`).

## Bottom line

The later fidelity target should be a modern authored world-systems layer where switches, doors, teleports, hazards, and item chains are typed, inspectable, and persistent. The current TypeScript files already contain the right seeds in `game.ts`, `collectable.ts`, `button.ts`, `door.ts`, and `world-designer.ts`; later work should connect them into reusable world-system rules that preserve Exile's systemic feel without reviving its 8-bit opacity.
