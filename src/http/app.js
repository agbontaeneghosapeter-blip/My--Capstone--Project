import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError } from '../domain/errors.js';
import { Router } from './router.js';

const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));
const MAX_BODY_BYTES = 1024 * 1024;
const STATUS_BY_CODE = {
  VALIDATION: 400,
  INVALID_JSON: 400,
  INVALID_PATH: 400,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  INVALID_STATE: 409,
  SOLD_OUT: 409,
  FORBIDDEN: 403,
  PAYLOAD_TOO_LARGE: 413,
};
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendJson(response, statusCode, payload, headOnly = false) {
  const serialized = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  response.end(headOnly ? undefined : serialized);
}

function sendError(response, statusCode, code, message, headOnly = false) {
  sendJson(response, statusCode, { error: { code, message } }, headOnly);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new DomainError('PAYLOAD_TOO_LARGE', 'Request body is too large');
    }
    chunks.push(chunk);
  }
  if (size === 0) return undefined;

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new DomainError('INVALID_JSON', 'Request body must contain valid JSON');
  }
}

function isWithinDirectory(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative));
}

async function serveStaticFile(request, response, pathname, publicDir) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendError(response, 400, 'INVALID_PATH', 'Request path is not valid');
    return;
  }

  try {
    const root = await fs.realpath(publicDir);
    let candidate = path.resolve(root, `.${decodedPath}`);
    if (!isWithinDirectory(root, candidate)) {
      sendError(response, 403, 'FORBIDDEN', 'Path is outside the public directory');
      return;
    }

    let info = await fs.stat(candidate);
    if (info.isDirectory()) {
      candidate = path.join(candidate, 'index.html');
      info = await fs.stat(candidate);
    }
    if (!info.isFile()) {
      sendError(response, 404, 'NOT_FOUND', 'File not found', request.method === 'HEAD');
      return;
    }

    const realFile = await fs.realpath(candidate);
    if (!isWithinDirectory(root, realFile)) {
      sendError(response, 403, 'FORBIDDEN', 'Path is outside the public directory');
      return;
    }

    const content = await fs.readFile(realFile);
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[path.extname(realFile).toLowerCase()] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      sendError(response, 404, 'NOT_FOUND', 'File not found', request.method === 'HEAD');
      return;
    }
    throw error;
  }
}

function sendThrownError(response, error, headOnly) {
  const statusCode = STATUS_BY_CODE[error?.code] ?? 500;
  if (statusCode === 500) {
    sendError(response, 500, 'INTERNAL_ERROR', 'Internal server error', headOnly);
    return;
  }
  sendError(response, statusCode, error.code, error.message, headOnly);
}

export function createApp({ router = new Router(), publicDir = DEFAULT_PUBLIC_DIR } = {}) {
  return createServer(async (request, response) => {
    const headOnly = request.method === 'HEAD';
    try {
      const url = new URL(request.url, 'http://localhost');
      const body = request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await readJsonBody(request);

      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, { status: 'ok' });
        return;
      }

      const match = router.match(request.method, url.pathname);
      if (match) {
        const result = await match.handler({ request, params: match.params, body });
        if (result === undefined) {
          response.writeHead(204);
          response.end();
          return;
        }
        const hasEnvelope = result !== null && typeof result === 'object'
          && Object.hasOwn(result, 'statusCode') && Object.hasOwn(result, 'body');
        sendJson(response, hasEnvelope ? result.statusCode : 200,
          hasEnvelope ? result.body : result, headOnly);
        return;
      }

      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        sendError(response, 404, 'NOT_FOUND', 'API route not found', headOnly);
        return;
      }
      await serveStaticFile(request, response, url.pathname, publicDir);
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      sendThrownError(response, error, headOnly);
    }
  });
}