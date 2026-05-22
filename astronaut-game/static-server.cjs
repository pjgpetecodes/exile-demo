const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.ico': 'image/x-icon'
};

function getMimeType(filePath) {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveRequestPath(urlPath) {
    const pathname = decodeURIComponent((urlPath || '/').split('?')[0]);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const absolutePath = path.resolve(ROOT, relativePath);
    if (!absolutePath.startsWith(ROOT)) {
        return null;
    }
    return absolutePath;
}

async function sendFile(res, filePath) {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
        return sendNotFound(res);
    }

    const file = await fs.readFile(filePath);
    res.writeHead(200, {
        'Content-Type': getMimeType(filePath),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
    });
    res.end(file);
}

function sendNotFound(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
}

function sendError(res, error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Server error: ${error.message}`);
}

const server = http.createServer(async (req, res) => {
    try {
        const filePath = resolveRequestPath(req.url || '/');
        if (!filePath) {
            sendNotFound(res);
            return;
        }

        try {
            await sendFile(res, filePath);
        } catch (error) {
            if (error && typeof error === 'object' && error.code === 'ENOENT') {
                sendNotFound(res);
                return;
            }
            throw error;
        }
    } catch (error) {
        sendError(res, error);
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Static app server listening on http://${HOST}:${PORT}`);
});
