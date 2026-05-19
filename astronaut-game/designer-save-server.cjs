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

    if (req.method !== 'POST' || req.url !== '/save-world-data') {
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
            validatePayload(payload);

            await Promise.all(
                Object.entries(ASSET_FILES).map(([key, filePath]) => writeJsonFile(filePath, payload[key]))
            );

            sendJson(res, 200, {
                ok: true,
                files: Object.values(ASSET_FILES).map((filePath) => path.basename(filePath))
            });
        } catch (error) {
            sendJson(res, 400, {
                error: error instanceof Error ? error.message : 'Failed to save world data.'
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
