import { APIEndpoint } from './types';

export const getEndpoints = (): APIEndpoint[] => [
  {
    key: 'health',
    title: '健康检查',
    method: 'GET',
    path: '/api/health',
    description: '检查 API 服务是否正常运行',
    detailedDescription: '返回服务健康状态和当前服务器时间戳。建议在开始集成前调用此接口确认服务可用。',
    useCases: [
      '服务监控：定时调用检查服务可用性',
      '启动验证：应用启动时确认API可连接',
      '心跳检测：保持与后端的心跳连接'
    ],
    responseFields: [
      { field: 'status', type: 'string', description: '服务状态，固定为 "healthy"' },
      { field: 'timestamp', type: 'string', description: 'ISO 8601 格式的服务器当前时间' }
    ],
    responseExample: {
      status: "healthy",
      timestamp: "2026-02-20T23:30:00.123456+08:00"
    },
    errorExamples: [
      { code: 500, message: '服务内部错误', example: { error: "Internal server error" } }
    ]
  },
  {
    key: 'hot100',
    title: '获取 Hot 100 题目列表',
    method: 'GET',
    path: '/api/hot100',
    description: '获取 LeetCode Hot 100 所有题目的基本信息和当前在线人数',
    detailedDescription: '返回 Hot 100 题目的完整列表，包含每道题目的基本信息（ID、标题、难度等）和实时在线人数数据。数据每30秒更新一次。',
    useCases: [
      '实时仪表板：展示 Hot 100 所有题目的当前热度',
      '排行榜：按在线人数排序展示热门题目',
      '数据分析：获取完整数据集进行统计分析'
    ],
    responseFields: [
      { field: 'frontend_id', type: 'string', description: 'LeetCode 题目编号' },
      { field: 'slug', type: 'string', description: '题目英文标识（URL中使用）' },
      { field: 'title', type: 'string', description: '题目英文名称' },
      { field: 'title_cn', type: 'string', description: '题目中文名称' },
      { field: 'difficulty', type: 'string', description: '难度：Easy/Medium/Hard' },
      { field: 'topic_tags', type: 'string[]', description: '题目相关标签' },
      { field: 'online_count', type: 'number', description: '当前在线做题人数' },
      { field: 'last_updated', type: 'string', description: '数据最后更新时间' }
    ],
    responseExample: {
      "code": 200,
      "msg": "success",
      "data": [
        {
          "frontend_id": "1",
          "slug": "two-sum",
          "title": "Two Sum",
          "title_cn": "两数之和",
          "difficulty": "EASY",
          "paid_only": false,
          "topic_tags": ["数组", "哈希表"],
          "online_count": 491,
          "online_count_cn": 491,
          "online_count_com": 0,
          "online_count_total": 491,
          "last_updated": "2026-10-30T23:45:02+08:00"
        }
      ]
    }
  },
  {
    key: 'problems',
    title: '获取题目详细信息',
    method: 'GET',
    path: '/api/hot100/problems',
    description: '获取 Hot 100 题目的完整详细信息',
    detailedDescription: '包含每道题目的完整元数据，包括通过率(paid_only)、标签、难度等详细信息。适合需要展示题目完整信息的场景。',
    responseExample: {
      "code": 200,
      "msg": "success",
      "data": [
        {
          "frontend_id": "1",
          "slug": "two-sum",
          "title": "Two Sum",
          "title_cn": "两数之和",
          "difficulty": "EASY",
          "paid_only": false,
          "topic_tags": ["数组", "哈希表"],
          "online_count": 491,
          "online_count_cn": 491,
          "online_count_com": 0,
          "online_count_total": 491,
          "last_updated": "2026-10-30T23:45:02+08:00"
        }
      ]
    }
  },
  {
    key: 'online-counts-latest',
    title: '获取所有题目最新在线人数',
    method: 'GET',
    path: '/api/hot100/online-counts/latest',
    description: '获取 Hot 100 所有题目的当前在线人数快照',
    detailedDescription: '返回所有题目的最新在线人数，适合用于实时监控和仪表板展示。数据为内存缓存，响应速度极快。',
    useCases: [
      '实时监控：展示当前最热门的题目',
      '大屏展示：用于数据可视化大屏',
      '趋势分析：对比不同时间段的数据'
    ],
    responseExample: {
      "code": 200,
      "msg": "success",
      "data": [
        { "id": 293951, "frontend_id": "98", "count_cn": 46, "count_com": 0, "count_total": 46, "timestamp": "2026-10-30T23:44:26+08:00" },
        { "id": 293952, "frontend_id": "438", "count_cn": 141, "count_com": 0, "count_total": 141, "timestamp": "2026-10-30T23:44:26+08:00" }
      ]
    }
  },
  {
    key: 'online-counts-history',
    title: '获取题目历史在线人数',
    method: 'GET',
    path: '/api/hot100/online-counts/:id',
    description: '获取指定题目的历史在线人数数据',
    detailedDescription: '根据题目 ID 获取该题目的历史在线人数数据。支持两种格式：1) LeetCode 题目数字 ID（如 1, 2, 3）；2) 题目英文 slug（如 two-sum, add-two-numbers）。可限制返回记录数。',
    useCases: [
      '趋势分析：分析特定题目的热度变化趋势',
      '峰值检测：找出题目在线人数的历史峰值',
      '数据可视化：绘制在线人数变化曲线'
    ],
    requestParams: [
      { 
        name: 'id', 
        type: 'string', 
        required: true, 
        description: '题目 ID 或 slug（如 1 或 two-sum）',
        default: '1',
        example: '1 或 two-sum'
      },
      { 
        name: 'limit', 
        type: 'number', 
        required: false, 
        description: '返回的记录数，默认 100，最大 1000',
        default: '100',
        example: '50'
      },
    ],
    responseFields: [
      { field: 'problem_id', type: 'number', description: '题目内部 ID' },
      { field: 'frontend_id', type: 'string', description: 'LeetCode 题目编号' },
      { field: 'slug', type: 'string', description: '题目英文标识' },
      { field: 'title', type: 'string', description: '题目名称' },
      { field: 'data', type: 'array', description: '历史数据数组' },
      { field: 'data[].count', type: 'number', description: '该时间点的在线人数' },
      { field: 'data[].timestamp', type: 'string', description: 'ISO 8601 时间戳' }
    ],
    responseExample: {
      "code": 200,
      "msg": "success",
      "data": [
        { "count": 493, "count_cn": 493, "count_com": 0, "timestamp": "2026-10-30T23:46:16+08:00" },
        { "count": 1087, "count_cn": 1087, "count_com": 1087, "timestamp": "2026-10-30T01:57:26+08:00" }
      ]
    },
    errorExamples: [
      { code: 404, message: '题目不存在', example: { "code": 404, "msg": "Problem not found", "data": null } }
    ]
  },
  {
    key: 'statistics',
    title: '获取统计数据',
    method: 'GET',
    path: '/api/hot100/statistics',
    description: '获取 Hot 100 题目的综合统计数据',
    detailedDescription: '提供全面的数据统计分析，包括总在线人数、难度分布、在线人数区间分布以及热门题目排行榜。适合用于生成数据报告和分析洞察。',
    useCases: [
      '数据报告：生成每日/每周统计报告',
      '难度分析：分析不同难度题目的热度分布',
      '热门排行：获取当前最热门的题目排行'
    ],
    responseFields: [
      { field: 'total_problems', type: 'number', description: '题目总数（固定100）' },
      { field: 'total_online', type: 'number', description: '当前总在线人数' },
      { field: 'average_online', type: 'number', description: '平均每题在线人数' },
      { field: 'max_online', type: 'number', description: '单题最高在线人数' },
      { field: 'min_online', type: 'number', description: '单题最低在线人数' },
      { field: 'difficulties', type: 'object', description: '各难度题目数量分布' },
      { field: 'online_by_range', type: 'object', description: '在线人数区间分布' },
      { field: 'top_problems', type: 'array', description: '热门题目排行（前10）' },
      { field: 'last_updated', type: 'string', description: '最新数据更新时间' }
    ],
    responseExample: {
      "code": 200,
      "msg": "success",
      "data": {
        "total_problems": 100,
        "total_online": 6003,
        "average_online": 60.03,
        "max_online": 296,
        "min_online": 15,
        "difficulties": {
          "EASY": 20,
          "MEDIUM": 68,
          "HARD": 12
        },
        "online_by_range": {
          "0-50": 50,
          "51-100": 40,
          "101-200": 9,
          "201-500": 1
        },
        "top_problems": [
          {
            "frontend_id": "1",
            "title": "两数之和",
            "slug": "two-sum",
            "difficulty": "EASY",
            "online_count": 296
          }
        ]
      }
    }
  },
  {
    key: 'peaks',
    title: '获取在线人数峰值',
    method: 'GET',
    path: '/api/hot100/peaks',
    description: '获取过去7天内在线人数最高的题目',
    detailedDescription: '统计 Hot 100 题目过去 7 天内在线人数的最高峰值，按峰值人数降序排列，返回前 20 道题目。每道题目包含峰值时间、峰值人数和平均人数。',
    useCases: [
      '峰值分析：识别近期最热门的题目',
      '趋势预测：根据历史峰值预测未来热度',
      '报告生成：用于周报/月报的热门题目分析'
    ],
    responseFields: [
      { field: 'peaks', type: 'array', description: '峰值数据数组' },
      { field: 'peaks[].frontend_id', type: 'string', description: '题目编号' },
      { field: 'peaks[].problem_slug', type: 'string', description: '题目slug' },
      { field: 'peaks[].problem_title', type: 'string', description: '题目名称' },
      { field: 'peaks[].peak_count', type: 'number', description: '峰值在线人数' },
      { field: 'peaks[].peak_time', type: 'string', description: '峰值出现时间' },
      { field: 'peaks[].average_count', type: 'number', description: '平均在线人数' }
    ],
    responseExample: {
      "code": 200,
      "msg": "success",
      "data": {
        "peaks": [
          {
            "frontend_id": "1",
            "problem_slug": "two-sum",
            "problem_title": "Two Sum",
            "peak_count": 380,
            "peak_time": "2026-02-20T23:27:09Z",
            "average_count": 0
          }
        ],
        "time_range": "last_7_days",
        "generated": "2026-02-21T00:15:25Z"
      }
    }
  },
  {
    key: 'export',
    title: '导出数据',
    method: 'GET',
    path: '/api/hot100/export',
    description: '导出历史在线人数数据',
    detailedDescription: '导出 Hot 100 题目的在线人数历史数据，支持 JSON 和 CSV 两种格式。可筛选特定题目或日期范围。题目筛选支持两种格式：1) LeetCode 题目数字 ID；2) 题目英文 slug。',
    useCases: [
      '数据备份：定期导出数据进行备份',
      '离线分析：导出 CSV 用 Excel 分析',
      '机器学习：获取历史数据训练预测模型'
    ],
    requestParams: [
      { 
        name: 'format', 
        type: 'string', 
        required: false, 
        description: '导出格式：json 或 csv',
        default: 'json',
        example: 'csv'
      },
      { 
        name: 'problem_id', 
        type: 'string', 
        required: false, 
        description: '题目 ID 或 slug（支持数字如 1 或 slug 如 two-sum）',
        example: 'two-sum'
      },
      { 
        name: 'start_date', 
        type: 'string', 
        required: false, 
        description: '开始日期（格式：2024-01-01）',
        example: '2024-01-01'
      },
      { 
        name: 'end_date', 
        type: 'string', 
        required: false, 
        description: '结束日期（格式：2024-01-01）',
        example: '2024-01-31'
      },
    ],
    responseExample: {
      "exported_at": "2026-10-30T23:40:26+08:00",
      "count": 293550,
      "data": [
        { "id": 1, "frontend_id": "234", "count_cn": 91, "count_com": 0, "count_total": 91, "timestamp": "2026-10-28T22:41:09+08:00" }
      ]
    }
  },
  {
    key: 'export-stats',
    title: '获取导出统计信息',
    method: 'GET',
    path: '/api/hot100/export/stats',
    description: '获取可导出数据的统计信息',
    detailedDescription: '返回可导出数据的基本统计信息，包括总记录数、数据时间范围、可用格式等。建议在导出大量数据前先调用此接口了解数据概况。',
    responseExample: {
      "code": 200,
      "msg": "success",
      "data": {
        "cn_records": 1465155,
        "com_records": 146282,
        "unified_records": 293550,
        "total_records": 1904987,
        "oldest_record": "2026-10-28T22:40:09+08:00",
        "newest_record": "2026-10-30T23:40:55+08:00",
        "available_formats": ["json", "csv"],
        "available_sites": ["cn", "com", "unified"]
      }
    }
  },
];
