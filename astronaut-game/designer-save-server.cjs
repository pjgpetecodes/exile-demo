const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = 3001;
const ROOT = __dirname;
const ASSET_FILES = {
    worldMap: path.join(ROOT, 'src', 'assets', 'world_map.json'),
    buttons: path.join(ROOT, 'src', 'assets', 'buttons.json'),
    doors: path.join(ROOT, 'src', 'assets', 'doors.json'),
    creatures: path.join(ROOT, 'src', 'assets', 'creatures.json'),
    collectables: path.join(ROOT, 'src', 'assets', 'collectables.json'),
    astronautStart: path.join(ROOT, 'src', 'assets', 'astronaut_start.json')
};
const PALETTES_FILE = path.join(ROOT, 'src', 'assets', 'palettes.json');

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

    for (const key of ['worldMap', 'buttons', 'doors', 'creatures', 'collectables']) {
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

    if (req.method !== 'POST' || !['/save-world-data', '/save-designer-assets'].includes(req.url)) {
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
