"""
测试 Python 调用 TypeScript 服务的端到端测试

创建一个真实的 API 端点，通过 Python -> TypeScript 调用链
"""

import json
import subprocess
from typing import Dict, Any
import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/api/v2/test", tags=["test-integration"])


@router.get("/ts-hello")
async def test_ts_hello():
    """
    测试调用 TypeScript 服务

    调用链:
    Python FastAPI -> Node.js subprocess -> TypeScript index.js -> 返回结果
    """
    print("\n=== 测试 Python -> TypeScript 调用链 ===")

    try:
        # 1. 检查 Node.js 可用
        result = subprocess.run(
            ["node", "-v"],
            capture_output=True,
            text=True,
            timeout=5
        )
        print(f"✅ 1. Node.js 可用: {result.stdout.strip()}")

        # 2. 检查 TS 构建产物
        import subprocess
        ls_result = subprocess.run(
            ["ls", "/app/ts_services/build/index.js"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if ls_result.returncode == 0:
            print("✅ 2. TS 构建产物存在")
        else:
            print("❌ 2. TS 构建产物不存在")
            return {"error": "build_not_found"}

        # 3. 实际调用 TypeScript 服务
        script = """
const ts = require('./build/index.js');
console.log(JSON.stringify({
    success: true,
    message: 'TypeScript service called from Python!',
    exports: Object.keys(ts),
    timestamp: Date.now()
}));
"""
        result = subprocess.run(
            ["node", "-e", script],
            capture_output=True,
            text=True,
            cwd="/app/ts_services",
            timeout=5
        )

        if result.returncode != 0:
            print(f"❌ 3. Node.js 执行失败: {result.stderr}")
            return {"error": result.stderr}

        # 4. 解析结果
        data = json.loads(result.stdout.strip())
        print(f"✅ 3. TypeScript 服务响应: {data['message']}")
        print(f"   可用导出: {data['exports']}")

        print("\n=== 调用链验证成功 ===\n")

        return {
            "status": "success",
            "architecture": "Python -> Node.js -> TypeScript",
            "ts_exports": data["exports"],
            "message": data["message"],
            "timestamp": data["timestamp"]
        }

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return {"error": str(e)}


@router.get("/ts-service-info")
async def get_ts_service_info():
    """获取 TypeScript 服务信息"""
    try:
        # 获取导出的服务列表
        script = """
const ts = require('./build/index.js');
console.log(JSON.stringify({
    exports: Object.keys(ts),
    hasTrendAnalysis: !!ts.TrendAnalysisService,
    hasPythonAdapter: !!ts.PythonAdapter,
    hasRustAdapter: !!ts.RustAdapter,
    hasLogger: !!ts.Logger
}));
"""
        result = subprocess.run(
            ["node", "-e", script],
            capture_output=True,
            text=True,
            cwd="/app/ts_services",
            timeout=5
        )

        if result.returncode == 0:
            data = json.loads(result.stdout.strip())
            return {
                "status": "available",
                "ts_services": data,
                "location": "/app/ts_services/build"
            }
        else:
            return {
                "status": "error",
                "error": result.stderr
            }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


@router.get("/ping-pong")
async def test_ping_pong():
    """
    简单的 Ping-Pong 测试

    Python -> TypeScript (执行简单计算) -> 返回结果
    """
    try:
        # 在 TypeScript 中执行一个简单计算
        script = """
const result = {
    python_says: 'hello',
    ts_says: 'world',
    calculation: 2 + 2,
    timestamp: Date.now()
};
console.log(JSON.stringify(result));
"""
        result = subprocess.run(
            ["node", "-e", script],
            capture_output=True,
            text=True,
            cwd="/app/ts_services",
            timeout=5
        )

        if result.returncode == 0:
            data = json.loads(result.stdout.strip())
            return {
                "status": "success",
                "result": data
            }
        else:
            return {"error": result.stderr}

    except Exception as e:
        return {"error": str(e)}
