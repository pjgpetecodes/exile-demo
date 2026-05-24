# BBC Micro Exile: resources and progression fidelity

## Purpose

This note builds on `docs\bbc-source\movement-and-physics.md`, `docs\bbc-source\core-movement-fidelity.md`, and `docs\bbc-source\world-systems-and-collectables.md`. Those docs already cover motion, carrying, and world-state mechanisms. This one focuses on the missing layer that makes classic *Exile* feel uniquely tense: the linked loops around player energy, jetpack fuel, weapon energy, suit/immunity, daze, and progression pressure.

The goal is not to recreate the BBC implementation literally. It is to describe the original game's **resource grammar** in modern design terms, then point at the current TypeScript files that could later host those behaviors in explicit typed systems.

## Source anchors

- The BBC save/state area shows the core persistent economy in one place: keys, booster, weapons, suit/immunities, mushroom daze, teleport memory, pockets, current weapon, and six energy channels (`original_source.asm:994-1076`).
- Collectable IDs confirm the important long-term pickups: keys, booster, pistol, icer, discharge device, plasma gun, protection suit, fire immunity, mushroom immunity, whistles, and radiation immunity (`original_source.asm:514-533`).
- The player loop ties low energy to impaired movement and jetpack reliability, and ties severe damage/mushrooms to daze (`original_source.asm:8950-9120`, `original_source.asm:10488-10499`).
- Weapon/suit/jetpack energy all run through the same energy tables and depletion helpers (`original_source.asm:7324-7420`).
- Damage, suit mitigation, fire immunity, and radiation exceptions are all explicit systemic checks rather than one-off cutscene logic (`original_source.asm:6139-6178`, `original_source.asm:10765-10797`, `original_source.asm:12191-12219`).
- The current TypeScript project already has useful modern substrate in explicit movement tuning, held-weight penalties, teleport memory, collectable runtime state, and typed world data (`astronaut-game\src\settings.ts:3-64`, `astronaut-game\src\astronaut.ts:33-225`, `astronaut-game\src\game.ts:1352-1383`, `astronaut-game\src\game.ts:1517-1560`, `astronaut-game\src\game.ts:2436-2475`, `astronaut-game\src\game.ts:3584-3819`, `astronaut-game\src\game.ts:2738-2755`, `astronaut-game\src\collectable.ts:27-147`, `astronaut-game\src\world-designer.ts:60-81`, `astronaut-game\src\world-designer.ts:780-790`, `astronaut-game\src\world-designer.ts:8940-8953`).

## The core identity: Exile is a pressure economy, not just a pickup list

In the BBC original, progression is not only “find key, open door.” The player is constantly balancing:

1. **survival energy** - can I stay functional?
2. **mobility energy** - can I keep thrusting?
3. **offense energy** - which weapon can I afford to use?
4. **protection state** - which hazards can I currently ignore?
5. **impairment state** - how degraded is my control authority right now?
6. **carried-world pressure** - what am I holding, and what does that prevent me from doing?

That combination is why *Exile* feels more like a systemic survival-puzzle platformer than a conventional action platformer.

## 1. Player energy loop

### What the BBC game is doing

- `this_object_energy` is the player's immediate survivability resource (`original_source.asm:56`, `original_source.asm:8950-8963`).
- The player slowly regenerates energy during the player update, but low energy is still dangerous because it directly destabilizes movement and tool use (`original_source.asm:8950-8957`).
- If energy falls below the threshold checked at `&10`, the game pushes `player_immobility_daze`, making loss of health become loss of control, not just a smaller life bar (`original_source.asm:8959-8968`).
- Severe damage also increases that same daze state in `take_damage`, so “hurt” and “stunned” are parts of one feedback loop (`original_source.asm:6139-6149`).

### Modern design translation

This is best understood as a **control-quality health model**, not a pure HP pool. The original game uses health to answer:

- how safe the player is
- how reliable thrust is
- how likely the player is to enter a partial stun state

That is a major part of Exile's identity. Low health means rising execution tax.

### Typed-system direction

Later modern implementation should likely separate:

- `vitalEnergy` - survivability / regeneration / damage sink
- `impairment` - derived control penalties such as immobility or no-thrust

