import { Injectable } from '@nestjs/common';
import net from 'node:net';

type RedisConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
};

function toRespCommand(parts: string[]): string {
  const payload = parts.map((part) => {
    const text = String(part ?? '');
    return `$${Buffer.byteLength(text)}\r\n${text}\r\n`;
  });
  return `*${parts.length}\r\n${payload.join('')}`;
}

@Injectable()
export class RedisProbeService {
  private readonly config = this.resolveConfig();

  private resolveConfig(): RedisConfig | null {
    const redisUrl = String(process.env.REDIS_URL || '').trim();
    if (redisUrl) {
      try {
        const parsed = new URL(redisUrl);
        const host = parsed.hostname;
        const port = Number(parsed.port || 6379);
        if (!host || !Number.isFinite(port) || port <= 0) return null;
        return {
          host,
          port,
          username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
          password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        };
      } catch {
        return null;
      }
    }

    const host = String(process.env.REDIS_HOST || '').trim();
    const port = Number(process.env.REDIS_PORT || 6379);
    if (!host || !Number.isFinite(port) || port <= 0) return null;
    return {
      host,
      port,
      username: String(process.env.REDIS_USERNAME || '').trim() || undefined,
      password: String(process.env.REDIS_PASSWORD || '').trim() || undefined,
    };
  }

  isConfigured(): boolean {
    return Boolean(this.config);
  }

  async ping(timeoutMs = 1500): Promise<{ ok: boolean; message?: string }> {
    if (!this.config) {
      return { ok: true, message: 'redis_not_configured' };
    }

    const { host, port, username, password } = this.config;
    const commands: string[] = [];
    if (password) {
      if (username) {
        commands.push(toRespCommand(['AUTH', username, password]));
      } else {
        commands.push(toRespCommand(['AUTH', password]));
      }
    }
    commands.push(toRespCommand(['PING']));

    return await new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ ok: false, message: 'redis_timeout' });
      }, timeoutMs);

      let settled = false;
      const done = (result: { ok: boolean; message?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.destroy();
        resolve(result);
      };

      socket.once('error', () => done({ ok: false, message: 'redis_connect_error' }));
      socket.once('connect', () => {
        socket.write(commands.join(''));
      });
      socket.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        if (text.includes('+PONG')) {
          done({ ok: true });
          return;
        }
        if (text.startsWith('-')) {
          done({ ok: false, message: `redis_error:${text.slice(1).split('\r\n')[0]}` });
        }
      });
      socket.once('close', () => {
        if (!settled) done({ ok: false, message: 'redis_closed' });
      });
    });
  }
}
