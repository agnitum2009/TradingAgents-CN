# Rust + Python + Node.js 三人组架构规则手册

> **目标读者**: AI 智能体
> **用途**: 多语言项目架构决策和实现
> **格式**: 决策树/代码模板/配置规则

---

## 架构决策规则

### LANGUAGE_SELECTION_ALGORITHM

```
FUNCTION select_language(module_requirements):
    # 决策树
    IF module_requirements.is_cpu_intensive
       AND module_requirements.call_frequency > 1000/min:
        RETURN "Rust"

    IF "pandas" in module_requirements.dependencies
       OR "numpy" in module_requirements.dependencies
       OR "talib" in module_requirements.dependencies:
        RETURN "Python"

    IF module_requirements.needs_fast_iteration:
        RETURN "TypeScript"

    IF module_requirements.needs_type_sharing_with_frontend:
        RETURN "TypeScript"

    # 默认
    RETURN "TypeScript"
```

### MODULE_TYPE_DISTRIBUTION

```
代码占比分配:
├── TypeScript (主干): 65-75%
├── Rust (性能层):      10-20%
└── Python (功能层):    10-20%

超出阈值警告:
IFtypescript_percent < 60:
    WARN "过于复杂，考虑简化"
IF rust_percent > 25:
    WARN "Rust 过多，考虑非核心模块用 TS"
IF python_percent > 25:
    WARN "Python 过多，考虑数据服务分离"
```

### COMMUNICATION_PATTERN_SELECTION

```
通信模式决策:

TypeScript ↔ Rust:
    IF runs_in_browser:
        USE "WASM"
        PROTOCOL: wasm-bindgen
        DATA_TRANSFER: JSON (via serde)
    ELSE IF needs_zero_copy:
        USE "FFI (napi-rs)"
        PROTOCOL: C FFI
        DATA_TRANSFER: Pointers
    ELSE:
        USE "WASM"
        # WASM 更通用

TypeScript ↔ Python:
    IF needs_isolation OR has_blocking_operations:
        USE "子进程 + JSON-RPC"
        PROTOCOL: stdin/stdout JSON lines
        TIMEOUT: 30000ms
    ELSE IF needs_high_performance:
        USE "gRPC"
        PROTOCOL: protobuf
    ELSE:
        USE "HTTP REST"
        FRAMEWORK: FastAPI

Rust ↔ Python:
    # 通过 TypeScript 中介
    FORBID direct communication
```

---

## 项目结构模板

### DIRECTORY_STRUCTURE_RULES

```
强制目录结构:

project/
├── chanlun-ts/                    # TypeScript 主干
│   ├── src/
│   │   ├── types/                 # 必须存在
│   │   │   ├── entity.ts
│   │   │   ├── dto.ts
│   │   │   ├── config.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── core/                  # 必须存在
│   │   │   ├── engine.ts
│   │   │   ├── module-registry.ts
│   │   │   └── pipeline.ts
│   │   │
│   │   ├── modules/               # 必须存在
│   │   │   └── [module-name]/
│   │   │       ├── index.ts       # 必须存在 (<200 行)
│   │   │       └── types.ts       # 模块私有类型
│   │   │
│   │   ├── api/                   # API 层
│   │   │   ├── server.ts
│   │   │   └── routes/
│   │   │
│   │   └── utils/                 # 工具函数
│   │       ├── wasm-loader.ts    # WASM 加载器
│   │       └── python-spawn.ts   # Python 子进程管理器
│   │
│   └── native/                    # 原生模块
│       ├── rust/                  # Rust 源码
│       │   └── [module-name]/
│       │       ├── Cargo.toml     # 必须存在
│       │       ├── src/lib.rs     # 必须存在
│       │       └── pkg/           # WASM 输出目录
│       │
│       └── python/                # Python 源码
│           └── [module-name]/
│               ├── main.py        # 必须存在
│               └── requirements.txt

验证规则:
IF src/types/ NOT EXISTS:
    ERROR "类型目录缺失"
IF native/rust/ EXISTS AND native/python/ NOT EXISTS:
    WARN "考虑添加 Python 数据服务"
```

### MODULE_INTERFACE_TEMPLATE

