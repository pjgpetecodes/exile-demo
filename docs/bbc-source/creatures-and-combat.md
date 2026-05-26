# BBC Micro creatures and combat

This note extracts creature-facing behavior from the original BBC Micro source and translates it into a form the TypeScript project can reuse later. The primary source is `original_source.asm`, with modern touchpoints in `astronaut-game/src/game.ts`, `creature.ts`, `collectable.ts`, `world-designer.ts`, and `utilities.ts`.

## Source map

The BBC source keeps a useful master index of stack-object handlers, including frogmen, birds, wasps, pirahnas, maggots, imps, robots, turrets, triax, hovering robots, bullets, and other combatants (`original_source.asm:433-489`). Treat that table as the roster of authored archetypes rather than assuming one generic enemy system.

## Creature presentation and rendering

The original game couples presentation tightly to behavior state:

- sprite choice is often derived from current velocity and a small timer accumulator via `get_sprite_from_velocity` (`original_source.asm:6254-6273`)
- horizontal facing is usually just “face the direction of travel” via `flip_object_in_direction_of_travel*` (`original_source.asm:6282-6293`)
- swapping sprite variants also updates size/position so the visual frame and physical footprint stay aligned via `change_sprite` (`original_source.asm:8151-8173`)

Concrete examples:

- **Frogmen** use timers to pulse between movement and attack-looking frames after contact, and the green/cyan variants can daze and damage the player on touch (`original_source.asm:11189-11277`).
- **Birds** pick flight frames from velocity, flip toward travel, optionally whistle, and keep special invisible/red variants layered on top of the shared bird logic (`original_source.asm:11455-11526`).
- **Imps** choose sprite variants from motion/attack state and also flip toward travel before converting the final sprite (`original_source.asm:11370-11420`).
- **Wasps / pirahnas** also derive sprite state from velocity before flipping toward travel (`original_source.asm:12881-12886`).

### Modern TypeScript hooks

The modern project already has better rendering primitives than the BBC code and should keep them:

- `Creature` stores authored rotation, translation, palette, and stateful presentation flags (`astronaut-game/src/creature.ts:179-280`).
- `drawEntities()` renders by palette, rotation, crop, translation, and visible-center compensation (`astronaut-game/src/utilities.ts:278-360`, `astronaut-game/src/utilities.ts:1023-1100`).
- visible-center flipping and sprite-translation offsets already solve alignment problems that the BBC code handled indirectly through sprite/size mutation (`astronaut-game/src/utilities.ts:62-84`, `astronaut-game/src/utilities.ts:133-183`, `astronaut-game/src/utilities.ts:367-455`).
- creature rendering is already integrated cleanly into the modern layered draw order and world-designer workflow (`astronaut-game/src/game.ts:1419-1514`).

For later parity work, preserve the **behavior-driven frame changes**, but keep the modern rendering path instead of trying to recreate BBC sprite-index mutation literally.

## Target acquisition

The BBC creature AI is built around target search plus lightweight state flags, not around long-path planning.

- `find_target_occasionally` throttles target selection so many creatures only retarget every so often instead of every tick (`original_source.asm:9600-9607`).
- `find_nearest_object` can search by type, include the player, search by object range, count matches instead of selecting one, and sometimes prefer “good enough/random” choices rather than strict nearest (`original_source.asm:9643-9741`).
- `npc_targetting` layers several authored concerns: a primary target, an optional secondary/avoid target, absorbable prey, and bitflag-driven mood/state updates (`original_source.asm:6600-6649`).
- The lookup tables driving those preferences live nearby (`original_source.asm:7926-7941`).

This means the original design is not just “enemy chases astronaut”; many creatures are choosing among:

- astronaut
- a prey type
- a danger type to avoid
- a nearby object class or range bucket

## Astronaut tracking and route choice

Once a target exists, the BBC code uses a compact target-state machine:

