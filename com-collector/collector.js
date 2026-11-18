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
    // 浏览器上下文/浏览器本身已关闭时，后续重试一定也失败，标记出去让上层重建。
    if (/context or browser has been closed|Target closed|browser has been disconnected/i.test(err.message)) {
      state.contextDead = true;
    }
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
    contextDead: acc.contextDead || next.contextDead,
    frames: acc.frames + next.frames,
    handshakes: acc.handshakes.concat(next.handshakes),
    errors: acc.errors.concat(next.errors),
    last: next.last || acc.last,
    title: next.title || acc.title,
  };
}

// 浏览器会话：整轮采集复用同一个浏览器，只有在上下文真的死掉时才重建。
//
// 为什么常驻：Cloudflare 只放行真实有头浏览器发出的 WebSocket 升级
// （实测同一 Chromium 改 headless 后 403；裸 WS、curl_cffi 指纹模拟、
// cookie 复用全部 403，只有有头浏览器能拿到 101）。既然浏览器绕不开，
// 就让冷启动只发生一次，而不是每 10 题重启一次。
function browserArgs() {
  const args = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
  ];
  // 无 X11 但有 weston/wayland 时（headless 服务器常见组合），
  // 显式指定 ozone 平台走 wayland，否则 chromium 会因找不到 $DISPLAY 直接退出。
  if (process.env.WAYLAND_DISPLAY && !process.env.DISPLAY) {
    args.push('--ozone-platform=wayland');
  }
  // 本机 IPv6 出口被 Cloudflare 挑战：走 v6 时 leetcode.com 一律 403
  // + cf-mitigated: challenge，拿不到 collaboration-ws。禁用 v6 后立刻正常。
  // 可用 COM_DISABLE_IPV6=false 关掉，便于网络环境变化时回退。
  if (env('COM_DISABLE_IPV6', 'true') !== 'false') {
    args.push('--disable-ipv6');
  }
  return args;
}

class BrowserSession {
  constructor() {
    this.browser = null;
    this.context = null;
  }

  alive() {
    return !!(this.context && this.browser && this.browser.isConnected());
  }

  // 真正的可用性探测：进程连着不代表上下文还能开页面。
  // 批次之间浏览器被外部杀掉（weston 重建、被 SIGKILL）时，
  // isConnected() 可能滞后，开一个页面探一下最稳。
  async usable() {
    if (!this.alive()) return false;
    try {
      const probe = await this.context.newPage();
      await probe.close().catch(() => {});
      return true;
    } catch (_) {
      return false;
    }
  }

  async ensure() {
    if (await this.usable()) return this.context;
    await this.close();
    this.browser = await chromium.launch({ headless: false, args: browserArgs() });
    this.context = await this.browser.newContext({
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
    });
    // 先走一遍首页做预热：Cloudflare 在首页下发 _cfuvid/csrftoken 等 cookie，
    // 拿着这些 cookie 再去题目页，collaboration-ws 的 403 会明显减少。
    // 实测同一批 8 题：预热前 2/8 拿到帧，预热后 4/8。
    try {
      const warm = await this.context.newPage();
      await warm.goto('https://leetcode.com/', {
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.attemptMs * 2,
      }).catch((err) => log('[warmup] goto failed:', err.message));
      await sleep(3000);
      await warm.close().catch(() => {});
    } catch (err) {
      log('[warmup] failed:', err.message);
    }
    return this.context;
  }

  async close() {
    const browser = this.browser;
    const context = this.context;
    this.browser = null;
    this.context = null;
    try { if (context) await context.close(); } catch (_) {}
    try { if (browser) await browser.close(); } catch (_) {}
  }
}

