import React, { useState, useEffect } from 'react';
import { Layout, Menu, message, Typography, Space } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { APIEndpoint } from './types';
import { getEndpoints } from './endpoints';
import { OverviewSection } from './OverviewSection';
import { QuickStartSection } from './QuickStartSection';
import { IdFormatsSection } from './IdFormatsSection';
import { EndpointsSection } from './EndpointsSection';
import { ErrorsSection, ApiFooter } from './ErrorsSection';

const { Text } = Typography;
const { Sider, Content } = Layout;

const API: React.FC = () => {
  const baseUrl = window.location.origin;
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [response, setResponse] = useState<Record<string, any>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});
  const [activeAnchor, setActiveAnchor] = useState('overview');

  const endpoints = getEndpoints();

  // 页面锚点跟踪
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['overview', 'quickstart', 'id-formats', 'endpoints', ...endpoints.map(e => e.key), 'errors'];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top >= 0 && rect.top <= 200) {
            setActiveAnchor(section);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [endpoints]);

  const handleTest = async (endpoint: APIEndpoint, params: Record<string, string> = {}) => {
    setLoading(prev => ({ ...prev, [endpoint.key]: true }));
    setResponse(prev => ({ ...prev, [endpoint.key]: null }));
    setActiveTab(prev => ({ ...prev, [endpoint.key]: 'response' }));
    
    try {
      let url = baseUrl + endpoint.path;
      
      if (endpoint.requestParams) {
        endpoint.requestParams.forEach(param => {
          const value = params[param.name] || param.default;
          if (value) {
            url = url.replace(`:${param.name}`, value);
          }
        });
      }
      
      const queryParams: string[] = [];
      if (endpoint.requestParams) {
        endpoint.requestParams.forEach(param => {
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
      setResponse(prev => ({ ...prev, [endpoint.key]: data }));
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setResponse(prev => ({ ...prev, [endpoint.key]: { error: errMsg } }));
    } finally {
      setLoading(prev => ({ ...prev, [endpoint.key]: false }));
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [key]: true }));
    message.success('已复制到剪贴板');
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000);
  };

  const handleParamChange = (endpointKey: string, paramName: string, value: string) => {
    setParamValues(prev => ({
      ...prev,
      [endpointKey]: {
        ...prev[endpointKey],
        [paramName]: value,
      },
    }));
  };

  const handleTabChange = (endpointKey: string, tab: string) => {
    setActiveTab(prev => ({ ...prev, [endpointKey]: tab }));
  };

  const scrollToAnchor = (anchor: string) => {
    const element = document.getElementById(anchor);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveAnchor(anchor);
    }
  };

  // 侧边栏导航项
  const anchorItems = [
    { key: 'overview', title: '概览' },
    { key: 'quickstart', title: '快速开始' },
    { key: 'id-formats', title: '题目ID格式' },
    { key: 'endpoints', title: 'API端点' },
    ...endpoints.map(ep => ({ 
      key: ep.key, 
      title: ep.title
    })),
    { key: 'errors', title: '错误处理' },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* 左侧导航 */}
      <Sider 
        width={280} 
        style={{ 
          background: '#fff', 
          position: 'fixed', 
          height: '100vh', 
          overflow: 'auto',
          borderRight: '1px solid #f0f0f0',
          zIndex: 100
        }}
      >
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <Space align="center">
            <ApiOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Text strong style={{ fontSize: 16 }}>API 文档</Text>
          </Space>
        </div>
        
        <Menu
          mode="inline"
          selectedKeys={[activeAnchor]}
          style={{ height: '100%', borderRight: 0, paddingTop: 12 }}
          items={anchorItems.map(item => ({
            key: item.key,
            label: item.title,
            onClick: () => scrollToAnchor(item.key),
          }))}
        />
      </Sider>

      {/* 主内容区 */}
      <Layout style={{ marginLeft: 280, background: '#f0f2f5' }}>
        <Content id="api-content" style={{ padding: '40px 50px', maxWidth: 1000 }}>
          <OverviewSection />
          <QuickStartSection baseUrl={baseUrl} />
          <IdFormatsSection baseUrl={baseUrl} />
          <EndpointsSection 
            endpoints={endpoints}
            baseUrl={baseUrl}
            loading={loading}
            response={response}
            copied={copied}
            activeTab={activeTab}
            paramValues={paramValues}
            onTest={handleTest}
            onCopy={handleCopy}
            onParamChange={handleParamChange}
            onTabChange={handleTabChange}
          />
          <ErrorsSection />
          <ApiFooter />
        </Content>
      </Layout>
    </Layout>
  );
};

export default API;
