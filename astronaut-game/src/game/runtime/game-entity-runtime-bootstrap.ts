import { initializeGameEntityRuntimes } from './game-runtime-initializer.js';

type RuntimeInitializerOptions = Record<string, any>;

export function createGameEntityRuntimeBootstrap(options: RuntimeInitializerOptions) {
    const runtimeAssemblies = initializeGameEntityRuntimes(options);
    const { creatureRuntime, creatureProjectileRuntime } = runtimeAssemblies;
    const {
        getAimOriginPosition,
        updateHeldCollectablePosition,
        isCollectableOverlappingAstronaut,
        handleCollectableInteractions,
        releaseHeldCollectable
    } = runtimeAssemblies.heldItemRuntime;
    const {
        updateThrowAngle,
        updateAndDrawThrowGuide
    } = runtimeAssemblies.throwGuideRuntime;
    const {
        resolveAstronautCollectableCollisions,
        updateSingleCollectablePhysics,
        updateCollectablePhysics
    } = runtimeAssemblies.collectablePhysicsRuntime;

    return {
        runtimeAssemblies,
        creatureRuntime,
        creatureProjectileRuntime,
        getAimOriginPosition,
        updateHeldCollectablePosition,
        isCollectableOverlappingAstronaut,
        handleCollectableInteractions,
        releaseHeldCollectable,
        updateThrowAngle,
        updateAndDrawThrowGuide,
        resolveAstronautCollectableCollisions,
        updateSingleCollectablePhysics,
        updateCollectablePhysics
    };
}
