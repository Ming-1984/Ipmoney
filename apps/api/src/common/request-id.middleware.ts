import { randomUUID } from 'crypto';

type RequestLike = { headers: Record<string, unknown> };
type ResponseLike = { setHeader: (key: string, value: string) => void };
type NextFunctionLike = () => void;

const HEADER_KEY = 'x-request-id';
const ALT_HEADER_KEY = 'x-requestid';

export function requestIdMiddleware(req: RequestLike, res: ResponseLike, next: NextFunctionLike) {
  const raw = req.headers[HEADER_KEY] ?? req.headers[ALT_HEADER_KEY];
  const headerValue = Array.isArray(raw) ? raw[0] : raw;
  const requestId = typeof headerValue === 'string' && headerValue.trim() ? headerValue.trim() : randomUUID();

  (req.headers as Record<string, any>)[HEADER_KEY] = requestId;
  res.setHeader(HEADER_KEY, requestId);
  (req as any).requestId = requestId;
  next();
}
