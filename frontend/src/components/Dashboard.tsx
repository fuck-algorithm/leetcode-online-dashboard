import { Table, Card, Row, Col, Statistic, Tag, Spin, Input, Button } from 'antd';
import { FireOutlined, UserOutlined, TrophyOutlined, BarChartOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Problem } from '../types';
import { useMemo, useState } from 'react';

interface DashboardProps {
  problems: Problem[];
  loading: boolean;
}

const Dashboard = ({ problems, loading }: DashboardProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 生成算法演示URL
  const getDemoUrl = (frontendId: string, slug: string) => {
    return `https://fuck-algorithm.github.io/leetcode-${frontendId}-${slug}/`;
  };

  const stats = useMemo(() => {
    const totalOnline = problems.reduce((sum, p) => sum + (p.online_count || 0), 0);
    const topProblem = problems.length > 0
      ? problems.reduce((max, p) => (p.online_count || 0) > (max.online_count || 0) ? p : max, problems[0])
      : null;
    const averageOnline = problems.length > 0 ? Math.round(totalOnline / problems.length) : 0;

    return {
      totalProblems: problems.length,
      totalOnline,
      topProblem,
      averageOnline,
    };
  }, [problems]);

  const filteredProblems = useMemo(() => {
    if (!searchTerm) return problems;
    return problems.filter(p => 
      p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.slug?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [problems, searchTerm]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'error';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Rank',
      dataIndex: 'id',
      key: 'rank',
      width: 80,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Problem',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Problem) => (
        <a
          href={`https://leetcode.cn/problems/${record.slug}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {title || record.slug}
        </a>
      ),
    },
    {
      title: 'Difficulty',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 120,
      render: (difficulty: string) => (
        <Tag color={getDifficultyColor(difficulty)}>
          {difficulty}
        </Tag>
      ),
    },
    {
      title: 'Acceptance',
      dataIndex: 'acceptance',
      key: 'acceptance',
      width: 120,
      render: (rate: number) => rate ? `${rate.toFixed(1)}%` : '-',
    },
    {
      title: 'Online Now',
      dataIndex: 'online_count',
      key: 'online_count',
      width: 150,
      sorter: (a: Problem, b: Problem) => (a.online_count || 0) - (b.online_count || 0),
      render: (count: number) => (
        <span className="online-count">
          <UserOutlined /> {count || 0}
        </span>
      ),
    },
    {
      title: 'Demo',
      key: 'demo',
      width: 100,
      render: (_: any, record: Problem) => (
        <Button
          type="link"
          icon={<PlayCircleOutlined />}
          href={getDemoUrl(record.frontend_id, record.slug)}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
        >
          演示
        </Button>
      ),
    },
    {
      title: 'Last Updated',
      dataIndex: 'last_updated',
      key: 'last_updated',
      width: 180,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
  ];

  return (
    <div className="dashboard-container">
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Problems"
              value={stats.totalProblems}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Online"
              value={stats.totalOnline}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Average Online"
              value={stats.averageOnline}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Most Popular"
              value={stats.topProblem?.title || stats.topProblem?.slug || '-'}
              prefix={<FireOutlined />}
              valueStyle={{ fontSize: 14 }}
            />
          </Card>
        </Col>
      </Row>

      <Card 
        title="LeetCode Hot 100 - Real-time Online Users"
        extra={
          <Input.Search
            placeholder="Search problems..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
        }
      >
        <Spin spinning={loading}>
          <Table
            dataSource={filteredProblems}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            scroll={{ x: 800 }}
            className="problem-table"
          />
        </Spin>
      </Card>
    </div>
  );
};

export default Dashboard;
