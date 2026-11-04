import React, { useEffect, useRef, useState } from 'react';

interface OnlineCountBadgeProps {
  count: number;
  /** 数据更新时触发的闪烁动画 */
  flash?: boolean;
  /** 站点配色：中文站金色、国际站蓝色、汇总绿色 */
  tone?: 'cn' | 'com' | 'total';
}

/** 排行榜里的在线人数：纯数字 + 按站点着色，避免柱状条带来的噪音。 */
export const OnlineCountBadge: React.FC<OnlineCountBadgeProps> = ({ count, flash, tone = 'total' }) => {
  const [display, setDisplay] = useState(count);
  const [bump, setBump] = useState(false);
  const prevRef = useRef(count);

  useEffect(() => {
    if (count !== prevRef.current) {
      setBump(true);
      const t = window.setTimeout(() => setBump(false), 600);
      prevRef.current = count;
      setDisplay(count);
      return () => window.clearTimeout(t);
    }
    setDisplay(count);
  }, [count]);

  return (
    <span
      className={[
        'ranking-count',
        `ranking-count--${tone}`,
        bump ? 'ranking-count--bump' : '',
        flash ? 'ranking-count--flash' : '',
      ].filter(Boolean).join(' ')}
    >
      {display.toLocaleString()}
    </span>
  );
};
