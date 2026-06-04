export type PngImportProgress = {
    phase: string;
    completed: number;
    total: number;
    detail: string;
};

export type PngChunkEntry = {
    fileName: string;
    chunkColumn: number;
    chunkRow: number;
    sourceTileX: number;
    sourceTileY: number;
    tileWidth: number;
    tileHeight: number;
    pixelX: number;
    pixelY: number;
    pixelWidth: number;
    pixelHeight: number;
};

export type PngChunkManifest = {
    version: 1;
    sourceName: string;
    tileSize: number;
    crop: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    chunkTileWidth: number;
    chunkTileHeight: number;
    totalSourceColumns: number;
    totalSourceRows: number;
    totalChunkColumns: number;
    totalChunkRows: number;
    chunks: PngChunkEntry[];
};

export type PngChunkFolderSelection = {
    directoryName: string;
    manifest: PngChunkManifest;
    files: Map<string, File>;
    emptyChunkFileNames: Set<string>;
};

export type PngChunkSelectionRange = {
    minChunkColumn: number;
    maxChunkColumn: number;
    minChunkRow: number;
    maxChunkRow: number;
    maxChunks: number;
};

export type PngChunkComposedSource = {
    image: HTMLImageElement;
    manifest: PngChunkManifest;
    selectedChunks: PngChunkEntry[];
    chunkCount: number;
    totalSelectedChunks: number;
    sourceWidth: number;
    sourceHeight: number;
    columns: number;
    rows: number;
    activeTileIndexes: Set<number>;
};

type BrowserFileSystemWriteChunk =
    | Blob
    | BufferSource
    | string
    | { type: 'write'; position?: number; data: Blob | BufferSource | string }
    | { type: 'seek'; position: number }
    | { type: 'truncate'; size: number };

interface BrowserWritableFileStream {
    write(data: BrowserFileSystemWriteChunk): Promise<void>;
    close(): Promise<void>;
}

interface BrowserFileHandle {
    kind: 'file';
    name: string;
    getFile(): Promise<File>;
    createWritable(): Promise<BrowserWritableFileStream>;
}

export interface BrowserDirectoryHandle {
    kind: 'directory';
    name: string;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<BrowserFileHandle>;
    values(): AsyncIterable<BrowserFileHandle | BrowserDirectoryHandle>;
}

interface BrowserWindowWithDirectoryPicker extends Window {
    showDirectoryPicker?: () => Promise<BrowserDirectoryHandle>;
}

const PNG_IMPORT_SOURCE_TILE_SIZE = 32;
const PNG_CHUNK_EXPORT_MANIFEST_NAME = 'png-import-chunks.manifest.json';

function yieldToUi() {
    return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

export function padInteger(value: number, minimumDigits: number) {
    return Math.max(0, Math.round(value)).toString().padStart(minimumDigits, '0');
}

export function getChunkBaseName(sourceName: string) {
    const withoutExtension = sourceName.replace(/\.[^.]+$/, '');
    const normalized = withoutExtension
        .trim()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
    return normalized || 'png-import';
}

export function buildPngChunkFileName(sourceName: string, entry: PngChunkEntry) {
    const baseName = getChunkBaseName(sourceName);
    return `${baseName}__r${padInteger(entry.chunkRow, 4)}__c${padInteger(entry.chunkColumn, 4)}__tx${padInteger(entry.sourceTileX, 5)}__ty${padInteger(entry.sourceTileY, 5)}__w${padInteger(entry.tileWidth, 4)}__h${padInteger(entry.tileHeight, 4)}.png`;
}

export function parsePngChunkFileName(fileName: string): PngChunkEntry | null {
    const match = /__r(\d+)__c(\d+)__tx(\d+)__ty(\d+)__w(\d+)__h(\d+)\.png$/i.exec(fileName);
    if (!match) {
        return null;
    }
    const chunkRow = Number(match[1]);
    const chunkColumn = Number(match[2]);
    const sourceTileX = Number(match[3]);
    const sourceTileY = Number(match[4]);
    const tileWidth = Number(match[5]);
    const tileHeight = Number(match[6]);
    if (
        !Number.isFinite(chunkRow) ||
        !Number.isFinite(chunkColumn) ||
        !Number.isFinite(sourceTileX) ||
        !Number.isFinite(sourceTileY) ||
        !Number.isFinite(tileWidth) ||
        !Number.isFinite(tileHeight) ||
        tileWidth <= 0 ||
        tileHeight <= 0
    ) {
        return null;
    }
    return {
        fileName,
        chunkColumn: Math.round(chunkColumn),
        chunkRow: Math.round(chunkRow),
        sourceTileX: Math.round(sourceTileX),
        sourceTileY: Math.round(sourceTileY),
        tileWidth: Math.round(tileWidth),
        tileHeight: Math.round(tileHeight),
        pixelX: Math.round(sourceTileX) * PNG_IMPORT_SOURCE_TILE_SIZE,
        pixelY: Math.round(sourceTileY) * PNG_IMPORT_SOURCE_TILE_SIZE,
        pixelWidth: Math.round(tileWidth) * PNG_IMPORT_SOURCE_TILE_SIZE,
        pixelHeight: Math.round(tileHeight) * PNG_IMPORT_SOURCE_TILE_SIZE
    };
}

export function getDirectoryPicker() {
    const picker = (window as BrowserWindowWithDirectoryPicker).showDirectoryPicker;
    if (!picker) {
        throw new Error('This browser does not support choosing a folder. Use a Chromium-based browser with the File System Access API enabled.');
    }
    return picker.bind(window as BrowserWindowWithDirectoryPicker);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png') {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }
            reject(new Error('Could not create a PNG blob from the chunk canvas.'));
        }, type);
    });
}

