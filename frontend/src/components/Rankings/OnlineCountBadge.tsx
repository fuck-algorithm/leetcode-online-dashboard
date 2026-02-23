import React from 'react';

export const OnlineCountBadge: React.FC<{ count: number }> = ({ count }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <div style={{ 
      display: 'flex', 
      alignItems: 'flex-end', 
      gap: 2,
      height: 16
    }}>
      {[1, 2, 3, 4].map((level) => {
        const threshold = level * 25;
        const isActive = count >= threshold;
        const height = level * 3 + 5;
        return (
          <div
            key={level}
            style={{
              width: 3,
              height: height,
              backgroundColor: isActive 
                ? count >= 75 ? '#ff4d4f' : count >= 50 ? '#ff7a45' : '#52c41a'
                : '#d9d9d9',
              borderRadius: 1,
              transition: 'all 0.3s ease'
            }}
          />
        );
      })}
    </div>
    <span className="lc-online-badge" style={{ marginLeft: 4 }}>
      {count.toLocaleString()}
    </span>
  </div>
);
