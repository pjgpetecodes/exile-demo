import type { Position } from '../../types/index.js';
import type { Creature } from '../../entities/creature.js';

type EntityRect = { left: number; right: number; top: number; bottom: number };
type CollisionBounds = EntityRect;
type RenderedEntitySprite = { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null;

type GameCombatHelpersOptions = {
    getCreatureEntities: () => Creature[];
    getAstronautRect: () => EntityRect;
    getEntityCollisionBounds: (entity: any) => CollisionBounds;
    getEntityRect: (x: number, y: number, bounds: CollisionBounds) => EntityRect;
    getAstronautRenderedWorldSprite: () => RenderedEntitySprite;
    getRenderedEntityWorldSprite: (entity: any) => RenderedEntitySprite;
    doRenderedSpritesOverlap: (first: RenderedEntitySprite, second: RenderedEntitySprite) => boolean;
    gameState: { astronaut: { position: Position } };
    astronaut: { velocity: Position };
    applyAstronautDamage: (damage: number, now?: number) => void;
    ouchSounds: HTMLAudioElement[];
    getSoundEnabled: () => boolean;
    creatureManifestSounds: Record<string, HTMLAudioElement>;
    getEntityCenter: (x: number, y: number, bounds: CollisionBounds) => Position;
    gameAudio: { playRuntimeSound: (audio: HTMLAudioElement, volume?: number) => void };
};

export function createGameCombatHelpers(options: GameCombatHelpersOptions) {
    const swallowAutoplayRejection = () => {};
    const isBirdCollision = (creature: Creature) =>
        creature.archetype === 'bird' || /^bird/i.test(creature.type);

    function resolveAstronautCreatureCollisions() {
        for (const creature of options.getCreatureEntities()) {
            const astronautRect = options.getAstronautRect();
            const bounds = options.getEntityCollisionBounds(creature);
            const creatureRect = options.getEntityRect(creature.x, creature.y, bounds);
            const overlapX = Math.min(astronautRect.right, creatureRect.right) - Math.max(astronautRect.left, creatureRect.left) + 1;
            const overlapY = Math.min(astronautRect.bottom, creatureRect.bottom) - Math.max(astronautRect.top, creatureRect.top) + 1;
            if (overlapX <= 0 || overlapY <= 0) {
                continue;
            }
            if (isBirdCollision(creature)) {
                const astronautRendered = options.getAstronautRenderedWorldSprite();
                const creatureRendered = options.getRenderedEntityWorldSprite(creature);
                if (!options.doRenderedSpritesOverlap(astronautRendered, creatureRendered)) {
                    continue;
                }
            }

            const creatureDeltaX = creature.x - creature.previousX;
            const creatureDeltaY = creature.y - creature.previousY;
            const astronautCenterX = (astronautRect.left + astronautRect.right) / 2;
            const creatureCenterX = (creatureRect.left + creatureRect.right) / 2;
            const astronautCenterY = (astronautRect.top + astronautRect.bottom) / 2;
            const creatureCenterY = (creatureRect.top + creatureRect.bottom) / 2;

            if (creature.pushAstronaut && creature.collision) {
                const resolveHorizontally = Math.abs(creatureDeltaX) >= Math.abs(creatureDeltaY) || overlapX <= overlapY;
                if (resolveHorizontally) {
                    const horizontalDirection = creatureDeltaX !== 0
                        ? Math.sign(creatureDeltaX)
                        : astronautCenterX < creatureCenterX ? -1 : 1;
                    options.gameState.astronaut.position.x += horizontalDirection * Math.ceil(overlapX);
                    options.astronaut.velocity.x = 0;
                } else {
                    const verticalDirection = creatureDeltaY !== 0
                        ? Math.sign(creatureDeltaY)
                        : astronautCenterY < creatureCenterY ? -1 : 1;
                    options.gameState.astronaut.position.y += verticalDirection * Math.ceil(overlapY);
                    options.astronaut.velocity.y = 0;
                }
            }

            if (creature.damageOnContact <= 0) {
                continue;
            }

            const runtimeState = creature.state ?? {};
            const nextSoundAt = typeof runtimeState.nextContactSoundAt === 'number'
                ? Number(runtimeState.nextContactSoundAt)
                : 0;
            const nextDamageAt = typeof runtimeState.nextContactDamageAt === 'number'
                ? Number(runtimeState.nextContactDamageAt)
                : 0;
            const now = performance.now();
            if (now >= nextDamageAt) {
                options.applyAstronautDamage(Math.max(4, creature.damageOnContact * 6), now);
                runtimeState.nextContactDamageAt = now + 450;
            }
            if (now >= nextSoundAt) {
                const ouchSound = options.ouchSounds[Math.floor(Math.random() * options.ouchSounds.length)];
                try {
                    ouchSound.currentTime = 0;
                    void ouchSound.play().catch(swallowAutoplayRejection);
                } catch {}
                runtimeState.nextContactSoundAt = now + 600;
                creature.state = runtimeState;
            }
        }
    }

    function updateCreatureSounds(frameNow: number) {
        if (!options.getSoundEnabled()) {
            return;
        }

        const astronautRect = options.getAstronautRect();
        const astronautCenter = {
            x: (astronautRect.left + astronautRect.right) / 2,
            y: (astronautRect.top + astronautRect.bottom) / 2
        };

        for (const creature of options.getCreatureEntities()) {
            if (!creature.sound?.enabled || !creature.sound.sound) {
                continue;
            }

            const audio = options.creatureManifestSounds[creature.sound.sound];
            if (!audio) {
                continue;
            }

            const bounds = options.getEntityCollisionBounds(creature);
            const creatureCenter = options.getEntityCenter(creature.x, creature.y, bounds);
            const distance = Math.hypot(astronautCenter.x - creatureCenter.x, astronautCenter.y - creatureCenter.y);
            const range = Math.max(1, creature.sound.range);
            if (distance > range) {
                continue;
            }

            const runtimeState = creature.state ?? {};
            const nextSoundAt = typeof runtimeState.nextAmbientSoundAt === 'number'
                ? Number(runtimeState.nextAmbientSoundAt)
                : 0;
            if (frameNow < nextSoundAt) {
                continue;
            }

            const varianceWindow = Math.max(0, creature.sound.randomVarianceMs);
            const variance = varianceWindow > 0 ? (Math.random() * 2 - 1) * varianceWindow : 0;
            runtimeState.nextAmbientSoundAt = frameNow + Math.max(250, creature.sound.intervalMs + variance);
            creature.state = runtimeState;
            options.gameAudio.playRuntimeSound(audio, creature.sound.volume * (1 - distance / range));
        }
    }

    return {
        resolveAstronautCreatureCollisions,
        updateCreatureSounds
    };
}
