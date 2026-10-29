import React, { useState, useEffect } from 'react';
import { Card, Typography, Space, Tag, Divider, Alert, Steps, Button, Tooltip } from 'antd';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CloudOutlined, CodeOutlined, CheckCircleOutlined, DatabaseOutlined, CopyOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

const MCP: React.FC = () => {
  const [serverUrl, setServerUrl] = useState<string>('');

  useEffect(() => {
    // 开发环境后端在 52106；Docker 部署时 nginx 已把 /mcp、/sse 反代到后端，用同源地址即可
    const backendUrl = import.meta.env.DEV
      ? `http://${window.location.hostname}:52106`
      : window.location.origin;
    setServerUrl(backendUrl);
  }, []);

  // SSE transport configuration (Cherry Studio, Claude Desktop, Cursor)
  const sseConfig = JSON.stringify({
    "mcpServers": {
      "leetcode-dashboard": {
        "type": "sse",
        "url": serverUrl + "/mcp/sse"
      }
    }
  }, null, 2);

  // Streamable HTTP transport configuration (modern standard)
  const streamableHttpConfig = JSON.stringify({
    "mcpServers": {
      "leetcode-dashboard": {
        "type": "streamable-http",
        "url": serverUrl + "/mcp"
      }
    }
  }, null, 2);

  const tools = [
    {
      name: 'get_hot100_problems',
      description: '获取LeetCode Hot 100题目完整列表（含题目信息与在线人数）',
      parameters: [],
      returns: '包含100道题目信息与在线人数的数组',
      responseExample: {
        frontend_id: "1",
        slug: "two-sum",
        title: "Two Sum",
        title_cn: "两数之和",
        difficulty: "EASY",
        paid_only: false,
        topic_tags: ["数组", "哈希表"],
        online_count: 334,
        online_count_cn: 334,
        online_count_com: 0,
        online_count_total: 334,
        last_updated: "2026-10-30T01:00:00+08:00"
      }
    },
    {
      name: 'get_hot100_online_count',
      description: '获取LeetCode Hot 100题目的最新实时在线人数',
      parameters: [],
      returns: '包含100道题目在线人数的数组',
      responseExample: {
        code: 200,
        msg: "success",
        data: [
          { frontend_id: "1", slug: "two-sum", title: "两数之和", difficulty: "EASY", online_count: 334, last_updated: "2026-02-21T00:15:15Z" }
        ]
      }
    },
    {
      name: 'get_problem_history',
      description: '根据题目号获取历史在线人数数据',
      parameters: [
        { name: 'problem_id', type: 'string', description: '题目号，支持数字(如"1")或英文slug(如"two-sum")', optional: false },
        { name: 'limit', type: 'number', description: '返回记录数，默认100', optional: true },
      ],
      returns: '历史在线人数记录数组',
      responseExample: {
        code: 200,
        msg: "success",
        data: [
          { id: 1, frontend_id: "1", count: 334, timestamp: "2026-02-21T00:15:15Z" },
          { id: 2, frontend_id: "1", count: 328, timestamp: "2026-02-21T00:14:15Z" }
        ]
      }
    },
    {
      name: 'get_problem_online_count',
      description: '获取单个题目的最新在线人数',
      parameters: [
        { name: 'problem_id', type: 'string', description: '题目号，支持数字(如"1")或英文slug(如"two-sum")', optional: false },
      ],
      returns: '题目在线人数详情',
      responseExample: {
        code: 200,
        msg: "success",
        data: { frontend_id: "1", slug: "two-sum", title: "两数之和", difficulty: "EASY", online_count: 334, last_updated: "2026-02-21T00:15:15Z" }
      }
    },
  ];

  return (
    <div className="mcp-container">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space align="start">
            <CloudOutlined style={{ fontSize: 32, color: '#52c41a' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>Model Context Protocol (MCP)</Title>
              <Paragraph type="secondary">
                通过 MCP 协议让 AI 助手直接访问 LeetCode Hot 100 的实时数据
              </Paragraph>
            </div>
          </Space>
        </Card>

        <Alert
          message="什么是 MCP？"
          description="MCP (Model Context Protocol) 是由 Anthropic 推出的开放协议，允许 AI 助手通过标准化的接口访问外部数据源和工具。通过 MCP，AI 可以直接查询题目在线人数、历史数据等信息。"
          type="info"
          showIcon
        />

        <Alert
          message="响应格式说明"
          description="所有 MCP 工具返回的数据都采用统一的 code/msg/data 格式，与 API 文档保持一致。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Card title={<><ThunderboltOutlined /> 快速接入</>}>
          <Steps direction="vertical" current={-1}>
            <Step
              title="配置 MCP 客户端"
              description={
                <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
                  <Text>在您的 MCP 客户端（如 Claude Desktop、Cursor 等）中添加以下配置：</Text>
                  
                  <Alert
                    message="端点速查"
                    description={
                      <span>
                        <strong>Streamable HTTP</strong>（推荐，新客户端）：<code>{serverUrl}/mcp</code><br/>
                        <strong>SSE</strong>（旧客户端）：<code>{serverUrl}/mcp/sse</code>，消息端点 <code>{serverUrl}/mcp/message</code><br/>
                        <strong>工具清单 JSON</strong>：<code>{serverUrl}/mcp/manifest</code><br/>
                        <strong>旧式 SSE 别名</strong>：<code>{serverUrl}/sse</code>
                      </span>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  
                  <Card title="Cherry Studio / Claude Desktop / Cursor (SSE Transport)">
                    <div style={{ position: 'relative' }}>
                      <SyntaxHighlighter
                        language="json"
                        style={vscDarkPlus}
                        customStyle={{
                          margin: 0,
                          borderRadius: 8,
                          fontSize: 12,
                          maxHeight: 300,
                          padding: 16,
                        }}
                      >
                        {sseConfig}
                      </SyntaxHighlighter>
                      <Tooltip title="复制配置">
                        <Button
                          type="text"
                          icon={<CopyOutlined />}
                          style={{ position: 'absolute', top: 8, right: 8, color: '#fff', background: 'rgba(0,0,0,0.5)' }}
                          onClick={() => navigator.clipboard.writeText(sseConfig)}
                        />
                      </Tooltip>
                    </div>
                  </Card>
                  
                  <Card title="Streamable HTTP Transport (新标准)">
                    <div style={{ position: 'relative' }}>
                      <SyntaxHighlighter
                        language="json"
                        style={vscDarkPlus}
                        customStyle={{
                          margin: 0,
                          borderRadius: 8,
                          fontSize: 12,
                          maxHeight: 300,
                          padding: 16,
                        }}
                      >
                        {streamableHttpConfig}
                      </SyntaxHighlighter>
                      <Tooltip title="复制配置">
                        <Button
                          type="text"
                          icon={<CopyOutlined />}
                          style={{ position: 'absolute', top: 8, right: 8, color: '#fff', background: 'rgba(0,0,0,0.5)' }}
                          onClick={() => navigator.clipboard.writeText(streamableHttpConfig)}
                        />
                      </Tooltip>
                    </div>
                  </Card>
                </Space>
              }
            />
            <Step
              title="重启客户端"
              description="保存配置后重启您的 AI 客户端，MCP 服务器将自动连接"
            />
            <Step
              title="开始使用"
              description="现在您可以向 AI 询问：'Hot 100 中哪道题现在最多人在做？' 或 '查询 two-sum 的历史在线人数'"
            />
          </Steps>
        </Card>

        <Card title={<><CodeOutlined /> 可用工具</>}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {tools.map((tool) => (
              <Card
                key={tool.name}
                title={
                  <Space>
                    <Tag color="blue">{tool.name}</Tag>
                    <Text type="secondary">{tool.description}</Text>
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {tool.parameters.length > 0 && (
                    <>
                      <Text strong>参数：</Text>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {tool.parameters.map((param) => (
                          <li key={param.name}>
                            <Text code>{param.name}</Text> <Tag>{param.type}</Tag>
                            {' - '}{param.description}
                            {param.optional && <Tag style={{ marginLeft: 8 }}>可选</Tag>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <Text strong>返回：</Text>
                  <Text>{tool.returns}</Text>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text strong>响应示例：</Text>
                  <SyntaxHighlighter
                    language="json"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      borderRadius: 8,
                      fontSize: 12,
                      maxHeight: 300,
                      padding: 16,
                    }}
                  >
                    {JSON.stringify(tool.responseExample, null, 2)}
                  </SyntaxHighlighter>
                </Space>
              </Card>
            ))}
          </Space>
        </Card>

        <Card title={<><DatabaseOutlined /> 题目ID格式</>}>
          <Paragraph>
            MCP 工具支持两种题目号格式：
          </Paragraph>
          <ul>
            <li>
              <Text strong>数字格式：</Text> 如 <Text code>"1"</Text>、<Text code>"2"</Text>、<Text code>"3"</Text>
              <br />
              <Text type="secondary">示例："查询题目 1 的在线人数" 或 "查看第 42 题的历史数据"</Text>
            </li>
            <li>
              <Text strong>英文格式：</Text> 如 <Text code>"two-sum"</Text>、<Text code>"add-two-numbers"</Text>
              <br />
              <Text type="secondary">示例："获取 two-sum 的最新数据" 或 "分析 trapping-rain-water 的趋势"</Text>
            </li>
          </ul>
          <Divider />
          <Alert
            message="使用示例"
            description={
              <ul style={{ margin: 0 }}>
                <li>"Hot 100 中现在最多人在做哪道题？"</li>
                <li>"查询 two-sum 过去24小时的在线人数变化"</li>
                <li>"对比第 1 题和第 15 题的实时热度"</li>
                <li>"列出所有 Hard 题目的当前在线人数"</li>
              </ul>
            }
            type="success"
            showIcon
          />
        </Card>

        <Card title={<><CheckCircleOutlined /> 支持的客户端</>}>
          <Space wrap>
            <Tag color="purple">Claude Desktop</Tag>
            <Tag color="blue">Cursor</Tag>
            <Tag color="cyan">Cline</Tag>
            <Tag color="green">Continue</Tag>
            <Tag color="orange">其他 MCP 兼容客户端</Tag>
          </Space>
          <Divider />
          <Paragraph type="secondary">
            任何支持 MCP 协议的 AI 客户端都可以使用我们的服务。
          </Paragraph>
        </Card>
      </Space>
    </div>
  );
};

export default MCP;
