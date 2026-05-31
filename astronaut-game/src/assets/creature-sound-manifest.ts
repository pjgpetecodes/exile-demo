export type CreatureSoundManifestEntry = {
    key: string;
    label: string;
    path: string;
};

export const CREATURE_SOUND_MANIFEST: CreatureSoundManifestEntry[] = [
    { key: 'button_off', label: 'Button off', path: './src/assets/audio/button_off.wav' },
    { key: 'button_on', label: 'Button on', path: './src/assets/audio/button_on.wav' },
    { key: 'door_close', label: 'Door close', path: './src/assets/audio/door_close.wav' },
    { key: 'door_open', label: 'Door open', path: './src/assets/audio/door_open.wav' },
    { key: 'get', label: 'Get', path: './src/assets/audio/get.wav' },
    { key: 'ouch_1', label: 'Ouch 1', path: './src/assets/audio/ouch_1.wav' },
    { key: 'ouch_2', label: 'Ouch 2', path: './src/assets/audio/ouch_2.wav' },
    { key: 'remember', label: 'Remember', path: './src/assets/audio/remember.wav' },
    { key: 'save', label: 'Save', path: './src/assets/audio/save.wav' },
    { key: 'teleport', label: 'Teleport', path: './src/assets/audio/teleport.wav' },
    { key: 'welcome', label: 'Welcome', path: './src/assets/audio/welcome.wav' }
];
