import React from 'react';
import { LinkOutlined } from '@ant-design/icons';
import { DocSection, DocNote, DocCodeBlock } from '../docs';

interface IdFormatsSectionProps {
  baseUrl: string;
}

export const IdFormatsSection: React.FC<IdFormatsSectionProps> = ({ baseUrl }) => {
  return (
    <DocSection id="id-formats" title="题目 ID 格式" icon={<LinkOutlined />} desc="数字与 slug 等价">
      <p className="lc-doc-text">所有涉及题目标识的 API 都支持两种格式，您可以随意选择最方便的格式：</p>

      <div className="lc-doc-grid-2">
        <div className="lc-doc-panel">
          <div className="lc-doc-panel-title">数字格式</div>
          <p className="lc-doc-text">
            使用 LeetCode 题目的数字 ID，如 <code>1</code>、<code>2</code>、<code>3</code>，对应题目的 <code>frontend_id</code>。
          </p>
          <DocCodeBlock
            code={`# 获取题目 1 的历史数据
curl "${baseUrl}/api/hot100/online-counts/1"

# 导出题目 15 的数据
curl "${baseUrl}/api/hot100/export?problem_id=15"`}
          />
        </div>
        <div className="lc-doc-panel">
          <div className="lc-doc-panel-title">英文 slug 格式</div>
          <p className="lc-doc-text">
            使用题目的英文标识，如 <code>two-sum</code>、<code>add-two-numbers</code>，对应题目的 <code>slug</code>。
          </p>
          <DocCodeBlock
            code={`# 获取 two-sum 的历史数据
curl "${baseUrl}/api/hot100/online-counts/two-sum"

# 导出 two-sum 的数据
curl "${baseUrl}/api/hot100/export?problem_id=two-sum"`}
          />
        </div>
      </div>

      <DocNote type="success">
        同一个接口可以同时使用两种格式查询不同题目，后端会自动识别并解析。
      </DocNote>
    </DocSection>
  );
};
