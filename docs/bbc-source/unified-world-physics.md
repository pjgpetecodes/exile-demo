# BBC Micro Exile: unified world-object physics

## Purpose

This synthesis builds on [movement-and-physics.md](movement-and-physics.md) and [world-systems-and-collectables.md](world-systems-and-collectables.md). The core takeaway is that classic *Exile* is not defined by a special player controller plus separate puzzle logic; it is defined by a **shared world-object simulation** where player, creatures, carried items, projectiles, hazards, switches, and doors all live close to the same ruleset (`original_source.asm:404-533`, `original_source.asm:4557-4910`, `original_source.asm:6932-7172`, `original_source.asm:11980-12597`).

## Core thesis

In the BBC original, the important design move is not “better gravity.” It is the fact that objects are updated as bodies with position, velocity, acceleration, weight, contact/support state, and handler-specific behavior layered on top. That is why the game can let the same world produce:

- a player who feels heavy or light depending on what they carry
- creatures that shove, absorb, or are shoved by other objects
- projectiles and hazardous materials that become physical events
- switches and doors that react to object contact, not just explicit player input
- puzzle progress that emerges from moving matter around the world instead of solving isolated scripted locks (`original_source.asm:4424-4425`, `original_source.asm:4591-4598`, `original_source.asm:7046-7172`, `original_source.asm:10756-10801`, `original_source.asm:11980-12061`, `original_source.asm:12451-12597`).

## What “unified world-object physics” means here

The later modern implementation target should be:

1. **One shared body model** for astronaut, creatures, loose items, projectiles, hazardous objects, and moving mechanisms.
2. **One shared interaction vocabulary** for weight, impulse, carry state, support state, collision, explosion force, and trigger pressure.
3. **Handler-specific rules on top of that substrate**, rather than separate mini-engines for every category.

That is broadly how the BBC source behaves already. The object loop resets per-object acceleration, reads weight/gravity flags, applies controls and handlers, resolves support/collision, exchanges momentum, then runs environment/media effects such as water and wind (`original_source.asm:4557-4590`, `original_source.asm:4779-4822`, `original_source.asm:4910`, `original_source.asm:5181-5218`, `original_source.asm:7519-7819`).

## Shared simulation rules across actor categories

### Player, creatures, items, projectiles, and hazards

The BBC handler table groups “world things” together instead of sharply separating them into player-only, pickup-only, or hazard-only subsystems. Doors, switches, coronium, fireballs, mushrooms, teleports, collectables, creatures, and explosions all appear as object/handler families in the same object catalog (`original_source.asm:404-533`).

That matters because many famous *Exile* interactions depend on category boundaries being weak:

- a carried object changes player handling (`original_source.asm:4424-4425`, `original_source.asm:4591-4598`)
- mushroom balls can be transformed by fireballs (`original_source.asm:11535-11555`)
- coronium can be both cargo and a contact/explosion hazard (`original_source.asm:10756-10801`)
- switches and doors react to contact pressure and beam/object interactions (`original_source.asm:11980-12061`, `original_source.asm:12451-12597`)

### Current TypeScript substrate

The modern codebase already has a useful partial substrate:

- `Collectable` already carries shared physical/runtime state such as `weight`, `velocity`, `held`, `stored`, `collision`, projectile payload, fuse state, and explosion power (`astronaut-game\src\collectable.ts:27-147`).
- `object-physics.ts` already defines a reusable `DynamicPhysicsBody` contract with shared gravity, push, bounce, and friction helpers (`astronaut-game\src\object-physics.ts:3-127`).
- `game.ts` already routes both ordinary collectables and creature projectiles through the same loose-object physics helper selection path (`astronaut-game\src\game.ts:83-114`, `astronaut-game\src\game.ts:4033-4155`).

This is a strong base, but it is still narrower than BBC *Exile*: today the shared solver mostly covers loose collectables/projectiles, while astronaut movement, creature reactions, buttons, and doors still sit in adjacent systems rather than one common world-body model.

## Weight and momentum

### BBC model

Weight is one of the main identity-shaping rules in the original:

- weight is encoded directly in object gravity/behavior flags (`original_source.asm:557-567`)
- held-object weight is remapped into the player’s effective mass (`original_source.asm:4424-4425`, `original_source.asm:4591-4598`)
- collision response uses relative weight before momentum exchange (`original_source.asm:7046-7056`)
- `do_momentum_exchange` reduces transferred collision velocity according to weight difference, so heavier bodies keep authority and lighter bodies get redirected (`original_source.asm:7147-7172`)