The important fidelity point is that impairment should be *driven by* energy loss, not bolted on as an unrelated status effect.

## 2. Jetpack fuel loop

### What the BBC game is doing

- The BBC source does **not** really model jetpack fuel as a separate bespoke meter. Jetpack energy is slot `0` in the shared `weapon_energy` table (`original_source.asm:1067-1076`).
- Thrust uses the same depletion path as weapons: the player loop calls `reduce_weapon_energy_for_x` with `X = 0` when thrust actually fires (`original_source.asm:8999-9009`).
- Low jetpack energy makes thrust erratic via `make_firing_erratic_at_low_energy`, which is why running low feels unreliable before it feels fully empty (`original_source.asm:8955-8957`, `original_source.asm:7408-7420`).
- The booster is not extra fuel; it doubles current acceleration if the pickup has been collected (`original_source.asm:7250-7261`).
- Energy capsules can be pocketed, but if the held object is an energy capsule it is immediately converted into jetpack energy instead of stored as ordinary inventory (`original_source.asm:8478-8505`).

### Modern design translation

In modern terms, the jetpack is a **rechargeable mobility battery with failure pressure**, not a simple gasoline bar. The loop is:

`move -> spend mobility energy -> become less reliable -> seek recharge -> restore mobility confidence`

That “less reliable before empty” step matters. It creates tension before hard failure.

### Current TypeScript footholds

- `astronaut.ts` already centralizes flight authority and acceleration behavior (`astronaut-game\src\astronaut.ts:93-225`).
- `settings.ts` already exposes the movement knobs that would need to react to low-energy states (`astronaut-game\src\settings.ts:3-28`).
- `game.ts` already routes movement through held-weight modifiers before gravity and collision, which is a good place for later energy-derived control penalties (`astronaut-game\src\game.ts:1517-1560`, `astronaut-game\src\game.ts:2436-2475`).
- `game.ts` also already has an `energy_pod` collectable path, which is a useful modern precedent for turning transient projectiles into resource pickups (`astronaut-game\src\game.ts:2658-2669`, `astronaut-game\src\game.ts:2738-2755`, `astronaut-game\src\types\index.ts:13-49`).

### Behavior-focused implementation direction

- Preserve the idea that low jetpack charge first hurts **reliability** or **thrust authority**, not only total duration.
- Represent mobility energy as its own typed resource channel even if it still lives alongside weapon channels in one resource container.
- Treat the booster as a capability modifier on thrust output, not as a refill item.

## 3. Weapon-energy loop

### What the BBC game is doing

- The game keeps six energy channels: jetpack, pistol, icer, discharge device, plasma, and suit (`original_source.asm:1069-1076`).
- Firing reads the current weapon's energy, plays a rough “energy status” beep, and spends channel-specific energy per shot (`original_source.asm:7324-7330`, `original_source.asm:7363-7405`).
- Low weapon charge does not simply disable fire; it makes firing probabilistic and erratic (`original_source.asm:7370-7372`, `original_source.asm:7408-7420`).
- Energy can be transferred between channels, which makes the whole kit feel like a managed power budget instead of isolated ammo counters (`original_source.asm:7331-7351`).

### Modern design translation

This is a **shared power-routing economy**:

- each tool has its own battery
- low charge reduces confidence, not just ammo count
- the player can re-prioritize power between tools

That makes weapon choice strategic in a way that ordinary ammo pickups do not.

### Current TypeScript footholds

- The modern game already distinguishes projectile kinds and fire modes in typed unions (`astronaut-game\src\types\index.ts:13-49`, `astronaut-game\src\types\index.ts:83-105`).
- `game.ts` already treats grenades, plasma grenades, and energy pods as authored runtime collectables with explicit behavior (`astronaut-game\src\game.ts:2658-2755`, `astronaut-game\src\game.ts:2948-3018`).
- `collectable.ts` already carries persistent runtime flags and payload data that could host battery-bearing equipment or dropped resource carriers (`astronaut-game\src\collectable.ts:27-147`).

### Behavior-focused implementation direction

- Preserve **per-tool energy identity** rather than collapsing everything into one generic ammo number.
- Preserve **low-charge unreliability**.
- Modernize by exposing resource channels as readable typed data instead of hidden bytes.
- If later added, energy transfer should be deliberate, inspectable, and reversible enough to support learning rather than confusion.

