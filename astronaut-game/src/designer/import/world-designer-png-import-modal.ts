import { MapBlock } from '../../world/map.js';
import type { SpriteTranslation } from '../../shared/utilities.js';
import type { WorldDesignerPngImportDraftApi } from './world-designer-png-import-draft.js';

import type {
    BrowserDirectoryHandle,
    ControlRefs,
    PngChunkComposedSource,
    PngChunkFolderSelection,
    PngChunkSelectionRange,
    PngImportDraft,
    PngImportProgress,
    RawWorldData,
    PngImportSourceMode,
    PngImportWorkTab,
    WorldDesignerHost
} from '../core/world-designer-types.js';

const PNG_IMPORT_MODAL_TEMPLATE_URL = './src/designer/io/world-designer-png-import-modal.html';
let pngImportModalTemplateCache: string | null = null;

type OpenWorldDesignerPngImportModalOptions = {
    refs: ControlRefs;
    host: WorldDesignerHost;
    paletteCount: number;
    PNG_IMPORT_DEFAULT_URL: string;
    PNG_IMPORT_SOURCE_TILE_SIZE: number;
    PNG_CHUNK_EXPORT_MANIFEST_NAME: string;
    PNG_CHUNK_DEFAULT_TILE_WIDTH: number;
    PNG_CHUNK_DEFAULT_TILE_HEIGHT: number;
    PNG_IMPORT_PREVIEW_MAX_TILE_SIZE: number;
    SPRITE_TRANSLATION_OPTIONS: readonly SpriteTranslation[];
    formatSpriteTranslation: (translation?: SpriteTranslation) => string;
    getDefaultImportWorldRect: () => { x: number; y: number; width: number; height: number };
    getPngImportTypeNames: (snapshot: RawWorldData) => string[];
    getPngImportTypeDefaults: (snapshot: RawWorldData) => Map<string, { collision: boolean; maskAstronaut: boolean }>;
    clearPngImportObjectUrl: () => void;
    setPngImportObjectUrl: (value: string | null) => void;
    setStatus: (message: string, tone?: 'neutral' | 'success' | 'error') => void;
    clamp: (value: number, min: number, max: number) => number;
    getPngChunkSelectionEntries: (selection: PngChunkFolderSelection, range: {
        minChunkColumn: number;
        maxChunkColumn: number;
        minChunkRow: number;
        maxChunkRow: number;
        maxChunks: number;
    }) => { selectedChunks: unknown[]; totalSelectedChunks: number };
    getPngImportWorldSpanFromTileCount: (tileCount: number) => number;
    composePngChunkFolderSource: (
        selection: PngChunkFolderSelection,
        range: {
            minChunkColumn: number;
            maxChunkColumn: number;
            minChunkRow: number;
            maxChunkRow: number;
            maxChunks: number;
        },
        onProgress?: (progress: PngImportProgress) => void | Promise<void>
    ) => Promise<PngChunkComposedSource>;
    pngImportDraftApi: WorldDesignerPngImportDraftApi;
    normalizeRotation: (value: number | undefined) => number;
    normalizeSpriteTranslation: (value: string | undefined) => SpriteTranslation;
    renderSpritePreviewCanvas: (
        canvas: HTMLCanvasElement,
        type: string,
        palette: number,
        rotation: number,
        translation: SpriteTranslation
    ) => void;
    clearPreviewCanvas: (canvas: HTMLCanvasElement) => void;
    getPngImportSourceTileCount: (size: number) => number;
    getSuggestedPngImportWorldSpan: (sourceSize: number) => number;
    getDirectoryPicker: () => () => Promise<BrowserDirectoryHandle>;
    readPngChunkFolderSelection: (
        directoryHandle: BrowserDirectoryHandle,
        onProgress?: (progress: PngImportProgress) => void | Promise<void>
    ) => Promise<PngChunkFolderSelection>;
    exportPngChunksToDirectory: (
        config: {
            image: HTMLImageElement;
            sourceName: string;
            sourceX: number;
            sourceY: number;
            sourceWidth: number;
            sourceHeight: number;
            chunkTileWidth: number;
            chunkTileHeight: number;
            skipEmpty: boolean;
            shouldCancel?: () => boolean;
        },
        onProgress?: (progress: PngImportProgress) => void | Promise<void>
    ) => Promise<{ exportedChunks: number; skippedChunks: number; directoryName: string }>;
    toMapBlockData: (block: MapBlock) => MapBlock;
    applyPngImportDraft: (draft: PngImportDraft, replaceExisting: boolean, clearAllExisting?: boolean) => void;
    closeModal: (force?: boolean) => void;
    setModalConfirmAction: (action: (() => void | Promise<void>) | null) => void;
};

async function loadPngImportModalTemplate() {
    if (pngImportModalTemplateCache) {
        return pngImportModalTemplateCache;
    }
    const response = await fetch(`${PNG_IMPORT_MODAL_TEMPLATE_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load designer modal template: ${response.status} ${response.statusText}`);
    }
    pngImportModalTemplateCache = await response.text();
    return pngImportModalTemplateCache;
}

function renderPngImportModalTemplate(
    template: string,
    values: Record<string, string | number>
) {
    let rendered = template;
    for (const [token, value] of Object.entries(values)) {
        rendered = rendered.split(token).join(String(value));
    }
    return rendered;
}