```typescript
// chanlun-ts/src/core/module-registry.ts

interface IModule {
  // 元数据
  name: string;
  type: 'rust' | 'python' | 'typescript';
  version: string;

  // 状态
  initialized: boolean;
  started: boolean;

  // 生命周期方法 (必须实现)
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  // 健康检查
  health(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: Record<string, unknown>;
  }>;
}

// 模块注册表
class ModuleRegistry {
  private modules = new Map<string, IModule>();

  register(module: IModule): void {
    IF this.modules.has(module.name):
        ERROR `Module ${module.name} already registered`;
    this.modules.set(module.name, module);
  }

  async initializeAll(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.modules.values()).map(m => m.initialize())
    );
    // 处理失败...
  }
}
```

---

## TypeScript 规则

### TYPE_DEFINITION_RULES

```
类型定义规则:

规则1: 所有共享类型在 src/types/
禁止: 在模块文件中定义共享类型
允许: 模块私有类型在模块内部 types.ts

规则2: 类型导出规范
// src/types/index.ts
export * from './entity';
export * from './dto';
export * from './config';

规则3: 类型注释要求
IF interface fields > 5:
    ADD JSDoc comment
IF interface has nested types:
    ADD JSDoc comment

规则4: 枚举定义
export enum EnumName {
  DEFAULT = 'default',
  // 必须有默认值
  // 使用字符串枚举
}
```

### WASM_INTEGRATION_TEMPLATE

```typescript
// chanlun-ts/src/utils/wasm-loader.ts
interface WasmModule {
  memory: WebAssembly.Memory;
  [key: string]: any;
}

const wasmCache = new Map<string, WasmModule>();

export async function loadWasmModule(
  name: string,
  relativePath: string
): Promise<WasmModule> {
  // 检查缓存
  IF wasmCache.has(name):
      RETURN wasmCache.get(name)!;

  // 加载
  const resolvedPath = resolve(__dirname, relativePath);
  const wasm = await import(resolvedPath);

  // 初始化
  await wasm.default();

  // 缓存
  wasmCache.set(name, wasm);
  RETURN wasm;
}

// 类型转换适配器
export function createWasmAdapter<TI, TO>(
  wasmModule: any,
  functionName: string,
  toWasm: (input: TI) => any,
  fromWasm: (output: any) => TO
): (input: TI) => Promise<TO> {
  RETURN async (input: TI) => {
    const wasmInput = toWasm(input);
    const wasmOutput = wasmModule[functionName](wasmInput);
    RETURN fromWasm(wasmOutput);
  };
}
```

### PYTHON_SUBPROCESS_TEMPLATE

```typescript
// chanlun-ts/src/utils/python-spawn.ts
interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeout: NodeJS.Timeout;
}

export class PythonSubprocess {
  private process: ChildProcess;
  private pending = new Map<number, PendingRequest>();
  private requestId = 0;
  private ready = false;

  constructor(
    private scriptPath: string,
    private pythonPath: string = 'python3'
  ) {
    this.spawn();
  }

  private spawn(): void {
    // 设置 PYTHONPATH
    const env = { ...process.env };
    const srcPath = resolve(join(__dirname, '../../../src'));
    env.PYTHONPATH = srcPath;

    this.process = spawn(this.pythonPath, [this.scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    // 响应处理
    this.process.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        IF line.trim():
            this.handleResponse(JSON.parse(line));
      }
    });

    // 错误处理
    this.process.stderr?.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
    });

    // 等待 ready
    this.waitForReady();
  }

  async call(method: string, params: unknown[] = []): Promise<any> {
    IF !this.ready:
        THROW new Error('Python subprocess not ready');

    const id = ++this.requestId;

    RETURN new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${id} timeout`));
      }, 30000);

      this.pending.set(id, { resolve, reject, timeout });

      // 发送请求
      const request = { jsonrpc: '2.0', id, method, params };
      this.process.stdin?.write(JSON.stringify(request) + '\n');
    });
  }

  private handleResponse(response: any): void {
    const { id, result, error } = response;
    const pending = this.pending.get(id);

    IF pending:
        this.pending.delete(id);
        clearTimeout(pending.timeout);
        IF error:
            pending.reject(new Error(error));
        ELSE:
            pending.resolve(result);
  }
}
```

---

## Rust 规则

### RUST_PROJECT_STRUCTURE

```
Rust WASM 项目结构:

