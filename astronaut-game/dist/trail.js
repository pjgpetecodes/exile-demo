export function createTrail(astronaut, trail) {
    const trailLength = 10;
    if (astronaut.isFlying) {
        trail.push({ x: astronaut.position.x, y: astronaut.position.y });
        if (trail.length > trailLength) {
            trail.shift();
        }
    }
}
