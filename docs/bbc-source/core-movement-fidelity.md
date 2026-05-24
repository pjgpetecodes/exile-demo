# Core movement fidelity notes

## Purpose

This note builds on `docs\bbc-source\movement-and-physics.md` and narrows the BBC source down to the player-facing movement feel that should guide later TypeScript tuning. The goal is not to reproduce the 6502 structure literally; it is to preserve the original relationship between thrust, momentum, drag, burden, and temporary impairment while keeping the modern game's readability and tooling.

## Source anchors

- The BBC player/object update loop clears acceleration, moves using existing velocity, adjusts held-weight, resolves support/collision state, and can damage the player from harsh impacts (`original_source.asm:4563-4665`).
- The BBC movement feel is driven by tiny input nudges into `acceleration_x` / `acceleration_y`, then folded into velocity by `accelerate_object`, with only gentle periodic decay and jetpack particles emitted when acceleration is actually happening (`original_source.asm:5181-5240`, `original_source.asm:7232-7261`).
- Carry burden and throw strength are weight-sensitive in the original through `weight_when_held` and `throw_velocities` (`original_source.asm:4424-4425`, `original_source.asm:4591-4598`, `original_source.asm:8190-8216`).
- Low-energy and daze states directly reduce control authority by making jetpack use erratic, disabling motion, suppressing thrust, and even zeroing acceleration in parts of the player routine (`original_source.asm:8950-9120`, `original_source.asm:10488-10499`).
- The modern astronaut path uses explicit movement constants in `astronaut-game\src\settings.ts` and applies them in `astronaut-game\src\astronaut.ts`, with gravity layered in from `astronaut-game\src\gravity.ts` and final movement/collision flow orchestrated in `astronaut-game\src\game.ts` (`astronaut-game\src\settings.ts:3-64`, `astronaut-game\src\astronaut.ts:81-225`, `astronaut-game\src\gravity.ts:3-14`, `astronaut-game\src\game.ts:1517-1565`).
- Modern carried-object penalties and loose-object response are already explicit and tunable through held movement modifiers plus generalized object physics helpers (`astronaut-game\src\game.ts:2436-2475`, `astronaut-game\src\game.ts:3583-3819`, `astronaut-game\src\game.ts:4033-4155`, `astronaut-game\src\object-physics.ts:24-127`).

## What the original movement feel is really doing

The BBC game feels distinctive because input is a **small repeated push into an already-moving body**, not a request for an immediate target speed. The player accumulates acceleration, carries residual velocity forward, loses speed only gradually, and becomes meaningfully worse at moving when overloaded, injured, or dazed (`original_source.asm:4563-4665`, `original_source.asm:5181-5240`, `original_source.asm:7232-7261`, `original_source.asm:8950-9120`).

That combination matters more than any single number. Exile's feel comes from **control authority changing with context**.

## Thrust feel

- In the BBC source, left/right/up/down do not directly assign speed; they increment or decrement acceleration bytes, and booster use doubles that acceleration rather than bypassing it (`original_source.asm:7232-7261`).
- `accelerate_object` then adds those small pushes into existing velocity and only periodically trims velocity back toward zero, which is why the game feels both responsive and glide-prone (`original_source.asm:5181-5218`).
- Jetpack feedback is coupled to active acceleration, not just movement, because thrust particles only spawn when acceleration is non-zero (`original_source.asm:5219-5240`).

### Fidelity takeaway

Later modern tuning should preserve the sense that thrust is a **continued commitment**. Pressing a direction should feel like feeding momentum into the astronaut, not like snapping instantly to a clean target speed.

## Acceleration accumulation and drag

- The BBC loop resets acceleration each update, allows control/object logic to repopulate it, then integrates it into velocity; this keeps motion state cumulative without making acceleration permanent (`original_source.asm:4577-4589`, `original_source.asm:5181-5218`).
- Drag in the original is mild and periodic. It reins motion in, but not fast enough to erase overshoot or scrape momentum immediately (`original_source.asm:5205-5218`).
- In the modern game, airborne control is explicit float acceleration with caps, while grounded motion uses `walkSpeed` buildup and explicit decay; gravity is a separate helper, which makes tuning clearer but also risks feeling cleaner than the BBC version if values are too direct (`astronaut-game\src\astronaut.ts:122-225`, `astronaut-game\src\gravity.ts:3-14`, `astronaut-game\src\game.ts:1517-1565`, `astronaut-game\src\settings.ts:3-20`).

### Fidelity takeaway

The original game does **not** feel frictionless, but it also does **not** stop on command. Safe future adjustments should target slower bleed-off and stronger carry-through of prior motion, especially in flight.

## Carrying penalties and burden

- In the BBC source, carrying is not cosmetic. Holding an object remaps the player's working weight through `weight_when_held`, and throw velocity is chosen from a weight-indexed table before the player's own momentum is added (`original_source.asm:4424-4425`, `original_source.asm:4591-4598`, `original_source.asm:8190-8216`).
- In the modern game, held items already scale walking speed, flight control, gravity, and terminal velocity through `getHeldMovementModifiers`, while release/throw behavior uses explicit offsets and a fixed throw-speed model (`astronaut-game\src\game.ts:2436-2475`, `astronaut-game\src\game.ts:3583-3819`, `astronaut-game\src\settings.ts:23-28`, `astronaut-game\src\settings.ts:54-64`).
- Loose objects also already communicate weight through push resistance, bounce loss, and friction scaling in the shared object-physics helpers (`astronaut-game\src\object-physics.ts:34-127`, `astronaut-game\src\game.ts:4033-4155`).

