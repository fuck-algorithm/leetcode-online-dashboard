import React from 'react';
import { Table, Tabs, Button, Input, Space } from 'antd';
import {
  BookOutlined,
  CodeOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { APIEndpoint } from './types';
import { DocSection, DocItem, DocSubTitle, DocTable, DocCodeBlock, DocJsonBlock } from '../docs';

interface EndpointsSectionProps {
  endpoints: APIEndpoint[];
  baseUrl: string;
  loading: Record<string, boolean>;
  response: Record<string, any>;
  activeTab: Record<string, string>;
  paramValues: Record<string, Record<string, string>>;
  onTest: (endpoint: APIEndpoint, params: Record<string, string>) => void;
  onParamChange: (endpointKey: string, paramName: string, value: string) => void;
  onTabChange: (endpointKey: string, tab: string) => void;
}

const buildCurl = (endpoint: APIEndpoint, baseUrl: string, params: Record<string, string> = {}): string => {
  let url = baseUrl + endpoint.path;

  if (endpoint.requestParams) {
    endpoint.requestParams.forEach((param) => {
      if (param.required && params[param.name]) {
        url = url.replace(`:${param.name}`, params[param.name]);
      }
    });
  }

  const queryParams: string[] = [];
  if (endpoint.requestParams) {
    endpoint.requestParams.forEach((param) => {
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
  activeTab,
  paramValues,
  onTest,
  onParamChange,
  onTabChange,
}) => {
  return (
    <DocSection id="endpoints" title="API 端点详情" icon={<BookOutlined />} desc="点击左侧导航可快速定位">
      {endpoints.map((endpoint) => {
        const currentParams = paramValues[endpoint.key] || {};
        const currentCurl = buildCurl(endpoint, baseUrl, currentParams);
        const currentUrl = currentCurl.replace('curl -X GET ', '').replace(/"/g, '');

        return (
          <DocItem
            key={endpoint.key}
            id={endpoint.key}
            title={
              <span className="lc-endpoint-title">
                <span className={`lc-method lc-method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
                <code className="lc-endpoint-path">{endpoint.path}</code>
                <span className="lc-endpoint-name">{endpoint.title}</span>
              </span>
            }
            desc={endpoint.detailedDescription || endpoint.description}
          >
            {/* 使用场景 */}
            {endpoint.useCases && (
              <>
                <DocSubTitle style={{ marginTop: 4 }}>典型使用场景</DocSubTitle>
                <ul className="lc-doc-list compact">
                  {endpoint.useCases.map((useCase, index) => (
                    <li key={index}>{useCase}</li>
                  ))}
                </ul>
              </>
            )}

            {/* 请求参数 */}
            {endpoint.requestParams && endpoint.requestParams.length > 0 && (
              <>
                <DocSubTitle>请求参数</DocSubTitle>
                <Table
                  className="lc-doc-antd-table"
                  size="small"
                  pagination={false}
                  dataSource={endpoint.requestParams}
                  columns={[
                    {
                      title: '参数名',
                      dataIndex: 'name',
                      key: 'name',
                      render: (text: string) => <code>{text}</code>,
                    },
                    {
                      title: '类型',
                      dataIndex: 'type',
                      key: 'type',
                      render: (text: string) => <span className="lc-chip">{text}</span>,
                    },
                    {
                      title: '必填',
                      dataIndex: 'required',
                      key: 'required',
                      render: (required: boolean) =>
                        required ? <span className="lc-required">是</span> : <span className="lc-optional">否</span>,
                    },
                    {
                      title: '默认值',
                      dataIndex: 'default',
                      key: 'default',
                      render: (text: string) => text || '-',
                    },
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
                      ),
                    },
                  ]}
                />
              </>
            )}

            {/* 响应字段 */}
            {endpoint.responseFields && (
              <>
                <DocSubTitle>响应字段</DocSubTitle>
                <DocTable
                  columns={['字段', '类型', '描述']}
                  rows={endpoint.responseFields.map((field) => [
                    <code key={field.field}>{field.field}</code>,
                    <span key={`${field.field}-type`} className="lc-chip">{field.type}</span>,
                    field.description,
                  ])}
                />
              </>
            )}

            {/* 请求示例 / 响应示例 */}
            <Tabs
              className="lc-doc-tabs"
              defaultActiveKey="curl"
              activeKey={activeTab[endpoint.key] || 'curl'}
              onChange={(key) => onTabChange(endpoint.key, key)}
              items={[
                {
                  key: 'curl',
                  label: (
                    <span>
                      <CodeOutlined /> cURL
                    </span>
                  ),
                  children: (
                    <div>
                      <div className="lc-doc-field">
                        <span className="lc-doc-field-label">请求 URL</span>
                        <code className="lc-doc-field-code">{currentUrl}</code>
                      </div>
                      <DocCodeBlock code={currentCurl} language="bash" />
                    </div>
                  ),
                },
                {
                  key: 'response',
                  label: (
                    <span>
                      <FileTextOutlined /> 响应示例
                    </span>
                  ),
                  children: <DocJsonBlock data={endpoint.responseExample} />,
                },
                ...(endpoint.errorExamples
                  ? [
                      {
                        key: 'errors',
                        label: (
                          <span>
                            <WarningOutlined /> 错误响应
                          </span>
                        ),
                        children: (
                          <div>
                            {endpoint.errorExamples.map((err, index) => (
                              <div key={index} className="lc-doc-error">
                                <div className="lc-doc-error-head">
                                  <span className="lc-http-code">HTTP {err.code}</span>
                                  <span>{err.message}</span>
                                </div>
                                <DocJsonBlock data={err.example} maxHeight={260} />
                              </div>
                            ))}
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />

            {/* 在线测试 */}
            <div className="lc-test-bar">
              <Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={loading[endpoint.key]}
                  onClick={() => onTest(endpoint, currentParams)}
                >
                  在线测试
                </Button>
                <span className="lc-doc-muted">点击按钮直接在浏览器中测试此接口</span>
              </Space>
            </div>

            {/* 测试结果 */}
            {response[endpoint.key] && (
              <div className="lc-test-result">
                <DocSubTitle>响应结果</DocSubTitle>
                <DocJsonBlock data={response[endpoint.key]} maxHeight={420} />
              </div>
            )}
          </DocItem>
        );
      })}
    </DocSection>
  );
};
