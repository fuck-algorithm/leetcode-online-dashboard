import { useEffect } from 'react';

/**
 * 部署新版本后，已打开的旧标签页不会自动加载新资源。
 * 切回页面时对比当前入口 JS 与服务器最新 HTML 的引用，发现变化则自动刷新。
 */
export const useVersionCheck = () => {
  useEffect(() => {
    if (import.meta.env.DEV) return;

    const currentSrc = Array.from(document.scripts)
      .map((script) => script.src)
      .find((src) => /\/assets\/index-[^/]+\.js$/.test(src));
    if (!currentSrc) return;

    let lastChecked = 0;

    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastChecked < 60_000) return;
      lastChecked = now;

      try {
        const response = await fetch('/', { cache: 'no-store' });
        if (!response.ok) return;
        const html = await response.text();
        const match = html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/);
        if (!match) return;
        const nextSrc = new URL(match[1], window.location.origin).href;
        if (nextSrc !== currentSrc) {
          window.location.reload();
        }
      } catch {
        // 网络异常时保持当前页面，下次切换标签页再检查
      }
    };

    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
};
