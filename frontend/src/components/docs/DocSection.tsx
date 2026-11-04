import React from 'react';

interface DocSectionProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  desc?: string;
  /** 标题栏右侧操作区（刷新、导出等）。 */
  extra?: React.ReactNode;
  children: React.ReactNode;
}

/** 页内章节：白底、1px 边框、4px 小圆角，标题栏浅米色。 */
export const DocSection: React.FC<DocSectionProps> = ({ id, title, icon, desc, extra, children }) => (
  <section id={id} className="lc-doc-section">
    <div className="lc-doc-section-head">
      <span className="lc-doc-section-title">
        {icon}
        {title}
      </span>
      {extra ? <div className="lc-doc-section-extra">{extra}</div> : desc && <span className="lc-doc-section-desc">{desc}</span>}
    </div>
    <div className="lc-doc-section-body">{children}</div>
  </section>
);

interface DocItemProps {
  id?: string;
  title: React.ReactNode;
  desc?: string;
  extra?: React.ReactNode;
  children?: React.ReactNode;
}

/** 章节内的条目：用分隔线区隔，不使用嵌套大卡片。 */
export const DocItem: React.FC<DocItemProps> = ({ id, title, desc, extra, children }) => (
  <div id={id} className="lc-doc-item">
    <div className="lc-doc-item-head">
      <div>
        <div className="lc-doc-item-title">{title}</div>
        {desc && <div className="lc-doc-item-desc">{desc}</div>}
      </div>
      {extra && <div className="lc-doc-item-extra">{extra}</div>}
    </div>
    {children}
  </div>
);

interface DocNoteProps {
  children: React.ReactNode;
  type?: 'info' | 'success' | 'warning';
}

/** 提示条：左侧色条的扁平样式，替代大圆角 Alert。 */
export const DocNote: React.FC<DocNoteProps> = ({ children, type = 'info' }) => (
  <div className={`lc-doc-note lc-doc-note-${type}`}>{children}</div>
);

interface DocSubTitleProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const DocSubTitle: React.FC<DocSubTitleProps> = ({ children, style }) => (
  <div className="lc-doc-subtitle" style={style}>
    {children}
  </div>
);

interface DocTableProps {
  columns: string[];
  rows: React.ReactNode[][];
}

/** 简单扁平表格，用于参数/端点速查等轻量场景。 */
export const DocTable: React.FC<DocTableProps> = ({ columns, rows }) => (
  <div className="lc-doc-table-wrap">
    <table className="lc-doc-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
