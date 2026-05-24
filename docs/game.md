# Exile Demo Game Guide

## Overview

Exile Demo is a browser-based TypeScript game inspired by the feel of *Exile*. You control an astronaut in a large world with low gravity, doors, buttons, teleport memory, collectables, creatures, and an in-app world designer.

## Running the game

From `astronaut-game`:

```bash
npm install
npm run dev
```

That starts:

- the TypeScript watcher
- the local game server on `http://localhost:3000`
- the world designer save server on `http://localhost:3001`

For a one-off compile:

```bash
npm run build
```

## VS Code debugging

The repository includes VS Code launch/task settings.

- Press **F5**
- Choose **Launch Astronaut Game** if VS Code asks
- The game should open once in Chrome at `http://localhost:3000`

## Player controls

### Movement

- **Q** = move left
- **W** = move right
- **P** = thrust up
- **L** = move down while flying

### Utility controls

- **R** = remember current location
- **T** = teleport to the most recently remembered location
- **Tab** = flip astronaut direction

### Debug / editor-adjacent controls

- **`** = show or hide the world designer
- **F** = toggle sprite outline overlays

## Gameplay notes

- Gravity is intentionally light.
- Doors can be linked to buttons.
- Collectables can be placed in the world and configured in the designer.
- Loose objects now use a shared weight-and-speed-driven physics model for falling, bouncing, throwing, pushing, and astronaut impacts.
- The astronaut start position is stored separately in `astronaut_start.json`.

## Astronaut injury, energy, and rescue teleport

- The astronaut uses a hidden regenerating **energy pool** rather than a one-hit death system.
- Hits from **bullet impact blasts**, **projectile explosions**, **grenade explosions**, and **authored creature touch damage** drain energy.
- Creature touch damage is driven by the creature's authored `damageOnContact` value. It is **not** a generic "all hostile creatures ram for damage" rule.
- While injured, the astronaut **flashes white**, and the flashing rate increases as energy gets lower.
- Bullet and explosion hits also **buffet** the astronaut around and can briefly **daze** his control response.
- Energy now regenerates slowly in a BBC-inspired way: **1 point every 320 ms** until full.
- Astronaut damage intake is currently tuned a bit harsher than the plain 64-point pool would suggest, to better approximate the original BBC game's exposed / low-protection lethality until a full protection-suit system exists in the modern game.
- If energy reaches **zero**, the astronaut:
  1. drops the currently held collectable,
  2. triggers the teleport effect,
  3. teleports to the **most recently remembered** teleport location,
  4. falls back to the default astronaut start position if no remembered location exists.
- Emergency rescue teleport now matches the BBC pattern more closely: the astronaut is rescued at **1 energy**, then gains **+1 more when teleport completes**. It does **not** reset the active recovery countdown, so healing continues from the original hit timing.
- Teleport memories are still a **stack**:
  - **R** pushes the current location into memory
  - **T** pops the most recent remembered location
  - zero-energy rescue teleport uses the same pop-to-last-save behavior
- This is intentionally BBC-inspired rather than a literal port: the modern game keeps the readable flash/teleport presentation and current save-memory workflow while following the original pattern of **damage -> slow regeneration -> forced rescue teleport on depletion**.

## Important asset files

World data is split across JSON files in `astronaut-game\src\assets`:

- `world_map.json`
- `buttons.json`
- `doors.json`
- `creatures.json`
- `collectables.json`
- `astronaut_start.json`

## Related docs

- [World Designer Guide](world-designer.md)
- [Main README](../README.md)
