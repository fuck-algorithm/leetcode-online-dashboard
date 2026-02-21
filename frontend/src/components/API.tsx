import React, { useState, useEffect } from 'react';
import { 
  Card, Typography, Button, Space, message, Tabs, Input, 
  Layout, Menu, Badge, Tag, Alert, 
  Divider, Table, Row, Col, Statistic 
} from 'antd';
import { 
  ApiOutlined, PlayCircleOutlined, CopyOutlined, CheckOutlined,
  LinkOutlined, BookOutlined, CodeOutlined, ThunderboltOutlined,
  EyeOutlined, HistoryOutlined, BarChartOutlined, DownloadOutlined,
  HeartOutlined, FileTextOutlined, GlobalOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Sider, Content } = Layout;

// 语法高亮代码块
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'bash' }) => (
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
    }}>{language}</div>
    <code>{code}</code>
  </pre>
);

// JSON 高亮
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

interface APIEndpoint {
  key: string;
  title: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  detailedDescription?: string;
  useCases?: string[];
  requestParams?: { 
    name: string; 
    type: string; 
    required: boolean; 
    description: string; 
    default?: string;
    example?: string;
  }[];
  responseFields?: {
    field: string;
    type: string;
    description: string;
  }[];
  responseExample: any;
  errorExamples?: { code: number; message: string; example: any }[];
}

