import { LOOP_RUNTIME_KEYS } from './game-main-runtime-builders.js';

export function buildGameLoopRuntimeValues(source: Record<string, any>) {
    const runtimeValues: Record<string, any> = {};
    for (const key of LOOP_RUNTIME_KEYS) {
        runtimeValues[key] = source[key];
    }
    return runtimeValues;
}
