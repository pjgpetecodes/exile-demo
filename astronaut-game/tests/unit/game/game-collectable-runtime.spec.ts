import { describe, expect, it } from 'vitest';
import { getCreatureProjectileCollectables } from '../../../src/game/collectables/game-collectable-runtime';

describe('collectable runtime projectile filtering', () => {
    it('excludes impacted projectiles from renderable projectile list', () => {
        const activeProjectile = {
            creatureProjectile: {
                kind: 'bullet',
                homing: false,
                remainingFrames: 10,
                damage: 1
            }
        };
        const impactedProjectile = {
            creatureProjectile: {
                kind: 'bullet',
                homing: false,
                remainingFrames: 0,
                damage: 1,
                impacted: true
            }
        };
        const regularCollectable = { type: 'key' };

        const result = getCreatureProjectileCollectables([
            activeProjectile as any,
            impactedProjectile as any,
            regularCollectable as any
        ]);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(activeProjectile);
    });
});
