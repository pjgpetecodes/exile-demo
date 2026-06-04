# Astronaut Game

This folder contains the playable app and the in-app world designer.

Production/deployed startup now uses `static-server.cjs`, which serves the built app and assets directly on the platform `PORT` without relying on `lite-server`.

The world-designer save/normalization endpoints still depend on the separate local `designer-save-server.cjs` helper and are intended for local authoring, not deployed hosting.

Documentation now lives in the repository `docs` folder:

- [Game Guide](../docs/game.md)
- [World Designer Guide](../docs/world-designer.md)
- [Repository README](../README.md)

## Testing workflow

The project now uses two automated test layers:

- **Unit tests (Vitest):** deterministic logic and data normalization
- **Browser e2e tests (Playwright):** runtime rendering/input flows and designer interaction

### Commands

- `npm run test:unit` - run unit tests once
- `npm run test:unit:watch` - run unit tests in watch mode
- `npm run test:e2e` - run Playwright tests
- `npm test` - run unit + e2e together

### Coverage map (major systems)

1. **Movement/runtime regressions (Playwright):** walking and grounded behavior.
2. **Designer navigation regressions (Playwright):** overview navigation to far map edges.
3. **Water migration logic (Unit):** legacy palette-based water classification and explicit metadata conversion.
4. **Reusable fill foundation (Unit):** generic flood-fill traversal with water policy constraints.

### Test-first feature policy

For new features, add failing tests first (unit and/or e2e), implement the feature to make tests pass, then refactor safely under the same test coverage.
