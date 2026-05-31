import { CREATURE_SOUND_MANIFEST } from '../assets/creature-sound-manifest.js';

// --- Map size in pixels ---
export const DEFAULT_MAP_WIDTH = 10000;
export const DEFAULT_MAP_HEIGHT = 10000;
export let MAP_WIDTH = DEFAULT_MAP_WIDTH;
export let MAP_HEIGHT = DEFAULT_MAP_HEIGHT;

export function setMapBounds(width: number, height: number) {
    MAP_WIDTH = Math.max(DEFAULT_MAP_WIDTH, Math.ceil(width / 32) * 32);
    MAP_HEIGHT = Math.max(DEFAULT_MAP_HEIGHT, Math.ceil(height / 32) * 32);
}

// Sprite scaling factor (adjust as needed)
export const SPRITE_SCALE = 2.2;

// Sprite columns
export const SPRITE_ROW = 0; // top row
export const SPRITE_COL_STAND = 4;
export const SPRITE_COL_FLY_RIGHT = 0;
export const SPRITE_COL_FLY_DIAGONAL = 1;
export const SPRITE_COL_FLY_FLOAT = 2;
export const SPRITE_COL_FLY_DOWN = 3;
export const SPRITE_COL_WALK_START = 4;
export const SPRITE_COL_WALK_RIGHT1 = 5;
export const SPRITE_COL_WALK_RIGHT2 = 6;
export const SPRITE_COL_WALK_END = 7;
export const TELEPORT_ANIM_FRAMES = 30; // 0.5 seconds at 60fps

// --- Sound effects ---
export const rememberSound = new Audio('./src/assets/audio/remember.wav');
export const teleportSound = new Audio('./src/assets/audio/teleport.wav');
export const buttonOnSound = new Audio('./src/assets/audio/button_on.wav');
export const doorOpenSound = new Audio('./src/assets/audio/door_open.wav');
export const doorCloseSound = new Audio('./src/assets/audio/door_close.wav');
export const getSound = new Audio('./src/assets/audio/get.wav');
export const saveSound = new Audio('./src/assets/audio/save.wav');
export const bulletExplosionSound = new Audio('./src/assets/audio/BulletExplosion.wav');
export const bulletExplosion2Sound = new Audio('./src/assets/audio/BulletExplosion2.wav');
export const grenadeArmedSound = new Audio('./src/assets/audio/GrenadeArmed.wav');
export const plasmaGrenadeImpactSound = new Audio('./src/assets/audio/plasmagrenade.wav');
export const mushroomsSound = new Audio('./src/assets/audio/Mushrooms.wav');
export const ouchSounds = [
    new Audio('./src/assets/audio/ouch_1.wav'),
    new Audio('./src/assets/audio/ouch_2.wav')
];

export const creatureManifestSounds = Object.fromEntries(
    CREATURE_SOUND_MANIFEST.map((entry) => [entry.key, new Audio(entry.path)])
) as Record<string, HTMLAudioElement>;

const SOUND_EFFECTS = [
    rememberSound,
    teleportSound,
    buttonOnSound,
    doorOpenSound,
    doorCloseSound,
    getSound,
    saveSound,
    bulletExplosionSound,
    bulletExplosion2Sound,
    grenadeArmedSound,
    plasmaGrenadeImpactSound,
    mushroomsSound,
    ...ouchSounds,
    ...Object.values(creatureManifestSounds)
];

let soundEnabled = true;

export function setSoundEnabled(enabled: boolean) {
    soundEnabled = enabled;
    for (const sound of SOUND_EFFECTS) {
        sound.muted = !enabled;
    }
}

export function getSoundEnabled() {
    return soundEnabled;
}

export function toggleSoundEnabled() {
    setSoundEnabled(!soundEnabled);
    return soundEnabled;
}
