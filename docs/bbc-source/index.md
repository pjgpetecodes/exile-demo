# BBC source reference index

## Purpose

This index turns the `docs/bbc-source/` notes into a usable reference set for later implementation work in the modern TypeScript game. Treat the collection as a **behavior and system guide**, not as a literal porting checklist: the goal is to preserve the BBC game's relationships between movement, world state, creatures, hazards, and resources while keeping the current project's modern UX, tooling, typed data, and editor workflow.

## How the documentation set is structured

The folder is easiest to use in three layers.

### 1. Foundation source-reading docs

These establish what the BBC original is doing at a system level.

- [movement-and-physics.md](movement-and-physics.md) - shared motion model, thrust accumulation, weight, buoyancy, collision feel, carrying, throwing, wind, and water.
- [world-systems-and-collectables.md](world-systems-and-collectables.md) - collectables, persistent world state, switches, doors, teleports, hazards, immunities, and transformation/progression chains.
- [creatures-and-combat.md](creatures-and-combat.md) - creature roster, target acquisition, firing, presentation, ecology hooks, and archetype-level combat behavior.
- [audio-and-sound-reference.md](audio-and-sound-reference.md) - BBC sound architecture, what is extractable from `original_source.asm`, and how to build modern reference assets without changing runtime code.

### 2. Fidelity interpretation docs

These translate the BBC findings into modern implementation guidance.

- [core-movement-fidelity.md](core-movement-fidelity.md) - player-facing movement feel: thrust commitment, inertia, burden, daze, and control-quality degradation.
- [resources-and-progression-fidelity.md](resources-and-progression-fidelity.md) - energy, jetpack charge, weapon power, suit/immunity state, daze, and progression pressure.
- [creature-presentation-and-firing-fidelity.md](creature-presentation-and-firing-fidelity.md) - stable anchors, visible centers, facing, reacquisition cadence, aiming, and projectile spawning.
- [creature-ecology-and-behavior.md](creature-ecology-and-behavior.md) - prey/avoid/feed relationships, habitat logic, offscreen ecology, and authored creature roles.
- [world-systems-fidelity.md](world-systems-fidelity.md) - typed triggers, teleport definitions, hazard-response profiles, transformation rules, and persistent world-system state.

### 3. Cross-system synthesis docs

These capture the biggest BBC design ideas that cut across the whole game.

- [unified-world-physics.md](unified-world-physics.md) - the key “one shared world-body simulation” thesis tying actor, item, hazard, projectile, and mechanism behavior together.

## Recommended reading paths

### If the later task is movement feel

1. [movement-and-physics.md](movement-and-physics.md)
2. [core-movement-fidelity.md](core-movement-fidelity.md)
3. [resources-and-progression-fidelity.md](resources-and-progression-fidelity.md)
4. [unified-world-physics.md](unified-world-physics.md)

### If the later task is creatures, combat, or animation-facing behavior

1. [creatures-and-combat.md](creatures-and-combat.md)
2. [creature-presentation-and-firing-fidelity.md](creature-presentation-and-firing-fidelity.md)
3. [creature-ecology-and-behavior.md](creature-ecology-and-behavior.md)
4. [unified-world-physics.md](unified-world-physics.md)

### If the later task is doors, buttons, teleports, items, or puzzle systems

1. [world-systems-and-collectables.md](world-systems-and-collectables.md)
2. [world-systems-fidelity.md](world-systems-fidelity.md)
3. [resources-and-progression-fidelity.md](resources-and-progression-fidelity.md)
4. [unified-world-physics.md](unified-world-physics.md)

### If the later task is audio reference or asset replacement

1. [audio-and-sound-reference.md](audio-and-sound-reference.md)
2. relevant gameplay/system doc for the event being mapped

## What each topic file is for

| File | Primary question it answers | Use it when later work is about |
| --- | --- | --- |
| `movement-and-physics.md` | How did the BBC world motion model work overall? | thrust, drag, weight, collisions, buoyancy, carrying, throwing |
| `core-movement-fidelity.md` | Which movement-feel relationships matter most to preserve? | astronaut handling, inertia, burden, impairment |
| `resources-and-progression-fidelity.md` | How do energy, suit, daze, and capability pressure shape play? | jetpack energy, weapon energy, survivability, progression loops |
| `world-systems-and-collectables.md` | How do collectables, hazards, switches, doors, and teleports fit together? | item systems, puzzle dependencies, immunities, conversion chains |
| `world-systems-fidelity.md` | How should those world systems become explicit modern data? | typed mechanisms, authored rules, persistence, hazard-response tables |
| `unified-world-physics.md` | What is the big simulation idea behind classic *Exile*? | shared body models, impulses, pressure triggers, explosion/world interactions |
| `creatures-and-combat.md` | What creature archetypes and combat rules exist in the BBC source? | enemy roles, tracking, firing, contact hazards, projectile behavior |
| `creature-presentation-and-firing-fidelity.md` | How should motion-driven presentation and firing be modernized? | animation state, facing, aim centers, muzzle logic, reacquisition |
| `creature-ecology-and-behavior.md` | How do creatures participate in food chains, habitats, and offscreen logic? | prey/avoid/feed logic, habitat tags, wake rules, ecology systems |
| `audio-and-sound-reference.md` | What BBC audio behavior can be reconstructed and mapped to current assets? | sound references, offline audio extraction, asset comparisons |

## How to use this set for later implementation