native/rust/[module-name]/
├── Cargo.toml              # 必须配置
├── build.sh                # 构建脚本（可选）
├── src/
│   └── lib.rs              # 必须存在
└── pkg/                    # wasm-pack 输出目录
    ├── [module_name]_bg.wasm
    ├── [module_name].js
    └── [module_name].d.ts

Cargo.toml 必需配置:
[package]
name = "[module_name]"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

### WASM_EXPORT_TEMPLATE

```rust
// src/lib.rs

use wasm_bindgen::prelude::*;

// 类型定义 (必须可序列化)
#[wasm_bindgen]
pub struct KlineData {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

#[wasm_bindgen]
impl KlineData {
    #[wasm_bindgen(constructor)]
    pub fn new(
        timestamp: i64,
        open: f64,
        high: f64,
        low: f64,
        close: f64,
        volume: f64,
    ) -> Self {
        Self {
            timestamp,
            open,
            high,
            low,
            close,
            volume,
        }
    }
}

// 主函数 (必须使用 wasm_bindgen)
#[wasm_bindgen]
pub fn process_klines(klines: Vec<KlineData>) -> Vec<KlineData> {
    // Rust 实现逻辑
    klines
        .into_iter()
        .map(|k| {
            // 处理...
            k
        })
        .collect()
}

// 单元测试
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_klines() {
        let input = vec![
            KlineData::new(1000, 1.0, 2.0, 0.5, 1.5, 100.0),
        ];
        let result = process_klines(input);
        assert_eq!(result.len(), 1);
    }
}
```

### RUST_BUILD_COMMANDS

```bash
# 构建命令
cd native/rust/[module-name]

# 开发构建 (快速)
wasm-pack build --dev --target web

# 生产构建 (优化)
wasm-pack build --release --target web

# 运行测试
cargo test

# 测试 WASM
wasm-pack test --node

# 发布到 npm
wasm-pack publish
```

---

## Python 规则

### PYTHON_SERVICE_TEMPLATE

```python
# native/python/[module-name]/main.py
import sys
import json
from typing import List, Dict, Any

class ModuleService:
    """模块服务类"""

    def __init__(self):
        self.running = True

    def handle_request(self, method: str, params: List[Any]) -> Any:
        """处理请求"""
        if method == "method_name":
            return self.method_name(*params)
        else:
            raise ValueError(f"Unknown method: {method}")

    # 业务方法
    def method_name(self, arg1: str, arg2: int) -> Dict:
        """方法实现"""
        return {"result": "value"}

def main():
    service = ModuleService()

    # 发送 ready 信号 (必须有)
    print(json.dumps({"status": "ready", "version": "1.0.0"}))
    sys.stdout.flush()

    while service.running:
        try:
            # 读取请求
            line = sys.stdin.readline()
            if not line:
                break

            request = json.loads(line)

            # 解析请求
            method = request.get("method")
            params = request.get("params", [])
            req_id = request.get("id")

            result = None
            error = None

            try:
                result = service.handle_request(method, params)
            except Exception as e:
                error = str(e)

            # 发送响应 (必须有 id 字段)
            response = {"jsonrpc": "2.0", "id": req_id}
            if error:
                response["error"] = error
            else:
                response["result"] = result

            print(json.dumps(response))
            sys.stdout.flush()

        except Exception as e:
            error_response = {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": str(e)
            }
            print(json.dumps(error_response))
            sys.stdout.flush()

if __name__ == "__main__":
    main()
```

### PYTHON_REQUIREMENTS_TEMPLATE

```
# native/python/[module-name]/requirements.txt

# 核心依赖 (精确版本)
pandas==2.1.4
numpy==1.26.2
talib-binary==0.4.28

# Web 框架 (如果需要)
fastapi==0.109.0
uvicorn==0.27.0

# 工具
pydantic==2.5.3
python-dotenv==1.0.0
```

---

## 类型映射规则

### TS_TO_RUST_TYPE_MAPPING

