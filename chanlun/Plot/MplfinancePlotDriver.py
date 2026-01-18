"""
基于 mplfinance 的增强版 K 线图表绘制驱动器

提供专业的金融图表功能：
- K 线图（蜡烛图）
- 成交量柱状图
- 移动平均线（MA、EMA）
- MACD 指标
- KDJ 指标
- 缠论笔、线段、中枢
- 买卖点标记

替换 chan.py 原有的落后绘图功能。
"""

from typing import Dict, List, Optional, Tuple, Union
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.figure import Figure
from matplotlib.axes import Axes
import mplfinance as mpf
import numpy as np

from Chan import CChan
from Common.CEnum import KL_TYPE
from Plot.PlotMeta import CChanPlotMeta, CBi_meta, CSeg_meta, CZS_meta, CBS_Point_meta


class MplfinancePlotDriver:
    """
    基于 mplfinance 的 K 线图表绘制驱动器

    集成缠论分析结果（笔、线段、中枢、买卖点）与专业金融图表
    """

    # 默认颜色配置（中式K线：红涨绿跌）
    DEFAULT_STYLE = mpf.make_mpf_style(
        base_mpf_style='yahoo',
        facecolor='#f0f0f0',
        edgecolor='#666666',
        figcolor='#ffffff',
        gridcolor='#d0d0d0',
        gridstyle='--',
        gridalpha=0.5,
    )

    # 自定义颜色
    KLINE_COLORS = {
        'up': '#ff4d4f',      # 上涨 - 红色
        'down': '#26c6da',    # 下跌 - 绿色
        'wick': '#666666',    # 影线
        'edge': '#666666',    # 边框
    }

    CHANLUN_COLORS = {
        'bi_up': '#d32f2f',       # 向上笔 - 深红
        'bi_down': '#388e3c',     # 向下笔 - 深绿
        'seg_up': '#ff6b6b',      # 向上线段 - 浅红
        'seg_down': '#51cf66',    # 向下线段 - 浅绿
        'zs': '#ffd43b',          # 中枢 - 黄色
        'bsp_buy': '#1971c2',     # 买点 - 蓝色
        'bsp_sell': '#e03131',    # 卖点 - 红色
        'ma5': '#f5222d',         # MA5 - 红色
        'ma10': '#fa8c16',        # MA10 - 橙色
        'ma20': '#fadb14',        # MA20 - 黄色
        'ma60': '#52c41a',        # MA60 - 绿色
    }

    def __init__(
        self,
        chan: CChan,
        kl_type: KL_TYPE = KL_TYPE.K_DAY,
        plot_config: Optional[Dict[str, bool]] = None,
        plot_para: Optional[Dict] = None,
    ):
        """
        初始化绘图驱动器

        Args:
            chan: 缠论分析对象
            kl_type: K线类型
            plot_config: 绘图配置
            plot_para: 绘图参数
        """
        self.chan = chan
        self.kl_type = kl_type
        self.kl_data = chan[kl_type]

        # 默认绘图配置
        self.plot_config = plot_config or {
            'plot_kline': True,
            'plot_volume': True,
            'plot_bi': True,
            'plot_seg': True,
            'plot_zs': True,
            'plot_bsp': True,
            'plot_ma': True,
            'plot_macd': False,
            'plot_kdj': False,
        }

        # 默认绘图参数
        self.plot_para = plot_para or {
            'figure': {
                'w': 20,
                'h': 12,
                'x_range': 120,
            },
            'ma_periods': [5, 10, 20, 60],
        }

        # 提取绘图元数据
        self.plot_meta = CChanPlotMeta(self.kl_data)

        # 准备数据
        self._prepare_data()

        # 创建图表
        self._create_figure()

    def _prepare_data(self):
        """准备 mplfinance 所需的数据格式"""
        klines = []
        for klc in self.kl_data.lst:
            for klu in klc.lst:
                klines.append({
                    'date': pd.Timestamp(klu.time.to_str()),
                    'open': float(klu.open),
                    'high': float(klu.high),
                    'low': float(klu.low),
                    'close': float(klu.close),
                    'volume': float(klu.trade_info.metric.get('volume', 0)),
                })

        self.df = pd.DataFrame(klines)
        self.df.set_index('date', inplace=True)
        self.df.sort_index(inplace=True)

        # 计算移动平均线
        for period in self.plot_para.get('ma_periods', [5, 10, 20, 60]):
            if len(self.df) >= period:
                self.df[f'MA{period}'] = self.df['close'].rolling(window=period).mean()

    def _create_figure(self):
        """创建图表"""
        fig_config = self.plot_para.get('figure', {})
        width = fig_config.get('w', 20)
        height = fig_config.get('h', 12)

        # 计算子图数量
        panels = 1  # 主图
        if self.plot_config.get('plot_volume', True):
            panels += 1
        if self.plot_config.get('plot_macd', False):
            panels += 1
        if self.plot_config.get('plot_kdj', False):
            panels += 1

        # 计算高度分配
        heights = [0.5]  # 主图
        if self.plot_config.get('plot_volume', True):
            heights.append(0.15)
        if self.plot_config.get('plot_macd', False):
            heights.append(0.2)
        if self.plot_config.get('plot_kdj', False):
            heights.append(0.15)

        # 创建图表
        self.fig, self.axes = plt.subplots(
            panels, 1,
            figsize=(width, height),
            gridspec_kw={'heights': heights},
            sharex=True
        )

        if panels == 1:
            self.axes = [self.axes]
        elif not isinstance(self.axes, np.ndarray):
            self.axes = [self.axes]

        self.fig.suptitle(
            f'{self.chan.code} - {str(self.kl_type)} K线图',
            fontsize=14,
            fontweight='bold'
        )

    def _plot_kline_with_chanlun(self):
        """绘制 K 线图和缠论元素"""
        ax = self.axes[0]

        # 使用 mplfinance 绘制 K 线
        mc = mpf.make_marketcolors(
            up=self.KLINE_COLORS['up'],
            down=self.KLINE_COLORS['down'],
            edge=self.KLINE_COLORS['edge'],
            wick=self.KLINE_COLORS['wick'],
            volume={'up': self.KLINE_COLORS['up'], 'down': self.KLINE_COLORS['down']}
        )

        style = mpf.make_mpf_style(marketcolors=mc, gridstyle='--', gridalpha=0.3)

        # 绘制 K 线
        mpf.plot(
            self.df,
            type='candle',
            style=style,
            ax=ax,
            axtitle=False,
        )

        # 绘制移动平均线
        if self.plot_config.get('plot_ma', True):
            self._plot_ma_lines(ax)

        # 绘制缠论笔
        if self.plot_config.get('plot_bi', False):
            self._plot_bi(ax)

        # 绘制缠论线段
        if self.plot_config.get('plot_seg', False):
            self._plot_seg(ax)

        # 绘制缠论中枢
        if self.plot_config.get('plot_zs', False):
            self._plot_zs(ax)

        # 绘制买卖点
        if self.plot_config.get('plot_bsp', False):
            self._plot_bsp(ax)

        ax.set_ylabel('价格', fontsize=10)
        ax.legend(loc='upper left', fontsize=8)
        ax.grid(True, alpha=0.3)

    def _plot_ma_lines(self, ax: Axes):
        """绘制移动平均线"""
        for period in self.plot_para.get('ma_periods', [5, 10, 20, 60]):
            ma_col = f'MA{period}'
            if ma_col in self.df.columns:
                color = self.CHANLUN_COLORS.get(f'ma{period}', '#999999')
                ax.plot(
                    self.df.index,
                    self.df[ma_col],
                    label=f'MA{period}',
                    color=color,
                    linewidth=1,
                    alpha=0.8
                )

    def _plot_bi(self, ax: Axes):
        """绘制缠论笔"""
        for bi_meta in self.plot_meta.bi_list:
            color = self.CHANLUN_COLORS['bi_up'] if bi_meta.dir.value == 1 else self.CHANLUN_COLORS['bi_down']
            style = '--' if not bi_meta.is_sure else '-'
            linewidth = 1.5 if bi_meta.is_sure else 1.0
            alpha = 0.9 if bi_meta.is_sure else 0.5

            # 获取对应的日期索引
            try:
                x_start = self.df.index[bi_meta.begin_x]
                x_end = self.df.index[bi_meta.end_x]
                ax.plot(
                    [x_start, x_end],
                    [bi_meta.begin_y, bi_meta.end_y],
                    color=color,
                    linestyle=style,
                    linewidth=linewidth,
                    alpha=alpha,
                    label='笔' if bi_meta.idx == 0 else ''
                )
            except (IndexError, KeyError):
                pass

    def _plot_seg(self, ax: Axes):
        """绘制缠论线段"""
        for seg_meta in self.plot_meta.seg_list:
            color = self.CHANLUN_COLORS['seg_up'] if seg_meta.dir.value == 1 else self.CHANLUN_COLORS['seg_down']
            style = '--' if not seg_meta.is_sure else '-'
            linewidth = 2.5 if seg_meta.is_sure else 1.5
            alpha = 0.9 if seg_meta.is_sure else 0.5

            try:
                x_start = self.df.index[seg_meta.begin_x]
                x_end = self.df.index[seg_meta.end_x]
                ax.plot(
                    [x_start, x_end],
                    [seg_meta.begin_y, seg_meta.end_y],
                    color=color,
                    linestyle=style,
                    linewidth=linewidth,
                    alpha=alpha,
                    label='线段' if seg_meta.idx == 0 else ''
                )
            except (IndexError, KeyError):
                pass

    def _plot_zs(self, ax: Axes):
        """绘制缠论中枢"""
        for zs_meta in self.plot_meta.zs_lst:
            try:
                x_start = self.df.index[zs_meta.begin]
                x_end = self.df.index[zs_meta.end]
                width = x_end - x_start
                height = zs_meta.high - zs_meta.low

                rect = mpatches.Rectangle(
                    (x_start, zs_meta.low),
                    width,
                    height,
                    linewidth=1.5,
                    edgecolor=self.CHANLUN_COLORS['zs'],
                    facecolor=self.CHANLUN_COLORS['zs'],
                    alpha=0.2 if zs_meta.is_sure else 0.1,
                    label='中枢' if zs_meta.begin == 0 else ''
                )
                ax.add_patch(rect)
            except (IndexError, KeyError):
                pass

    def _plot_bsp(self, ax: Axes):
        """绘制买卖点"""
        for bsp_meta in self.plot_meta.bs_point_lst:
            try:
                x = self.df.index[bsp_meta.x]
                color = self.CHANLUN_COLORS['bsp_buy'] if bsp_meta.is_buy else self.CHANLUN_COLORS['bsp_sell']
                marker = '^' if bsp_meta.is_buy else 'v'

                ax.scatter(
                    x,
                    bsp_meta.y,
                    marker=marker,
                    color=color,
                    s=100,
                    edgecolors='black',
                    linewidths=1,
                    zorder=5,
                    label=bsp_meta.desc() if bsp_meta.x == self.plot_meta.bs_point_lst[0].x else ''
                )
            except (IndexError, KeyError):
                pass

    def _plot_volume(self):
        """绘制成交量"""
        if not self.plot_config.get('plot_volume', True):
            return

        ax_idx = 1
        if ax_idx >= len(self.axes):
            return

        ax = self.axes[ax_idx]

        colors = [
            self.KLINE_COLORS['up'] if row['close'] >= row['open'] else self.KLINE_COLORS['down']
            for _, row in self.df.iterrows()
        ]

        ax.bar(self.df.index, self.df['volume'], color=colors, alpha=0.6, width=0.8)
        ax.set_ylabel('成交量', fontsize=10)
        ax.grid(True, alpha=0.3)

    def _plot_macd(self):
        """绘制 MACD 指标"""
        if not self.plot_config.get('plot_macd', False):
            return

        # 找到 MACD 子图的索引
        ax_idx = 1
        if self.plot_config.get('plot_volume', True):
            ax_idx += 1
        if ax_idx >= len(self.axes):
            return

        ax = self.axes[ax_idx]

        # 计算 MACD
        ema12 = self.df['close'].ewm(span=12).mean()
        ema26 = self.df['close'].ewm(span=26).mean()
        dif = ema12 - ema26
        dea = dif.ewm(span=9).mean()
        macd = (dif - dea) * 2

        # 绘制柱状图
        colors = ['red' if x >= 0 else 'green' for x in macd]
        ax.bar(self.df.index, macd, color=colors, alpha=0.5, label='MACD')

        # 绘制 DIF 和 DEA
        ax.plot(self.df.index, dif, label='DIF', color='white', linewidth=1)
        ax.plot(self.df.index, dea, label='DEA', color='yellow', linewidth=1)

        ax.set_ylabel('MACD', fontsize=10)
        ax.legend(loc='upper left', fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.axhline(y=0, color='gray', linestyle='--', linewidth=0.5)

    def _plot_kdj(self):
        """绘制 KDJ 指标"""
        if not self.plot_config.get('plot_kdj', False):
            return

        # 找到 KDJ 子图的索引
        ax_idx = 1
        if self.plot_config.get('plot_volume', True):
            ax_idx += 1
        if self.plot_config.get('plot_macd', False):
            ax_idx += 1
        if ax_idx >= len(self.axes):
            return

        ax = self.axes[ax_idx]

        # 计算 KDJ
        low_min = self.df['low'].rolling(window=9).min()
        high_max = self.df['high'].rolling(window=9).max()
        rsv = (self.df['close'] - low_min) / (high_max - low_min) * 100

        k = rsv.ewm(com=2).mean()
        d = k.ewm(com=2).mean()
        j = 3 * k - 2 * d

        # 绘制 K、D、J 线
        ax.plot(self.df.index, k, label='K', color='white', linewidth=1)
        ax.plot(self.df.index, d, label='D', color='yellow', linewidth=1)
        ax.plot(self.df.index, j, label='J', color='purple', linewidth=1)

        ax.set_ylabel('KDJ', fontsize=10)
        ax.set_ylim(0, 100)
        ax.legend(loc='upper left', fontsize=8)
        ax.grid(True, alpha=0.3)

        # 添加超买超卖线
        ax.axhline(y=80, color='red', linestyle='--', linewidth=0.5, alpha=0.5)
        ax.axhline(y=20, color='green', linestyle='--', linewidth=0.5, alpha=0.5)

    def plot(self) -> Figure:
        """生成完整图表"""
        self._plot_kline_with_chanlun()
        self._plot_volume()
        self._plot_macd()
        self._plot_kdj()

        # 设置 x 轴格式
        for ax in self.axes:
            ax.tick_params(axis='x', rotation=30, labelsize=8)

        plt.tight_layout()

        return self.fig

    def save(self, filepath: str, dpi: int = 100):
        """保存图表到文件"""
        self.plot()
        self.fig.savefig(filepath, bbox_inches='tight', dpi=dpi, facecolor='white')

    def show(self):
        """显示图表"""
        self.plot()
        plt.show()

    def to_base64(self, format: str = 'png') -> str:
        """将图表转换为 base64 编码"""
        import io
        import base64

        buf = io.BytesIO()
        self.fig.savefig(buf, format=format, bbox_inches='tight', dpi=100, facecolor='white')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        buf.close()

        return f"data:image/{format};base64,{img_base64}"


def create_chanlun_chart(
    chan: CChan,
    kl_type: KL_TYPE = KL_TYPE.K_DAY,
    plot_config: Optional[Dict[str, bool]] = None,
    plot_para: Optional[Dict] = None,
) -> MplfinancePlotDriver:
    """
    创建缠论 K 线图表的便捷函数

    Args:
        chan: 缠论分析对象
        kl_type: K线类型
        plot_config: 绘图配置
        plot_para: 绘图参数

    Returns:
        MplfinancePlotDriver 实例
    """
    return MplfinancePlotDriver(chan, kl_type, plot_config, plot_para)
