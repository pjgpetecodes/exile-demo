import { SpriteCatalogEntry } from '../../../designer/world-designer.js';

export type GameSpriteMapEntry = {
    x: number;
    y: number;
    w: number;
    h: number;
    name?: string;
    palette?: number;
};

export type GameSpriteMap = Record<string, GameSpriteMapEntry> | GameSpriteMapEntry[][];

type CreateGameSpriteSheetRuntimeOptions = {
    getSpriteMap: () => GameSpriteMap | null | undefined;
    getRemappedSpriteSheets: () => CanvasImageSource[];
};

export function createGameSpriteSheetRuntime(options: CreateGameSpriteSheetRuntimeOptions) {
    function getSpriteRectFromMap(row: number, col: number) {
        const spriteMap = options.getSpriteMap() as GameSpriteMapEntry[][];
        return spriteMap[row][col];
    }

    function findSpriteRectByType(type: string) {
        const spriteMap = options.getSpriteMap();
        if (!spriteMap) return null;
        if (spriteMap instanceof Array) {
            for (const row of spriteMap) {
                for (const sprite of row) {
                    if (sprite.name === type) {
                        return sprite;
                    }
                }
            }
            return null;
        }
        return spriteMap[type] || null;
    }

    function getPaletteSheet(palette: number, fallbackPalette?: number) {
        const remappedSpriteSheets = options.getRemappedSpriteSheets();
        const paletteIndex = Number.isFinite(palette) && palette >= 0 && palette < remappedSpriteSheets.length
            ? palette
            : (Number.isFinite(fallbackPalette) ? fallbackPalette! : 0);
        return remappedSpriteSheets[paletteIndex] || remappedSpriteSheets[0] || null;
    }

    function getEntityPreviewSheet(entity: { palette?: number }) {
        return getPaletteSheet(typeof entity.palette === 'number' ? entity.palette : 0);
    }

    function getSpriteTypes() {
        const spriteMap = options.getSpriteMap();
        if (!spriteMap) return [];
        if (spriteMap instanceof Array) {
            return spriteMap.flat()
                .map((entry: GameSpriteMapEntry) => entry.name)
                .filter((name): name is string => typeof name === 'string' && name.length > 0);
        }
        return Object.keys(spriteMap);
    }

    function getSpriteCatalog(): SpriteCatalogEntry[] {
        const spriteMap = options.getSpriteMap();
        if (!spriteMap) return [];
        if (spriteMap instanceof Array) {
            return spriteMap.flat()
                .filter((entry: GameSpriteMapEntry) => entry?.name)
                .map((entry: GameSpriteMapEntry) => ({
                    name: entry.name!,
                    palette: typeof entry.palette === 'number' ? entry.palette : 0
                }));
        }
        return Object.entries(spriteMap).map(([name, entry]) => ({
            name,
            palette: typeof entry?.palette === 'number' ? entry.palette : 0
        }));
    }

    return {
        getSpriteRectFromMap,
        findSpriteRectByType,
        getPaletteSheet,
        getEntityPreviewSheet,
        getSpriteTypes,
        getSpriteCatalog
    };
}
