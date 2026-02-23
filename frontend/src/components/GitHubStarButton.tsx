import { useEffect, useState } from 'react';
import { Tooltip } from 'antd';
import { StarOutlined } from '@ant-design/icons';
import { getFromIndexedDB, setToIndexedDB, STORAGE_KEYS } from '../utils/indexedDB';

interface GitHubStarButtonProps {
  owner: string;
  repo: string;
}

const GitHubStarButton: React.FC<GitHubStarButtonProps> = ({ owner, repo }) => {
  const [starCount, setStarCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStarCount = async () => {
      // 检查缓存
      const cachedTime = await getFromIndexedDB<number>(STORAGE_KEYS.GITHUB_STAR_CACHE_TIME);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      if (cachedTime && now - cachedTime < oneHour) {
        // 使用缓存数据
        const cachedCount = await getFromIndexedDB<number>(STORAGE_KEYS.GITHUB_STAR_COUNT);
        if (cachedCount !== null) {
          setStarCount(cachedCount);
          setLoading(false);
          return;
        }
      }

      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (response.ok) {
          const data = await response.json();
          const count = data.stargazers_count;
          setStarCount(count);
          // 缓存数据和当前时间
          await setToIndexedDB(STORAGE_KEYS.GITHUB_STAR_COUNT, count);
          await setToIndexedDB(STORAGE_KEYS.GITHUB_STAR_CACHE_TIME, now);
        } else {
          // 如果API失败，使用缓存数据（即使已过期）
          const cachedCount = await getFromIndexedDB<number>(STORAGE_KEYS.GITHUB_STAR_COUNT);
          if (cachedCount !== null) {
            setStarCount(cachedCount);
          }
        }
      } catch (error) {
        console.error('Failed to fetch GitHub stars:', error);
        // 使用缓存数据
        const cachedCount = await getFromIndexedDB<number>(STORAGE_KEYS.GITHUB_STAR_COUNT);
        if (cachedCount !== null) {
          setStarCount(cachedCount);
        }
      } finally {
        setLoading(false);
      }
    };

    // 使用 requestIdleCallback 在浏览器空闲时加载，避免阻塞页面
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        fetchStarCount();
      }, { timeout: 5000 }); // 最多等待5秒
    } else {
      // 降级方案：延迟2秒后加载
      setTimeout(fetchStarCount, 2000);
    }
  }, [owner, repo]);

  const repoUrl = `https://github.com/${owner}/${repo}`;

  return (
    <Tooltip title="去 GitHub 给我们点个 Star 支持一下吧！" placement="bottom">
      <a
        href={repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          backgroundColor: 'transparent',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '6px',
          textDecoration: 'none',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 600,
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="#001529"
            style={{ display: 'block' }}
          >
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
          </svg>
        </div>
        <span>Star</span>
        <StarOutlined style={{ color: '#FFA116', fontSize: '12px' }} />
        {loading ? (
          <span style={{ minWidth: '20px', textAlign: 'center' }}>-</span>
        ) : starCount !== null ? (
          <span style={{ minWidth: '20px', textAlign: 'center' }}>{starCount.toLocaleString()}</span>
        ) : (
          <span style={{ minWidth: '20px', textAlign: 'center' }}>-</span>
        )}
      </a>
    </Tooltip>
  );
};

export default GitHubStarButton;
