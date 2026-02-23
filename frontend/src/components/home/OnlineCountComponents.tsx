import React from 'react';
import { Tooltip } from 'antd';

// Hero 区域专用的大号在线人数展示组件
export const HeroOnlineCount: React.FC<{ 
  cn: number; 
  com: number; 
  total: number;
}> = ({ cn, com, total }) => {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(3, 1fr)', 
      gap: 12,
      background: 'rgba(255,255,255,0.1)',
      borderRadius: 4,
      padding: '8px 12px'
    }}>
      <Tooltip title="中文站 LeetCode.cn">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#ff4d4f' }}>
            <span style={{ marginRight: 4 }}>🇨🇳</span>{cn.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>中文站</div>
        </div>
      </Tooltip>
      <Tooltip title="国际站 LeetCode.com">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1890ff' }}>
            <span style={{ marginRight: 4 }}>🇺🇸</span>{com.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>国际站</div>
        </div>
      </Tooltip>
      <Tooltip title="全球汇总">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#52c41a' }}>
            <span style={{ marginRight: 4 }}>🌐</span>{total.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>全球汇总</div>
        </div>
      </Tooltip>
    </div>
  );
};

// 紧凑型内联在线人数展示组件
export const CompactOnlineCount: React.FC<{ 
  cn: number; 
  com: number; 
  total: number;
  size?: 'small' | 'normal';
}> = ({ cn, com, total, size = 'normal' }) => {
  const fontSize = size === 'small' ? 11 : 13;
  const color = size === 'small' ? '#8c8c8c' : '#595959';
  
  return (
    <span style={{ fontSize, color, fontWeight: 500, whiteSpace: 'nowrap' }}>
      <Tooltip title="中文站 LeetCode.cn">
        <span style={{ color: '#ff4d4f' }}>🇨🇳{cn.toLocaleString()}</span>
      </Tooltip>
      <span style={{ margin: '0 4px', color: '#d9d9d9' }}>|</span>
      <Tooltip title="国际站 LeetCode.com">
        <span style={{ color: '#1890ff' }}>🇺🇸{com.toLocaleString()}</span>
      </Tooltip>
      <span style={{ margin: '0 4px', color: '#d9d9d9' }}>|</span>
      <Tooltip title="全球汇总">
        <span style={{ color: '#ffa116' }}>🌐{total.toLocaleString()}</span>
      </Tooltip>
    </span>
  );
};

// 可点击的在线人数展示组件
export const ClickableOnlineCount: React.FC<{ 
  cn: number; 
  com: number; 
  total: number;
  slug: string;
  size?: 'small' | 'normal';
}> = ({ cn, com, total, slug, size = 'normal' }) => {
  const fontSize = size === 'small' ? 11 : 13;
  
  return (
    <span style={{ fontSize, fontWeight: 500, whiteSpace: 'nowrap' }}>
      <Tooltip title="中文站 LeetCode.cn - 点击跳转">
        <a 
          href={`https://leetcode.cn/problems/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#ff4d4f', textDecoration: 'none', cursor: 'pointer' }}
        >
          🇨🇳{cn.toLocaleString()}
        </a>
      </Tooltip>
      <span style={{ margin: '0 4px', color: '#d9d9d9' }}>|</span>
      <Tooltip title="国际站 LeetCode.com - 点击跳转">
        <a 
          href={`https://leetcode.com/problems/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1890ff', textDecoration: 'none', cursor: 'pointer' }}
        >
          🇺🇸{com.toLocaleString()}
        </a>
      </Tooltip>
      <span style={{ margin: '0 4px', color: '#d9d9d9' }}>|</span>
      <Tooltip title="全球汇总 - 点击跳转中文站">
        <a 
          href={`https://leetcode.cn/problems/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#ffa116', textDecoration: 'none', cursor: 'pointer' }}
        >
          🌐{total.toLocaleString()}
        </a>
      </Tooltip>
    </span>
  );
};

// 活跃度热力图组件
export const ActivityHeatmap: React.FC<{ intensity: number }> = ({ intensity }) => {
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
export const AnimatedNumber: React.FC<{ value: number; duration?: number }> = ({ value, duration = 1000 }) => {
  const [displayValue, setDisplayValue] = React.useState(0);
  
  React.useEffect(() => {
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
