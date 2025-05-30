# Astronaut Game

## Overview
Astronaut Game is a simple 2D game where players control an astronaut character. The game features weak gravity, allowing the astronaut to fly and leave a trail of dots while in motion. Players can walk left and right when landed and control the astronaut's flight with specific key inputs.

## Controls
- **Q**: Move Left
- **W**: Move Right
- **P**: Fly Up
- **L**: Move Down (no action when landed)

## Features
- **Character**: The player controls an astronaut character.
- **Weak Gravity**: The astronaut experiences a downward force when flying or walking.
- **Trail Effect**: While flying and moving, the astronaut leaves a trail of small dots behind.
- **Landing Mechanics**: The astronaut can walk left and right when landed, but pressing down has no effect.

## File Structure
```
astronaut-game
├── src
│   ├── assets
│   │   └── astronaut.png
│   ├── game.ts
│   ├── gravity.ts
│   ├── controls.ts
│   ├── trail.ts
│   └── types
│       └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Setup Instructions
1. Clone the repository to your local machine.
2. Navigate to the project directory.
3. Install the dependencies using npm:
   ```
   npm install
   ```
4. Compile the TypeScript files:
   ```
   npm run build
   ```
5. Start the game:
   ```
   npm start
   ```

## Gameplay
Use the controls to navigate the astronaut through the game environment. Experiment with flying and walking to explore the mechanics of gravity and movement. Enjoy the visual trail effect as you fly!