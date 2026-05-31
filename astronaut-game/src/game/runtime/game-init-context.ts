type RuntimeInitStateBindings = {
    getAstronautBoundingBoxes: () => any;
    setAstronautBoundingBoxes: (value: any) => void;
    getBulletImpactAudioSettings: () => any;
    setBulletImpactAudioSettings: (value: any) => void;
    getCachedWindEmittersFrameKey: () => number;
    setCachedWindEmittersFrameKey: (value: number) => void;
    getShowCreatureOverlays: () => boolean;
    setShowCreatureOverlays: (value: boolean) => void;
    getShowWorldBoundingBoxes: () => boolean;
    setShowWorldBoundingBoxes: (value: boolean) => void;
    getColorAliases: () => any;
    getMapBlocks: () => any;
    getPalettes: () => any;
    getRawPaletteDefinitions: () => any;
    getRemappedSpriteSheets: () => any;
    getSpriteMap: () => any;
    getSpriteSheet: () => any;
    setSpriteSheet: (value: any) => void;
    getWorldDesigner: () => any;
    setWorldDesigner: (value: any) => void;
    getWorldMapBoundingBoxes: () => any;
    setWorldMapBoundingBoxes: (value: any) => void;
    getWorldMapRotatedBoundingBoxes: () => any;
    setWorldMapRotatedBoundingBoxes: (value: any) => void;
};

export function createGameInitRuntimeContext(runtimeContext: Record<string, any>, state: RuntimeInitStateBindings) {
    return {
        ...runtimeContext,
        get astronautBoundingBoxes() { return state.getAstronautBoundingBoxes(); },
        set astronautBoundingBoxes(value) { state.setAstronautBoundingBoxes(value); },
        get bulletImpactAudioSettings() { return state.getBulletImpactAudioSettings(); },
        set bulletImpactAudioSettings(value) { state.setBulletImpactAudioSettings(value); },
        get cachedWindEmittersFrameKey() { return state.getCachedWindEmittersFrameKey(); },
        set cachedWindEmittersFrameKey(value) { state.setCachedWindEmittersFrameKey(value); },
        get showCreatureOverlays() { return state.getShowCreatureOverlays(); },
        set showCreatureOverlays(value) { state.setShowCreatureOverlays(value); },
        get showWorldBoundingBoxes() { return state.getShowWorldBoundingBoxes(); },
        set showWorldBoundingBoxes(value) { state.setShowWorldBoundingBoxes(value); },
        get colorAliases() { return state.getColorAliases(); },
        get mapBlocks() { return state.getMapBlocks(); },
        get palettes() { return state.getPalettes(); },
        get rawPaletteDefinitions() { return state.getRawPaletteDefinitions(); },
        get remappedSpriteSheets() { return state.getRemappedSpriteSheets(); },
        get spriteMap() { return state.getSpriteMap(); },
        get spriteSheet() { return state.getSpriteSheet(); },
        set spriteSheet(value) { state.setSpriteSheet(value); },
        get worldDesigner() { return state.getWorldDesigner(); },
        set worldDesigner(value) { state.setWorldDesigner(value); },
        get worldMapBoundingBoxes() { return state.getWorldMapBoundingBoxes(); },
        set worldMapBoundingBoxes(value) { state.setWorldMapBoundingBoxes(value); },
        get worldMapRotatedBoundingBoxes() { return state.getWorldMapRotatedBoundingBoxes(); },
        set worldMapRotatedBoundingBoxes(value) { state.setWorldMapRotatedBoundingBoxes(value); }
    };
}
