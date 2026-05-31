import { buildGameLoopRuntimeValues } from './game-loop-runtime-values.js';

export function createGameLoopRuntimeValuesProvider(getRuntimeValuesSource: () => Record<string, any>) {
    return function getLoopRuntimeValues() {
        return buildGameLoopRuntimeValues(getRuntimeValuesSource());
    };
}
