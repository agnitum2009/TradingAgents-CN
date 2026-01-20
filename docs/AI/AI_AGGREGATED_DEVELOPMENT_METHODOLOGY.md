# AI 辅助开发规则手册

> **目标读者**: AI 智能体
> **用途**: 开发过程中的规则和约束
> **格式**: 规则/条件/动作/阈值

---

## 代码结构规则

### FILE_SIZE_LIMITS

```
单文件行数阈值:
├── < 300  → PASS
├── 300-500 → WARNING: 考虑拆分
├── 500-1000 → ERROR: 必须拆分
└── > 1000 → CRITICAL: 立即拆分

拆分决策树:
IF file_lines > 500 AND has_multiple_responsibilities:
    SPLIT by responsibility
ELSE IF file_lines > 500 AND has_single_responsibility:
    SPLIT by logical sections
```

### MODULE_STRUCTURE_TEMPLATE

```
project/src/
├── types/              # 所有类型定义（集中管理）
│   ├── entity.ts       # 实体类型
│   ├── dto.ts          # 数据传输对象
│   ├── config.ts       # 配置类型
│   └── index.ts        # 统一导出
├── core/               # 核心业务逻辑
├── modules/            # 功能模块
│   └── [module-name]/
│       ├── index.ts    # 模块入口（<200 行）
│       ├── [feature-1].ts
│       ├── [feature-2].ts
│       └── types.ts    # 模块私有类型
├── api/                # API 层
└── utils/              # 工具函数
```

### TYPE_DEFINITION_RULES

```
规则1: 类型必须集中定义
位置: src/types/
禁止: 在业务文件中定义共享类型

规则2: 复杂类型必须有注释
阈值: 类型字段 > 5 个 或 有嵌套类型
格式: JSDoc 注释

规则3: 枚举必须有默认值
export enum EnumName {
  DEFAULT = 'default',
  // ...
}

规则4: 避免类型重复
IF type appears in >2 files:
    MOVE to src/types/
```

---

## 上下文管理规则

### FILE_READ_STRATEGY

```
定位文件三步法:
Step 1: Grep keyword → 找到相关文件
Step 2: Read only needed files → 只读需要的
Step 3: Edit with precision → 精确修改

禁止:
- 读取整个项目
- 重复读取已读文件
- 无目的地浏览文件

允许:
- 使用 Grep/Glob 先定位
- 只读取需要修改的文件
- 使用 Edit 工具精确修改
```

### CONTEXT_TOKEN_THRESHOLD

```
Token 管理阈值:
├── < 100k  → 继续
├── 100k-150k → 记录进度，准备交接
├── 150k-180k → 创建 SESSION_HANDOFF
└── > 180k → 必须新建会话

交接触发条件:
IF token_usage > 150000 OR
   (tasks_completed > 5 AND remaining_tasks > 3):
    CREATE SESSION_HANDOFF
```

### TASK_TRACKING_RULES

```
TodoWrite 使用规范:

规则1: 同时只有 1 个任务 in_progress
错误状态: [in_progress, in_progress, pending]
正确状态: [completed, in_progress, pending, pending]

规则2: 完成立即标记
禁止: 批量标记完成
正确: 完成一个，标记一个

规则3: 新任务及时添加
发现新任务时 → 立即添加到列表

规则4: 任务粒度控制
单个任务预计时间: 10-30 分钟
IF estimated_time > 60min:
    SPLIT task
```

---

## 性能优化规则

### OPTIMIZATION_TIMING

```
优化时机决策树:

Phase One (功能优先):
├── 实现所有功能
├── 集成各模块
├── 系统可运行
└── 性能模块: 仅占位

Phase Two (性能优化):
├── 识别瓶颈 (profiling)
├── 规划方案
└── 渐进迁移

禁止:
- 在 Phase One 做 Rust 迁移
- 未测量就优化
- 优化非瓶颈代码

允许:
- 先 TS 实现功能
- 后 Rust 替换热点
```