The result is not realistic simulation for its own sake; it is **gameplay asymmetry**. The player learns that some things can be bullied, some can only be nudged, and some become dangerous when thrown or dropped.

### Current TypeScript mapping

The current project already treats weight as a reusable property:

- `Collectable.weight` is part of saved/runtime item state (`astronaut-game\src\collectable.ts:36-95`, `astronaut-game\src\world-designer.ts:60-81`)
- dynamic-object push and bounce scale down with weight in `object-physics.ts` (`astronaut-game\src\object-physics.ts:34-116`)
- carried weight also modifies astronaut movement through explicit held-item penalties in `game.ts` (`astronaut-game\src\game.ts:2436-2465`)
- thrown/dropped items inherit release velocity or fixed throw velocity, so there is already some momentum transfer between carrier and item (`astronaut-game\src\game.ts:3637-3641`, `astronaut-game\src\game.ts:3747-3810`)

The later carry-forward opportunity is to stop treating weight as mainly a collectable-only tuning number and instead make it a property used across all dynamic world bodies and mechanism triggers.

## Explosions and force propagation

### BBC model

In the original, explosions are object-state transitions inside the same world model, not just VFX. Explosion handlers live in the handler table, the engine tracks a global `explosion_timer`, and hazardous materials such as coronium can trigger object explosions through contact/collision rules (`original_source.asm:426-429`, `original_source.asm:501`, `original_source.asm:1031-1035`, `original_source.asm:10569-10617`, `original_source.asm:10756-10801`).

The important design implication is that an explosion is a **world event**. It can alter object state, damage nearby actors, and participate in larger systemic chains like coronium handling and endgame escalation (`original_source.asm:10740-10745`, `original_source.asm:10756-10801`).

### Current TypeScript mapping

The modern game already has the beginning of this:

- grenades are collectables with `armed`, `armedAtMs`, and `explosionPower` state (`astronaut-game\src\collectable.ts:56-147`)
- creature projectiles can explode with splash damage (`astronaut-game\src\game.ts:2903-2943`)
- grenade explosions damage creatures and the astronaut by radius/power falloff (`astronaut-game\src\game.ts:2945-2984`)

However, the current explosion model is still mostly **damage propagation**, not full **force propagation**. It does not yet appear to push loose objects, trigger pressure mechanisms, or cause door/switch reactions through the same impulse system.

### Carry-forward direction

Later, explosions should emit a reusable radial event with at least:

- damage
- impulse
- source type/material
- trigger eligibility (can this press a switch, unlock a mechanism, ignite a hazard, or move a loose item?)

That would better match the BBC spirit than adding more special-case grenade logic.

## Switches and doors reacting to objects

### BBC model

This is one of the clearest places where the unified model matters:

- switches fire only when touched by something heavy enough, with exclusions for non-qualifying contact such as engine fire (`original_source.asm:11980-12061`)
- switch activation toggles state and dispatches through a switch-effects table instead of only running local button code (`original_source.asm:11968-12054`)
- doors also check contact pressure, can be toggled by the RCD beam, and use shared timing/state rules such as `door_timer` (`original_source.asm:1023-1024`, `original_source.asm:7973-7989`, `original_source.asm:12451-12597`)

So a switch is a **world relay**, and a door is a **stateful moving object/mechanism**.

### Current TypeScript mapping

The modern project already has clean authoring/runtime pieces:

- authorable button, door, and collectable schemas live in `world-designer.ts` (`astronaut-game\src\world-designer.ts:22-90`)
- `Button` stores `linkedDoors`, collision parts, and activation/toggle helpers (`astronaut-game\src\button.ts:15-139`)
- `Door` stores lock/open/animation/collision state and updates animated position over time (`astronaut-game\src\door.ts:3-144`)
- `game.ts` currently toggles linked doors when the astronaut touches a button, and opens horizontal doors when the astronaut touches an unlocked one (`astronaut-game\src\game.ts:1607-1639`)

That is already a good modern mechanism layer, but it is still more **player-contact-driven** than **object-physics-driven**. The BBC behavior suggests the later model should let any qualifying dynamic object press a switch or meaningfully interact with a door.

## Why this matters to Exile’s identity

*Exile* feels different from ordinary platformers because it treats matter, hazard, and mechanism as parts of one ecology.

If physics is only for the player, then:

- items become inventory tokens
- projectiles become isolated combat effects
- hazards become scripted damage zones
- switches become “stand here to open door” widgets

