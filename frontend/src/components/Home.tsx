import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Typography, 
  Card, Row, Col, List, Spin, Badge, Tag, Divider, Progress, Tooltip, Button, Space 
} from 'antd';

const { Title } = Typography;
import { 
  FireOutlined, 
  TeamOutlined, 
  RiseOutlined, 
  TrophyOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  HistoryOutlined,
  LineChartOutlined,
  AimOutlined,
  RocketOutlined,
  RightOutlined,
  WifiOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { Problem } from '../types';
import TotalOnlineChart from './TotalOnlineChart';

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

// 难度颜色映射 - 扁平化设计
const difficultyColors: Record<string, { bg: string; text: string; border: string }> = {
  'Easy': { bg: '#f6ffed', text: '#52c41a', border: '#b7eb8f' },
  'Medium': { bg: '#fff7e6', text: '#fa8c16', border: '#ffd591' },
  'Hard': { bg: '#fff2f0', text: '#f5222d', border: '#ffccc7' },
};

// 趋势指示器组件
const TrendIndicator: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
  const isPositive = value >= 0;
  return (
    <span style={{ 
      color: isPositive ? '#52c41a' : '#f5222d', 
      fontSize: 12,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2
    }}>
      {isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
      {Math.abs(value)}{suffix}
    </span>
  );
};

// 活动热力指示器
const ActivityHeatmap: React.FC<{ intensity: number }> = ({ intensity }) => {
  const getColor = (level: number) => {
    if (level >= 80) return '#f5222d';
    if (level >= 60) return '#fa8c16';
    if (level >= 40) return '#faad14';
    if (level >= 20) return '#52c41a';
    return '#d9d9d9';
  };
  
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 16,
            borderRadius: 2,
            background: i * 20 <= intensity ? getColor(intensity) : '#f0f0f0',
            transition: 'all 0.3s'
          }}
        />
      ))}
    </div>
  );
};

// 浮动数字动画组件
const AnimatedNumber: React.FC<{ value: number; duration?: number }> = ({ value, duration = 1000 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + diff * easeOut));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return <span>{displayValue.toLocaleString()}</span>;
};

// 特性卡片组件
const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div style={{
    background: '#fff',
    borderRadius: 0,
    padding: 28,
    border: '1px solid #e8e8e8',
    transition: 'none',
    height: '100%',
    position: 'relative',
    overflow: 'hidden'
  }} className="feature-card">
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: '#FFA116'
    }} />
    <div style={{
      width: 48,
      height: 48,
      borderRadius: 0,
      background: '#FFF7E6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 24,
      color: '#FFA116',
      marginBottom: 20
    }}>
      {icon}
    </div>
    <h3 style={{ 
      fontSize: 18, 
      fontWeight: 600, 
      color: '#262626', 
      marginBottom: 12,
      marginTop: 0 
    }}>
      {title}
    </h3>
    <p style={{ 
      fontSize: 14, 
      color: '#8c8c8c', 
      lineHeight: 1.6,
      margin: 0 
    }}>
      {description}
    </p>
  </div>
);

// 统计卡片组件 - 扁平化设计
const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  subTitle?: string;
  trend?: number;
  color?: string;
  large?: boolean;
}> = ({ icon, title, value, subTitle, trend, large = false }) => (
  <div style={{
    background: '#fff',
    borderRadius: 0,
    padding: large ? 32 : 24,
    border: '1px solid #e8e8e8',
    display: 'flex',
    alignItems: 'center',
    gap: large ? 20 : 16,
    transition: 'none',
    height: '100%'
  }}>
    <div style={{
      width: large ? 56 : 48,
      height: large ? 56 : 48,
      borderRadius: 0,
      background: '#FFA116',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: large ? 24 : 20,
      color: '#fff',
      flexShrink: 0
    }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 6, fontWeight: 500 }}>{title}</div>
      <div style={{ 
        fontSize: large ? 36 : 28, 
        fontWeight: 700, 
        color: '#262626', 
        lineHeight: 1.2,
        letterSpacing: '-0.5px'
      }}>
        {value}
      </div>
      {(subTitle || trend !== undefined) && (
        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          {subTitle}
          {trend !== undefined && <TrendIndicator value={trend} />}
        </div>
      )}
    </div>
  </div>
);

