import { createGameMainInitRunner } from './game-main-runtime-assembly.js';

type ValuePack = Record<string, any>;

function buildGameplayStateAccessors(context: ValuePack) {
    return {
        astronautBoundingBoxes: {
            get: () => context.getAstronautBoundingBoxes(),
            set: (value: any) => { context.setAstronautBoundingBoxes(value); }
        },
        bulletImpactAudioSettings: {
            get: () => context.getBulletImpactAudioSettings(),
            set: (value: any) => { context.setBulletImpactAudioSettings(value); }
        },
        cachedWindEmittersFrameKey: {
            get: () => context.getCachedWindEmittersFrameKey(),
            set: (value: number) => { context.setCachedWindEmittersFrameKey(value); }
        },
        showCreatureOverlays: {
            get: () => context.getShowCreatureOverlays(),
            set: (value: boolean) => { context.setShowCreatureOverlays(value); }
        },
        showWorldBoundingBoxes: {
            get: () => context.getShowWorldBoundingBoxes(),
            set: (value: boolean) => { context.setShowWorldBoundingBoxes(value); }
        }
    };
}

function buildResourceStateAccessors(context: ValuePack) {
    return {
        colorAliases: { get: () => context.getColorAliases() },
        mapBlocks: { get: () => context.getMapBlocks() },
        palettes: { get: () => context.getPalettes() },
        rawPaletteDefinitions: { get: () => context.getRawPaletteDefinitions() },
        remappedSpriteSheets: { get: () => context.getRemappedSpriteSheets() },
        spriteMap: {
            get: () => context.getSpriteMap(),
            set: (value: any) => { context.setSpriteMap(value); }
        },
        spriteSheet: {
            get: () => context.getSpriteSheet(),
            set: (value: HTMLImageElement) => { context.setSpriteSheet(value); }
        }
    };
}

function buildWorldStateAccessors(context: ValuePack) {
    return {
        worldDesigner: {
            get: () => context.getWorldDesigner(),
            set: (value: any) => { context.setWorldDesigner(value); }
        },
        worldMapBoundingBoxes: {
            get: () => context.getWorldMapBoundingBoxes(),
            set: (value: any) => { context.setWorldMapBoundingBoxes(value); }
        },
        worldMapRotatedBoundingBoxes: {
            get: () => context.getWorldMapRotatedBoundingBoxes(),
            set: (value: any) => { context.setWorldMapRotatedBoundingBoxes(value); }
        }
    };
}

export function createGameMainInitFromContext(context: ValuePack) {
    return createGameMainInitRunner({
        runtimeValues: {
            dimensions: { MAP_WIDTH: context.MAP_WIDTH, STARFIELD_HEIGHT: context.STARFIELD_HEIGHT },
            entities: {
                astronaut: context.astronaut,
                buttonEntities: context.buttonEntities,
                collectableEntities: context.collectableEntities,
                creatureEntities: context.creatureEntities,
                doorEntities: context.doorEntities
            },
            rendering: {
                canvas: context.canvas,
                drawCustomPalettePreview: context.drawCustomPalettePreview,
                drawSpritePreview: context.drawSpritePreview,
                drawSpriteSample: context.drawSpriteSample,
                drawWorldBoundingBoxOverlay: context.drawWorldBoundingBoxOverlay
            },
            world: {
                ensureMapChunksAroundWorldPosition: context.ensureMapChunksAroundWorldPosition,
                ensureWorldBounds: context.ensureWorldBounds,
                afterWorldDataMutated: context.afterWorldDataMutated,
                clampCamera: context.clampCamera,
                getAstronautStartPosition: context.getAstronautStartPosition,
                getRawWorldData: context.getRawWorldData,
                getRawWorldDataForSave: context.getRawWorldDataForSave,
                getSpriteCatalog: context.getSpriteCatalog,
                getSpriteTypes: context.getSpriteTypes,
                syncRuntimeMapBounds: context.syncRuntimeMapBounds,
                updateAstronautStartPosition: context.updateAstronautStartPosition
            },
            loading: {
                loadAstronautStartPosition: context.loadAstronautStartPosition,
                loadButtons: context.loadButtons,
                loadCollectables: context.loadCollectables,
                loadCreatures: context.loadCreatures,
                loadDoors: context.loadDoors,
                loadMapBlocks: context.loadMapBlocks,
                loadPalettes: context.loadPalettes,
                loadSpriteMap: context.loadSpriteMap,
                loadTeleporters: context.loadTeleporters,
                loadWindData: context.loadWindData
            },
            persistence: {
                createWorldDesigner: context.createWorldDesigner,
                deepClone: context.deepClone,
                getSoundEnabled: context.getSoundEnabled,
                savePaletteDefinitions: context.savePaletteDefinitions,
                saveWorldData: context.saveWorldData,
                setSoundEnabled: context.setSoundEnabled,
                setWindDebugToggle: context.setWindDebugToggle,
                makeBlackTransparent: context.makeBlackTransparent,
                normalizeBulletImpactAudioSettings: context.normalizeBulletImpactAudioSettings,
                normalizeSpriteSheetColors: context.normalizeSpriteSheetColors,
                previewSpriteSheetNormalization: context.previewSpriteSheetNormalization,
                replaceRawWorldData: context.replaceRawWorldData
            },
            wind: {
                getEffectiveWindToggles: context.getEffectiveWindToggles,
                windDebugToggles: context.windDebugToggles,
                windSettings: context.windSettings
            },
            initialization: {
                calculateAstronautSpriteBoundingBoxes: context.calculateAstronautSpriteBoundingBoxes,
                calculateSpriteCollisionBoundingBoxes: context.calculateSpriteCollisionBoundingBoxes,
                initStars: context.initStars,
                performanceTracker: context.performanceTracker,
                rebuildBlockInstanceBoundingBoxes: context.rebuildBlockInstanceBoundingBoxes,
                rebuildRemappedSpriteSheets: context.rebuildRemappedSpriteSheets,
                resetAstronautToPosition: context.resetAstronautToPosition,
                requestImmediateFrame: context.requestImmediateFrame
            }
        },
        stateAccessors: {
            gameplay: buildGameplayStateAccessors(context),
            resources: buildResourceStateAccessors(context),
            world: buildWorldStateAccessors(context)
        }
    });
}
