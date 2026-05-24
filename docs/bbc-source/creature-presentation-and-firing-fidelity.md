# Creature presentation and firing fidelity

This note builds on `docs/bbc-source/creatures-and-combat.md` and narrows the question to how BBC creature presentation, tracking, facing, aiming, and firing should be **interpreted** for the modern TypeScript game. The goal is not a literal port. The goal is to preserve the BBC's behavioral intent while keeping the modern renderer, collision model, editor, and readability improvements already present in the current project (`original_source.asm:6254-6293`, `original_source.asm:6541-6599`, `original_source.asm:9600-9928`; `astronaut-game/src/game.ts:2340-2552`, `astronaut-game/src/game.ts:3039-3431`, `astronaut-game/src/utilities.ts:62-85`, `astronaut-game/src/utilities.ts:278-455`, `astronaut-game/src/utilities.ts:1023-1100`).

## Core fidelity reading

The BBC code treats creature presentation as an output of motion and intent:

- frame choice is often derived from velocity plus a timer accumulator via `get_sprite_from_velocity`
- facing is commonly derived from x travel via `flip_object_in_direction_of_travel`
- sprite swaps also move the object to keep the visual result and physical footprint coherent via `change_sprite`
- target selection and firing are intermittent, stateful, and slightly noisy rather than perfectly continuous (`original_source.asm:6254-6293`, `original_source.asm:6541-6650`, `original_source.asm:8151-8173`, `original_source.asm:9600-9928`).

The modern game should therefore aim for **behavioral fidelity**, not byte-level fidelity: keep the BBC's motion-driven presentation, occasional retargeting, and imperfect firing, but express them through the TypeScript renderer/runtime hooks instead of emulating sprite-index mutation or stack-object internals (`astronaut-game/src/creature.ts:111-172`, `astronaut-game/src/creature.ts:179-280`, `astronaut-game/src/world-designer.ts:8758-8975`).

## Render anchors and visible sprite center

In the TypeScript game, creature `x`/`y` should be read as a stable authored placement origin, not as a guaranteed visual center. Rendering and collision already apply translation, trimmed sprite bounds, and visible-center compensation on top of that origin:

- `drawEntities()` uses rendered sprite canvases, translation offsets, and visible-center flip offsets before drawing (`astronaut-game/src/utilities.ts:1023-1100`)
- `getEntityRenderOffset()` and `getEntityCollisionBounds()` apply the same logic when deriving collision-space extents (`astronaut-game/src/game.ts:2340-2434`)
- `getVisibleCenterRotationOffset()`, `getSpriteVisibleBounds()`, and `getSpriteTranslationOffset()` already solve the alignment problem the BBC handled by moving objects during sprite swaps (`astronaut-game/src/utilities.ts:62-85`, `astronaut-game/src/utilities.ts:373-455`).

### Interpretation for modern fidelity

- Treat the **authored origin** as the persistent gameplay anchor.
- Treat the **visible bounds center** as the presentation center that should stay visually stable when flipping or rotating.
- Do **not** reinterpret fidelity as “everything must pivot around raw 32×32 tile centers.” The modern visible-bounds approach is more accurate and already captures the spirit of BBC `change_sprite`: keep the creature looking anchored even when its displayed silhouette changes (`original_source.asm:8151-8173`; `astronaut-game/src/game.ts:2340-2552`, `astronaut-game/src/utilities.ts:62-85`, `astronaut-game/src/utilities.ts:1023-1100`).

## Tracking centers

The BBC code searches for targets by object center/state, then routes toward a chosen destination square rather than blindly steering at the target every frame (`original_source.asm:9600-9928`). The modern runtime currently uses two useful centers:

- general creature chase logic uses collision-derived centers (`astronaut-game/src/game.ts:2505-2515`, `astronaut-game/src/game.ts:3275-3283`)
- turret-facing logic already uses a more stable visible/aim center via `getStableCreatureAimCenter()` (`astronaut-game/src/game.ts:2528-2552`, `astronaut-game/src/game.ts:3271-3280`).