```
TypeScript → Rust 类型映射:

TypeScript                  Rust
────────────────────────────────────────
string                      → String
number                      → f64
boolean                     → bool
Array<T>                    → Vec<T>
{ [key: string]: T }        → HashMap<String, T>
interface { a: T, b: U }    → struct with pub fields
enum (string)               → enum with #[wasm_bindgen]
Date                        → i64 (timestamp)
null / undefined            → Option<T>

注意事项:
1. Rust 侧必须使用 #[wasm_bindgen]
2. 复杂类型需要 serde::Serialize/Deserialize
3. 避免使用 undefined，只用 null
```

### TS_TO_PYTHON_TYPE_MAPPING

```
TypeScript → Python 类型映射:

TypeScript                  Python
────────────────────────────────────────
string                      → str
number                      → float | int
boolean                     → bool
Array<T>                    → List[T]
{ [key: string]: T }        → Dict[str, T]
interface                   → dataclass | TypedDict
enum                        → enum.Enum
Date                        → datetime | int (timestamp)
null / undefined            → None

Pydantic 模板:
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime

class KlineData(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
```

---

## 配置规则

### UNIFIED_CONFIG_SCHEMA

```typescript
// chanlun-ts/src/config/index.ts

export interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  modules: {
    rust: {
      [moduleName: string]: {
        wasmPath: string;
        enabled: boolean;
      };
    };
    python: {
      [moduleName: string]: {
        scriptPath: string;
        pythonPath: string;
        enabled: boolean;
      };
    };
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

// 默认配置
export const defaultConfig: AppConfig = {
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  modules: {
    rust: {
      kline: {
        wasmPath: './native/rust/kline/pkg/kline_wasm.js',
        enabled: true,
      },
      macd: {
        wasmPath: './native/rust/macd/pkg/macd_wasm.js',
        enabled: true,
      },
    },
    python: {
      exchange: {
        scriptPath: './native/python/exchange/main.py',
        pythonPath: 'python3',
        enabled: true,
      },
    },
  },
  logging: {
    level: 'info',
  },
};

// 配置加载
export function loadConfig(): AppConfig {
  // 1. 默认配置
  // 2. 环境变量覆盖
  // 3. 配置文件覆盖
  // 4. 运行时参数覆盖
  RETURN defaultConfig;
}
```

---

## 错误处理规则

### ERROR_TYPE_DEFINITIONS

```typescript
// chanlun-ts/src/utils/errors.ts

export class ModuleError extends Error {
  constructor(
    public moduleName: string,
    message: string,
    public cause?: Error
  ) {
    super(`[${moduleName}] ${message}`);
    this.name = 'ModuleError';
  }
}

export class WasmError extends Error {
  constructor(
    public moduleName: string,
    message: string,
    public cause?: Error
  ) {
    super(`[WASM:${moduleName}] ${message}`);
    this.name = 'WasmError';
  }
}

export class PythonProcessError extends Error {
  constructor(
    public moduleName: string,
    message: string,
    public cause?: Error
  ) {
    super(`[PYTHON:${moduleName}] ${message}`);
    this.name = 'PythonProcessError';
  }
}

// 错误处理装饰器
export function handleModuleErrors(
  moduleName: string,
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    try {
      RETURN await originalMethod.apply(this, args);
    } catch (error) {
      IF error instanceof ModuleError:
          THROW error;
      ELSE:
          THROW new ModuleError(moduleName, error.message, error);
    }
  };

  RETURN descriptor;
}
```

---

## 性能优化规则

### PERFORMANCE_PROFILING_CHECKLIST

```
性能检查清单:

编译时优化:
├── Rust: --release 标志
├── TypeScript: 生产构建
└── Python: 使用 C 扩展 (talib-binary)

运行时优化:
├── WASM: 使用 SharedArrayBuffer (如果支持)
├── Python: 进程池复用
└── TypeScript: 启用缓存

数据传输优化:
├── 减少序列化次数
├── 使用二进制格式 (MessagePack)
└── 批量处理

性能目标:
├── API 响应: < 200ms (P95)
├── WASM 调用: < 10ms
└── Python 调用: < 50ms
```

### PERFORMANCE_TEST_TEMPLATE

