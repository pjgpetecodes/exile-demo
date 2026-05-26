# Creature ecology and behavior

This note builds on `docs/bbc-source/creatures-and-combat.md` and `docs/bbc-source/creature-presentation-and-firing-fidelity.md`, but reframes the BBC material as an **ecosystem** problem: how creatures choose targets, feed, threaten, avoid, persist, and create local food chains or hazard chains. The BBC game is valuable here because its creatures are rarely just “enemy actors”; they are small rule bundles embedded in a world of prey, habitat, pickup-like objects, and screen-relative behaviors (`original_source.asm:6541-6650`, `original_source.asm:7926-7969`, `original_source.asm:9600-9928`, `original_source.asm:11189-12912`).

The modern TypeScript game already has a useful base for this interpretation: authored creature schema and runtime state in `astronaut-game/src/creature.ts`, centralized projectile/collectable handling in `astronaut-game/src/game.ts` and `astronaut-game/src/collectable.ts`, designer-visible tuning in `astronaut-game/src/world-designer.ts`, and shared projectile tuning in `astronaut-game/src/settings.ts` (`astronaut-game/src/creature.ts:111-172`, `astronaut-game/src/creature.ts:179-280`, `astronaut-game/src/game.ts:2833-3559`, `astronaut-game/src/collectable.ts:27-147`, `astronaut-game/src/world-designer.ts:8800-8950`, `astronaut-game/src/settings.ts:43-142`).

## Ecosystem thesis

The BBC mechanics make the world feel alive by combining six ideas:

1. **intermittent target search** instead of perfect continuous tracking
2. **multiple relationship types** (hunt, avoid, absorb, ignore, fire at)
3. **habitat dependence** (water creatures, flyers, wall-avoiders, screen-relative behavior)
4. **feeding / absorption state** that changes aggression or rewards
5. **authored archetypes** with distinct exceptions instead of one generic enemy loop
6. **runtime / offscreen rules** that decide when a creature disappears, teleports, wakes, or only becomes noisy near the screen (`original_source.asm:6600-6649`, `original_source.asm:9600-9928`, `original_source.asm:11305-11326`, `original_source.asm:11658-11677`, `original_source.asm:11852-11863`, `original_source.asm:12760-12788`, `original_source.asm:12848-12912`).

That combination is more important than literal 6502 implementation details.

## BBC ecology primitives

### 1. Targeting is a priority stack, not a single chase rule

The BBC code does not treat AI as “always pursue the astronaut.” `find_target_occasionally` throttles reacquisition, `find_nearest_object` can search by type or range and sometimes accept a random good-enough candidate, and `npc_targetting` layers primary target, secondary/avoid target, absorbable prey, fed state, and damage/status bits into one compact state update (`original_source.asm:6541-6650`, `original_source.asm:9600-9741`).

The nearby lookup tables show that creature motivations are authored per archetype: imps, robots, slime, chatter, and frogmen all have different `find`, `absorb`, `fire`, `gift`, and bitflag relationships (`original_source.asm:7926-7969`).

**Design reading:** the BBC ecosystem works because each creature can simultaneously:

- pursue something
- avoid something
- consume something
- use the astronaut as only one candidate among several

### 2. Feeding and absorption are first-class behavior inputs

`npc_targetting` explicitly checks `npc_absorb_lookup` and `absorb_object`, then records whether the NPC is fed before later behavior branches run (`original_source.asm:6632-6649`). This is not cosmetic. Feeding changes what some creatures do next.

Key examples:

- **Birds** absorb wasps before continuing their movement logic (`original_source.asm:11506-11519`).
- **Big fish** absorb pirahnas and only become active enough to matter when underwater (`original_source.asm:11658-11677`).
- **Imps** have fed/unfed behavior, can disappear into flowerpots, and can emit gifts when returning “home” to the pot after being fed (`original_source.asm:11305-11326`, `original_source.asm:11330-11354`).
- **Triax** can absorb a special world object and then teleport away with it (`original_source.asm:11604-11616`).

