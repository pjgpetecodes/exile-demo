import { normalizeWaterBlock } from '../../../world/water-blocks.js';

export type ThreadedFireInput = {
    key: string;
    basePalette: number;
    paletteCount: number;
    now: number;
    seed: number;
};

export type ThreadedFireOutput = {
    key: string;
    paletteIdx: number;
    offsetX: number;
    offsetY: number;
    rotationRadians: number;
};

const FIRE_PRIMARY_PALETTE = 38;
const FIRE_SECONDARY_PALETTE = 39;
const FIRE_BOB_X_PIXELS = 2.4;
const FIRE_BOB_Y_PIXELS = 2.8;
const FIRE_ROTATION_DEGREES = 6;
const FIRE_MIN_ROTATION_BIAS_DEGREES = 1.2;
const WASP_SWARM_TURN_INTERVAL_MIN_MS = 260;
const WASP_SWARM_TURN_INTERVAL_MAX_MS = 900;
const WASP_SWARM_STEP_MIN = 0.35;
const WASP_SWARM_STEP_MAX = 1.25;

type AnimatedCreatureKind = 'bird' | 'wasp';
type WaspBehaviorState = 'attacking' | 'returning';

export type ThreadedCreatureAnimationInput = {
    key: string;
    kind: AnimatedCreatureKind;
    authoredType: string;
    frameNow: number;
    entityId?: number;
    behaviorState?: WaspBehaviorState;
    stateStartedAt?: number;
};

export type ThreadedCreatureAnimationOutput = {
    key: string;
    spriteType: string;
};

export type ThreadedWaspSwarmInput = {
    key: string;
    frameNow: number;
    behaviorSeed: number;
};

export type ThreadedWaspSwarmOutput = {
    key: string;
    swarmVectorX: number;
    swarmVectorY: number;
    nextSwarmTurnAt: number;
};

type ChunkBlockLike = {
    x: number;
    y: number;
    type: string;
    collision?: boolean;
    maskAstronaut?: boolean;
    translation?: string;
    [key: string]: unknown;
};

const BIRD_ANIMATION_FRAMES = ['bird1', 'bird2', 'bird3', 'bird4'] as const;
const BIRD_ANIMATION_FRAME_DURATION_MS = 90;
const WASP_ANIMATION_FRAMES = ['wasp1', 'wasp2', 'wasp3'] as const;
const WASP_ATTACK_ANIMATION_FRAME_DURATION_MS = 68;
const WASP_RETURN_ANIMATION_FRAME_DURATION_MS = 118;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function deterministicUnit(seed: number, channel: number) {
    const phase = seed * 12.9898 + channel * 78.233;
    const raw = Math.sin(phase) * 43758.5453123;
    return raw - Math.floor(raw);
}

function getTeleporterBlockPreferenceScore(block: ChunkBlockLike) {
    let score = 0;
    if (block.type === 'teleporter') {
        if (block.collision !== false) {
            score += 2;
        }
        if (block.maskAstronaut === false) {
            score += 1;
        }
        if (block.translation === 'center') {
            score += 1;
        }
        return score;
    }
    if (block.type === 'teleporter_pad') {
        if (block.maskAstronaut === false) {
            score += 2;
        }
        if (block.translation === 'center') {
            score += 1;
        }
    }
    return score;
}

function normalizeChunkTeleporterBlocks(blocks: ChunkBlockLike[]) {
    if (blocks.length === 0) {
        return blocks;
    }
    const preferredByTypeAndPosition = new Map<string, ChunkBlockLike>();
    for (const block of blocks) {
        if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
            continue;
        }
        const key = `${block.type}:${block.x},${block.y}`;
        const existing = preferredByTypeAndPosition.get(key);
        if (!existing) {
            preferredByTypeAndPosition.set(key, block);
            continue;
        }
        const existingScore = getTeleporterBlockPreferenceScore(existing);
        const candidateScore = getTeleporterBlockPreferenceScore(block);
        if (candidateScore > existingScore) {
            preferredByTypeAndPosition.set(key, block);
        }
    }
    return blocks.filter((block) => {
        if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
            return true;
        }
        const key = `${block.type}:${block.x},${block.y}`;
        return preferredByTypeAndPosition.get(key) === block;
    });
}

export function preprocessThreadedChunkPayload(entries: unknown[]): ChunkBlockLike[] {
    const normalized = entries.map((entry) => normalizeWaterBlock(entry as ChunkBlockLike));
    return normalizeChunkTeleporterBlocks(normalized);
}

function getBirdSpriteFrameOffset(type: string) {
    const match = /^bird(\d+)$/i.exec(type);
    if (!match) {
        return 0;
    }
    return (Math.max(1, Number(match[1])) - 1) % BIRD_ANIMATION_FRAMES.length;
}

function getWaspSpriteFrameOffset(type: string) {
    const match = /^wasp(\d+)$/i.exec(type);
    if (!match) {
        return 0;
    }
    return (Math.max(1, Number(match[1])) - 1) % WASP_ANIMATION_FRAMES.length;
}

export function resolveThreadedFirePaletteIndex(
    basePalette: number,
    paletteCount: number,
    now: number,
    seed: number
) {
    const normalizedPaletteCount = Math.max(1, Math.floor(paletteCount));
    const fallbackPalette = clamp(Math.round(basePalette), 0, normalizedPaletteCount - 1);
    const preferredPalettes = [FIRE_PRIMARY_PALETTE, FIRE_SECONDARY_PALETTE]
        .filter((palette) => palette >= 0 && palette < normalizedPaletteCount);
    if (preferredPalettes.length === 0) {
        return fallbackPalette;
    }
    if (preferredPalettes.length === 1) {
        return preferredPalettes[0];
    }

    const phase = now / 93 + (seed % 1021) * 0.013;
    const irregularSignal =
        Math.sin(phase) +
        0.42 * Math.sin(phase * 2.27 + 1.19) +
        0.18 * Math.sin(phase * 5.11 + 2.41);
    return irregularSignal > 0.1
        ? preferredPalettes[1]
        : preferredPalettes[0];
}

