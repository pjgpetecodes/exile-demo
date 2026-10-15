---
name: bbc-6502-source-analysis
description: Workflow for finding and decoding original Exile mechanics in the 6502 source and enhanced disassembly, then implementing them faithfully in the TypeScript game. Use when matching creature, physics, world-object, or sound behavior to the BBC original.
---

# BBC Exile 6502 source analysis

Use this skill whenever a gameplay behavior should match the original game.

## Sources
- `docs/bbc-source/exile-enhanced-disassembly.txt`: lines like `&a2ce 20 b6 25 JSR &25b6 ; rnd  # comment`; handlers are introduced by `# Name (OBJECT_X)` comment blocks. Use for addresses and author comments.
- `docs/bbc-source/exile.6502`: labelled assembler source and data tables.
- `docs/bbc-source/*.md`: summaries; verify against the sources before trusting.

## Workflow
1. Search (grep) for the object/behavior: `OBJECT_<NAME>`, label names, or comment keywords. Handler dispatch: `.object_handler_table` (`exile.6502` ~568) and `.handlers_start` (~10143).
2. Read the full routine and each subroutine it calls. Common helpers: `rnd`, `damage_object`, `give_object_minimum_energy`, `consider_moving_towards_player`, `play_sound`, `update_bullet_with_particle_trail`, `.handle_collectable`.
3. Record: zero-page state used, fixed-point units, random gates (`AND #&3f` => 1 in 64; `AND #&03` => 1 in 4), per-type lookup tables (index = type - first type), and conditions (touching player, underwater, invisible, energy thresholds).
4. Write a short spec with address citations before coding.
5. Implement in `astronaut-game/src/game/...` (creatures: `creatures/game-creature-runtime.ts`; combat/collision: `combat/game-combat-helpers.ts`), keeping modern architecture, units, and data-driven tables.
6. Add deterministic unit tests with seeded randomness under `astronaut-game/tests/unit/game/`; run `npm run test:unit -- <files>` and `npm run build` in `astronaut-game`.

## Conventions
- Cite `label &address` in comments/PR notes for non-obvious constants.
- Mark each value as exact, scaled to modern units, or intentionally modernized.
- If a doc in `docs/bbc-source/` contradicts the source, fix the doc.

## Related agents
`bbc-6502-source-expert` (cross-system), `bbc-creature-mechanics-specialist`, `bbc-physics-mechanics-specialist`, `bbc-world-systems-specialist`, `bbc-audio-reference-specialist`.
