import { Position } from '../../types/index.js';

export type TeleportLocation = { x: number, y: number };

type AstronautEnergyState = {
    energy: number;
    maxEnergy: number;
    nextEnergyRegenAtMs?: number;
};

type AstronautRenderState = {
    spriteCol: number;
    flipSprite: boolean;
    flipVertical: boolean;
};

export function createAstronautTeleportSurvivalHelpers(context: {
    setAstronautStartPosition: (position: Position, applyToAstronaut: boolean) => void;
    getDefaultTeleportLocation: () => TeleportLocation;
    setDefaultTeleportLocation: (location: TeleportLocation) => void;
    getTeleportLocations: () => TeleportLocation[];
    getTeleportSlot: () => number;
    setTeleportSlot: (slot: number) => void;
    getTeleporting: () => boolean;
    prefetchMapChunksAroundWorldPosition: (position: Position, radiusChunks: number) => void;
    chunkActivityManager: { markTeleportKeepAlive: (from: Position, to: Position, now: number) => void };
    getAstronautPosition: () => Position;
    now: () => number;
    setTeleporting: (value: boolean) => void;
    setTeleportPhase: (value: 'none' | 'out' | 'in') => void;
    setTeleportAnimFrame: (value: number) => void;
    setTeleportTarget: (target: TeleportLocation | null) => void;
    getCurrentAstronautRenderState: () => AstronautRenderState;
    setTeleportSpriteCol: (value: number) => void;
    setTeleportFlipSprite: (value: boolean) => void;
    setTeleportFlipVertical: (value: boolean) => void;
    teleportSound: HTMLAudioElement;
    requestImmediateFrame: () => void;
    getAstronaut: () => AstronautEnergyState;
    movementSettings: {
        astronautEnergyRegenIntervalMs: number;
        astronautEnergyRegenAmount: number;
        astronautEmergencyTeleportEnergy: number;
        astronautDamageIntakeMultiplier: number;
    };
    releaseHeldCollectable: () => void;
}) {
    function syncDefaultTeleportLocation(position: Position) {
        context.setDefaultTeleportLocation({
            x: Math.round(position.x),
            y: Math.round(position.y)
        });
    }

    function updateAstronautStartPosition(position: Position, applyToAstronaut: boolean = false) {
        context.setAstronautStartPosition(position, applyToAstronaut);
        syncDefaultTeleportLocation(position);
    }

    function popLatestTeleportLocation() {
        const teleportLocations = context.getTeleportLocations();
        if (teleportLocations.length > 0) {
            const location = teleportLocations.pop()!;
            if (context.getTeleportSlot() > teleportLocations.length) {
                context.setTeleportSlot(teleportLocations.length);
            }
            return location;
        }
        return { ...context.getDefaultTeleportLocation() };
    }

    function startTeleportToLocation(location: TeleportLocation) {
        if (context.getTeleporting()) {
            return false;
        }

        const astronautPosition = context.getAstronautPosition();
        context.prefetchMapChunksAroundWorldPosition(astronautPosition, 1);
        context.prefetchMapChunksAroundWorldPosition(location, 2);
        context.chunkActivityManager.markTeleportKeepAlive(
            astronautPosition,
            location,
            context.now()
        );
        context.setTeleporting(true);
        context.setTeleportPhase('out');
        context.setTeleportAnimFrame(0);
        context.setTeleportTarget(location);
        const renderState = context.getCurrentAstronautRenderState();
        context.setTeleportSpriteCol(renderState.spriteCol);
        context.setTeleportFlipSprite(renderState.flipSprite);
        context.setTeleportFlipVertical(renderState.flipVertical);
        try { context.teleportSound.currentTime = 0; context.teleportSound.play(); } catch {}
        context.requestImmediateFrame();
        return true;
    }

    function updateAstronautEnergyRecovery(now: number) {
        const astronaut = context.getAstronaut();
        if (context.getTeleporting() || astronaut.energy >= astronaut.maxEnergy) {
            return;
        }

        const nextRegenAt = astronaut.nextEnergyRegenAtMs ?? (now + context.movementSettings.astronautEnergyRegenIntervalMs);
        if (now < nextRegenAt) {
            astronaut.nextEnergyRegenAtMs = nextRegenAt;
            return;
        }

        const intervalMs = context.movementSettings.astronautEnergyRegenIntervalMs;
        const regenSteps = Math.floor((now - nextRegenAt) / intervalMs) + 1;
        astronaut.energy = Math.min(
            astronaut.maxEnergy,
            astronaut.energy + regenSteps * context.movementSettings.astronautEnergyRegenAmount
        );
        astronaut.nextEnergyRegenAtMs = nextRegenAt + regenSteps * intervalMs;
    }

    function triggerAstronautEmergencyTeleport() {
        const astronaut = context.getAstronaut();
        if (context.getTeleporting()) {
            return;
        }

        context.releaseHeldCollectable();
        astronaut.energy = Math.min(
            astronaut.maxEnergy,
            Math.max(1, context.movementSettings.astronautEmergencyTeleportEnergy)
        );
        startTeleportToLocation(popLatestTeleportLocation());
    }

    function applyAstronautDamage(amount: number, now: number = context.now()) {
        const astronaut = context.getAstronaut();
        if (amount <= 0 || context.getTeleporting()) {
            return;
        }

        const scaledDamage = amount * context.movementSettings.astronautDamageIntakeMultiplier;
        astronaut.energy = Math.max(0, astronaut.energy - scaledDamage);
        astronaut.nextEnergyRegenAtMs = now + context.movementSettings.astronautEnergyRegenIntervalMs;
        if (astronaut.energy <= 0) {
            triggerAstronautEmergencyTeleport();
        }
    }

    function computeLandingImpactDamage(
        verticalSpeed: number,
        horizontalSpeed: number,
        windExposure: number
    ) {
        if (verticalSpeed < 4.2 && horizontalSpeed < 5.0) {
            return 0;
        }
        const verticalComponent = Math.max(0, verticalSpeed - 4.35);
        const horizontalComponent = Math.max(0, horizontalSpeed - 5.2) * 0.1;
        const windComponent = Math.max(0, windExposure - 1.8) * 0.28;
        const severity = verticalComponent + horizontalComponent + windComponent;
        if (severity <= 0) {
            return 0;
        }
        return Math.min(5, Math.pow(severity, 1.35) * 0.45);
    }

    return {
        syncDefaultTeleportLocation,
        updateAstronautStartPosition,
        popLatestTeleportLocation,
        startTeleportToLocation,
        updateAstronautEnergyRecovery,
        triggerAstronautEmergencyTeleport,
        applyAstronautDamage,
        computeLandingImpactDamage
    };
}