export async function writeBlobToDirectory(directoryHandle: BrowserDirectoryHandle, fileName: string, blob: Blob) {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

export async function writeTextToDirectory(directoryHandle: BrowserDirectoryHandle, fileName: string, text: string) {
    const blob = new Blob([text], { type: 'application/json' });
    await writeBlobToDirectory(directoryHandle, fileName, blob);
}

export function isImageDataEmpty(imageData: ImageData) {
    for (let index = 0; index < imageData.data.length; index += 4) {
        const alpha = imageData.data[index + 3];
        if (alpha === 0) {
            continue;
        }
        if (
            imageData.data[index] !== 0 ||
            imageData.data[index + 1] !== 0 ||
            imageData.data[index + 2] !== 0
        ) {
            return false;
        }
    }
    return true;
}

export async function loadImageFromBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    try {
        const image = new Image();
        image.decoding = 'async';
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('Failed to decode an exported PNG chunk.'));
            image.src = url;
        });
        return image;
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function isChunkFileEmpty(file: File) {
    const bitmap = await createImageBitmap(file);
    try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not create a canvas context while analyzing chunk PNGs.');
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bitmap, 0, 0);
        return isImageDataEmpty(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } finally {
        bitmap.close();
    }
}

export function normalizePngChunkManifest(raw: unknown): PngChunkManifest {
    if (!raw || typeof raw !== 'object') {
        throw new Error('Chunk manifest is missing or invalid.');
    }
    const manifestRecord = raw as Record<string, unknown>;
    const cropRecord = manifestRecord.crop;
    if (!cropRecord || typeof cropRecord !== 'object') {
        throw new Error('Chunk manifest is missing crop metadata.');
    }
    const crop = cropRecord as Record<string, unknown>;
    // Accept both hand-authored and generated manifests, then normalize everything to integer tile coordinates.
    const rawChunks = Array.isArray(manifestRecord.chunks) ? manifestRecord.chunks : [];
    const chunks = rawChunks.map((entry, index) => {
        if (!entry || typeof entry !== 'object') {
            throw new Error(`Chunk manifest entry ${index + 1} is invalid.`);
        }
        const record = entry as Record<string, unknown>;
        const chunkEntry: PngChunkEntry = {
            fileName: String(record.fileName ?? ''),
            chunkColumn: Number(record.chunkColumn),
            chunkRow: Number(record.chunkRow),
            sourceTileX: Number(record.sourceTileX),
            sourceTileY: Number(record.sourceTileY),
            tileWidth: Number(record.tileWidth),
            tileHeight: Number(record.tileHeight),
            pixelX: Number(record.pixelX),
            pixelY: Number(record.pixelY),
            pixelWidth: Number(record.pixelWidth),
            pixelHeight: Number(record.pixelHeight)
        };
        if (
            !chunkEntry.fileName ||
            !Number.isFinite(chunkEntry.chunkColumn) ||
            !Number.isFinite(chunkEntry.chunkRow) ||
            !Number.isFinite(chunkEntry.sourceTileX) ||
            !Number.isFinite(chunkEntry.sourceTileY) ||
            !Number.isFinite(chunkEntry.tileWidth) ||
            !Number.isFinite(chunkEntry.tileHeight) ||
            !Number.isFinite(chunkEntry.pixelX) ||
            !Number.isFinite(chunkEntry.pixelY) ||
            !Number.isFinite(chunkEntry.pixelWidth) ||
            !Number.isFinite(chunkEntry.pixelHeight)
        ) {
            throw new Error(`Chunk manifest entry ${index + 1} is incomplete.`);
        }
        return {
            ...chunkEntry,
            chunkColumn: Math.round(chunkEntry.chunkColumn),
            chunkRow: Math.round(chunkEntry.chunkRow),
            sourceTileX: Math.round(chunkEntry.sourceTileX),
            sourceTileY: Math.round(chunkEntry.sourceTileY),
            tileWidth: Math.round(chunkEntry.tileWidth),
            tileHeight: Math.round(chunkEntry.tileHeight),
            pixelX: Math.round(chunkEntry.pixelX),
            pixelY: Math.round(chunkEntry.pixelY),
            pixelWidth: Math.round(chunkEntry.pixelWidth),
            pixelHeight: Math.round(chunkEntry.pixelHeight)
        };
    });
    const manifest: PngChunkManifest = {
        version: 1,
        sourceName: String(manifestRecord.sourceName ?? 'png-import'),
        tileSize: Math.round(Number(manifestRecord.tileSize)),
        crop: {
            x: Math.round(Number(crop.x)),
            y: Math.round(Number(crop.y)),
            width: Math.round(Number(crop.width)),
            height: Math.round(Number(crop.height))
        },
        chunkTileWidth: Math.round(Number(manifestRecord.chunkTileWidth)),
        chunkTileHeight: Math.round(Number(manifestRecord.chunkTileHeight)),
        totalSourceColumns: Math.round(Number(manifestRecord.totalSourceColumns)),
        totalSourceRows: Math.round(Number(manifestRecord.totalSourceRows)),
        totalChunkColumns: Math.round(Number(manifestRecord.totalChunkColumns)),
        totalChunkRows: Math.round(Number(manifestRecord.totalChunkRows)),
        chunks
    };
    if (
        manifest.tileSize !== PNG_IMPORT_SOURCE_TILE_SIZE ||
        manifest.crop.x < 0 ||
        manifest.crop.y < 0 ||
        manifest.crop.width <= 0 ||
        manifest.crop.height <= 0 ||
        manifest.chunkTileWidth <= 0 ||
        manifest.chunkTileHeight <= 0 ||
        manifest.totalSourceColumns <= 0 ||
        manifest.totalSourceRows <= 0 ||
        manifest.totalChunkColumns <= 0 ||
        manifest.totalChunkRows <= 0
    ) {
        throw new Error('Chunk manifest metadata is invalid or unsupported.');
    }
    return manifest;
}

