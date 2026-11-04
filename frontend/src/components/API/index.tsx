import React, { useMemo, useState } from 'react';
import { ApiOutlined, BookOutlined, LinkOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import { APIEndpoint } from './types';
import { getEndpoints } from './endpoints';
import { OverviewSection } from './OverviewSection';
import { QuickStartSection } from './QuickStartSection';
import { IdFormatsSection } from './IdFormatsSection';
import { EndpointsSection } from './EndpointsSection';
import { ErrorsSection, ApiFooter } from './ErrorsSection';
import { DocLayout, useDocNavigation } from '../docs';

const API: React.FC = () => {
  const baseUrl = window.location.origin;
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [response, setResponse] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});

  const endpoints = useMemo(() => getEndpoints(), []);

  const anchors = useMemo(
    () => [
      { key: 'overview', title: '概览', icon: <ApiOutlined /> },
      { key: 'quickstart', title: '快速开始', icon: <ThunderboltOutlined /> },
      { key: 'id-formats', title: '题目 ID 格式', icon: <LinkOutlined /> },
      { key: 'endpoints', title: 'API 端点', icon: <BookOutlined /> },
      ...endpoints.map((endpoint) => ({ key: endpoint.key, title: endpoint.title })),
      { key: 'errors', title: '错误处理', icon: <WarningOutlined /> },
    ],
    [endpoints]
  );
  const { activeAnchor, scrollTo } = useDocNavigation(anchors);

  const handleTest = async (endpoint: APIEndpoint, params: Record<string, string> = {}) => {
    setLoading((prev) => ({ ...prev, [endpoint.key]: true }));
    setResponse((prev) => ({ ...prev, [endpoint.key]: null }));
    setActiveTab((prev) => ({ ...prev, [endpoint.key]: 'response' }));

    try {
      let url = baseUrl + endpoint.path;

      if (endpoint.requestParams) {
        endpoint.requestParams.forEach((param) => {
          const value = params[param.name] || param.default;
          if (value) {
            url = url.replace(`:${param.name}`, value);
          }
        });
      }

      const queryParams: string[] = [];
      if (endpoint.requestParams) {
        endpoint.requestParams.forEach((param) => {
          const value = params[param.name];
          if (!param.required && value && value !== param.default) {
            queryParams.push(`${param.name}=${encodeURIComponent(value)}`);
          }
        });
      }

      if (queryParams.length > 0) {
        url += '?' + queryParams.join('&');
      }

      const res = await fetch(url);
      const data = await res.json();
      setResponse((prev) => ({ ...prev, [endpoint.key]: data }));
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setResponse((prev) => ({ ...prev, [endpoint.key]: { error: errMsg } }));
    } finally {
      setLoading((prev) => ({ ...prev, [endpoint.key]: false }));
    }
  };

  const handleParamChange = (endpointKey: string, paramName: string, value: string) => {
    setParamValues((prev) => ({
      ...prev,
      [endpointKey]: {
        ...prev[endpointKey],
        [paramName]: value,
      },
    }));
  };

  const handleTabChange = (endpointKey: string, tab: string) => {
    setActiveTab((prev) => ({ ...prev, [endpointKey]: tab }));
  };

  return (
    <DocLayout
      title="API 文档"
      subtitle="LeetCode Hot 100 实时数据接口"
      icon={<ApiOutlined style={{ fontSize: 18 }} />}
      anchors={anchors}
      activeAnchor={activeAnchor}
      onNavigate={scrollTo}
    >
      <OverviewSection />
      <QuickStartSection baseUrl={baseUrl} />
      <IdFormatsSection baseUrl={baseUrl} />
      <EndpointsSection
        endpoints={endpoints}
        baseUrl={baseUrl}
        loading={loading}
        response={response}
        activeTab={activeTab}
        paramValues={paramValues}
        onTest={handleTest}
        onParamChange={handleParamChange}
        onTabChange={handleTabChange}
      />
      <ErrorsSection />
      <ApiFooter />
    </DocLayout>
  );
};

export default API;
