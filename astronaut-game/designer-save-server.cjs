const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { PNG } = require('pngjs');

const PORT = 3001;
const ROOT = __dirname;
const ASSET_FILES = {
    worldMap: path.join(ROOT, 'src', 'assets', 'world_map.json'),
    buttons: path.join(ROOT, 'src', 'assets', 'buttons.json'),
    doors: path.join(ROOT, 'src', 'assets', 'doors.json'),
    creatures: path.join(ROOT, 'src', 'assets', 'creatures.json'),
    collectables: path.join(ROOT, 'src', 'assets', 'collectables.json'),
    teleporters: path.join(ROOT, 'src', 'assets', 'teleporters.json'),
    astronautStart: path.join(ROOT, 'src', 'assets', 'astronaut_start.json')
};
const PALETTES_FILE = path.join(ROOT, 'src', 'assets', 'palettes.json');
const COLORS_FILE = path.join(ROOT, 'src', 'assets', 'colors.json');
const SPRITE_MAP_FILE = path.join(ROOT, 'src', 'assets', 'exile_sprites_map.json');
const SPRITE_SHEET_FILE = path.join(ROOT, 'src', 'assets', 'sprite_sheet.png');

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(payload));
}

function validatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Request body must be a JSON object.');
    }

    for (const key of ['worldMap', 'buttons', 'doors', 'creatures', 'collectables', 'teleporters']) {
        if (!Array.isArray(payload[key])) {
            throw new Error(`Payload field "${key}" must be an array.`);
        }
    }

    if (
        !payload.astronautStart ||
        typeof payload.astronautStart !== 'object' ||
        typeof payload.astronautStart.x !== 'number' ||
        typeof payload.astronautStart.y !== 'number'
    ) {
        throw new Error('Payload field "astronautStart" must be an object with numeric x and y.');
    }
}

function validatePalettesPayload(payload) {
    if (!Array.isArray(payload)) {
        throw new Error('Palette payload must be an array.');
    }
    for (const [paletteIndex, palette] of payload.entries()) {
        if (!Array.isArray(palette)) {
            throw new Error(`Palette ${paletteIndex} must be an array.`);
        }
        for (const [entryIndex, entry] of palette.entries()) {
            if (!entry || typeof entry !== 'object' || typeof entry.from !== 'string' || typeof entry.to !== 'string') {
                throw new Error(`Palette ${paletteIndex} entry ${entryIndex} must be an object with string from/to values.`);
            }
        }
    }
}

async function writeJsonFile(filePath, value) {
    const tempPath = `${filePath}.tmp`;
    const json = `${JSON.stringify(value, null, 2)}\n`;
    await fs.writeFile(tempPath, json, 'utf8');
    await fs.rename(tempPath, filePath);
}

async function writeBinaryFile(filePath, value) {
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, value);
    await fs.rename(tempPath, filePath);
}

async function readJsonFile(filePath) {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function validateRgbTriplet(alias, value) {
    if (
        !Array.isArray(value) ||
        value.length !== 3 ||
        value.some((channel) => typeof channel !== 'number' || channel < 0 || channel > 255)
    ) {
        throw new Error(`Color alias "${alias}" must map to an RGB array with three 0-255 numbers.`);
    }
}

function getColorTargets(colorAliases) {
    return Object.entries(colorAliases).map(([alias, rgb]) => {
        validateRgbTriplet(alias, rgb);
        return {
            alias,
            rgb
        };
    });
}

function getSpriteRects(spriteMap) {
    const entries = Array.isArray(spriteMap) ? spriteMap.flat() : Object.values(spriteMap);
    return entries.filter((entry) =>
        entry &&
        typeof entry.x === 'number' &&
        typeof entry.y === 'number' &&
        typeof entry.w === 'number' &&
        typeof entry.h === 'number'
    );
}

function createSpriteMask(width, height, spriteRects) {
    const mask = new Uint8Array(width * height);
    for (const rect of spriteRects) {
        const startX = Math.max(0, Math.floor(rect.x));
        const startY = Math.max(0, Math.floor(rect.y));
        const endX = Math.min(width, Math.floor(rect.x + rect.w));
        const endY = Math.min(height, Math.floor(rect.y + rect.h));
        for (let y = startY; y < endY; y += 1) {
            for (let x = startX; x < endX; x += 1) {
                mask[(y * width) + x] = 1;
            }
        }
    }
    return mask;
}

function getNearestTargetColor(r, g, b, targets) {
    let bestTarget = targets[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const target of targets) {
        const distance =
            ((r - target.rgb[0]) ** 2) +
            ((g - target.rgb[1]) ** 2) +
            ((b - target.rgb[2]) ** 2);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestTarget = target;
        }
    }
    return bestTarget;
}

