"""
TACN v2.0 - API v2 Router

New API version with TypeScript service layer integration.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import logging
import json
import subprocess

from app.integrations.typescript_bridge import get_ts_bridge

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2", tags=["v2"])


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check for v2 API."""
    ts_bridge = get_ts_bridge()
    ts_health = await ts_bridge.health_check()

    return {
        "status": "healthy",
        "version": "2.0.0",
        "architecture": "TypeScript主干 + Rust性能 + Python功能",
        "typescript_services": ts_health,
    }


@router.get("/services/status")
async def services_status() -> Dict[str, Any]:
    """Get status of all integrated services."""
    return {
        "typescript": {
            "status": "enabled",
            "services": ["TrendAnalysisService", "ConfigService"],
            "bridge": "Python-Node.js subprocess"
        },
        "rust": {
            "status": "enabled",
            "modules": ["wordcloud", "indicators", "stockcode", "financial", "backtest", "strategy", "data"]
        },
        "python": {
            "status": "enabled",
            "services": ["LLM", "data_sources", "database"]
        }
    }


@router.get("/architecture")
async def get_architecture_info() -> Dict[str, Any]:
    """Get v2.0 architecture information."""
    return {
        "version": "2.0.0",
        "design": "TypeScript主干 + Rust性能肌肉 + Python功能器官",
        "components": {
            "typescript": {
                "role": "主干架构 (90%)",
                "responsibilities": [
                    "业务编排",
                    "领域服务",
                    "事件总线",
                    "类型系统",
                    "API 编排"
                ]
            },
            "rust": {
                "role": "性能肌肉 (5-7%)",
                "modules": [
                    "wordcloud (5x加速)",
                    "indicators (10x加速)",
                    "stockcode (5x加速)",
                    "financial (8x加速)",
                    "backtest (50x加速)",
                    "strategy (20x加速)",
                    "data (10x加速)"
                ]
            },
            "python": {
                "role": "功能器官 (3-5%)",
                "services": [
                    "LLM 集成",
                    "数据源适配",
                    "pandas 数据处理",
                    "交易所接口"
                ]
            }
        }
    }


# =============================================================================
# 测试端点 - 验证 Python -> TypeScript 调用链
# =============================================================================