const Home: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [problemBaseData, setProblemBaseData] = useState<Record<string, Problem>>({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOnline: 0,
    totalProblems: 0,
    hotProblem: null as Problem | null,
  });
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');

  // 获取题目基础数据（包含难度信息）
  useEffect(() => {
    const fetchProblemBaseData = async () => {
      try {
        const response = await fetch('/api/hot100/problems');
        if (response.ok) {
          const data = await response.json();
          if (data.code === 200 && data.data) {
            const baseData: Record<string, Problem> = {};
            data.data.forEach((p: Problem) => {
              baseData[p.frontend_id] = p;
            });
            setProblemBaseData(baseData);
          }
        }
      } catch (err) {
        console.error('Failed to fetch problem base data:', err);
      }
    };
    
    fetchProblemBaseData();
  }, []);

  // Memoize WebSocket message handler to prevent re-registration on every render
  const handleWebSocketMessage = useCallback((data: any) => {
    if (data.type === 'batch_update' && data.problems) {
      const wsProblems: WSProblem[] = data.problems;
      
      const updatedProblems: Problem[] = wsProblems.map(p => {
        const baseData = problemBaseData[p.frontend_id];
        return {
          id: p.frontend_id,
          frontend_id: p.frontend_id,
          slug: p.slug,
          title: p.title_cn || p.title || formatSlug(p.slug),
          difficulty: baseData?.difficulty || 'Medium' as 'Easy' | 'Medium' | 'Hard',
          acceptance: baseData?.acceptance || 0,
          online_count: p.online_count,
          last_updated: new Date(p.last_updated * 1000).toISOString(),
        };
      });

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
          difficulty: problemBaseData[hotProblem.frontend_id]?.difficulty || 'Medium' as 'Easy' | 'Medium' | 'Hard',
          acceptance: problemBaseData[hotProblem.frontend_id]?.acceptance || 0,
          online_count: hotProblem.online_count,
          last_updated: new Date(hotProblem.last_updated * 1000).toISOString(),
        } : null,
      });
      
      setLastUpdateTime(new Date().toLocaleTimeString());
      setLoading(false);
    }
  }, [problemBaseData]);

  useWebSocket(handleWebSocketMessage);

  // 计算统计数据
  const computedStats = useMemo(() => {
    if (problems.length === 0) return null;
    
    const totalOnline = problems.reduce((sum, p) => sum + p.online_count, 0);
    const avgOnline = Math.round(totalOnline / problems.length);
    const maxOnline = Math.max(...problems.map(p => p.online_count));
    const minOnline = Math.min(...problems.map(p => p.online_count));
    const medianOnline = problems.map(p => p.online_count).sort((a, b) => a - b)[Math.floor(problems.length / 2)];
    
    const top10Online = problems
      .slice()
      .sort((a, b) => b.online_count - a.online_count)
      .slice(0, 10)
      .reduce((sum, p) => sum + p.online_count, 0);
    const top10Percentage = Math.round((top10Online / totalOnline) * 100);
    
    const activeProblems = problems.filter(p => p.online_count > 100).length;
    const veryActiveProblems = problems.filter(p => p.online_count > 300).length;
    
    return {
      totalOnline,
      avgOnline,
      maxOnline,
      minOnline,
      medianOnline,
      top10Percentage,
      activeProblems,
      veryActiveProblems,
    };
  }, [problems]);

  const topProblems = (problems || [])
    .slice()
    .sort((a, b) => (b?.online_count || 0) - (a?.online_count || 0))
    .slice(0, 10);

  if (loading) return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e7f1 100%)'
    }}>
      <Spin size="large" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ========== Hero Section ========== */}
      <section style={{
        background: '#FFA116',
        padding: '80px 24px 100px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 背景装饰 */}
        <div style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          borderRadius: 0,
          background: 'rgba(255,255,255,0.1)',
          filter: 'blur(60px)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: -50,
          left: -50,
          width: 300,
          height: 300,
          borderRadius: 0,
          background: 'rgba(255,255,255,0.08)',
          filter: 'blur(40px)'
        }} />
        
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <Row gutter={[48, 48]} align="middle">
            <Col xs={24} lg={14}>
              <div style={{ marginBottom: 24 }}>
                <Badge 
                  status="success" 
                  text={<span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>● 实时数据推送中</span>} 
                  style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 2 }}
                />
              </div>
              
              <h1 style={{
                fontSize: 56,
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.1,
                marginBottom: 24,
                letterSpacing: '-1px'
              }}>
                LeetCode Hot 100
                <br />
                <span style={{ fontWeight: 400 }}>实时刷题监控</span>
              </h1>
              
              <p style={{
                fontSize: 20,
                color: 'rgba(255,255,255,0.9)',
                lineHeight: 1.6,
                marginBottom: 32,
                maxWidth: 500
              }}>
                实时监控 LeetCode 热门 100 题的在线刷题人数，
                WebSocket 毫秒级推送，掌握算法学习趋势。
              </p>
              
              <Space size="middle">
                <Link to="/rankings">
                  <Button 
                    type="primary" 
                    size="large"
                    icon={<RocketOutlined />}
                    style={{
                      height: 48,
                      padding: '0 32px',
                      fontSize: 16,
                      fontWeight: 600,
                      borderRadius: 2,
                      background: '#fff',
                      color: '#FFA116',
                      border: 'none',
                      boxShadow: 'none'
                    }}
                  >
                    查看排行榜
                  </Button>
                </Link>
                <Link to="/statistics">
                  <Button 
                    size="large"
                    icon={<BarChartOutlined />}
                    style={{
                      height: 48,
                      padding: '0 32px',
                      fontSize: 16,
                      fontWeight: 500,
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.15)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.3)'
                    }}
                  >
                    详细统计
                  </Button>
                </Link>
              </Space>
              
                <div style={{ marginTop: 40, display: 'flex', gap: 32 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                    <AnimatedNumber value={stats.totalProblems} />
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>监控题目</div>
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                    <AnimatedNumber value={stats.totalOnline} />
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>当前在线</div>
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>ms</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>毫秒级延迟</div>
                </div>
              </div>
            </Col>
            
            <Col xs={24} lg={10}>
              {/* 实时数据卡片 */}
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
                padding: 24,
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#52c41a',
                    animation: 'pulse 2s infinite'
                  }} />
                  <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>实时热门题目</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {topProblems.slice(0, 5).map((item, index) => (
                    <div key={item.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 2
                    }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: 2,
                        background: index < 3 ? ['#FF4D4F', '#FF7A45', '#FFA940'][index] : 'rgba(255,255,255,0.2)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700
                      }}>
                        {index + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <a 
                            href={`https://leetcode.cn/problems/${item.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ 
                              color: '#fff', 
                              fontSize: 14, 
                              fontWeight: 500, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap',
                              textDecoration: 'none'
                            }}
                          >
                            {item.title}
                          </a>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: 2,
                            fontSize: 11,
                            fontWeight: 500,
                            ...difficultyColors[item.difficulty]
                          }}>
                            {item.difficulty}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {item.topic_tags && item.topic_tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} style={{
                              padding: '1px 6px',
                              borderRadius: 2,
                              fontSize: 10,
                              background: 'rgba(255,255,255,0.15)',
                              color: 'rgba(255,255,255,0.85)'
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* 拥挤度竖条图标 */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'flex-end', 
                          gap: 2,
                          height: 18
                        }}>
                          {[1, 2, 3, 4].map((level) => {
                            const threshold = level * 25;
                            const isActive = item.online_count >= threshold;
                            const height = level * 3 + 6;
                            return (
                              <div
                                key={level}
                                style={{
                                  width: 3,
                                  height: height,
                                  backgroundColor: isActive 
                                    ? item.online_count >= 75 ? '#ff4d4f' : item.online_count >= 50 ? '#ff7a45' : '#52c41a'
                                    : '#d9d9d9',
                                  borderRadius: 1,
                                  transition: 'all 0.3s ease'
                                }}
                              />
                            );
                          })}
                        </div>
                        <span style={{ 
                          color: '#262626', 
                          fontSize: 14, 
                          fontWeight: 600,
                          marginLeft: 4
                        }}>
                          {item.online_count.toLocaleString()}
                        </span>
                        <span style={{ 
                          color: '#8c8c8c', 
                          fontSize: 11
                        }}>
                          人在线
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <Link to="/rankings" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                    查看完整榜单 <RightOutlined />
                  </Link>
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </section>

      {/* ========== Features Section ========== */}
      <section style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, color: '#262626', marginBottom: 16 }}>
            核心功能
          </h2>
          <p style={{ fontSize: 18, color: '#8c8c8c', maxWidth: 600, margin: '0 auto' }}>
            WebSocket 实时数据推送，毫秒级延迟，全方位了解刷题趋势
          </p>
        </div>
        
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={8}>
            <FeatureCard
              icon={<WifiOutlined />}
              title="实时监控"
              description="基于 WebSocket 的实时数据推送，毫秒级延迟推送，掌握最新刷题动态"
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <FeatureCard
              icon={<LineChartOutlined />}
              title="趋势分析"
              description="查看每道题目的历史在线人数变化，发现题目热度的上升下降趋势"
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <FeatureCard
              icon={<TrophyOutlined />}
              title="热门排行"
              description="按在线人数排序的实时排行榜，快速找到当前最受欢迎的算法题目"
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <FeatureCard
              icon={<ThunderboltOutlined />}
              title="难度分布"
              description="按 Easy、Medium、Hard 分类统计，了解不同难度题目的受欢迎程度"
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <FeatureCard
              icon={<AimOutlined />}
              title="精准定位"
              description="直接跳转到 LeetCode 题目页面，无缝衔接学习和练习体验"
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <FeatureCard
              icon={<SafetyOutlined />}
              title="数据可靠"
              description="云端部署，7×24 小时不间断监控，确保数据的准确性和实时性"
            />
          </Col>
        </Row>
      </section>

      {/* ========== Live Stats Section ========== */}
      <section style={{ 
        background: '#fff', 
        padding: '80px 24px',
        borderTop: '1px solid #f0f0f0',
        borderBottom: '1px solid #f0f0f0'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Badge 
              status="processing" 
              text={<span style={{ fontSize: 14, fontWeight: 500 }}>实时数据</span>}
              style={{ marginBottom: 16 }}
            />
            <h2 style={{ fontSize: 36, fontWeight: 700, color: '#262626', marginBottom: 16 }}>
              当前刷题统计
            </h2>
            <p style={{ fontSize: 16, color: '#8c8c8c' }}>
              最后更新: {lastUpdateTime || '刚刚'}
            </p>
          </div>
          
          <Row gutter={[24, 24]} style={{ marginBottom: 48 }}>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                icon={<TeamOutlined />}
                title="总在线人数"
                value={<AnimatedNumber value={stats.totalOnline} />}
                subTitle="当前活跃刷题人数"
                large
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                icon={<BarChartOutlined />}
                title="平均每题在线"
                value={computedStats?.avgOnline || 0}
                subTitle="人/题目"
                trend={computedStats ? Math.round(((computedStats.avgOnline - 50) / 50) * 100) : 0}
                large
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                icon={<FireOutlined />}
                title="最热门题目"
                value={stats.hotProblem?.online_count || 0}
                subTitle={stats.hotProblem?.title?.slice(0, 12) + '...' || '-'}
                large
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                icon={<RiseOutlined />}
                title="头部集中度"
                value={`${computedStats?.top10Percentage || 0}%`}
                subTitle="Top 10 占比"
                large
              />
            </Col>
          </Row>
          
          {/* 总在线人数历史趋势图 */}
          <Row gutter={[24, 24]} style={{ marginBottom: 48 }}>
            <Col xs={24}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LineChartOutlined style={{ color: '#FFA116' }} />
                    <span style={{ fontSize: 18, fontWeight: 600 }}>24小时总在线人数趋势</span>
                    <Tag color="blue" style={{ marginLeft: 8 }}>每分钟更新</Tag>
                  </div>
                }
                style={{ borderRadius: 0, border: '1px solid #e8e8e8' }}
                headStyle={{ borderBottom: '1px solid #f0f0f0', padding: '20px 24px' }}
                bodyStyle={{ padding: '24px' }}
              >
                <TotalOnlineChart refreshInterval={60000} />
              </Card>
            </Col>
          </Row>
          
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card 
                title={
                  <Title level={5} style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrophyOutlined /> 热门题目排行榜 Top 10 <Tag color="blue">实时</Tag>
                  </Title>
                }
                extra={
                  <Link to="/rankings" style={{ color: '#1890ff', fontWeight: 500 }}>
                    查看全部 <RightOutlined />
                  </Link>
                }
                style={{ borderRadius: 0, border: '1px solid #e8e8e8' }}
                headStyle={{ borderBottom: '1px solid #f0f0f0', padding: '20px 24px' }}
                bodyStyle={{ padding: '12px 24px' }}
              >
                <List
                  dataSource={topProblems}
                  renderItem={(item, index) => {
                    const colors = ['#ff4d4f', '#ff7a45', '#ffa940', '#1890ff', '#52c41a'];
                    const rankColor = index < 3 ? colors[index] : '#8c8c8c';
                    const intensity = Math.min(100, Math.round((item.online_count / (stats.hotProblem?.online_count || 1)) * 100));
                    
                    return (
                      <div 
                        key={item.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '14px 0',
                          borderBottom: index < topProblems.length - 1 ? '1px solid #f5f5f5' : 'none',
                          gap: 16
                        }}
                      >
                        <div style={{ 
                          width: 32, 
                          height: 32, 
                          borderRadius: 8,
                          background: index < 3 ? rankColor : '#f5f5f5',
                          color: index < 3 ? '#fff' : '#8c8c8c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 14,
                          flexShrink: 0
                        }}>
                          {index + 1}
                        </div>
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <Link 
                              to={`https://leetcode.cn/problems/${item.slug}`} 
                              target="_blank"
                              style={{ 
                                color: '#262626', 
                                fontWeight: 600,
                                fontSize: 15,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {item.title}
                            </Link>
                            <Tag 
                              style={{ 
                                background: difficultyColors[item.difficulty]?.bg,
                                color: difficultyColors[item.difficulty]?.text,
                                border: `1px solid ${difficultyColors[item.difficulty]?.border}`,
                                fontSize: 11,
                                padding: '0 8px',
                                margin: 0,
                                flexShrink: 0,
                                fontWeight: 500
                              }}
                            >
                              {item.difficulty}
                            </Tag>
                          </div>
                          <div style={{ fontSize: 13, color: '#8c8c8c' }}>
                            slug: {item.slug}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          <ActivityHeatmap intensity={intensity} />
                          <div style={{ 
                            minWidth: 60,
                            textAlign: 'right',
                            fontWeight: 700,
                            color: intensity > 60 ? '#fa8c16' : '#262626',
                            fontSize: 16
                          }}>
                            {item.online_count.toLocaleString()}
                          </div>
                          <Tooltip title="查看历史趋势">
                            <Link to={`/history?problemId=${item.id}`} style={{ color: '#1890ff', fontSize: 16 }}>
                              <HistoryOutlined />
                            </Link>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  }}
                />
              </Card>
            </Col>
            
            <Col xs={24} lg={8}>
              {/* 难度分布 */}
              <Card 
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ThunderboltOutlined style={{ color: '#FFA116' }} />
                    <span style={{ fontSize: 16, fontWeight: 600 }}>难度分布</span>
                  </div>
                }
                style={{ borderRadius: 0, border: '1px solid #e8e8e8', marginBottom: 24 }}
                headStyle={{ borderBottom: '1px solid #f0f0f0', padding: '16px 20px' }}
                bodyStyle={{ padding: '20px' }}
              >
                {['Easy', 'Medium', 'Hard'].map(diff => {
                  const count = problems.filter(p => p.difficulty?.toString().toLowerCase() === diff.toLowerCase()).length;
                  const online = problems.filter(p => p.difficulty?.toString().toLowerCase() === diff.toLowerCase()).reduce((s, p) => s + p.online_count, 0);
                  const percentage = problems.length > 0 ? Math.round((count / problems.length) * 100) : 0;
                  const colors = difficultyColors[diff];
                  
                  return (
                    <div key={diff} style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            background: colors.text
                          }} />
                          <span style={{ fontWeight: 600, color: '#262626', fontSize: 14 }}>{diff}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#262626', fontSize: 15 }}>{count} 题</div>
                          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{online.toLocaleString()} 人在线</div>
                        </div>
                      </div>
                      <Progress 
                        percent={percentage} 
                        showInfo={false}
                        strokeColor={colors.text}
                        trailColor="#f5f5f5"
                        strokeWidth={8}
                        style={{ margin: 0 }}
                      />
                    </div>
                  );
                })}
              </Card>

              {/* 活跃度统计 */}
              <Card 
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RiseOutlined style={{ color: '#FFA116' }} />
                    <span style={{ fontSize: 16, fontWeight: 600 }}>活跃度分布</span>
                  </div>
                }
                style={{ borderRadius: 0, border: '1px solid #e8e8e8' }}
                headStyle={{ borderBottom: '1px solid #f0f0f0', padding: '16px 20px' }}
                bodyStyle={{ padding: '20px' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div style={{ 
                    padding: 16, 
                    background: '#FFF7E6', 
                    borderRadius: 0,
                    border: '1px solid #FFD591',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#FFA116' }}>
                      {computedStats?.activeProblems || 0}
                    </div>
                    <div style={{ fontSize: 12, color: '#FF8C00', fontWeight: 500 }}>活跃题目 (&gt;100人)</div>
                  </div>
                  <div style={{ 
                    padding: 16, 
                    background: '#FFF2E8', 
                    borderRadius: 0,
                    border: '1px solid #FFBB96',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#FF6A00' }}>
                      {computedStats?.veryActiveProblems || 0}
                    </div>
                    <div style={{ fontSize: 12, color: '#FF8C00', fontWeight: 500 }}>超热题目 (&gt;300人)</div>
                  </div>
                </div>
                <Divider style={{ margin: '16px 0' }} />
                <div style={{ fontSize: 14, color: '#595959', lineHeight: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>中位数在线</span>
                    <strong style={{ color: '#262626' }}>{computedStats?.medianOnline || 0} 人</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>最高在线</span>
                    <strong style={{ color: '#fa8c16' }}>{computedStats?.maxOnline || 0} 人</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>最低在线</span>
                    <strong style={{ color: '#8c8c8c' }}>{computedStats?.minOnline || 0} 人</strong>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </section>

      {/* ========== CTA Section ========== */}
      <section style={{
        background: '#FFA116',
        padding: '80px 24px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{
            fontSize: 40,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 20,
            letterSpacing: '-0.5px'
          }}>
            开始探索热门题目
          </h2>
          <p style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.9)',
            marginBottom: 32,
            lineHeight: 1.6
          }}>
            查看完整的 LeetCode Hot 100 实时排行榜，发现最受欢迎的算法题目
          </p>
          <Space size="middle">
            <Link to="/rankings">
              <Button 
                type="primary" 
                size="large"
                icon={<RocketOutlined />}
                style={{
                  height: 52,
                  padding: '0 40px',
                  fontSize: 17,
                  fontWeight: 600,
                  borderRadius: 2,
                  background: '#fff',
                  color: '#FFA116',
                  border: 'none',
                  boxShadow: 'none'
                }}
              >
                查看排行榜
              </Button>
            </Link>
            <Link to="/history">
              <Button 
                size="large"
                icon={<HistoryOutlined />}
                style={{
                  height: 52,
                  padding: '0 40px',
                  fontSize: 17,
                  fontWeight: 500,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}
              >
                历史趋势
              </Button>
            </Link>
          </Space>
        </div>
      </section>

      {/* ========== Footer ========== */}
      <footer style={{
        background: '#fff',
        padding: '40px 24px',
        borderTop: '1px solid #f0f0f0'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 32, 
            marginBottom: 24,
            flexWrap: 'wrap'
          }}>
            <Link to="/" style={{ color: '#8c8c8c', fontSize: 14, textDecoration: 'none' }}>首页</Link>
            <Link to="/rankings" style={{ color: '#8c8c8c', fontSize: 14, textDecoration: 'none' }}>排行榜</Link>
            <Link to="/statistics" style={{ color: '#8c8c8c', fontSize: 14, textDecoration: 'none' }}>统计</Link>
            <Link to="/history" style={{ color: '#8c8c8c', fontSize: 14, textDecoration: 'none' }}>历史</Link>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#8c8c8c', fontSize: 14, textDecoration: 'none' }}
            >
              GitHub
            </a>
          </div>
          <div style={{ fontSize: 13, color: '#bfbfbf' }}>
            <p style={{ marginBottom: 8 }}>
              LeetCode Hot 100 实时监控系统 · WebSocket 毫秒级推送 · 云端部署 v2.0
            </p>
            <p>
              © {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* 添加CSS动画 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .feature-card:hover {
          border-color: #FFA116;
        }
      `}</style>
    </div>
  );
};

export default Home;
