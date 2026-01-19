"""
新闻搜索服务模块

集成自 daily_stock_analysis 项目，支持：
- Bocha (博查) - 优先使用，中文搜索优化
- Tavily - 每月1000次免费
- SerpAPI - 备选方案
"""

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from itertools import cycle

logger = logging.getLogger(__name__)


@dataclass
class NewsResult:
    """单条新闻结果"""
    title: str
    snippet: str
    url: str
    source: str
    published_date: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "snippet": self.snippet,
            "url": self.url,
            "source": self.source,
            "published_date": self.published_date
        }


@dataclass
class NewsResponse:
    """新闻搜索响应"""
    query: str
    results: List[NewsResult]
    provider: str
    success: bool = True
    error_message: Optional[str] = None
    search_time: float = 0.0

    def to_context(self, max_results: int = 5) -> str:
        """转换为用于 AI 分析的上下文文本"""
        if not self.success or not self.results:
            return f"搜索 '{self.query}' 未找到相关结果。"

        lines = [f"【{self.query} 搜索结果】（来源：{self.provider}）"]
        for i, result in enumerate(self.results[:max_results], 1):
            date_str = f" ({result.published_date})" if result.published_date else ""
            lines.append(f"\n{i}. 【{result.source}】{result.title}{date_str}")
            lines.append(f"   {result.snippet[:200]}...")

        return "\n".join(lines)


class BaseSearchProvider(ABC):
    """搜索引擎基类"""

    def __init__(self, api_keys: List[str], name: str):
        self._api_keys = api_keys
        self._name = name
        self._key_cycle = cycle(api_keys) if api_keys else None
        self._key_errors: Dict[str, int] = {key: 0 for key in api_keys}

    @property
    def name(self) -> str:
        return self._name

    @property
    def is_available(self) -> bool:
        return bool(self._api_keys)

    def _get_next_key(self) -> Optional[str]:
        if not self._key_cycle:
            return None

        for _ in range(len(self._api_keys)):
            key = next(self._key_cycle)
            if self._key_errors.get(key, 0) < 3:
                return key

        logger.warning(f"[{self._name}] 所有 API Key 都有错误记录，重置")
        self._key_errors = {key: 0 for key in self._api_keys}
        return self._api_keys[0] if self._api_keys else None

    def _record_success(self, key: str) -> None:
        if key in self._key_errors and self._key_errors[key] > 0:
            self._key_errors[key] -= 1

    def _record_error(self, key: str) -> None:
        self._key_errors[key] = self._key_errors.get(key, 0) + 1
        logger.warning(f"[{self._name}] API Key 错误计数: {self._key_errors[key]}")

    @abstractmethod
    def _do_search(self, query: str, api_key: str, max_results: int) -> NewsResponse:
        pass

    def search(self, query: str, max_results: int = 5) -> NewsResponse:
        api_key = self._get_next_key()
        if not api_key:
            return NewsResponse(
                query=query,
                results=[],
                provider=self._name,
                success=False,
                error_message=f"{self._name} 未配置 API Key"
            )

        start_time = time.time()
        try:
            response = self._do_search(query, api_key, max_results)
            response.search_time = time.time() - start_time

            if response.success:
                self._record_success(api_key)
                logger.info(f"[{self._name}] 搜索成功，返回 {len(response.results)} 条")
            else:
                self._record_error(api_key)

            return response

        except Exception as e:
            self._record_error(api_key)
            elapsed = time.time() - start_time
            logger.error(f"[{self._name}] 搜索失败: {e}")
            return NewsResponse(
                query=query,
                results=[],
                provider=self._name,
                success=False,
                error_message=str(e),
                search_time=elapsed
            )


class BochaSearchProvider(BaseSearchProvider):
    """
    博查搜索引擎
    专为 AI 优化的中文搜索 API
    """

    def __init__(self, api_keys: List[str]):
        super().__init__(api_keys, "Bocha")

    def _do_search(self, query: str, api_key: str, max_results: int) -> NewsResponse:
        try:
            import requests
        except ImportError:
            return NewsResponse(
                query=query,
                results=[],
                provider=self.name,
                success=False,
                error_message="requests 未安装"
            )

        try:
            url = "https://api.bocha.cn/v1/web-search"
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            payload = {
                "query": query,
                "freshness": "oneMonth",
                "summary": True,
                "count": min(max_results, 50)
            }

            response = requests.post(url, headers=headers, json=payload, timeout=10)

            if response.status_code != 200:
                error_msg = response.text
                if response.status_code == 403:
                    error_msg = f"余额不足: {error_msg}"
                elif response.status_code == 401:
                    error_msg = f"API KEY无效: {error_msg}"

                return NewsResponse(
                    query=query,
                    results=[],
                    provider=self.name,
                    success=False,
                    error_message=error_msg
                )

            data = response.json()

            if data.get('code') != 200:
                return NewsResponse(
                    query=query,
                    results=[],
                    provider=self.name,
                    success=False,
                    error_message=data.get('msg', 'API返回错误')
                )

            results = []
            web_pages = data.get('data', {}).get('webPages', {})
            for item in web_pages.get('value', [])[:max_results]:
                snippet = item.get('summary') or item.get('snippet', '')
                if snippet:
                    snippet = snippet[:500]

                results.append(NewsResult(
                    title=item.get('name', ''),
                    snippet=snippet,
                    url=item.get('url', ''),
                    source=item.get('siteName', ''),
                    published_date=item.get('datePublished')
                ))

            return NewsResponse(
                query=query,
                results=results,
                provider=self.name,
                success=True,
            )

        except requests.exceptions.Timeout:
            return NewsResponse(
                query=query,
                results=[],
                provider=self.name,
                success=False,
                error_message="请求超时"
            )
        except Exception as e:
            return NewsResponse(
                query=query,
                results=[],
                provider=self.name,
                success=False,
                error_message=str(e)
            )