### Interpretation for modern fidelity

- For **movement and contact**, collision centers remain the right gameplay truth.
- For **aiming and visual facing**, stable visible centers are the better fidelity choice because they preserve readable muzzle/facing behavior across asymmetric sprites and flips.
- For later parity work, prefer a split model: collision center for physics, stable visible center for presentation and targeting decisions.

## Facing rules

BBC creatures usually face the direction they are actually moving, sometimes only on a throttled/random cadence, not by continuously snapping every tick (`original_source.asm:6282-6293`). Birds, wasps, pirahnas, robots, and similar handlers repeatedly combine velocity-derived frame choice with direction-of-travel facing (`original_source.asm:11496-11519`, `original_source.asm:12809-12833`, `original_source.asm:12881-12896`).

The current TypeScript runtime already preserves authored rotation and only auto-flips certain aimed creatures/turrets based on target side, while `flipAroundVisibleCenter` and authored rotation state keep flips visually stable (`astronaut-game/src/creature.ts:182-187`, `astronaut-game/src/game.ts:2554-2575`, `astronaut-game/src/game.ts:3271-3431`).

### Interpretation for modern fidelity

- **Turrets / fixed shooters:** current side-based aim flipping is a good modern baseline.
- **Mobile creatures:** later fidelity work should generally face direction of travel or travel-intent, not permanently face the astronaut.
- **Authored rotation** should remain the baseline “rest orientation”; runtime facing should be a reversible presentation state layered over it.
- Keep visible-center flip compensation. That is a modern improvement, not a fidelity loss (`astronaut-game/src/game.ts:2359-2368`, `astronaut-game/src/utilities.ts:62-85`, `astronaut-game/src/utilities.ts:1023-1100`).

## Target search cadence

BBC search is intentionally intermittent:

- `find_target_occasionally` only reacquires on a cadence
- `npc_targetting` runs broader preference logic on longer intervals
- `find_nearest_object` uses randomized iteration and can accept “good enough” results instead of strict nearest every time (`original_source.asm:6600-6650`, `original_source.asm:9600-9741`).

The current TypeScript loop is more continuous: each update computes astronaut distance, checks `trackRange`, optionally follows, and fires whenever cooldown/range permit (`astronaut-game/src/game.ts:3259-3431`). The world designer already exposes explicit authoring knobs for `followRange`, `trackRange`, `fireMode`, `fireCooldownMs`, and projectile parameters (`astronaut-game/src/world-designer.ts:8810-8908`).

### Interpretation for modern fidelity

- Preserve the modern explicit ranges and editor fields.
- For later BBC-inspired behavior, add **target reacquisition cadence** on top of them rather than replacing them.
- Fidelity should mean “creatures reconsider targets occasionally and feel less omniscient,” not “remove explicit tuning data.”

## Lead aiming

BBC firing is not just “shoot directly at the player’s current pixel.” `enemy_fire_velocity_calculation` derives a shot solution from object-center geometry and folds in relative motion/noise, while `enemy_fire` further randomizes the outgoing bullet's x velocity (`original_source.asm:6564-6593`, `original_source.asm:8247-8306`).

The current TypeScript game fires directly at the astronaut's current center:

- `spawnCreatureProjectile()` normalizes a vector from creature center to current target point
- it does not lead astronaut velocity
- homing is modeled as a separate projectile behavior after spawn (`astronaut-game/src/game.ts:3039-3123`, `astronaut-game/src/game.ts:3152-3176`, `astronaut-game/src/game.ts:3393-3400`).

### Interpretation for modern fidelity

- Current direct aiming is acceptable as a readable modern default.
- If later fidelity work is wanted, prefer **soft lead aiming** or **authored inaccuracy** over perfect interception.
- BBC fidelity points toward “credible, slightly messy fire solutions,” not esports-grade hitscan prediction.

## Projectile spawn logic

