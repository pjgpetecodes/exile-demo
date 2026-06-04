import { SPRITE_SCALE } from '../../config/constants.js';
import {
    getPngImportSourceTileCount as getPngImportSourceTileCountBase,
    getPngImportWorldSpanFromTileCount as getPngImportWorldSpanFromTileCountBase
} from '../core/world-designer-helpers.js';

import type { DesignerCategory } from '../core/world-designer-types.js';

export const HISTORY_LIMIT = 100;
export const TILE_SIZE = 32 * SPRITE_SCALE;
export const DESIGNER_STATE_STORAGE_KEY = 'exile.world-designer-state.v1';
export const PNG_IMPORT_DEFAULT_URL = './src/assets/images/maps/MAP-Exile-BC.png';
export const PNG_IMPORT_SOURCE_TILE_SIZE = 32;
export const PNG_CHUNK_EXPORT_MANIFEST_NAME = 'png-import-chunks.manifest.json';
export const PNG_CHUNK_DEFAULT_TILE_WIDTH = 16;
export const PNG_CHUNK_DEFAULT_TILE_HEIGHT = 16;
export const PNG_IMPORT_PREVIEW_MAX_TILE_SIZE = 48;
export const MAGNIFIER_SIZE = 160;
export const MAGNIFIER_ZOOM = 6;
export const MAGNIFIER_CURSOR_OFFSET = 26;
export const BUTTON_DEFAULT_PRESS_OFFSET = 3;
export const BUTTON_DEFAULT_BOX_OFFSET_X = 12;
export const BUTTON_DEFAULT_BOX_OFFSET_Y = 0;
export const TELEPORTER_COMPOSITE_TYPE = '__teleporter_composite__';
export const BUTTON_COMPOSITE_TYPE = '__button_composite__';

export const CATEGORY_LABELS: Record<DesignerCategory, string> = {
    world: 'World items',
    buttons: 'Buttons',
    doors: 'Doors',
    creatures: 'Creatures',
    collectables: 'Collectables',
    custom: 'Custom sprites'
};

export function getPngImportSourceTileCount(size: number) {
    return getPngImportSourceTileCountBase(size, PNG_IMPORT_SOURCE_TILE_SIZE);
}

export function getSuggestedPngImportWorldSpan(sourceSize: number) {
    return Math.max(1, Math.round(getPngImportSourceTileCount(sourceSize) * TILE_SIZE));
}

export function getPngImportWorldSpanFromTileCount(tileCount: number) {
    return getPngImportWorldSpanFromTileCountBase(tileCount, TILE_SIZE);
}
