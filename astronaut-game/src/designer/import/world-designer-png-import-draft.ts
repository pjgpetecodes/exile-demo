import { MapBlock } from '../../world/map.js';
import { SPRITE_TRANSLATION_OPTIONS, type SpriteTranslation } from '../../shared/utilities.js';

import type {
    PngImportCandidate,
    PngImportDraft,
    PngImportProgress,
    PngImportSampleSignature,
    PngImportTileMatch,
    RawWorldData,
    WorldDesignerHost
} from '../core/world-designer-types.js';

const PNG_IMPORT_SAMPLE_SIZE = 32;
const PNG_IMPORT_WARNING_SCORE = 58;
const PNG_IMPORT_PALETTE_SCORE_WEIGHT = 0.2;
const PNG_IMPORT_MAX_TILES = 4096;
const PNG_IMPORT_PREVIEW_MAX_DIMENSION = 960;
const PNG_IMPORT_PREVIEW_MIN_TILE_SIZE = 18;
const PNG_IMPORT_PREVIEW_MAX_TILE_SIZE = 48;

type PngImportDraftBuildConfig = {
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
    worldX: number;
    worldY: number;
    worldWidth: number;
    worldHeight: number;
    activeTileIndexes?: Set<number>;
    allowGridOffsetInference?: boolean;
};

type PngImportDraftBuildFromPngConfig = PngImportDraftBuildConfig & {
    url: string;
    replaceExisting: boolean;
};

type CreateWorldDesignerPngImportDraftApiOptions = {
    host: WorldDesignerHost;
    getPaletteCount: () => number;
    getPngImportTypeNames: (snapshot: RawWorldData) => string[];
    getPngImportTypeDefaults: (snapshot: RawWorldData) => Map<string, { collision: boolean; maskAstronaut: boolean }>;
    getPngImportSourceTileCount: (size: number) => number;
    clamp: (value: number, min: number, max: number) => number;
    normalizeRotation: (value: number | undefined) => number;
    yieldToUi: () => Promise<void>;
};

export type WorldDesignerPngImportDraftApi = {
    loadImage: (url: string) => Promise<HTMLImageElement>;
    getPngImportPreviewTileSize: (columns: number, rows: number) => number;
    buildPngImportDraftFromImage: (
        image: HTMLImageElement,
        config: PngImportDraftBuildConfig,
        onProgress?: (progress: PngImportProgress) => void | Promise<void>
    ) => Promise<PngImportDraft>;
    buildPngImportDraftFromPng: (
        config: PngImportDraftBuildFromPngConfig,
        onProgress?: (progress: PngImportProgress) => void | Promise<void>
    ) => Promise<PngImportDraft>;
};