// 一批题目在同一个常驻浏览器里依次采集。上下文中途死掉时抛错，由上层重跑。
//
// finishOnShutdown：收到 SIGTERM 后仍把这一批跑完。补采阶段用它——
// 那时整轮已经接近尾声，被打断会让本轮失败的题白等一整轮才重试；
// 而下一轮通常几分钟后才到，中间这段时间数据就停留在低位。
async function runBatch(session, batch, { finishOnShutdown = false } = {}) {
  const stopping = () => shuttingDown && !finishOnShutdown;
  const context = await session.ensure();
  const summaries = [];
  for (const problem of batch) {
    if (stopping()) break;
    let merged = null;
    let attempts = 0;
    for (let i = 0; i < CONFIG.attemptsPerSlug; i++) {
      if (stopping()) break;
      attempts++;
      const result = await collectOne(context, problem, attempts);
      merged = mergeSummary(merged, result);
      if (result.ok) break;
      // 上下文已经没了（显示服务被重建、进程被杀），再重试只会连续失败。
      if (result.contextDead) break;
      // 失败后在重试之间喘口气：背靠背连打会让 Cloudflare 挑战持续生效，
      // 隔一小段时间再来往往就能过。退避递增，最多到 retryPauseMs 的一半。
      if (i < CONFIG.attemptsPerSlug - 1) {
        const backoff = Math.min(CONFIG.retryPauseMs / 2, 2000 + i * 2000);
        if (backoff > 0) await sleep(backoff);
      }
    }
    if (merged) {
      merged.attempts = attempts;
      summaries.push(merged);
      log(`[cycle] ${problem.slug}: ${merged.ok ? 'OK' : 'FAIL'} attempts=${attempts} count=${merged.last || '-'}` +
        (merged.ok ? '' : ` errs=[${merged.errors.slice(0, 4).join(' | ')}]`));
    }
    if (merged && merged.contextDead && !merged.ok) {
      await session.close();
      throw new Error('browser context died mid-batch');
    }
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
  const session = new BrowserSession();
  const failedProblems = [];
  log(`[cycle ${cycle}] starting, ${ordered.missing}/${list.length} COM keys missing`);

  try {
    for (let index = 0; index < list.length; index += CONFIG.batchSize) {
      if (shuttingDown) break;
      const batch = list.slice(index, index + CONFIG.batchSize);
      const batchNo = Math.floor(index / CONFIG.batchSize) + 1;

      let summary;
      try {
        summary = await runBatch(session, batch);
      } catch (err) {
        // 上下文中途死掉：本批剩余题目一条都没采到，换一个新浏览器重跑一次。
        if (/context died mid-batch/i.test(err.message)) {
          log(`[cycle ${cycle}] batch ${batchNo}/${batches} context died, retrying with a fresh browser`);
          await sleep(CONFIG.retryPauseMs);
          try {
            summary = await runBatch(session, batch);
          } catch (err2) {
            log(`[cycle ${cycle}] batch ${batchNo}/${batches} retry failed:`, err2.message);
            await sleep(CONFIG.retryPauseMs);
            continue;
          }
        } else {
          log(`[cycle ${cycle}] batch ${batchNo}/${batches} browser failed:`, err.message);
          await session.close();
          await sleep(CONFIG.retryPauseMs);
          continue;
        }
      }

      const ok = summary.filter((item) => item.ok).length;
      const frames = summary.reduce((sum, item) => sum + item.frames, 0);
      const attempts = summary.reduce((sum, item) => sum + (item.attempts || 0), 0);
      totalOK += ok;
      totalFrames += frames;
      totalAttempts += attempts;
      for (const item of summary) {
        if (item.ok) continue;
        const problem = bySlug.get(item.slug);
        if (problem) failedProblems.push(problem);
      }
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

    // 轮末补采：本轮失败的题再用同一个常驻浏览器过一遍。
    // Cloudflare 的挑战是概率性的，同一题隔一小段时间往往就能拿到；
    // 早先的实现要等下一整轮才重来，导致个别题覆盖率长期偏低。
    if (failedProblems.length) {
      log(`[cycle ${cycle}] retrying ${failedProblems.length} failed problem(s)`);
      await sleep(CONFIG.retryPauseMs);
      let retrySummary = [];
      try {
        // 即使中途收到 SIGTERM 也把补采跑完：这批题目本来就已经失败过一次，
        // 半途放弃等于白白浪费一整轮的等待。
        retrySummary = await runBatch(session, failedProblems, { finishOnShutdown: true });
      } catch (err) {
        log(`[cycle ${cycle}] retry pass failed:`, err.message);
      }
      const ok = retrySummary.filter((item) => item.ok).length;
      totalOK += ok;
      totalFrames += retrySummary.reduce((sum, item) => sum + item.frames, 0);
      totalAttempts += retrySummary.reduce((sum, item) => sum + (item.attempts || 0), 0);
      log(`[cycle ${cycle}] retry pass: ${ok}/${failedProblems.length} recovered`);
      const totals = await refreshTotals();
      if (totals) {
        log(`[cycle ${cycle}] totals CN=${totals.cnTotal} COM=${totals.comTotal} unified=${totals.unified}`);
      }
    }
  } finally {
    await session.close();
  }

  log(`[cycle ${cycle}] complete: ${totalOK}/${list.length} pages OK, ${totalFrames} frames, ${totalAttempts} attempts`);
}

async function main() {
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    throw new Error('DISPLAY is not set; run through start-com-collector.sh (Xvfb) or set WAYLAND_DISPLAY so headed Chromium can start');
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