const API: React.FC = () => {
  const baseUrl = window.location.origin;
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [response, setResponse] = useState<Record<string, any>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});
  const [activeAnchor, setActiveAnchor] = useState('overview');

  // 页面锚点跟踪
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['overview', 'quickstart', 'auth', 'endpoints', 'errors', 'sdk'];
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
  }, []);

  const endpoints: APIEndpoint[] = [
    {
      key: 'health',
      title: '健康检查',
      method: 'GET',
      path: '/api/health',
      description: '检查 API 服务是否正常运行',
      detailedDescription: '返回服务健康状态和当前服务器时间戳。建议在开始集成前调用此接口确认服务可用。',
      useCases: [
        '服务监控：定时调用检查服务可用性',
        '启动验证：应用启动时确认API可连接',
        '心跳检测：保持与后端的心跳连接'
      ],
      responseFields: [
        { field: 'status', type: 'string', description: '服务状态，固定为 "healthy"' },
        { field: 'timestamp', type: 'string', description: 'ISO 8601 格式的服务器当前时间' }
      ],
      responseExample: {
        status: "healthy",
        timestamp: "2026-02-20T23:30:00.123456+08:00"
      },
      errorExamples: [
        { code: 500, message: '服务内部错误', example: { error: "Internal server error" } }
      ]
    },
    {
      key: 'hot100',
      title: '获取 Hot 100 题目列表',
      method: 'GET',
      path: '/api/hot100',
      description: '获取 LeetCode Hot 100 所有题目的基本信息和当前在线人数',
      detailedDescription: '返回 Hot 100 题目的完整列表，包含每道题目的基本信息（ID、标题、难度等）和实时在线人数数据。数据每30秒更新一次。',
      useCases: [
        '实时仪表板：展示 Hot 100 所有题目的当前热度',
        '排行榜：按在线人数排序展示热门题目',
        '数据分析：获取完整数据集进行统计分析'
      ],
      responseFields: [
        { field: 'frontend_id', type: 'string', description: 'LeetCode 题目编号' },
        { field: 'slug', type: 'string', description: '题目英文标识（URL中使用）' },
        { field: 'title', type: 'string', description: '题目英文名称' },
        { field: 'title_cn', type: 'string', description: '题目中文名称' },
        { field: 'difficulty', type: 'string', description: '难度：Easy/Medium/Hard' },
        { field: 'topic_tags', type: 'string[]', description: '题目相关标签' },
        { field: 'online_count', type: 'number', description: '当前在线做题人数' },
        { field: 'last_updated', type: 'string', description: '数据最后更新时间' }
      ],
      responseExample: {
        "code": 200,
        "msg": "success",
        "data": [
          {
            "id": 1,
            "frontend_id": "1",
            "slug": "two-sum",
            "title": "两数之和",
            "difficulty": "EASY",
            "paid_only": false,
            "topic_tags": ["数组", "哈希表"],
            "online_count": 334,
            "last_updated": "2026-02-21T00:15:15Z"
          }
        ]
      }
    },
    {
      key: 'problems',
      title: '获取题目详细信息',
      method: 'GET',
      path: '/api/hot100/problems',
      description: '获取 Hot 100 题目的完整详细信息',
      detailedDescription: '包含每道题目的完整元数据，包括通过率(paid_only)、标签、难度等详细信息。适合需要展示题目完整信息的场景。',
      responseExample: {
        "code": 200,
        "msg": "success",
        "data": {
          "problems": [
            {
              "frontend_id": "1",
              "slug": "two-sum",
              "title": "两数之和",
              "difficulty": "EASY",
              "online_count": 296
            }
          ]
        }
      }
    },
    {
      key: 'online-counts-latest',
      title: '获取所有题目最新在线人数',
      method: 'GET',
      path: '/api/hot100/online-counts/latest',
      description: '获取 Hot 100 所有题目的当前在线人数快照',
      detailedDescription: '返回所有题目的最新在线人数，适合用于实时监控和仪表板展示。数据为内存缓存，响应速度极快。',
      useCases: [
        '实时监控：展示当前最热门的题目',
        '大屏展示：用于数据可视化大屏',
        '趋势分析：对比不同时间段的数据'
      ],
      responseExample: {
        "code": 200,
        "msg": "success",
        "data": [
          { "frontend_id": "1", "slug": "two-sum", "count": 296, "timestamp": "2026-02-21T00:15:15Z" },
          { "frontend_id": "49", "slug": "group-anagrams", "count": 121, "timestamp": "2026-02-21T00:15:15Z" }
        ]
      }
    },
    {
      key: 'online-counts-history',
      title: '获取题目历史在线人数',
      method: 'GET',
      path: '/api/hot100/online-counts/:id',
      description: '获取指定题目的历史在线人数数据',
      detailedDescription: '根据题目 ID 获取该题目的历史在线人数数据。支持两种格式：1) LeetCode 题目数字 ID（如 1, 2, 3）；2) 题目英文 slug（如 two-sum, add-two-numbers）。可限制返回记录数。',
      useCases: [
        '趋势分析：分析特定题目的热度变化趋势',
        '峰值检测：找出题目在线人数的历史峰值',
        '数据可视化：绘制在线人数变化曲线'
      ],
      requestParams: [
        { 
          name: 'id', 
          type: 'string', 
          required: true, 
          description: '题目 ID 或 slug（如 1 或 two-sum）',
          example: '1 或 two-sum'
        },
        { 
          name: 'limit', 
          type: 'number', 
          required: false, 
          description: '返回的记录数，默认 100，最大 1000',
          default: '100',
          example: '50'
        },
      ],
      responseFields: [
        { field: 'problem_id', type: 'number', description: '题目内部 ID' },
        { field: 'frontend_id', type: 'string', description: 'LeetCode 题目编号' },
        { field: 'slug', type: 'string', description: '题目英文标识' },
        { field: 'title', type: 'string', description: '题目名称' },
        { field: 'data', type: 'array', description: '历史数据数组' },
        { field: 'data[].count', type: 'number', description: '该时间点的在线人数' },
        { field: 'data[].timestamp', type: 'string', description: 'ISO 8601 时间戳' }
      ],
      responseExample: {
        "code": 200,
        "msg": "success",
        "data": [
          { "id": 1, "frontend_id": "1", "count": 334, "timestamp": "2026-02-21T00:15:15Z" },
          { "id": 2, "frontend_id": "1", "count": 328, "timestamp": "2026-02-21T00:14:15Z" }
        ]
      },
      errorExamples: [
        { code: 404, message: '题目不存在', example: { "code": 404, "msg": "Problem not found", "data": null } }
      ]
    },
    {
      key: 'statistics',
      title: '获取统计数据',
      method: 'GET',
      path: '/api/hot100/statistics',
      description: '获取 Hot 100 题目的综合统计数据',
      detailedDescription: '提供全面的数据统计分析，包括总在线人数、难度分布、在线人数区间分布以及热门题目排行榜。适合用于生成数据报告和分析洞察。',
      useCases: [
        '数据报告：生成每日/每周统计报告',
        '难度分析：分析不同难度题目的热度分布',
        '热门排行：获取当前最热门的题目排行'
      ],
      responseFields: [
        { field: 'total_problems', type: 'number', description: '题目总数（固定100）' },
        { field: 'total_online', type: 'number', description: '当前总在线人数' },
        { field: 'average_online', type: 'number', description: '平均每题在线人数' },
        { field: 'max_online', type: 'number', description: '单题最高在线人数' },
        { field: 'min_online', type: 'number', description: '单题最低在线人数' },
        { field: 'difficulties', type: 'object', description: '各难度题目数量分布' },
        { field: 'online_by_range', type: 'object', description: '在线人数区间分布' },
        { field: 'top_problems', type: 'array', description: '热门题目排行（前10）' }
      ],
      responseExample: {
        "code": 200,
        "msg": "success",
        "data": {
          "total_problems": 100,
          "total_online": 6003,
          "average_online": 60.03,
          "max_online": 296,
          "min_online": 15,
          "difficulties": {
            "EASY": 20,
            "MEDIUM": 68,
            "HARD": 12
          },
          "online_by_range": {
            "0-50": 50,
            "51-100": 40,
            "101-200": 9,
            "201-500": 1
          },
          "top_problems": [
            {
              "frontend_id": "1",
              "title": "两数之和",
              "slug": "two-sum",
              "difficulty": "EASY",
              "online_count": 296
            }
          ]
        }
      }
    },
    {
      key: 'peaks',
      title: '获取在线人数峰值',
      method: 'GET',
      path: '/api/hot100/peaks',
      description: '获取过去7天内在线人数最高的题目',
      detailedDescription: '统计 Hot 100 题目过去 7 天内在线人数的最高峰值，按峰值人数降序排列，返回前 20 道题目。每道题目包含峰值时间、峰值人数和平均人数。',
      useCases: [
        '峰值分析：识别近期最热门的题目',
        '趋势预测：根据历史峰值预测未来热度',
        '报告生成：用于周报/月报的热门题目分析'
      ],
      responseFields: [
        { field: 'peaks', type: 'array', description: '峰值数据数组' },
        { field: 'peaks[].frontend_id', type: 'string', description: '题目编号' },
        { field: 'peaks[].problem_slug', type: 'string', description: '题目slug' },
        { field: 'peaks[].problem_title', type: 'string', description: '题目名称' },
        { field: 'peaks[].peak_count', type: 'number', description: '峰值在线人数' },
        { field: 'peaks[].peak_time', type: 'string', description: '峰值出现时间' },
        { field: 'peaks[].average_count', type: 'number', description: '平均在线人数' }
      ],
      responseExample: {
        "code": 200,
        "msg": "success",
        "data": {
          "peaks": [
            {
              "frontend_id": "1",
              "problem_slug": "two-sum",
              "problem_title": "Two Sum",
              "peak_count": 380,
              "peak_time": "2026-02-20T23:27:09Z",
              "average_count": 0
            }
          ],
          "time_range": "last_7_days",
          "generated": "2026-02-21T00:15:25Z"
        }
      }
    },
    {
      key: 'export',
      title: '导出数据',
      method: 'GET',
      path: '/api/hot100/export',
      description: '导出历史在线人数数据',
      detailedDescription: '导出 Hot 100 题目的在线人数历史数据，支持 JSON 和 CSV 两种格式。可筛选特定题目或日期范围。题目筛选支持两种格式：1) LeetCode 题目数字 ID；2) 题目英文 slug。',
      useCases: [
        '数据备份：定期导出数据进行备份',
        '离线分析：导出 CSV 用 Excel 分析',
        '机器学习：获取历史数据训练预测模型'
      ],
      requestParams: [
        { 
          name: 'format', 
          type: 'string', 
          required: false, 
          description: '导出格式：json 或 csv',
          default: 'json',
          example: 'csv'
        },
        { 
          name: 'problem_id', 
          type: 'string', 
          required: false, 
          description: '题目 ID 或 slug（支持数字如 1 或 slug 如 two-sum）',
          example: 'two-sum'
        },
        { 
          name: 'start_date', 
          type: 'string', 
          required: false, 
          description: '开始日期（格式：2024-01-01）',
          example: '2024-01-01'
        },
        { 
          name: 'end_date', 
          type: 'string', 
          required: false, 
          description: '结束日期（格式：2024-01-01）',
          example: '2024-01-31'
        },
      ],
      responseExample: {
        "code": 200,
        "msg": "success",
        "data": {
          "count": 26300,
          "data": [
            { "id": 1, "frontend_id": "11", "count": 79, "timestamp": "2026-02-19T23:25:09Z" }
          ]
        }
      }
    },
    {
      key: 'export-stats',
      title: '获取导出统计信息',
      method: 'GET',
      path: '/api/hot100/export/stats',
      description: '获取可导出数据的统计信息',
      detailedDescription: '返回可导出数据的基本统计信息，包括总记录数、数据时间范围、可用格式等。建议在导出大量数据前先调用此接口了解数据概况。',
      responseExample: {
        "code": 200,
        "msg": "success",
        "data": {
          "total_records": 26300,
          "oldest_record": "2026-02-19T23:25:09Z",
          "newest_record": "2026-02-21T00:14:54Z",
          "available_formats": ["json", "csv"]
        }
      }
    },
  ];

  const buildCurl = (endpoint: APIEndpoint, params: Record<string, string> = {}): string => {
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

  const scrollToAnchor = (anchor: string) => {
    const element = document.getElementById(anchor);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveAnchor(anchor);
    }
  };

  // 侧边栏导航项 - 使用正确的格式
  const anchorItems = [
    { key: 'overview', href: '#overview', title: '概览' },
    { key: 'quickstart', href: '#quickstart', title: '快速开始' },
    { key: 'id-formats', href: '#id-formats', title: '题目ID格式' },
    { key: 'endpoints', href: '#endpoints', title: 'API端点' },
    ...endpoints.map(ep => ({ 
      key: ep.key, 
      href: `#${ep.key}`, 
      title: ep.title
    })),
    { key: 'errors', href: '#errors', title: '错误处理' },
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
          
          {/* 概览部分 */}
          <section id="overview" style={{ marginBottom: 60 }}>
            <Card bordered={false} style={{ marginBottom: 24 }}>
              <Space align="start" size="large">
                <div style={{ 
                  width: 60, 
                  height: 60, 
                  background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ApiOutlined style={{ fontSize: 32, color: '#fff' }} />
                </div>
                <div>
                  <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
                    LeetCode Hot 100 API
                  </Title>
                  <Paragraph type="secondary" style={{ fontSize: 16, margin: 0 }}>
                    实时获取 LeetCode Hot 100 题目的在线人数数据，支持历史趋势分析、数据导出和多种集成方案
                  </Paragraph>
                </div>
              </Space>

              <Divider style={{ margin: '24px 0' }} />

              <Row gutter={[24, 24]}>
                <Col span={8}>
                  <Card bordered={false} style={{ background: '#f6ffed', borderLeft: '4px solid #52c41a' }}>
                    <Statistic 
                      title={<Text type="success"><ThunderboltOutlined /> 实时数据</Text>}
                      value="30秒" 
                      suffix="更新"
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bordered={false} style={{ background: '#e6f7ff', borderLeft: '4px solid #1890ff' }}>
                    <Statistic 
                      title={<Text style={{ color: '#1890ff' }}><GlobalOutlined /> 跨域支持</Text>}
                      value="CORS" 
                      suffix="已启用"
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bordered={false} style={{ background: '#fff7e6', borderLeft: '4px solid #fa8c16' }}>
                    <Statistic 
                      title={<Text style={{ color: '#fa8c16' }}><FileTextOutlined /> 数据格式</Text>}
                      value="JSON" 
                      suffix="+ CSV"
                    />
                  </Card>
                </Col>
              </Row>
            </Card>

            {/* 特性介绍 */}
            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
              <Col span={12}>
                <Card bordered={false}>
                  <Title level={4}><EyeOutlined /> 实时监控</Title>
                  <Paragraph>
                    获取 Hot 100 所有题目的实时在线人数，数据每30秒自动更新。可用于构建实时监控面板、热度排行榜等应用。
                  </Paragraph>
                </Card>
              </Col>
              <Col span={12}>
                <Card bordered={false}>
                  <Title level={4}><HistoryOutlined /> 历史趋势</Title>
                  <Paragraph>
                    查询任意题目的历史在线人数数据，支持时间范围筛选。可用于趋势分析、峰值检测、数据可视化等场景。
                  </Paragraph>
                </Card>
              </Col>
              <Col span={12}>
                <Card bordered={false}>
                  <Title level={4}><BarChartOutlined /> 统计分析</Title>
                  <Paragraph>
                    获取完整的统计分析报告，包括难度分布、热门排行、在线人数区间分布等多维度数据分析。
                  </Paragraph>
                </Card>
              </Col>
              <Col span={12}>
                <Card bordered={false}>
                  <Title level={4}><DownloadOutlined /> 数据导出</Title>
                  <Paragraph>
                    支持 JSON 和 CSV 格式导出历史数据，可按题目、日期范围筛选。便于离线分析、备份和第三方工具集成。
                  </Paragraph>
                </Card>
              </Col>
            </Row>
          </section>

          {/* 快速开始 */}
          <section id="quickstart" style={{ marginBottom: 60 }}>
            <Card bordered={false}>
              <Title level={3}><ThunderboltOutlined /> 快速开始</Title>
              
              <Alert
                message="基础 URL"
                description={
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text code copyable style={{ fontSize: 16, padding: '8px 16px' }}>
                      {baseUrl}
                    </Text>
                    <Text type="secondary">所有 API 端点都基于此 URL</Text>
                  </Space>
                }
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />

              <Title level={4}>第一步：健康检查</Title>
              <Paragraph>在开始之前，先调用健康检查接口确认服务可用：</Paragraph>
              <CodeBlock code={`curl "${baseUrl}/api/health"`} />
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                预期响应：<Text code>{'{"code":200,"msg":"success","data":{"status":"healthy","timestamp":"..."}}'}</Text>
              </Paragraph>

              <Divider />

              <Title level={4}>第二步：获取数据</Title>
              <Paragraph>获取 Hot 100 所有题目的实时在线人数：</Paragraph>
              <CodeBlock code={`curl "${baseUrl}/api/hot100" | jq '.[] | {id: .frontend_id, title: .title_cn, count: .online_count}'`} />
            </Card>
          </section>

          {/* 题目ID格式说明 */}
          <section id="id-formats" style={{ marginBottom: 60 }}>
            <Card bordered={false}>
              <Title level={3}><LinkOutlined /> 题目ID格式</Title>
              <Paragraph>
                所有涉及题目标识的 API 都支持两种格式，您可以随意选择最方便的格式：
              </Paragraph>

              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <Card 
                    title={<><Badge count="1" style={{ backgroundColor: '#52c41a' }} /> 数字格式</>} 
                    bordered={false}
                    style={{ background: '#f6ffed' }}
                  >
                    <Paragraph>
                      使用 LeetCode 题目的数字 ID，如 <Text code>1</Text>、<Text code>2</Text>、<Text code>3</Text>
                    </Paragraph>
                    <CodeBlock code={`# 获取题目1的历史数据\ncurl "${baseUrl}/api/online-counts/1"\n\n# 导出题目15的数据\ncurl "${baseUrl}/api/export?problem_id=15"`} />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card 
                    title={<><Badge count="2" style={{ backgroundColor: '#1890ff' }} /> 英文Slug格式</>} 
                    bordered={false}
                    style={{ background: '#e6f7ff' }}
                  >
                    <Paragraph>
                      使用题目的英文标识，如 <Text code>two-sum</Text>、<Text code>add-two-numbers</Text>
                    </Paragraph>
                    <CodeBlock code={`# 获取 two-sum 的历史数据\ncurl "${baseUrl}/api/online-counts/two-sum"\n\n# 导出 two-sum 的数据\ncurl "${baseUrl}/api/export?problem_id=two-sum"`} />
                  </Card>
                </Col>
              </Row>

              <Alert
                message="混合使用示例"
                description="同一个接口可以同时使用两种格式查询不同题目"
                type="success"
                showIcon
                style={{ marginTop: 24 }}
              />
            </Card>
          </section>

          {/* API 端点详情 */}
          <section id="endpoints" style={{ marginBottom: 60 }}>
            <Title level={3}><BookOutlined /> API 端点详情</Title>
            
            {endpoints.map(endpoint => {
              const currentParams = paramValues[endpoint.key] || {};
              const currentCurl = buildCurl(endpoint, currentParams);
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
                                onChange={(e) => handleParamChange(endpoint.key, record.name, e.target.value)}
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

                  {/* 选项卡：cURL / 响应示例 / 错误示例 */}
                  <Tabs
                    defaultActiveKey="curl"
                    activeKey={activeTab[endpoint.key] || 'curl'}
                    onChange={(key) => setActiveTab(prev => ({ ...prev, [endpoint.key]: key }))}
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
                                onClick={() => handleCopy(currentCurl, `${endpoint.key}-curl`)}
                              >
                                {copied[`${endpoint.key}-curl`] ? '已复制' : '复制'}
                              </Button>
                            </div>
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
                        children: (
                          <div style={{ position: 'relative' }}>
                            <JsonBlock data={endpoint.responseExample} />
                            <Button
                              size="small"
                              icon={copied[`${endpoint.key}-response`] ? <CheckOutlined /> : <CopyOutlined />}
                              style={{ position: 'absolute', top: 8, right: 8 }}
                              onClick={() => handleCopy(JSON.stringify(endpoint.responseExample, null, 2), `${endpoint.key}-response`)}
                            >
                              {copied[`${endpoint.key}-response`] ? '已复制' : '复制'}
                            </Button>
                          </div>
                        ),
                      },
                      ...(endpoint.errorExamples ? [{
                        key: 'errors',
                        label: (
                          <span>
                            <Badge count={endpoint.errorExamples.length} style={{ backgroundColor: '#ff4d4f' }} /> 错误响应
                          </span>
                        ),
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
                        onClick={() => handleTest(endpoint, currentParams)}
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
                          onClick={() => handleCopy(JSON.stringify(response[endpoint.key], null, 2), `${endpoint.key}-result`)}
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

          {/* 错误处理 */}
          <section id="errors" style={{ marginBottom: 60 }}>
            <Card bordered={false}>
              <Title level={3}>错误处理</Title>
              <Paragraph>
                API 使用标准 HTTP 状态码，错误响应包含详细的错误信息：
              </Paragraph>

              <Table
                dataSource={[
                  { code: 200, message: '请求成功', description: '正常返回数据' },
                  { code: 400, message: '请求参数错误', description: '请求参数格式不正确或缺少必要参数' },
                  { code: 404, message: '资源不存在', description: '题目不存在或 slug 错误' },
                  { code: 500, message: '服务器内部错误', description: '服务器处理请求时发生错误' },
                  { code: 503, message: '服务不可用', description: '数据库连接失败或其他服务异常' },
                ]}
                columns={[
                  { title: '状态码', dataIndex: 'code', key: 'code', render: (code: number) => (
                    <Tag color={code === 200 ? 'green' : code < 500 ? 'orange' : 'red'}>{code}</Tag>
                  )},
                  { title: '错误信息', dataIndex: 'message', key: 'message' },
                  { title: '说明', dataIndex: 'description', key: 'description' },
                ]}
                pagination={false}
                size="small"
              />

              <Alert
                message="错误响应格式"
                description="所有错误响应都使用统一的 code/msg/data 格式"
                type="info"
                showIcon
                style={{ marginTop: 24 }}
              />
              <CodeBlock code={`{\n  "code": 404,\n  "msg": "Problem not found",\n  "data": null\n}`} language="json" />
            </Card>
          </section>

          {/* 页脚 */}
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            <HeartOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            <Text type="secondary">LeetCode Hot 100 Dashboard API - 为学习而生</Text>
          </div>

        </Content>
      </Layout>
    </Layout>
  );
};

export default API;
