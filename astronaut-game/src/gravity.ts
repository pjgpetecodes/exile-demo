import { Astronaut } from './types/index.js';

export function applyGravity(astronaut: Astronaut, gravity: number = 0.2) {
    if (!astronaut.isLanded) {
        astronaut.velocity.y += gravity;
        astronaut.position.y += astronaut.velocity.y;
        astronaut.position.x += astronaut.velocity.x;
    }
}
