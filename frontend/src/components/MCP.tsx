import React, { useEffect, useMemo, useState } from 'react';
import {
  CloudOutlined,
  CodeOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import {
  DocLayout,
  useDocNavigation,
  DocSection,
  DocItem,
  DocNote,
  DocSubTitle,
  DocTable,
  DocCodeBlock,
  DocJsonBlock,
} from './docs';

const MCP: React.FC = () => {
  const [serverUrl, setServerUrl] = useState<string>('');

  useEffect(() => {
    // 开发环境后端在 52106；Docker 部署时 nginx 已把 /mcp、/sse 反代到后端，用同源地址即可
    const backendUrl = import.meta.env.DEV
      ? `http://${window.location.hostname}:52106`
      : window.location.origin;
    setServerUrl(backendUrl);
  }, []);

  const anchors = useMemo(
    () => [
      { key: 'overview', title: '概览' },
      { key: 'quickstart', title: '快速接入' },
      { key: 'tools', title: '可用工具' },
      { key: 'id-format', title: '题目 ID 格式' },
      { key: 'clients', title: '客户端支持' },
    ],
    []
  );
  const { activeAnchor, scrollTo } = useDocNavigation(anchors);

  // SSE transport configuration (Cherry Studio, Claude Desktop, Cursor)
  const sseConfig = JSON.stringify(
    {
      mcpServers: {
        'leetcode-dashboard': {
          type: 'sse',
          url: serverUrl + '/mcp/sse',
        },
      },
    },
    null,
    2
  );

  // Streamable HTTP transport configuration (modern standard)
  const streamableHttpConfig = JSON.stringify(
    {
      mcpServers: {
        'leetcode-dashboard': {
          type: 'streamable-http',
          url: serverUrl + '/mcp',
        },
      },
    },
    null,
    2
  );

  const tools = [
    {
      name: 'get_hot100_problems',
      description: '获取 LeetCode Hot 100 题目完整列表（含题目信息与在线人数）',
      parameters: [],
      returns: '包含 100 道题目信息与在线人数的数组',
      responseExample: {
        frontend_id: '1',
        slug: 'two-sum',
        title: 'Two Sum',
        title_cn: '两数之和',
        difficulty: 'EASY',
        paid_only: false,
        topic_tags: ['数组', '哈希表'],
        online_count: 334,
        online_count_cn: 334,
        online_count_com: 0,
        online_count_total: 334,
        last_updated: '2026-10-30T01:00:00+08:00',
      },
    },
    {
      name: 'get_hot100_online_count',
      description: '获取 LeetCode Hot 100 题目的最新实时在线人数',
      parameters: [],
      returns: '包含 100 道题目在线人数的数组',
      responseExample: [
        {
          frontend_id: '1',
          slug: 'two-sum',
          title: 'Two Sum',
          title_cn: '两数之和',
          difficulty: 'EASY',
          paid_only: false,
          topic_tags: ['数组', '哈希表'],
          online_count: 476,
          online_count_cn: 476,
          online_count_com: 0,
          online_count_total: 476,
          last_updated: '2026-10-30T23:56:08+08:00',
        },
      ],
    },
    {
      name: 'get_problem_history',
      description: '根据题目号获取历史在线人数数据',
      parameters: [
        {
          name: 'problem_id',
          type: 'string',
          required: true,
          description: '题目号，支持数字（如 "1"）或英文 slug（如 "two-sum"）',
        },
        { name: 'limit', type: 'number', required: false, description: '返回记录数，默认 100' },
      ],
      returns: '历史在线人数记录数组',
      responseExample: [
        {
          id: 295140,
          frontend_id: '1',
          count_cn: 475,
          count_com: 0,
          count_total: 475,
          timestamp: '2026-10-30T23:55:26+08:00',
        },
        {
          id: 295040,
          frontend_id: '1',
          count_cn: 476,
          count_com: 0,
          count_total: 476,
          timestamp: '2026-10-30T23:54:26+08:00',
        },
      ],
    },
    {
      name: 'get_problem_online_count',
      description: '获取单个题目的最新在线人数',
      parameters: [
        {
          name: 'problem_id',
          type: 'string',
          required: true,
          description: '题目号，支持数字（如 "1"）或英文 slug（如 "two-sum"）',
        },
      ],
      returns: '题目在线人数详情',
      responseExample: {
        frontend_id: '1',
        slug: 'two-sum',
        title: 'Two Sum',
        title_cn: '两数之和',
        difficulty: 'EASY',
        paid_only: false,
        topic_tags: ['数组', '哈希表'],
        online_count: 475,
        online_count_cn: 475,
        online_count_com: 0,
        online_count_total: 475,
        last_updated: '2026-10-30T23:55:26+08:00',
      },
    },
  ];

  return (
    <DocLayout
      title="MCP 文档"
      subtitle="通过 MCP 协议让 AI 助手直接访问 LeetCode Hot 100 实时数据"
      icon={<CloudOutlined style={{ fontSize: 18 }} />}
      anchors={anchors}
      activeAnchor={activeAnchor}
      onNavigate={scrollTo}
    >
      <DocSection id="overview" title="概览" icon={<ApiOutlined />} desc="Model Context Protocol">
        <p className="lc-doc-text">
          MCP（Model Context Protocol）是由 Anthropic 推出的开放协议，允许 AI 助手通过标准化接口访问外部数据源和工具。
          接入本服务后，AI 可以直接查询 Hot 100 题目列表、单题在线人数和历史趋势，并在对话中完成对比与统计。
        </p>
        <div className="lc-stat-grid">
          <div className="lc-stat">
            <div className="lc-stat-label">推荐传输</div>
            <div className="lc-stat-value">Streamable HTTP</div>
          </div>
          <div className="lc-stat">
            <div className="lc-stat-label">兼容传输</div>
            <div className="lc-stat-value">SSE</div>
          </div>
          <div className="lc-stat">
            <div className="lc-stat-label">只读工具</div>
            <div className="lc-stat-value">4 个</div>
          </div>
          <div className="lc-stat">
            <div className="lc-stat-label">数据刷新</div>
            <div className="lc-stat-value">每 30 秒</div>
          </div>
        </div>
        <DocNote>
          MCP 工具返回的数据与 REST API 同源，统一采用 <code>code / msg / data</code> 结构；所有工具均为只读查询，
          AI 客户端不需要额外确认即可调用。
        </DocNote>
      </DocSection>

      <DocSection id="quickstart" title="快速接入" icon={<ThunderboltOutlined />} desc="配置端点后重启客户端即可">
        <DocSubTitle>端点速查</DocSubTitle>
        <DocTable
          columns={['传输方式', '端点', '说明']}
          rows={[
            [
              <strong key="streamable">Streamable HTTP</strong>,
              <code key="streamable-url">{serverUrl}/mcp</code>,
              '推荐，新客户端使用',
            ],
            [
              <strong key="sse">SSE</strong>,
              <code key="sse-url">{serverUrl}/mcp/sse</code>,
              <>旧客户端使用；消息端点 <code>{serverUrl}/mcp/message</code></>,
            ],
            [
              <strong key="manifest">工具清单</strong>,
              <code key="manifest-url">{serverUrl}/mcp/manifest</code>,
              'JSON 格式的工具定义',
            ],
            [
              <strong key="alias">旧式 SSE 别名</strong>,
              <code key="alias-url">{serverUrl}/sse</code>,
              '兼容早期配置',
            ],
          ]}
        />

        <DocSubTitle>客户端配置</DocSubTitle>
        <div className="lc-doc-config">
          <div className="lc-doc-config-title">
            <CodeOutlined /> Cherry Studio / Claude Desktop / Cursor（SSE）
          </div>
          <DocCodeBlock code={sseConfig} language="json" maxHeight={300} />
        </div>
        <div className="lc-doc-config">
          <div className="lc-doc-config-title">
            <CodeOutlined /> Streamable HTTP（新标准）
          </div>
          <DocCodeBlock code={streamableHttpConfig} language="json" maxHeight={300} />
        </div>

        <DocSubTitle>三步开始使用</DocSubTitle>
        <ol className="lc-doc-steps">
          <li>
            <strong>添加配置：</strong>把上面的 JSON 片段合并到客户端的 MCP 配置文件中。
          </li>
          <li>
            <strong>重启客户端：</strong>保存配置后重启 AI 客户端，MCP 服务器会自动连接。
          </li>
          <li>
            <strong>直接提问：</strong>例如「Hot 100 中现在最多人在做哪道题？」或「查询 two-sum 的历史在线人数」。
          </li>
        </ol>
      </DocSection>

      <DocSection id="tools" title="可用工具" icon={<CodeOutlined />} desc="4 个只读查询工具">
        {tools.map((tool) => (
          <DocItem
            key={tool.name}
            title={<code className="lc-tool-name">{tool.name}</code>}
            desc={tool.description}
          >
            {tool.parameters.length > 0 ? (
              <DocTable
                columns={['参数', '类型', '必填', '说明']}
                rows={tool.parameters.map((param) => [
                  <code key={`${tool.name}-${param.name}`}>{param.name}</code>,
                  <span key={`${tool.name}-${param.name}-type`} className="lc-chip">{param.type}</span>,
                  <span key={`${tool.name}-${param.name}-required`} className={param.required ? 'lc-required' : 'lc-optional'}>
                    {param.required ? '是' : '否'}
                  </span>,
                  param.description,
                ])}
              />
            ) : (
              <div className="lc-doc-text lc-doc-muted">无参数</div>
            )}
            <div className="lc-doc-field">
              <span className="lc-doc-field-label">返回</span>
              {tool.returns}
            </div>
            <DocSubTitle style={{ marginTop: 10 }}>响应示例</DocSubTitle>
            <DocJsonBlock data={tool.responseExample} maxHeight={320} />
          </DocItem>
        ))}
      </DocSection>

      <DocSection id="id-format" title="题目 ID 格式" icon={<DatabaseOutlined />} desc="数字与 slug 等价">
        <p className="lc-doc-text">所有 MCP 工具都支持两种题目号格式，任选其一：</p>
        <div className="lc-doc-grid-2">
          <div className="lc-doc-panel">
            <div className="lc-doc-panel-title">数字格式</div>
            <p className="lc-doc-text">
              如 <code>"1"</code>、<code>"2"</code>、<code>"42"</code>，对应题目的 <code>frontend_id</code>。
            </p>
            <div className="lc-doc-muted">示例：「查询题目 1 的在线人数」「查看第 42 题的历史数据」</div>
          </div>
          <div className="lc-doc-panel">
            <div className="lc-doc-panel-title">英文 slug 格式</div>
            <p className="lc-doc-text">
              如 <code>"two-sum"</code>、<code>"add-two-numbers"</code>，对应题目的 <code>slug</code>。
            </p>
            <div className="lc-doc-muted">示例：「获取 two-sum 的最新数据」「分析 trapping-rain-water 的趋势」</div>
          </div>
        </div>
        <DocNote type="success">
          <strong>对话示例</strong>
          <ul>
            <li>Hot 100 中现在最多人在做哪道题？</li>
            <li>查询 two-sum 过去 24 小时的在线人数变化</li>
            <li>对比第 1 题和第 15 题的实时热度</li>
            <li>列出所有 Hard 题目的当前在线人数</li>
          </ul>
        </DocNote>
      </DocSection>

      <DocSection id="clients" title="客户端支持" icon={<CheckCircleOutlined />} desc="任何兼容 MCP 的客户端">
        <div className="lc-chip-row">
          {['Claude Desktop', 'Cursor', 'Cline', 'Continue', 'Cherry Studio', '其他 MCP 兼容客户端'].map((client) => (
            <span key={client} className="lc-chip">
              {client}
            </span>
          ))}
        </div>
        <p className="lc-doc-text" style={{ marginBottom: 0 }}>
          只要客户端支持 MCP 协议（Streamable HTTP 或 SSE），都可以直接使用本服务，无需额外部署。
        </p>
      </DocSection>

      <div className="lc-doc-footer">文档基于当前实例自动生成 · {serverUrl}</div>
    </DocLayout>
  );
};

export default MCP;
