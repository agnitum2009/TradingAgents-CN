"""
分析引擎适配器模块

提供统一的引擎接口和管理器，支持多种分析引擎的切换和扩展。
"""
from .base import AnalysisEngineAdapter
from .trading_agents_adapter import TradingAgentsAdapter
from .engine_manager import (
    AnalysisEngineManager,
    get_engine_manager,
    reset_engine_manager
)

__all__ = [
    # 基类
    "AnalysisEngineAdapter",
    # 适配器实现
    "TradingAgentsAdapter",
    # 管理器
    "AnalysisEngineManager",
    "get_engine_manager",
    "reset_engine_manager",
]

__version__ = "1.0.0"
