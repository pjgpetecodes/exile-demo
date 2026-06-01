import { describe, expect, it, vi } from 'vitest';
import { createGameAudioRuntime } from '../../../src/game/audio/game-audio-runtime';

type FakeAudio = {
    volume: number;
    currentTime: number;
    paused: boolean;
    ended: boolean;
    loop: boolean;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    cloneNode: ReturnType<typeof vi.fn>;
};

function createFakeAudioFactory() {
    const clones: FakeAudio[] = [];
    const makeFakeAudio = (): FakeAudio => {
        const audio: FakeAudio = {
            volume: 1,
            currentTime: 0,
            paused: true,
            ended: false,
            loop: false,
            play: vi.fn(() => {
                audio.paused = false;
                audio.ended = false;
                return Promise.resolve();
            }),
            pause: vi.fn(() => {
                audio.paused = true;
            }),
            cloneNode: vi.fn(() => {
                const clone = makeFakeAudio();
                clones.push(clone);
                return clone;
            })
        };
        return audio;
    };

    return {
        base: makeFakeAudio(),
        clones
    };
}

describe('game audio runtime overlap', () => {
    it('plays overlapping one-shot sounds on separate instances', () => {
        const explosion = createFakeAudioFactory();
        const runtime = createGameAudioRuntime({
            getSoundEnabled: () => true,
            creatureManifestSounds: {},
            ouchSounds: [explosion.base as unknown as HTMLAudioElement],
            plasmaGrenadeImpactSound: explosion.base as unknown as HTMLAudioElement,
            grenadeArmedSound: explosion.base as unknown as HTMLAudioElement,
            bulletExplosionSound: explosion.base as unknown as HTMLAudioElement,
            bulletExplosion2Sound: explosion.base as unknown as HTMLAudioElement,
            mushroomsSound: explosion.base as unknown as HTMLAudioElement
        });

        runtime.playRuntimeSound(explosion.base as unknown as HTMLAudioElement, 0.4);
        runtime.playRuntimeSound(explosion.base as unknown as HTMLAudioElement, 0.8);

        expect(explosion.base.play).not.toHaveBeenCalled();
        expect(explosion.clones).toHaveLength(2);
        expect(explosion.clones[0].play).toHaveBeenCalledTimes(1);
        expect(explosion.clones[1].play).toHaveBeenCalledTimes(1);
        expect(explosion.clones[1].volume).toBe(0.8);
    });

    it('reuses a finished instance instead of unbounded clone growth', () => {
        const sound = createFakeAudioFactory();
        const runtime = createGameAudioRuntime({
            getSoundEnabled: () => true,
            creatureManifestSounds: {},
            ouchSounds: [sound.base as unknown as HTMLAudioElement],
            plasmaGrenadeImpactSound: sound.base as unknown as HTMLAudioElement,
            grenadeArmedSound: sound.base as unknown as HTMLAudioElement,
            bulletExplosionSound: sound.base as unknown as HTMLAudioElement,
            bulletExplosion2Sound: sound.base as unknown as HTMLAudioElement,
            mushroomsSound: sound.base as unknown as HTMLAudioElement
        });

        runtime.playRuntimeSound(sound.base as unknown as HTMLAudioElement, 1);
        expect(sound.clones).toHaveLength(1);
        sound.clones[0].paused = true;
        runtime.playRuntimeSound(sound.base as unknown as HTMLAudioElement, 1);

        expect(sound.clones).toHaveLength(1);
        expect(sound.clones[0].play).toHaveBeenCalledTimes(2);
    });
});