**Design reading:** feeding is a strong ecology tool because it links combat, traversal, rewards, and world props without needing a separate quest system.

### 3. Aggression is intermittent and conditional

The BBC uses energy gates and cadence checks to keep aggression from feeling uniform. `find_a_target_and_fire_at_it` uses energy to affect firing probability, and `enemy_fire` adds extra randomness to the shot after target selection (`original_source.asm:6541-6599`). Contact damage is also conditional rather than constant:

- frogmen only hurt/daze on actual touch (`original_source.asm:11208-11217`)
- birds damage on contact and also hunt wasps (`original_source.asm:11483-11519`)
- maggots only deal damage when they are actually on their target (`original_source.asm:12740-12748`)
- wasps / pirahnas only damage when their contact/pathing conditions line up (`original_source.asm:12868-12877`)

**Design reading:** BBC hostility feels alive because creatures oscillate between patrol, hunt, feed, and momentary attack windows.

### 4. Habitat matters

The source repeatedly stops creatures from behaving at full strength outside their proper element:

- big fish are functionally inert unless underwater (`original_source.asm:11663-11677`)
- birds are damped by underwater state (`original_source.asm:11522-11525`)
- wasps / pirahnas lose movement when out of element (`original_source.asm:12887-12912`)
- frogmen react differently around support/wall/water state (`original_source.asm:11221-11277`)

**Design reading:** ecology is not just predator/prey; it is also “which biome lets this creature express itself?”

### 5. Offscreen and runtime status are gameplay mechanics

The BBC does not treat offscreen state as mere optimization. It uses screen-relative runtime state as part of creature logic:

- generic NPC movement checks `object_onscreen`, and `force_object_offscreen` can actively push an object out of present play (`original_source.asm:6865-6874`)
- imps disappear into flowerpots by forcing themselves offscreen (`original_source.asm:11316-11326`)
- clawed robots / teleporting enemies only jump near the player when offscreen, using `object_onscreen` and teleport flags (`original_source.asm:11852-11863`, `original_source.asm:1822-1830`)
- maggots become noisier near the screen center via `get_object_distance_from_screen_centre` (`original_source.asm:8564-8570`, `original_source.asm:12755-12788`)

**Design reading:** offscreen behavior is part of the ecology loop: disappear, reposition, re-enter, threaten from nearby, or stay dormant until presence matters.

## Current TypeScript ecology reading

### Creature schema already supports authored archetypes

`createCreatureSaveData()` and `Creature` already expose exactly the kind of explicit authored knobs that a modern ecology system wants: hostility, contact damage, follow/track range, movement mode, home/patrol bounds, hover amplitude, fire mode, projectile tuning, can-eat-wasps, jump behavior, teleport-home behavior, pickup/storable flags, sound settings, and open-ended `state` storage (`astronaut-game/src/creature.ts:111-172`, `astronaut-game/src/creature.ts:179-280`).

This is already a better authoring surface than BBC bit packing.

### Runtime behavior is currently astronaut-centric, but not empty

`updateCreatures()` loops every creature each frame, derives astronaut distance, gates tracking with `trackRange` / `followRange`, applies movement mode logic, optionally teleports creatures home if they stray too far, and fires on cooldown when the astronaut is in range (`astronaut-game/src/game.ts:3259-3431`). That is a clean baseline, but it is still much flatter than the BBC ecology stack.

What is already ecology-friendly:

- **movement niches**: ground / fly / hover / turret (`astronaut-game/src/creature.ts:140-155`, `astronaut-game/src/game.ts:3301-3391`)
- **home territory**: home coordinates and patrol bounds (`astronaut-game/src/creature.ts:142-149`, `astronaut-game/src/game.ts:3284-3292`)
- **predation seed**: explicit wasp predation via `canEatWasps` (`astronaut-game/src/game.ts:3434-3454`)
- **ambient identity**: per-creature sound cadence gated by astronaut distance (`astronaut-game/src/game.ts:3512-3559`)