```typescript
// tests/performance/wasm.test.ts
import { performance } from 'perf_hooks';

export async function benchmarkWasm(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 1000
) {
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await fn();
  }

  const end = performance.now();
  const avg = (end - start) / iterations;

  console.log(`[BENCHMARK] ${name}: ${avg.toFixed(4)}ms/op`);

  // 断言
  IF avg > 10:
      WARN `${name} exceeds 10ms threshold: ${avg}ms`;

  RETURN { avg, total: end - start };
}

// 使用示例
benchmarkWasm('MACD calculation', async () => {
  await macdModule.calculate(testData);
}, 1000);
```

---

## 部署规则

### DOCKER_MULTI_STAGE_BUILD

```dockerfile
# Rust 构建阶段
FROM rust:1.75-slim as rust-builder
WORKDIR /build
COPY native/rust ./native/rust
RUN cd native/rust/kline && \
    cargo install wasm-pack && \
    wasm-pack build --release --target web --out-dir pkg

# Python 环境准备
FROM python:3.11-slim as python-base
RUN pip install --no-cache-dir pandas numpy talib-binary

# Node.js 构建阶段
FROM node:20-alpine as node-builder
WORKDIR /app
COPY --from=rust-builder /build/native/rust ./native/rust
COPY chanlun-ts .
RUN npm ci && npm run build

# 运行阶段
FROM node:20-alpine
WORKDIR /app
COPY --from=node-builder /app/dist ./dist
COPY --from=python-base /usr/local/lib/python3.11/site-packages ./python/lib
ENV PYTHONPATH=/app/python/lib
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### ENVIRONMENT_VARIABLES

```bash
# .env.template
NODE_ENV=production
SERVER_PORT=3000
SERVER_HOST=0.0.0.0

# Python 配置
PYTHON_PATH=/usr/bin/python3
PYTHONPATH=/app/src

# Rust WASM 路径
WASM_KLINE_PATH=./native/rust/kline/pkg
WASM_MACD_PATH=./native/rust/macd/pkg

# 日志
LOG_LEVEL=info

# 功能开关
ENABLE_RUST_KLINE=true
ENABLE_PYTHON_EXCHANGE=true
```

---

## 故障排查规则

### COMMON_ISSUES_RESOLUTION

```
问题诊断决策树:

WASM 加载失败:
├── 检查 wasm-pack build 是否成功
├── 检查 pkg/ 目录是否存在
├── 检查 .js 导入路径是否正确
└── 检查 wasm-bindgen 版本兼容性

Python 子进程崩溃:
├── 检查 PYTHONPATH 设置
├── 检查 Python 脚本语法
├── 查看 stderr 输出
└── 检查依赖是否安装

类型不匹配:
├── 检查 TS 类型定义
├── 检查 Rust #[wasm_bindgen] 属性
├── 检查序列化/反序列化
└── 运行类型检查 (tsc --noEmit)

性能无提升:
├── 检查是否使用 --release 构建
├── 检查序列化开销
├── 使用 profiler 定位瓶颈
└── 考虑零拷贝方案
```

---

## 快速参考

### DECISION_MATRIX

| 条件 | 语言 | 通信方式 |
|------|------|---------|
| CPU 密集 + 高频 | Rust | WASM |
| pandas/numpy | Python | 子进程 |
| 前后端类型共享 | TypeScript | - |
| 交易所 SDK | Python | 子进程 |
| Web API | TypeScript | - |

### FILE_NAMING_CONVENTIONS

```
TypeScript:
├── *.ts           # 实现
├── *.test.ts      # 测试
├── types.ts       # 类型定义
└── index.ts       # 导出

Rust:
├── lib.rs         # 库入口
├── *.rs           # 实现
├── Cargo.toml     # 配置
└── pkg/           # WASM 输出

Python:
├── main.py        # 服务入口
├── *_test.py      # 测试
├── requirements.txt # 依赖
└── __init__.py    # 包
```

### COMMAND_SHORTCUTS

```bash
# Rust WASM 构建
wasm-pack build --release --target web --out-dir pkg

# Python 依赖安装
pip install -r requirements.txt

# TypeScript 构建
npm run build

# 运行所有测试
npm test && cargo test && python -m pytest
```

---

**版本**: v2.0 (AI 优化版)
**格式**: 决策树/代码模板/配置规则
**目标**: AI 智能体快速实现多语言项目
