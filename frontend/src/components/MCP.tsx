import React from 'react';
import { Card, Typography, Space, Tag, Divider, Alert, Steps, Button, Tooltip } from 'antd';
import { CloudOutlined, CodeOutlined, ThunderboltOutlined, CheckCircleOutlined, DatabaseOutlined, CopyOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

// JSON 高亮组件
const JsonBlock: React.FC<{ data: any }> = ({ data }) => {
  const jsonStr = JSON.stringify(data, null, 2);
  return (
    <pre style={{ 
      background: '#1e1e1e', 
      color: '#d4d4d4',
      padding: 16, 
      borderRadius: 8, 
      fontFamily: 'Consolas, Monaco, "Courier New", monospace', 
      fontSize: 13,
      overflow: 'auto',
      maxHeight: 400,
      lineHeight: 1.6,
      margin: 0,
      position: 'relative'
    }}>
      <div style={{ 
        position: 'absolute', 
        top: 8, 
        right: 8, 
        color: '#6a9955', 
        fontSize: 11,
        background: '#2d2d2d',
        padding: '2px 8px',
        borderRadius: 4
      }}>json</div>
      <code style={{ color: '#d4d4d4' }}>
        {jsonStr.split('\n').map((line, i) => (
          <div key={i} style={{ display: 'flex' }}>
            <span style={{ 
              color: '#858585', 
              minWidth: 30, 
              textAlign: 'right', 
              marginRight: 12,
              userSelect: 'none'
            }}>{i + 1}</span>
            <span style={{ color: '#d4d4d4' }} dangerouslySetInnerHTML={{
              __html: line
                .replace(/"([^"]+)":/g, '<span style="color:#9cdcfe">"$1"</span>:')
                .replace(/: "([^"]*)"/g, ': <span style="color:#ce9178">"$1"</span>')
                .replace(/: (\d+)/g, ': <span style="color:#b5cea8">$1</span>')
                .replace(/: (true|false|null)/g, ': <span style="color:#569cd6">$1</span>')
            }} />
          </div>
        ))}
      </code>
    </pre>
  );
};

const MCP: React.FC = () => {
  const serverUrl = window.location.origin;

  const mcpConfig = JSON.stringify({
    "mcpServers": {
      "leetcode-dashboard": {
        "command": "npx",
        "args": [
          "-y",
          "@modelcontextprotocol/server-http",
          serverUrl + "/mcp"
        ]
      }
    }
  }, null, 2);

  const claudeConfig = JSON.stringify({
    "mcpServers": {
      "leetcode-dashboard": {
        "url": serverUrl + "/mcp"
      }
    }
  }, null, 2);

  const tools = [
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
                  <Card size="small" title="Claude Desktop 配置 (~/.config/claude/claude_desktop_config.json)">
                    <div style={{ position: 'relative' }}>
                      <pre style={{ 
                        background: '#1e1e1e', 
                        color: '#d4d4d4',
                        padding: 16, 
                        borderRadius: 8, 
                        fontFamily: 'Consolas, Monaco, monospace', 
                        fontSize: 12,
                        overflow: 'auto',
                        maxHeight: 300,
                        margin: 0,
                        position: 'relative'
                      }}>
                        <div style={{ 
                          position: 'absolute', 
                          top: 8, 
                          right: 8, 
                          color: '#6a9955', 
                          fontSize: 11,
                          background: '#2d2d2d',
                          padding: '2px 8px',
                          borderRadius: 4
                        }}>json</div>
                        <code style={{ color: '#d4d4d4' }}>{claudeConfig}</code>
                      </pre>
                      <Tooltip title="复制配置">
                        <Button
                          type="text"
                          icon={<CopyOutlined />}
                          size="small"
                          style={{ position: 'absolute', top: 8, right: 60, color: '#d4d4d4' }}
                          onClick={() => navigator.clipboard.writeText(claudeConfig)}
                        />
                      </Tooltip>
                    </div>
                  </Card>
                  <Card size="small" title="通用 MCP 配置">
                    <div style={{ position: 'relative' }}>
                      <pre style={{ 
                        background: '#1e1e1e', 
                        color: '#d4d4d4',
                        padding: 16, 
                        borderRadius: 8, 
                        fontFamily: 'Consolas, Monaco, monospace', 
                        fontSize: 12,
                        overflow: 'auto',
                        maxHeight: 300,
                        margin: 0,
                        position: 'relative'
                      }}>
                        <div style={{ 
                          position: 'absolute', 
                          top: 8, 
                          right: 8, 
                          color: '#6a9955', 
                          fontSize: 11,
                          background: '#2d2d2d',
                          padding: '2px 8px',
                          borderRadius: 4
                        }}>json</div>
                        <code style={{ color: '#d4d4d4' }}>{mcpConfig}</code>
                      </pre>
                      <Tooltip title="复制配置">
                        <Button
                          type="text"
                          icon={<CopyOutlined />}
                          size="small"
                          style={{ position: 'absolute', top: 8, right: 60, color: '#d4d4d4' }}
                          onClick={() => navigator.clipboard.writeText(mcpConfig)}
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
                size="small"
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
                  <JsonBlock data={tool.responseExample} />
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
