import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Problem } from '../../types';
import { useWebSocket } from '../../hooks/useWebSocket';
import { WSProblem, HomeStats, ComputedStats } from './types';
import { HeroSection } from './HeroSection';
import { FeaturesSection } from './FeaturesSection';
import { LiveStatsSection } from './LiveStatsSection';
import { CTASection } from './CTASection';
import { Footer } from './Footer';
import { HomeSkeleton } from './HomeSkeleton';

const Home: React.FC = () => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const problemsRef = useRef<Problem[]>([]);
  const [problemBaseData, setProblemBaseData] = useState<Record<string, Problem>>({});
  const problemBaseDataRef = useRef<Record<string, Problem>>({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<HomeStats>({
    totalOnline: 0,
    totalOnlineCN: 0,
    totalOnlineCOM: 0,
    totalProblems: 0,
    hotProblem: null,
  });
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');

  // 保持 ref 同步
  useEffect(() => {
    problemsRef.current = problems;
  }, [problems]);
  
  useEffect(() => {
    problemBaseDataRef.current = problemBaseData;
  }, [problemBaseData]);

  // 获取题目数据并立即渲染
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/hot100/problems');
        if (response.ok) {
          const data = await response.json();
          const problemsArray = Array.isArray(data) ? data : (data.data || []);
          
          if (problemsArray.length > 0) {
            const formattedProblems: Problem[] = problemsArray.map((p: any) => ({
              id: p.frontend_id,
              frontend_id: p.frontend_id,
              slug: p.slug,
              title: p.title_cn || p.title,
              difficulty: (p.difficulty?.toUpperCase() === 'EASY' ? 'Easy' : p.difficulty?.toUpperCase() === 'HARD' ? 'Hard' : 'Medium') as 'Easy' | 'Medium' | 'Hard',
              online_count: p.online_count || 0,
              online_count_cn: p.online_count_cn || 0,
              online_count_com: p.online_count_com || 0,
              last_updated: p.last_updated,
              topic_tags: p.topic_tags || [],
            }));
            
            setProblems(formattedProblems);
            setProblemBaseData(Object.fromEntries(problemsArray.map((p: any) => [p.frontend_id, p])));
            
            // 计算统计数据
            const totalOnline = formattedProblems.reduce((sum, p) => sum + p.online_count, 0);
            const totalCN = formattedProblems.reduce((sum, p) => sum + (p.online_count_cn || 0), 0);
            const totalCOM = formattedProblems.reduce((sum, p) => sum + (p.online_count_com || 0), 0);
            const hotProblem = formattedProblems.reduce((max, p) => p.online_count > max.online_count ? p : max, formattedProblems[0]);
            
            setStats({
              totalOnline,
              totalOnlineCN: totalCN,
              totalOnlineCOM: totalCOM,
              totalProblems: formattedProblems.length,
              hotProblem: hotProblem ? {
                title: hotProblem.title,
                online_count: hotProblem.online_count,
                online_count_cn: hotProblem.online_count_cn || 0,
                online_count_com: hotProblem.online_count_com || 0,
              } : null,
            });
            setLastUpdateTime(new Date().toLocaleTimeString());
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch problems:', err);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // WebSocket 实时更新
  const handleWebSocketMessage = useCallback((data: any) => {
    if (data.type === 'batch_update' && data.problems) {
      const wsProblems: WSProblem[] = data.problems;
      
      setProblems(prev => {
        const updates = new Map(wsProblems.map(p => [p.frontend_id, p]));
        return prev.map(p => {
          const ws = updates.get(p.frontend_id);
          if (ws) {
            const cnCount = ws.online_count_cn ?? 0;
            const comCount = ws.online_count_com ?? 0;
            return {
              ...p,
              online_count: ws.online_count ?? (cnCount + comCount),
              online_count_cn: cnCount,
              online_count_com: comCount,
              last_updated: ws.last_updated ? new Date(ws.last_updated * 1000).toISOString() : p.last_updated,
            };
          }
          return p;
        });
      });
      
      setStats(prev => {
        let totalCN = 0, totalCOM = 0;
        wsProblems.forEach(p => {
          totalCN += p.online_count_cn || 0;
          totalCOM += p.online_count_com || 0;
        });
        return {
          ...prev,
          totalOnline: totalCN + totalCOM,
          totalOnlineCN: totalCN,
          totalOnlineCOM: totalCOM,
        };
      });
      
      setLastUpdateTime(new Date().toLocaleTimeString());
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  const computedStats = useMemo<ComputedStats | null>(() => {
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

  if (loading) return <HomeSkeleton />;

  return (
    <div style={{ minHeight: '100vh' }}>
      <HeroSection stats={stats} topProblems={topProblems} />
      <FeaturesSection />
      <LiveStatsSection 
        stats={stats} 
        computedStats={computedStats} 
        problems={problems} 
        topProblems={topProblems}
        lastUpdateTime={lastUpdateTime}
      />
      <CTASection />
      <Footer />

      {/* CSS动画 */}
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
