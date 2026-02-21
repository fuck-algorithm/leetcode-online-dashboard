import React, { useState } from 'react';
import { Card, Row, Col, List, Spin } from 'antd';
import { FireOutlined, TeamOutlined, RiseOutlined, TrophyOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { Problem } from '../types';

// Format slug to readable title
const formatSlug = (slug: string): string => {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface WSProblem {
  frontend_id: string;
  slug: string;
  title: string;
  title_cn?: string;
  online_count: number;
  last_updated: number;
}

const Home: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOnline: 0,
    totalProblems: 0,
    hotProblem: null as Problem | null,
  });

  useWebSocket((data) => {
    if (data.type === 'batch_update' && data.problems) {
      const wsProblems: WSProblem[] = data.problems;
      
      const updatedProblems: Problem[] = wsProblems.map(p => ({
        id: p.frontend_id,
        frontend_id: p.frontend_id,
        slug: p.slug,
        title: p.title_cn || p.title || formatSlug(p.slug),
        difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
        acceptance: 0,
        online_count: p.online_count,
        last_updated: new Date(p.last_updated * 1000).toISOString(),
      }));

      setProblems(updatedProblems);
      
      const totalOnline = wsProblems.reduce((sum, p) => sum + p.online_count, 0);
      const hotProblem = wsProblems.length > 0
        ? wsProblems.reduce((max, p) => p.online_count > max.online_count ? p : max, wsProblems[0])
        : null;

      setStats({
        totalOnline,
        totalProblems: wsProblems.length,
        hotProblem: hotProblem ? {
          id: hotProblem.frontend_id,
          frontend_id: hotProblem.frontend_id,
          slug: hotProblem.slug,
          title: hotProblem.title_cn || hotProblem.title || formatSlug(hotProblem.slug),
          difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
          acceptance: 0,
          online_count: hotProblem.online_count,
          last_updated: new Date(hotProblem.last_updated * 1000).toISOString(),
        } : null,
      });
      
      setLoading(false);
    }
  });

  const topProblems = (problems || [])
    .slice()
    .sort((a, b) => (b?.online_count || 0) - (a?.online_count || 0))
    .slice(0, 10);

  const getDifficultyClass = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'lc-difficulty lc-difficulty-easy';
      case 'Medium': return 'lc-difficulty lc-difficulty-medium';
      case 'Hard': return 'lc-difficulty lc-difficulty-hard';
      default: return 'lc-difficulty lc-difficulty-medium';
    }
  };

  if (loading) return <Spin size="large" className="lc-loading" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="lc-card">
            <div className="lc-stat">
              <TeamOutlined className="lc-stat-icon" />
              <div className="lc-stat-value">{stats.totalOnline.toLocaleString()}</div>
              <div className="lc-stat-label">总在线人数</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="lc-card">
            <div className="lc-stat">
              <TrophyOutlined className="lc-stat-icon" />
              <div className="lc-stat-value">{stats.totalProblems}</div>
              <div className="lc-stat-label">题目总数</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="lc-card">
            <div className="lc-stat">
              <FireOutlined className="lc-stat-icon" />
              <div className="lc-stat-value">{stats.hotProblem?.online_count || 0}</div>
              <div className="lc-stat-label">最热门题目</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="lc-card">
            <div className="lc-stat">
              <RiseOutlined className="lc-stat-icon" />
              <div className="lc-stat-value">{stats.totalProblems > 0 ? Math.round(stats.totalOnline / stats.totalProblems) : 0}</div>
              <div className="lc-stat-label">平均在线人数</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card className="lc-card" title="热门题目 Top 10" extra={<Link to="/rankings" className="lc-link">查看全部</Link>}>
            <List
              dataSource={topProblems}
              renderItem={(item, index) => (
                <div className="lc-problem-item" key={item.id}>
                  <div className={`lc-problem-rank ${index < 3 ? 'top' : ''}`}>#{index + 1}</div>
                  <div className="lc-problem-info">
                    <div className="lc-problem-title">
                      <Link to={`https://leetcode.cn/problems/${item.slug}`} target="_blank">{item.title}</Link>
                    </div>
                    <div className="lc-problem-meta">
                      <span className={getDifficultyClass(item.difficulty)}>
                        <span className="lc-difficulty-dot"></span>
                        {item.difficulty}
                      </span>
                      <span className="lc-online-badge">{item.online_count.toLocaleString()} 人在线</span>
                    </div>
                  </div>
                  <Link to={`/history?problemId=${item.id}`} className="lc-link">历史</Link>
                </div>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="lc-card" title="难度分布">
            {['Easy', 'Medium', 'Hard'].map(diff => {
              const count = problems.filter(p => p.difficulty === diff).length;
              const online = problems.filter(p => p.difficulty === diff).reduce((s, p) => s + p.online_count, 0);
              return (
                <div key={diff} className="lc-problem-item" style={{ justifyContent: 'space-between' }}>
                  <span className={getDifficultyClass(diff)}>
                    <span className="lc-difficulty-dot"></span>
                    {diff}
                  </span>
                  <span style={{ color: 'var(--lc-text-secondary)' }}>{count} 题 / {online} 人在线</span>
                </div>
              );
            })}
          </Card>
          
          <Card className="lc-card" title="快速链接" style={{ marginTop: 16 }}>
            <p><Link to="/statistics" className="lc-link">查看详细统计</Link></p>
            <p><Link to="/history" className="lc-link">查看历史趋势</Link></p>
            <p><Link to="/favorites" className="lc-link">我的收藏</Link></p>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Home;
