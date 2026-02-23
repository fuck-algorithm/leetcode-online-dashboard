import React from 'react';
import { Badge, Button, Space, Tooltip } from 'antd';
import { Link } from 'react-router-dom';
import { RocketOutlined, BarChartOutlined, RightOutlined } from '@ant-design/icons';
import { Problem } from '../../types';
import { HeroOnlineCount, AnimatedNumber } from './OnlineCountComponents';
import { HomeStats } from './types';

interface HeroSectionProps {
  stats: HomeStats;
  topProblems: Problem[];
}

export const HeroSection: React.FC<HeroSectionProps> = ({ stats, topProblems }) => {
  return (
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
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 48 }}>
          <div style={{ flex: '0 0 auto', minWidth: 0, marginBottom: 48 }}>
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
                <div style={{ marginBottom: 8 }}>
                  <HeroOnlineCount 
                    cn={stats.totalOnlineCN} 
                    com={stats.totalOnlineCOM} 
                    total={stats.totalOnline}
                  />
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>当前在线</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>ms</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>毫秒级延迟</div>
              </div>
            </div>
          </div>
          
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            {/* 实时数据卡片 */}
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: 2,
              padding: 24,
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, whiteSpace: 'nowrap' }}>
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
                    borderRadius: 2,
                    whiteSpace: 'nowrap'
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
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
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
                          textDecoration: 'none',
                          maxWidth: '140px'
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </a>
                      <span style={{
                        padding: '1px 4px',
                        borderRadius: 2,
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.65)',
                        background: 'rgba(255,255,255,0.1)',
                        flexShrink: 0
                      }}>
                        {item.difficulty}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {/* 拥挤度竖条图标 */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'flex-end', 
                        gap: 2,
                        height: 18
                      }}>
                        {[1, 2, 3, 4].map((level) => {
                          const threshold = level * 25;
                          const isActive = (item.online_count || 0) >= threshold;
                          const height = level * 3 + 6;
                          return (
                            <div
                              key={level}
                              style={{
                                width: 3,
                                height: height,
                                backgroundColor: isActive 
                                  ? (item.online_count || 0) >= 75 ? '#ff4d4f' : (item.online_count || 0) >= 50 ? '#ff7a45' : '#52c41a'
                                  : '#d9d9d9',
                                borderRadius: 1,
                                transition: 'all 0.3s ease'
                              }}
                            />
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                        <Tooltip title="中文站 - 点击跳转">
                          <a 
                            href={`https://leetcode.cn/problems/${item.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#ff4d4f', textDecoration: 'none', cursor: 'pointer' }}
                          >
                            🇨🇳{item.online_count_cn?.toLocaleString() || 0}
                          </a>
                        </Tooltip>
                        <span style={{ margin: '0 4px', color: 'rgba(255,255,255,0.4)' }}>|</span>
                        <Tooltip title="国际站 - 点击跳转">
                          <a 
                            href={`https://leetcode.com/problems/${item.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#1890ff', textDecoration: 'none', cursor: 'pointer' }}
                          >
                            🇺🇸{item.online_count_com?.toLocaleString() || 0}
                          </a>
                        </Tooltip>
                        <span style={{ margin: '0 4px', color: 'rgba(255,255,255,0.4)' }}>|</span>
                        <Tooltip title="全球汇总 - 点击跳转中文站">
                          <a 
                            href={`https://leetcode.cn/problems/${item.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#52c41a', textDecoration: 'none', cursor: 'pointer' }}
                          >
                            🌐{item.online_count?.toLocaleString() || 0}
                          </a>
                        </Tooltip>
                      </div>
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
          </div>
        </div>
      </div>
    </section>
  );
};