export function buildChunkManifestFromFiles(directoryName: string, entries: PngChunkEntry[]) {
    if (entries.length === 0) {
        throw new Error('The selected folder does not contain any chunk PNGs with a supported naming pattern.');
    }
    const minTileX = Math.min(...entries.map((entry) => entry.sourceTileX));
    const minTileY = Math.min(...entries.map((entry) => entry.sourceTileY));
    const maxTileX = Math.max(...entries.map((entry) => entry.sourceTileX + entry.tileWidth));
    const maxTileY = Math.max(...entries.map((entry) => entry.sourceTileY + entry.tileHeight));
    const maxChunkColumn = Math.max(...entries.map((entry) => entry.chunkColumn));
    const maxChunkRow = Math.max(...entries.map((entry) => entry.chunkRow));
    return normalizePngChunkManifest({
        version: 1,
        sourceName: directoryName,
        tileSize: PNG_IMPORT_SOURCE_TILE_SIZE,
        crop: {
            x: minTileX * PNG_IMPORT_SOURCE_TILE_SIZE,
            y: minTileY * PNG_IMPORT_SOURCE_TILE_SIZE,
            width: (maxTileX - minTileX) * PNG_IMPORT_SOURCE_TILE_SIZE,
            height: (maxTileY - minTileY) * PNG_IMPORT_SOURCE_TILE_SIZE
        },
        chunkTileWidth: Math.max(...entries.map((entry) => entry.tileWidth)),
        chunkTileHeight: Math.max(...entries.map((entry) => entry.tileHeight)),
        totalSourceColumns: maxTileX - minTileX,
        totalSourceRows: maxTileY - minTileY,
        totalChunkColumns: maxChunkColumn + 1,
        totalChunkRows: maxChunkRow + 1,
        chunks: entries.map((entry) => ({
            ...entry,
            sourceTileX: entry.sourceTileX,
            sourceTileY: entry.sourceTileY
        }))
    });
}

