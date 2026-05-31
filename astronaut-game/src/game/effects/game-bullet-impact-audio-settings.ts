import {
    BULLET_IMPACT_AUDIO_SETTINGS,
    type BulletImpactAudioSettings
} from '../../config/settings.js';

function clampToRange(value: number, minimum: number, maximum: number) {
    return Math.max(minimum, Math.min(maximum, value));
}

export function normalizeBulletImpactAudioSettings(
    settings: BulletImpactAudioSettings | Partial<BulletImpactAudioSettings> | null | undefined
): BulletImpactAudioSettings {
    const normalizeKey = (value: unknown): BulletImpactAudioSettings['primary'] =>
        value === 'bulletExplosion2' ? 'bulletExplosion2' : 'bulletExplosion';

    return {
        primary: normalizeKey(settings?.primary),
        alternate: normalizeKey(settings?.alternate),
        alternateChance: clampToRange(
            typeof settings?.alternateChance === 'number'
                ? settings.alternateChance
                : BULLET_IMPACT_AUDIO_SETTINGS.alternateChance,
            0,
            1
        ),
        volume: clampToRange(
            typeof settings?.volume === 'number'
                ? settings.volume
                : BULLET_IMPACT_AUDIO_SETTINGS.volume,
            0,
            1
        )
    };
}
