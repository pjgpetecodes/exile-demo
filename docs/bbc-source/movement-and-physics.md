# BBC Micro movement and physics model

This note summarizes how the original BBC Micro *Exile* builds its movement feel from byte-sized acceleration, weight classes, collision sampling, and environmental forces. The goal is to describe the play feel of the original rules, then contrast that with the modern TypeScript game without turning this into a direct porting checklist.

## Core idea

In the BBC game, motion is not just "gravity plus input." Each update resets per-object acceleration, lets controls and object handlers add small signed pushes, then folds those pushes into velocity, support checks, wall sampling, object-object momentum exchange, wind, water, and handler-specific logic. The result is a world where thrust, mass, and contact all keep influencing one another across frames instead of being isolated systems. Primary source: `original_source.asm:4556-4590`, `original_source.asm:5181-5218`, `original_source.asm:7232-7261`.

## Thrust and acceleration accumulation

- Each object starts its update by clearing `acceleration_x` and `acceleration_y`, then moving using its current velocity before later systems modify that motion state (`original_source.asm:4577-4589`).
- Player-style movement is expressed as tiny signed acceleration changes: `move_right`/`move_left` increment or decrement `acceleration_x`, `move_down`/`move_up` do the same for `acceleration_y`, and the booster can double both axes instead of replacing them (`original_source.asm:7232-7261`).
- `accelerate_object` adds accumulated acceleration into velocity on both axes, then applies a gentle periodic pull back toward zero on non-zero velocities. That gives the original game a slightly sticky, gliding feel rather than endless frictionless drift (`original_source.asm:5181-5218`).
- Jetpack particles are emitted only when acceleration is non-zero, so thrust feedback is tied to active acceleration rather than to raw velocity (`original_source.asm:5219-5240`).

### Feel takeaway

The BBC game feels responsive because input is a repeated nudge, but it also feels floaty because those nudges accumulate into velocity and decay only gradually. It is easy to overshoot, skim walls, or arrive with enough residual speed to make the next contact matter.

## Weight, gravity, drag, and buoyancy

- `object_gravity_flags` encodes both collision traits and weight. The low three bits are weight: `01` is light, `06` is heavy, and `07` means static (`original_source.asm:557-567`).
- During object setup, the engine reads that weight into `this_object_weight`. Objects with the static/gravity-disabled case have their velocities zeroed immediately, so "not affected by gravity" really means removed from the ordinary dynamic loop (`original_source.asm:4563-4569`).
- Carrying changes the player’s effective mass. When the player is holding something, the code remaps the held object's weight through `weight_when_held` and uses that adjusted value as the player's working weight for later physics decisions (`original_source.asm:4424-4425`, `original_source.asm:4591-4598`).
- Water is not a cosmetic overlay. The engine computes water level by x-range and continuously nudges each range toward a desired level, with a small bobbing motion layered on top (`original_source.asm:6380-6405`).
- In wall-collision processing, the engine also computes how submerged an object is. Submersion, object height, and weight combine to add upward bias to vertical motion for lighter bodies; underwater objects are then damped to `7/8` velocity periodically, making water simultaneously buoyant and resistive (`original_source.asm:7519-7616`, `original_source.asm:8048-8065`).

### Feel takeaway

Weight in BBC *Exile* is not just "falls faster." It affects whether objects stay dynamic, how collisions redistribute energy, how hard the player can carry something, and how strongly water and wind can bully a body around.

## Momentum exchange between objects

- Support/contact resolution first finds overlapping nearby objects, measures overlap on both axes, and resolves along the smallest overlap axis so the interaction feels like a shove rather than a teleport (`original_source.asm:6933-7113`).
- The engine computes the weight difference between the two bodies before exchanging momentum (`original_source.asm:7046-7056`).
- In `do_momentum_exchange`, collision velocity delta is halved once per step of weight difference before being written back out. In practice, heavier objects keep more of their motion and lighter objects get redirected more violently (`original_source.asm:7147-7172`).
- Collision flags also encode whether a transfer should reinforce or oppose the current direction, so glancing impacts and direct impacts do not feel identical (`original_source.asm:7081-7146`).

### Feel takeaway

The original game sells "mass" by making contact asymmetric. A heavy body can bully a lighter one, while a light body mostly ricochets or gets carried along.

## Wall response and collision feel

- Wall collision is sampled from the object's extents, not handled as a single point test. The engine counts contact on top, bottom, left, and right edges, then derives signed differences such as `wall_collision_top_minus_bottom` and `wall_collision_bottom_minus_top` (`original_source.asm:7519-7749`).
- Those counts are turned into a `wall_collision_angle`, followed by a post-collision angle and a stored friction-related velocity term (`wall_collision_frict_y_vel`). That means the wall response keeps some notion of impact direction and scrape severity rather than just flipping one axis (`original_source.asm:7751-7819`).
- If there is no clean directional solution, the routine falls back to restoring the old position and inverting both velocities, which helps explain the original game's occasional hard rebounds when geometry gets tight (`original_source.asm:7725-7749`).
- The player can take collision damage based on wall angle and collision-friction velocity, so high-speed scenery contact is part of the danger model, not only enemy fire (`original_source.asm:4647-4659`).

### Feel takeaway

BBC *Exile* collisions are crunchy and sometimes harsh. The game wants wall glances, scrapes, and rebounds to feel like physical events with consequences, not like invisible movement clamps.

## Carrying and throwing