export async function exportPngChunksToDirectory(config: {
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
}, onProgress?: (progress: PngImportProgress) => void | Promise<void>) {
    if (
        config.sourceX % PNG_IMPORT_SOURCE_TILE_SIZE !== 0 ||
        config.sourceY % PNG_IMPORT_SOURCE_TILE_SIZE !== 0 ||
        config.sourceWidth % PNG_IMPORT_SOURCE_TILE_SIZE !== 0 ||
        config.sourceHeight % PNG_IMPORT_SOURCE_TILE_SIZE !== 0
    ) {
        throw new Error('Chunk export requires a source crop aligned to 32px tile boundaries.');
    }
    const directoryHandle = await getDirectoryPicker()();
    const totalSourceColumns = config.sourceWidth / PNG_IMPORT_SOURCE_TILE_SIZE;
    const totalSourceRows = config.sourceHeight / PNG_IMPORT_SOURCE_TILE_SIZE;
    const totalChunkColumns = Math.ceil(totalSourceColumns / config.chunkTileWidth);
    const totalChunkRows = Math.ceil(totalSourceRows / config.chunkTileHeight);
    const sourceTileOriginX = Math.round(config.sourceX / PNG_IMPORT_SOURCE_TILE_SIZE);
    const sourceTileOriginY = Math.round(config.sourceY / PNG_IMPORT_SOURCE_TILE_SIZE);
    const chunkCanvas = document.createElement('canvas');
    const chunkContext = chunkCanvas.getContext('2d');
    if (!chunkContext) {
        throw new Error('Could not create a canvas context for chunk export.');
    }
    chunkContext.imageSmoothingEnabled = false;

    const chunks: PngChunkEntry[] = [];
    const totalChunkCount = Math.max(1, totalChunkColumns * totalChunkRows);
    let processedChunks = 0;
    let exportedChunks = 0;
    let skippedChunks = 0;
    const progressStep = Math.max(1, Math.floor(totalChunkCount / 40));
    let lastYieldAt = 0;

    for (let chunkRow = 0; chunkRow < totalChunkRows; chunkRow += 1) {
        for (let chunkColumn = 0; chunkColumn < totalChunkColumns; chunkColumn += 1) {
            if (config.shouldCancel?.()) {
                throw new Error('Chunk export cancelled.');
            }
            const sourceTileX = sourceTileOriginX + chunkColumn * config.chunkTileWidth;
            const sourceTileY = sourceTileOriginY + chunkRow * config.chunkTileHeight;
            const tileWidth = Math.min(config.chunkTileWidth, totalSourceColumns - chunkColumn * config.chunkTileWidth);
            const tileHeight = Math.min(config.chunkTileHeight, totalSourceRows - chunkRow * config.chunkTileHeight);
            const pixelX = sourceTileX * PNG_IMPORT_SOURCE_TILE_SIZE;
            const pixelY = sourceTileY * PNG_IMPORT_SOURCE_TILE_SIZE;
            const pixelWidth = tileWidth * PNG_IMPORT_SOURCE_TILE_SIZE;
            const pixelHeight = tileHeight * PNG_IMPORT_SOURCE_TILE_SIZE;
            const entry: PngChunkEntry = {
                fileName: '',
                chunkColumn,
                chunkRow,
                sourceTileX,
                sourceTileY,
                tileWidth,
                tileHeight,
                pixelX,
                pixelY,
                pixelWidth,
                pixelHeight
            };
            entry.fileName = buildPngChunkFileName(config.sourceName, entry);
            if (chunkCanvas.width !== pixelWidth) {
                chunkCanvas.width = pixelWidth;
            }
            if (chunkCanvas.height !== pixelHeight) {
                chunkCanvas.height = pixelHeight;
            }
            chunkContext.imageSmoothingEnabled = false;
            chunkContext.clearRect(0, 0, chunkCanvas.width, chunkCanvas.height);
            chunkContext.drawImage(
                config.image,
                pixelX,
                pixelY,
                pixelWidth,
                pixelHeight,
                0,
                0,
                pixelWidth,
                pixelHeight
            );
            const shouldWrite = !config.skipEmpty || !isImageDataEmpty(
                chunkContext.getImageData(0, 0, pixelWidth, pixelHeight)
            );
            if (shouldWrite) {
                const blob = await canvasToBlob(chunkCanvas);
                await writeBlobToDirectory(directoryHandle, entry.fileName, blob);
                chunks.push(entry);
                exportedChunks += 1;
            } else {
                skippedChunks += 1;
            }
            processedChunks += 1;
            const shouldReportProgress = processedChunks === totalChunkCount ||
                processedChunks - lastYieldAt >= progressStep;
            if (onProgress && shouldReportProgress) {
                await onProgress({
                    phase: 'Exporting chunk PNGs',
                    completed: processedChunks,
                    total: totalChunkCount,
                    detail: `Processed ${processedChunks} of ${totalChunkCount} chunks. Exported ${exportedChunks}, skipped ${skippedChunks}. Current chunk: row ${chunkRow + 1}, column ${chunkColumn + 1}.`
                });
            }
            if (shouldReportProgress) {
                lastYieldAt = processedChunks;
                await yieldToUi();
            }
        }
    }

    const manifest: PngChunkManifest = {
        version: 1,
        sourceName: config.sourceName,
        tileSize: PNG_IMPORT_SOURCE_TILE_SIZE,
        crop: {
            x: config.sourceX,
            y: config.sourceY,
            width: config.sourceWidth,
            height: config.sourceHeight
        },
        chunkTileWidth: config.chunkTileWidth,
        chunkTileHeight: config.chunkTileHeight,
        totalSourceColumns,
        totalSourceRows,
        totalChunkColumns,
        totalChunkRows,
        chunks
    };
    await writeTextToDirectory(
        directoryHandle,
        PNG_CHUNK_EXPORT_MANIFEST_NAME,
        `${JSON.stringify(manifest, null, 2)}\n`
    );
    return {
        directoryName: directoryHandle.name,
        manifest,
        exportedChunks: chunks.length,
        skippedChunks,
        totalChunkCount
    };
}

