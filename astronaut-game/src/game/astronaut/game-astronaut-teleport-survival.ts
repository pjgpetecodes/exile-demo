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
    getAstronautStartPosition: () => Position;
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
    teleportAstronautImmediately: (location: TeleportLocation) => void;
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
    const swallowAutoplayRejection = () => {};

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
        const astronautStart = context.getAstronautStartPosition();
        return {
            x: Math.round(astronautStart.x),
            y: Math.round(astronautStart.y)
        };
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
        try {
            context.teleportSound.currentTime = 0;
            void context.teleportSound.play().catch(swallowAutoplayRejection);
        } catch {}
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
        const emergencyTarget = popLatestTeleportLocation();
        if (startTeleportToLocation(emergencyTarget)) {
            // Fail-safe for emergency teleports: ensure position shifts immediately even if
            // animation progression stalls.
            context.teleportAstronautImmediately(emergencyTarget);
            context.setTeleportAnimFrame(0);
            context.setTeleportPhase('none');
            context.setTeleportTarget(null);
            context.setTeleporting(false);
        }
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
        if (verticalSpeed < 5.2 && horizontalSpeed < 6.3) {
            return 0;
        }
        const verticalComponent = Math.max(0, verticalSpeed - 5.35);
        const horizontalComponent = Math.max(0, horizontalSpeed - 6.6) * 0.08;
        const windComponent = Math.max(0, windExposure - 2.2) * 0.18;
        const severity = verticalComponent + horizontalComponent + windComponent;
        if (severity <= 0) {
            return 0;
        }
        return Math.min(4, Math.pow(severity, 1.25) * 0.34);
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
