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
- The game should open at `http://localhost:3000`

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
- The astronaut start position is stored separately in `astronaut_start.json`.

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