1. **Start from the foundation doc for the system.** Understand the BBC behavior before touching modern implementation details.
2. **Pair it with the matching fidelity doc.** That is where the preservation-vs-modernization guidance lives.
3. **Map the behavior to the existing modern seam.** Prefer extending current TypeScript boundaries rather than inventing parallel subsystems.
4. **Port relationships, not byte layouts.** Preserve things like burden reducing control authority, switches reacting to qualifying world pressure, or creatures having prey/avoid logic.
5. **Keep the result authorable and inspectable.** New mechanics should fit the world designer, typed save/runtime data, and readable debugging flow.
6. **Use synthesis docs to prevent local fixes from breaking the larger design.** In particular, check [unified-world-physics.md](unified-world-physics.md) whenever a task risks splitting one systemic rule into several bespoke scripts.

## Guiding principles for translating BBC mechanics into the modern TypeScript game

### Preserve behavioral identity

- Preserve **systemic interaction**, not 6502 structure.
- Preserve **asymmetry**: weight, contact, hazard, and resource differences should matter.
- Preserve **pressure loops**: low resources, dangerous cargo, and hostile ecology should change decision-making.
- Preserve **shared-world logic** wherever it is what makes *Exile* feel distinctive.

### Modernize through explicit structure

- Prefer **typed save data, typed runtime state, and explicit authored fields** over hidden flags.
- Prefer **existing modern seams** such as `settings.ts`, `astronaut.ts`, `object-physics.ts`, `collectable.ts`, `creature.ts`, `button.ts`, `door.ts`, `game.ts`, and `world-designer.ts`.
- Prefer **data-driven mechanism and ecology rules** over scattered one-off conditionals.
- Prefer **readability and tuning clarity** over literal BBC opacity.

### Keep modern UX and tooling boundaries explicit

The BBC material should **not** be read as a reason to remove or regress current modern affordances. Later implementation work should keep:

- fullscreen / expanded modern play presentation
- the in-app world designer and inspector workflow
- debug and readability overlays
- clean typed assets, save data, and runtime models
- centralized modern rendering, projectile, and audio helpers

The right target is **BBC-style systemic behavior with modern visibility, authoring, and ergonomics**.

## High-level map: BBC systems -> current modern files/systems

| BBC system | Main reference docs | Current modern files/systems |
| --- | --- | --- |
| Player thrust, inertia, drag, collision consequence | `movement-and-physics.md`, `core-movement-fidelity.md` | `astronaut-game/src/settings.ts`, `astronaut-game/src/astronaut.ts`, `astronaut-game/src/gravity.ts`, `astronaut-game/src/game.ts` |
| Carry burden, throwing, loose-object response | `movement-and-physics.md`, `core-movement-fidelity.md`, `unified-world-physics.md` | `astronaut-game/src/game.ts`, `astronaut-game/src/object-physics.ts`, `astronaut-game/src/collectable.ts` |
| Shared object/world-body simulation | `unified-world-physics.md`, `movement-and-physics.md` | `astronaut-game/src/object-physics.ts`, `astronaut-game/src/collectable.ts`, `astronaut-game/src/game.ts`, with adjacent actor/mechanism state in `astronaut.ts`, `creature.ts`, `button.ts`, `door.ts` |
| Persistent collectables, keys, devices, immunities | `world-systems-and-collectables.md`, `resources-and-progression-fidelity.md` | `astronaut-game/src/collectable.ts`, `astronaut-game/src/world-designer.ts`, `astronaut-game/src/game.ts`, `astronaut-game/src/types/index.ts` |
| Energy, suit, daze, progression pressure | `resources-and-progression-fidelity.md` | `astronaut-game/src/settings.ts`, `astronaut-game/src/astronaut.ts`, `astronaut-game/src/game.ts`, `astronaut-game/src/collectable.ts` |
| Switches, doors, teleports, triggers | `world-systems-and-collectables.md`, `world-systems-fidelity.md`, `unified-world-physics.md` | `astronaut-game/src/button.ts`, `astronaut-game/src/door.ts`, `astronaut-game/src/world-designer.ts`, `astronaut-game/src/game.ts` |
| Hazard/material reactions and transformation chains | `world-systems-and-collectables.md`, `world-systems-fidelity.md`, `unified-world-physics.md` | current item/runtime substrate in `astronaut-game/src/collectable.ts`, `astronaut-game/src/game.ts`, and authored data surfaces in `astronaut-game/src/world-designer.ts` |
| Creature targeting, combat, prey/avoid logic | `creatures-and-combat.md`, `creature-ecology-and-behavior.md` | `astronaut-game/src/creature.ts`, `astronaut-game/src/game.ts`, `astronaut-game/src/settings.ts`, `astronaut-game/src/world-designer.ts` |
| Creature facing, presentation anchors, aiming, projectile spawn | `creature-presentation-and-firing-fidelity.md`, `creatures-and-combat.md` | `astronaut-game/src/creature.ts`, `astronaut-game/src/utilities.ts`, `astronaut-game/src/game.ts`, `astronaut-game/src/world-designer.ts` |
| Audio references and modern asset mapping | `audio-and-sound-reference.md` | `astronaut-game/src/constants.ts`, `astronaut-game/src/assets/creature-sound-manifest.ts`, `astronaut-game/src/game.ts`, `astronaut-game/src/door.ts` |

## Practical implementation posture for future tasks

When future work uses these docs, the default posture should be:

- **foundation first** -> understand BBC behavior
- **fidelity second** -> decide what relationship to preserve
- **modern seam third** -> implement inside existing TS structure
- **designer/debug check fourth** -> keep the feature authorable and inspectable

If a future change would require removing modern editor support, fullscreen behavior, debug overlays, or typed content/runtime structures, that is usually a sign the BBC source is being interpreted too literally.

## Bottom line

The documentation set is organized to answer one recurring question: **what part of the BBC original is the real mechanic, and what part was just an 8-bit implementation detail?** Use the foundation docs to identify the mechanic, the fidelity docs to decide how to preserve it, and the modern file map above to keep later implementation work inside the current TypeScript game's readable, tool-friendly architecture.
