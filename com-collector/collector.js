'use strict';

/**
 * LeetCode.com online-count collector.
 *
 * Why this exists:
 *   collaboration-ws.leetcode.com sits behind Cloudflare and rejects plain
 *   WebSocket clients with a 403 "cf-mitigated: challenge". A real browser
 *   passes that check, so this collector opens a small pool of real pages,
 *   reads the numeric frames from each page's own WebSocket, and writes the
 *   values into Redis under the same keys the Go application already uses.
 *
 * The Go worker persists the Redis values to PostgreSQL; this process only
 * writes Redis (site key, hot100 zset, pub/sub update, totals).
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('redis');

const ROOT = path.resolve(__dirname, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, '.env'));

function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function envInt(name, fallback) {
  const value = env(name, '');
  if (value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePrefix(prefix) {
  const trimmed = String(prefix || '').trim();
  if (!trimmed) return 'leetcode-dashboard:';
  return trimmed.endsWith(':') ? trimmed : trimmed + ':';
}

const CONFIG = {
  redisHost: env('REDIS_HOST', 'localhost'),
  redisPort: envInt('REDIS_PORT', 6379),
  redisPassword: env('REDIS_PASSWORD', ''),
  redisDB: envInt('REDIS_DB', 0),
  keyPrefix: normalizePrefix(env('REDIS_KEY_PREFIX', 'leetcode-dashboard:')),
  dataFile: env('HOT100_FILE', path.join(ROOT, 'backend/data/hot100_with_cn.json')),
  batchSize: Math.max(1, Math.min(20, envInt('COM_BATCH_SIZE', 10))),
  attemptMs: Math.max(4000, envInt('COM_ATTEMPT_MS', 12000)),
  attemptsPerSlug: Math.max(1, Math.min(10, envInt('COM_ATTEMPTS_PER_SLUG', 4))),
  minIngestIntervalMs: Math.max(0, envInt('COM_MIN_INGEST_INTERVAL_MS', 3000)),
  cyclePauseMs: Math.max(0, envInt('COM_CYCLE_PAUSE_MS', 3000)),
  retryPauseMs: Math.max(0, envInt('COM_RETRY_PAUSE_MS', 5000)),
  onlySlugs: env('COM_ONLY_SLUGS', '').split(',').map((s) => s.trim()).filter(Boolean),
  once: env('COM_ONCE', 'false') === 'true',
  debug: env('COM_DEBUG', 'false') === 'true',
};

const K = {
  onlineCN: (slug) => `${CONFIG.keyPrefix}online:cn:${slug}`,
  onlineCOM: (slug) => `${CONFIG.keyPrefix}online:com:${slug}`,
  hot100: `${CONFIG.keyPrefix}hot100:list`,
  updates: `${CONFIG.keyPrefix}updates`,
  totalCN: `${CONFIG.keyPrefix}total:online:cn`,
  totalCOM: `${CONFIG.keyPrefix}total:online:com`,
  totalUnified: `${CONFIG.keyPrefix}total:online:unified`,
  totalLegacy: `${CONFIG.keyPrefix}total:online`,
};

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const problems = JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf8'));
const bySlug = new Map(problems.map((p) => [p.slug, p]));
const slugs = problems.map((p) => p.slug);

// Totals always cover all 100 problems; COM_ONLY_SLUGS merely narrows the
// collection targets, which is useful for a one-shot fill of stubborn keys.
const targets = CONFIG.onlySlugs.length
  ? problems.filter((p) => CONFIG.onlySlugs.includes(p.slug))
  : problems;

const redis = createClient({
  socket: {
    host: CONFIG.redisHost,
    port: CONFIG.redisPort,
    reconnectStrategy: (retries) => Math.min(1000 + retries * 500, 10000),
  },
  password: CONFIG.redisPassword || undefined,
  database: CONFIG.redisDB,
});
redis.on('error', (err) => log('[redis] error:', err.message));

const lastIngestAt = new Map();
const ingestedCounts = new Map();
let shuttingDown = false;

function metaFor(slug) {
  const p = bySlug.get(slug);
  if (!p) return null;
  return {
    frontend_id: String(p.id || ''),
    slug: p.slug,
    title: p.title || '',
    title_cn: p.title_cn || '',
    difficulty: p.difficulty || '',
    paid_only: Boolean(p.paid_only),
    topic_tags: Array.isArray(p.topic_tags) ? p.topic_tags : [],
  };
}

async function ingest(slug, count) {
  const meta = metaFor(slug);
  if (!meta) {
    log('[ingest] unknown slug:', slug);
    return;
  }
  if (!Number.isFinite(count) || count < 0) return;

  const now = Date.now();
  const previous = lastIngestAt.get(slug) || 0;
  if (now - previous < CONFIG.minIngestIntervalMs) return;

  const status = {
    ...meta,
    online_count: count,
    last_updated: new Date(now).toISOString(),
    site: 'com',
  };

  try {
    await redis.multi()
      .set(K.onlineCOM(slug), JSON.stringify(status), { EX: 86400 })
      .zAdd(K.hot100, [{ score: Math.floor(now / 1000), value: slug }])
      .publish(K.updates, JSON.stringify({ slug, site: 'com', count, time: Math.floor(now / 1000) }))
      .exec();
    lastIngestAt.set(slug, now);
    ingestedCounts.set(slug, count);
    if (CONFIG.debug) log(`[ingest] ${slug}=${count}`);
  } catch (err) {
    log(`[ingest] failed for ${slug}:`, err.message);
  }
}

async function refreshTotals() {
  try {
    const values = await redis.mGet([
      ...slugs.map((slug) => K.onlineCN(slug)),
      ...slugs.map((slug) => K.onlineCOM(slug)),
    ]);
    const half = slugs.length;
    let cnTotal = 0;
    let comTotal = 0;
    for (let i = 0; i < values.length; i++) {
      const raw = values[i];
      if (!raw) continue;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        continue;
      }
      const count = Number(parsed.online_count) || 0;
      if (i < half) cnTotal += count;
      else comTotal += count;
    }
    const unified = cnTotal + comTotal;
    await redis.multi()
      .set(K.totalCN, String(cnTotal), { EX: 86400 })
      .set(K.totalCOM, String(comTotal), { EX: 86400 })
      .set(K.totalUnified, String(unified), { EX: 86400 })
      .set(K.totalLegacy, String(unified), { EX: 86400 })
      .exec();
    return { cnTotal, comTotal, unified };
  } catch (err) {
    log('[totals] failed:', err.message);
    return null;
  }
}

// A single attempt at one problem. Resolves as soon as a numeric frame arrives
// on the .com collaboration socket, or after attemptMs.
async function collectOne(context, problem, attempt) {
  const slug = problem.slug;
  const state = {
    slug,
    title: '',
    handshakes: [],
    frames: 0,
    last: null,
    errors: [],
    attempt,
  };

  let page;
  let finished = false;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const finish = (value) => {
    if (!finished) {
      finished = true;
      resolveDone(value);
    }
  };
  const timer = setTimeout(() => finish(false), CONFIG.attemptMs);

  try {
    page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');

    const wsURLs = new Map();
    cdp.on('Network.webSocketCreated', (event) => {
      wsURLs.set(event.requestId, event.url);
    });
    cdp.on('Network.webSocketHandshakeResponseReceived', (event) => {
      const url = wsURLs.get(event.requestId) || '';
      if (url.includes('collaboration-ws.leetcode.com') && url.includes(`/problems/${slug}`)) {
        state.handshakes.push(event.response.status);
      }
    });
    cdp.on('Network.webSocketFrameReceived', (event) => {
      const url = wsURLs.get(event.requestId) || '';
      if (!url.includes('collaboration-ws.leetcode.com') || !url.includes(`/problems/${slug}`)) {
        return;
      }
      const payload = String(event.response.payloadData || '').trim();
      if (!/^\d+$/.test(payload)) return;
      state.frames++;
      state.last = payload;
      ingest(slug, Number(payload)).catch((err) => log(`[ingest] ${slug}:`, err.message));
      finish(true);
    });
    cdp.on('Network.webSocketFrameError', (event) => {
      state.errors.push(event.errorMessage);
      // The page retries the .com socket about five times and then gives up;
      // no point burning the full attempt budget after that.
      if (state.errors.length >= 5) finish(false);
    });

    await page.goto(`https://leetcode.com/problems/${slug}/`, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.attemptMs,
    }).catch((err) => state.errors.push('goto:' + err.message));
    state.title = await page.title().catch(() => '');
    await done;
  } catch (err) {
    state.errors.push('open:' + err.message);
    finish(false);
  } finally {
    clearTimeout(timer);
    if (page) {
      try { await page.close(); } catch (_) {}
    }
  }

  return {
    ...state,
    ok: state.frames > 0,
    handshakes: state.handshakes,
    errors: state.errors,
  };
}

function mergeSummary(acc, next) {
  if (!acc) return { ...next };
  return {
    ...next,
    ok: acc.ok || next.ok,
    frames: acc.frames + next.frames,
    handshakes: acc.handshakes.concat(next.handshakes),
    errors: acc.errors.concat(next.errors),
    last: next.last || acc.last,
    title: next.title || acc.title,
  };
}

async function openBatch(batch) {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });

  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
  });

  const summaries = [];
  try {
    for (const problem of batch) {
      let merged = null;
      let attempts = 0;
      for (let i = 0; i < CONFIG.attemptsPerSlug; i++) {
        if (shuttingDown) break;
        attempts++;
        const result = await collectOne(context, problem, attempts);
        merged = mergeSummary(merged, result);
        if (result.ok) break;
      }
      if (merged) {
        merged.attempts = attempts;
        summaries.push(merged);
        log(`[cycle] ${problem.slug}: ${merged.ok ? 'OK' : 'FAIL'} attempts=${attempts} count=${merged.last || '-'}`);
      }
      if (shuttingDown) break;
    }
  } finally {
    try { await context.close(); } catch (_) {}
    try { await browser.close(); } catch (_) {}
  }
  return summaries;
}

// Missing or oldest keys first, so coverage fills up quickly on a fresh Redis.
async function orderProblems() {
  try {
    const values = await redis.mGet(targets.map((p) => K.onlineCOM(p.slug)));
    const scored = targets.map((problem, index) => {
      let updated = 0;
      if (values[index]) {
        try {
          updated = Date.parse(JSON.parse(values[index]).last_updated) || 0;
        } catch (_) {
          updated = 0;
        }
      }
      return { problem, updated, missing: !values[index] };
    });
    scored.sort((a, b) => a.updated - b.updated);
    return {
      list: scored.map((item) => item.problem),
      missing: scored.filter((item) => item.missing).length,
    };
  } catch (err) {
    log('[order] failed, keeping file order:', err.message);
    return { list: targets.slice(), missing: 0 };
  }
}

async function runCycle(cycle) {
  let totalOK = 0;
  let totalFrames = 0;
  let totalAttempts = 0;
  const ordered = await orderProblems();
  const list = ordered.list;
  const batches = Math.ceil(list.length / CONFIG.batchSize);
  log(`[cycle ${cycle}] starting, ${ordered.missing}/${list.length} COM keys missing`);

  for (let index = 0; index < list.length; index += CONFIG.batchSize) {
    if (shuttingDown) break;
    const batch = list.slice(index, index + CONFIG.batchSize);
    const batchNo = Math.floor(index / CONFIG.batchSize) + 1;

    let summary;
    try {
      summary = await openBatch(batch);
    } catch (err) {
      log(`[cycle ${cycle}] batch ${batchNo}/${batches} browser failed:`, err.message);
      await sleep(CONFIG.retryPauseMs);
      continue;
    }

    const ok = summary.filter((item) => item.ok).length;
    const frames = summary.reduce((sum, item) => sum + item.frames, 0);
    const attempts = summary.reduce((sum, item) => sum + (item.attempts || 0), 0);
    totalOK += ok;
    totalFrames += frames;
    totalAttempts += attempts;
    const failed = summary.filter((item) => !item.ok)
      .map((item) => `${item.slug}(hs=${item.handshakes.length},f=${item.frames},e=${item.errors.length})`);
    log(`[cycle ${cycle}] batch ${batchNo}/${batches}: ${ok}/${batch.length} pages, ${frames} frames, ${attempts} attempts` +
      (failed.length ? `, failed=${failed.join(' | ')}` : ''));

    const totals = await refreshTotals();
    if (totals) {
      log(`[cycle ${cycle}] totals CN=${totals.cnTotal} COM=${totals.comTotal} unified=${totals.unified}`);
    }

    await sleep(CONFIG.cyclePauseMs);
  }

  log(`[cycle ${cycle}] complete: ${totalOK}/${list.length} pages OK, ${totalFrames} frames, ${totalAttempts} attempts`);
}

async function main() {
  if (!process.env.DISPLAY) {
    throw new Error('DISPLAY is not set; run through start-com-collector.sh (Xvfb) so headed Chromium can start');
  }
  if (problems.length === 0) {
    throw new Error(`no problems loaded from ${CONFIG.dataFile}`);
  }
  if (targets.length === 0) {
    throw new Error(`COM_ONLY_SLUGS matched no problem: ${CONFIG.onlySlugs.join(', ')}`);
  }

  log(`[start] ${targets.length}/${problems.length} problems, batch=${CONFIG.batchSize}, attempt=${CONFIG.attemptMs}ms x${CONFIG.attemptsPerSlug}` +
    `${CONFIG.once ? ', one-shot' : ''}, redis=${CONFIG.redisHost}:${CONFIG.redisPort}/${CONFIG.redisDB}, prefix=${CONFIG.keyPrefix}`);
  await redis.connect();
  log('[redis] connected');

  let cycle = 0;
  while (!shuttingDown) {
    cycle++;
    try {
      await runCycle(cycle);
    } catch (err) {
      log(`[cycle ${cycle}] fatal:`, err.stack || err.message);
      await sleep(5000);
    }
    if (CONFIG.once) break;
  }

  try { await redis.quit(); } catch (_) {}
  log('[stop] collector stopped');
}

process.on('SIGINT', () => { shuttingDown = true; log('[stop] SIGINT received, finishing current batch'); });
process.on('SIGTERM', () => { shuttingDown = true; log('[stop] SIGTERM received, finishing current batch'); });

main().catch(async (err) => {
  log('[fatal]', err.stack || err.message);
  try { await redis.quit(); } catch (_) {}
  process.exit(1);
});
