import type { Astronaut, Position } from '../../types/index.js';
import type { Collectable } from '../../entities/collectable.js';

export function createAstronautControlRuntime(options: {
    astronaut: Astronaut;
    getHeldCollectable: () => Collectable | null;
    getFacingLeft: () => boolean;
    getAstronautCollisionOffsets: () => { left: number; right: number; top: number; bottom: number };
    movementSettings: {
        heldWeightIgnoreThreshold: number;
        heldWeightMinScale: number;
        heldWeightWalkPenaltyPerUnit: number;
        heldWeightFlyPenaltyPerUnit: number;
        heldWeightGravityBonusPerUnit: number;
        heldWeightTerminalVelocityBonusPerUnit: number;
        flyMaxSpeed: number;
    };
    bulletDazeDurationMs: number;
    bulletDazeWalkScale: number;
    bulletDazeFlightScale: number;
    getWindSettings: () => any;
    getWindDebugToggles: () => any;
    getEffectiveWindToggles: (settings: any, toggles: any) => { windEnabled: boolean; surfaceWindEnabled: boolean };
    normalizeWindSettings: (settings: any) => any;
    getSurfaceWindEdgeProximity: (x: number, normalized: any) => { edgeProximity: number };
    getSurfaceWindBoundaryOvershoot: (x: number, normalized: any) => { maxOvershoot: number };
    applySurfaceWindField: (x: number, y: number, now: number, settings: any) => { x: number; y: number };
    clampToRange: (value: number, minimum: number, maximum: number) => number;
}) {
    function applySurfaceWindCarryToAstronaut(now: number) {
        const windSettings = options.getWindSettings();
        const windDebugToggles = options.getWindDebugToggles();
        const toggles = options.getEffectiveWindToggles(windSettings, windDebugToggles);
        if (!toggles.windEnabled || !toggles.surfaceWindEnabled) {
            return;
        }
        const normalizedSettings = options.normalizeWindSettings(windSettings);
        const { edgeProximity } = options.getSurfaceWindEdgeProximity(options.astronaut.position.x, normalizedSettings);
        const surfaceOvershoot = options.getSurfaceWindBoundaryOvershoot(options.astronaut.position.x, normalizedSettings).maxOvershoot;
        if (edgeProximity <= 0 && surfaceOvershoot <= 0) {
            return;
        }

        const surfaceWind = options.applySurfaceWindField(options.astronaut.position.x, options.astronaut.position.y, now, windSettings);
        const targetCarryVelocityX = options.clampToRange(
            surfaceWind.x * 6.6,
            -options.movementSettings.flyMaxSpeed * 1.25,
            options.movementSettings.flyMaxSpeed * 1.25
        );
        const carryBlend = options.clampToRange(
            0.012 + edgeProximity * 0.06 + Math.min(0.015, surfaceOvershoot / 2200),
            0.012,
            0.085
        );
        options.astronaut.velocity.x += (targetCarryVelocityX - options.astronaut.velocity.x) * carryBlend;
    }

    function getHeldMovementModifiers() {
        const heldCollectable = options.getHeldCollectable();
        if (!heldCollectable || heldCollectable.stored || !heldCollectable.affectsAstronaut) {
            return {
                effectiveWeight: 0,
                walkSpeedScale: 1,
                flightControlScale: 1,
                gravityScale: 1,
                terminalVelocityScale: 1
            };
        }

        const effectiveWeight = heldCollectable.weight < options.movementSettings.heldWeightIgnoreThreshold
            ? 0
            : heldCollectable.weight;
        if (effectiveWeight === 0) {
            return {
                effectiveWeight,
                walkSpeedScale: 1,
                flightControlScale: 1,
                gravityScale: 1,
                terminalVelocityScale: 1
            };
        }

        const walkSpeedScale = Math.max(
            options.movementSettings.heldWeightMinScale,
            1 - effectiveWeight * options.movementSettings.heldWeightWalkPenaltyPerUnit
        );
        const flightControlScale = Math.max(
            options.movementSettings.heldWeightMinScale,
            1 - effectiveWeight * options.movementSettings.heldWeightFlyPenaltyPerUnit
        );

        return {
            effectiveWeight,
            walkSpeedScale,
            flightControlScale,
            gravityScale: 1 + effectiveWeight * options.movementSettings.heldWeightGravityBonusPerUnit,
            terminalVelocityScale: 1 + effectiveWeight * options.movementSettings.heldWeightTerminalVelocityBonusPerUnit
        };
    }

    function getAstronautDazeProgress(now: number) {
        const dazeUntil = options.astronaut.controlDazeUntilMs ?? 0;
        if (dazeUntil <= now) {
            return 0;
        }
        return Math.min(1, (dazeUntil - now) / options.bulletDazeDurationMs);
    }

    function getAstronautControlModifiers(now: number) {
        const dazeProgress = getAstronautDazeProgress(now);
        if (dazeProgress <= 0) {
            return {
                walkSpeedScale: 1,
                flightControlScale: 1
            };
        }

        return {
            walkSpeedScale: options.bulletDazeWalkScale + (1 - options.bulletDazeWalkScale) * (1 - dazeProgress),
            flightControlScale: options.bulletDazeFlightScale + (1 - options.bulletDazeFlightScale) * (1 - dazeProgress)
        };
    }

    function applyAstronautBulletDaze(now: number, durationMs: number = options.bulletDazeDurationMs) {
        options.astronaut.controlDazeUntilMs = Math.max(options.astronaut.controlDazeUntilMs ?? 0, now + durationMs);
    }

    function getFacingSign() {
        return options.getFacingLeft() ? -1 : 1;
    }

    function getAstronautRect() {
        const astronautOffsets = options.getAstronautCollisionOffsets();
        return {
            left: options.astronaut.position.x + astronautOffsets.left,
            right: options.astronaut.position.x + astronautOffsets.right,
            top: options.astronaut.position.y + astronautOffsets.top,
            bottom: options.astronaut.position.y + astronautOffsets.bottom
        };
    }

    return {
        applySurfaceWindCarryToAstronaut,
        getHeldMovementModifiers,
        getAstronautControlModifiers,
        applyAstronautBulletDaze,
        getFacingSign,
        getAstronautRect
    };
}
