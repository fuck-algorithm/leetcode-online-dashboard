import React, { useEffect, useState } from 'react';
import { Tooltip } from 'antd';

/** 数据在 90 秒内算新鲜（后端批次间隔 30 秒），5 分钟内算延迟，再久视为中断 */
const FRESH_WINDOW_MS = 90 * 1000;
const DELAYED_WINDOW_MS = 5 * 60 * 1000;

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
}

function formatRelative(ms: number): string {
  if (ms < 10 * 1000) return '刚刚';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

interface LastUpdatedProps {
  /** 本页收到的最新一条在线人数数据的采集时间（毫秒），null 表示尚未拿到数据 */
  timestamp: number | null;
}

/**
 * 排行榜的数据新鲜度指示器。
 */
const LastUpdated: React.FC<LastUpdatedProps> = ({ timestamp }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!timestamp) {
    return (
      <span className="rankings-updated rankings-updated--waiting">
        <span className="rankings-updated__dot" />
        等待数据…
      </span>
    );
  }

  const age = Math.max(0, now - timestamp);
  const state = age < FRESH_WINDOW_MS ? 'fresh' : age < DELAYED_WINDOW_MS ? 'delayed' : 'stale';
  const absolute = new Date(timestamp).toLocaleString('zh-CN', { hour12: false });

  return (
    <Tooltip title={`最新数据采集时间：${absolute}（各题更新时间可能略有差异）`}>
      <span className={`rankings-updated rankings-updated--${state}`}>
        <span className="rankings-updated__dot" />
        <span className="rankings-updated__label">LIVE</span>
        <span className="rankings-updated__time">
          {formatClock(timestamp)} · {formatRelative(age)}
        </span>
      </span>
    </Tooltip>
  );
};

export default LastUpdated;
