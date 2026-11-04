import React from 'react';
import { WarningOutlined } from '@ant-design/icons';
import { DocSection, DocNote, DocTable, DocCodeBlock } from '../docs';

const errorRows: React.ReactNode[][] = [
  [<code key="200">200</code>, '请求成功', '正常返回数据'],
  [<code key="400">400</code>, '请求参数错误', '请求参数格式不正确或缺少必要参数'],
  [<code key="404">404</code>, '资源不存在', '题目不存在或 slug 错误'],
  [<code key="500">500</code>, '服务器内部错误', '服务器处理请求时发生错误'],
  [<code key="503">503</code>, '服务不可用', '数据库连接失败或其他服务异常'],
];

export const ErrorsSection: React.FC = () => {
  return (
    <DocSection id="errors" title="错误处理" icon={<WarningOutlined />} desc="统一 code / msg / data">
      <p className="lc-doc-text">API 使用标准 HTTP 状态码，错误响应包含详细的错误信息：</p>

      <DocTable columns={['状态码', '错误信息', '说明']} rows={errorRows} />

      <DocNote>
        所有错误响应都使用统一的 <code>code / msg / data</code> 格式，便于客户端统一处理。
      </DocNote>
      <DocCodeBlock code={`{\n  "code": 404,\n  "msg": "Problem not found",\n  "data": null\n}`} language="json" />
    </DocSection>
  );
};

export const ApiFooter: React.FC = () => (
  <div className="lc-doc-footer">LeetCode Hot 100 Dashboard API · 为学习而生</div>
);
