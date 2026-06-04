const PRONE_COLLISION_BOUNDS: Record<string, { worldMinX: number; worldMaxX: number; worldMinY: number; worldMaxY: number }> = {
    // Tuned for floor-flush prone contact and narrow-gap crawling.
    prone_down: { worldMinX: 5, worldMaxX: 26, worldMinY: 19, worldMaxY: 31 },
    prone_up: { worldMinX: 5, worldMaxX: 26, worldMinY: 19, worldMaxY: 31 }
};

export function getDerivedProneCollisionBounds(profile: string) {
    if (profile !== 'prone_down' && profile !== 'prone_up') {
        return null;
    }
    return PRONE_COLLISION_BOUNDS[profile];
}
