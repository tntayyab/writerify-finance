// Vercel serverless adapter.
// All API logic (auth, sites, income, expenses, backups…) lives in the Cloudflare
// Pages Function so every deployment target behaves identically.
import { onRequest } from '../functions/api/[[path]].js';

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string') return req.body;
    return JSON.stringify(req.body);
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const url = new URL(req.url, `${proto}://${req.headers.host || 'localhost'}`);

  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: await readBody(req)
  });

  const response = await onRequest({ request, env: process.env });

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
