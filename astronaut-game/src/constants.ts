// --- Map size in pixels (constant) ---
export const MAP_WIDTH = 10000;  // pixels
export const MAP_HEIGHT = 10000; // pixels

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
export const rememberSound = new Audio('./src/assets/remember.wav');
export const teleportSound = new Audio('./src/assets/teleport.wav');
export const buttonOnSound = new Audio('./src/assets/button_on.wav');
export const doorOpenSound = new Audio('./src/assets/door_open.wav');
export const doorCloseSound = new Audio('./src/assets/door_close.wav');
export const getSound = new Audio('./src/assets/get.wav');
export const saveSound = new Audio('./src/assets/save.wav');
export const ouchSounds = [
    new Audio('./src/assets/ouch_1.wav'),
    new Audio('./src/assets/ouch_2.wav')
];

const SOUND_EFFECTS = [
    rememberSound,
    teleportSound,
    buttonOnSound,
    doorOpenSound,
    doorCloseSound,
    getSound,
    saveSound,
    ...ouchSounds
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