- `set_targetting_flags` promotes a target to “close/active” when it is near enough, or downgrades it again when it drifts away (`original_source.asm:9771-9798`).
- `target_processing` treats “no target”, “target remembered”, “target close”, and “avoid this target” as different motion cases (`original_source.asm:9799-9863`).
- `choose_route_to_target` samples a handful of candidate angles, checks line of sight, and picks either a clear route or the best partial route; this gives creatures obstacle-aware steering without expensive pathfinding (`original_source.asm:9878-9925`).
- `move_towards_target_with_probability_x` then accelerates toward the chosen destination with a probability gate and speed cap (`original_source.asm:8003-8048`).

### Modern TypeScript hooks

The current TypeScript loop is simpler and more explicit:

- creatures compute astronaut distance directly
- `trackRange` / `followRange` gate whether they care
- movement modes split into `ground`, `fly`, `hover`, and `turret`
- patrol/home bounds are explicit authored data (`astronaut-game/src/game.ts:3266-3431`, `astronaut-game/src/creature.ts:111-172`)

That is a good modernization. If BBC-style parity becomes desirable later, the thing to borrow is the **priority stack** (target, avoid, prey, route sample), not the exact bitfield encoding.

## Facing and firing

Enemy ranged attacks in the BBC source are energy-gated and slightly noisy, which keeps combat from feeling perfectly deterministic:

- `find_a_target_and_fire_at_it` uses current energy to affect firing probability, searches for a target, and only fires if something valid was found (`original_source.asm:6541-6561`).
- `enemy_fire` calculates bullet velocity from the target solution, then injects randomness into the outgoing shot (`original_source.asm:6562-6593`).

Key archetype uses:

- **Turrets** decode bullet type from object data and fire without locomotion (`original_source.asm:12793-12837`).
- **Robots** move, then reuse the same firing path, with projectile type determined by robot colour/type (`original_source.asm:12802-12842`).
- **Hovering robots**, **clawed robots**, and **triax** blend thrust, teleporting, and ranged attacks for more theatrical combat behavior (`original_source.asm:11604-11653`, `original_source.asm:11768-11860`).

### Modern TypeScript hooks

The modern game already exposes the right abstractions:

- creature authorship fields such as `fireMode`, `homingBullets`, `fireCooldownMs`, `projectileSpeed`, `projectileWeight`, and `projectileBounciness` live in `CreatureSaveData`/`Creature` (`astronaut-game/src/creature.ts:111-172`, `astronaut-game/src/creature.ts:179-280`)
- projectile spawning is centralized in `spawnCreatureProjectile()` (`astronaut-game/src/game.ts:3039-3123`)
- grenade-like creature shots are modeled as `Collectable` instances, which is a good modern generalization of BBC “projectiles are just objects too” (`astronaut-game/src/game.ts:2986-3018`, `astronaut-game/src/collectable.ts:27-147`)
- the world designer already exposes these combat knobs directly to authors (`astronaut-game/src/world-designer.ts:8757-8975`)

## Combat behavior and authored ecology

The BBC source repeatedly ties combat to authored relationships between creature types, not just to damage numbers.

Examples:

- **Green/cyan frogmen** daze and damage the astronaut on contact (`original_source.asm:11209-11217`).
- **Birds** can damage on contact and also eat wasps (`original_source.asm:11483-11519`).
- **Big fish** eat pirahnas, but only really operate underwater (`original_source.asm:11658-11677`).
- **Maggots** pursue crew/player targets, make proximity noise, and only deal damage when they are actually on the target (`original_source.asm:12719-12788`).
- **Wasps / pirahnas** intermittently target the player or each other, damage on contact, and lose effectiveness when out of their proper element (`original_source.asm:12848-12912`).
- **Imps** have a fed/unfed state, interact with flowerpots, can hand out gifts, and can still attack when their target/support conditions line up (`original_source.asm:11282-11420`).

This ecology is one of the most reusable design lessons in the original source: creatures are interesting because they have relationships with the world and with each other.

### Modern TypeScript hooks

The modern game already has explicit systems that can carry this forward:

- creature-vs-astronaut push and contact damage (`astronaut-game/src/game.ts:3457-3508`)
- creature damage, death thresholds, and carry-proxy conversion (`astronaut-game/src/game.ts:2833-2887`)
- wasp predation already exists as a clean explicit rule (`astronaut-game/src/game.ts:3434-3454`)

