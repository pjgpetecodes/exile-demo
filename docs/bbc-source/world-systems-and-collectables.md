# BBC Micro Exile: world systems and collectables

## Purpose

This note extracts the BBC Micro game's world-facing systems from `original_source.asm` so the modern project can reuse the *structure* of Exile's design without copying its opaque UI or 8-bit constraints.

## Source anchors

- Background/system object families are listed together in the handler table, including invisible switches, teleport beams, doors, switches, mushrooms, nests, doors, keys, equipment, coronium, and the destinator (`original_source.asm:404-533`).
- Persistent world-state bytes show what the BBC game tracked globally: collected keys, booster/weapons/immunities, mushroom daze, door timer, teleports used, teleport coordinates, pocket contents, and per-weapon energy (`original_source.asm:994-1076`).
- Modern equivalents are already data-driven through typed save data for buttons, doors, and collectables in `astronaut-game\src\world-designer.ts:22-90`, runtime collectable state in `astronaut-game\src\collectable.ts:27-147`, button state in `astronaut-game\src\button.ts:15-139`, door state in `astronaut-game\src\door.ts:3-144`, and runtime loading / interaction glue in `astronaut-game\src\game.ts:586-618`, `astronaut-game\src\game.ts:1607-1623`, `astronaut-game\src\game.ts:3698-3811`.

## What the BBC game is actually doing

The BBC original is not just “a platformer with pickups”. Its world is a shared simulation where creatures, hazards, doors, switches, materials, and key items all participate in the same object system. Many objects matter because they can be **carried**, **absorbed**, **converted**, **fed to something else**, or **used to toggle world state** (`original_source.asm:404-533`).

That is the distinct Exile feel to preserve: progress comes from learning the world's transformations and dependencies, not only from jumping skill or one-off scripted locks.

## Collectables and long-lived resources

The collectable table is broader than simple treasure. It includes:

- six active key variants
- jetpack booster
- weapon unlocks / devices: pistol, icer, discharge device, plasma gun
- survivability gear: protection suit, fire immunity, mushroom immunity, radiation immunity
- whistles as world-control tools (`original_source.asm:514-532`)

The global state table shows that these are treated as persistent capability flags rather than disposable score items. Keys, booster, weapons, suit/immunities, whistles, and radiation protection all have dedicated state bytes, alongside weapon energy and pocket contents (`original_source.asm:994-1076`).

When the player is holding a collectable, the collectable handler sets the relevant “collected” byte, plays a sound, and removes the object from the world (`original_source.asm:12300-12308`). In other words: BBC Exile's pickups are mostly **world-state mutations**.

### Modern mapping

The modern game already has the right substrate for this:

- typed collectable save data supports `held`, `stored`, `storable`, `pickupEnabled`, weight, and palette state (`astronaut-game\src\world-designer.ts:60-81`)
- the runtime `Collectable` class tracks held / stored / armed / payload state (`astronaut-game\src\collectable.ts:27-147`)
- the current game loop already supports pickup, storage cycling, release, and throwing (`astronaut-game\src\game.ts:3705-3811`)

That means later BBC-inspired systems should likely be represented as **typed collectable behaviors plus persistent world flags**, not hardcoded one-off scripts.

## Switches, doors, and teleports

### Switches

Switches only fire when touched by something “heavy enough”, with explicit exclusions such as engine fire; when newly pressed they toggle their state bit, run a switch-effects table, and update their visual in/out pose (`original_source.asm:11980-12061`). This is important: a switch is not just a player button. It is a **physics-reactive world relay**.

### Doors

Doors are more than binary blockers. The BBC handler:

- checks contact pressure similarly to switches
- can be toggled by the remote control / RCD beam
- changes lock/open state through encoded bits
- animates position and palette
- uses a shared `door_timer` so some timing behavior is global, not purely local (`original_source.asm:1023-1024`, `original_source.asm:12451-12597`)

So classic Exile doors are best understood as **stateful moving mechanisms**, not just tilemap solids.

### Teleports

There are two relevant teleport models in the BBC source:

1. **Player recall teleporting**: the player can teleport only when not holding something, consuming a rotating history/fallback list stored in dedicated teleport slots (`original_source.asm:1038-1048`, `original_source.asm:1801-1833`).
2. **World teleport beams**: beam objects have numbered destinations, can teleport touched objects, can be inactive/active, and can have their state toggled by the RCD beam (`original_source.asm:7920-7923`, `original_source.asm:12604-12652`).

### Modern mapping

The modern project already has:

- authorable button-door linking (`astronaut-game\src\world-designer.ts:22-58`)
- runtime button-to-door toggling on collision (`astronaut-game\src\game.ts:1607-1623`)
- animated door runtime state (`astronaut-game\src\door.ts:42-144`)
- a modernized player teleport-memory system with save/recall UX (`astronaut-game\src\game.ts:1352-1383`)

If BBC beam teleports are added later, they should extend this modern data-driven layer, not replace the current convenient teleport UX.

## Hazards, immunities, and material rules

Exile's hazards are tightly coupled to collectible protection.