class TavilySearchProvider(BaseSearchProvider):
    """Tavily 搜索引擎"""

    def __init__(self, api_keys: List[str]):
        super().__init__(api_keys, "Tavily")

    def _do_search(self, query: str, api_key: str, max_results: int) -> NewsResponse:
        try:
            from tavily import TavilyClient
        except ImportError:
            return NewsResponse(
                query=query,
                results=[],
                provider=self.name,
                success=False,
                error_message="tavily-python 未安装"
            )

        try:
            client = TavilyClient(api_key=api_key)
            response = client.search(
                query=query,
                search_depth="advanced",
                max_results=max_results,
                include_answer=False,
                include_raw_content=False,
                days=7,
            )

            results = []
            for item in response.get('results', []):
                results.append(NewsResult(
                    title=item.get('title', ''),
                    snippet=item.get('content', '')[:500],
                    url=item.get('url', ''),
                    source=self._extract_domain(item.get('url', '')),
                    published_date=item.get('published_date'),
                ))

            return NewsResponse(
                query=query,
                results=results,
                provider=self.name,
                success=True,
            )

        except Exception as e:
            return NewsResponse(
                query=query,
                results=[],
                provider=self.name,
                success=False,
                error_message=str(e)
            )

    @staticmethod
    def _extract_domain(url: str) -> str:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc.replace('www.', '') or '未知来源'
        except:
            return '未知来源'


class SerpAPISearchProvider(BaseSearchProvider):
    """SerpAPI 搜索引擎"""

    def __init__(self, api_keys: List[str]):
        super().__init__(api_keys, "SerpAPI")

    def _do_search(self, query: str, api_key: str, max_results: int) -> NewsResponse:
        try:
            from serpapi import GoogleSearch
        except ImportError:
            return NewsResponse(
                query=query,
                results=[],
                provider=self.name,
                success=False,
                error_message="google-search-results 未安装"
            )

        try:
            params = {
                "engine": "baidu",
                "q": query,
                "api_key": api_key,
            }

            search = GoogleSearch(params)
            response = search.get_dict()

            results = []
            for item in response.get('organic_results', [])[:max_results]:
                results.append(NewsResult(
                    title=item.get('title', ''),
                    snippet=item.get('snippet', '')[:500],
                    url=item.get('link', ''),
                    source=item.get('source', ''),
                    published_date=item.get('date'),
                ))

            return NewsResponse(
                query=query,
                results=results,
                provider=self.name,
                success=True,
            )

        except Exception as e:
            return NewsResponse(
                query=query,
                results=[],
                provider=self.name,
                success=False,
                error_message=str(e)
            )


