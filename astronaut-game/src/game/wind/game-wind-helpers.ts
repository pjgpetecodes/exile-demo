import type { Position, WindGlobalSettings } from '../../types/index.js';
import type { WindEmitterRuntime, WindRuntimeToggles } from './game-wind-runtime.js';

type WindParticle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    hue: number;
    color?: string;
};

type NearbyWindSample = { x: number; y: number; timeMs: number };

type GameWindHelpersOptions = {
    astronaut: { position: Position };
    getWindSettings: () => WindGlobalSettings;
    getWindDebugToggles: () => Partial<WindRuntimeToggles>;
    getWindEmitters: () => WindEmitterRuntime[];
    getMapBlocksNearWorldPoint: (x: number, y: number, spriteScale: number) => any[];
    toWindEmitterFromBlock: (block: any) => WindEmitterRuntime | null;
    getEffectiveWindToggles: (settings: WindGlobalSettings, debug: Partial<WindRuntimeToggles>) => WindRuntimeToggles;
    resolveEmitterMagnitude: (emitter: WindEmitterRuntime, now: number) => number;
    computeEmitterWindAccelerationAtPoint: (
        x: number,
        y: number,
        now: number,
        emitters: WindEmitterRuntime[],
        target: 'astronaut' | 'looseObject'
    ) => { x: number; y: number; activeEmitterCount: number };
    applySurfaceWindField: (x: number, y: number, now: number, settings: WindGlobalSettings) => { x: number; y: number };
    normalizeWindSettings: (settings: WindGlobalSettings) => any;
    getSurfaceWindEdgeProximity: (x: number, normalizedSettings: any) => { edgeProximity: number };
    getSurfaceWindBoundaryOvershoot: (x: number, normalizedSettings: any) => { maxOvershoot: number };
    clampToRange: (value: number, minimum: number, maximum: number) => number;
    movementSettings: {
        windMaxAccelerationPerFrame: number;
        windWeightResistancePerUnit: number;
        windParticlePerEmitterMaxPerFrame: number;
    };
    spriteScale: number;
    windParticles: WindParticle[];
    getCanvasSize: () => { width: number; height: number };
    windBlockSampleIntervalMs: number;
    windBlockSampleDistancePx: number;
    getCachedWindEmittersForFrame: () => WindEmitterRuntime[];
    setCachedWindEmittersForFrame: (emitters: WindEmitterRuntime[]) => void;
    getCachedWindEmittersFrameKey: () => number;
    setCachedWindEmittersFrameKey: (key: number) => void;
    getCachedNearbyBlockWindEmitters: () => WindEmitterRuntime[];
    setCachedNearbyBlockWindEmitters: (emitters: WindEmitterRuntime[]) => void;
    getCachedNearbyBlockWindSample: () => NearbyWindSample;
    setCachedNearbyBlockWindSample: (sample: NearbyWindSample) => void;
};

