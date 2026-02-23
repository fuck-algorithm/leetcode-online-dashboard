import React from 'react';

// 特性卡片组件
export const FeatureCard: React.FC<{
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
