import { Astronaut, Position } from './types/index.js';

export function createTrail(astronaut: Astronaut, trail: Position[]) {
    const trailLength = 10;
    if (astronaut.isFlying) {
        trail.push({ x: astronaut.position.x, y: astronaut.position.y });
        if (trail.length > trailLength) {
            trail.shift();
        }
    }
}