### OPTIMIZATION_PRIORITY_MATRIX

```
优化优先级计算:

priority = (call_frequency × performance_impact) / implementation_complexity

高频 + 高性能需求 + 低复杂度 → P0 (立即)
高频 + 高性能需求 + 中复杂度 → P0 (立即)
低频 + 高性能需求 + 低复杂度 → P1 (后续)
高频 + 低性能需求 + 高复杂度 → P2 (延后)
低频 + 低性能需求 + 任意复杂度 → P3 (可选)

示例:
├── MACD 计算: 高频×高×低 = P0
├── 配置加载: 低频×低×低 = P3
└── 回测引擎: 中频×高×中 = P0
```

### PERFORMANCE_THRESHOLD

```
性能阈值设定:

API 响应时间:
├── < 100ms → 优秀
├── 100-500ms → 可接受
├── 500-1000ms → 需优化
└── > 1000ms → 必须优化

数据处理:
├── < 10ms/1000条 → 优秀
├── 10-50ms/1000条 → 可接受
└── > 50ms/1000条 → 需优化

优化动作触发:
IF response_time > 500ms:
    CHECK database queries
    CHECK loops
    CHECK serialization
```

---

## 文档规则

### DOCUMENTATION_REQUIREMENTS

```
必写文档清单:

项目启动时:
├── ARCHITECTURE.md         # 架构设计
└── SESSION_HANDOFF_TEMPLATE.md

每个会话结束时:
└── SESSION_HANDOFF_V{N}.md # 进度记录

API 变更时:
└── 更新 API.md

架构偏离时:
└── 更新 ARCHITECTURE.md 的"实际状态"
```

### SESSION_HANDOFF_TEMPLATE

```markdown
# 会话交接 - V{N}

> 日期: {YYYY-MM-DD}
> Token: {X}/200000

## 完成的工作
- [x] {task1}
- [x] {task2}

## 系统状态
| 服务 | 状态 |
|------|------|

## 下一步
1. [ ] {P0 task}
2. [ ] {P1 task}

## 文件位置
| 文件 | 路径 |
```

### DOCUMENT_SYNC_RULE

```
文档同步触发条件:

代码变更后:
IF API changed:
    UPDATE API.md
IF types changed:
    UPDATE types documentation
IF architecture deviated:
    UPDATE ARCHITECTURE.md

会话结束时:
IF token_usage > 5000:
    CREATE SESSION_HANDOFF
```

---

## 多语言项目规则

### LANGUAGE_DECISION_TREE

```
语言选择算法:

FUNCTION choose_language(module):
    IF is_cpu_intensive(module) AND call_frequency > 1000/min:
        RETURN "Rust"
    IF uses_pandas_numpy(module):
        RETURN "Python"
    IF needs_fast_iteration(module):
        RETURN "TypeScript"
    IF needs_type_sharing_with_frontend(module):
        RETURN "TypeScript"
    RETURN "TypeScript"  # 默认
```

### COMMUNICATION_PATTERN_SELECTION

```
通信模式选择:

TypeScript ↔ Rust:
    IF runs_in_browser:
        USE "WASM"
    ELSE IF needs_zero_copy:
        USE "FFI (napi-rs)"
    ELSE:
        USE "WASM"

TypeScript ↔ Python:
    IF needs_isolation:
        USE "子进程 + JSON-RPC"
    ELSE IF needs_high_performance:
        USE "gRPC"
    ELSE:
        USE "HTTP REST"

Rust ↔ Python:
    通过 TypeScript 中介
    (避免直接通信)
```

### TYPE_MAPPING_RULES

```
类型映射原则:

规则1: TypeScript 是类型源头
所有类型定义在 TS 中
Rust/Python 从 TS 生成或手动对齐

规则2: 避免类型重复
同一个类型只定义一次
使用工具自动生成绑定

规则3: 类型变更流程
1. 修改 TS 类型定义
2. 更新 Rust/Python 绑定
3. 运行类型检查
4. 更新测试
```

