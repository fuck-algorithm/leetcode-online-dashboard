import React from 'react';
import { Card, Typography, Space, Tag, Divider, Alert, List, Button, Tooltip } from 'antd';
import { ToolOutlined, CopyOutlined, CodeOutlined, RobotOutlined, ApiOutlined, FileTextOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

// JSON 高亮组件
const JsonBlock: React.FC<{ data: any }> = ({ data }) => {
  const jsonStr = JSON.stringify(data, null, 2);
  return (
    <pre style={{ 
      background: '#1e1e1e', 
      color: '#d4d4d4',
      padding: 16, 
      borderRadius: 8, 
      fontFamily: 'Consolas, Monaco, "Courier New", monospace', 
      fontSize: 13,
      overflow: 'auto',
      maxHeight: 400,
      lineHeight: 1.6,
      margin: 0,
      position: 'relative'
    }}>
      <div style={{ 
        position: 'absolute', 
        top: 8, 
        right: 8, 
        color: '#6a9955', 
        fontSize: 11,
        background: '#2d2d2d',
        padding: '2px 8px',
        borderRadius: 4
      }}>json</div>
      <code style={{ color: '#d4d4d4' }}>
        {jsonStr.split('\n').map((line, i) => (
          <div key={i} style={{ display: 'flex' }}>
            <span style={{ 
              color: '#858585', 
              minWidth: 30, 
              textAlign: 'right', 
              marginRight: 12,
              userSelect: 'none'
            }}>{i + 1}</span>
            <span style={{ color: '#d4d4d4' }} dangerouslySetInnerHTML={{
              __html: line
                .replace(/"([^"]+)":/g, '<span style="color:#9cdcfe">"$1"</span>:')
                .replace(/: "([^"]*)"/g, ': <span style="color:#ce9178">"$1"</span>')
                .replace(/: (\d+)/g, ': <span style="color:#b5cea8">$1</span>')
                .replace(/: (true|false|null)/g, ': <span style="color:#569cd6">$1</span>')
            }} />
          </div>
        ))}
      </code>
    </pre>
  );
};

// 暗色代码块组件
const DarkCodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'bash' }) => (
  <div style={{ position: 'relative' }}>
    <pre style={{ 
      background: '#1e1e1e', 
      color: '#d4d4d4',
      padding: 16, 
      borderRadius: 8, 
      fontFamily: 'Consolas, Monaco, "Courier New", monospace', 
      fontSize: 13,
      overflow: 'auto',
      maxHeight: 400,
      lineHeight: 1.6,
      margin: 0,
      position: 'relative'
    }}>
      <div style={{ 
        position: 'absolute', 
        top: 8, 
        right: 8, 
        color: '#6a9955', 
        fontSize: 11,
        background: '#2d2d2d',
        padding: '2px 8px',
        borderRadius: 4
      }}>{language}</div>
      <code style={{ color: '#d4d4d4' }}>{code}</code>
    </pre>
  </div>
);

