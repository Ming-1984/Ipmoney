#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

function getArg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
}

function getArgs(name) {
  const values = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] !== name) continue;
    const value = process.argv[i + 1];
    if (!value || value.startsWith('--')) continue;
    values.push(value);
    i += 1;
  }
  return values;
}

function parseStoragePair(raw) {
  if (!raw) return null;
  const idx = raw.indexOf('=');
  if (idx <= 0) return null;
  const key = raw.slice(0, idx).trim();
  const value = raw.slice(idx + 1);
  if (!key) return null;
  return [key, value];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function truncate(str, max) {
  const text = String(str || '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

const url = getArg('--url');
const browserPath = getArg('--browser');
const userDataDir = getArg('--user-data-dir');
const waitMs = Number(getArg('--wait-ms', '3500'));
const timeoutMs = Number(getArg('--timeout-ms', '90000'));
const width = Number(getArg('--width', '1280'));
const height = Number(getArg('--height', '900'));
const selectors = getArgs('--selector').map((item) => String(item || '').trim()).filter(Boolean);
const rawStorageEntries = getArgs('--storage').map(parseStoragePair).filter(Boolean);
const taroStorageEntries = getArgs('--storage-taro').map(parseStoragePair).filter(Boolean);

if (!url) fail('[dump-dom-cdp] --url is required');
if (!browserPath) fail('[dump-dom-cdp] --browser is required');
if (!existsSync(browserPath)) fail(`[dump-dom-cdp] browser not found: ${browserPath}`);
if (!globalThis.WebSocket) fail('[dump-dom-cdp] global WebSocket is unavailable in this Node runtime');

const browserArgs = [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-component-extensions-with-background-pages',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=CalculateNativeWinOcclusion',
  '--remote-debugging-port=0',
  `--window-size=${Number.isFinite(width) ? width : 1280},${Number.isFinite(height) ? height : 900}`,
];

if (userDataDir) {
  browserArgs.push(`--user-data-dir=${userDataDir}`);
}
browserArgs.push('about:blank');

const proc = spawn(browserPath, browserArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

let wsUrl = '';
let stderrLog = '';
let exited = false;

proc.stderr.setEncoding('utf8');
proc.stderr.on('data', (chunk) => {
  const text = String(chunk || '');
  stderrLog += text;
  const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
  if (match && match[1]) {
    wsUrl = match[1].trim();
  }
});

proc.on('exit', () => {
  exited = true;
});

function cleanup() {
  if (!exited) {
    try {
      proc.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
}

async function waitForWs(deadline) {
  while (Date.now() < deadline) {
    if (wsUrl) return wsUrl;
    if (exited) break;
    await sleep(50);
  }
  throw new Error(`[dump-dom-cdp] browser did not expose CDP websocket. stderr=${stderrLog.slice(0, 500)}`);
}

function createCdpClient(socketUrl, deadline) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(socketUrl);
    let idCounter = 1;
    const pending = new Map();
    const listeners = new Set();

    function close() {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }

    function send(method, params = {}, sessionId = undefined) {
      return new Promise((res, rej) => {
        if (Date.now() >= deadline) {
          rej(new Error(`[dump-dom-cdp] timeout before command ${method}`));
          return;
        }
        const id = idCounter += 1;
        pending.set(id, { res, rej, method });
        const payload = { id, method, params };
        if (sessionId) payload.sessionId = sessionId;
        ws.send(JSON.stringify(payload));
      });
    }

    function onEvent(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }

    ws.onopen = () => resolve({ send, onEvent, close });
    ws.onerror = (err) => reject(err);
    ws.onmessage = (event) => {
      let msg = null;
      try {
        msg = JSON.parse(String(event.data || '{}'));
      } catch {
        return;
      }

      if (typeof msg.id === 'number') {
        const entry = pending.get(msg.id);
        if (!entry) return;
        pending.delete(msg.id);
        if (msg.error) {
          entry.rej(new Error(`[dump-dom-cdp] CDP ${entry.method} failed: ${JSON.stringify(msg.error)}`));
        } else {
          entry.res(msg.result || {});
        }
        return;
      }

      for (const listener of listeners) {
        listener(msg);
      }
    };

    ws.onclose = () => {
      for (const [, entry] of pending.entries()) {
        entry.rej(new Error('[dump-dom-cdp] websocket closed'));
      }
      pending.clear();
    };
  });
}

function buildPreloadStorageScript(rawEntries, taroEntries) {
  if (!rawEntries.length && !taroEntries.length) return '';
  const rawPayload = JSON.stringify(rawEntries);
  const taroPayload = JSON.stringify(taroEntries);
  return `(() => {
    const coerceTaroValue = (input) => {
      const text = String(input ?? '');
      const lower = text.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
      const asNumber = Number(text);
      if (Number.isFinite(asNumber) && text.trim() !== '') return asNumber;
      return text;
    };

    try {
      const entries = ${rawPayload};
      for (const [k, v] of entries) {
        localStorage.setItem(String(k), String(v));
      }
    } catch (err) {
      // ignore storage errors
    }

    try {
      const taroEntries = ${taroPayload};
      for (const [k, v] of taroEntries) {
        const wrapped = { data: coerceTaroValue(v) };
        localStorage.setItem(String(k), JSON.stringify(wrapped));
      }
    } catch (err) {
      // ignore storage errors
    }
  })();`;
}

async function waitForPageLoad(cdp, sessionId, deadline) {
  return new Promise((resolve, reject) => {
    let done = false;
    const off = cdp.onEvent((event) => {
      if (event.sessionId !== sessionId) return;
      if (event.method !== 'Page.loadEventFired') return;
      if (done) return;
      done = true;
      off();
      resolve(true);
    });

    const timer = setInterval(() => {
      if (done) {
        clearInterval(timer);
        return;
      }
      if (Date.now() < deadline) return;
      clearInterval(timer);
      off();
      reject(new Error('[dump-dom-cdp] timeout waiting for Page.loadEventFired'));
    }, 100);
  });
}

async function run() {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let cdp = null;
  let targetId = '';
  try {
    const socketUrl = await waitForWs(deadline);
    cdp = await createCdpClient(socketUrl, deadline);

    const created = await cdp.send('Target.createTarget', { url: 'about:blank' });
    targetId = created.targetId;
    if (!targetId) throw new Error('[dump-dom-cdp] Target.createTarget did not return targetId');

    const attached = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const sessionId = attached.sessionId;
    if (!sessionId) throw new Error('[dump-dom-cdp] Target.attachToTarget did not return sessionId');

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Log.enable', {}, sessionId);

    const runtimeExceptions = [];
    const consoleErrors = [];
    const offEvents = cdp.onEvent((event) => {
      if (event.sessionId !== sessionId) return;
      if (event.method === 'Runtime.exceptionThrown') {
        const details = event.params?.exceptionDetails || {};
        const rawText = String(details.text || '').trim();
        const rawDescription = String(details.exception?.description || details.exception?.value || '').trim();
        const isGenericHeadline = rawText === 'Uncaught' || rawText === 'Uncaught (in promise)';
        let text = rawDescription || rawText;
        if (!isGenericHeadline && rawText && rawDescription && rawText !== rawDescription) {
          text = `${rawText}: ${rawDescription}`;
        }
        if (!text || text === 'Object') {
          const previewProps = details.exception?.preview?.properties;
          if (Array.isArray(previewProps) && previewProps.length > 0) {
            const entries = previewProps
              .slice(0, 6)
              .map((prop) => `${String(prop?.name || 'key')}=${String(prop?.value ?? prop?.type ?? '').trim()}`)
              .filter(Boolean);
            if (entries.length > 0) {
              text = `Object{${entries.join(', ')}}`;
            }
          }
        }
        runtimeExceptions.push({
          text: truncate(text, 800),
          url: String(details.url || ''),
          line: Number(details.lineNumber || 0),
          column: Number(details.columnNumber || 0),
        });
        return;
      }
      if (event.method === 'Log.entryAdded') {
        const entry = event.params?.entry || {};
        if (String(entry.level || '').toLowerCase() !== 'error') return;
        consoleErrors.push({
          level: String(entry.level || ''),
          source: String(entry.source || ''),
          text: truncate(String(entry.text || ''), 1000),
          url: String(entry.url || ''),
        });
      }
    });

    const preloadStorageScript = buildPreloadStorageScript(rawStorageEntries, taroStorageEntries);
    if (preloadStorageScript) {
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: preloadStorageScript }, sessionId);
    }

    const loadPromise = waitForPageLoad(cdp, sessionId, deadline);
    await cdp.send('Page.navigate', { url }, sessionId);
    await loadPromise;

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    const evaluated = await cdp.send(
      'Runtime.evaluate',
      {
        expression: `(() => {
          const selectors = ${JSON.stringify(selectors)};
          const storageKeys = ${JSON.stringify([...rawStorageEntries.map(([key]) => key), ...taroStorageEntries.map(([key]) => key)])};
          const result = {
            urlInput: ${JSON.stringify(url)},
            href: String(location.href || ''),
            pathname: String(location.pathname || ''),
            hash: String(location.hash || ''),
            title: String(document.title || ''),
            readyState: String(document.readyState || ''),
            elementCount: 0,
            bodyHtmlLength: 0,
            bodyTextLength: 0,
            bodyHtmlPreview: '',
            bodyTextPreview: '',
            selectorChecks: [],
            storageChecks: [],
          };

          const root = document.documentElement;
          const body = document.body;

          if (root) {
            result.elementCount = root.querySelectorAll('*').length;
          }

          const bodyHtml = body ? String(body.outerHTML || '') : '';
          const bodyText = body ? String(body.textContent || '') : '';
          result.bodyHtmlLength = bodyHtml.length;
          result.bodyTextLength = bodyText.length;
          result.bodyHtmlPreview = bodyHtml.slice(0, 6000);
          result.bodyTextPreview = bodyText.replace(/\\s+/g, ' ').trim().slice(0, 2000);

          for (const selector of selectors) {
            let matched = false;
            try {
              matched = Boolean(document.querySelector(selector));
            } catch {
              matched = false;
            }
            result.selectorChecks.push({ selector, matched });
          }

          for (const key of storageKeys) {
            let value = null;
            try {
              value = localStorage.getItem(String(key));
            } catch {
              value = null;
            }
            result.storageChecks.push({ key, value });
          }

          return result;
        })();`,
        returnByValue: true,
      },
      sessionId,
    );

    offEvents();

    const payload = evaluated?.result?.value || {};
    payload.runtimeExceptions = runtimeExceptions.slice(0, 20);
    payload.consoleErrors = consoleErrors.slice(0, 30);
    payload.elapsedMs = Date.now() - startedAt;
    process.stdout.write(JSON.stringify(payload));
  } finally {
    try {
      if (cdp && targetId) {
        await cdp.send('Target.closeTarget', { targetId });
      }
    } catch {
      // ignore cleanup errors
    }
    try {
      cdp?.close();
    } catch {
      // ignore
    }
    cleanup();
  }
}

run().catch((err) => {
  cleanup();
  fail(err?.message || String(err));
});
