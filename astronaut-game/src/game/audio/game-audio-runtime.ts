import type { Collectable } from '../../entities/collectable.js';
import type { Position } from '../../types/index.js';

// Runtime audio helpers are isolated so gameplay loop logic can stay focused on orchestration.

type GameAudioRuntimeDependencies = {
    getSoundEnabled: () => boolean;
    creatureManifestSounds: Record<string, HTMLAudioElement | undefined>;
    ouchSounds: HTMLAudioElement[];
    plasmaGrenadeImpactSound: HTMLAudioElement;
    grenadeArmedSound: HTMLAudioElement;
    bulletExplosionSound: HTMLAudioElement;
    bulletExplosion2Sound: HTMLAudioElement;
    mushroomsSound: HTMLAudioElement;
};

type MushroomAmbientParams = {
    astronautPosition: Position;
    mushrooms: Array<Pick<Position, 'x' | 'y'>>;
    spriteScale: number;
    ambientRange: number;
    ambientBaseVolume: number;
    minDelayMs: number;
    maxDelayMs: number;
    now: number;
};

export function createGameAudioRuntime({
    getSoundEnabled,
    creatureManifestSounds,
    ouchSounds,
    plasmaGrenadeImpactSound,
    grenadeArmedSound,
    bulletExplosionSound,
    bulletExplosion2Sound,
    mushroomsSound
}: GameAudioRuntimeDependencies) {
    let grenadeArmedLoopActive = false;
    let nextMushroomAmbientAt = 0;

    function playRuntimeSound(audio: HTMLAudioElement, volume = 1) {
        if (!getSoundEnabled()) {
            return;
        }
        audio.volume = Math.max(0, Math.min(1, volume));
        try {
            audio.currentTime = 0;
            audio.play();
        } catch {}
    }

    function playManifestSound(key: string, volume = 1) {
        const audio = creatureManifestSounds[key];
        if (!audio) {
            return;
        }
        playRuntimeSound(audio, volume);
    }

    function playAstronautImpactSound() {
        playRuntimeSound(ouchSounds[Math.floor(Math.random() * ouchSounds.length)], 0.8);
    }

    function playPlasmaGrenadeImpactSound() {
        playRuntimeSound(plasmaGrenadeImpactSound, 0.95);
    }

    function playBulletImpactSound(volume: number) {
        playRuntimeSound(bulletExplosionSound, volume);
    }

    function playExplosionDamageSound(destroyedDoor: boolean, volume: number) {
        playRuntimeSound(
            destroyedDoor ? bulletExplosion2Sound : bulletExplosionSound,
            volume
        );
    }

    function updateGrenadeArmedLoopSound(
        collectables: Collectable[],
        isArmedGrenade: (collectable: Collectable) => boolean
    ) {
        const shouldPlay = getSoundEnabled() && collectables.some(isArmedGrenade);
        if (shouldPlay) {
            grenadeArmedSound.loop = true;
            grenadeArmedSound.volume = 0.5;
            if (!grenadeArmedLoopActive) {
                try {
                    grenadeArmedSound.currentTime = 0;
                    grenadeArmedSound.play();
                } catch {}
                grenadeArmedLoopActive = true;
            }
            return;
        }

        if (grenadeArmedLoopActive) {
            try {
                grenadeArmedSound.pause();
                grenadeArmedSound.currentTime = 0;
            } catch {}
            grenadeArmedLoopActive = false;
        }
    }

    function updateMushroomAmbientLoopSound({
        astronautPosition,
        mushrooms,
        spriteScale,
        ambientRange,
        ambientBaseVolume,
        minDelayMs,
        maxDelayMs,
        now
    }: MushroomAmbientParams) {
        if (!getSoundEnabled()) {
            nextMushroomAmbientAt = 0;
            return;
        }

        if (mushrooms.length === 0) {
            nextMushroomAmbientAt = 0;
            return;
        }

        const tileSize = 32 * spriteScale;
        const mushroomCenterOffset = tileSize / 2;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const mushroom of mushrooms) {
            const dx = mushroom.x + mushroomCenterOffset - astronautPosition.x;
            const dy = mushroom.y + mushroomCenterOffset - astronautPosition.y;
            const distance = Math.hypot(dx, dy);
            if (distance < nearestDistance) {
                nearestDistance = distance;
            }
        }

        if (nearestDistance > ambientRange) {
            nextMushroomAmbientAt = 0;
            return;
        }

        if (now < nextMushroomAmbientAt) {
            return;
        }

        const volume = Math.max(
            0,
            Math.min(1, ambientBaseVolume * (1 - nearestDistance / ambientRange))
        );
        if (volume > 0) {
            const ambientInstance = mushroomsSound.cloneNode(true);
            if (ambientInstance instanceof HTMLAudioElement) {
                ambientInstance.volume = volume;
                void ambientInstance.play().catch(() => { });
            }
        }
        const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
        nextMushroomAmbientAt = now + delay;
    }

    return {
        playRuntimeSound,
        playManifestSound,
        playAstronautImpactSound,
        playPlasmaGrenadeImpactSound,
        playBulletImpactSound,
        playExplosionDamageSound,
        updateGrenadeArmedLoopSound,
        updateMushroomAmbientLoopSound
    };
}