export async function readPngChunkFolderSelection(
    directoryHandle: BrowserDirectoryHandle,
    onProgress?: (progress: PngImportProgress) => void | Promise<void>
) {
    const files = new Map<string, File>();
    let processedEntries = 0;
    for await (const entry of directoryHandle.values()) {
        processedEntries += 1;
        if (entry.kind === 'file') {
            files.set(entry.name, await entry.getFile());
        }
        if (onProgress) {
            await onProgress({
                phase: 'Reading chunk folder',
                completed: processedEntries,
                total: Math.max(processedEntries, 1),
                detail: `Scanning ${entry.name}.`
            });
        }
    }
    const manifestFile = files.get(PNG_CHUNK_EXPORT_MANIFEST_NAME);
    let manifest: PngChunkManifest;
    if (manifestFile) {
        manifest = normalizePngChunkManifest(JSON.parse(await manifestFile.text()));
    } else {
        const parsedEntries = [...files.keys()]
            .filter((name) => name.toLowerCase().endsWith('.png'))
            .map((name) => parsePngChunkFileName(name))
            .filter((entry): entry is PngChunkEntry => entry !== null);
        manifest = buildChunkManifestFromFiles(directoryHandle.name, parsedEntries);
    }
    for (const chunk of manifest.chunks) {
        if (!files.has(chunk.fileName)) {
            throw new Error(`Chunk folder is missing ${chunk.fileName}, which is referenced by the manifest.`);
        }
    }
    const emptyChunkFileNames = new Set<string>();
    for (let index = 0; index < manifest.chunks.length; index += 1) {
        const chunk = manifest.chunks[index];
        const file = files.get(chunk.fileName);
        if (!file) {
            continue;
        }
        if (await isChunkFileEmpty(file)) {
            emptyChunkFileNames.add(chunk.fileName);
        }
        if (onProgress) {
            await onProgress({
                phase: 'Checking chunk occupancy',
                completed: index + 1,
                total: manifest.chunks.length,
                detail: `Inspecting ${chunk.fileName}.`
            });
        }
    }
    return {
        directoryName: directoryHandle.name,
        manifest,
        files,
        emptyChunkFileNames
    };
}

