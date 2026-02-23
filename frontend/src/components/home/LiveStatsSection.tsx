import React from 'react';
import { Row, Col, Card, Badge, Tag, List, Progress, Divider, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { 
  RiseOutlined, 
  TrophyOutlined, 
  ThunderboltOutlined, 
  LineChartOutlined,
  HistoryOutlined,
  RightOutlined
} from '@ant-design/icons';
import { Problem } from '../../types';
import TotalOnlineChart from '../TotalOnlineChart';
import { CompactOnlineCount, ClickableOnlineCount, ActivityHeatmap } from './OnlineCountComponents';
import { difficultyColors, HomeStats, ComputedStats } from './types';

const { Title } = Typography;

interface LiveStatsSectionProps {
  stats: HomeStats;
  computedStats: ComputedStats | null;
  problems: Problem[];
  topProblems: Problem[];
  lastUpdateTime: string;
}

export const LiveStatsSection: React.FC<LiveStatsSectionProps> = ({ 
  stats, 
  computedStats, 
  problems, 
  topProblems,
  lastUpdateTime 
}) => {
  return (
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
            <Card style={{ borderRadius: 0, border: '1px solid #e8e8e8', height: '120px' }} bodyStyle={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 'auto' }}>总在线人数</div>
              <CompactOnlineCount 
                cn={stats.totalOnlineCN}
                com={stats.totalOnlineCOM}
                total={stats.totalOnline}
                size="normal"
              />
              <div style={{ fontSize: 12, color: '#bfbfbf', marginTop: 'auto' }}>当前活跃刷题人数</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 0, border: '1px solid #e8e8e8', height: '120px' }} bodyStyle={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 'auto' }}>平均每题在线</div>
              <CompactOnlineCount 
                cn={Math.round(stats.totalOnlineCN / (stats.totalProblems || 1))}
                com={Math.round(stats.totalOnlineCOM / (stats.totalProblems || 1))}
                total={Math.round(stats.totalOnline / (stats.totalProblems || 1))}
                size="normal"
              />
              <div style={{ fontSize: 12, color: '#bfbfbf', marginTop: 'auto' }}>人/题目</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 0, border: '1px solid #e8e8e8', height: '120px' }} bodyStyle={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 'auto' }}>最热门题目</div>
              {stats.hotProblem ? (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#262626', marginBottom: 4 }}>
                    {stats.hotProblem.title.slice(0, 12)}...
                  </div>
                  <CompactOnlineCount 
                    cn={stats.hotProblem.online_count_cn || 0}
                    com={stats.hotProblem.online_count_com || 0}
                    total={stats.hotProblem.online_count || 0}
                    size="small"
                  />
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#bfbfbf' }}>-</div>
              )}
              <div style={{ fontSize: 12, color: '#bfbfbf', marginTop: 'auto', visibility: 'hidden' }}>占位</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 0, border: '1px solid #e8e8e8', height: '120px' }} bodyStyle={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 'auto' }}>头部集中度</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 0,
                  background: '#FFA116',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  color: '#fff',
                  flexShrink: 0
                }}>
                  <RiseOutlined />
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#262626' }}>
                    {computedStats?.top10Percentage || 0}%
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>Top 10 占比</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#bfbfbf', marginTop: 'auto', visibility: 'hidden' }}>占位</div>
            </Card>
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
                <Title level={5} style={{ margin: 0, color: '#262626', display: 'flex', alignItems: 'center', gap: 8 }}>
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
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <ActivityHeatmap intensity={intensity} />
                        <ClickableOnlineCount 
                          cn={item.online_count_cn || 0}
                          com={item.online_count_com || 0}
                          total={item.online_count || 0}
                          slug={item.slug}
                          size="normal"
                        />
                        <Link to={`/history?problemId=${item.id}`} style={{ color: '#1890ff', fontSize: 16 }}>
                          <HistoryOutlined />
                        </Link>
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
                        <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                          <CompactOnlineCount 
                            cn={problems.filter(p => p.difficulty?.toString().toLowerCase() === diff.toLowerCase()).reduce((s, p) => s + (p.online_count_cn || 0), 0)}
                            com={problems.filter(p => p.difficulty?.toString().toLowerCase() === diff.toLowerCase()).reduce((s, p) => s + (p.online_count_com || 0), 0)}
                            total={online}
                            size="small"
                          />
                        </div>
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
  );
};
