import type { Button } from '../../entities/button.js';
import type { WorldDesigner } from '../../designer/world-designer.js';
import type { ChunkActivityTuningUpdate } from '../chunk-activity/chunk-activity-tuning.js';

type GameMainWindowRuntimeOptions = {
    isDesignerOpen: () => boolean;
    getPrevKeys: () => Record<string, boolean>;
    getShowBlackBackgroundBlocks: () => boolean;
    setShowBlackBackgroundBlocks: (value: boolean) => void;
    getHideBlackBackgroundBlocks: () => boolean;
    setHideBlackBackgroundBlocks: (value: boolean) => void;
    getButtons: () => Button[];
    getWorldDesigner: () => WorldDesigner | null;
    getChunkActivityTuningSnapshot: () => any;
    applyChunkActivityTuning: (update: ChunkActivityTuningUpdate) => void;
    resetChunkActivityTuning: () => void;
    toggleSoundEnabled: () => void;
    forceRebuildSpriteSheets: () => {
        ok: boolean;
        count: number;
        error?: string;
    };
    getRuntimeSnapshot: () => {
        spriteSheetSetCount: number;
        lastSetSpriteSheetWidth: number;
        lastSetSpriteSheetDefined: boolean;
        missingMapSpriteTypes: string[];
        sampleMapTypes: string[];
        mapBlocksCount: number;
        chunkedWorldMapEnabled: boolean;
        mapLoaded: boolean;
        spriteMapLoaded: boolean;
        runtimeSpriteSheetLoaded: boolean;
        runtimeSpriteSheetComplete: boolean;
        spriteTypeCount: number;
        rawPaletteDefinitionCount: number;
        paletteCount: number;
        remappedSpriteSheetCount: number;
        worldDesignerExists: boolean;
        worldDesignerActive: boolean;
        mapWidth: number;
        mapHeight: number;
        astronautPosition: { x: number; y: number };
        astronautVelocity: { x: number; y: number };
        astronautIsLanded: boolean;
        walkAnimFrame: number;
        walkAnimTimer: number;
        designerCamera: { x: number; y: number } | null;
        teleporting: boolean;
        teleportPhase: 'none' | 'out' | 'in';
        teleportAnimFrame: number;
        teleportTarget: { x: number; y: number } | null;
        astronautStartPosition: { x: number; y: number };
    };
};

export function attachBlackBackgroundWindowShortcuts(options: GameMainWindowRuntimeOptions) {
    window.addEventListener('keydown', (event) => {
        if (options.isDesignerOpen()) {
            return;
        }
        const prevKeys = options.getPrevKeys();
        if (event.key === 'c' && !prevKeys.c) {
            options.setShowBlackBackgroundBlocks(!options.getShowBlackBackgroundBlocks());
        }
        if (event.key === 'v' && !prevKeys.v) {
            options.setHideBlackBackgroundBlocks(!options.getHideBlackBackgroundBlocks());
        }
    });
}

export function attachGlobalWindowShortcuts(options: GameMainWindowRuntimeOptions) {
    window.addEventListener('keydown', (event) => {
        if (event.altKey && event.key === 'Enter' && !event.repeat) {
            event.preventDefault();
            const worldDesigner = options.getWorldDesigner();
            if (worldDesigner) {
                worldDesigner.setViewportExpanded(!worldDesigner.isViewportExpanded());
            }
        }
        if (event.ctrlKey && event.key.toLowerCase() === 'm' && !event.repeat) {
            event.preventDefault();
            options.toggleSoundEnabled();
        }
    });
}

export function exposeGameMainDebugRuntime(options: GameMainWindowRuntimeOptions) {
    (window as any).__exileDebug = {
        getButtons: () => options.getButtons(),
        getSelectedDesignerSelection: () => options.getWorldDesigner()?.getDebugSelection() ?? null,
        getSelectedDesignerButton: () => {
            const selection = options.getWorldDesigner()?.getDebugSelection() ?? null;
            return selection?.category === 'buttons' ? selection.entity : null;
        },
        chunkActivity: {
            getTuning: () => options.getChunkActivityTuningSnapshot(),
            setTuning: (update: ChunkActivityTuningUpdate) => {
                options.applyChunkActivityTuning(update ?? {});
                return options.getChunkActivityTuningSnapshot();
            },
            resetTuning: () => {
                options.resetChunkActivityTuning();
                return options.getChunkActivityTuningSnapshot();
            }
        },
        forceRebuildSpriteSheets: () => options.forceRebuildSpriteSheets(),
        getRuntimeSnapshot: () => options.getRuntimeSnapshot()
    };
}
