import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
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
  );
};