## Important archetypes to preserve conceptually

| Archetype | BBC behavior to preserve | Good modern representation |
| --- | --- | --- |
| Frogmen | Aggressive local melee, hazard avoidance, timer-driven attack presentation, contact daze/damage (`original_source.asm:11189-11277`) | Ground creature with authored follow/avoid rules, contact damage, jump/lunge timing |
| Birds | Velocity-driven presentation, intermittent pursuit, wasp predation, variant-specific sound/invisibility (`original_source.asm:11455-11526`) | Flying archetype with follow range, predator toggle, sound profile, authored sprite variants |
| Wasps / pirahnas | Nest-dweller swarm logic, intermittent player tracking, environment-sensitive movement (`original_source.asm:12848-12912`) | Hover/fly/swim-style archetype with prey/pack rules and habitat tags |
| Imps | Stateful fed/unfed behavior, flowerpot home interaction, gifts, opportunistic attacks (`original_source.asm:11282-11420`) | Scriptable “mischief NPC” archetype with state machine fields in `Creature.state` |
| Turrets / robots | Energy-gated ranged fire, per-type projectile identity, stationary vs mobile variants (`original_source.asm:12793-12842`) | `fireMode` plus fixed/turret movement, cooldowns, projectile presets |
| Clawed robots / triax / hovering robots | Teleport-in pressure, thrust, ranged harassment, spectacle (`original_source.asm:11604-11653`, `original_source.asm:11768-11860`) | Boss/special archetypes using explicit scripted states rather than generic enemy loops |
| Maggots | Sticky pursuit, contact-only damage, strong proximity identity (`original_source.asm:12719-12788`) | Ground pursuer with sound hooks and simple but high-pressure chase rules |
| Big fish | Predator chain member that only matters in its proper habitat (`original_source.asm:11658-11677`) | Environment-tagged predator that wakes only in water zones |

## What to preserve vs. what to modernize

### Preserve

- **Per-archetype authored behavior** rather than flattening everything into one configurable enemy loop.
- **Target / avoid / prey relationships** between creatures, hazards, and the astronaut.
- **Presentation driven by motion and intent**, especially facing-from-travel and velocity-linked animation.
- **Energy-gated combat asymmetry** so some enemies feel hesitant, inaccurate, or intermittent instead of machine-perfect.
- **Creature ecology**: predators eating prey, habitat-sensitive motion, fed/unfed states, teleporting ambushers, and similar authored quirks.

### Modernize

- Keep behavior data explicit in `Creature` / `CreatureSaveData` and editable in the world designer instead of reproducing 6502 bit packing (`astronaut-game/src/creature.ts:111-172`, `astronaut-game/src/world-designer.ts:8757-8975`).
- Keep projectiles and throwable combat objects modeled through the modern `Collectable` and projectile systems rather than inventing BBC-style stack-object internals (`astronaut-game/src/collectable.ts:27-147`, `astronaut-game/src/game.ts:2986-3123`).
- Use the modern render helpers for rotation, alignment, palette cycling, and overlay feedback instead of literal sprite-index swapping (`astronaut-game/src/utilities.ts:62-84`, `astronaut-game/src/utilities.ts:278-360`, `astronaut-game/src/game.ts:3563-3580`).
- Improve readability and authoring ergonomics where helpful: explicit ranges, cooldowns, home positions, patrol bounds, hover amplitude, visible damage feedback, and inspector controls are all good modern additions.
- Keep the modern game modern: **do not remove fullscreen behavior, the world designer, or other modern UX/tooling** in pursuit of BBC fidelity.

## Recommended implementation direction for later TypeScript parity work

If the modern project wants to become more BBC-informed later, the safest path is:

1. keep the current data-driven creature schema and editor
2. add optional authored behaviors that emulate BBC priorities (target, avoid, prey, habitat, fed state, teleport style)
3. keep the existing modern rendering/palette/editor/tooling stack
4. port the *behavioral intent* of iconic archetypes first, not the byte-level implementation details

That should preserve what makes the BBC creatures distinctive without regressing the modern project’s usability or maintainability.
