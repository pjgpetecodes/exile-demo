export type CreatureSoundManifestEntry = {
    key: string;
    label: string;
    path: string;
};

export const CREATURE_SOUND_MANIFEST: CreatureSoundManifestEntry[] = [
    { key: 'button_off', label: 'Button off', path: './src/assets/button_off.wav' },
    { key: 'button_on', label: 'Button on', path: './src/assets/button_on.wav' },
    { key: 'door_close', label: 'Door close', path: './src/assets/door_close.wav' },
    { key: 'door_open', label: 'Door open', path: './src/assets/door_open.wav' },
    { key: 'get', label: 'Get', path: './src/assets/get.wav' },
    { key: 'ouch_1', label: 'Ouch 1', path: './src/assets/ouch_1.wav' },
    { key: 'ouch_2', label: 'Ouch 2', path: './src/assets/ouch_2.wav' },
    { key: 'remember', label: 'Remember', path: './src/assets/remember.wav' },
    { key: 'save', label: 'Save', path: './src/assets/save.wav' },
    { key: 'teleport', label: 'Teleport', path: './src/assets/teleport.wav' },
    { key: 'welcome', label: 'Welcome', path: './src/assets/welcome.wav' }
];