export function createGameWindHelpers(options: GameWindHelpersOptions) {
    function getActiveWindEmittersNearAstronaut(now: number, toggles: WindRuntimeToggles) {
        const frameKey = Math.floor(now);
        if (frameKey === options.getCachedWindEmittersFrameKey()) {
            return options.getCachedWindEmittersForFrame();
        }
        if (!toggles.windEnabled || !toggles.emittersEnabled) {
            options.setCachedWindEmittersFrameKey(frameKey);
            options.setCachedWindEmittersForFrame([]);
            return options.getCachedWindEmittersForFrame();
        }

        const cachedSample = options.getCachedNearbyBlockWindSample();
        const dxSinceSample = Math.abs(options.astronaut.position.x - cachedSample.x);
        const dySinceSample = Math.abs(options.astronaut.position.y - cachedSample.y);
        if (
            !Number.isFinite(cachedSample.x) ||
            !Number.isFinite(cachedSample.y) ||
            now - cachedSample.timeMs >= options.windBlockSampleIntervalMs ||
            dxSinceSample >= options.windBlockSampleDistancePx ||
            dySinceSample >= options.windBlockSampleDistancePx
        ) {
            options.setCachedNearbyBlockWindEmitters(
                options.getMapBlocksNearWorldPoint(
                    options.astronaut.position.x,
                    options.astronaut.position.y,
                    options.spriteScale
                )
                    .map(options.toWindEmitterFromBlock)
                    .filter((emitter): emitter is WindEmitterRuntime => !!emitter)
            );
            options.setCachedNearbyBlockWindSample({
                x: options.astronaut.position.x,
                y: options.astronaut.position.y,
                timeMs: now
            });
        }

        options.setCachedWindEmittersForFrame([
            ...options.getWindEmitters().filter((entry) => entry.enabled),
            ...options.getCachedNearbyBlockWindEmitters()
        ]);
        options.setCachedWindEmittersFrameKey(frameKey);
        return options.getCachedWindEmittersForFrame();
    }

    function computeAstronautWindAcceleration(now: number, effectiveWeight: number) {
        const windSettings = options.getWindSettings();
        const toggles = options.getEffectiveWindToggles(windSettings, options.getWindDebugToggles());
        if (!toggles.windEnabled) {
            return { x: 0, y: 0, activeEmitterCount: 0 };
        }

        const allEmitters = getActiveWindEmittersNearAstronaut(now, toggles);
        const emitterWind = options.computeEmitterWindAccelerationAtPoint(
            options.astronaut.position.x,
            options.astronaut.position.y,
            now,
            allEmitters,
            'astronaut'
        );
        let totalX = emitterWind.x;
        let totalY = emitterWind.y;

        if (toggles.surfaceWindEnabled) {
            const surfaceWind = options.applySurfaceWindField(
                options.astronaut.position.x,
                options.astronaut.position.y,
                now,
                windSettings
            );
            totalX += surfaceWind.x;
            totalY += surfaceWind.y;
        }

        const normalizedSettings = options.normalizeWindSettings(windSettings);
        const surfaceEdgeProximity = toggles.surfaceWindEnabled
            ? options.getSurfaceWindEdgeProximity(options.astronaut.position.x, normalizedSettings).edgeProximity
            : 0;
        const surfaceOvershoot = toggles.surfaceWindEnabled
            ? options.getSurfaceWindBoundaryOvershoot(options.astronaut.position.x, normalizedSettings).maxOvershoot
            : 0;
        const maxWindAcceleration = options.movementSettings.windMaxAccelerationPerFrame
            * (1 + Math.pow(surfaceEdgeProximity, 1.8) * 1.9 + Math.min(0.25, surfaceOvershoot / 1200) * 0.6);
        const weightResistance = 1 / (1 + Math.max(0, effectiveWeight) * options.movementSettings.windWeightResistancePerUnit);

        return {
            x: options.clampToRange(totalX * weightResistance, -maxWindAcceleration, maxWindAcceleration),
            y: options.clampToRange(totalY * weightResistance, -maxWindAcceleration, maxWindAcceleration),
            activeEmitterCount: emitterWind.activeEmitterCount
        };
    }

    function spawnWindParticlesNearAstronaut(now: number) {
        const windSettings = options.getWindSettings();
        const toggles = options.getEffectiveWindToggles(windSettings, options.getWindDebugToggles());
        if (!toggles.windEnabled || !toggles.windVfxEnabled || !toggles.emittersEnabled) {
            return;
        }

        const activeEmitters = getActiveWindEmittersNearAstronaut(now, toggles)
            .filter((entry) => entry.affectsAstronaut && entry.showParticles);
        for (const emitter of activeEmitters) {
            const distance = Math.hypot(options.astronaut.position.x - emitter.x, options.astronaut.position.y - emitter.y);
            if (distance > emitter.radius) {
                continue;
            }

            const falloff = 1 - distance / emitter.radius;
            const spawnCount = Math.min(
                options.movementSettings.windParticlePerEmitterMaxPerFrame,
                Math.max(0, Math.round(falloff * 2))
            );
            if (spawnCount <= 0) {
                continue;
            }

            const directionRadians = (emitter.directionDegrees * Math.PI) / 180;
            const magnitude = options.resolveEmitterMagnitude(emitter, now);
            const speed = Math.max(0.3, magnitude * 24);
            for (let index = 0; index < spawnCount; index++) {
                const jitterAngle = (Math.random() - 0.5) * 0.7;
                const angle = directionRadians + jitterAngle;
                options.windParticles.push({
                    x: options.astronaut.position.x + (Math.random() - 0.5) * 90,
                    y: options.astronaut.position.y + (Math.random() - 0.5) * 70,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 10 + Math.floor(Math.random() * 7),
                    maxLife: 16,
                    size: Math.random() < 0.5 ? 2 : 1.5,
                    hue: 170 + Math.random() * 35
                });
            }
        }

        if (toggles.surfaceWindEnabled) {
            const surfaceWind = options.applySurfaceWindField(
                options.astronaut.position.x,
                options.astronaut.position.y,
                now,
                windSettings
            );
            const magnitude = Math.hypot(surfaceWind.x, surfaceWind.y);
            if (magnitude > 0.01) {
                const directionRadians = Math.atan2(surfaceWind.y, surfaceWind.x);
                const spawnCount = Math.min(8, Math.max(2, Math.round(magnitude * 30)));
                const chunkColors = ['#ffffff', '#e0f2fe', '#7dd3fc', '#60a5fa'];
                for (let index = 0; index < spawnCount; index++) {
                    const angle = directionRadians + (Math.random() - 0.5) * 0.24;
                    const speed = (2.8 + magnitude * 56) * (0.85 + Math.random() * 0.35);
                    options.windParticles.push({
                        x: options.astronaut.position.x + (Math.random() - 0.5) * 10,
                        y: options.astronaut.position.y + (Math.random() - 0.5) * 16,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 8 + Math.floor(Math.random() * 7),
                        maxLife: 16,
                        size: Math.random() < 0.6 ? 3 : 2,
                        hue: 190 + Math.random() * 25,
                        color: chunkColors[Math.floor(Math.random() * chunkColors.length)]
                    });
                }
            }
        }
    }

    function updateAndDrawWindParticles(context: CanvasRenderingContext2D | null, camera: Position) {
        const nextParticles: WindParticle[] = [];
        const canvasSize = options.getCanvasSize();
        for (const particle of options.windParticles) {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vx *= 0.95;
            particle.vy *= 0.95;
            particle.life--;
            if (particle.life <= 0) {
                continue;
            }
            const screenX = particle.x - camera.x;
            const screenY = particle.y - camera.y;
            if (
                screenX < -4 ||
                screenX > canvasSize.width + 4 ||
                screenY < -4 ||
                screenY > canvasSize.height + 4
            ) {
                continue;
            }
            nextParticles.push(particle);
            if (context) {
                context.save();
                context.globalAlpha = options.clampToRange(particle.life / particle.maxLife, 0.15, 0.7);
                context.fillStyle = particle.color ?? `hsl(${particle.hue}, 100%, 70%)`;
                context.fillRect(screenX, screenY, particle.size, particle.size);
                context.restore();
            }
        }
        options.windParticles.length = 0;
        options.windParticles.push(...nextParticles);
    }

    return {
        getActiveWindEmittersNearAstronaut,
        computeAstronautWindAcceleration,
        spawnWindParticlesNearAstronaut,
        updateAndDrawWindParticles
    };
}