export function createWorldDesignerPngImportDraftApi(
    options: CreateWorldDesignerPngImportDraftApiOptions
): WorldDesignerPngImportDraftApi {
    const {
        host,
        getPaletteCount,
        getPngImportTypeNames,
        getPngImportTypeDefaults,
        getPngImportSourceTileCount,
        clamp,
        normalizeRotation,
        yieldToUi
    } = options;
    const pngImportImageCache = new Map<string, Promise<HTMLImageElement>>();
    let pngImportCandidateCache: { key: string; candidates: PngImportCandidate[] } | null = null;

    function isBackgroundSamplePixel(sample: Uint8ClampedArray, index: number) {
        return sample[index] === 0 &&
            sample[index + 1] === 0 &&
            sample[index + 2] === 0;
    }

    function isSameSampleColor(sample: Uint8ClampedArray, leftIndex: number, rightIndex: number) {
        return sample[leftIndex] === sample[rightIndex] &&
            sample[leftIndex + 1] === sample[rightIndex + 1] &&
            sample[leftIndex + 2] === sample[rightIndex + 2];
    }

    function getSampleColorKey(sample: Uint8ClampedArray, index: number) {
        return `${sample[index]},${sample[index + 1]},${sample[index + 2]}`;
    }

    function getSampleForegroundBounds(sample: Uint8ClampedArray) {
        let minX = PNG_IMPORT_SAMPLE_SIZE;
        let minY = PNG_IMPORT_SAMPLE_SIZE;
        let maxX = -1;
        let maxY = -1;

        for (let row = 0; row < PNG_IMPORT_SAMPLE_SIZE; row += 1) {
            for (let column = 0; column < PNG_IMPORT_SAMPLE_SIZE; column += 1) {
                const pixelIndex = (row * PNG_IMPORT_SAMPLE_SIZE + column) * 4;
                if (isBackgroundSamplePixel(sample, pixelIndex)) {
                    continue;
                }
                minX = Math.min(minX, column);
                minY = Math.min(minY, row);
                maxX = Math.max(maxX, column);
                maxY = Math.max(maxY, row);
            }
        }

        if (maxX < 0 || maxY < 0) {
            return null;
        }

        return {
            minX,
            minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }

    function buildPaletteInvariantLabelMap(sample: Uint8ClampedArray) {
        const labels = new Uint16Array(sample.length / 4);
        const colorLabels = new Map<string, number>();
        let nextLabel = 1;

        for (let pixel = 0; pixel < labels.length; pixel += 1) {
            const index = pixel * 4;
            if (isBackgroundSamplePixel(sample, index)) {
                labels[pixel] = 0;
                continue;
            }

            const colorKey = getSampleColorKey(sample, index);
            let label = colorLabels.get(colorKey);
            if (!label) {
                label = nextLabel;
                colorLabels.set(colorKey, label);
                nextLabel += 1;
            }
            labels[pixel] = label;
        }

        return labels;
    }

    function hashUint8Array(data: Uint8ClampedArray) {
        let hash = 2166136261;
        for (let index = 0; index < data.length; index += 1) {
            hash ^= data[index];
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function hashUint16Array(data: Uint16Array) {
        let hash = 2166136261;
        for (let index = 0; index < data.length; index += 1) {
            hash ^= data[index];
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function normalizeSampleToForegroundOrigin(
        sample: Uint8ClampedArray,
        bounds: ReturnType<typeof getSampleForegroundBounds> = getSampleForegroundBounds(sample)
    ) {
        const normalizedSample = new Uint8ClampedArray(sample.length);
        if (!bounds) {
            return normalizedSample;
        }

        for (let row = 0; row < bounds.height; row += 1) {
            for (let column = 0; column < bounds.width; column += 1) {
                const sourceIndex = ((bounds.minY + row) * PNG_IMPORT_SAMPLE_SIZE + bounds.minX + column) * 4;
                const targetIndex = (row * PNG_IMPORT_SAMPLE_SIZE + column) * 4;
                normalizedSample[targetIndex] = sample[sourceIndex];
                normalizedSample[targetIndex + 1] = sample[sourceIndex + 1];
                normalizedSample[targetIndex + 2] = sample[sourceIndex + 2];
                normalizedSample[targetIndex + 3] = sample[sourceIndex + 3];
            }
        }

        return normalizedSample;
    }

    function buildPngImportSampleSignature(sample: Uint8ClampedArray): PngImportSampleSignature {
        const foregroundBounds = getSampleForegroundBounds(sample);
        const normalizedSample = normalizeSampleToForegroundOrigin(sample, foregroundBounds);
        const normalizedLabels = buildPaletteInvariantLabelMap(normalizedSample);
        let foregroundPixelCount = 0;
        for (let pixel = 0; pixel < normalizedLabels.length; pixel += 1) {
            if (normalizedLabels[pixel] !== 0) {
                foregroundPixelCount += 1;
            }
        }
        const sampleHash = hashUint8Array(normalizedSample).toString(36);
        const labelHash = hashUint16Array(normalizedLabels).toString(36);
        const matchKey = foregroundBounds
            ? `${foregroundPixelCount}:${foregroundBounds.minX},${foregroundBounds.minY},${foregroundBounds.width},${foregroundBounds.height}:${sampleHash}:${labelHash}`
            : `empty:${sampleHash}:${labelHash}`;

        return {
            normalizedSample,
            normalizedLabels,
            foregroundPixelCount,
            matchKey,
            foregroundBounds
        };
    }

    function renderPngImportSourceSample(
        sourceContext: CanvasRenderingContext2D,
        image: HTMLImageElement,
        tileSourceX: number,
        tileSourceY: number,
        tileSourceWidth: number,
        tileSourceHeight: number
    ) {
        sourceContext.fillStyle = '#000';
        sourceContext.fillRect(0, 0, sourceContext.canvas.width, sourceContext.canvas.height);

        const sourceLeft = Math.max(0, tileSourceX);
        const sourceTop = Math.max(0, tileSourceY);
        const sourceRight = Math.min(image.width, tileSourceX + tileSourceWidth);
        const sourceBottom = Math.min(image.height, tileSourceY + tileSourceHeight);
        const boundedWidth = sourceRight - sourceLeft;
        const boundedHeight = sourceBottom - sourceTop;
        if (boundedWidth <= 0 || boundedHeight <= 0) {
            return;
        }

        const destinationX = ((sourceLeft - tileSourceX) / tileSourceWidth) * sourceContext.canvas.width;
        const destinationY = ((sourceTop - tileSourceY) / tileSourceHeight) * sourceContext.canvas.height;
        const destinationWidth = (boundedWidth / tileSourceWidth) * sourceContext.canvas.width;
        const destinationHeight = (boundedHeight / tileSourceHeight) * sourceContext.canvas.height;

        sourceContext.drawImage(
            image,
            sourceLeft,
            sourceTop,
            boundedWidth,
            boundedHeight,
            destinationX,
            destinationY,
            destinationWidth,
            destinationHeight
        );
    }

    function getMedianNumber(values: number[]) {
        if (values.length === 0) {
            return 0;
        }
        const sortedValues = [...values].sort((left, right) => left - right);
        const middleIndex = Math.floor(sortedValues.length / 2);
        if (sortedValues.length % 2 === 1) {
            return sortedValues[middleIndex];
        }
        return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
    }

    function getPngImportTranslatedBounds(
        bounds: NonNullable<PngImportSampleSignature['foregroundBounds']>,
        translation: SpriteTranslation
    ) {
        if (translation === 'top') {
            return {
                minX: bounds.minX,
                minY: 0,
                width: bounds.width,
                height: bounds.height
            };
        }
        if (translation === 'right') {
            return {
                minX: PNG_IMPORT_SAMPLE_SIZE - bounds.width,
                minY: bounds.minY,
                width: bounds.width,
                height: bounds.height
            };
        }
        if (translation === 'bottom') {
            return {
                minX: bounds.minX,
                minY: PNG_IMPORT_SAMPLE_SIZE - bounds.height,
                width: bounds.width,
                height: bounds.height
            };
        }
        if (translation === 'left') {
            return {
                minX: 0,
                minY: bounds.minY,
                width: bounds.width,
                height: bounds.height
            };
        }
        return bounds;
    }

    function getPngImportForegroundBoundsDifference(
        left: NonNullable<PngImportSampleSignature['foregroundBounds']>,
        right: NonNullable<PngImportSampleSignature['foregroundBounds']>
    ) {
        const leftMaxX = left.minX + left.width - 1;
        const leftMaxY = left.minY + left.height - 1;
        const rightMaxX = right.minX + right.width - 1;
        const rightMaxY = right.minY + right.height - 1;
        return Math.abs(left.minX - right.minX) +
            Math.abs(left.minY - right.minY) +
            Math.abs(leftMaxX - rightMaxX) +
            Math.abs(leftMaxY - rightMaxY);
    }

    function inferPngImportTranslation(
        sourceSignature: PngImportSampleSignature,
        candidateSignature: PngImportSampleSignature
    ): SpriteTranslation {
        const sourceBounds = sourceSignature.foregroundBounds;
        const candidateBounds = candidateSignature.foregroundBounds;
        if (!sourceBounds || !candidateBounds) {
            return 'center';
        }

        let bestTranslation: SpriteTranslation = 'center';
        let bestDifference = Number.POSITIVE_INFINITY;
        let centerDifference = Number.POSITIVE_INFINITY;

        for (const translation of SPRITE_TRANSLATION_OPTIONS) {
            const translatedBounds = getPngImportTranslatedBounds(candidateBounds, translation);
            const difference = getPngImportForegroundBoundsDifference(sourceBounds, translatedBounds);
            if (translation === 'center') {
                centerDifference = difference;
            }
            if (difference < bestDifference) {
                bestDifference = difference;
                bestTranslation = translation;
            }
        }

        return bestTranslation !== 'center' && bestDifference >= centerDifference
            ? 'center'
            : bestTranslation;
    }

    function compareImageData(leftSignature: PngImportSampleSignature, rightSignature: PngImportSampleSignature) {
        if (leftSignature.foregroundPixelCount === 0 || rightSignature.foregroundPixelCount === 0) {
            return leftSignature.foregroundPixelCount === rightSignature.foregroundPixelCount
                ? 0
                : Number.POSITIVE_INFINITY;
        }

        const left = leftSignature.normalizedSample;
        const right = rightSignature.normalizedSample;
        const sampleWidth = PNG_IMPORT_SAMPLE_SIZE;
        const sampleHeight = PNG_IMPORT_SAMPLE_SIZE;
        const leftLabels = leftSignature.normalizedLabels;
        const rightLabels = rightSignature.normalizedLabels;
        let totalDifference = 0;
        let comparisonCount = 0;
        let totalPaletteDifference = 0;
        let paletteComparisonCount = 0;

        for (let row = 0; row < sampleHeight; row += 1) {
            for (let column = 0; column < sampleWidth; column += 1) {
                const pixelIndex = (row * sampleWidth + column) * 4;
                const pixelNumber = row * sampleWidth + column;
                const leftIsBackground = isBackgroundSamplePixel(left, pixelIndex);
                const rightIsBackground = isBackgroundSamplePixel(right, pixelIndex);
                totalDifference += leftIsBackground === rightIsBackground ? 0 : 255;
                comparisonCount += 1;

                totalDifference += leftLabels[pixelNumber] === rightLabels[pixelNumber] ? 0 : 255;
                comparisonCount += 1;

                if (!leftIsBackground && !rightIsBackground) {
                    totalPaletteDifference += (
                        Math.abs(left[pixelIndex] - right[pixelIndex]) +
                        Math.abs(left[pixelIndex + 1] - right[pixelIndex + 1]) +
                        Math.abs(left[pixelIndex + 2] - right[pixelIndex + 2])
                    ) / 3;
                    paletteComparisonCount += 1;
                }

                if (column < sampleWidth - 1) {
                    const rightPixelIndex = pixelIndex + 4;
                    const rightPixelNumber = pixelNumber + 1;
                    const leftHorizontalMatch = isSameSampleColor(left, pixelIndex, rightPixelIndex);
                    const rightHorizontalMatch = isSameSampleColor(right, pixelIndex, rightPixelIndex);
                    totalDifference += leftHorizontalMatch === rightHorizontalMatch ? 0 : 255;
                    comparisonCount += 1;
                    totalDifference += (leftLabels[pixelNumber] === leftLabels[rightPixelNumber]) ===
                        (rightLabels[pixelNumber] === rightLabels[rightPixelNumber]) ? 0 : 255;
                    comparisonCount += 1;
                }

                if (row < sampleHeight - 1) {
                    const belowPixelIndex = pixelIndex + sampleWidth * 4;
                    const belowPixelNumber = pixelNumber + sampleWidth;
                    const leftVerticalMatch = isSameSampleColor(left, pixelIndex, belowPixelIndex);
                    const rightVerticalMatch = isSameSampleColor(right, pixelIndex, belowPixelIndex);
                    totalDifference += leftVerticalMatch === rightVerticalMatch ? 0 : 255;
                    comparisonCount += 1;
                    totalDifference += (leftLabels[pixelNumber] === leftLabels[belowPixelNumber]) ===
                        (rightLabels[pixelNumber] === rightLabels[belowPixelNumber]) ? 0 : 255;
                    comparisonCount += 1;
                }
            }
        }

        const structuralScore = comparisonCount > 0 ? totalDifference / comparisonCount : Number.POSITIVE_INFINITY;
        if (!Number.isFinite(structuralScore)) {
            return structuralScore;
        }
        const paletteScore = paletteComparisonCount > 0
            ? totalPaletteDifference / paletteComparisonCount
            : 255;
        return structuralScore + (paletteScore * PNG_IMPORT_PALETTE_SCORE_WEIGHT);
    }

    function matchPngImportSample(
        sourceSample: Uint8ClampedArray,
        candidates: PngImportCandidate[],
        column: number,
        row: number,
        sourceSignature: PngImportSampleSignature = buildPngImportSampleSignature(sourceSample)
    ): PngImportTileMatch {
        let bestCandidate = candidates[0];
        let bestScore = Number.POSITIVE_INFINITY;

        for (const candidate of candidates) {
            const score = compareImageData(sourceSignature, candidate.signature);
            if (score < bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }

        return {
            bestCandidate,
            bestScore,
            sourceSignature,
            inferredTranslation: inferPngImportTranslation(sourceSignature, bestCandidate.signature),
            column,
            row
        };
    }

    function inferPngImportSourceGridOffset(matches: PngImportTileMatch[]) {
        const offsetXValues: number[] = [];
        const offsetYValues: number[] = [];

        for (const match of matches) {
            const sourceBounds = match.sourceSignature.foregroundBounds;
            const candidateBounds = match.bestCandidate.signature.foregroundBounds;
            if (!sourceBounds || !candidateBounds) {
                continue;
            }
            if (!Number.isFinite(match.bestScore) || match.bestScore >= PNG_IMPORT_WARNING_SCORE * 1.5) {
                continue;
            }
            const hasPlacementSignal = sourceBounds.width < PNG_IMPORT_SAMPLE_SIZE ||
                sourceBounds.height < PNG_IMPORT_SAMPLE_SIZE ||
                candidateBounds.width < PNG_IMPORT_SAMPLE_SIZE ||
                candidateBounds.height < PNG_IMPORT_SAMPLE_SIZE;
            if (!hasPlacementSignal) {
                continue;
            }
            offsetXValues.push(sourceBounds.minX - candidateBounds.minX);
            offsetYValues.push(sourceBounds.minY - candidateBounds.minY);
        }

        return {
            x: clamp(Math.round(getMedianNumber(offsetXValues)), -PNG_IMPORT_SAMPLE_SIZE + 1, PNG_IMPORT_SAMPLE_SIZE - 1),
            y: clamp(Math.round(getMedianNumber(offsetYValues)), -PNG_IMPORT_SAMPLE_SIZE + 1, PNG_IMPORT_SAMPLE_SIZE - 1)
        };
    }

    function loadImage(url: string) {
        const cached = pngImportImageCache.get(url);
        if (cached) {
            return cached;
        }
        const promise = new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => {
                pngImportImageCache.delete(url);
                reject(new Error(`Failed to load PNG at ${url}. Use a browser-served path such as ./src/assets/images/maps/MAP-Exile-BC.png.`));
            };
            image.src = url;
        });
        pngImportImageCache.set(url, promise);
        return promise;
    }

    function getPngImportPreviewTileSize(columns: number, rows: number) {
        const largestDimension = Math.max(columns, rows, 1);
        return clamp(
            Math.floor(PNG_IMPORT_PREVIEW_MAX_DIMENSION / largestDimension),
            PNG_IMPORT_PREVIEW_MIN_TILE_SIZE,
            PNG_IMPORT_PREVIEW_MAX_TILE_SIZE
        );
    }

    async function buildPngImportCandidates(
        onProgress?: (progress: PngImportProgress) => void | Promise<void>
    ) {
        const snapshot = host.getRawWorldData();
        const typeDefaults = getPngImportTypeDefaults(snapshot);
        const typeNames = getPngImportTypeNames(snapshot);
        const paletteCount = Math.max(1, Math.round(getPaletteCount()));
        const candidateKey = JSON.stringify({
            paletteCount,
            typeNames,
            typeDefaults: typeNames.map((type) => {
                const defaults = typeDefaults.get(type) ?? { collision: true, maskAstronaut: false };
                return [type, defaults.collision, defaults.maskAstronaut];
            })
        });
        if (pngImportCandidateCache?.key === candidateKey) {
            if (onProgress) {
                await onProgress({
                    phase: 'Preparing sprite candidates',
                    completed: 1,
                    total: 1,
                    detail: 'Reusing cached sprite candidates.'
                });
            }
            return pngImportCandidateCache.candidates;
        }

        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = PNG_IMPORT_SAMPLE_SIZE;
        sampleCanvas.height = PNG_IMPORT_SAMPLE_SIZE;
        const sampleContext = sampleCanvas.getContext('2d');
        if (!sampleContext) {
            throw new Error('Could not create a canvas context for PNG import.');
        }
        sampleContext.imageSmoothingEnabled = false;

        const candidates: PngImportCandidate[] = [];
        const totalCandidateRenders = Math.max(1, typeNames.length * paletteCount * 7);
        let processedCandidateRenders = 0;
        let lastYield = 0;

        for (const type of typeNames) {
            const defaults = typeDefaults.get(type) ?? { collision: true, maskAstronaut: false };
            for (let palette = 0; palette < paletteCount; palette += 1) {
                for (let rotation = 1; rotation <= 7; rotation += 1) {
                    processedCandidateRenders += 1;
                    sampleContext.fillStyle = '#000';
                    sampleContext.fillRect(0, 0, sampleCanvas.width, sampleCanvas.height);
                    const rendered = host.drawSpriteSample(
                        sampleContext,
                        type,
                        palette,
                        rotation,
                        false,
                        PNG_IMPORT_SAMPLE_SIZE
                    );
                    if (!rendered) {
                        continue;
                    }
                    const candidateSample = new Uint8ClampedArray(
                        sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data
                    );
                    candidates.push({
                        type,
                        palette,
                        rotation,
                        collision: defaults.collision,
                        maskAstronaut: defaults.maskAstronaut,
                        signature: buildPngImportSampleSignature(candidateSample)
                    });
                    if (onProgress && (
                        processedCandidateRenders === totalCandidateRenders ||
                        processedCandidateRenders - lastYield >= Math.max(8, Math.floor(totalCandidateRenders / 20))
                    )) {
                        lastYield = processedCandidateRenders;
                        await onProgress({
                            phase: 'Preparing sprite candidates',
                            completed: processedCandidateRenders,
                            total: totalCandidateRenders,
                            detail: `Rendering ${type} palette ${palette}, rotation ${rotation}.`
                        });
                        await yieldToUi();
                    }
                }
            }
        }

        if (candidates.length === 0) {
            throw new Error('PNG import could not build any world-tile candidates from the current sprite catalog.');
        }

        pngImportCandidateCache = {
            key: candidateKey,
            candidates
        };
        return candidates;
    }

    async function buildPngImportDraftFromImage(
        image: HTMLImageElement,
        config: PngImportDraftBuildConfig,
        onProgress?: (progress: PngImportProgress) => void | Promise<void>
    ) {
        const worldWidth = Math.max(1, Math.round(config.worldWidth));
        const worldHeight = Math.max(1, Math.round(config.worldHeight));
        const worldX = Math.round(config.worldX);
        const worldY = Math.round(config.worldY);

        const sourceWidth = Math.max(1, Math.round(config.sourceWidth));
        const sourceHeight = Math.max(1, Math.round(config.sourceHeight));
        if (onProgress) {
            await onProgress({
                phase: 'Preparing PNG source',
                completed: 1,
                total: 1,
                detail: 'Using the prepared source image for matching.'
            });
            await yieldToUi();
        }
        const sourceX = clamp(Math.round(config.sourceX), 0, Math.max(0, image.width - 1));
        const sourceY = clamp(Math.round(config.sourceY), 0, Math.max(0, image.height - 1));
        const boundedSourceWidth = Math.min(sourceWidth, image.width - sourceX);
        const boundedSourceHeight = Math.min(sourceHeight, image.height - sourceY);

        if (boundedSourceWidth <= 0 || boundedSourceHeight <= 0) {
            throw new Error('The selected PNG source region is outside the image bounds.');
        }

        const columns = getPngImportSourceTileCount(boundedSourceWidth);
        const rows = getPngImportSourceTileCount(boundedSourceHeight);
        const tileIndexes = config.activeTileIndexes
            ? [...config.activeTileIndexes].sort((left, right) => left - right)
            : Array.from({ length: columns * rows }, (_, index) => index);
        const tileCount = tileIndexes.length;
        if (!config.activeTileIndexes && tileCount > PNG_IMPORT_MAX_TILES) {
            throw new Error(`PNG import is limited to ${PNG_IMPORT_MAX_TILES} tiles per pass. Reduce the region size and try again.`);
        }
        const matchingBatchSize = config.activeTileIndexes ? PNG_IMPORT_MAX_TILES : tileCount;
        const worldTileWidth = worldWidth / columns;
        const worldTileHeight = worldHeight / rows;

        const candidates = await buildPngImportCandidates(onProgress);
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = PNG_IMPORT_SAMPLE_SIZE;
        sourceCanvas.height = PNG_IMPORT_SAMPLE_SIZE;
        const sourceContext = sourceCanvas.getContext('2d');
        if (!sourceContext) {
            throw new Error('Could not create a source canvas for PNG import.');
        }
        sourceContext.imageSmoothingEnabled = false;
        const sourceImageData = sourceContext.createImageData(sourceCanvas.width, sourceCanvas.height);
        const tileSourceWidth = boundedSourceWidth / columns;
        const tileSourceHeight = boundedSourceHeight / rows;
        const matchCache = new Map<string, {
            bestCandidate: PngImportCandidate;
            bestScore: number;
            sourceSignature: PngImportSampleSignature;
            inferredTranslation: SpriteTranslation;
        }>();

        const runMatchingPass = async (
            gridOffsetX: number,
            gridOffsetY: number,
            phase: string
        ) => {
            const importedBlocks: Array<MapBlock | null> = new Array<MapBlock | null>(columns * rows).fill(null);
            const tileMatches: PngImportTileMatch[] = [];
            let uncertainTiles = 0;
            const lowConfidenceTileIndexes: number[] = [];
            let processedTiles = 0;

            for (let batchStart = 0; batchStart < tileIndexes.length; batchStart += matchingBatchSize) {
                const batchTileIndexes = tileIndexes.slice(batchStart, batchStart + matchingBatchSize);
                for (const tileIndex of batchTileIndexes) {
                    const row = Math.floor(tileIndex / columns);
                    const column = tileIndex % columns;
                    const tileSourceY = sourceY + gridOffsetY + (row * tileSourceHeight);
                    const tileSourceX = sourceX + gridOffsetX + (column * tileSourceWidth);
                    renderPngImportSourceSample(
                        sourceContext,
                        image,
                        tileSourceX,
                        tileSourceY,
                        tileSourceWidth,
                        tileSourceHeight
                    );

                    sourceImageData.data.set(sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data);
                    const sourceSample = new Uint8ClampedArray(sourceImageData.data);
                    const sourceSignature = buildPngImportSampleSignature(sourceSample);
                    const cachedMatch = matchCache.get(sourceSignature.matchKey);
                    const tileMatch = cachedMatch
                        ? {
                            ...cachedMatch,
                            column,
                            row
                        }
                        : matchPngImportSample(sourceSample, candidates, column, row, sourceSignature);
                    if (!cachedMatch) {
                        matchCache.set(sourceSignature.matchKey, {
                            bestCandidate: tileMatch.bestCandidate,
                            bestScore: tileMatch.bestScore,
                            sourceSignature: tileMatch.sourceSignature,
                            inferredTranslation: tileMatch.inferredTranslation
                        });
                    }
                    tileMatches.push(tileMatch);

                    if (tileMatch.bestScore >= PNG_IMPORT_WARNING_SCORE) {
                        uncertainTiles += 1;
                        lowConfidenceTileIndexes.push(tileIndex);
                    }

                    importedBlocks[tileIndex] = {
                        x: Math.round(worldX + column * worldTileWidth),
                        y: Math.round(worldY + row * worldTileHeight),
                        type: tileMatch.bestCandidate.type,
                        collision: tileMatch.bestCandidate.collision,
                        maskAstronaut: tileMatch.bestCandidate.maskAstronaut,
                        palette: tileMatch.bestCandidate.palette,
                        rotation: normalizeRotation(tileMatch.bestCandidate.rotation) as MapBlock['rotation'],
                        translation: tileMatch.inferredTranslation
                    };
                    processedTiles += 1;
                }

                if (onProgress) {
                    await onProgress({
                        phase,
                        completed: processedTiles,
                        total: tileCount,
                        detail: config.activeTileIndexes
                            ? `Processed ${processedTiles} of ${tileCount} selected tiles.`
                            : `Processed ${processedTiles} of ${tileCount} tiles.`
                    });
                    await yieldToUi();
                }
            }

            return {
                importedBlocks,
                tileMatches,
                uncertainTiles,
                lowConfidenceTileIndexes
            };
        };

        const initialPass = await runMatchingPass(0, 0, 'Matching source tiles');
        const shouldInferGridOffset = config.allowGridOffsetInference !== false;
        const inferredGridOffset = shouldInferGridOffset
            ? inferPngImportSourceGridOffset(initialPass.tileMatches)
            : { x: 0, y: 0 };
        const finalPass = shouldInferGridOffset && (inferredGridOffset.x !== 0 || inferredGridOffset.y !== 0)
            ? await runMatchingPass(inferredGridOffset.x, inferredGridOffset.y, 'Refining source alignment')
            : initialPass;

        return {
            blocks: finalPass.importedBlocks,
            columns,
            rows,
            worldX,
            worldY,
            worldWidth,
            worldHeight,
            uncertainTiles: finalPass.uncertainTiles,
            lowConfidenceTileIndexes: finalPass.lowConfidenceTileIndexes,
            sourceGridOffsetX: inferredGridOffset.x,
            sourceGridOffsetY: inferredGridOffset.y
        };
    }

    async function buildPngImportDraftFromPng(
        config: PngImportDraftBuildFromPngConfig,
        onProgress?: (progress: PngImportProgress) => void | Promise<void>
    ) {
        const url = config.url.trim();
        if (!url) {
            throw new Error('Enter a PNG URL before importing.');
        }
        if (onProgress) {
            await onProgress({
                phase: 'Loading PNG',
                completed: 0,
                total: 1,
                detail: 'Loading PNG metadata and source image.'
            });
            await yieldToUi();
        }
        const image = await loadImage(url);
        return buildPngImportDraftFromImage(image, config, onProgress);
    }

    return {
        loadImage,
        getPngImportPreviewTileSize,
        buildPngImportDraftFromImage,
        buildPngImportDraftFromPng
    };
}
