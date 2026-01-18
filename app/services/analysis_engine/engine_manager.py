"""
分析引擎管理器

管理多个分析引擎适配器，提供统一的引擎获取接口。
参考 DataSourceManager 的设计模式。
"""
import logging
from typing import List, Optional

from .base import AnalysisEngineAdapter
from .trading_agents_adapter import TradingAgentsAdapter

logger = logging.getLogger(__name__)


class AnalysisEngineManager:
    """
    分析引擎管理器

    管理所有可用的分析引擎适配器，按优先级排序，
    提供引擎获取和健康检查功能。
    """

    def __init__(self):
        """初始化管理器"""
        # 注册可用引擎（可扩展为从配置读取）
        self.adapters: List[AnalysisEngineAdapter] = [
            TradingAgentsAdapter(),  # 默认引擎
        ]

        # 按名称排序（后续可改为按优先级配置）
        self.adapters.sort(key=lambda x: x.name)

        logger.info(f"📋 引擎管理器初始化完成，注册引擎数: {len(self.adapters)}")

    def get_available_engines(self) -> List[AnalysisEngineAdapter]:
        """
        获取所有可用引擎列表

        Returns:
            list: 可用的引擎适配器列表
        """
        available = []
        for adapter in self.adapters:
            if adapter.is_available():
                available.append(adapter)
                logger.info(f"✅ 引擎 {adapter.name} 可用")
            else:
                logger.warning(f"⚠️ 引擎 {adapter.name} 不可用")
        return available

    def get_primary_engine(self) -> Optional[AnalysisEngineAdapter]:
        """
        获取主引擎（第一个可用引擎）

        Returns:
            AnalysisEngineAdapter: 主引擎，如果没有可用引擎则返回 None
        """
        available = self.get_available_engines()
        if available:
            primary = available[0]
            logger.info(f"🎯 主引擎: {primary.name}")
            return primary
        else:
            logger.error("❌ 没有可用的分析引擎")
            return None

    def get_engine_by_name(self, name: str) -> Optional[AnalysisEngineAdapter]:
        """
        按名称获取引擎

        Args:
            name: 引擎名称

        Returns:
            AnalysisEngineAdapter: 指定的引擎，如果不存在或不可用则返回 None
        """
        for adapter in self.adapters:
            if adapter.name == name:
                if adapter.is_available():
                    logger.info(f"🎯 找到引擎: {name}")
                    return adapter
                else:
                    logger.warning(f"⚠️ 引擎 {name} 不可用")
                    return None

        logger.warning(f"⚠️ 未找到引擎: {name}")
        return None

    def get_all_health_status(self) -> List[dict]:
        """
        获取所有引擎的健康状态

        Returns:
            list: 所有引擎的健康检查结果
        """
        health_status = []
        for adapter in self.adapters:
            try:
                health = adapter.get_health_check()
                health_status.append(health)
            except Exception as e:
                logger.error(f"❌ 获取 {adapter.name} 健康状态失败: {e}")
                health_status.append({
                    "name": adapter.name,
                    "error": str(e),
                    "available": False
                })
        return health_status

    def register_adapter(self, adapter: AnalysisEngineAdapter) -> None:
        """
        注册新的引擎适配器

        Args:
            adapter: 引擎适配器实例
        """
        self.adapters.append(adapter)
        self.adapters.sort(key=lambda x: x.name)
        logger.info(f"➕ 注册新引擎: {adapter.name}")


# 全局单例（延迟初始化）
_engine_manager: Optional[AnalysisEngineManager] = None


def get_engine_manager() -> AnalysisEngineManager:
    """
    获取引擎管理器实例（单例模式）

    Returns:
        AnalysisEngineManager: 引擎管理器实例
    """
    global _engine_manager
    if _engine_manager is None:
        _engine_manager = AnalysisEngineManager()
        logger.info("🏭 创建引擎管理器单例")
    return _engine_manager


def reset_engine_manager() -> None:
    """
    重置引擎管理器（主要用于测试）

    注意：生产环境慎用
    """
    global _engine_manager
    _engine_manager = None
    logger.warning("🔄 引擎管理器已重置")
