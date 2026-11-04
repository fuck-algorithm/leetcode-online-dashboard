import React, { useEffect, useRef, useState } from 'react';
import { Menu, Typography } from 'antd';

const { Text } = Typography;

export interface DocAnchor {
  key: string;
  title: string;
}

interface DocLayoutProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  anchors?: DocAnchor[];
  activeAnchor?: string;
  onNavigate?: (key: string) => void;
  /** 排行榜这类单页数据视图不需要章节导航。 */
  showSidebar?: boolean;
  /** 数据页需要更宽的内容区，文档页保持 940px 阅读宽度。 */
  wide?: boolean;
  children: React.ReactNode;
}

/**
 * 文档页通用外壳：左侧固定章节导航 + 右侧内容区。
 * 三个文档页（API / MCP / Skills）共用，保证布局与视觉一致。
 */
export const DocLayout: React.FC<DocLayoutProps> = ({
  title,
  subtitle,
  icon,
  anchors,
  activeAnchor,
  onNavigate,
  showSidebar = true,
  wide = false,
  children,
}) => (
  <div className="lc-doc-page">
    {showSidebar && anchors && anchors.length > 0 && (
      <aside className="lc-doc-sidebar">
        <div className="lc-doc-sidebar-header">
          <span style={{ display: 'inline-flex', color: 'var(--lc-primary)' }}>{icon}</span>
          <Text strong style={{ fontSize: 14, color: 'var(--lc-text-primary)' }}>
            {title}
          </Text>
        </div>
        <Menu
          className="lc-doc-menu"
          mode="inline"
          selectedKeys={activeAnchor ? [activeAnchor] : []}
          style={{ borderRight: 0, paddingTop: 6 }}
          items={anchors.map((anchor) => ({
            key: anchor.key,
            label: anchor.title,
            onClick: () => onNavigate?.(anchor.key),
          }))}
        />
      </aside>
    )}

    <div className={`lc-doc-main${wide ? ' lc-doc-main-wide' : ''}${!showSidebar ? ' lc-doc-main-full' : ''}`}>
      <header className="lc-doc-header">
        <span className="lc-doc-header-title">
          <span style={{ display: 'inline-flex', color: 'var(--lc-primary)' }}>{icon}</span>
          <Text strong style={{ fontSize: 16, color: 'var(--lc-text-primary)' }}>
            {title}
          </Text>
          {subtitle && <span className="lc-doc-header-desc">{subtitle}</span>}
        </span>
      </header>

      <div className="lc-doc-body">{children}</div>
    </div>
  </div>
);

/**
 * 章节滚动高亮 + 平滑跳转。锚点顶部会留出全局导航与页头的吸附高度。
 */
export const useDocNavigation = (anchors: DocAnchor[], offset = 124) => {
  const [activeAnchor, setActiveAnchor] = useState(anchors[0]?.key ?? '');
  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;
  const keys = anchors.map((anchor) => anchor.key).join('|');

  useEffect(() => {
    const onScroll = () => {
      let current = anchorsRef.current[0]?.key ?? '';
      for (const anchor of anchorsRef.current) {
        const el = document.getElementById(anchor.key);
        if (!el) continue;
        // 留 2px 容差：scrollTo 落点会有亚像素误差，否则会卡在上一章
        if (el.getBoundingClientRect().top <= offset + 2) {
          current = anchor.key;
        }
      }
      // 最后一个章节可能因为页面高度不足而无法滚到 offset 位置，
      // 贴底时直接高亮最后一章，避免侧边栏停在倒数第二项。
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom && anchorsRef.current.length > 0) {
        current = anchorsRef.current[anchorsRef.current.length - 1].key;
      }
      setActiveAnchor(current);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [keys, offset]);

  const scrollTo = (key: string) => {
    const el = document.getElementById(key);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });
    setActiveAnchor(key);
  };

  return { activeAnchor, scrollTo };
};
