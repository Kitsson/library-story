import type { VercelRequest, VercelResponse } from '@vercel/node';

const RAILWAY_BASE = 'https://library-story-production.up.railway.app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path ?? ''];
  const pathStr = pathParts.filter(Boolean).join('/');

  const qs = { ...req.query };
  delete qs.path;
  const queryString = new URLSearchParams(qs as Record<string, string>).toString();
  const targetUrl = `${RAILWAY_BASE}/api/v1/${pathStr}${queryString ? `?${queryString}` : ''}`;

  const headers: Record<string, string> = { 'host': 'library-story-production.up.railway.app' };
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() === 'host') continue;
    if (value !== undefined) {
      headers[key] = Array.isArray(value) ? value[0] : value;
    }
  }

  let body: Buffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    if (chunks.length > 0) body = Buffer.concat(chunks);
  }

  const upstreamRes = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: body,
  });

  res.status(upstreamRes.status);
  upstreamRes.headers.forEach((value, key) => {
    if (['transfer-encoding', 'content-encoding', 'connection'].includes(key.toLowerCase())) return;
    res.setHeader(key, value);
  });

  const responseBody = await upstreamRes.arrayBuffer();
  res.end(Buffer.from(responseBody));
}
