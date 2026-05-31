import { runGameInitRuntime } from './game-init-runtime.js';
import { buildGameInitRuntimeContext } from './game-main-runtime-builders.js';
import { createGameEntityRuntimeBootstrap } from './game-entity-runtime-bootstrap.js';
import {
    buildGameEntityRuntimeBootstrapOptions,
    buildGameInitRuntimeValues,
    buildGameInitStateAccessors
} from './game-main-dependency-builders.js';

type BuildGameInitRuntimeValuesContext = Parameters<typeof buildGameInitRuntimeValues>[0];
type BuildGameInitStateAccessorsContext = Parameters<typeof buildGameInitStateAccessors>[0];
type BuildGameEntityRuntimeBootstrapContext = Parameters<typeof buildGameEntityRuntimeBootstrapOptions>[0];

export function createGameMainInitRunner(context: {
    runtimeValues: BuildGameInitRuntimeValuesContext;
    stateAccessors: BuildGameInitStateAccessorsContext;
}) {
    const initRuntimeValues = buildGameInitRuntimeValues(context.runtimeValues);
    const initStateAccessors = buildGameInitStateAccessors(context.stateAccessors);
    return async function init() {
        await runGameInitRuntime(buildGameInitRuntimeContext(initRuntimeValues, initStateAccessors));
    };
}

export function createGameMainRuntimeBootstrap(context: BuildGameEntityRuntimeBootstrapContext) {
    return createGameEntityRuntimeBootstrap(buildGameEntityRuntimeBootstrapOptions(context));
}
