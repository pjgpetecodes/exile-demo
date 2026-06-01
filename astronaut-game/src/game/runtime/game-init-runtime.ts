export interface GameInitRuntimeContext {
    [key: string]: any;
}

export async function runGameInitRuntime(context: GameInitRuntimeContext) {
    (window as any).__initCtxDiagnostics = {
        hasSetSpriteSheetFunction: typeof (context as any).setSpriteSheet === 'function',
        hasSetSpriteMapFunction: typeof (context as any).setSpriteMap === 'function',
        spriteSheetDescriptorHasSetter: !!Object.getOwnPropertyDescriptor(context, 'spriteSheet')?.set,
        spriteMapDescriptorHasSetter: !!Object.getOwnPropertyDescriptor(context, 'spriteMap')?.set
    };
    const {
        MAP_HEIGHT,
        MAP_WIDTH,
        STARFIELD_HEIGHT,
        astronaut,
        buttonEntities,
        calculateAstronautSpriteBoundingBoxes,
        calculateSpriteCollisionBoundingBoxes,
        collectableEntities,
        colorAliases,
        createWorldDesigner,
        creatureEntities,
        deepClone,
        doorEntities,
        drawWorldBoundingBoxOverlay,
        drawCustomPalettePreview,
        drawSpritePreview,
        drawSpriteSample,
        ensureMapChunksAroundWorldPosition,
        ensureWorldBounds,
        afterWorldDataMutated,
        canvas,
        clampCamera,
        getAstronautStartPosition,
        getEffectiveWindToggles,
        getPaletteDefinitions,
        getRawWorldData,
        getRawWorldDataForSave,
        getSoundEnabled,
        getSpriteCatalog,
        getSpriteTypes,
        initStars,
        loadAstronautStartPosition,
        loadButtons,
        loadCollectables,
        loadCreatures,
        loadDoors,
        loadMapBlocks,
        loadPalettes,
        loadSpriteMap,
        loadTeleporters,
        loadWindData,
        makeBlackTransparent,
        mapBlocks,
        normalizeBulletImpactAudioSettings,
        palettes,
        performanceTracker,
        previewSpriteSheetNormalization,
        rebuildBlockInstanceBoundingBoxes,
        rebuildRemappedSpriteSheets,
        replaceRawWorldData,
        resetAstronautToPosition,
        requestImmediateFrame,
        savePaletteDefinitions,
        saveWorldData,
        setSoundEnabled,
        setWindDebugToggle,
        syncRuntimeMapBounds,
        updateAstronautStartPosition,
        windDebugToggles,
        windSettings,
        normalizeSpriteSheetColors
    } = context;


    const loadedSpriteMap = await loadSpriteMap();
    if (loadedSpriteMap !== undefined) {
        context.spriteMap = loadedSpriteMap;
    }
    await loadPalettes();
    await loadMapBlocks();
    await loadDoors();
    await loadButtons();
    await loadCreatures();
    await loadCollectables();
    await loadTeleporters();
    await loadWindData();
    await loadAstronautStartPosition();
    await ensureMapChunksAroundWorldPosition(getAstronautStartPosition(), 1, true);
    initStars(MAP_WIDTH, STARFIELD_HEIGHT);
    const img = new Image();
    img.onload = () => {
        makeBlackTransparent(img, async (canvasWithTransparency: any) => {
            const loadedSpriteSheet = new Image();
            loadedSpriteSheet.onload = async () => {
                context.spriteSheet = loadedSpriteSheet;
                // Make context.spriteSheet globally accessible for pixel-perfect collision
                (window as any).spriteSheet = context.spriteSheet;
                // Also create and store a 2D context for pixel access
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = context.spriteSheet.width;
                tempCanvas.height = context.spriteSheet.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx!.drawImage(context.spriteSheet, 0, 0);
                (window as any)._spriteSheetCtx = tempCtx;
                rebuildRemappedSpriteSheets();

                // --- Calculate tightest collision bounding boxes at startup ---
                if (!context.spriteMap) {
                    throw new Error('Sprite map was not available after loadSpriteMap()');
                }
                const boundingBoxes = await calculateSpriteCollisionBoundingBoxes(
                    context.spriteSheet,
                    context.spriteMap,
                    context.mapBlocks,
                    doorEntities,
                    buttonEntities,
                    creatureEntities,
                    collectableEntities
                );
                context.worldMapBoundingBoxes = boundingBoxes;

                // --- Calculate rotated bounding boxes for each type and rotation ---
                context.worldMapRotatedBoundingBoxes = {};
                const getSpriteRectForType = (type: string) => {
                    if (context.spriteMap instanceof Array) {
                        for (const row of context.spriteMap) {
                            for (const sprite of row) {
                                if (sprite.name === type) {
                                    return sprite;
                                }
                            }
                        }
                        return null;
                    }
                    return context.spriteMap[type] || null;
                };
                for (const [type, bbox] of Object.entries(context.worldMapBoundingBoxes as Record<string, any>)) {
                    const spriteRect = getSpriteRectForType(type);
                    if (!spriteRect) {
                        continue;
                    }
                    context.worldMapRotatedBoundingBoxes[type] = {};
                    for (let rot = 0; rot <= 7; rot++) {
                        // Corners relative to (0,0)
                        let corners = [
                            { x: bbox.minX, y: bbox.minY },
                            { x: bbox.maxX, y: bbox.minY },
                            { x: bbox.maxX, y: bbox.maxY },
                            { x: bbox.minX, y: bbox.maxY }
                        ];
                        // Match draw-time transforms by rotating/flipping around the full sprite center.
                        const cx = (spriteRect.w - 1) / 2;
                        const cy = (spriteRect.h - 1) / 2;
                        let rotated: { x: number, y: number }[];
                        if (rot >= 1 && rot <= 4) {
                            const angle = (rot - 1) * (Math.PI / 2);
                            rotated = corners.map(pt => {
                                const dx = pt.x - cx;
                                const dy = pt.y - cy;
                                return {
                                    x: Math.round(cx + dx * Math.cos(angle) - dy * Math.sin(angle)),
                                    y: Math.round(cy + dx * Math.sin(angle) + dy * Math.cos(angle))
                                };
                            });
                        } else if (rot === 5) {
                            // flip X
                            rotated = corners.map(pt => ({ x: Math.round(2 * cx - pt.x), y: pt.y }));
                        } else if (rot === 6) {
                            // flip Y
                            rotated = corners.map(pt => ({ x: pt.x, y: Math.round(2 * cy - pt.y) }));
                        } else if (rot === 7) {
                            // flip X and Y
                            rotated = corners.map(pt => ({ x: Math.round(2 * cx - pt.x), y: Math.round(2 * cy - pt.y) }));
                        } else {
                            // rot == 0, no rotation
                            rotated = corners;
                        }
                        const xs = rotated.map(pt => pt.x);
                        const ys = rotated.map(pt => pt.y);
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minY = Math.min(...ys);
                        const maxY = Math.max(...ys);
                        context.worldMapRotatedBoundingBoxes[type][rot] = {
                            minX,
                            minY,
                            maxX,
                            maxY,
                            width: maxX - minX + 1,
                            height: maxY - minY + 1
                        };
                    }
                }

                rebuildBlockInstanceBoundingBoxes();
                syncRuntimeMapBounds();

                // --- Calculate astronaut sprite bounding boxes at startup ---
                context.astronautBoundingBoxes = await calculateAstronautSpriteBoundingBoxes(
                    context.spriteSheet,
                    context.spriteMap
                );
                context.worldDesigner = createWorldDesigner({
                    canvas,
                    getRawWorldData,
                    getRawWorldDataForSave,
                    replaceRawWorldData,
                    afterWorldDataMutated,
                    getFocusWorldPosition: () => ({
                        x: astronaut.position.x,
                        y: astronaut.position.y
                    }),
                    resetAstronautToPosition,
                    setAstronautStartPosition: updateAstronautStartPosition,
                    getSoundEnabled,
                    setSoundEnabled,
                    getShowSpriteOutlines: () => context.showWorldBoundingBoxes,
                    setShowSpriteOutlines: (value: boolean) => {
                        context.showWorldBoundingBoxes = value;
                    },
                    getShowCreatureOverlays: () => context.showCreatureOverlays,
                    setShowCreatureOverlays: (value: boolean) => {
                        context.showCreatureOverlays = value;
                    },
                    getPerformanceHudEnabled: () => performanceTracker.getHudEnabled(),
                    setPerformanceHudEnabled: (enabled: boolean) => {
                        performanceTracker.setHudEnabled(enabled);
                        requestImmediateFrame();
                    },
                    getBulletImpactAudioSettings: () => ({ ...context.bulletImpactAudioSettings }),
                    setBulletImpactAudioSettings: (value: any) => {
                        context.bulletImpactAudioSettings = normalizeBulletImpactAudioSettings(value);
                    },
                    getWindRuntimeToggles: () => ({ ...getEffectiveWindToggles(windSettings, windDebugToggles) }),
                    setWindRuntimeToggle: (
                        key: 'windEnabled' | 'emittersEnabled' | 'surfaceWindEnabled' | 'windVfxEnabled',
                        enabled: boolean
                    ) => {
                        setWindDebugToggle(windDebugToggles, key, enabled);
                        context.cachedWindEmittersFrameKey = -1;
                        requestImmediateFrame();
                    },
                    drawSpriteOutlineOverlay: drawWorldBoundingBoxOverlay,
                    getSpriteTypes,
                    getSpriteCatalog,
                    drawSpritePreview,
                    drawSpriteSample,
                    drawCustomPalettePreview,
                    getPaletteDefinitions: () => deepClone(context.rawPaletteDefinitions),
                    getColorAliases: () => deepClone(context.colorAliases),
                    getPaletteCount: () => Math.max(context.remappedSpriteSheets.length, context.palettes.length, 1),
                    getMapBounds: () => ({ width: MAP_WIDTH, height: MAP_HEIGHT }),
                    clampCamera,
                    ensureWorldBounds,
                    saveWorldData,
                    savePaletteDefinitions,
                    previewSpriteSheetNormalization,
                    normalizeSpriteSheetColors
                });
                requestImmediateFrame();
            };
            loadedSpriteSheet.src = canvasWithTransparency.toDataURL();
        });
    };
    img.src = './src/assets/images/sprites/sprite_sheet.png';
    img.onerror = () => {
        alert('Sprite sheet not found at ./src/assets/images/sprites/exile_sprites.png');
    };
}
