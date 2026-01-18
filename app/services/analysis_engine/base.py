"""
分析引擎适配器抽象基类

定义所有分析引擎适配器必须实现的接口。
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Callable, Tuple


class AnalysisEngineAdapter(ABC):
    """
    分析引擎适配器基类

    所有分析引擎适配器都必须实现此接口，确保统一的调用方式。
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """引擎名称"""
        raise NotImplementedError

    @property
    @abstractmethod
    def version(self) -> str:
        """引擎版本"""
        raise NotImplementedError

    @abstractmethod
    def initialize(
        self,
        selected_analysts: list,
        debug: bool,
        config: Dict[str, Any]
    ) -> None:
        """
        初始化引擎

        Args:
            selected_analysts: 选择的分析师列表
            debug: 是否启用调试模式
            config: 配置字典
        """
        raise NotImplementedError

    @abstractmethod
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
                - state: 内部状态字典（用于调试）
                - decision: 分析结果字典
        """
        raise NotImplementedError

    @abstractmethod
    def is_available(self) -> bool:
        """
        检查引擎是否可用

        Returns:
            bool: 引擎是否可用
        """
        raise NotImplementedError

    def get_health_check(self) -> Dict[str, Any]:
        """
        健康检查（可选实现）

        Returns:
            dict: 健康检查结果
        """
        return {
            "name": self.name,
            "version": self.version,
            "available": self.is_available()
        }

    def get_config(self) -> Dict[str, Any]:
        """
        获取当前配置（可选实现）

        Returns:
            dict: 当前配置
        """
        return {}

    def cleanup(self) -> None:
        """
        清理资源（可选实现）

        用于释放引擎占用的资源
        """
        pass