- A held object is snapped beside the player each frame using sprite dimensions and facing, then made to inherit the player's current velocities and angle flags (`original_source.asm:4600-4641`).
- The game monitors whether the held object has drifted too far from its intended attach point and will forcibly drop it if the relationship becomes unstable (`original_source.asm:4832-4851`).
- Support logic also checks whether the player and held item are creating an impossible support situation, preventing some self-support loops (`original_source.asm:4855-4867`, `original_source.asm:7017-7026`).
- Throwing is weight-sensitive. `throw_velocities` gives lighter objects a larger base throw speed and heavier ones a much smaller one, then the throw adds the thrower's current x-velocity and, in many cases, y-velocity as well (`original_source.asm:8190-8216`).

### Feel takeaway

In the BBC game, carrying is part of the physics model, not a separate inventory abstraction. A held item changes your mass, follows your motion, can destabilize supports, and throws differently depending on weight.

## Wind and water as active forces

- Wind is a real field in the upper map. If an object is above `y = &4f`, the engine derives a wind effect from both y-position and x-position, then applies `do_wind_motion`; object weight is part of the calculation, so lighter things are pushed around more (`original_source.asm:4777-4822`).
- Water interaction is continuous rather than binary. The code calculates submersion depth, produces splash particles on entry, applies damping while submerged, and can add upward push depending on weight and immersion (`original_source.asm:7519-7616`).

### Feel takeaway

Environmental media matter because they reshape control authority. Wind robs precision in exposed areas; water slows, softens, and floats bodies instead of merely tinting the screen.

## How this differs from the modern TypeScript game

### Astronaut motion

- The modern astronaut uses explicit float settings for gravity, takeoff impulse, walking acceleration, flying acceleration, caps, and landing momentum in `settings.ts`, then applies them directly in `astronaut.ts` (`astronaut-game/src/settings.ts:3-65`, `astronaut-game/src/astronaut.ts:81-225`).
- Gravity is a small standalone helper that adds a scalar downward acceleration with a configurable terminal speed, rather than a per-object byte-flag system (`astronaut-game/src/gravity.ts:3-14`, `astronaut-game/src/game.ts:1555-1566`).
- Walking in the TypeScript game is more legible and player-friendly: start speed, walk acceleration, and post-landing momentum are explicit tuning knobs instead of emergent results from the full object solver (`astronaut-game/src/astronaut.ts:122-225`).

### Dynamic object physics

- Loose objects in the TypeScript game share a generalized physics model with tunable gravity, bounce restitution, ground friction, push resistance, and head-bounce launch speed (`astronaut-game/src/object-physics.ts:3-127`, `astronaut-game/src/game.ts:4033-4155`).
- Weight still matters, but it is used as a floating-point scaling factor for friction, bounce, and push response instead of being a 3-bit class that participates in the same global solver as every other body (`astronaut-game/src/object-physics.ts:34-116`).
- The modern collision model is clearer and less punishing: it resolves stepwise movement, optional bounce, floor snapping, and friction separately, which is easier to tune than the BBC wall-angle pipeline (`astronaut-game/src/game.ts:4065-4155`).

### Carrying and throwing

- Modern carrying is more explicit and more feature-rich. The current game keeps a held collectable at authored offsets, supports storage/inventory cycling, and throws with a chosen angle plus a fixed throw speed (`astronaut-game/src/game.ts:2437-2475`, `astronaut-game/src/game.ts:3584-3815`, `astronaut-game/src/settings.ts:23-64`).
- That differs from the BBC model, where carrying directly alters the same world-physics state used by everything else and throw speed is strongly quantized by weight (`original_source.asm:4424-4425`, `original_source.asm:4591-4598`, `original_source.asm:8190-8216`).

### Environmental forces

- The BBC source has dedicated wind and water behavior in the object update loop (`original_source.asm:4777-4822`, `original_source.asm:6380-6405`, `original_source.asm:7519-7616`).
- The modern TypeScript files named in this doc do not currently show an equivalent always-on wind field or full water-medium simulation in the main movement path; the present feel comes more from gravity, caps, bounce, friction, and authored encounter logic (`astronaut-game/src/gravity.ts:3-14`, `astronaut-game/src/object-physics.ts:24-127`, `astronaut-game/src/game.ts:1555-1566`, `astronaut-game/src/game.ts:4033-4155`).

## What to preserve vs what to modernize

### Preserve

- **Inertia-rich control.** Thrust should still feel like repeated nudging of a body with momentum, not instant grid movement.
- **Mass-sensitive interactions.** Carrying, pushing, rebounds, and throws should continue to communicate that some objects are easy to bully and others are not.
- **Contact with personality.** Scrapes, glancing impacts, head-bonks, and awkward rebounds are part of *Exile*'s identity.
- **Environmental mood.** If wind or water are represented, they should change control authority and route planning, not just visuals.

### Modernize

- **Keep the current explicit tuning model.** `settings.ts`, `gravity.ts`, and `object-physics.ts` make the modern game far easier to understand and tune than the BBC bytecode-style coupling.
- **Keep modern affordances.** Do not throw away the current expanded-viewport/fullscreen-style workflow or the in-app world designer just to mimic BBC constraints (`astronaut-game/src/game.ts:542-547`, `astronaut-game/src/game.ts:1240-1260`, `astronaut-game/src/world-designer.ts:2548-2554`).
- **Keep current tooling.** The TypeScript build/dev flow is a strength of the modern project, not a compromise to apologize for (`astronaut-game/package.json:6-25`).
- **Translate feel, not implementation.** Preserve the original's asymmetry, momentum, and physical consequences while using modern code structure and editor tooling.

## Bottom line

The BBC Micro original gets its feel from stacked, interacting rules: tiny acceleration nudges, slow velocity decay, encoded weight classes, asymmetric momentum exchange, aggressive wall response, and environmental media that really interfere with motion. The modern TypeScript game already modernizes presentation, tuning, editing, and tooling; the main thing worth preserving is the *behavioral texture* of the original, not its exact low-level implementation.
