# LeetCode Dashboard 测试计划
# 共规划 110+ 测试用例

## 一、后端API测试 (35个用例)

### 1.1 健康检查API (3个)
TEST_001: GET /api/health - 验证返回状态200
TEST_002: GET /api/health - 验证返回格式JSON
TEST_003: GET /api/health - 验证status字段为"ok"

### 1.2 问题列表API (5个)
TEST_004: GET /api/problems - 验证返回状态200
TEST_005: GET /api/problems - 验证返回数组格式
TEST_006: GET /api/problems - 验证每个问题包含id/slug/title字段
TEST_007: GET /api/problems - 验证online_count为整数
TEST_008: GET /api/problems - 验证last_updated为有效时间格式

### 1.3 Hot100 API (6个)
TEST_009: GET /api/hot100 - 验证返回状态200
TEST_010: GET /api/hot100 - 验证返回100个问题
TEST_011: GET /api/hot100 - 验证按rank排序
TEST_012: GET /api/hot100 - 验证每个问题包含完整信息
TEST_013: GET /api/hot100 - 验证online_count >= 0
TEST_014: GET /api/hot100 - 响应时间 < 500ms

### 1.4 在线人数历史API (6个)
TEST_015: GET /api/online-counts/:id - 验证有效ID返回200
TEST_016: GET /api/online-counts/:id - 验证无效ID返回404或空数组
TEST_017: GET /api/online-counts/:id - 验证返回数组按时间倒序
TEST_018: GET /api/online-counts/:id?limit=10 - 验证limit参数限制结果数
TEST_019: GET /api/online-counts/:id - 验证每个记录包含count/timestamp
TEST_020: GET /api/online-counts/999999 - 验证不存在的ID返回空数组

### 1.5 最新在线人数API (4个)
TEST_021: GET /api/online-counts/latest - 验证返回状态200
TEST_022: GET /api/online-counts/latest - 验证返回数组格式
TEST_023: GET /api/online-counts/latest - 验证包含problem_id/slug/count/timestamp
TEST_024: GET /api/online-counts/latest - 验证timestamp为最近5分钟内

### 1.6 统计API (5个)
TEST_025: GET /api/statistics - 验证返回状态200
TEST_026: GET /api/statistics - 验证包含total_problems字段
TEST_027: GET /api/statistics - 验证包含total_online字段
TEST_028: GET /api/statistics - 验证包含difficulties分布
TEST_029: GET /api/statistics - 验证包含top_problems数组

### 1.7 导出API (6个)
TEST_030: GET /api/export?format=json - 验证返回JSON格式
TEST_031: GET /api/export?format=csv - 验证返回CSV格式
TEST_032: GET /api/export?problem_id=1 - 验证按问题ID过滤
TEST_033: GET /api/export?start_date=2024-01-01 - 验证按开始日期过滤
TEST_034: GET /api/export?end_date=2024-12-31 - 验证按结束日期过滤
TEST_035: GET /api/export/stats - 验证返回导出统计信息

## 二、WebSocket测试 (15个用例)

### 2.1 连接测试 (5个)
TEST_036: WebSocket连接 ws://localhost:52106/ws - 验证连接成功
TEST_037: WebSocket连接 - 验证连接后收到初始数据
TEST_038: WebSocket连接 - 验证可以发送ping消息
TEST_039: WebSocket连接 - 验证收到pong响应
TEST_040: WebSocket断开连接 - 验证优雅关闭

### 2.2 消息测试 (5个)
TEST_041: WebSocket订阅 - 验证可以订阅特定问题更新
TEST_042: WebSocket广播 - 验证收到全量数据推送
TEST_043: WebSocket消息格式 - 验证消息为有效JSON
TEST_044: WebSocket消息内容 - 验证包含problem_id/online_count
TEST_045: WebSocket消息频率 - 验证按配置间隔推送

### 2.3 并发测试 (5个)
TEST_046: 10个并发WebSocket连接 - 验证都能连接成功
TEST_047: 50个并发WebSocket连接 - 验证服务器稳定性
TEST_048: 连接断开后重连 - 验证自动重连机制
TEST_049: 多客户端同时接收 - 验证广播正常
TEST_050: 长时间连接稳定性 - 验证5分钟不断线

## 三、前端页面测试 (30个用例)

