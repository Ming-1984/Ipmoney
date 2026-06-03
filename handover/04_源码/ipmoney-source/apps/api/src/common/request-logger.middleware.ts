type RequestLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, unknown>;
  requestId?: string;
};

type ResponseLike = {
  statusCode?: number;
  on: (event: 'finish' | 'close', cb: () => void) => void;
  getHeader?: (name: string) => unknown;
};

type NextFunctionLike = () => void;

function nowIso() {
  return new Date().toISOString();
}

function readHeader(req: RequestLike, key: string): string {
  const raw = req.headers[key] as any;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value : '';
}

function stripQuery(url: string): string {
  const raw = String(url || '');
  const idx = raw.indexOf('?');
  return idx >= 0 ? raw.slice(0, idx) : raw;
}

export function requestLoggerMiddleware(req: RequestLike, res: ResponseLike, next: NextFunctionLike) {
  // Avoid noisy logs in test/prod by allowing an env toggle.
  const enabledRaw = String(process.env.REQUEST_LOG_ENABLED || '').trim().toLowerCase();
  const enabled = enabledRaw ? enabledRaw === '1' || enabledRaw === 'true' : true;
  if (!enabled) return next();

  const start = process.hrtime.bigint();
  const requestId =
    (req.requestId && String(req.requestId).trim()) ||
    readHeader(req, 'x-request-id') ||
    readHeader(req, 'x-requestid') ||
    '';
  const method = String(req.method || '').toUpperCase();
  const path = stripQuery(String(req.originalUrl || req.url || ''));
  if (path.startsWith('/health')) return next();
  const userAgent = readHeader(req, 'user-agent');

  let finished = false;
  const log = (event: 'finish' | 'close') => {
    if (finished) return;
    finished = true;
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    const status = Number(res.statusCode || 0);

    // Log as a single JSON line to make ingestion into log pipelines easy.
    // Do NOT log request bodies or query params here to avoid leaking PII.
    console.log(
      JSON.stringify({
        ts: nowIso(),
        level: 'info',
        msg: 'request',
        requestId: requestId || undefined,
        method,
        path,
        status,
        durationMs: Math.round(durationMs * 100) / 100,
        event,
        userAgent: userAgent || undefined,
      }),
    );
  };

  res.on('finish', () => log('finish'));
  res.on('close', () => log('close'));
  next();
}
