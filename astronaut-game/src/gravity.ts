import { Astronaut } from './types/index.js';

export function applyGravity(
    astronaut: Astronaut,
    gravity: number = 0.2,
    maxFallSpeed: number = Number.POSITIVE_INFINITY
) {
    if (!astronaut.isLanded) {
        astronaut.velocity.y += gravity;
        if (astronaut.velocity.y > maxFallSpeed) {
            astronaut.velocity.y = maxFallSpeed;
        }
    }
}
