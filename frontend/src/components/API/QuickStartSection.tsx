import React from 'react';
import { ThunderboltOutlined } from '@ant-design/icons';
import { DocSection, DocNote, DocSubTitle, DocCodeBlock } from '../docs';

interface QuickStartSectionProps {
  baseUrl: string;
}

export const QuickStartSection: React.FC<QuickStartSectionProps> = ({ baseUrl }) => {
  return (
    <DocSection id="quickstart" title="快速开始" icon={<ThunderboltOutlined />} desc="三步完成第一次调用">
      <DocSubTitle style={{ marginTop: 0 }}>基础 URL</DocSubTitle>
      <div className="lc-doc-field">
        <code className="lc-doc-field-code">{baseUrl}</code>
        <span className="lc-doc-muted">所有 API 端点都基于此 URL</span>
      </div>

      <DocSubTitle>第一步：健康检查</DocSubTitle>
      <p className="lc-doc-text">在开始之前，先调用健康检查接口确认服务可用：</p>
      <DocCodeBlock code={`curl "${baseUrl}/api/health"`} />
      <p className="lc-doc-text lc-doc-muted" style={{ marginTop: 8 }}>
        预期响应：<code>{'{"code":200,"msg":"success","data":{"status":"healthy","timestamp":"..."}}'}</code>
      </p>

      <DocSubTitle>第二步：获取数据</DocSubTitle>
      <p className="lc-doc-text">获取 Hot 100 所有题目的实时在线人数：</p>
      <DocCodeBlock
        code={`curl "${baseUrl}/api/hot100" | jq '.[] | {id: .frontend_id, title: .title_cn, count: .online_count}'`}
      />

      <DocSubTitle>第三步：按需查询</DocSubTitle>
      <p className="lc-doc-text">拿到数据后，可以用题目 ID 或 slug 查询单题历史：</p>
      <DocCodeBlock code={`curl "${baseUrl}/api/hot100/online-counts/two-sum?limit=10"`} />

      <DocNote>
        所有端点都支持 CORS，可直接在浏览器页面中调用。缓存命中时响应头会带有 <code>X-Cache: HIT</code>，
        不消耗回源限流配额。
      </DocNote>
    </DocSection>
  );
};
