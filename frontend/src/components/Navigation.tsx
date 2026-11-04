import React from 'react';
import { Menu, Layout } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeOutlined,
  TrophyOutlined,
  BarChartOutlined,
  HistoryOutlined,
  ApiOutlined,
  CloudOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import GitHubStarButton from './GitHubStarButton';

const { Header } = Layout;

const Navigation: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
    { key: '/rankings', icon: <TrophyOutlined />, label: <Link to="/rankings">排行榜</Link> },
    { key: '/statistics', icon: <BarChartOutlined />, label: <Link to="/statistics">统计分析</Link> },
    { key: '/history', icon: <HistoryOutlined />, label: <Link to="/history">历史数据</Link> },
    { key: '/api-docs', icon: <ApiOutlined />, label: <Link to="/api-docs">API</Link> },
    { key: '/mcp-docs', icon: <CloudOutlined />, label: <Link to="/mcp-docs">MCP</Link> },
    { key: '/skills', icon: <ToolOutlined />, label: <Link to="/skills">Skills</Link> },
  ];

  return (
    <Header className="lc-header">
      <div className="lc-logo">
        <div className="lc-logo-icon">LC</div>
        <span>Hot 100</span>
      </div>
      <Menu
        className="lc-menu"
        theme="dark"
        mode="horizontal"
        selectedKeys={[currentPath]}
        items={menuItems}
      />
      <div className="lc-header-actions">
        <GitHubStarButton owner="fuck-algorithm" repo="leetcode-online-dashboard" />
      </div>
    </Header>
  );
};

export default Navigation;
