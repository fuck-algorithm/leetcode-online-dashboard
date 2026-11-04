import React, { useMemo, useState } from 'react';
import { Typography } from 'antd';
import {
  ToolOutlined,
  CodeOutlined,
  RobotOutlined,
  ApiOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import {
  DocLayout,
  useDocNavigation,
  DocSection,
  DocNote,
  DocCodeBlock,
  DocJsonBlock,
} from './docs';

const { Text } = Typography;

type Lang = 'curl' | 'python' | 'javascript';

const Skills: React.FC = () => {
  const baseUrl = window.location.origin;
  const [langs, setLangs] = useState<Record<number, Lang>>({});

  const anchors = useMemo(
    () => [
      { key: 'overview', title: '概览' },
      { key: 'id-format', title: '题目 ID 格式' },
      { key: 'examples', title: '代码示例' },
      { key: 'integrations', title: '第三方集成' },
      { key: 'schemas', title: '数据结构' },
      { key: 'resources', title: '更多资源' },
    ],
    []
  );
  const { activeAnchor, scrollTo } = useDocNavigation(anchors);

  const skillExamples = [
    {
      title: '获取 Hot 100 实时数据',
      description: '一次性获取全部 100 道题目的最新在线人数',
      curl: `curl -s "${baseUrl}/api/hot100" | jq '.'`,
      python: `import requests

response = requests.get('${baseUrl}/api/hot100')
result = response.json()

if result['code'] == 200:
    for problem in result['data']:
        print(f"{problem['frontend_id']}: {problem['title']} - {problem['online_count']}人在线")
else:
    print(f"错误: {result['msg']}")`,
      javascript: `fetch('${baseUrl}/api/hot100')
  .then(r => r.json())
  .then(result => {
    if (result.code === 200) {
      result.data.forEach(p => {
        console.log(\`\${p.frontend_id}: \${p.title} - \${p.online_count}人在线\`);
      });
    } else {
      console.error(\`错误: \${result.msg}\`);
    }
  });`,
    },
    {
      title: '查询单题历史数据',
      description: '支持数字 ID 或英文 slug，返回 code/msg/data 格式',
      curl: `# 数字 ID
curl -s "${baseUrl}/api/hot100/online-counts/1?limit=10" | jq '.'

# 英文 slug
curl -s "${baseUrl}/api/hot100/online-counts/two-sum?limit=10" | jq '.'`,
      python: `problem_id = "1"  # 或 "two-sum"

response = requests.get(
    f'${baseUrl}/api/hot100/online-counts/{problem_id}',
    params={'limit': 100}
)
result = response.json()

if result['code'] == 200:
    for record in result['data']:
        print(f"{record['timestamp']}: {record['count']}人在线")
else:
    print(f"请求失败: {result['msg']}")`,
      javascript: `const problemId = 'two-sum';  // 或 '1'

fetch(\`\${baseUrl}/api/hot100/online-counts/\${problemId}?limit=50\`)
  .then(r => r.json())
  .then(result => {
    if (result.code === 200) {
      console.log('历史数据:', result.data);
    } else {
      console.error('请求失败:', result.msg);
    }
  });`,
    },
    {
      title: '获取最新在线人数快照',
      description: '拿到所有题目的最新计数，便于做筛选和排行',
      curl: `curl -s "${baseUrl}/api/hot100/online-counts/latest" | jq '.'`,
      python: `response = requests.get('${baseUrl}/api/hot100/online-counts/latest')
result = response.json()

if result['code'] == 200:
    hot_problems = [p for p in result['data'] if p['count'] > 100]
    print(f"当前有 {len(hot_problems)} 道热门题目")`,
      javascript: `fetch('${baseUrl}/api/hot100/online-counts/latest')
  .then(r => r.json())
  .then(result => {
    if (result.code === 200) {
      const hot = result.data.filter(p => p.count > 100);
      console.log(\`当前有 \${hot.length} 道热门题目\`);
    }
  });`,
    },
    {
      title: '定时监控脚本',
      description: '按固定间隔轮询单题在线人数变化',
      curl: `# 配合 watch 每 60 秒刷新一次
watch -n 60 "curl -s '${baseUrl}/api/hot100/online-counts/two-sum?limit=1'"`,
      python: `import time
import requests

def monitor_problem(problem_id, interval=60):
    url = f'${baseUrl}/api/hot100/online-counts/{problem_id}'

    while True:
        result = requests.get(url, params={'limit': 1}).json()
        if result['code'] == 200 and result['data']:
            latest = result['data'][0]
            print(f"[{latest['timestamp']}] 在线人数: {latest['count']}")
        else:
            print(f"获取失败: {result.get('msg', '未知错误')}")
        time.sleep(interval)

monitor_problem('two-sum', 60)`,
      javascript: `const fetch = require('node-fetch');

async function monitorProblem(problemId, interval = 60000) {
  const url = \`\${baseUrl}/api/hot100/online-counts/\${problemId}?limit=1\`;

  setInterval(async () => {
    const result = await (await fetch(url)).json();
    if (result.code === 200 && result.data.length > 0) {
      const latest = result.data[0];
      console.log(\`[\${latest.timestamp}] 在线人数: \${latest.count}\`);
    } else {
      console.error(\`获取失败: \${result.msg}\`);
    }
  }, interval);
}

monitorProblem('two-sum', 60000);`,
    },
  ];

  const integrationExamples = [
    {
      title: 'VS Code 扩展',
      description: '在状态栏显示当前最热题目',
      code: `const vscode = require('vscode');

async function updateStatusBar() {
  const res = await fetch('${baseUrl}/api/hot100');
  const result = await res.json();
  const hottest = result.data.reduce((a, b) =>
    a.online_count > b.online_count ? a : b
  );
  statusBarItem.text = \`🔥 \${hottest.title}: \${hottest.online_count}\`;
  statusBarItem.tooltip = '当前最热门的 LeetCode 题目';
}

setInterval(updateStatusBar, 30000);`,
    },
    {
      title: 'Obsidian 插件',
      description: '在笔记里用 Dataview 渲染在线人数表',
      code: `\`\`\`dataviewjs
const res = await fetch('${baseUrl}/api/hot100');
const result = await res.json();

dv.table(
  ['题目', '难度', '在线人数'],
  result.data.slice(0, 10).map(p => [p.title, p.difficulty, p.online_count])
);
\`\`\``,
    },
    {
      title: 'Alfred Workflow',
      description: '用关键字快速搜索题目并跳转',
      code: `import json
import sys
import requests

query = sys.argv[1] if len(sys.argv) > 1 else ''
result = requests.get('${baseUrl}/api/hot100').json()

items = [
    {
        'title': p['title'],
        'subtitle': f"在线人数: {p['online_count']} | 难度: {p['difficulty']}",
        'arg': f"https://leetcode.cn/problems/{p['slug']}"
    }
    for p in result['data']
    if query.lower() in p['title'].lower() or query in p['frontend_id']
]

print(json.dumps({'items': items[:9]}))`,
    },
  ];

  const langLabels: Record<Lang, { label: string; language: string }> = {
    curl: { label: 'cURL', language: 'bash' },
    python: { label: 'Python', language: 'python' },
    javascript: { label: 'JavaScript', language: 'javascript' },
  };

  return (
    <DocLayout
      title="技能与集成"
      subtitle="代码示例、使用技巧与第三方集成"
      icon={<ToolOutlined style={{ fontSize: 18 }} />}
      anchors={anchors}
      activeAnchor={activeAnchor}
      onNavigate={scrollTo}
    >
      {/* 概览 */}
      <DocSection id="overview" title="概览" icon={<ApiOutlined />}>
        <p className="lc-doc-text">
          本项目提供 LeetCode Hot 100 的实时在线人数数据，数据每 30 秒更新一次并进入 Redis 缓存。
          所有接口返回统一的 <code>code / msg / data</code> 结构，支持 CORS，可直接在浏览器、脚本或第三方工具中调用。
        </p>
        <div className="lc-chip-row">
          {['实时数据每 30 秒刷新', '统一 code/msg/data', '支持 JSON + CSV 导出', '每分钟 300 次回源限流'].map((t) => (
            <span key={t} className="lc-chip">
              {t}
            </span>
          ))}
        </div>
      </DocSection>

      {/* 题目 ID 格式 */}
      <DocSection id="id-format" title="题目 ID 格式" icon={<FileTextOutlined />}>
        <DocNote>
          所有接口都支持两种题目 ID 格式，任选其一：
          <ul>
            <li>
              <Text code>数字格式</Text>：1, 2, 3…（对应题目的 <code>frontend_id</code>）
            </li>
            <li>
              <Text code>英文格式</Text>：two-sum, add-two-numbers…（对应题目的 <code>slug</code>）
            </li>
          </ul>
        </DocNote>
      </DocSection>

      {/* 代码示例 */}
      <DocSection id="examples" title="代码示例" icon={<CodeOutlined />} desc="点击语言标签切换示例">
        {skillExamples.map((example, index) => {
          const active = langs[index] ?? 'curl';
          const meta = langLabels[active];
          const code = (example as any)[active] ?? '';
          return (
            <div key={index} className="lc-doc-item">
              <div className="lc-doc-item-title">{example.title}</div>
              <div className="lc-doc-item-desc" style={{ marginBottom: 8 }}>
                {example.description}
              </div>
              <div className="lc-doc-langs">
                {(Object.keys(langLabels) as Lang[]).map((l) => (
                  <button
                    key={l}
                    className={`lc-doc-lang${active === l ? ' active' : ''}`}
                    onClick={() => setLangs((prev) => ({ ...prev, [index]: l }))}
                  >
                    {langLabels[l].label}
                  </button>
                ))}
              </div>
              <DocCodeBlock code={code} language={meta.language} />
            </div>
          );
        })}
      </DocSection>

      {/* 第三方集成 */}
      <DocSection id="integrations" title="第三方集成" icon={<RobotOutlined />}>
        {integrationExamples.map((item, index) => (
          <div key={index} className="lc-doc-item">
            <div className="lc-doc-item-title">{item.title}</div>
            <div className="lc-doc-item-desc" style={{ marginBottom: 8 }}>
              {item.description}
            </div>
            <DocCodeBlock code={item.code} language="javascript" />
          </div>
        ))}
      </DocSection>

      {/* 数据结构 */}
      <DocSection id="schemas" title="数据结构" icon={<FileTextOutlined />}>
        <div className="lc-doc-subtitle" style={{ marginTop: 0 }}>
          成功响应
        </div>
        <DocJsonBlock
          data={{
            code: 200,
            msg: 'success',
            data: {
              frontend_id: '1',
              slug: 'two-sum',
              title: '两数之和',
              difficulty: 'EASY',
              online_count: 1234,
              last_updated: '2026-02-21T00:15:15Z',
            },
          }}
        />

        <div className="lc-doc-subtitle">错误响应</div>
        <DocJsonBlock data={{ code: 404, msg: 'Problem not found', data: null }} />

        <div className="lc-doc-subtitle">题目信息</div>
        <DocJsonBlock
          data={{
            frontend_id: '1',
            slug: 'two-sum',
            title: '两数之和',
            difficulty: 'EASY',
            paid_only: false,
            topic_tags: ['数组', '哈希表'],
            online_count: 1234,
            last_updated: '2026-02-21T00:15:15Z',
          }}
        />

        <div className="lc-doc-subtitle">历史记录</div>
        <DocJsonBlock
          data={{
            count: 1423,
            count_cn: 336,
            count_com: 1087,
            timestamp: '2026-10-30T01:53:26+08:00',
          }}
        />
      </DocSection>

      {/* 更多资源 */}
      <DocSection id="resources" title="更多资源" icon={<ApiOutlined />}>
        <ul className="lc-doc-list">
          <li>构建个人 LeetCode 学习仪表板</li>
          <li>创建定时任务监控热门题目变化</li>
          <li>开发浏览器扩展显示题目热度</li>
          <li>集成到智能家居系统（如「今天做第 X 题」）</li>
          <li>构建 Discord / Telegram 机器人推送热门题目</li>
        </ul>
        <DocNote>
          <strong>提示：</strong>所有数据每 30 秒自动更新并进入 Redis 缓存（响应头
          <code> X-Cache: HIT</code>），高频读取无需等待回源；为保护后端，每个 IP 每分钟限流
          300 次回源请求（缓存命中不消耗配额），超出返回 429。
        </DocNote>
      </DocSection>

      <div className="lc-doc-footer">文档基于当前实例自动生成 · {baseUrl}</div>
    </DocLayout>
  );
};

export default Skills;