class NewsSearchService:
    """
    新闻搜索服务

    管理多个搜索引擎，自动故障转移
    """

    def __init__(
        self,
        bocha_keys: Optional[List[str]] = None,
        tavily_keys: Optional[List[str]] = None,
        serpapi_keys: Optional[List[str]] = None,
    ):
        self._providers: List[BaseSearchProvider] = []

        # 按优先级初始化搜索引擎
        if bocha_keys:
            self._providers.append(BochaSearchProvider(bocha_keys))
            logger.info(f"已配置 Bocha 搜索，共 {len(bocha_keys)} 个 API Key")

        if tavily_keys:
            self._providers.append(TavilySearchProvider(tavily_keys))
            logger.info(f"已配置 Tavily 搜索，共 {len(tavily_keys)} 个 API Key")

        if serpapi_keys:
            self._providers.append(SerpAPISearchProvider(serpapi_keys))
            logger.info(f"已配置 SerpAPI 搜索，共 {len(serpapi_keys)} 个 API Key")

        if not self._providers:
            logger.warning("未配置任何搜索引擎 API Key")

    @property
    def is_available(self) -> bool:
        return any(p.is_available for p in self._providers)

    def search_stock_news(
        self,
        stock_code: str,
        stock_name: str,
        max_results: int = 5
    ) -> NewsResponse:
        """
        搜索股票相关新闻

        Args:
            stock_code: 股票代码
            stock_name: 股票名称
            max_results: 最大返回结果数

        Returns:
            NewsResponse 对象
        """
        query = f"{stock_name} {stock_code} 股票 最新消息"

        logger.info(f"搜索股票新闻: {stock_name}({stock_code})")

        for provider in self._providers:
            if not provider.is_available:
                continue

            response = provider.search(query, max_results)

            if response.success and response.results:
                logger.info(f"使用 {provider.name} 搜索成功")
                return response

        return NewsResponse(
            query=query,
            results=[],
            provider="None",
            success=False,
            error_message="所有搜索引擎都不可用或搜索失败"
        )

    def search_comprehensive_intel(
        self,
        stock_code: str,
        stock_name: str,
        max_searches: int = 3
    ) -> Dict[str, NewsResponse]:
        """
        多维度情报搜索

        搜索维度：
        1. 最新消息 - 近期新闻动态
        2. 风险排查 - 减持、处罚、利空
        3. 业绩预期 - 年报预告、业绩快报

        Args:
            stock_code: 股票代码
            stock_name: 股票名称
            max_searches: 最大搜索次数

        Returns:
            {维度名称: NewsResponse} 字典
        """
        results = {}
        search_count = 0

        search_dimensions = [
            {
                'name': 'latest_news',
                'query': f"{stock_name} {stock_code} 最新 新闻",
                'desc': '最新消息'
            },
            {
                'name': 'risk_check',
                'query': f"{stock_name} 减持 处罚 利空 风险",
                'desc': '风险排查'
            },
            {
                'name': 'earnings',
                'query': f"{stock_name} 年报预告 业绩预告 业绩快报",
                'desc': '业绩预期'
            },
        ]

        logger.info(f"开始多维度情报搜索: {stock_name}({stock_code})")

        provider_index = 0
        available_providers = [p for p in self._providers if p.is_available]

        for dim in search_dimensions:
            if search_count >= max_searches or not available_providers:
                break

            provider = available_providers[provider_index % len(available_providers)]
            provider_index += 1

            logger.info(f"[情报搜索] {dim['desc']}: 使用 {provider.name}")

            response = provider.search(dim['query'], max_results=3)
            results[dim['name']] = response
            search_count += 1

            if response.success:
                logger.info(f"[情报搜索] {dim['desc']}: 获取 {len(response.results)} 条结果")

            time.sleep(0.5)

        return results

    def format_intel_report(self, intel_results: Dict[str, NewsResponse], stock_name: str) -> str:
        """格式化情报搜索结果为报告"""
        lines = [f"【{stock_name} 情报搜索结果】"]

        if 'latest_news' in intel_results:
            resp = intel_results['latest_news']
            lines.append(f"\n📰 最新消息 (来源: {resp.provider}):")
            if resp.success and resp.results:
                for i, r in enumerate(resp.results[:3], 1):
                    date_str = f" [{r.published_date}]" if r.published_date else ""
                    lines.append(f"  {i}. {r.title}{date_str}")
                    lines.append(f"     {r.snippet[:100]}...")
            else:
                lines.append("  未找到相关消息")

        if 'risk_check' in intel_results:
            resp = intel_results['risk_check']
            lines.append(f"\n⚠️ 风险排查 (来源: {resp.provider}):")
            if resp.success and resp.results:
                for i, r in enumerate(resp.results[:3], 1):
                    lines.append(f"  {i}. {r.title}")
                    lines.append(f"     {r.snippet[:100]}...")
            else:
                lines.append("  未发现明显风险信号")

        if 'earnings' in intel_results:
            resp = intel_results['earnings']
            lines.append(f"\n📊 业绩预期 (来源: {resp.provider}):")
            if resp.success and resp.results:
                for i, r in enumerate(resp.results[:3], 1):
                    lines.append(f"  {i}. {r.title}")
                    lines.append(f"     {r.snippet[:100]}...")
            else:
                lines.append("  未找到业绩相关信息")

        return "\n".join(lines)


# 全局实例
_news_service: Optional[NewsSearchService] = None


def get_news_service() -> NewsSearchService:
    """获取新闻搜索服务实例（单例模式）"""
    global _news_service

    if _news_service is None:
        # 从配置读取 API Keys
        try:
            from app.core.unified_config import unified_config

            # 尝试从配置获取 API Keys
            # 注意：需要在配置文件中添加这些配置
            bocha_keys = []
            tavily_keys = []
            serpapi_keys = []

            # 尝试从环境变量获取（优先级更高）
            import os
            if os.getenv("BOCHA_API_KEY"):
                bocha_keys = [os.getenv("BOCHA_API_KEY")]
            if os.getenv("TAVILY_API_KEY"):
                tavily_keys = [os.getenv("TAVILY_API_KEY")]
            if os.getenv("SERPAPI_KEY"):
                serpapi_keys = [os.getenv("SERPAPI_KEY")]

            _news_service = NewsSearchService(
                bocha_keys=bocha_keys,
                tavily_keys=tavily_keys,
                serpapi_keys=serpapi_keys,
            )

            if _news_service.is_available:
                logger.info("新闻搜索服务初始化成功")
            else:
                logger.warning("新闻搜索服务未配置 API Key")

        except Exception as e:
            logger.error(f"新闻搜索服务初始化失败: {e}")
            _news_service = NewsSearchService()

    return _news_service


def reset_news_service() -> None:
    """重置新闻搜索服务（用于测试）"""
    global _news_service
    _news_service = None