## 4. Suit and immunity loop

### What the BBC game is doing

- The protection suit is not a passive “armor owned” flag. It has its own energy channel in slot `5` of the energy table (`original_source.asm:1069-1076`).
- When the player takes damage, the suit can drain its own energy to absorb or soften the hit; without that energy, the player takes amplified damage (`original_source.asm:6152-6168`).
- The player sprite palette also reflects suit state and low suit energy, so the protection loop is visible as well as systemic (`original_source.asm:9138-9145`).
- Fire, mushroom, and radiation protection are tracked as separate persistent collected flags (`original_source.asm:1011-1022`).
- Fireball collision checks the fire-immunity flag before damaging the player (`original_source.asm:12191-12219`).
- Mushroom effects add daze, but mushroom immunity suppresses the player-facing consequence (`original_source.asm:10488-10499`).
- Coronium contact hurts unless the radiation immunity has been collected or the player/object is underwater (`original_source.asm:10785-10797`).

### Modern design translation

This is really two layers:

1. **active protection** - the suit, which spends energy to keep you alive
2. **binary permissions** - fire/mushroom/radiation immunities, which change what routes and interactions are safe

That distinction matters. The suit is a managed resource; the immunities are progression capabilities.

### Current TypeScript footholds

- `world-designer.ts` already gives collectables typed authored fields such as `pickupEnabled`, `storable`, `affectsAstronaut`, and `collision` (`astronaut-game\src\world-designer.ts:60-81`, `astronaut-game\src\world-designer.ts:780-790`).
- The in-app inspector already exposes collectable-related toggles, which is the right style for later explicit capability authoring (`astronaut-game\src\world-designer.ts:8940-8953`).
- `collectable.ts` already provides a runtime object that can represent persistent carried capability items as well as non-storable world pickups (`astronaut-game\src\collectable.ts:27-147`).

### Behavior-focused implementation direction

- Preserve the difference between **resource-backed mitigation** and **hard immunity flags**.
- Preserve route-changing protections: radiation/fire/mushroom safety should alter where the player can go and what they can carry.
- Modernize by making suit state, immunity flags, and hazard tags explicit in typed content schemas.

## 5. Daze loop

### What the BBC game is doing

- The BBC game has at least two important player impairment timers: `player_immobility_daze` and `player_nothrust_daze` (`original_source.asm:218-219`, `original_source.asm:8964-8973`).
- Low energy can set immobility daze (`original_source.asm:8959-8968`).
- Mushroom contact extends daze through the same shared player-impairment path (`original_source.asm:10488-10499`).
- While dazed or unable to move, the player loop can zero acceleration axes, suppress thrust, or otherwise degrade control authority (`original_source.asm:8969-8973`, `original_source.asm:9111-9118`).

### Modern design translation

Daze in *Exile* is not just “stunned.” It is a **temporary control-authority debuff stack**. Different causes feed the same impairment machinery:

- low energy
- large hits
- mushrooms / hazard effects

That shared pipeline is why the game feels coherent even when many different hazards exist.

### Current TypeScript footholds

- `astronaut.ts` has a clean centralized movement handler, which is a good insertion point for temporary control scaling or selective input suppression (`astronaut-game\src\astronaut.ts:93-225`).
- `game.ts` already uses staged movement orchestration before gravity and collision resolution, which gives later systems a clear place to inject daze-derived modifiers (`astronaut-game\src\game.ts:1517-1560`).

### Behavior-focused implementation direction

- Preserve impairment as **degraded handling first**, total lockout second.
- Prefer a shared typed `DazeState` or impairment model over many separate booleans.
- Let multiple causes contribute to the same control penalties so the system remains readable and systemic.

## 6. Progression pressure loop

### What the BBC game is doing

