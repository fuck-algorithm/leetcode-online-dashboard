import React from 'react';
import { Card, Typography, Table, Tag, Tabs, Button, Divider, Badge, Input, Space } from 'antd';
import { 
  BookOutlined, 
  CodeOutlined, 
  FileTextOutlined, 
  CopyOutlined, 
  CheckOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { APIEndpoint } from './types';
import { CodeBlock, JsonBlock } from './CodeBlocks';

const { Title, Paragraph, Text } = Typography;

interface EndpointsSectionProps {
  endpoints: APIEndpoint[];
  baseUrl: string;
  loading: Record<string, boolean>;
  response: Record<string, any>;
  copied: Record<string, boolean>;
  activeTab: Record<string, string>;
  paramValues: Record<string, Record<string, string>>;
  onTest: (endpoint: APIEndpoint, params: Record<string, string>) => void;
  onCopy: (text: string, key: string) => void;
  onParamChange: (endpointKey: string, paramName: string, value: string) => void;
  onTabChange: (endpointKey: string, tab: string) => void;
}

const buildCurl = (endpoint: APIEndpoint, baseUrl: string, params: Record<string, string> = {}): string => {
  let url = baseUrl + endpoint.path;
  
  if (endpoint.requestParams) {
    endpoint.requestParams.forEach(param => {
      if (param.required && params[param.name]) {
        url = url.replace(`:${param.name}`, params[param.name]);
      }
    });
  }
  
  const queryParams: string[] = [];
  if (endpoint.requestParams) {
    endpoint.requestParams.forEach(param => {
      if (!param.required && params[param.name] && params[param.name] !== param.default) {
        queryParams.push(`${param.name}=${encodeURIComponent(params[param.name])}`);
      }
    });
  }
  
  if (queryParams.length > 0) {
    url += '?' + queryParams.join('&');
  }
  
  return `curl -X ${endpoint.method} "${url}"`;
};

export const EndpointsSection: React.FC<EndpointsSectionProps> = ({
  endpoints,
  baseUrl,
  loading,
  response,
  copied,
  activeTab,
  paramValues,
  onTest,
  onCopy,
  onParamChange,
  onTabChange,
}) => {
  return (
    <section id="endpoints" style={{ marginBottom: 60 }}>
      <Title level={3}><BookOutlined /> API 端点详情</Title>
      
      {endpoints.map(endpoint => {
        const currentParams = paramValues[endpoint.key] || {};
        const currentCurl = buildCurl(endpoint, baseUrl, currentParams);
        const currentUrl = currentCurl.replace('curl -X GET ', '').replace(/"/g, '');
        
        return (
          <Card 
            key={endpoint.key}
            id={endpoint.key}
            bordered={false}
            style={{ marginBottom: 24 }}
            title={
              <Space align="center" size="middle">
                <Tag color={endpoint.method === 'GET' ? 'green' : 'blue'} style={{ fontSize: 14, padding: '4px 12px' }}>
                  {endpoint.method}
                </Tag>
                <Text code style={{ fontSize: 16 }}>{endpoint.path}</Text>
                <Text style={{ fontSize: 16 }}>{endpoint.title}</Text>
              </Space>
            }
          >
            {/* 描述 */}
            <Paragraph style={{ fontSize: 15, marginBottom: 16 }}>
              {endpoint.detailedDescription || endpoint.description}
            </Paragraph>

            {/* 使用场景 */}
            {endpoint.useCases && (
              <div style={{ marginBottom: 24 }}>
                <Text strong>典型使用场景：</Text>
                <ul style={{ marginTop: 8, marginLeft: 20 }}>
                  {endpoint.useCases.map((useCase, idx) => (
                    <li key={idx}><Text>{useCase}</Text></li>
                  ))}
                </ul>
              </div>
            )}

            {/* 请求参数 */}
            {endpoint.requestParams && endpoint.requestParams.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Title level={5}>请求参数</Title>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={endpoint.requestParams}
                  columns={[
                    { title: '参数名', dataIndex: 'name', key: 'name', render: (text: string) => <Text code>{text}</Text> },
                    { title: '类型', dataIndex: 'type', key: 'type', render: (text: string) => <Tag>{text}</Tag> },
                    { title: '必填', dataIndex: 'required', key: 'required', render: (required: boolean) => required ? <Tag color="red">是</Tag> : <Tag color="default">否</Tag> },
                    { title: '默认值', dataIndex: 'default', key: 'default', render: (text: string) => text || '-' },
                    { title: '描述', dataIndex: 'description', key: 'description' },
                    { 
                      title: '测试值', 
                      key: 'value', 
                      render: (_, record) => (
                        <Input
                          size="small"
                          style={{ width: 120 }}
                          placeholder={record.example || record.default}
                          value={currentParams[record.name] || ''}
                          onChange={(e) => onParamChange(endpoint.key, record.name, e.target.value)}
                        />
                      )
                    },
                  ]}
                />
              </div>
            )}

            {/* 响应字段 */}
            {endpoint.responseFields && (
              <div style={{ marginBottom: 24 }}>
                <Title level={5}>响应字段</Title>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={endpoint.responseFields}
                  columns={[
                    { title: '字段', dataIndex: 'field', key: 'field', render: (text: string) => <Text code>{text}</Text> },
                    { title: '类型', dataIndex: 'type', key: 'type', render: (text: string) => <Tag>{text}</Tag> },
                    { title: '描述', dataIndex: 'description', key: 'description' },
                  ]}
                />
              </div>
            )}

            {/* 选项卡 */}
            <Tabs
              defaultActiveKey="curl"
              activeKey={activeTab[endpoint.key] || 'curl'}
              onChange={(key) => onTabChange(endpoint.key, key)}
              items={[
                {
                  key: 'curl',
                  label: <span><CodeOutlined /> cURL</span>,
                  children: (
                    <div>
                      <div style={{ marginBottom: 12, padding: 12, background: '#f6ffed', borderRadius: 6 }}>
                        <Text type="secondary">请求 URL：</Text>
                        <Text code copyable style={{ marginLeft: 8 }}>{currentUrl}</Text>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <CodeBlock code={currentCurl} language="bash" />
                        <Button
                          size="small"
                          icon={copied[`${endpoint.key}-curl`] ? <CheckOutlined /> : <CopyOutlined />}
                          style={{ position: 'absolute', top: 8, right: 60 }}
                          onClick={() => onCopy(currentCurl, `${endpoint.key}-curl`)}
                        >
                          {copied[`${endpoint.key}-curl`] ? '已复制' : '复制'}
                        </Button>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'response',
                  label: <span><FileTextOutlined /> 响应示例</span>,
                  children: (
                    <div style={{ position: 'relative' }}>
                      <JsonBlock data={endpoint.responseExample} />
                      <Button
                        size="small"
                        icon={copied[`${endpoint.key}-response`] ? <CheckOutlined /> : <CopyOutlined />}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                        onClick={() => onCopy(JSON.stringify(endpoint.responseExample, null, 2), `${endpoint.key}-response`)}
                      >
                        {copied[`${endpoint.key}-response`] ? '已复制' : '复制'}
                      </Button>
                    </div>
                  ),
                },
                ...(endpoint.errorExamples ? [{
                  key: 'errors',
                  label: <span><Badge count={endpoint.errorExamples.length} style={{ backgroundColor: '#ff4d4f' }} /> 错误响应</span>,
                  children: (
                    <div>
                      {endpoint.errorExamples.map((err, idx) => (
                        <div key={idx} style={{ marginBottom: 16 }}>
                          <Tag color="error">HTTP {err.code}</Tag>
                          <Text style={{ marginLeft: 8 }}>{err.message}</Text>
                          <JsonBlock data={err.example} />
                        </div>
                      ))}
                    </div>
                  ),
                }] : []),
              ]}
            />

            {/* 在线测试 */}
            <div style={{ marginTop: 16, padding: 16, background: '#f6f8fa', borderRadius: 6 }}>
              <Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={loading[endpoint.key]}
                  onClick={() => onTest(endpoint, currentParams)}
                >
                  在线测试
                </Button>
                <Text type="secondary">点击按钮直接在浏览器中测试此接口</Text>
              </Space>
            </div>

            {/* 测试结果 */}
            {response[endpoint.key] && (
              <div style={{ marginTop: 16 }}>
                <Divider>
                  <Badge status="processing" text="响应结果" />
                </Divider>
                <div style={{ position: 'relative' }}>
                  <JsonBlock data={response[endpoint.key]} />
                  <Button
                    size="small"
                    icon={copied[`${endpoint.key}-result`] ? <CheckOutlined /> : <CopyOutlined />}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                    onClick={() => onCopy(JSON.stringify(response[endpoint.key], null, 2), `${endpoint.key}-result`)}
                  >
                    {copied[`${endpoint.key}-result`] ? '已复制' : '复制'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </section>
  );
};