But when the same world rules apply across categories, the game produces the distinctive *Exile* verbs:

- carry something dangerous somewhere useful
- throw one system into another
- use weight itself as a puzzle input
- cause chain reactions instead of pressing explicit use buttons
- let the world surprise the player because objects keep their own agency after contact

That systemic messiness is a big part of the original game’s identity (`original_source.asm:404-533`, `original_source.asm:7046-7172`, `original_source.asm:10756-10801`, `original_source.asm:11980-12597`).

## Modern-friendly design principles

Later work should preserve the BBC behavior pattern while staying readable and tool-friendly:

1. **Keep explicit TypeScript data models.** Continue using typed save/runtime objects instead of BBC-style packed bytes (`astronaut-game\src\world-designer.ts:22-90`, `astronaut-game\src\collectable.ts:27-147`).
2. **Promote one shared body contract.** Generalize the existing `DynamicPhysicsBody` idea so astronaut, creatures, items, projectiles, hazards, and some mechanisms can all expose weight/velocity/contact/impulse hooks (`astronaut-game\src\object-physics.ts:3-127`).
3. **Prefer shared forces over bespoke scripts.** Push, bounce, explosion impulse, carry momentum, and trigger pressure should reuse common helpers before adding one-off exceptions.
4. **Author mechanism thresholds directly.** Buttons/switches/doors should expose fields such as minimum pressure, accepted source types, or impulse thresholds in the modern designer layer (`astronaut-game\src\button.ts:23-139`, `astronaut-game\src\world-designer.ts:22-58`).
5. **Preserve asymmetry, not realism.** The goal is interesting weight hierarchy and chain reactions, not a physically perfect sandbox.
6. **Keep debugging legible.** A modern unified solver should expose visual/debug state for support, impulse, trigger pressure, and mechanism activation instead of hiding everything in magic numbers.

## Later implementation directions

When this is carried forward into gameplay work later, the most promising direction looks like:

### 1. Define a common world-body interface

Likely fields:

- position
- velocity
- weight / pressure class
- collision bounds
- support/grounded state
- carried/attached state
- material or damage response tags
- mechanism trigger capabilities

### 2. Treat `object-physics.ts` as the nucleus, not the full solution

The current helpers are already the right kind of abstraction for gravity, push, bounce, and friction. Later work should extend that shared layer outward instead of replacing it (`astronaut-game\src\object-physics.ts:24-127`, `astronaut-game\src\game.ts:4033-4155`).

### 3. Expand “collectable physics” into “world-body physics”

Today, `Collectable` already acts as a bridge type for ordinary items, grenades, and creature projectiles (`astronaut-game\src\collectable.ts:27-147`, `astronaut-game\src\game.ts:98-114`). Later, the same body/impulse vocabulary should cover:

- astronaut/body pushback
- creatures being shoved or launched
- loose items and thrown items
- projectile impacts
- hazardous props such as explosive or reactive materials

### 4. Convert explosions from damage events into physics events

A future explosion should be able to:

- damage actors
- push nearby dynamic objects
- qualify as trigger pressure for switches if authored to do so
- wake sleeping bodies / start chain reactions
- feed mechanism logic without bespoke grenade-only checks

### 5. Let buttons and doors consume object interactions, not only player overlap

The designer/runtime path is already present through `world-designer.ts`, `button.ts`, `door.ts`, and `game.ts` (`astronaut-game\src\world-designer.ts:22-90`, `astronaut-game\src\button.ts:15-139`, `astronaut-game\src\door.ts:3-144`, `astronaut-game\src\game.ts:1607-1639`). The later upgrade is to route contact/pressure/impulse from qualifying world bodies into those same mechanisms.

### 6. Preserve modern affordances

Do **not** regress to BBC-era opacity. Keep:

- typed authoring data
- clear inspector fields
- explicit tuning constants
- predictable modern UX for pickup/storage/throwing
- readable, testable TypeScript boundaries

The win is to import the original game’s **shared-world behavior**, not its implementation obscurity.

## Bottom line

The piece worth carrying forward is not “old-school gravity.” It is the single-world idea: objects with weight, momentum, force response, and trigger consequences living in one simulation, so puzzles, hazards, combat, and traversal all emerge from the same underlying rules. The current TypeScript project already has a partial foundation for that in `collectable.ts`, `object-physics.ts`, `game.ts`, `button.ts`, `door.ts`, and `world-designer.ts`; later work should widen that foundation into a true world-body model rather than adding more isolated special cases.