---

## 错误处理规则

### ERROR_CATEGORIZATION

```
错误类型分类:

Expected Errors (可预期):
├── 网络超时
├── 服务不可用
└── 用户输入错误
处理: 返回用户友好信息

Unexpected Errors (不可预期):
├── 代码 Bug
├── 数据损坏
└── 系统故障
处理: 记录日志，返回通用错误

Critical Errors (严重):
├── 数据库连接失败
├── 文件系统错误
└── 内存不足
处理: 优雅降级或终止
```

### ERROR_HANDLING_TEMPLATE

```typescript
// TypeScript 错误处理模板
async function operation() {
  try {
    // 业务逻辑
    return await riskyOperation();
  } catch (error) {
    // 分类处理
    IF error instanceof NetworkError:
      RETURN { success: false, retryable: true, message: "Network error" };
    IF error instanceof ValidationError:
      RETURN { success: false, retryable: false, message: error.details };
    ELSE:
      LOG error;
      RETURN { success: false, retryable: false, message: "Internal error" };
  }
}
```

---

## 测试规则

### TEST_COVERAGE_REQUIREMENTS

```
测试覆盖率阈值:

核心业务逻辑: > 90%
工具函数: > 80%
API 路由: > 70%
整体: > 70%

测试文件命名:
├── *.test.ts     # 单元测试
├── *.spec.ts     # 规范测试
└── *.e2e.test.ts # 端到端测试
```

### TEST_WRITING_RULES

```
测试编写规则:

规则1: 测试即文档
测试用例名称应描述被测试的行为

规则2: AAA 模式
Arrange - 准备测试数据
Act - 执行被测试函数
Assert - 验证结果

规则3: 独立性
每个测试用例独立运行
不依赖执行顺序
不共享状态

规则4: 边界值
必须测试:
├── 空值
├── 极小值
├── 极大值
└── 异常值
```

---

## Git 规则

### COMMIT_MESSAGE_FORMAT

```
Conventional Commits 格式:

<type>(<scope>): <subject>

type 类型:
├── feat:     新功能
├── fix:      Bug 修复
├── refactor: 重构
├── perf:     性能优化
├── docs:     文档
├── test:     测试
├── chore:    构建/工具
└── revert:   回滚

示例:
feat(kline): add K-line merging algorithm
fix(api): handle null response from exchange
perf(wasm): optimize MACD calculation
```

### BRANCH_STRATEGY

```
分支策略:

main/master     → 生产代码
develop         → 开发主分支
feature/*       → 功能分支
hotfix/*        → 紧急修复
release/*       → 发布准备

工作流:
1. 从 develop 创建 feature/*
2. 完成后合并回 develop
3. 测试通过后合并到 main
```

---

## 代码审查规则

### REVIEW_CHECKLIST

```
代码审查要点:

功能性:
├── 是否实现了需求？
├── 边界条件是否处理？
└── 错误是否正确处理？

代码质量:
├── 命名是否清晰？
├── 函数是否单一职责？
├── 是否有重复代码？
└── 复杂度是否可控？

性能:
├── 是否有不必要的循环？
├── 是否有内存泄漏？
└── 是否可以缓存结果？

可维护性:
├── 类型是否正确？
├── 注释是否充分？
└── 测试是否覆盖？
```

---

## 配置管理规则

### CONFIGURATION_STRUCTURE

```
配置层级:

1. 默认配置 (代码中)
2. 环境变量 (.env)
3. 配置文件 (config/*.json)
4. 运行时参数

优先级: 运行时 > 配置文件 > 环境变量 > 默认值
```

### SENSITIVE_DATA_RULES

```
敏感数据处理:

禁止:
├── 硬编码密钥
├── 提交 .env 文件
└── 日志中打印敏感信息

要求:
├── 使用环境变量
├── .env.example 提供模板
└── .gitignore 排除 .env
```

---

