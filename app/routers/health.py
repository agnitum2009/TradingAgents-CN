from fastapi import APIRouter
import time
from pathlib import Path

router = APIRouter()


def get_version() -> str:
    """从 VERSION 文件读取版本号"""
    try:
        version_file = Path(__file__).parent.parent.parent / "VERSION"
        if version_file.exists():
            return version_file.read_text(encoding='utf-8').strip()
    except Exception:
        pass
    return "v1.0.7"  # v1.0.7 缠论分析前端集成版本


@router.get("/health")
async def health():
    """健康检查接口 - 前端使用"""
    return {
        "success": True,
        "data": {
            "status": "ok",
            "version": get_version(),
            "timestamp": int(time.time()),
            "service": "TradingAgents-CN API"
        },
        "message": "服务运行正常"
    }

@router.get("/healthz")
async def healthz():
    """Kubernetes健康检查"""
    return {"status": "ok"}

@router.get("/readyz")
async def readyz():
    """Kubernetes就绪检查"""
    return {"ready": True}


@router.get("/rust-stats")
async def rust_stats():
    """
    Rust 性能优化模块统计

    返回 Rust 模块调用统计信息，包括：
    - 模块可用性状态
    - Rust 调用次数
    - Python 降级次数
    - 错误次数
    """
    try:
        from app.utils.rust_backend import (
            is_rust_available,
            get_module_stats
        )

        modules = ["wordcloud", "indicators", "stockcode"]
        stats = {}

        for module in modules:
            module_stats = get_module_stats(module)
            stats[module] = {
                "available": is_rust_available(module),
                "rust_calls": module_stats.get("rust_calls", 0),
                "python_calls": module_stats.get("python_calls", 0),
                "errors": module_stats.get("errors", 0),
                "total_calls": (
                    module_stats.get("rust_calls", 0) +
                    module_stats.get("python_calls", 0)
                ),
                "rust_usage_percent": (
                    module_stats.get("rust_calls", 0) /
                    (module_stats.get("rust_calls", 0) + module_stats.get("python_calls", 0)) * 100
                    if (module_stats.get("rust_calls", 0) + module_stats.get("python_calls", 0)) > 0
                    else 0
                )
            }

        return {
            "success": True,
            "data": {
                "modules": stats,
                "summary": {
                    "total_modules": len(modules),
                    "available_modules": sum(1 for m in modules if is_rust_available(m)),
                    "timestamp": int(time.time())
                }
            },
            "message": "Rust 性能统计获取成功"
        }
    except Exception as e:
        return {
            "success": False,
            "data": None,
            "message": f"获取 Rust 统计失败: {str(e)}"
        }