BBC enemies create child objects from the firing solution and projectile type, with the firing routine tightly coupled to target selection and shot velocity (`original_source.asm:6541-6593`, `original_source.asm:12793-12837`).

The modern runtime already has a strong interpretation:

- projectile kind comes from creature fire mode (`astronaut-game/src/creature.ts:83-109`, `astronaut-game/src/creature.ts:149-155`)
- spawn is centralized in `spawnCreatureProjectile()` (`astronaut-game/src/game.ts:3039-3123`)
- spawn position is projected outward from creature center to the creature edge, then padded beyond the projectile extent to avoid immediate self-overlap (`astronaut-game/src/game.ts:3046-3085`)
- grenades/energy objects are still ordinary gameplay objects, which is very much in the spirit of BBC “projectiles are just world objects” (`astronaut-game/src/game.ts:3086-3123`).

### Interpretation for modern fidelity

- Keep the current “spawn from a readable muzzle edge, not from deep inside the sprite” behavior.
- Prefer visible, collision-safe projectile emergence over literal BBC object-stack quirks.
- If later needed, add authored muzzle offsets per archetype, but keep centralized spawn safety and shared projectile logic.

## Readability requirements for the modern game

Some things should stay modern even if later creature fidelity increases:

- stable visible-center flipping and translation handling (`astronaut-game/src/utilities.ts:62-85`, `astronaut-game/src/utilities.ts:367-455`, `astronaut-game/src/utilities.ts:1023-1100`)
- explicit creature schema for follow/fire/patrol/home data (`astronaut-game/src/creature.ts:111-172`, `astronaut-game/src/creature.ts:179-280`)
- direct editor controls for combat and presentation values (`astronaut-game/src/world-designer.ts:8758-8975`)
- optional readability overlays such as damage flash and creature overlays (`astronaut-game/src/game.ts:1475-1479`, `astronaut-game/src/game.ts:3563-3580`).

BBC fidelity should not require restoring opaque timing behavior, hidden data packing, or visually confusing spawn/facing rules. Readability is one of the modern project's strengths and should be treated as a design requirement, not a compromise.

## Recommended later implementation directions

1. **Formalize anchor semantics.** Document creature `x`/`y` as authored placement origin, and document visible-center/collision-center usage separately.
2. **Split tracking from aiming.** Keep collision centers for physics/contact, but use stable visible centers for facing, aim checks, and future muzzle logic.
3. **Add optional reacquisition cadence.** Introduce per-archetype target refresh intervals so creatures do not behave like perfectly informed trackers every frame.
4. **Add optional lead/noise controls.** Prefer authored aim error, lead percentage, or fire confidence over guaranteed direct center shots.
5. **Expand movement-facing rules.** Let mobile creatures optionally face travel direction or motion intent, while turrets keep side-based aim flipping.
6. **Keep centralized projectile spawning.** If archetypes need unique muzzle behavior, add data-driven muzzle offsets instead of decentralizing projectile creation.
7. **Preserve modern editor/readability tooling.** Any future BBC-inspired work should remain inspectable and tunable in the world designer (`astronaut-game/src/world-designer.ts:8758-8975`).

## Bottom line

The BBC game says creatures should look like they are **doing** something: moving with intent, facing with intent, reacquiring targets intermittently, and firing with some uncertainty. The modern TypeScript project already has better rendering anchors, clearer runtime state, safer projectile spawning, and stronger authoring tools. Later fidelity work should therefore preserve the BBC's intent while keeping the modern game's stable anchors, visible-center math, centralized projectile logic, and readability-first tooling (`original_source.asm:6254-6293`, `original_source.asm:6541-6599`, `original_source.asm:9600-9928`, `original_source.asm:12793-12837`; `astronaut-game/src/game.ts:2340-2552`, `astronaut-game/src/game.ts:3039-3431`, `astronaut-game/src/utilities.ts:62-85`, `astronaut-game/src/utilities.ts:278-455`, `astronaut-game/src/utilities.ts:1023-1100`, `astronaut-game/src/world-designer.ts:8758-8975`).
