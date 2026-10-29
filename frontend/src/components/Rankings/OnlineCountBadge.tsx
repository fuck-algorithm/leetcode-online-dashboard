import React, { useEffect, useRef, useState } from 'react';

interface OnlineCountBadgeProps {
  count: number;
  /** 数据更新时触发的闪烁动画 */
  flash?: boolean;
}

export const OnlineCountBadge: React.FC<OnlineCountBadgeProps> = ({ count, flash }) => {
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

  const bars = [1, 2, 3, 4].map((level) => {
    const threshold = level * 25;
    const isActive = display >= threshold;
    const height = level * 3 + 5;
    const color = display >= 75
      ? '#ff4d4f'
      : display >= 50
        ? '#ff7a45'
        : display >= 25
          ? '#52c41a'
          : '#d9d9d9';
    return (
      <div
        key={level}
        style={{
          width: 3,
          height: height,
          backgroundColor: isActive ? color : '#d9d9d9',
          borderRadius: 1,
          transition: 'all 0.3s ease',
          transform: bump && isActive ? 'scaleY(1.3)' : 'scaleY(1)',
          transformOrigin: 'bottom',
        }}
      />
    );
  });

  return (
    <div
      className={`lc-online-badge ${bump ? 'lc-online-badge--bump' : ''} ${flash ? 'lc-online-badge--flash' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'transform 0.3s ease',
        transform: bump ? 'scale(1.15)' : 'scale(1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          height: 16,
        }}
      >
        {bars}
      </div>
      <span
        style={{
          marginLeft: 4,
          fontWeight: bump ? 700 : 500,
          color: bump ? (display >= 75 ? '#ff4d4f' : display >= 50 ? '#ff7a45' : '#52c41a') : 'inherit',
          transition: 'color 0.3s ease, font-weight 0.3s ease',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {display.toLocaleString()}
      </span>
    </div>
  );
};