- Keys, booster, weapons, suit, whistles, and immunities are persistent world-state changes, not disposable score items (`original_source.asm:994-1076`, `original_source.asm:12300-12308`).
- Teleport recall is restricted while carrying something, so logistics pressure is part of progression, not a side detail (`original_source.asm:1801-1833`).
- Pockets create a small carrying buffer, but energy capsules bypass that storage loop and become jetpack recharge immediately (`original_source.asm:8478-8532`).
- Coronium is both useful and dangerous, making “valuable object” and “hazard source” the same thing (`original_source.asm:10765-10797`).
- The maggot machine crossing the water line triggers earthquake and endgame state, so world escalation is driven by systemic state transitions rather than a purely scripted cutscene (`original_source.asm:10740-10745`).

### Modern design translation

This is a **progression-under-pressure loop**:

`gain capability -> access harsher space -> manage hazard/resource burden -> transport critical objects -> trigger larger world-state change`

The important Exile flavor is that progression tools also create new management problems. Better mobility exposes more danger. Valuable objects are awkward to transport. Hazard protection changes route topology.

### Current TypeScript footholds

- `game.ts` already has modern teleport-memory behavior that is much friendlier than the BBC version but still demonstrates a persistent location loop (`astronaut-game\src\game.ts:1352-1383`).
- The current carry/store/throw loop already supports held and stored collectables, inventory limits, and movement penalties from weight (`astronaut-game\src\game.ts:2436-2475`, `astronaut-game\src\game.ts:3584-3819`, `astronaut-game\src\settings.ts:23-28`, `astronaut-game\src\settings.ts:42`, `astronaut-game\src\collectable.ts:97-147`).
- `world-designer.ts` already persists collectable authored state in typed save data, which is the right place for future progression metadata (`astronaut-game\src\world-designer.ts:60-81`, `astronaut-game\src\world-designer.ts:780-790`).

### Behavior-focused implementation direction

- Preserve **transport friction** as part of puzzle pressure.
- Preserve **persistent capability flags** as world-state, not inventory clutter.
- Preserve the idea that key objectives and dangerous materials can live in the same physics/carrying layer as ordinary items.
- Modernize the UI, not the underlying dependency structure.

## Recommended typed model for later fidelity work

If this doc is used later, a modern typed interpretation should probably keep these concerns distinct:

- **Resources**
  - vital/player energy
  - per-channel tool energy: jetpack, pistol, icer, discharge, plasma, suit
- **Capabilities**
  - keys
  - booster unlocked
  - suit owned
  - fire / mushroom / radiation immunity
  - whistles / special devices
- **Impairment**
  - immobility daze
  - no-thrust daze
  - optional derived control penalties
- **Progress state**
  - teleport history
  - world escalation flags
  - carried / pocketed / stored objects

The fidelity target should be: **explicit typed state with BBC-style behavioral relationships**.

## Preserve vs modernize

### Preserve

- **Shared pressure between movement, survival, and equipment.**
- **Low-resource unreliability.** Exile feels different because systems get shaky before they fail.
- **Hazard/protection pairings.** Fire, mushrooms, radiation, and coronium matter because countermeasures exist.
- **Transport pressure as progression pressure.**
- **Persistent capability unlocks that change route logic.**

### Modernize

- **Keep the current explicit tuning and orchestration split.** `settings.ts`, `astronaut.ts`, and `game.ts` are good modern seams (`astronaut-game\src\settings.ts:3-64`, `astronaut-game\src\astronaut.ts:93-225`, `astronaut-game\src\game.ts:1517-1560`).
- **Keep typed authoring in the world designer.** Later resource/capability metadata should be inspectable and editable, not bit-packed (`astronaut-game\src\world-designer.ts:60-81`, `astronaut-game\src\world-designer.ts:8940-8953`).
- **Keep modern collectable ergonomics.** Held/stored/runtime state in `collectable.ts` is a strong substrate even if BBC-like capability logic is layered on later (`astronaut-game\src\collectable.ts:27-147`).
- **Translate behavior, not byte layout.**

## Bottom line

The missing piece in the current BBC-source notes is that *Exile* is defined by a linked resource/progression economy: health degrades control, jetpack thrust spends a rechargeable mobility battery, weapons and suit live on parallel energy channels, immunities reshape route safety, daze unifies multiple failure states, and progression is pressured by carrying, hazards, and world escalation. If later fidelity work happens, the right goal is not BBC-style hidden bytes; it is **modern typed state that preserves the same pressure loops and behavioral consequences**.
