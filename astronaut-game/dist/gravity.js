export function applyGravity(astronaut, gravity = 0.2) {
    if (!astronaut.isLanded) {
        astronaut.velocity.y += gravity;
        astronaut.position.y += astronaut.velocity.y;
        astronaut.position.x += astronaut.velocity.x;
    }
}
