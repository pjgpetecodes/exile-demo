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
    setSpriteMap: (value: any) => void;
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
    const context: Record<string, any> = {};
    Object.assign(context, runtimeContext);
    Object.defineProperties(context, {
        astronautBoundingBoxes: {
            enumerable: true,
            get: () => state.getAstronautBoundingBoxes(),
            set: (value) => { state.setAstronautBoundingBoxes(value); }
        },
        bulletImpactAudioSettings: {
            enumerable: true,
            get: () => state.getBulletImpactAudioSettings(),
            set: (value) => { state.setBulletImpactAudioSettings(value); }
        },
        cachedWindEmittersFrameKey: {
            enumerable: true,
            get: () => state.getCachedWindEmittersFrameKey(),
            set: (value) => { state.setCachedWindEmittersFrameKey(value); }
        },
        showCreatureOverlays: {
            enumerable: true,
            get: () => state.getShowCreatureOverlays(),
            set: (value) => { state.setShowCreatureOverlays(value); }
        },
        showWorldBoundingBoxes: {
            enumerable: true,
            get: () => state.getShowWorldBoundingBoxes(),
            set: (value) => { state.setShowWorldBoundingBoxes(value); }
        },
        colorAliases: { enumerable: true, get: () => state.getColorAliases() },
        mapBlocks: { enumerable: true, get: () => state.getMapBlocks() },
        palettes: { enumerable: true, get: () => state.getPalettes() },
        rawPaletteDefinitions: { enumerable: true, get: () => state.getRawPaletteDefinitions() },
        remappedSpriteSheets: { enumerable: true, get: () => state.getRemappedSpriteSheets() },
        spriteMap: {
            enumerable: true,
            get: () => state.getSpriteMap(),
            set: (value) => { state.setSpriteMap(value); }
        },
        spriteSheet: {
            enumerable: true,
            get: () => state.getSpriteSheet(),
            set: (value) => { state.setSpriteSheet(value); }
        },
        worldDesigner: {
            enumerable: true,
            get: () => state.getWorldDesigner(),
            set: (value) => { state.setWorldDesigner(value); }
        },
        worldMapBoundingBoxes: {
            enumerable: true,
            get: () => state.getWorldMapBoundingBoxes(),
            set: (value) => { state.setWorldMapBoundingBoxes(value); }
        },
        worldMapRotatedBoundingBoxes: {
            enumerable: true,
            get: () => state.getWorldMapRotatedBoundingBoxes(),
            set: (value) => { state.setWorldMapRotatedBoundingBoxes(value); }
        }
    });
    return context;
}