### 3.1 Home页面 (6个)
TEST_051: 访问首页 - 验证页面加载成功
TEST_052: 首页统计卡片 - 验证显示总数/在线人数
TEST_053: 首页热门问题 - 验证显示Top 10
TEST_054: 首页难度分布 - 验证显示饼图/柱状图
TEST_055: 首页数据刷新 - 验证定时更新数据
TEST_056: 首页导航 - 验证可以跳转到其他页面

### 3.2 Rankings页面 (6个)
TEST_057: 访问排名页 - 验证页面加载成功
TEST_058: 排名表格 - 验证显示100个问题
TEST_059: 排名排序 - 验证点击表头排序
TEST_060: 搜索功能 - 验证按slug搜索
TEST_061: 难度筛选 - 验证按Easy/Medium/Hard筛选
TEST_062: 分页功能 - 验证分页正常工作

### 3.3 History页面 (5个)
TEST_063: 访问历史页 - 验证页面加载成功
TEST_064: 问题选择 - 验证下拉选择问题
TEST_065: 历史图表 - 验证显示趋势图
TEST_066: 历史表格 - 验证显示详细数据
TEST_067: 导出功能 - 验证导出CSV/JSON

### 3.4 Statistics页面 (5个)
TEST_068: 访问统计页 - 验证页面加载成功
TEST_069: 总体统计 - 验证显示汇总数据
TEST_070: 问题统计 - 验证显示各问题统计
TEST_071: 时间范围选择 - 验证选择不同时间范围
TEST_072: 图表显示 - 验证统计图表渲染

### 3.5 Favorites页面 (4个)
TEST_073: 访问收藏页 - 验证页面加载成功
TEST_074: 收藏列表 - 验证显示已收藏问题
TEST_075: 取消收藏 - 验证可以移除收藏
TEST_076: 收藏状态同步 - 验证状态持久化

### 3.6 Settings页面 (2个)
TEST_077: 访问设置页 - 验证页面加载成功
TEST_078: 配置修改 - 验证修改后生效

### 3.7 About页面 (2个)
TEST_079: 访问关于页 - 验证页面加载成功
TEST_080: 版本信息 - 验证显示版本号

## 四、集成测试 (20个用例)

### 4.1 端到端流程 (10个)
TEST_081: 完整流程 - 后端启动->前端加载->数据获取
TEST_082: 数据流 - Worker获取->缓存更新->API返回->前端显示
TEST_083: 实时更新 - WebSocket推送->前端刷新
TEST_084: 跨域请求 - 前端52107访问后端52106
TEST_085: 并发用户 - 多个浏览器同时访问
TEST_086: 数据持久化 - 重启后数据恢复
TEST_087: 错误处理 - 后端断开时前端优雅降级
TEST_088: 缓存一致性 - 内存缓存与数据库一致
TEST_089: 定时任务 - Worker按配置间隔执行
TEST_090: 全量数据 - 100个Hot100问题都有数据

### 4.2 边界条件 (10个)
TEST_091: 空数据库 - 新部署时正常初始化
TEST_092: 大量数据 - 10000条历史记录正常查询
TEST_093: 特殊字符 - 问题标题含特殊字符正常显示
TEST_094: 网络中断 - 网络恢复后自动重连
TEST_095: 高并发 - 100个并发请求正常处理
TEST_096: 内存限制 - 大量数据不导致OOM
TEST_097: 时区处理 - 不同时区时间显示正确
TEST_098: 超长ID - 极大problem_id正常处理
TEST_099: 空值处理 - 字段为空时正常显示
TEST_100: 快速刷新 - 频繁刷新不导致错误

## 五、性能测试 (10个用例)

TEST_101: API响应时间 - 所有API < 200ms
TEST_102: 页面加载时间 - 首屏 < 3秒
TEST_103: WebSocket延迟 - 消息延迟 < 100ms
TEST_104: 数据库查询 - 简单查询 < 50ms
TEST_105: 并发性能 - 支持100并发
TEST_106: 内存使用 - 后端内存 < 500MB
TEST_107: CPU使用 - 平均CPU < 50%
TEST_108: 网络带宽 - 每小时数据传输 < 100MB
TEST_109: 长时间运行 - 7x24小时稳定
TEST_110: 数据增长 - 100万条记录查询正常

## 测试执行优先级
P0: TEST_001-TEST_010 (核心API)
P1: TEST_036-TEST_050 (WebSocket)
P2: TEST_051-TEST_080 (前端页面)
P3: TEST_081-TEST_100 (集成/边界)
P4: TEST_101-TEST_110 (性能)
