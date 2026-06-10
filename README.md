# Exile Demo

![Exile Demo Screenshot](readmefiles/image.png)

## Documentation

- [Game Guide](docs/game.md)
- [World Designer Guide](docs/world-designer.md)

## Controls

Move around with:

- Q = Left
- W = Right
- P = Up
- L = Down
- R = Remember Location
- T = Teleport

Developer toggles:

- D = Debug HUD
- Ctrl+Shift+H = Performance HUD (rolling avg/worst frame + update/map/entities/total timings)
- Ctrl+Shift+J = Periodic performance console summary (tagged with browser name)

Chunk activity tuning (devtools):

- `window.__exileDebug.chunkActivity.getTuning()` to inspect activity bands, cadence, and teleport grace window (`teleportKeepAliveMs`).
- `window.__exileDebug.chunkActivity.setTuning({...})` to tune runtime values while profiling.
- `window.__exileDebug.chunkActivity.resetTuning()` to restore defaults from `astronaut-game/src/settings.ts`.
- See [docs/game.md](docs/game.md) for rollout verification steps and tradeoffs.

## Notes

Current working systems:

- Collision and movement are stable (grounded movement, flight transitions, object interaction, and environment collision handling).
- Water gameplay is active (water blocks, submersion-aware drag/buoyancy, flask filling/spilling, and designer water tools).
- Wasp/beehive systems are active (nest activation/deactivation, swarm drift, attack/return behavior, despawn/reset, and authored per-nest tuning).
- Door/button and teleporter flows are active (button-linked doors, teleport memory stack, rescue teleport behavior).
- Destructibles and grenade/explosion gameplay are active (authored damage sources, beehive destruction support).
- Chunk-activity streaming and cadence controls are active (near/mid/far gating, teleport keep-alive, runtime tuning APIs).
- Runtime performance instrumentation is active (HUD + console summaries + spike tracing), and worker-based threading paths now cover fire/effect prep plus creature animation/swarm calculations with safe fallback.
- World data remains JSON-authored (`world_map.json`, `buttons.json`, `creatures.json`, `doors.json`, `collectables.json`, `astronaut_start.json`, palettes).

### Performance baseline capture (Edge + Firefox)

1. Start the game (`npm run dev`), open devtools console, then enable `D` + `Ctrl+Shift+J`.
2. Capture 30-60 seconds in **Edge** for:
   - idle in spawn
   - active traversal/jetpack
   - heavy on-screen entity moments
3. Repeat in **Firefox** and compare `[perf][Edge]` vs `[perf][Firefox]` summaries.
4. Use `Ctrl+Shift+H` alongside debug HUD when you need in-frame timing visibility while tuning.

## Running

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

- Local - [Exile Demo Local](http://localhost:3000)
- Prebuilt Demo - [Exile Demo PreBuilt Demo](https://exile-demo-ezg7egdpc7dwfvhk.uksouth-01.azurewebsites.net/)

## World designer

- The full editor tutorial lives in [docs/world-designer.md](docs/world-designer.md).
- The general game guide lives in [docs/game.md](docs/game.md).

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
  - `bbc-creature-mechanics-specialist.md`
  - `bbc-physics-mechanics-specialist.md`
  - `bbc-world-systems-specialist.md`
  - `bbc-audio-reference-specialist.md`