### Combat objects already behave like ecology objects

The modern projectile path preserves an important BBC idea: hostile outputs are still world objects.

- `spawnCreatureProjectile()` creates either projectile collectables or grenade-like collectables with shared spawn safety and runtime metadata (`astronaut-game/src/game.ts:3039-3123`)
- creature projectiles can bounce, home, expire, explode, or convert into energy-pod collectables (`astronaut-game/src/game.ts:3170-3257`)
- `Collectable` carries TTL, velocity, ambient sound, grenade arming, and `creaturePayload` / `creatureProjectile` runtime data (`astronaut-game/src/collectable.ts:27-147`)
- projectile tuning is centralized in `CREATURE_PROJECTILE_SETTINGS` and `MOVEMENT_SETTINGS` (`astronaut-game/src/settings.ts:43-142`)

That makes later BBC-style “feeding / spawning / dropping / transforming” behavior much easier to add without inventing new runtime categories.

### Damage and post-death handling already support world continuity

Damage is accumulated, flashed, and resolved through explicit thresholds; on death, pickup-enabled creatures can become carryable collectable proxies instead of simply vanishing (`astronaut-game/src/game.ts:2833-2888`). That is a good modern equivalent to BBC object conversion behavior.

### Designer support is already strong

The world designer exposes the ecology-relevant fields directly: damage on contact, follow/track range, movement mode, home/patrol bounds, hover amplitude, fire mode, projectile stats, wasp-eating, teleport-home, pickup, and storage (`astronaut-game/src/world-designer.ts:8800-8950`). This should remain the primary place where ecology is authored.

## Where the current TS model is still thin

Compared to the BBC reading, the main gaps are:

1. **few creature-to-creature priorities** beyond `canEatWasps`
2. **no generic absorb/feed state loop** comparable to `npc_absorb_lookup` and `npc_fed`
3. **continuous perfect astronaut awareness** inside range, instead of occasional reacquisition (`astronaut-game/src/game.ts:3281-3401`; `original_source.asm:9600-9741`)
4. **limited habitat semantics** beyond movement mode and teleport-home
5. **little explicit offscreen ecology**, even though the current runtime already supports persistent world entities and sound gating (`astronaut-game/src/game.ts:725-754`, `astronaut-game/src/game.ts:3259-3559`)

The current game updates all creatures in the global array each frame and uses range mainly for behavior choice, not for wake/sleep state (`astronaut-game/src/game.ts:3259-3431`). That is readable and stable, but it does not yet exploit BBC-style “offscreen staging” or “near-screen pressure.”

## Hazard archetypes worth preserving

| Archetype | Ecology role in BBC | Best modern direction |
| --- | --- | --- |
| Frogmen | Local territorial melee hazard, player daze, wall/water-sensitive pressure (`original_source.asm:11189-11277`) | Preserve as proximity predators with contact effects and environment-aware movement |
| Birds | Opportunistic predator plus atmospheric fauna; can hurt player and eat wasps (`original_source.asm:11483-11525`) | Preserve as flying predator/scavenger with authored prey tags and sound identity |
| Wasps / pirahnas | Swarm / nest hazard with target intermittency and habitat dependence (`original_source.asm:12848-12912`) | Preserve as habitat-tagged pack threats rather than generic chasers |
| Imps | Mischief NPCs with feeding, home-object interaction, gifting, and opportunistic attacks (`original_source.asm:11282-11420`) | Preserve as stateful ecology actors, not just combatants |
| Maggots | Sticky pursuit, target-cling damage, near-screen audio pressure (`original_source.asm:12719-12788`) | Preserve as high-pressure ambient hazard with strong presence cues |
| Turrets / robots | Energy-gated ranged hazard with distinct projectile identities (`original_source.asm:12793-12842`) | Preserve via explicit fire presets, not generic gun logic |
| Clawed robots / hovering robots / triax | Teleport ambushers that manipulate presence and spectacle (`original_source.asm:11604-11616`, `original_source.asm:11768-11863`) | Preserve as special runtime-state archetypes with offscreen entry rules |
| Big fish | Habitat-locked predator in a food chain (`original_source.asm:11658-11677`) | Preserve through water-only wake logic and prey tags |

