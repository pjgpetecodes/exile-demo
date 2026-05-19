# Exile Demo

![Exile Demo Screenshot](readmefiles/image.png)

Move around with;

- Q = Left
- W = Right
- P = Up
- L = Down
- R = Remember Location
- T = Teleport

## Notes:

- Collision logic is almost useless - Please help!
- Don't try to fly in the ship at the moment
- Doors Unlock, Open and close
- Buttons Unlock Doors
- Sprites laid out in world_map.json, buttons.json, creatures.json, doors.json
- Palettes defined in palettes.json

## Running:

- Download the repo
- Run the following from the astronaut-game folder to install all packages;

```
npm install
```

- Run the following from the astronaut-game folderto run the demo;

```
npm run dev
```

- You should be able to play the demo at the following addresses;

- Local - [Exile Demo Local](https://localhost:3000)
- Prebuilt Demo - [Exile Demo PreBuilt Demo](https://exile-demo-ezg7egdpc7dwfvhk.uksouth-01.azurewebsites.net/)

## World designer

- `npm run dev` now starts the game plus a local save service used by the world designer.
- The designer starts hidden by default; press `` ` `` to open or close it.
- The designer opens in-app and saves back to:
  - `src/assets/world_map.json`
  - `src/assets/buttons.json`
  - `src/assets/doors.json`
  - `src/assets/creatures.json`
  - `src/assets/collectables.json`
  - `src/assets/astronaut_start.json`
- Core designer flow:
  - mouse placement for rough positioning
  - arrow keys for precise nudging
  - overview navigator for zoomed-out dragging/panning of the main view
  - set astronaut start to the current view center, with a visible START marker
  - preview mode with visibility / collision overlays
  - undo / redo and preview-before-save
- Shortcut highlights:
  - `` ` `` = show/hide designer panel
  - `1` / `2` = select/place tools
  - `V` = edit/preview mode
  - `R` = rotate selection
  - `Delete` = remove selection
  - `Ctrl+D` = duplicate
  - `Arrow keys` = precise nudging
  - `Ctrl+S` = preview before save
  - `Ctrl+Z`, `Ctrl+Y` = undo / redo

## Specialist agents

- Specialist agent profiles now live under `.github/agents/`.
- Each specialist is a Markdown agent profile with YAML frontmatter.
- Current specialists:
  - `game-design-specialist.md`
  - `graphics-content-specialist.md`
  - `unit-test-specialist.md`
  - `playwright-frontend-specialist.md`
  - `collision-physics-specialist.md`
  - `animation-specialist.md`
  - `tooling-workflow-specialist.md`
  - `architecture-specialist.md`