@router.get("/test/ts-hello")
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
        print(f"[OK] Node.js 可用: {result.stdout.strip()}")

        # 2. 检查 TS 构建产物
        ls_result = subprocess.run(
            ["ls", "/app/ts_services/build/index.js"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if ls_result.returncode == 0:
            print("[OK] TS 构建产物存在")
        else:
            print("[FAIL] TS 构建产物不存在")
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
            print(f"[FAIL] Node.js 执行失败: {result.stderr}")
            return {"error": result.stderr}

        # 4. 解析结果
        data = json.loads(result.stdout.strip())
        print(f"[OK] TypeScript 服务响应: {data['message']}")
        print(f"     可用导出: {data['exports']}")

        print("\n=== 调用链验证成功 ===\n")

        return {
            "status": "success",
            "architecture": "Python FastAPI -> Node.js subprocess -> TypeScript services",
            "ts_exports": data["exports"],
            "message": data["message"],
            "timestamp": data["timestamp"]
        }

    except Exception as e:
        print(f"[FAIL] 测试失败: {e}")
        return {"error": str(e)}


@router.get("/test/ts-exports")
async def test_ts_exports():
    """获取 TypeScript 服务导出信息"""
    try:
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


@router.get("/test/calculation")
async def test_calculation():
    """
    测试 TypeScript 执行实际计算

    Python -> TypeScript (执行计算: 2+2) -> 返回结果
    """
    try:
        script = """
console.log(JSON.stringify({
    calculation: 2 + 2,
    multiplication: 3 * 7,
    message: 'Calculation performed in TypeScript'
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
                "status": "success",
                "performed_by": "TypeScript (Node.js)",
                "result": data
            }
        else:
            return {"error": result.stderr}


# =============================================================================
# 进度追踪 API - Progress Tracking
# =============================================================================

@router.get("/analysis/tasks/{task_id}")
async def get_task_status(task_id: str) -> Dict[str, Any]:
    """
    Get analysis task status

    查询分析任务状态和进度信息

    Args:
        task_id: Task ID

    Returns:
        Task status information including progress, status, and result (if completed)
    """
    try:
        # Call TypeScript repository to get task status
        script = f"""
const {{ getAnalysisTaskRepository }} = require('./build/repositories');

async function main() {{
    try {{
        const repo = getAnalysisTaskRepository();
        const task = await repo.getTaskByTaskId('{task_id}');

        if (!task) {{
            console.log(JSON.stringify({{ success: false, error: 'Task not found' }}));
            return;
        }}

        console.log(JSON.stringify({{
            success: true,
            data: {{
                taskId: task.taskId,
                userId: task.userId,
                symbol: task.symbol,
                status: task.status,
                progress: task.progress,
                message: task.message,
                currentStep: task.currentStep,
                createdAt: task.createdAt,
                startedAt: task.startedAt,
                completedAt: task.completedAt,
                result: task.result || null
            }}
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

main();
"""

        ts_bridge = get_ts_bridge()
        result = await ts_bridge._run_node_script(script)

        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error"))

        return {
            "task_id": result["data"]["taskId"],
            "user_id": result["data"]["userId"],
            "symbol": result["data"]["symbol"],
            "status": result["data"]["status"],
            "progress": result["data"]["progress"],
            "message": result["data"].get("message"),
            "current_step": result["data"].get("currentStep"),
            "created_at": result["data"]["createdAt"],
            "started_at": result["data"].get("startedAt"),
            "completed_at": result["data"].get("completedAt"),
            "result": result["data"].get("result")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/batches/{batch_id}")
async def get_batch_status(batch_id: str) -> Dict[str, Any]:
    """
    Get analysis batch status

    查询分析批次状态和进度信息

    Args:
        batch_id: Batch ID

    Returns:
        Batch status information including task counts and progress
    """
    try:
        script = f"""
const {{ getAnalysisBatchRepository }} = require('./build/repositories');

async function main() {{
    try {{
        const repo = getAnalysisBatchRepository();
        const batch = await repo.getBatchByBatchId('{batch_id}');

        if (!batch) {{
            console.log(JSON.stringify({{ success: false, error: 'Batch not found' }}));
            return;
        }}

        console.log(JSON.stringify({{
            success: true,
            data: {{
                batchId: batch.batchId,
                userId: batch.userId,
                title: batch.title,
                description: batch.description,
                status: batch.status,
                totalTasks: batch.totalTasks,
                completedTasks: batch.completedTasks || 0,
                failedTasks: batch.failedTasks || 0,
                progress: batch.progress || 0,
                createdAt: batch.createdAt,
                startedAt: batch.startedAt,
                completedAt: batch.completedAt
            }}
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

main();
"""

        ts_bridge = get_ts_bridge()
        result = await ts_bridge._run_node_script(script)

        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error"))

        return {
            "batch_id": result["data"]["batchId"],
            "user_id": result["data"]["userId"],
            "title": result["data"].get("title"),
            "description": result["data"].get("description"),
            "status": result["data"]["status"],
            "total_tasks": result["data"]["totalTasks"],
            "completed_tasks": result["data"]["completedTasks"],
            "failed_tasks": result["data"]["failedTasks"],
            "progress": result["data"]["progress"],
            "created_at": result["data"]["createdAt"],
            "started_at": result["data"].get("startedAt"),
            "completed_at": result["data"].get("completedAt")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get batch status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/users/{user_id}/tasks")
async def get_user_tasks(
    user_id: str,
    status: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
) -> Dict[str, Any]:
    """
    Get user's analysis tasks

    获取用户的分析任务列表

    Args:
        user_id: User ID
        status: Optional status filter
        limit: Max results to return
        skip: Number of results to skip

    Returns:
        List of user's tasks
    """
    try:
        status_filter = f"'{status}'" if status else "undefined"

        script = f"""
const {{ getAnalysisTaskRepository }} = require('./build/repositories');

async function main() {{
    try {{
        const repo = getAnalysisTaskRepository();
        const tasks = await repo.getTasksByUser('{user_id}', {{
            status: {status_filter},
            limit: {limit},
            skip: {skip}
        }});

        console.log(JSON.stringify({{
            success: true,
            data: {{
                tasks: tasks.map(t => ({{
                    taskId: t.taskId,
                    symbol: t.symbol,
                    status: t.status,
                    progress: t.progress,
                    createdAt: t.createdAt,
                    completedAt: t.completedAt
                }})),
                count: tasks.length
            }}
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

main();
"""

        ts_bridge = get_ts_bridge()
        result = await ts_bridge._run_node_script(script)

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))

        return {
            "user_id": user_id,
            "tasks": result["data"]["tasks"],
            "count": result["data"]["count"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/users/{user_id}/stats")
async def get_user_stats(user_id: str) -> Dict[str, Any]:
    """
    Get user's analysis statistics

    获取用户的分析统计信息

    Args:
        user_id: User ID

    Returns:
        User statistics including task counts and token usage
    """
    try:
        script = f"""
const {{ getAnalysisTaskRepository }} = require('./build/repositories');

async function main() {{
    try {{
        const repo = getAnalysisTaskRepository();
        const stats = await repo.getUserStats('{user_id}');

        console.log(JSON.stringify({{
            success: true,
            data: stats
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

main();
"""

        ts_bridge = get_ts_bridge()
        result = await ts_bridge._run_node_script(script)

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))

        return {
            "user_id": user_id,
            **result["data"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/progress/redis/{task_id}")
async def get_task_progress_from_redis(task_id: str) -> Dict[str, Any]:
    """
    Get task progress from Redis (real-time progress from Python tracker)

    从 Redis 获取任务的实时进度信息（来自 Python 进度追踪器）

    Args:
        task_id: Task ID

    Returns:
        Real-time progress data from Redis
    """
    try:
        script = f"""
const {{ getRedisProgressClient }} = require('./build/integration');

async function main() {{
    try {{
        const client = getRedisProgressClient();
        await client.initialize();

        const progress = await client.getProgress('{task_id}');

        console.log(JSON.stringify({{
            success: true,
            data: progress
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

main();
"""

        ts_bridge = get_ts_bridge()
        result = await ts_bridge._run_node_script(script)

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))

        return result.get("data", {})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get task progress from Redis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/tasks/{task_id}/cancel")
async def cancel_task(task_id: str) -> Dict[str, Any]:
    """
    Cancel an analysis task

    取消一个分析任务

    Args:
        task_id: Task ID

    Returns:
        Cancellation result
    """
    try:
        script = f"""
const {{ getAnalysisTaskRepository }} = require('./build/repositories');

async function main() {{
    try {{
        const repo = getAnalysisTaskRepository();
        const cancelled = await repo.cancelTask('{task_id}');

        console.log(JSON.stringify({{
            success: true,
            data: {{ cancelled, taskId: '{task_id}' }}
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

main();
"""

        ts_bridge = get_ts_bridge()
        result = await ts_bridge._run_node_script(script)

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))

        return {
            "task_id": task_id,
            "cancelled": result["data"]["cancelled"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/batches/{batch_id}/cancel")
async def cancel_batch(batch_id: str) -> Dict[str, Any]:
    """
    Cancel an analysis batch

    取消一个分析批次

    Args:
        batch_id: Batch ID

    Returns:
        Cancellation result
    """
    try:
        script = f"""
const {{ getAnalysisBatchRepository }} = require('./build/repositories');

async function main() {{
    try {{
        const repo = getAnalysisBatchRepository();
        const cancelled = await repo.cancelBatch('{batch_id}');

        console.log(JSON.stringify({{
            success: true,
            data: {{ cancelled, batchId: '{batch_id}' }}
        }}));
    }} catch (error) {{
        console.log(JSON.stringify({{ success: false, error: error.message }}));
    }}
}}

main();
"""

        ts_bridge = get_ts_bridge()
        result = await ts_bridge._run_node_script(script)

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))

        return {
            "batch_id": batch_id,
            "cancelled": result["data"]["cancelled"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))
