import type { PaletteDefinition } from '../../designer/world-designer.js';

type PaletteRuntimeOptions = {
    fetchFreshJson: <T>(url: string) => Promise<T>;
    deepClone: <T>(value: T) => T;
    mapPaletteDefinitions: (
        definitions: PaletteDefinition[],
        aliases: Record<string, [number, number, number]>
    ) => Array<Array<{ from: [number, number, number]; to: [number, number, number] }>>;
    resolveColorAlias: (color: string | [number, number, number], aliases: Record<string, [number, number, number]>) => [number, number, number];
    remapSpritePalette: (
        sheet: HTMLImageElement,
        palette: Array<{ from: [number, number, number]; to: [number, number, number] }>
    ) => HTMLCanvasElement;
    clearMapSpriteCache: () => void;
    clearPalettePreviewCache: () => void;
    getColorAliases: () => Record<string, [number, number, number]>;
    setColorAliases: (value: Record<string, [number, number, number]>) => void;
    getRawPaletteDefinitions: () => PaletteDefinition[];
    setRawPaletteDefinitions: (value: PaletteDefinition[]) => void;
    getPalettes: () => Array<Array<{ from: [number, number, number]; to: [number, number, number] }>>;
    setPalettes: (value: Array<Array<{ from: [number, number, number]; to: [number, number, number] }>>) => void;
    getSpriteSheet: () => HTMLImageElement | undefined;
    getRemappedSpriteSheets: () => CanvasImageSource[];
    setRemappedSpriteSheets: (value: CanvasImageSource[]) => void;
    setAstronautSpriteSource: (value: CanvasImageSource) => void;
};

export function createGameMainPaletteRuntime(options: PaletteRuntimeOptions) {
    async function loadColorAliases() {
        if (Object.keys(options.getColorAliases()).length > 0) {
            return;
        }
        const aliases = await options.fetchFreshJson<Record<string, [number, number, number]>>('./src/assets/data/colors.json');
        options.setColorAliases(aliases);
    }

    function resolveColor(color: string | [number, number, number]): [number, number, number] {
        return options.resolveColorAlias(color, options.getColorAliases());
    }

    async function loadPalettes() {
        await loadColorAliases();
        const rawPaletteDefinitions = await options.fetchFreshJson<PaletteDefinition[]>('./src/assets/data/palettes.json');
        options.setRawPaletteDefinitions(rawPaletteDefinitions);
        options.setPalettes(options.mapPaletteDefinitions(rawPaletteDefinitions, options.getColorAliases()));
    }

    function rebuildRemappedSpriteSheets() {
        const spriteSheet = options.getSpriteSheet();
        if (!spriteSheet) {
            return;
        }

        options.clearPalettePreviewCache();
        options.clearMapSpriteCache();
        const remappedSpriteSheets = options.getPalettes().map((palette) => options.remapSpritePalette(spriteSheet, palette));
        options.setRemappedSpriteSheets(remappedSpriteSheets);
        options.setAstronautSpriteSource(remappedSpriteSheets[1] || remappedSpriteSheets[0] || spriteSheet);
    }

    function applyPaletteDefinitions(definitions: PaletteDefinition[]) {
        const clonedDefinitions = options.deepClone(definitions);
        options.setRawPaletteDefinitions(clonedDefinitions);
        options.setPalettes(options.mapPaletteDefinitions(clonedDefinitions, options.getColorAliases()));
        rebuildRemappedSpriteSheets();
    }

    return {
        loadColorAliases,
        resolveColor,
        loadPalettes,
        rebuildRemappedSpriteSheets,
        applyPaletteDefinitions
    };
}