function normalizeSpriteSheetPng(png, spriteRects, colorAliases, dryRun) {
    const targets = getColorTargets(colorAliases);
    if (targets.length === 0) {
        throw new Error('colors.json must define at least one proper RGB color.');
    }

    const spriteMask = createSpriteMask(png.width, png.height, spriteRects);
    const replacementsByColor = new Map();
    let scannedPixels = 0;
    let changedPixels = 0;

    for (let y = 0; y < png.height; y += 1) {
        for (let x = 0; x < png.width; x += 1) {
            if (!spriteMask[(y * png.width) + x]) {
                continue;
            }

            const pixelIndex = ((y * png.width) + x) * 4;
            const alpha = png.data[pixelIndex + 3];
            if (alpha === 0) {
                continue;
            }

            scannedPixels += 1;
            const r = png.data[pixelIndex];
            const g = png.data[pixelIndex + 1];
            const b = png.data[pixelIndex + 2];
            const nearestTarget = getNearestTargetColor(r, g, b, targets);

            if (r === nearestTarget.rgb[0] && g === nearestTarget.rgb[1] && b === nearestTarget.rgb[2]) {
                continue;
            }

            changedPixels += 1;
            const replacementKey = `${r},${g},${b}->${nearestTarget.alias}`;
            const existing = replacementsByColor.get(replacementKey);
            if (existing) {
                existing.count += 1;
            } else {
                replacementsByColor.set(replacementKey, {
                    from: [r, g, b],
                    toAlias: nearestTarget.alias,
                    to: [...nearestTarget.rgb],
                    count: 1
                });
            }

            if (!dryRun) {
                png.data[pixelIndex] = nearestTarget.rgb[0];
                png.data[pixelIndex + 1] = nearestTarget.rgb[1];
                png.data[pixelIndex + 2] = nearestTarget.rgb[2];
            }
        }
    }

    return {
        spriteCount: spriteRects.length,
        scannedPixels,
        changedPixels,
        changedSourceColors: replacementsByColor.size,
        replacements: Array.from(replacementsByColor.values()).sort((left, right) => right.count - left.count)
    };
}

async function processSpriteSheetNormalization(dryRun) {
    const [colorAliases, spriteMap, spriteSheetBuffer] = await Promise.all([
        readJsonFile(COLORS_FILE),
        readJsonFile(SPRITE_MAP_FILE),
        fs.readFile(SPRITE_SHEET_FILE)
    ]);
    const png = PNG.sync.read(spriteSheetBuffer);
    const spriteRects = getSpriteRects(spriteMap);
    const report = normalizeSpriteSheetPng(png, spriteRects, colorAliases, dryRun);

    if (!dryRun && report.changedPixels > 0) {
        await writeBinaryFile(SPRITE_SHEET_FILE, PNG.sync.write(png));
    }

    return report;
}

const server = http.createServer(async (req, res) => {
    if (!req.url) {
        sendJson(res, 400, { error: 'Missing request URL.' });
        return;
    }

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method !== 'POST' || !['/save-world-data', '/save-designer-assets', '/normalize-sprite-sheet'].includes(req.url)) {
        sendJson(res, 404, { error: 'Not found.' });
        return;
    }

    let body = '';
    req.on('data', (chunk) => {
        body += chunk.toString();
        if (body.length > 5_000_000) {
            req.destroy(new Error('Payload too large.'));
        }
    });

    req.on('error', (error) => {
        sendJson(res, 400, { error: error.message });
    });

    req.on('end', async () => {
        try {
            const payload = JSON.parse(body || '{}');
            const filesToWrite = [];

            if (req.url === '/normalize-sprite-sheet') {
                const dryRun = payload?.dryRun !== false;
                const report = await processSpriteSheetNormalization(dryRun);
                sendJson(res, 200, {
                    ok: true,
                    dryRun,
                    file: path.basename(SPRITE_SHEET_FILE),
                    report
                });
                return;
            }

            if (req.url === '/save-world-data') {
                validatePayload(payload);
                filesToWrite.push(
                    ...Object.entries(ASSET_FILES).map(([key, filePath]) => [filePath, payload[key]])
                );
            } else {
                if (!payload || typeof payload !== 'object') {
                    throw new Error('Request body must be a JSON object.');
                }
                validatePalettesPayload(payload.palettes);
                filesToWrite.push([PALETTES_FILE, payload.palettes]);
                if (payload.worldData !== undefined) {
                    validatePayload(payload.worldData);
                    filesToWrite.push(
                        ...Object.entries(ASSET_FILES).map(([key, filePath]) => [filePath, payload.worldData[key]])
                    );
                }
            }

            await Promise.all(filesToWrite.map(([filePath, value]) => writeJsonFile(filePath, value)));

            sendJson(res, 200, {
                ok: true,
                files: filesToWrite.map(([filePath]) => path.basename(filePath))
            });
        } catch (error) {
            sendJson(res, 400, {
                error: error instanceof Error ? error.message : 'Failed to save designer assets.'
            });
        }
    });
});

server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
        console.log(`World designer save server already running on http://localhost:${PORT}`);
        process.exit(0);
    }

    console.error(error);
    process.exit(1);
});

server.listen(PORT, () => {
    console.log(`World designer save server listening on http://localhost:${PORT}`);
});