## 安全规则

### SECURITY_CHECKLIST

```
安全检查项:

输入验证:
├── 所有用户输入必须验证
├── 类型检查
├── 长度限制
└── 格式验证

输出编码:
├── HTML 转义
├── JSON 序列化
└── SQL 参数化

认证授权:
├── 密码哈希存储
├── Token 过期时间
└── 权限检查

依赖安全:
├── 定期更新依赖
├── 运行安全审计
└── 使用 lock file
```

---

## 依赖管理规则

### DEPENDENCY_VERSION_STRATEGY

```
版本策略:

生产依赖: 使用精确版本
"package": "1.2.3"

开发依赖: 使用范围版本
"dev-package": "^1.2.3"

禁止:
├── 使用 * 版本
├── 频繁更新核心依赖
└── 不使用 lock file
```

### DEPENDENCY_AUDIT_RULES

```
依赖审计:

每次安装后:
RUN npm audit

定期检查:
RUN npm outdated

发现漏洞:
IF severity === "high" OR "critical":
    UPDATE immediately
ELSE:
    SCHEDULE update
```

---

## 日志规则

### LOG_LEVEL_USAGE

```
日志级别使用:

error:   错误，需要立即处理
warn:    警告，潜在问题
info:    重要操作记录
debug:   调试信息（开发环境）
trace:   详细跟踪（仅开发）

生产环境: >= info
开发环境: >= debug
```

### LOG_FORMAT_STANDARD

```
日志格式标准:

{
  "timestamp": "2024-01-20T10:00:00Z",
  "level": "info",
  "module": "kline",
  "message": "Processing klines",
  "data": {
    "count": 1000,
    "symbol": "BTCUSDT"
  }
}

禁止:
├── 日志中包含敏感信息
├── 过度使用 debug 日志
└── 不结构化的日志消息
```

---

## 缓存规则

### CACHING_STRATEGY

```
缓存决策:

应缓存:
├── 数据库查询结果
├── API 响应
├── 计算密集操作结果
└── 不变配置

不应缓存:
├── 实时数据
├── 用户特定状态
└── 频繁变更的数据

缓存策略:
├── TTL: 根据数据变更频率设定
├── LRU: 限制缓存大小
└── 失效: 数据变更时主动失效
```

---

## API 设计规则

### RESTFUL_API_CONVENTIONS

```
API 约定:

GET    /resources      # 列表
GET    /resources/:id  # 详情
POST   /resources      # 创建
PUT    /resources/:id  # 更新
DELETE /resources/:id  # 删除

响应格式:
{
  "success": true|false,
  "data": {...},
  "error": {...}
}

状态码:
200 → 成功
201 → 创建成功
400 → 请求错误
401 → 未认证
403 → 无权限
404 → 不存在
500 → 服务器错误
```

---

## 数据验证规则

### INPUT_VALIDATION_TEMPLATE

```typescript
// 数据验证模板
import { z } from 'zod';

const Schema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
});

function validateInput(data: unknown) {
  const result = Schema.safeParse(data);
  IF !result.success:
    RETURN {
      valid: false,
      errors: result.error.flatten()
    };
  RETURN { valid: true, data: result.data };
}
```

---

## 快速决策表

| 条件 | 动作 |
|------|------|
| `file.lines > 500` | 拆分文件 |
| `token > 150k` | 创建会话交接 |
| `is_cpu_intensive AND high_frequency` | 使用 Rust |
| `uses_pandas` | 使用 Python |
| `needs_frontend_types` | 使用 TypeScript |
| `api_response > 500ms` | 分析性能瓶颈 |
| `no_tests_for_critical_code` | 添加测试 |
| `config_in_code` | 移到配置文件 |
| `hardcoded_secrets` | 使用环境变量 |
| `duplicate_code > 3_times` | 提取函数 |

---

**版本**: v2.0 (AI 优化版)
**格式**: 规则/条件/动作
**目标**: AI 智能体快速决策
