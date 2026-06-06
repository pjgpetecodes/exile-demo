import { describe, expect, it } from 'vitest';
import {
    getDefaultDestructibleEnabled,
    getDefaultDestructibleHealth,
    getDefaultDestructionSource
} from '../../../src/entities/destructibles.js';

describe('destructible defaults', () => {
    it('treats beehive world blocks as destructible by explosion', () => {
        expect(getDefaultDestructibleEnabled('world', 'beehive')).toBe(true);
        expect(getDefaultDestructibleHealth('world', 'beehive')).toBeGreaterThan(0);
        expect(getDefaultDestructionSource('world', 'beehive')).toBe('any_explosion');
    });
});
