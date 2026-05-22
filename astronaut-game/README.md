# Astronaut Game

This folder contains the playable app and the in-app world designer.

Production/deployed startup now uses `static-server.cjs`, which serves the built app and assets directly on the platform `PORT` without relying on `lite-server`.

The world-designer save/normalization endpoints still depend on the separate local `designer-save-server.cjs` helper and are intended for local authoring, not deployed hosting.

Documentation now lives in the repository `docs` folder:

- [Game Guide](../docs/game.md)
- [World Designer Guide](../docs/world-designer.md)
- [Repository README](../README.md)