### Fidelity takeaway

The original feel says burden should reduce **authority**, not just add bookkeeping. Heavier carried objects should make movement more committed, more sluggish to correct, and less generous when throwing.

## Control readability

- The BBC game accepts roughness, but its rules are still readable because feedback lines up with causes: thrust effects appear on active acceleration, collision pain comes from hard contact, and movement lockouts come from energy/daze state rather than arbitrary scripting (`original_source.asm:4647-4659`, `original_source.asm:5219-5240`, `original_source.asm:8950-9120`).
- The modern game is intentionally more legible: movement numbers are centralized in `MOVEMENT_SETTINGS`, astronaut movement phases are explicit in `astronaut.ts`, gravity is isolated, throw angle is player-authored, and object motion is resolved stepwise with clear bounce/friction branches (`astronaut-game\src\settings.ts:3-64`, `astronaut-game\src\astronaut.ts:81-225`, `astronaut-game\src\gravity.ts:3-14`, `astronaut-game\src\game.ts:3583-3819`, `astronaut-game\src\game.ts:4033-4155`).

### Fidelity takeaway

Readability is a modern strength to keep. The right target is **BBC-style consequence with modern clarity**, not BBC-style obscurity.

## Daze and low-energy movement constraints

- Low energy in the BBC player routine does more than lower survivability: it makes firing/jetpack behavior erratic, can set immobility daze when energy is critically low, and can separately apply a no-thrust daze that suppresses movement authority (`original_source.asm:8950-9005`).
- Other daze sources, including mushrooms and hazards, extend the same immobility state rather than inventing a separate one-off movement penalty path (`original_source.asm:4450-4457`, `original_source.asm:10488-10499`).
- When `player_can_move` drops out, the code can zero acceleration axes in the player routine, so impairment changes how the character responds to input, not just how damage is displayed (`original_source.asm:9111-9118`).
- The current TypeScript movement path in the cited files does not yet show an equivalent astronaut energy/daze layer gating thrust, walking, or acceleration directly; current movement constraints are mainly carrying penalties, explicit speed caps, gravity, and collision resolution (`astronaut-game\src\astronaut.ts:93-225`, `astronaut-game\src\game.ts:1517-1565`, `astronaut-game\src\game.ts:2436-2475`, `astronaut-game\src\gravity.ts:3-14`).

### Fidelity takeaway

If impairment is added later, it should reduce **control quality** first: wobblier thrust, weaker correction, and temporary loss of full control authority are closer to the source feel than a simple hard disable.

## What can be modernized safely

- **Keep explicit tunables.** The current `MOVEMENT_SETTINGS` model is much easier to reason about than BBC-era packed flags and should remain the main tuning surface (`astronaut-game\src\settings.ts:3-64`).
- **Keep the current movement split readable.** `astronaut.ts` for astronaut intent, `gravity.ts` for vertical pull, `game.ts` for orchestration, and `object-physics.ts` for reusable object response is a sound modern structure (`astronaut-game\src\astronaut.ts:81-225`, `astronaut-game\src\gravity.ts:3-14`, `astronaut-game\src\game.ts:1517-1565`, `astronaut-game\src\object-physics.ts:24-127`).
- **Keep authored throw readability.** A visible throw angle and predictable release handling are safe modern affordances even if later tuning makes heavy objects weaker or more momentum-dependent (`astronaut-game\src\game.ts:3747-3819`).
- **Keep clearer collision behavior.** The modern stepwise resolver is easier to tune and debug than the BBC wall-angle pipeline, so later fidelity work should change feel through acceleration/drag/burden rules before making collisions harsher (`astronaut-game\src\game.ts:4033-4155`).

## Later implementation priorities

1. **Make thrust accumulate before it caps.** Favor sustained input building momentum over immediate target-speed matching.
2. **Preserve residual motion after input release.** Flight should keep some glide so course correction matters.
3. **Deepen carry burden as a movement-quality penalty.** Heavy held objects should reduce acceleration authority, increase downward commitment, and weaken throw outcomes.
4. **Add impairment as degraded control, not just a lock.** Low-energy/daze states should first destabilize or suppress thrust before they fully remove agency.
5. **Keep feedback tightly causal.** If movement is weak, burdened, or impaired, the player should be able to tell why from motion response and audiovisual cues.
6. **Tune for readable consequence, not frustration.** Preserve overshoot, inertia, and burden, but keep the current modern clarity around aiming, collision interpretation, and authored controls.

## Bottom line

For later parity work, the BBC source should be treated as a guide to **behavioral texture**: small thrust nudges that accumulate, drag that softens without erasing momentum, burden that reduces control authority, and impairment that degrades movement quality in readable ways. The modern game should keep its explicit TypeScript tuning model while borrowing those control relationships from the original (`original_source.asm:5181-5240`, `original_source.asm:8950-9120`, `astronaut-game\src\astronaut.ts:93-225`, `astronaut-game\src\game.ts:1517-1565`).