export async function openWorldDesignerPngImportModal(options: OpenWorldDesignerPngImportModalOptions) {
    const {
        refs,
        host,
        paletteCount,
        PNG_IMPORT_DEFAULT_URL,
        PNG_IMPORT_SOURCE_TILE_SIZE,
        PNG_CHUNK_EXPORT_MANIFEST_NAME,
        PNG_CHUNK_DEFAULT_TILE_WIDTH,
        PNG_CHUNK_DEFAULT_TILE_HEIGHT,
        PNG_IMPORT_PREVIEW_MAX_TILE_SIZE,
        SPRITE_TRANSLATION_OPTIONS,
        formatSpriteTranslation,
        getDefaultImportWorldRect,
        getPngImportTypeNames,
        getPngImportTypeDefaults,
        clearPngImportObjectUrl,
        setPngImportObjectUrl,
        setStatus,
        clamp,
        getPngChunkSelectionEntries,
        getPngImportWorldSpanFromTileCount,
        composePngChunkFolderSource,
        pngImportDraftApi,
        normalizeRotation,
        normalizeSpriteTranslation,
        renderSpritePreviewCanvas,
        clearPreviewCanvas,
        getPngImportSourceTileCount,
        getSuggestedPngImportWorldSpan,
        getDirectoryPicker,
        readPngChunkFolderSelection,
        exportPngChunksToDirectory,
        toMapBlockData,
        applyPngImportDraft,
        closeModal,
        setModalConfirmAction
    } = options;
    const {
        buildPngImportDraftFromImage,
        buildPngImportDraftFromPng,
        getPngImportPreviewTileSize,
        loadImage
    } = pngImportDraftApi;

    const modalCard = refs.modal.querySelector('.world-designer-modal-card') as HTMLDivElement | null;
    modalCard?.classList.add('world-designer-modal-card-import');
    const defaultWorldRect = getDefaultImportWorldRect();
    const importSnapshot = host.getRawWorldData();
    const pngImportTypeNames = getPngImportTypeNames(importSnapshot);
    const pngImportTypeDefaults = getPngImportTypeDefaults(importSnapshot);
    const rotationOptionMarkup = Array.from({ length: 9 }, (_, index) => {
        const rotation = index + 1;
        return `<option value="${rotation}">${rotation}</option>`;
    }).join('');
    const translationOptionMarkup = SPRITE_TRANSLATION_OPTIONS
        .map((translation) => `<option value="${translation}">${formatSpriteTranslation(translation)}</option>`)
        .join('');
    refs.modalTitle.textContent = 'Import PNG draft';
    refs.modalConfirm.textContent = 'Import draft';
    refs.modalConfirm.disabled = true;
    clearPngImportObjectUrl();
    try {
        const modalTemplate = await loadPngImportModalTemplate();
        refs.modalBody.innerHTML = renderPngImportModalTemplate(modalTemplate, {
            '__PNG_IMPORT_DEFAULT_URL__': PNG_IMPORT_DEFAULT_URL,
            '__WORLD_X__': defaultWorldRect.x,
            '__WORLD_Y__': defaultWorldRect.y,
            '__WORLD_WIDTH__': defaultWorldRect.width,
            '__WORLD_HEIGHT__': defaultWorldRect.height,
            '__ROTATION_OPTIONS__': rotationOptionMarkup,
            '__TRANSLATION_OPTIONS__': translationOptionMarkup
        });
    } catch (error) {
        refs.modalBody.innerHTML = '';
        setStatus(
            error instanceof Error ? error.message : 'Failed to load PNG import template.',
            'error'
        );
        return;
    }
    refs.modal.classList.add('open');

    const singleModeButton = refs.modalBody.querySelector('[data-role="png-import-mode-single"]') as HTMLButtonElement;
    const folderModeButton = refs.modalBody.querySelector('[data-role="png-import-mode-folder"]') as HTMLButtonElement;
    const importTabButton = refs.modalBody.querySelector('[data-role="png-import-tab-import"]') as HTMLButtonElement;
    const exportTabButton = refs.modalBody.querySelector('[data-role="png-import-tab-export"]') as HTMLButtonElement;
    const tabSummary = refs.modalBody.querySelector('[data-role="png-import-tab-summary"]') as HTMLDivElement;
    const singleSourceCard = refs.modalBody.querySelector('[data-role="png-import-single-source"]') as HTMLDivElement;
    const folderSourceCard = refs.modalBody.querySelector('[data-role="png-import-folder-source"]') as HTMLDivElement;
    const sourceCropCard = refs.modalBody.querySelector('[data-role="png-import-source-crop"]') as HTMLDivElement;
    const exportCard = refs.modalBody.querySelector('[data-role="png-import-export-card"]') as HTMLDivElement;
    const progressCard = refs.modalBody.querySelector('[data-role="png-import-progress-card"]') as HTMLDivElement;
    const progressTitle = refs.modalBody.querySelector('[data-role="png-import-progress-title"]') as HTMLHeadingElement;
    const progressCancelButton = refs.modalBody.querySelector('[data-role="png-import-progress-cancel"]') as HTMLButtonElement;
    const worldCard = refs.modalBody.querySelector('[data-role="png-import-world-card"]') as HTMLDivElement;
    const actionCard = refs.modalBody.querySelector('[data-role="png-import-action-card"]') as HTMLDivElement;
    const importMain = refs.modalBody.querySelector('[data-role="png-import-main"]') as HTMLDivElement;
    const previewCard = refs.modalBody.querySelector('[data-role="png-import-preview-card"]') as HTMLDivElement;
    const editorCard = refs.modalBody.querySelector('[data-role="png-import-editor-card"]') as HTMLDivElement;
    const urlInput = refs.modalBody.querySelector('[data-role="png-import-url"]') as HTMLInputElement;
    const browseButton = refs.modalBody.querySelector('[data-role="png-import-browse"]') as HTMLButtonElement;
    const fileInput = refs.modalBody.querySelector('[data-role="png-import-file"]') as HTMLInputElement;
    const folderBrowseButton = refs.modalBody.querySelector('[data-role="png-import-folder-browse"]') as HTMLButtonElement;
    const folderNameInput = refs.modalBody.querySelector('[data-role="png-import-folder-name"]') as HTMLInputElement;
    const folderMinColumnInput = refs.modalBody.querySelector('[data-role="png-import-folder-min-column"]') as HTMLInputElement;
    const folderMaxColumnInput = refs.modalBody.querySelector('[data-role="png-import-folder-max-column"]') as HTMLInputElement;
    const folderMinRowInput = refs.modalBody.querySelector('[data-role="png-import-folder-min-row"]') as HTMLInputElement;
    const folderMaxRowInput = refs.modalBody.querySelector('[data-role="png-import-folder-max-row"]') as HTMLInputElement;
    const folderMaxChunksInput = refs.modalBody.querySelector('[data-role="png-import-folder-max-chunks"]') as HTMLInputElement;
    const folderFitTargetCheckbox = refs.modalBody.querySelector('[data-role="png-import-folder-fit-target"]') as HTMLInputElement;
    const folderMeta = refs.modalBody.querySelector('[data-role="png-import-folder-meta"]') as HTMLDivElement;
    const sourceXInput = refs.modalBody.querySelector('[data-role="png-import-source-x"]') as HTMLInputElement;
    const sourceYInput = refs.modalBody.querySelector('[data-role="png-import-source-y"]') as HTMLInputElement;
    const sourceWidthInput = refs.modalBody.querySelector('[data-role="png-import-source-width"]') as HTMLInputElement;
    const sourceHeightInput = refs.modalBody.querySelector('[data-role="png-import-source-height"]') as HTMLInputElement;
    const exportPresetSelect = refs.modalBody.querySelector('[data-role="png-import-export-preset"]') as HTMLSelectElement;
    const exportWidthInput = refs.modalBody.querySelector('[data-role="png-import-export-width"]') as HTMLInputElement;
    const exportHeightInput = refs.modalBody.querySelector('[data-role="png-import-export-height"]') as HTMLInputElement;
    const exportSkipEmptyCheckbox = refs.modalBody.querySelector('[data-role="png-import-export-skip-empty"]') as HTMLInputElement;
    const exportButton = refs.modalBody.querySelector('[data-role="png-import-export"]') as HTMLButtonElement;
    const exportMeta = refs.modalBody.querySelector('[data-role="png-import-export-meta"]') as HTMLDivElement;
    const worldXInput = refs.modalBody.querySelector('[data-role="png-import-world-x"]') as HTMLInputElement;
    const worldYInput = refs.modalBody.querySelector('[data-role="png-import-world-y"]') as HTMLInputElement;
    const worldWidthInput = refs.modalBody.querySelector('[data-role="png-import-world-width"]') as HTMLInputElement;
    const worldHeightInput = refs.modalBody.querySelector('[data-role="png-import-world-height"]') as HTMLInputElement;
    const worldMeta = refs.modalBody.querySelector('[data-role="png-import-world-meta"]') as HTMLDivElement;
    const replaceCheckbox = refs.modalBody.querySelector('[data-role="png-import-replace"]') as HTMLInputElement;
    const clearAllCheckbox = refs.modalBody.querySelector('[data-role="png-import-clear-all"]') as HTMLInputElement;
    const snapButton = refs.modalBody.querySelector('[data-role="png-import-snap"]') as HTMLButtonElement;
    const previewButton = refs.modalBody.querySelector('[data-role="png-import-preview"]') as HTMLButtonElement;
    const directFolderImportButton = refs.modalBody.querySelector('[data-role="png-import-direct-folder"]') as HTMLButtonElement;
    const meta = refs.modalBody.querySelector('[data-role="png-import-meta"]') as HTMLDivElement;
    const progressBar = refs.modalBody.querySelector('[data-role="png-import-progress-bar"]') as HTMLProgressElement;
    const progressLabel = refs.modalBody.querySelector('[data-role="png-import-progress-label"]') as HTMLDivElement;
    const progressDetail = refs.modalBody.querySelector('[data-role="png-import-progress-detail"]') as HTMLDivElement;
    const previewFrame = refs.modalBody.querySelector('[data-role="png-import-preview-frame"]') as HTMLDivElement;
    const previewCanvas = refs.modalBody.querySelector('[data-role="png-import-preview-canvas"]') as HTMLCanvasElement;
    const previewMeta = refs.modalBody.querySelector('[data-role="png-import-preview-meta"]') as HTMLDivElement;
    const zoomOutButton = refs.modalBody.querySelector('[data-role="png-import-zoom-out"]') as HTMLButtonElement;
    const zoomFitButton = refs.modalBody.querySelector('[data-role="png-import-zoom-fit"]') as HTMLButtonElement;
    const zoomResetButton = refs.modalBody.querySelector('[data-role="png-import-zoom-reset"]') as HTMLButtonElement;
    const zoomInButton = refs.modalBody.querySelector('[data-role="png-import-zoom-in"]') as HTMLButtonElement;
    const zoomLabel = refs.modalBody.querySelector('[data-role="png-import-zoom-label"]') as HTMLSpanElement;
    const selectedTileInput = refs.modalBody.querySelector('[data-role="png-import-selected-tile"]') as HTMLInputElement;
    const selectedTypePreviewCanvas = refs.modalBody.querySelector('[data-role="png-import-selected-type-preview"]') as HTMLCanvasElement;
    const selectedTypeMeta = refs.modalBody.querySelector('[data-role="png-import-selected-type-meta"]') as HTMLDivElement;
    const selectedTypePicker = refs.modalBody.querySelector('[data-role="png-import-type-picker"]') as HTMLDetailsElement;
    const selectedTypeFilterInput = refs.modalBody.querySelector('[data-role="png-import-type-filter"]') as HTMLInputElement;
    const selectedTypeGrid = refs.modalBody.querySelector('[data-role="png-import-type-grid"]') as HTMLDivElement;
    const selectedPaletteInput = refs.modalBody.querySelector('[data-role="png-import-selected-palette"]') as HTMLInputElement;
    const selectedRotationSelect = refs.modalBody.querySelector('[data-role="png-import-selected-rotation"]') as HTMLSelectElement;
    const selectedTranslationSelect = refs.modalBody.querySelector('[data-role="png-import-selected-translation"]') as HTMLSelectElement;
    const resetTileButton = refs.modalBody.querySelector('[data-role="png-import-reset-tile"]') as HTMLButtonElement;
    let resolvedPngUrl = urlInput.value.trim();
    let resolvedPngLabel = resolvedPngUrl;
    let loadedImage: HTMLImageElement | null = null;
    let importMode: PngImportSourceMode = 'single';
    let workTab: PngImportWorkTab = 'import';
    let progressMode: 'none' | 'import' | 'export' = 'none';
    let cancelLongRunningRequested = false;
    let chunkFolderSelection: PngChunkFolderSelection | null = null;
    let lastFolderCompose: PngChunkComposedSource | null = null;
    let previewDraft: PngImportDraft | null = null;
    let previewBlocks: Array<MapBlock | null> = [];
    let previewOriginalBlocks: Array<MapBlock | null> = [];
    let selectedPreviewIndex = -1;
    let previewTileSize = PNG_IMPORT_PREVIEW_MAX_TILE_SIZE;
    let previewZoom = 1;
    let importBusy = false;
    let progressStartedAt = 0;
    const selectedTypeButtons = new Map<string, HTMLButtonElement>();
    selectedPaletteInput.max = String(Math.max(paletteCount - 1, 0));

    const getNumericInputValue = (input: HTMLInputElement, fallback: number) => {
        const value = Number(input.value);
        return Number.isFinite(value) ? value : fallback;
    };

    const getSelectedPreviewBlock = () => (
        selectedPreviewIndex >= 0 && selectedPreviewIndex < previewBlocks.length
            ? previewBlocks[selectedPreviewIndex]
            : null
    );

    const getFolderSelectionRange = (): PngChunkSelectionRange => {
        if (!chunkFolderSelection) {
            return {
                minChunkColumn: 0,
                maxChunkColumn: 0,
                minChunkRow: 0,
                maxChunkRow: 0,
                maxChunks: 0
            };
        }
        const manifest = chunkFolderSelection.manifest;
        const minChunkColumn = clamp(Math.round(getNumericInputValue(folderMinColumnInput, 1)) - 1, 0, manifest.totalChunkColumns - 1);
        const maxChunkColumn = clamp(Math.round(getNumericInputValue(folderMaxColumnInput, manifest.totalChunkColumns)) - 1, minChunkColumn, manifest.totalChunkColumns - 1);
        const minChunkRow = clamp(Math.round(getNumericInputValue(folderMinRowInput, 1)) - 1, 0, manifest.totalChunkRows - 1);
        const maxChunkRow = clamp(Math.round(getNumericInputValue(folderMaxRowInput, manifest.totalChunkRows)) - 1, minChunkRow, manifest.totalChunkRows - 1);
        const maxChunks = Math.max(0, Math.round(getNumericInputValue(folderMaxChunksInput, 0)));
        return {
            minChunkColumn,
            maxChunkColumn,
            minChunkRow,
            maxChunkRow,
            maxChunks
        };
    };

    const syncFolderRangeInputs = () => {
        if (!chunkFolderSelection) {
            folderNameInput.value = 'No folder selected';
            folderMinColumnInput.value = '1';
            folderMaxColumnInput.value = '1';
            folderMinRowInput.value = '1';
            folderMaxRowInput.value = '1';
            folderMaxChunksInput.value = '0';
            folderMeta.textContent = 'Choose an exported chunk folder to reconstruct a larger map region.';
            return;
        }
        const manifest = chunkFolderSelection.manifest;
        const normalizedRange = getFolderSelectionRange();
        folderNameInput.value = chunkFolderSelection.directoryName;
        folderMinColumnInput.value = String(normalizedRange.minChunkColumn + 1);
        folderMaxColumnInput.value = String(normalizedRange.maxChunkColumn + 1);
        folderMinRowInput.value = String(normalizedRange.minChunkRow + 1);
        folderMaxRowInput.value = String(normalizedRange.maxChunkRow + 1);
        folderMaxChunksInput.value = String(normalizedRange.maxChunks);
        const selected = getPngChunkSelectionEntries(chunkFolderSelection, normalizedRange);
        folderMeta.textContent = `Loaded ${chunkFolderSelection.directoryName}. Export grid ${manifest.totalChunkColumns} x ${manifest.totalChunkRows} chunks covering ${manifest.totalSourceColumns} x ${manifest.totalSourceRows} source tiles. Current range includes ${selected.selectedChunks.length} of ${selected.totalSelectedChunks} available chunk PNGs.`;
    };

    const syncExportChunkInputs = () => {
        const preset = exportPresetSelect.value;
        const presetMatch = /^(\d+)x(\d+)$/i.exec(preset);
        const useCustom = preset === 'custom' || !presetMatch;
        exportWidthInput.disabled = !useCustom;
        exportHeightInput.disabled = !useCustom;
        if (presetMatch && !useCustom) {
            exportWidthInput.value = presetMatch[1];
            exportHeightInput.value = presetMatch[2];
        }
    };

    const getExportChunkSize = () => ({
        width: Math.max(1, Math.round(getNumericInputValue(exportWidthInput, PNG_CHUNK_DEFAULT_TILE_WIDTH))),
        height: Math.max(1, Math.round(getNumericInputValue(exportHeightInput, PNG_CHUNK_DEFAULT_TILE_HEIGHT)))
    });

    const syncFolderTargetWorldSpan = () => {
        if (!chunkFolderSelection || !folderFitTargetCheckbox.checked) {
            return;
        }
        worldWidthInput.value = String(getPngImportWorldSpanFromTileCount(chunkFolderSelection.manifest.totalSourceColumns));
        worldHeightInput.value = String(getPngImportWorldSpanFromTileCount(chunkFolderSelection.manifest.totalSourceRows));
    };

    const formatDuration = (milliseconds: number) => {
        const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    };

    const setProgress = (progress: PngImportProgress | null) => {
        if (!progress) {
            progressCard.hidden = true;
            progressBar.value = 0;
            progressLabel.textContent = 'Preparing…';
            progressDetail.textContent = '';
            progressTitle.textContent = 'Progress';
            progressCancelButton.hidden = true;
            progressCancelButton.textContent = 'Cancel';
            return;
        }
        progressCard.hidden = false;
        progressTitle.textContent = progressMode === 'export' ? 'Chunk export progress' : 'Import progress';
        progressCancelButton.hidden = progressMode === 'none';
        progressCancelButton.textContent = progressMode === 'export'
            ? (cancelLongRunningRequested ? 'Cancelling chunk export…' : 'Cancel chunk export')
            : (cancelLongRunningRequested ? 'Cancelling import…' : 'Cancel import');
        progressBar.max = Math.max(progress.total, 1);
        progressBar.value = clamp(progress.completed, 0, Math.max(progress.total, 1));
        const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
        progressLabel.textContent = `${progress.phase} — ${percent}%`;
        const elapsed = progressStartedAt > 0 ? Date.now() - progressStartedAt : 0;
        const eta = progress.completed > 0 && progress.total > progress.completed
            ? ` About ${formatDuration((elapsed / progress.completed) * (progress.total - progress.completed))} left.`
            : '';
        progressDetail.textContent = `${progress.detail}${eta}`;
    };

    const getCancellationMessage = () => (
        progressMode === 'export' ? 'Chunk export cancelled.' : 'Import cancelled.'
    );

    const throwIfCancelled = () => {
        if (cancelLongRunningRequested) {
            throw new Error(getCancellationMessage());
        }
    };

    const handleProgressUpdate = async (progress: PngImportProgress, detailTarget?: HTMLDivElement) => {
        throwIfCancelled();
        setProgress(progress);
        if (detailTarget) {
            detailTarget.textContent = `${progress.phase}: ${progress.detail}`;
        }
    };

    const buildDraftForCurrentImportMode = async () => {
        let draft: PngImportDraft;
        let previewContextMessage = '';
        if (importMode === 'folder') {
            if (!chunkFolderSelection) {
                throw new Error('Choose an exported chunk folder before previewing or importing the reconstructed map.');
            }
            const composed = await composePngChunkFolderSource(
                chunkFolderSelection,
                getFolderSelectionRange(),
                async (progress) => {
                    await handleProgressUpdate(progress, previewMeta);
                }
            );
            lastFolderCompose = composed;
            const baseWorldX = Math.round(getNumericInputValue(worldXInput, 0));
            const baseWorldY = Math.round(getNumericInputValue(worldYInput, 0));
            const composedWorldX = baseWorldX;
            const composedWorldY = baseWorldY;
            const composedWorldWidth = getPngImportWorldSpanFromTileCount(composed.manifest.totalSourceColumns);
            const composedWorldHeight = getPngImportWorldSpanFromTileCount(composed.manifest.totalSourceRows);
            worldWidthInput.value = String(composedWorldWidth);
            worldHeightInput.value = String(composedWorldHeight);
            draft = await buildPngImportDraftFromImage(composed.image, {
                sourceX: 0,
                sourceY: 0,
                sourceWidth: composed.sourceWidth,
                sourceHeight: composed.sourceHeight,
                worldX: composedWorldX,
                worldY: composedWorldY,
                worldWidth: composedWorldWidth,
                worldHeight: composedWorldHeight,
                activeTileIndexes: composed.activeTileIndexes,
                allowGridOffsetInference: false
            }, async (progress) => {
                await handleProgressUpdate(progress, previewMeta);
            });
            previewContextMessage = composed.totalSelectedChunks > composed.chunkCount
                ? ` Preview uses ${composed.chunkCount} chunk PNGs from the selected range (limited from ${composed.totalSelectedChunks}).`
                : ` Preview uses ${composed.chunkCount} chunk PNGs from the selected folder range.`;
        } else {
            draft = await buildPngImportDraftFromPng({
                url: resolvedPngUrl,
                sourceX: getNumericInputValue(sourceXInput, 0),
                sourceY: getNumericInputValue(sourceYInput, 0),
                sourceWidth: getNumericInputValue(sourceWidthInput, 0),
                sourceHeight: getNumericInputValue(sourceHeightInput, 0),
                worldX: getNumericInputValue(worldXInput, 0),
                worldY: getNumericInputValue(worldYInput, 0),
                worldWidth: getNumericInputValue(worldWidthInput, 32),
                worldHeight: getNumericInputValue(worldHeightInput, 32),
                replaceExisting: replaceCheckbox.checked
            }, async (progress) => {
                await handleProgressUpdate(progress, previewMeta);
            });
        }
        return {
            draft,
            previewContextMessage
        };
    };

    const setPreviewZoom = (zoom: number) => {
        previewZoom = clamp(zoom, 0.25, 8);
        previewCanvas.style.width = `${Math.max(1, Math.round(previewCanvas.width * previewZoom))}px`;
        previewCanvas.style.height = `${Math.max(1, Math.round(previewCanvas.height * previewZoom))}px`;
        zoomLabel.textContent = `${Math.round(previewZoom * 100)}%`;
    };

    const fitPreviewZoom = () => {
        if (!previewDraft || previewCanvas.width <= 0 || previewCanvas.height <= 0) {
            setPreviewZoom(1);
            return;
        }
        const availableWidth = Math.max(1, previewFrame.clientWidth - 12);
        const availableHeight = Math.max(1, previewFrame.clientHeight - 12);
        const fitZoom = Math.min(
            availableWidth / previewCanvas.width,
            availableHeight / previewCanvas.height
        );
        setPreviewZoom(clamp(fitZoom, 0.25, 8));
    };

    const syncImportModeUi = () => {
        const folderMode = importMode === 'folder';
        singleModeButton.classList.toggle('selected', !folderMode);
        folderModeButton.classList.toggle('selected', folderMode);
        singleSourceCard.hidden = folderMode;
        sourceCropCard.hidden = folderMode;
        folderSourceCard.hidden = !folderMode || workTab !== 'import';
        exportTabButton.disabled = folderMode;
        if (folderMode && workTab !== 'import') {
            workTab = 'import';
        }
        worldWidthInput.readOnly = folderMode;
        worldHeightInput.readOnly = folderMode;
        worldMeta.textContent = folderMode
            ? 'Chunk-folder mode uses the full folder import width and height, even if you limit the chunk run. World left/top is the origin for that full import area.'
            : 'Single PNG mode uses the source tile grid from the chosen PNG crop and maps it across the world rectangle you enter here.';
        refs.modalConfirm.style.display = workTab === 'export' ? 'none' : '';
    };

    const syncWorkTabUi = () => {
        const exportTabEnabled = importMode === 'single';
        const exportTabActive = exportTabEnabled && workTab === 'export';
        importTabButton.classList.toggle('selected', !exportTabActive);
        exportTabButton.classList.toggle('selected', exportTabActive);
        exportTabButton.hidden = !exportTabEnabled;
        tabSummary.textContent = exportTabActive
            ? 'Chunk export lets you slice a source PNG into reusable import sections with a manifest.'
            : 'Import mode previews matched world blocks before they touch the live world.';
        exportCard.hidden = !exportTabActive;
        worldCard.hidden = exportTabActive;
        actionCard.hidden = exportTabActive;
        importMain.hidden = exportTabActive;
        previewCard.hidden = exportTabActive;
        editorCard.hidden = exportTabActive;
        folderSourceCard.hidden = importMode !== 'folder' || exportTabActive;
        directFolderImportButton.hidden = exportTabActive || importMode !== 'folder';
    };

    const setImportBusy = (busy: boolean) => {
        importBusy = busy;
        refs.modal.dataset.busy = busy ? 'true' : 'false';
        const controls: Array<HTMLInputElement | HTMLButtonElement | HTMLSelectElement> = [
            singleModeButton,
            folderModeButton,
            importTabButton,
            exportTabButton,
            urlInput,
            browseButton,
            fileInput,
            folderBrowseButton,
            folderMinColumnInput,
            folderMaxColumnInput,
            folderMinRowInput,
            folderMaxRowInput,
            folderMaxChunksInput,
            folderFitTargetCheckbox,
            sourceXInput,
            sourceYInput,
            sourceWidthInput,
            sourceHeightInput,
            exportPresetSelect,
            exportWidthInput,
            exportHeightInput,
            exportSkipEmptyCheckbox,
            exportButton,
            worldXInput,
            worldYInput,
            worldWidthInput,
            worldHeightInput,
            replaceCheckbox,
            clearAllCheckbox,
            snapButton,
            previewButton,
            directFolderImportButton,
            selectedTypeFilterInput,
            selectedPaletteInput,
            selectedRotationSelect,
            selectedTranslationSelect,
            resetTileButton,
            zoomOutButton,
            zoomFitButton,
            zoomResetButton,
            zoomInButton,
            refs.modalClose
        ];
        for (const control of controls) {
            control.disabled = busy;
        }
        previewFrame.classList.toggle('busy', busy);
        progressCard.classList.toggle('busy', busy);
        selectedTypePicker.style.pointerEvents = busy ? 'none' : '';
        previewCanvas.style.pointerEvents = busy ? 'none' : '';
        worldWidthInput.disabled = busy || importMode === 'folder';
        worldHeightInput.disabled = busy || importMode === 'folder';
        progressCancelButton.disabled = !busy || progressMode === 'none';
        renderImportTypePicker();
        syncSelectedPreviewControls();
    };

    const renderImportTypePicker = () => {
        const selectedBlock = getSelectedPreviewBlock();
        const filter = selectedTypeFilterInput.value.trim().toLowerCase();
        const palette = selectedBlock && typeof selectedBlock.palette === 'number' ? selectedBlock.palette : 0;
        const rotation = normalizeRotation(selectedBlock?.rotation);
        const translation = normalizeSpriteTranslation(selectedBlock?.translation);
        for (const type of pngImportTypeNames) {
            let button = selectedTypeButtons.get(type);
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'world-designer-sprite-option';
                button.dataset.spriteType = type;

                const canvas = document.createElement('canvas');
                canvas.className = 'world-designer-sprite-canvas';
                canvas.width = 56;
                canvas.height = 56;
                button.appendChild(canvas);

                const label = document.createElement('div');
                label.className = 'world-designer-sprite-option-label';
                label.textContent = type;
                button.appendChild(label);

                button.addEventListener('click', () => {
                    const currentBlock = getSelectedPreviewBlock();
                    if (!currentBlock) {
                        return;
                    }
                    currentBlock.type = type;
                    const defaults = pngImportTypeDefaults.get(type);
                    if (defaults) {
                        currentBlock.collision = defaults.collision;
                        currentBlock.maskAstronaut = defaults.maskAstronaut;
                    }
                    selectedTypePicker.open = false;
                    renderPreviewCanvas();
                });

                selectedTypeButtons.set(type, button);
                selectedTypeGrid.appendChild(button);
            }

            const matchesFilter = filter.length === 0 || type.toLowerCase().includes(filter);
            button.hidden = !matchesFilter;
            button.style.display = matchesFilter ? '' : 'none';
            button.disabled = !selectedBlock || importBusy;
            button.classList.toggle('selected', type === selectedBlock?.type);
            const canvas = button.querySelector('canvas');
            if (canvas instanceof HTMLCanvasElement) {
                renderSpritePreviewCanvas(canvas, type, palette, rotation, translation);
            }
        }
    };

    const syncSelectedPreviewControls = () => {
        const selectedBlock = getSelectedPreviewBlock();
        const hasSelection = selectedBlock !== null;
        selectedTypePicker.open = hasSelection ? selectedTypePicker.open : false;
        selectedTypeFilterInput.disabled = !hasSelection || importBusy;
        selectedPaletteInput.disabled = !hasSelection || importBusy;
        selectedRotationSelect.disabled = !hasSelection || importBusy;
        selectedTranslationSelect.disabled = !hasSelection || importBusy;
        resetTileButton.disabled = !hasSelection || importBusy;
        if (!selectedBlock || !previewDraft) {
            selectedTileInput.value = 'No tile selected';
            clearPreviewCanvas(selectedTypePreviewCanvas);
            selectedTypeMeta.textContent = 'No sprite selected';
            renderImportTypePicker();
            return;
        }

        const column = selectedPreviewIndex % previewDraft.columns;
        const row = Math.floor(selectedPreviewIndex / previewDraft.columns);
        selectedTileInput.value = `Column ${column + 1}, row ${row + 1} — ${selectedBlock.type}`;
        selectedPaletteInput.value = String(typeof selectedBlock.palette === 'number' ? selectedBlock.palette : 0);
        selectedRotationSelect.value = String(normalizeRotation(selectedBlock.rotation));
        selectedTranslationSelect.value = normalizeSpriteTranslation(selectedBlock.translation);
        renderSpritePreviewCanvas(
            selectedTypePreviewCanvas,
            selectedBlock.type,
            typeof selectedBlock.palette === 'number' ? selectedBlock.palette : 0,
            normalizeRotation(selectedBlock.rotation),
            normalizeSpriteTranslation(selectedBlock.translation)
        );
        selectedTypeMeta.textContent = `${selectedBlock.type} — palette ${typeof selectedBlock.palette === 'number' ? selectedBlock.palette : 0}, rotation ${normalizeRotation(selectedBlock.rotation)}, translation ${formatSpriteTranslation(selectedBlock.translation)}`;
        renderImportTypePicker();
    };

    const renderPreviewCanvas = () => {
        if (!previewDraft) {
            previewCanvas.width = 32;
            previewCanvas.height = 32;
            setPreviewZoom(previewZoom);
            clearPreviewCanvas(previewCanvas);
            syncSelectedPreviewControls();
            return;
        }

        previewTileSize = getPngImportPreviewTileSize(previewDraft.columns, previewDraft.rows);
        previewCanvas.width = Math.max(1, previewDraft.columns * previewTileSize);
        previewCanvas.height = Math.max(1, previewDraft.rows * previewTileSize);
        setPreviewZoom(previewZoom);
        const ctx = previewCanvas.getContext('2d');
        if (!ctx) {
            syncSelectedPreviewControls();
            return;
        }

        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
        ctx.imageSmoothingEnabled = false;

        const lowConfidenceIndexes = new Set(previewDraft.lowConfidenceTileIndexes);
        for (let index = 0; index < previewBlocks.length; index += 1) {
            const block = previewBlocks[index];
            const column = index % previewDraft.columns;
            const row = Math.floor(index / previewDraft.columns);
            const drawX = column * previewTileSize;
            const drawY = row * previewTileSize;
            if (block) {
                ctx.save();
                ctx.translate(drawX, drawY);
                host.drawSpriteSample(
                    ctx,
                    block.type,
                    typeof block.palette === 'number' ? block.palette : 0,
                    normalizeRotation(block.rotation),
                    false,
                    previewTileSize,
                    normalizeSpriteTranslation(block.translation)
                );
                ctx.restore();
            }

            ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
            ctx.lineWidth = 1;
            ctx.strokeRect(drawX + 0.5, drawY + 0.5, previewTileSize - 1, previewTileSize - 1);

            if (lowConfidenceIndexes.has(index)) {
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
                ctx.lineWidth = 2;
                ctx.strokeRect(drawX + 1, drawY + 1, previewTileSize - 2, previewTileSize - 2);
            }
        }

        if (selectedPreviewIndex >= 0 && selectedPreviewIndex < previewBlocks.length) {
            const column = selectedPreviewIndex % previewDraft.columns;
            const row = Math.floor(selectedPreviewIndex / previewDraft.columns);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.98)';
            ctx.lineWidth = 3;
            ctx.strokeRect(
                column * previewTileSize + 1.5,
                row * previewTileSize + 1.5,
                previewTileSize - 3,
                previewTileSize - 3
            );
        }

        syncSelectedPreviewControls();
    };

    const invalidatePreview = (message: string) => {
        lastFolderCompose = null;
        previewDraft = null;
        previewBlocks = [];
        previewOriginalBlocks = [];
        selectedPreviewIndex = -1;
        refs.modalConfirm.disabled = true;
        previewMeta.textContent = message;
        renderPreviewCanvas();
    };

    const updatePngImportMeta = () => {
        const previewStateMessage = previewDraft
            ? ' Preview is ready below; click tiles to edit them before importing.'
            : ' Preview the blocks before importing so you can review and fix any bad matches.';
        if (importMode === 'folder') {
            if (!chunkFolderSelection) {
                meta.textContent = 'Choose an exported chunk folder to inspect and rebuild a larger map section.';
                return;
            }
            const range = getFolderSelectionRange();
            const { selectedChunks, totalSelectedChunks } = getPngChunkSelectionEntries(chunkFolderSelection, range);
            const worldX = Math.round(getNumericInputValue(worldXInput, 0));
            const worldY = Math.round(getNumericInputValue(worldYInput, 0));
            meta.textContent = `Loaded chunk folder ${chunkFolderSelection.directoryName}. The selected chunk range spans columns ${range.minChunkColumn + 1}-${range.maxChunkColumn + 1} and rows ${range.minChunkRow + 1}-${range.maxChunkRow + 1}, using ${selectedChunks.length} of ${totalSelectedChunks} available chunk PNGs. The importer will place that range relative to world origin (${worldX}, ${worldY}).${previewStateMessage}`;
            return;
        }
        if (!loadedImage) {
            meta.textContent = 'Enter a PNG URL to inspect and import.';
            return;
        }

        const sourceX = clamp(
            Math.round(getNumericInputValue(sourceXInput, 0)),
            0,
            Math.max(0, loadedImage.width - 1)
        );
        const sourceY = clamp(
            Math.round(getNumericInputValue(sourceYInput, 0)),
            0,
            Math.max(0, loadedImage.height - 1)
        );
        const sourceWidth = Math.max(
            1,
            Math.min(Math.round(getNumericInputValue(sourceWidthInput, loadedImage.width)), loadedImage.width - sourceX)
        );
        const sourceHeight = Math.max(
            1,
            Math.min(Math.round(getNumericInputValue(sourceHeightInput, loadedImage.height)), loadedImage.height - sourceY)
        );
        const sourceColumns = getPngImportSourceTileCount(sourceWidth);
        const sourceRows = getPngImportSourceTileCount(sourceHeight);
        const worldWidth = Math.max(1, Math.round(getNumericInputValue(worldWidthInput, getSuggestedPngImportWorldSpan(sourceWidth))));
        const worldHeight = Math.max(1, Math.round(getNumericInputValue(worldHeightInput, getSuggestedPngImportWorldSpan(sourceHeight))));
        const sourceTileAligned = sourceX % 32 === 0 &&
            sourceY % 32 === 0 &&
            sourceWidth % 32 === 0 &&
            sourceHeight % 32 === 0;
        meta.textContent = `Loaded ${resolvedPngLabel || resolvedPngUrl} (${loadedImage.width}x${loadedImage.height}). Source rect (${sourceX}, ${sourceY}, ${sourceWidth}x${sourceHeight}) is ${sourceTileAligned ? 'tile-aligned' : 'not tile-aligned'} and spans ${sourceColumns} x ${sourceRows} source tiles. Target world rect ${worldWidth}x${worldHeight} will place those ${sourceColumns} x ${sourceRows} blocks across that world area.${previewStateMessage}`;
    };

    const syncPngMetadata = async (options?: { forceFullImageBounds?: boolean }) => {
        if (importMode === 'folder') {
            loadedImage = null;
            updatePngImportMeta();
            return;
        }
        const url = resolvedPngUrl.trim();
        if (!url) {
            loadedImage = null;
            invalidatePreview('Preview not generated yet.');
            updatePngImportMeta();
            return;
        }

        try {
            const image = await loadImage(url);
            loadedImage = image;
            if (options?.forceFullImageBounds) {
                sourceXInput.value = '0';
                sourceYInput.value = '0';
                sourceWidthInput.value = String(image.width);
                sourceHeightInput.value = String(image.height);
                worldWidthInput.value = String(getSuggestedPngImportWorldSpan(image.width));
                worldHeightInput.value = String(getSuggestedPngImportWorldSpan(image.height));
            } else if (Number(sourceWidthInput.value) <= 0 || Number(sourceHeightInput.value) <= 0) {
                sourceXInput.value = '0';
                sourceYInput.value = '0';
                sourceWidthInput.value = String(image.width);
                sourceHeightInput.value = String(image.height);
                if (Number(worldWidthInput.value) <= 0) {
                    worldWidthInput.value = String(getSuggestedPngImportWorldSpan(image.width));
                }
                if (Number(worldHeightInput.value) <= 0) {
                    worldHeightInput.value = String(getSuggestedPngImportWorldSpan(image.height));
                }
            }
            invalidatePreview('Preview not generated yet. Click "Preview blocks" to inspect the matches.');
            updatePngImportMeta();
        } catch (error) {
            loadedImage = null;
            invalidatePreview(error instanceof Error ? error.message : 'Failed to generate a preview.');
            meta.textContent = error instanceof Error ? error.message : 'Failed to load the PNG metadata.';
        }
    };

    syncImportModeUi();
    syncWorkTabUi();
    syncExportChunkInputs();
    syncFolderRangeInputs();
    void syncPngMetadata();
    const switchImportMode = (nextMode: PngImportSourceMode) => {
        importMode = nextMode;
        invalidatePreview(importMode === 'folder'
            ? 'Preview not generated yet. Choose a chunk folder and click "Preview blocks" to inspect the reconstructed map section.'
            : 'Preview not generated yet. Click "Preview blocks" to inspect the matches.');
        syncImportModeUi();
        syncWorkTabUi();
        if (importMode === 'folder') {
            syncFolderRangeInputs();
            syncFolderTargetWorldSpan();
            updatePngImportMeta();
        } else {
            void syncPngMetadata();
        }
    };
    const switchWorkTab = (nextTab: PngImportWorkTab) => {
        if (nextTab === 'export' && importMode !== 'single') {
            return;
        }
        workTab = nextTab;
        syncImportModeUi();
        syncWorkTabUi();
    };
    singleModeButton.addEventListener('click', () => switchImportMode('single'));
    folderModeButton.addEventListener('click', () => switchImportMode('folder'));
    importTabButton.addEventListener('click', () => switchWorkTab('import'));
    exportTabButton.addEventListener('click', () => switchWorkTab('export'));
    progressCancelButton.addEventListener('click', () => {
        if (!importBusy || progressMode === 'none') {
            return;
        }
        cancelLongRunningRequested = true;
        setProgress({
            phase: progressMode === 'export' ? 'Cancelling chunk export' : 'Cancelling import',
            completed: progressBar.value,
            total: progressBar.max,
            detail: 'Finishing the current step before stopping.'
        });
    });
    browseButton.addEventListener('click', () => {
        fileInput.click();
    });
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) {
            return;
        }
        clearPngImportObjectUrl();
        const nextObjectUrl = URL.createObjectURL(file);
        setPngImportObjectUrl(nextObjectUrl);
        resolvedPngUrl = nextObjectUrl;
        resolvedPngLabel = file.name;
        urlInput.value = file.name;
        void syncPngMetadata({ forceFullImageBounds: true });
    });
    folderBrowseButton.addEventListener('click', async () => {
        try {
            progressStartedAt = Date.now();
            progressMode = 'import';
            cancelLongRunningRequested = false;
            setImportBusy(true);
            setProgress({
                phase: 'Reading chunk folder',
                completed: 0,
                total: 1,
                detail: 'Loading the exported chunk manifest and PNG files.'
            });
            const directoryHandle = await getDirectoryPicker()();
            chunkFolderSelection = await readPngChunkFolderSelection(directoryHandle, async (progress) => {
                await handleProgressUpdate(progress, folderMeta);
            });
            folderMinColumnInput.value = '1';
            folderMaxColumnInput.value = String(chunkFolderSelection.manifest.totalChunkColumns);
            folderMinRowInput.value = '1';
            folderMaxRowInput.value = String(chunkFolderSelection.manifest.totalChunkRows);
            folderMaxChunksInput.value = '0';
            syncFolderRangeInputs();
            syncFolderTargetWorldSpan();
            invalidatePreview('Preview not generated yet. Click "Preview blocks" to inspect the reconstructed map section.');
            updatePngImportMeta();
        } catch (error) {
            chunkFolderSelection = null;
            syncFolderRangeInputs();
            invalidatePreview(error instanceof Error ? error.message : 'Failed to read the chunk folder.');
            setStatus(
                error instanceof Error ? error.message : 'Failed to read the chunk folder.',
                error instanceof Error && error.message === 'Import cancelled.' ? 'neutral' : 'error'
            );
        } finally {
            progressMode = 'none';
            setImportBusy(false);
            setProgress(null);
        }
    });

    urlInput.addEventListener('change', () => {
        clearPngImportObjectUrl();
        resolvedPngUrl = urlInput.value.trim();
        resolvedPngLabel = resolvedPngUrl;
        sourceWidthInput.value = '0';
        sourceHeightInput.value = '0';
        void syncPngMetadata();
    });

    const handleImportFieldChanged = () => {
        invalidatePreview(importMode === 'folder'
            ? 'Preview is out of date. Click "Preview blocks" again before importing the reconstructed chunk range.'
            : 'Preview is out of date. Click "Preview blocks" again before importing.');
        if (importMode === 'folder') {
            syncFolderTargetWorldSpan();
        }
        updatePngImportMeta();
    };

    [
        sourceXInput,
        sourceYInput,
        sourceWidthInput,
        sourceHeightInput,
        worldXInput,
        worldYInput,
        worldWidthInput,
        worldHeightInput
    ].forEach((input) => {
        input.addEventListener('input', handleImportFieldChanged);
        input.addEventListener('change', handleImportFieldChanged);
    });
    [
        folderMinColumnInput,
        folderMaxColumnInput,
        folderMinRowInput,
        folderMaxRowInput,
        folderMaxChunksInput
    ].forEach((input) => {
        input.addEventListener('input', () => {
            syncFolderRangeInputs();
            handleImportFieldChanged();
        });
        input.addEventListener('change', () => {
            syncFolderRangeInputs();
            handleImportFieldChanged();
        });
    });
    folderFitTargetCheckbox.addEventListener('change', () => {
        syncFolderTargetWorldSpan();
        updatePngImportMeta();
    });
    exportPresetSelect.addEventListener('change', () => {
        syncExportChunkInputs();
        updatePngImportMeta();
    });
    [exportWidthInput, exportHeightInput].forEach((input) => {
        input.addEventListener('input', () => {
            exportPresetSelect.value = 'custom';
            syncExportChunkInputs();
            updatePngImportMeta();
        });
        input.addEventListener('change', () => {
            exportPresetSelect.value = 'custom';
            syncExportChunkInputs();
            updatePngImportMeta();
        });
    });

    zoomOutButton.addEventListener('click', () => setPreviewZoom(previewZoom / 1.25));
    zoomInButton.addEventListener('click', () => setPreviewZoom(previewZoom * 1.25));
    zoomResetButton.addEventListener('click', () => setPreviewZoom(1));
    zoomFitButton.addEventListener('click', fitPreviewZoom);

    snapButton.addEventListener('click', () => {
        if (!loadedImage) {
            setStatus('Load a PNG before snapping the source rectangle.', 'error');
            return;
        }

        const currentX = clamp(
            Math.round(getNumericInputValue(sourceXInput, 0)),
            0,
            Math.max(0, loadedImage.width - 1)
        );
        const currentY = clamp(
            Math.round(getNumericInputValue(sourceYInput, 0)),
            0,
            Math.max(0, loadedImage.height - 1)
        );
        const currentWidth = Math.max(
            1,
            Math.min(Math.round(getNumericInputValue(sourceWidthInput, loadedImage.width)), loadedImage.width - currentX)
        );
        const currentHeight = Math.max(
            1,
            Math.min(Math.round(getNumericInputValue(sourceHeightInput, loadedImage.height)), loadedImage.height - currentY)
        );
        const snappedX = Math.floor(currentX / 32) * 32;
        const snappedY = Math.floor(currentY / 32) * 32;
        const snappedRight = Math.min(loadedImage.width, Math.ceil((currentX + currentWidth) / 32) * 32);
        const snappedBottom = Math.min(loadedImage.height, Math.ceil((currentY + currentHeight) / 32) * 32);
        sourceXInput.value = String(snappedX);
        sourceYInput.value = String(snappedY);
        sourceWidthInput.value = String(Math.max(1, snappedRight - snappedX));
        sourceHeightInput.value = String(Math.max(1, snappedBottom - snappedY));
        invalidatePreview('Preview is out of date. Click "Preview blocks" again before importing.');
        updatePngImportMeta();
    });
    exportButton.addEventListener('click', async () => {
        if (importMode !== 'single') {
            setStatus('Chunk export is only available when working from a single PNG source.', 'error');
            return;
        }
        if (!loadedImage) {
            setStatus('Load a PNG before exporting chunk files.', 'error');
            return;
        }
        const sourceX = clamp(Math.round(getNumericInputValue(sourceXInput, 0)), 0, Math.max(0, loadedImage.width - 1));
        const sourceY = clamp(Math.round(getNumericInputValue(sourceYInput, 0)), 0, Math.max(0, loadedImage.height - 1));
        const sourceWidth = Math.max(1, Math.min(Math.round(getNumericInputValue(sourceWidthInput, loadedImage.width)), loadedImage.width - sourceX));
        const sourceHeight = Math.max(1, Math.min(Math.round(getNumericInputValue(sourceHeightInput, loadedImage.height)), loadedImage.height - sourceY));
        const chunkSize = getExportChunkSize();
        progressStartedAt = Date.now();
        progressMode = 'export';
        cancelLongRunningRequested = false;
        setImportBusy(true);
        setProgress({
            phase: 'Preparing chunk export',
            completed: 0,
            total: 1,
            detail: 'Validating the PNG crop and opening a destination folder.'
        });
        const totalChunkColumns = Math.ceil((sourceWidth / PNG_IMPORT_SOURCE_TILE_SIZE) / chunkSize.width);
        const totalChunkRows = Math.ceil((sourceHeight / PNG_IMPORT_SOURCE_TILE_SIZE) / chunkSize.height);
        const estimatedChunkCount = Math.max(1, totalChunkColumns * totalChunkRows);
        exportMeta.textContent = `Preparing to export about ${estimatedChunkCount} chunk PNGs (${totalChunkColumns} x ${totalChunkRows}).`;
        try {
            const result = await exportPngChunksToDirectory({
                image: loadedImage,
                sourceName: resolvedPngLabel || resolvedPngUrl || 'png-import',
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                chunkTileWidth: chunkSize.width,
                chunkTileHeight: chunkSize.height,
                skipEmpty: exportSkipEmptyCheckbox.checked,
                shouldCancel: () => cancelLongRunningRequested
            }, async (progress) => {
                await handleProgressUpdate(progress, exportMeta);
            });
            exportMeta.textContent = `Exported ${result.exportedChunks} chunk PNGs to ${result.directoryName}${result.skippedChunks > 0 ? ` and skipped ${result.skippedChunks} empty chunks` : ''}. The folder also contains ${PNG_CHUNK_EXPORT_MANIFEST_NAME} so the chunk-folder importer can rebuild the larger map automatically.`;
            setStatus(
                `Exported ${result.exportedChunks} chunk PNGs to ${result.directoryName}${result.skippedChunks > 0 ? ` and skipped ${result.skippedChunks} empty chunks` : ''}.`,
                'success'
            );
        } catch (error) {
            exportMeta.textContent = error instanceof Error ? error.message : 'Failed to export chunk PNGs.';
            setStatus(
                error instanceof Error ? error.message : 'Failed to export chunk PNGs.',
                error instanceof Error && error.message === 'Chunk export cancelled.' ? 'neutral' : 'error'
            );
        } finally {
            progressMode = 'none';
            setImportBusy(false);
            setProgress(null);
        }
    });

    previewCanvas.addEventListener('click', (event) => {
        if (!previewDraft || previewBlocks.length === 0) {
            return;
        }
        const rect = previewCanvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return;
        }
        const scaleX = previewCanvas.width / rect.width;
        const scaleY = previewCanvas.height / rect.height;
        const localX = (event.clientX - rect.left) * scaleX;
        const localY = (event.clientY - rect.top) * scaleY;
        const column = clamp(Math.floor(localX / previewTileSize), 0, previewDraft.columns - 1);
        const row = clamp(Math.floor(localY / previewTileSize), 0, previewDraft.rows - 1);
        selectedPreviewIndex = row * previewDraft.columns + column;
        renderPreviewCanvas();
    });

    selectedPaletteInput.addEventListener('change', () => {
        const selectedBlock = getSelectedPreviewBlock();
        if (!selectedBlock) {
            return;
        }
        const palette = clamp(Math.round(getNumericInputValue(selectedPaletteInput, 0)), 0, Math.max(paletteCount - 1, 0));
        selectedBlock.palette = palette;
        selectedPaletteInput.value = String(palette);
        renderPreviewCanvas();
    });

    selectedRotationSelect.addEventListener('change', () => {
        const selectedBlock = getSelectedPreviewBlock();
        if (!selectedBlock) {
            return;
        }
        selectedBlock.rotation = normalizeRotation(Number(selectedRotationSelect.value)) as MapBlock['rotation'];
        renderPreviewCanvas();
    });

    selectedTranslationSelect.addEventListener('change', () => {
        const selectedBlock = getSelectedPreviewBlock();
        if (!selectedBlock) {
            return;
        }
        selectedBlock.translation = normalizeSpriteTranslation(selectedTranslationSelect.value);
        renderPreviewCanvas();
    });

    resetTileButton.addEventListener('click', () => {
        if (selectedPreviewIndex < 0 || selectedPreviewIndex >= previewOriginalBlocks.length) {
            return;
        }
        const originalBlock = previewOriginalBlocks[selectedPreviewIndex];
        previewBlocks[selectedPreviewIndex] = originalBlock ? toMapBlockData(originalBlock) : null;
        renderPreviewCanvas();
    });

    previewButton.addEventListener('click', async () => {
        progressStartedAt = Date.now();
        previewButton.textContent = 'Generating…';
        previewMeta.textContent = 'Generating preview…';
        progressMode = 'import';
        cancelLongRunningRequested = false;
        setImportBusy(true);
        setProgress({
            phase: 'Preparing import',
            completed: 0,
            total: 1,
            detail: 'Starting PNG preview generation.'
        });
        try {
            const { draft, previewContextMessage } = await buildDraftForCurrentImportMode();
            previewDraft = draft;
            previewBlocks = draft.blocks.map((block) => (block ? toMapBlockData(block) : null));
            previewOriginalBlocks = draft.blocks.map((block) => (block ? toMapBlockData(block) : null));
            selectedPreviewIndex = previewBlocks.findIndex((block) => block !== null);
            renderPreviewCanvas();
            fitPreviewZoom();
            const importedTileCount = draft.blocks.filter((block) => block !== null).length;
            const gridOffsetMessage = draft.sourceGridOffsetX !== 0 || draft.sourceGridOffsetY !== 0
                ? ` Auto-aligned the source grid by (${draft.sourceGridOffsetX}, ${draft.sourceGridOffsetY}) px before matching.`
                : '';
            previewMeta.textContent = draft.uncertainTiles > 0
                ? `Preview ready. ${draft.uncertainTiles} tile${draft.uncertainTiles === 1 ? '' : 's'} were low-confidence matches and are outlined in gold.${gridOffsetMessage}${previewContextMessage}`
                : `Preview ready. ${importedTileCount} tile${importedTileCount === 1 ? '' : 's'} matched cleanly.${gridOffsetMessage}${previewContextMessage}`;
            refs.modalConfirm.disabled = selectedPreviewIndex < 0;
            updatePngImportMeta();
        } catch (error) {
            invalidatePreview(error instanceof Error ? error.message : 'Failed to generate the preview.');
            setStatus(
                error instanceof Error ? error.message : 'Failed to generate the PNG preview.',
                error instanceof Error && error.message === 'Import cancelled.' ? 'neutral' : 'error'
            );
        } finally {
            progressMode = 'none';
            setImportBusy(false);
            setProgress(null);
            previewButton.textContent = 'Preview blocks';
        }
    });

    directFolderImportButton.addEventListener('click', async () => {
        if (importMode !== 'folder') {
            return;
        }
        progressStartedAt = Date.now();
        previewMeta.textContent = 'Trying folder import without manual review…';
        progressMode = 'import';
        cancelLongRunningRequested = false;
        setImportBusy(true);
        setProgress({
            phase: 'Preparing import',
            completed: 0,
            total: 1,
            detail: 'Starting direct chunk-folder import.'
        });
        try {
            const { draft } = await buildDraftForCurrentImportMode();
            applyPngImportDraft(draft, replaceCheckbox.checked, clearAllCheckbox.checked);
            closeModal(true);
            const blockCount = draft.blocks.filter((block): block is MapBlock => block !== null).length;
            setStatus(
                draft.uncertainTiles > 0
                    ? `Imported ${blockCount} draft world tiles from the chunk folder without manual preview review. ${draft.uncertainTiles} tile${draft.uncertainTiles === 1 ? '' : 's'} were low-confidence matches, so review the result before saving.`
                    : `Imported ${blockCount} draft world tiles from the chunk folder without manual preview review.`,
                draft.uncertainTiles > 0 ? 'neutral' : 'success'
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to import the chunk folder.';
            previewMeta.textContent = message;
            setStatus(
                message,
                error instanceof Error && error.message === 'Import cancelled.' ? 'neutral' : 'error'
            );
        } finally {
            progressMode = 'none';
            setImportBusy(false);
            setProgress(null);
        }
    });

    selectedTypeFilterInput.addEventListener('input', () => {
        renderImportTypePicker();
    });

    setModalConfirmAction(async () => {
        if (!previewDraft || previewBlocks.length === 0) {
            setStatus('Generate a preview before importing so you can review the matched blocks.', 'error');
            refs.modalConfirm.disabled = true;
            return;
        }
        try {
            setImportBusy(true);
            const sourceLabel = importMode === 'folder' ? 'chunk folder' : 'PNG';
            const committedDraft: PngImportDraft = {
                ...previewDraft,
                blocks: previewBlocks.map((block) => (block ? toMapBlockData(block) : null))
            };
            applyPngImportDraft(committedDraft, replaceCheckbox.checked, clearAllCheckbox.checked);
            closeModal(true);
            const blockCount = committedDraft.blocks.filter((block): block is MapBlock => block !== null).length;
            setStatus(
                committedDraft.uncertainTiles > 0
                    ? `Imported ${blockCount} reviewed draft world tiles from the ${sourceLabel}. ${committedDraft.uncertainTiles} tile${committedDraft.uncertainTiles === 1 ? '' : 's'} were low-confidence auto-matches before review.`
                    : `Imported ${blockCount} reviewed draft world tiles from the ${sourceLabel}.`,
                committedDraft.uncertainTiles > 0 ? 'neutral' : 'success'
            );
        } catch (error) {
            refs.modalConfirm.disabled = false;
            setStatus(
                error instanceof Error ? error.message : 'Failed to import a draft from the PNG.',
                'error'
            );
        } finally {
            setImportBusy(false);
        }
    });

    renderImportTypePicker();
    syncSelectedPreviewControls();
    setPreviewZoom(1);
    setImportBusy(false);
}
