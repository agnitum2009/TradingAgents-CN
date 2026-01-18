"""
TradingAgents 引擎适配器

将 TradingAgentsGraph 包装为统一的 AnalysisEngineAdapter 接口。
"""
import logging
from typing import Dict, Any, Optional, Callable, Tuple

from .base import AnalysisEngineAdapter

logger = logging.getLogger(__name__)


class TradingAgentsAdapter(AnalysisEngineAdapter):
    """
    TradingAgents 引擎适配器

    包装现有的 TradingAgentsGraph，实现统一的引擎接口。
    """

    def __init__(self):
        """初始化适配器"""
        self._engine = None
        self._config = None
        self._initialized = False

    @property
    def name(self) -> str:
        """引擎名称"""
        return "TradingAgents"

    @property
    def version(self) -> str:
        """引擎版本"""
        return "1.0.2"

    def initialize(
        self,
        selected_analysts: list,
        debug: bool,
        config: Dict[str, Any]
    ) -> None:
        """
        初始化 TradingAgents 引擎

        采用延迟初始化策略，只在第一次调用时导入和创建实例。

        Args:
            selected_analysts: 选择的分析师列表
            debug: 是否启用调试模式
            config: 配置字典
        """
        if self._initialized:
            logger.debug(f"TradingAgents 引擎已初始化，跳过重复初始化")
            return

        try:
            # 延迟导入：只在需要时导入 TradingAgentsGraph
            from tradingagents.graph.trading_graph import TradingAgentsGraph

            logger.info(f"正在初始化 TradingAgents 引擎...")
            logger.debug(f"  - 分析师: {selected_analysts}")
            logger.debug(f"  - 调试模式: {debug}")
            logger.debug(f"  - LLM提供商: {config.get('llm_provider', 'default')}")

            self._engine = TradingAgentsGraph(
                selected_analysts=selected_analysts,
                debug=debug,
                config=config
            )
            self._config = config
            self._initialized = True

            logger.info(f"✅ TradingAgents 引擎初始化成功")

        except Exception as e:
            logger.error(f"❌ TradingAgents 引擎初始化失败: {e}")
            raise RuntimeError(f"Failed to initialize TradingAgents engine: {e}")

    def analyze(
        self,
        symbol: str,
        trade_date: str,
        progress_callback: Optional[Callable[[str], None]] = None,
        task_id: Optional[str] = None
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        执行分析

        Args:
            symbol: 股票代码
            trade_date: 分析日期
            progress_callback: 可选的进度回调函数
            task_id: 可选的任务ID

        Returns:
            tuple: (state, decision)
                - state: 内部状态字典
                - decision: 分析结果字典

        Raises:
            RuntimeError: 如果引擎未初始化
        """
        if not self._initialized or self._engine is None:
            raise RuntimeError(
                "Engine not initialized. Call initialize() before analyze()."
            )

        try:
            logger.info(f"🔄 TradingAgents 开始分析 {symbol} ({trade_date})")

            # 调用 TradingAgentsGraph 的 propagate 方法
            state, decision = self._engine.propagate(
                symbol,
                trade_date,
                progress_callback=progress_callback,
                task_id=task_id
            )

            logger.info(f"✅ TradingAgents 分析完成: {symbol}")

            return state, decision

        except Exception as e:
            logger.error(f"❌ TradingAgents 分析失败 {symbol}: {e}")
            raise

    def is_available(self) -> bool:
        """
        检查 TradingAgents 引擎是否可用

        Returns:
            bool: 引擎是否可用
        """
        try:
            from tradingagents.graph.trading_graph import TradingAgentsGraph
            return True
        except ImportError as e:
            logger.warning(f"TradingAgents 引擎不可用: {e}")
            return False

    def get_config(self) -> Dict[str, Any]:
        """
        获取当前配置

        Returns:
            dict: 当前配置
        """
        return self._config.copy() if self._config else {}

    def cleanup(self) -> None:
        """
        清理资源

        重置引擎实例，释放资源
        """
        if self._engine:
            logger.info(f"🧹 清理 TradingAgents 引擎资源")
            self._engine = None
            self._initialized = False

    def get_health_check(self) -> Dict[str, Any]:
        """
        健康检查

        Returns:
            dict: 健康检查结果
        """
        health = super().get_health_check()
        health.update({
            "initialized": self._initialized,
            "config": {
                "llm_provider": self._config.get("llm_provider") if self._config else None,
                "selected_analysts": self._config.get("selected_analysts") if self._config else None,
            }
        })
        return health