const Skills: React.FC = () => {
  const baseUrl = window.location.origin;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const skillExamples = [
    {
      title: '获取Hot 100实时数据',
      description: '一次性获取所有100道题目的最新在线人数，返回 code/msg/data 格式',
      curl: `curl -s "${baseUrl}/api/hot100" | jq '.'`,
      python: `import requests

response = requests.get('${baseUrl}/api/hot100')
result = response.json()

# 统一的 code/msg/data 响应格式
if result['code'] == 200:
    for problem in result['data']:
        print(f"{problem['frontend_id']}: {problem['title']} - {problem['online_count']}人在线")
else:
    print(f"错误: {result['msg']}")`,
      javascript: `fetch('${baseUrl}/api/hot100')
  .then(r => r.json())
  .then(result => {
    // 统一的 code/msg/data 响应格式
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
      description: '支持数字ID或英文slug格式，返回 code/msg/data 格式',
      curl: `# 使用数字ID
curl -s "${baseUrl}/api/hot100/online-counts/1?limit=10" | jq '.'

# 使用英文slug
curl -s "${baseUrl}/api/hot100/online-counts/two-sum?limit=10" | jq '.'`,
      python: `# 支持两种格式
problem_id = "1"  # 或 "two-sum"

response = requests.get(
    f'${baseUrl}/api/hot100/online-counts/{problem_id}',
    params={'limit': 100}
)
result = response.json()

# 检查响应状态
if result['code'] == 200:
    for record in result['data']:
        print(f"{record['timestamp']}: {record['count']}人在线")
else:
    print(f"请求失败: {result['msg']}")`,
      javascript: `// 支持两种格式
const problemId = 'two-sum';  // 或 '1'

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
      title: '获取最新在线人数',
      description: '获取所有题目的最新在线人数快照，返回 code/msg/data 格式',
      curl: `curl -s "${baseUrl}/api/hot100/online-counts/latest" | jq '.'`,
      python: `response = requests.get('${baseUrl}/api/hot100/online-counts/latest')
result = response.json()

if result['code'] == 200:
    # 筛选在线人数大于100的题目
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
      description: '定期监控特定题目的在线人数变化，处理 code/msg/data 响应',
      python: `import time
import requests

def monitor_problem(problem_id, interval=60):
    url = f'${baseUrl}/api/hot100/online-counts/{problem_id}'
    
    while True:
        response = requests.get(url, params={'limit': 1})
        result = response.json()
        
        if result['code'] == 200 and result['data']:
            latest = result['data'][0]
            print(f"[{latest['timestamp']}] 在线人数: {latest['count']}")
        else:
            print(f"获取失败: {result.get('msg', '未知错误')}")
        
        time.sleep(interval)

# 监控 two-sum 的在线人数
monitor_problem('two-sum', 60)`,
      javascript: `// 使用 Node.js + node-fetch
const fetch = require('node-fetch');

async function monitorProblem(problemId, interval = 60000) {
  const url = \`\${baseUrl}/api/hot100/online-counts/\${problemId}?limit=1\`;
  
  setInterval(async () => {
    const response = await fetch(url);
    const result = await response.json();
    
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
      description: '在 VS Code 状态栏显示当前 Hot 题目',
      code: `// 使用 VS Code API 创建状态栏项\nconst vscode = require('vscode');\n\nasync function updateStatusBar() {\n  const response = await fetch('${baseUrl}/api/hot100');\n  const data = await response.json();\n  \n  // 找出在线人数最多的题目\n  const hottest = data.reduce((a, b) => \n    a.online_count > b.online_count ? a : b\n  );\n  \n  statusBarItem.text = \`🔥 \${hottest.title}: \${hottest.online_count}\`;\n  statusBarItem.tooltip = '当前最热门的 LeetCode 题目';\n}\n\n// 每30秒更新一次\nsetInterval(updateStatusBar, 30000);`,
    },
    {
      title: 'Obsidian 插件',
      description: '在笔记中嵌入题目在线人数',
      code: `\`\`\`dataviewjs\n// Dataview JS 示例\nconst response = await fetch('${baseUrl}/api/hot100');\nconst data = await response.json();\n\n// 渲染表格\ndv.table(\n  ['题目', '难度', '在线人数'],\n  data.slice(0, 10).map(p => [\n    p.title,\n    p.difficulty,\n    p.online_count\n  ])\n);\n\`\`\``,
    },
    {
      title: ' Alfred Workflow',
      description: '快速查询题目在线人数',
      code: `# 使用 Alfred 的 Script Filter\nimport json\nimport sys\nimport requests\n\nquery = sys.argv[1] if len(sys.argv) > 1 else ''\n\nresponse = requests.get('${baseUrl}/api/hot100')\ndata = response.json()\n\n# 过滤匹配的题目\nresults = [\n    {\n        'title': p['title'],\n        'subtitle': f"在线人数: {p['online_count']} | 难度: {p['difficulty']}",\n        'arg': f"https://leetcode.cn/problems/{p['slug']}"\n    }\n    for p in data\n    if query.lower() in p['title'].lower() or query in p['frontend_id']\n]\n\nprint(json.dumps({'items': results[:9]}))`,
    },
  ];

  return (
    <div className="skills-container">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space align="start">
            <ToolOutlined style={{ fontSize: 32, color: '#fa8c16' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>技能与集成 (Skills)</Title>
              <Paragraph type="secondary">
                代码示例、使用技巧和第三方集成方案，帮助您更好地使用我们的数据服务
              </Paragraph>
            </div>
          </Space>
        </Card>

        <Alert
          message="题目ID格式说明"
          description={
            <>
              所有 API 都支持两种题目ID格式：
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                <li><Text code>数字格式</Text>：1, 2, 3...（对应题目的 frontend_id）</li>
                <li><Text code>英文格式</Text>：two-sum, add-two-numbers...（对应题目的 slug）</li>
              </ul>
              您可以随意选择最方便的格式使用。
            </>
          }
          type="info"
          showIcon
        />

        <Card title={<><CodeOutlined /> 代码示例</>}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {skillExamples.map((example, index) => (
              <Card
                key={index}
                type="inner"
                title={<Text strong>{example.title}</Text>}
                extra={<Text type="secondary">{example.description}</Text>}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Space align="center">
                      <Tag color="default">cURL</Tag>
                      <Tooltip title="复制">
                        <Button
                          type="text"
                          icon={<CopyOutlined />}
                          size="small"
                          onClick={() => copyToClipboard(example.curl || '')}
                        />
                      </Tooltip>
                    </Space>
                    <DarkCodeBlock code={example.curl || ''} language="bash" />
                  </div>

                  <Divider style={{ margin: '12px 0' }} />

                  <div>
                    <Space align="center">
                      <Tag color="blue">Python</Tag>
                      <Tooltip title="复制">
                        <Button
                          type="text"
                          icon={<CopyOutlined />}
                          size="small"
                          onClick={() => copyToClipboard(example.python)}
                        />
                      </Tooltip>
                    </Space>
                    <DarkCodeBlock code={example.python} language="python" />
                  </div>

                  <Divider style={{ margin: '12px 0' }} />

                  <div>
                    <Space align="center">
                      <Tag color="yellow">JavaScript</Tag>
                      <Tooltip title="复制">
                        <Button
                          type="text"
                          icon={<CopyOutlined />}
                          size="small"
                          onClick={() => copyToClipboard(example.javascript)}
                        />
                      </Tooltip>
                    </Space>
                    <DarkCodeBlock code={example.javascript} language="javascript" />
                  </div>
                </Space>
              </Card>
            ))}
          </Space>
        </Card>

        <Card title={<><RobotOutlined /> 第三方集成</>}>
          <List
            itemLayout="vertical"
            dataSource={integrationExamples}
            renderItem={(item) => (
              <List.Item>
                <Card
                  type="inner"
                  title={<Text strong>{item.title}</Text>}
                  extra={<Text type="secondary">{item.description}</Text>}
                  style={{ width: '100%' }}
                >
                  <DarkCodeBlock code={item.code} language="javascript" />
                </Card>
              </List.Item>
            )}
          />
        </Card>

        <Card title={<><FileTextOutlined /> 数据结构参考</>}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>成功响应格式：</Text>
              <JsonBlock data={{
                "code": 200,
                "msg": "success",
                "data": {
                  "frontend_id": "1",
                  "slug": "two-sum",
                  "title": "两数之和",
                  "difficulty": "EASY",
                  "online_count": 1234,
                  "last_updated": "2026-02-21T00:15:15Z"
                }
              }} />
            </div>

            <Divider />

            <div>
              <Text strong>错误响应格式：</Text>
              <JsonBlock data={{
                "code": 404,
                "msg": "Problem not found",
                "data": null
              }} />
            </div>

            <Divider />

            <div>
              <Text strong>题目信息结构 (Problem)：</Text>
              <JsonBlock data={{
                "frontend_id": "1",
                "slug": "two-sum",
                "title": "两数之和",
                "difficulty": "EASY",
                "paid_only": false,
                "topic_tags": ["数组", "哈希表"],
                "online_count": 1234,
                "last_updated": "2026-02-21T00:15:15Z"
              }} />
            </div>

            <Divider />

            <div>
              <Text strong>历史记录结构 (OnlineCount)：</Text>
              <JsonBlock data={{
                "id": 1,
                "frontend_id": "1",
                "count": 1234,
                "timestamp": "2026-02-21T00:15:15Z"
              }} />
            </div>
          </Space>
        </Card>

        <Card title={<><ApiOutlined /> 更多资源</>}>
          <Space direction="vertical">
            <Text>探索更多使用方式：</Text>
            <ul>
              <li>构建个人 LeetCode 学习仪表板</li>
              <li>创建定时任务监控热门题目变化</li>
              <li>开发浏览器扩展显示题目热度</li>
              <li>集成到智能家居系统（如"今天做第X题"）</li>
              <li>构建 Discord/Telegram 机器人推送热门题目</li>
            </ul>
            <Alert
              message="提示"
              description="所有数据每30秒自动更新，API 调用无频率限制，但请合理使用服务器资源。"
              type="warning"
              showIcon
            />
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default Skills;