export function resolveThreadedFireMotion(now: number, seed: number) {
    const phase = now / 215 + (seed % 7919) * 0.0008;
    const offsetX =
        (Math.sin(phase) + 0.35 * Math.sin(phase * 1.91 + 1.4)) * FIRE_BOB_X_PIXELS;
    const offsetY =
        (Math.sin(phase * 1.43 + 2.1) + 0.24 * Math.sin(phase * 3.17 + 0.35)) * FIRE_BOB_Y_PIXELS;
    const rotationDegrees =
        (Math.sin(phase * 1.21 + 0.8) + 0.28 * Math.sin(phase * 2.37 + 2.3)) * FIRE_ROTATION_DEGREES;
    const minBias = FIRE_MIN_ROTATION_BIAS_DEGREES;
    const biasedRotationDegrees = rotationDegrees >= 0
        ? Math.max(minBias, rotationDegrees)
        : Math.min(-minBias, rotationDegrees);
    return {
        offsetX,
        offsetY,
        rotationRadians: (biasedRotationDegrees * Math.PI) / 180
    };
}

export function resolveThreadedFireFrame(inputs: ThreadedFireInput[]): ThreadedFireOutput[] {
    return inputs.map((input) => {
        const paletteIdx = resolveThreadedFirePaletteIndex(
            input.basePalette,
            input.paletteCount,
            input.now,
            input.seed
        );
        const motion = resolveThreadedFireMotion(input.now, input.seed);
        return {
            key: input.key,
            paletteIdx,
            offsetX: motion.offsetX,
            offsetY: motion.offsetY,
            rotationRadians: motion.rotationRadians
        };
    });
}

export function resolveThreadedCreatureAnimation(input: ThreadedCreatureAnimationInput): string {
    if (input.kind === 'bird') {
        const frameOffset = getBirdSpriteFrameOffset(input.authoredType);
        const entityOffset = typeof input.entityId === 'number'
            ? Math.abs(input.entityId) % BIRD_ANIMATION_FRAMES.length
            : 0;
        const frameIndex = (
            Math.floor(input.frameNow / BIRD_ANIMATION_FRAME_DURATION_MS) + frameOffset + entityOffset
        ) % BIRD_ANIMATION_FRAMES.length;
        return BIRD_ANIMATION_FRAMES[frameIndex];
    }

    const frameOffset = getWaspSpriteFrameOffset(input.authoredType);
    const entityOffset = typeof input.entityId === 'number'
        ? Math.abs(input.entityId) % WASP_ANIMATION_FRAMES.length
        : 0;
    const behaviorState = input.behaviorState === 'returning' ? 'returning' : 'attacking';
    const frameDurationMs = behaviorState === 'returning'
        ? WASP_RETURN_ANIMATION_FRAME_DURATION_MS
        : WASP_ATTACK_ANIMATION_FRAME_DURATION_MS;
    const stateStartedAt = Number.isFinite(Number(input.stateStartedAt))
        ? Number(input.stateStartedAt)
        : input.frameNow;
    const elapsedMs = Math.max(0, input.frameNow - stateStartedAt);
    const frameIndex = (
        Math.floor(elapsedMs / Math.max(1, frameDurationMs)) + frameOffset + entityOffset
    ) % WASP_ANIMATION_FRAMES.length;
    return WASP_ANIMATION_FRAMES[frameIndex];
}

export function resolveThreadedCreatureAnimations(
    inputs: ThreadedCreatureAnimationInput[]
): ThreadedCreatureAnimationOutput[] {
    return inputs.map((input) => ({
        key: input.key,
        spriteType: resolveThreadedCreatureAnimation(input)
    }));
}

export function resolveThreadedWaspSwarmTurn(input: ThreadedWaspSwarmInput): ThreadedWaspSwarmOutput {
    const normalizedSeed = Number.isFinite(input.behaviorSeed)
        ? input.behaviorSeed
        : 0.5;
    const frameBucket = Math.max(1, Math.floor(input.frameNow / 33));
    const headingUnit = deterministicUnit(normalizedSeed + frameBucket * 0.00017, 1);
    const stepUnit = deterministicUnit(normalizedSeed + frameBucket * 0.00031, 2);
    const intervalUnit = deterministicUnit(normalizedSeed + frameBucket * 0.00053, 3);
    const heading = headingUnit * Math.PI * 2;
    const stepMagnitude = WASP_SWARM_STEP_MIN + stepUnit * (WASP_SWARM_STEP_MAX - WASP_SWARM_STEP_MIN);
    const nextTurnInMs = Math.round(
        WASP_SWARM_TURN_INTERVAL_MIN_MS
        + intervalUnit * (WASP_SWARM_TURN_INTERVAL_MAX_MS - WASP_SWARM_TURN_INTERVAL_MIN_MS)
    );
    return {
        key: input.key,
        swarmVectorX: Math.cos(heading) * stepMagnitude,
        swarmVectorY: Math.sin(heading) * stepMagnitude,
        nextSwarmTurnAt: input.frameNow + nextTurnInMs
    };
}

export function resolveThreadedWaspSwarmTurns(inputs: ThreadedWaspSwarmInput[]): ThreadedWaspSwarmOutput[] {
    return inputs.map((input) => resolveThreadedWaspSwarmTurn(input));
}
