import React from 'react';
import { Button, Space } from 'antd';
import { Link } from 'react-router-dom';
import { RocketOutlined, HistoryOutlined } from '@ant-design/icons';

export const CTASection: React.FC = () => {
  return (
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
  );
};