## Preserve vs modernize

### Preserve

- **Authored food chains and rivalries.** The BBC creatures feel alive because they eat, avoid, and react to each other, not just the astronaut.
- **Intermittent aggression.** Reacquisition cadence, energy-gated firing, and local contact windows are core to the feel.
- **Habitat dependence.** Water, air, home objects, and local territory should continue to matter.
- **Offscreen presence rules.** Teleporters, disappear/reappear behavior, and near-screen sound pressure are worth keeping conceptually.
- **Object continuity.** Projectiles, gifts, drops, and post-death conversions should keep behaving like world objects.

### Modernize

- Keep ecology data explicit in `Creature`, `Collectable`, and designer controls instead of recreating BBC lookup tables literally (`astronaut-game/src/creature.ts:111-172`, `astronaut-game/src/world-designer.ts:8800-8950`).
- Keep centralized projectile and collectable logic instead of reintroducing BBC object-stack internals (`astronaut-game/src/game.ts:3039-3257`, `astronaut-game/src/collectable.ts:27-147`).
- Prefer readable tags and fields such as `preyTags`, `avoidTags`, `habitat`, `wakeRadius`, `reacquireMs`, or `fedState` over bitfields.
- Preserve modern readability: stable rendering, clear collision, visible damage flash, editor tuning, and understandable runtime state.

## Most valuable later implementation directions

### 1. Add ecology relationships before adding more raw combat tuning

The highest-value next step is not “more bullets.” It is adding optional authored relationships:

- prey / absorb target types
- avoid target types
- ally / flock / nest tags
- habitat tags
- fed / hungry / carrying states

That would unlock BBC-like creature stories with relatively little code surface.

### 2. Add target reacquisition cadence

Per-creature `reacquireMs` or similar would restore a major BBC feel improvement: creatures should not look omniscient every frame. This is especially valuable for flyers, swarmers, and turret-like shooters (`original_source.asm:9600-9741`; `astronaut-game/src/game.ts:3393-3401`).

### 3. Add offscreen ecology, not just optimization

The BBC model suggests rules such as:

- dormant until near screen or near astronaut
- offscreen teleport-home / teleport-near-player
- audio-only warning before full appearance
- preserve world state while temporarily suppressing expensive behavior

This is valuable because it improves both atmosphere and scalability, while fitting the current persistent-entity runtime.

### 4. Formalize feeding / absorption loops

Feeding is one of the strongest BBC ideas because it links combat, rewards, and ecology. A modern version could use explicit callbacks or tags instead of hardcoded object numbers, while still reusing the current collectable/projectile/object pipeline.

### 5. Use the world designer as the ecology control panel

Any BBC-inspired work should remain visible and tunable in the designer. The project already has the right editor surface; ecology work should expand that strength rather than bypass it (`astronaut-game/src/world-designer.ts:8800-8950`).

## Bottom line

The BBC creature model is best understood as a **living hazard ecosystem**: creatures hunt, avoid, feed, patrol, disappear, re-enter, and sometimes produce rewards or secondary threats. The current TypeScript code already has the right foundations for this reading—explicit creature schema, object-based projectiles, carry-proxy conversion, designer-tunable movement/combat fields, and distance-gated sound/runtime state. The most valuable future work is therefore to add **relationship logic and offscreen ecology**, not to chase literal assembly parity (`original_source.asm:6541-6650`, `original_source.asm:7926-7969`, `original_source.asm:9600-9928`, `original_source.asm:11189-12912`; `astronaut-game/src/creature.ts:111-172`, `astronaut-game/src/game.ts:2833-3559`, `astronaut-game/src/collectable.ts:27-147`, `astronaut-game/src/world-designer.ts:8800-8950`, `astronaut-game/src/settings.ts:43-142`).