### Mushrooms and daze

Mushroom effects increase red/blue mushroom daze counters, play feedback, and extend player immobility unless the mushroom immunity pickup has already been collected (`original_source.asm:1025-1028`, `original_source.asm:10471-10499`). Green frogmen also directly inflict mushroom daze and damage on contact (`original_source.asm:11208-11217`).

### Fire

Fireball collision checks special-case player immunity via the fire-immunity collectable before applying damage (`original_source.asm:12195-12219`).

### Coronium, radiation, and endgame pressure

Coronium boulders / crystals are both resource-like and hazardous. Contact or collisions can trigger explosions, and simply holding / touching coronium damages the player unless they have radiation protection or are underwater (`original_source.asm:10756-10801`). The maggot machine crossing the water threshold triggers both earthquake and endgame state, so environmental change and narrative escalation are part of the same systemic layer (`original_source.asm:10740-10745`).

## Transformation chains and progression loops

These chains are what make Exile feel unusual.

### 1. Ecology loops

- Nests absorb nearby children, maintain minimum energy, and probabilistically spawn more children when active and not locally suppressed (`original_source.asm:12328-12375`).
- Big fish eat pirahnas (`original_source.asm:11658-11677`).
- Birds, chatter, imps, slime, and other actors each have absorb / feed / react rules summarized in the NPC tables (`original_source.asm:7938-7958`).

This is a living resource graph, not a static enemy roster.

### 2. Item transformation chains

- Mushroom balls hit by fireballs convert into coronium crystals (`original_source.asm:11535-11555`).
- Red drops convert yellow balls into coronium boulders (`original_source.asm:11699-11724`).
- Full flasks disturbed near fire consume the fire and eventually convert back to empty flasks (`original_source.asm:11076-11107`).

The world is full of “if object A meets object B, the result is C” rules.

### 3. Feed -> reward loops

Imps have explicit lookup tables for what they absorb, what they fire, and what gift they can produce; fed imps reaching their flowerpot can emit gifts such as energy capsules, grenades, weapons, or coronium-related items (`original_source.asm:1058-1059`, `original_source.asm:11282-11326`, `original_source.asm:7938-7958`).

Chatter listens for whistle 1, absorbs coronium crystals, stores reserve energy, and can switch between inactive and active forms based on that energy and whistle state (`original_source.asm:1017-1020`, `original_source.asm:11866-11903`, `original_source.asm:7265-7280`).

These are progression loops because the player is really learning **what to feed, where to carry it, and what world state it unlocks**.

### 4. Objective-object loops

Triax can absorb the destinator, send it back to its lair, and teleport away; the destinator itself is an active world object tied to ship motion (`original_source.asm:11032-11049`, `original_source.asm:11604-11653`).

That is a very Exile-style pattern: the “objective item” is embedded in the same simulation as everything else, so the world can steal it back.

## What makes Exile distinct

The distinctive part is the **combination** of:

- persistent equipment/immunity state
- physical carry / drop / feed interactions
- creatures participating in puzzle logic
- doors and teleports as systemic mechanisms
- material transformation chains
- progression emerging from experimentation with the ecology (`original_source.asm:404-533`, `original_source.asm:994-1076`, `original_source.asm:7938-7958`)

Put differently: Exile's collectables matter because they change your relationship to the whole simulation.

## What to preserve vs what to modernize

### Preserve

- **Systemic interactions over scripted one-offs.** Prefer reusable rules such as feed, absorb, convert, unlock, immunize, or teleport.
- **World-stateful collectables.** Keys, suits, whistles, and immunity devices should feel like capability changes, not just score.
- **Multi-step progression loops.** Keep the “find -> carry -> combine/feed -> world change” structure.
- **Hazard/protection pairings.** Mushroom, fire, radiation, and similar dangers become interesting when paired with collectible countermeasures.
- **Doors/switches/teleports as part of the simulation.** They should be authorable mechanisms that can join puzzles and ecology, not just static map props.

### Modernize

- **Keep the current modern UX and tooling.** The in-game designer, typed JSON save data, save-preview workflow, current inventory affordances, and teleport-memory controls are all strengths, not problems (`astronaut-game\src\world-designer.ts:22-90`, `astronaut-game\src\game.ts:1352-1383`, `astronaut-game\src\game.ts:3705-3811`).
- **Expose BBC-style systems through explicit authored data.** Use `buttons`, `doors`, `collectables`, and creature/world data rather than bit-packed opaque bytes.
- **Use modern feedback.** Preserve the underlying logic but surface it with clearer audio/visual telegraphing, labels, inspector fields, and safer debugging hooks.
- **Prefer readable capability modeling.** For example, immunity, key ownership, or object-conversion rules should be inspectable/configurable in modern content pipelines.

## Recommended interpretation for later modern work

If this document is used to extend the current project later, the best target is not literal BBC parity. The better target is:

1. authorable world mechanisms
2. collectible-driven capability gates
3. ecology/resource conversion loops
4. clear modern UX around those systems

That keeps the project modern while preserving the specific kind of systemic world design that made Exile memorable.