export function getPngChunkSelectionEntries(
    selection: PngChunkFolderSelection,
    range: PngChunkSelectionRange
) {
    const filteredChunks = selection.manifest.chunks
        .filter((chunk) => (
            chunk.chunkColumn >= range.minChunkColumn &&
            chunk.chunkColumn <= range.maxChunkColumn &&
            chunk.chunkRow >= range.minChunkRow &&
            chunk.chunkRow <= range.maxChunkRow
        ))
        .sort((left, right) => (
            left.chunkRow === right.chunkRow
                ? left.chunkColumn - right.chunkColumn
                : left.chunkRow - right.chunkRow
        ));
    const totalSelectedChunks = filteredChunks.length;
    const limitedChunks = range.maxChunks > 0
        ? filteredChunks
            .filter((chunk) => !selection.emptyChunkFileNames.has(chunk.fileName))
            .slice(0, range.maxChunks)
        : filteredChunks;
    return {
        selectedChunks: limitedChunks,
        totalSelectedChunks
    };
}

export async function composePngChunkFolderSource(
    selection: PngChunkFolderSelection,
    range: PngChunkSelectionRange,
    onProgress?: (progress: PngImportProgress) => void | Promise<void>
) {
    const { selectedChunks, totalSelectedChunks } = getPngChunkSelectionEntries(selection, range);
    if (selectedChunks.length === 0) {
        throw new Error('The selected chunk range did not include any exported PNG chunks.');
    }
    const cropTileOriginX = Math.round(selection.manifest.crop.x / PNG_IMPORT_SOURCE_TILE_SIZE);
    const cropTileOriginY = Math.round(selection.manifest.crop.y / PNG_IMPORT_SOURCE_TILE_SIZE);
    const columns = selection.manifest.totalSourceColumns;
    const rows = selection.manifest.totalSourceRows;
    // Track tile occupancy so the importer can skip untouched tiles when stitching partial chunk ranges.
    const activeTileIndexes = new Set<number>();
    for (const chunk of selectedChunks) {
        const startColumn = chunk.sourceTileX - cropTileOriginX;
        const startRow = chunk.sourceTileY - cropTileOriginY;
        for (let row = 0; row < chunk.tileHeight; row += 1) {
            for (let column = 0; column < chunk.tileWidth; column += 1) {
                activeTileIndexes.add((startRow + row) * columns + startColumn + column);
            }
        }
    }
    const canvas = document.createElement('canvas');
    canvas.width = columns * PNG_IMPORT_SOURCE_TILE_SIZE;
    canvas.height = rows * PNG_IMPORT_SOURCE_TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not create a canvas context for chunk composition.');
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < selectedChunks.length; index += 1) {
        const chunk = selectedChunks[index];
        const file = selection.files.get(chunk.fileName);
        if (!file) {
            throw new Error(`The chunk folder is missing ${chunk.fileName}.`);
        }
        const bitmap = await createImageBitmap(file);
        const destinationX = (chunk.sourceTileX - cropTileOriginX) * PNG_IMPORT_SOURCE_TILE_SIZE;
        const destinationY = (chunk.sourceTileY - cropTileOriginY) * PNG_IMPORT_SOURCE_TILE_SIZE;
        ctx.drawImage(bitmap, destinationX, destinationY);
        bitmap.close();
        if (onProgress) {
            await onProgress({
                phase: 'Composing chunk folder',
                completed: index + 1,
                total: selectedChunks.length,
                detail: `Placed ${chunk.fileName}.`
            });
            await yieldToUi();
        }
    }
    const image = await loadImageFromBlob(await canvasToBlob(canvas));
    return {
        image,
        manifest: selection.manifest,
        selectedChunks,
        chunkCount: selectedChunks.length,
        totalSelectedChunks,
        sourceWidth: canvas.width,
        sourceHeight: canvas.height,
        columns,
        rows,
        activeTileIndexes
    };
}
