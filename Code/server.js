const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const siteRoot = __dirname;
const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
};

const server = http.createServer((request, response) => {
    let pathname;

    try {
        pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
        response.writeHead(400).end('Bad request');
        return;
    }

    if (pathname === '/') pathname = '/index.html';

    const filePath = path.resolve(siteRoot, `.${pathname}`);
    if (!filePath.startsWith(`${siteRoot}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('File could not be served');
            return;
        }

        response.writeHead(200, {
            'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff',
        });
        response.end(request.method === 'HEAD' ? undefined : content);
    });
});

const port = Number(process.env.PORT) || 8000;
server.listen(port, '127.0.0.1', () => {
    console.log(`Portfolio site running at http://127.0.0.1:${port}`);
    console.log('Press Ctrl+C to stop the server.');
});
