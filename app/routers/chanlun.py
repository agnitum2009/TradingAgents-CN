"""
缠论分析 API 路由

提供缠论技术分析的 API 接口，包括：
- 笔 (Bi) 分析
- 线段 (Seg) 分析
- 中枢 (ZS) 分析
- 买卖点 (BSP) 分析
- K 线图表数据
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import sys
from pathlib import Path

# 添加 chanlun 模块到路径
chanlun_path = Path(__file__).parent.parent.parent / "chanlun"
if str(chanlun_path) not in sys.path:
    sys.path.insert(0, str(chanlun_path))

from Chan import CChan
from ChanConfig import CChanConfig
from Common.CEnum import AUTYPE, DATA_SRC, KL_TYPE

router = APIRouter()

# 缠论分析配置默认值
DEFAULT_CONFIG = {
    "bi_strict": True,  # 笔严格模式
    "zs_algo": "normal",  # 中枢算法
    "seg_algo": "chan",  # 线段算法
    "trigger_step": False,
    "skip_step": 0,
    "divergence_rate": 0.9,
    "bsp2_follow_1": False,
    "bsp3_follow_1": False,
    "min_zs_cnt": 1,
    "bs1_peak": True,
    "macd_algo": "peak",
    "bs_type": "1,1p,2,2s,3a,3b",
    "print_warning": False,
}


@router.get("/analysis/{stock_code}")
async def analyze_chanlun(
    stock_code: str,
    period: str = Query("day", description="K线周期: day, week, month"),
    days: int = Query(365, description="获取天数", ge=30, le=3650),
    data_source: str = Query("akshare", description="数据源: akshare, baostock")
):
    """
    缠论分析接口

    返回指定股票的缠论分析结果，包括：
    - K线数据
    - 笔列表
    - 线段列表
    - 中枢列表
    - 买卖点列表
    """
    try:
        # 映射周期参数
        period_map = {
            "day": KL_TYPE.K_DAY,
            "week": KL_TYPE.K_WEEK,
            "month": KL_TYPE.K_MON,
        }
        kl_type = period_map.get(period, KL_TYPE.K_DAY)

        # 映射数据源
        src_map = {
            "akshare": DATA_SRC.AKSHARE,
            "baostock": DATA_SRC.BAO_STOCK,
        }
        src = src_map.get(data_source, DATA_SRC.AKSHARE)

        # 计算时间范围
        end_time = datetime.now()
        begin_time = end_time - timedelta(days=days)

        # 创建配置
        config = CChanConfig(DEFAULT_CONFIG)

        # 创建缠论分析对象
        chan = CChan(
            code=stock_code,
            begin_time=begin_time.strftime("%Y-%m-%d"),
            end_time=end_time.strftime("%Y-%m-%d"),
            data_src=src,
            lv_list=[kl_type],
            config=config,
            autype=AUTYPE.QFQ,
        )

        # 提取分析结果
        result = _extract_chan_analysis(chan, kl_type)

        return {
            "success": True,
            "data": result
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"缠论分析失败: {str(e)}"
        )


@router.get("/kline/{stock_code}")
async def get_chanlun_kline(
    stock_code: str,
    period: str = Query("day", description="K线周期"),
    days: int = Query(365, description="获取天数"),
    data_source: str = Query("akshare", description="数据源")
):
    """
    获取缠论 K 线数据

    返回可用于前端绘图的 K 线数据，包括：
    - 基础 OHLCV 数据
    - 合并 K 线
    - 笔的起止点
    - 线段的起止点
    - 中枢区间
    """
    try:
        period_map = {
            "day": KL_TYPE.K_DAY,
            "week": KL_TYPE.K_WEEK,
            "month": KL_TYPE.K_MON,
        }
        kl_type = period_map.get(period, KL_TYPE.K_DAY)

        src_map = {
            "akshare": DATA_SRC.AKSHARE,
            "baostock": DATA_SRC.BAO_STOCK,
        }
        src = src_map.get(data_source, DATA_SRC.AKSHARE)

        end_time = datetime.now()
        begin_time = end_time - timedelta(days=days)

        config = CChanConfig(DEFAULT_CONFIG)

        chan = CChan(
            code=stock_code,
            begin_time=begin_time.strftime("%Y-%m-%d"),
            end_time=end_time.strftime("%Y-%m-%d"),
            data_src=src,
            lv_list=[kl_type],
            config=config,
            autype=AUTYPE.QFQ,
        )

        # 提取 K 线绘图数据
        kline_data = _extract_kline_plot_data(chan, kl_type)

        return {
            "success": True,
            "data": kline_data
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"获取 K 线数据失败: {str(e)}"
        )


@router.get("/bsp/{stock_code}")
async def get_buy_sell_points(
    stock_code: str,
    period: str = Query("day", description="K线周期"),
    days: int = Query(365, description="获取天数"),
    bsp_type: Optional[str] = Query(None, description="买卖点类型筛选，如: 1,2,3"),
    limit: int = Query(10, description="返回数量限制")
):
    """
    获取买卖点列表

    返回指定股票的买卖点信息，包括：
    - 买卖点类型（1类、2类、3类等）
    - 方向（买/卖）
    - 位置（K线索引、时间、价格）
    - 关联中枢信息
    """
    try:
        period_map = {
            "day": KL_TYPE.K_DAY,
            "week": KL_TYPE.K_WEEK,
            "month": KL_TYPE.K_MON,
        }
        kl_type = period_map.get(period, KL_TYPE.K_DAY)

        end_time = datetime.now()
        begin_time = end_time - timedelta(days=days)

        config = CChanConfig(DEFAULT_CONFIG)

        chan = CChan(
            code=stock_code,
            begin_time=begin_time.strftime("%Y-%m-%d"),
            end_time=end_time.strftime("%Y-%m-%d"),
            data_src=DATA_SRC.AKSHARE,
            lv_list=[kl_type],
            config=config,
            autype=AUTYPE.QFQ,
        )

        # 获取买卖点
        bsp_list = chan.get_latest_bsp(number=0)  # 获取所有买卖点

        # 筛选类型
        if bsp_type:
            bsp_list = [bsp for bsp in bsp_list if bsp_type in bsp.type2str()]

        # 限制数量
        bsp_list = bsp_list[:limit]

        # 转换为字典格式
        bsp_data = []
        for bsp in bsp_list:
            bsp_data.append({
                "type": bsp.type2str(),
                "is_buy": bsp.is_buy,
                "klu_idx": bsp.klu.idx,
                "time": str(bsp.klu.time),
                "price": bsp.klu.close,
                "combination": bsp.combine.tolist() if hasattr(bsp, 'combine') else [],
            })

        return {
            "success": True,
            "data": {
                "stock_code": stock_code,
                "period": period,
                "bsp_list": bsp_data,
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"获取买卖点失败: {str(e)}"
        )


def _extract_chan_analysis(chan: CChan, kl_type: KL_TYPE) -> Dict[str, Any]:
    """提取缠论分析结果"""
    kl_data = chan[kl_type]

    return {
        "stock_code": chan.code,
        "kl_type": str(kl_type),
        "kline_count": len(kl_data),
        "bi_list": _extract_bi_list(kl_data.bi_list),
        "seg_list": _extract_seg_list(kl_data.seg_list),
        "zs_list": _extract_zs_list(kl_data.zs_list),
        "bsp_list": _extract_bsp_list(kl_data.bs_point_lst.getSortedBspList()),
    }


def _extract_bi_list(bi_list) -> List[Dict]:
    """提取笔列表"""
    result = []
    for bi in bi_list:
        begin_klu = bi.get_begin_klu()
        end_klu = bi.get_end_klu()
        result.append({
            "idx": bi.idx,
            "direction": "up" if bi.is_up() else "down",
            "start_idx": begin_klu.idx,
            "end_idx": end_klu.idx,
            "start_price": float(bi.get_begin_val()),
            "end_price": float(bi.get_end_val()),
            "type": str(bi.type),
        })
    return result


def _extract_seg_list(seg_list) -> List[Dict]:
    """提取线段列表"""
    result = []
    for seg in seg_list:
        begin_klu = seg.get_begin_klu()
        end_klu = seg.get_end_klu() if seg.end_bi else None
        result.append({
            "idx": seg.idx,
            "direction": "up" if seg.is_up() else "down",
            "start_idx": begin_klu.idx,
            "end_idx": end_klu.idx if end_klu else None,
            "start_price": float(seg.get_begin_val()),
            "end_price": float(seg.get_end_val()) if seg.end_bi else None,
            "is_sure": seg.is_sure,
        })
    return result


def _extract_zs_list(zs_list) -> List[Dict]:
    """提取中枢列表"""
    result = []
    for zs in zs_list:
        begin_idx = zs.begin.idx if zs.begin else None
        end_idx = zs.end.idx if zs.end else None
        result.append({
            "idx": zs.idx,
            "start_idx": begin_idx,
            "end_idx": end_idx,
            "high": float(zs.high) if zs.high is not None else None,
            "low": float(zs.low) if zs.low is not None else None,
            "mid": float(zs.mid) if zs.mid is not None else None,
            "is_sure": zs.is_sure,
        })
    return result


def _extract_bsp_list(bsp_list) -> List[Dict]:
    """提取买卖点列表"""
    result = []
    for bsp in bsp_list:
        result.append({
            "type": bsp.type2str(),
            "is_buy": bsp.is_buy,
            "klu_idx": bsp.klu.idx,
            "time": str(bsp.klu.time),
            "price": bsp.klu.close,
        })
    return result


def _extract_kline_plot_data(chan: CChan, kl_type: KL_TYPE) -> Dict[str, Any]:
    """提取 K 线绘图数据"""
    kl_data = chan[kl_type]

    # 基础 K 线数据
    klines = []
    for klc in kl_data.lst:
        for klu in klc.lst:
            klines.append({
                "idx": klu.idx,
                "time": str(klu.time),
                "open": klu.open,
                "high": klu.high,
                "low": klu.low,
                "close": klu.close,
                "volume": klu.trade_info.metric.get("volume"),
                "turnover": klu.trade_info.metric.get("turnover"),
                "turnover_rate": klu.trade_info.metric.get("turnover_rate"),
            })

    # 笔数据
    bi_lines = []
    for bi in kl_data.bi_list:
        begin_klu = bi.get_begin_klu()
        end_klu = bi.get_end_klu()
        bi_lines.append({
            "start_idx": begin_klu.idx,
            "end_idx": end_klu.idx,
            "start_price": float(bi.get_begin_val()),
            "end_price": float(bi.get_end_val()),
            "is_up": bool(bi.is_up()),
        })

    # 线段数据
    seg_lines = []
    for seg in kl_data.seg_list:
        if seg.is_sure:
            begin_klu = seg.get_begin_klu()
            end_klu = seg.get_end_klu() if seg.end_bi else None
            seg_lines.append({
                "start_idx": begin_klu.idx,
                "end_idx": end_klu.idx if end_klu else None,
                "start_price": float(seg.get_begin_val()) if seg.end_bi else None,
                "end_price": float(seg.get_end_val()) if seg.end_bi else None,
                "is_up": bool(seg.is_up()),
            })

    # 中枢数据
    zs_boxes = []
    for zs in kl_data.zs_list:
        begin_idx = zs.begin.idx if zs.begin else None
        end_idx = zs.end.idx if zs.end else None
        zs_boxes.append({
            "start_idx": begin_idx,
            "end_idx": end_idx,
            "high": float(zs.high) if zs.high is not None else None,
            "low": float(zs.low) if zs.low is not None else None,
        })

    return {
        "stock_code": chan.code,
        "klines": klines,
        "bi_lines": bi_lines,
        "seg_lines": seg_lines,
        "zs_boxes": zs_boxes,
    }


@router.get("/chart/{stock_code}")
async def get_chanlun_chart(
    stock_code: str,
    period: str = Query("day", description="K线周期"),
    days: int = Query(365, description="获取天数"),
    data_source: str = Query("akshare", description="数据源"),
    width: int = Query(24, description="图表宽度（英寸）"),
    height: int = Query(10, description="图表高度（英寸）"),
):
    """
    获取缠论 matplotlib 图表（base64 编码）【已弃用，推荐使用 /chart-mplfinance】

    使用 chan.py 内置的 CPlotDriver 生成图表，返回 base64 编码的 PNG 图片数据，
    可直接在 HTML <img> 标签中显示。

    注意：此接口为旧版本，推荐使用 /chart-mplfinance 接口获得更好的图表效果。
    """
    import io
    import base64
    import matplotlib
    matplotlib.use('Agg')  # 使用非交互式后端
    import matplotlib.pyplot as plt

    from Plot.PlotDriver import CPlotDriver

    try:
        period_map = {
            "day": KL_TYPE.K_DAY,
            "week": KL_TYPE.K_WEEK,
            "month": KL_TYPE.K_MON,
        }
        kl_type = period_map.get(period, KL_TYPE.K_DAY)

        src_map = {
            "akshare": DATA_SRC.AKSHARE,
            "baostock": DATA_SRC.BAO_STOCK,
        }
        src = src_map.get(data_source, DATA_SRC.AKSHARE)

        end_time = datetime.now()
        begin_time = end_time - timedelta(days=days)

        config = CChanConfig(DEFAULT_CONFIG)

        chan = CChan(
            code=stock_code,
            begin_time=begin_time.strftime("%Y-%m-%d"),
            end_time=end_time.strftime("%Y-%m-%d"),
            data_src=src,
            lv_list=[kl_type],
            config=config,
            autype=AUTYPE.QFQ,
        )

        # 绘图配置
        plot_config = {
            "plot_kline": True,
            "plot_bi": True,
            "plot_seg": True,
            "plot_zs": True,
            "plot_bsp": True,
        }

        # 绘图参数
        plot_para = {
            "figure": {
                "w": width,
                "h": height,
                "x_range": 120,  # 只显示最后120根K线
            },
            "bi": {
                "show_num": False,
                "disp_end": True,
            },
            "seg": {
                "width": 3,
            },
        }

        # 使用内置绘图驱动器
        plot_driver = CPlotDriver(
            chan,
            plot_config=plot_config,
            plot_para=plot_para,
        )

        # 将图表保存到内存缓冲区
        buf = io.BytesIO()
        plot_driver.figure.savefig(buf, format='png', bbox_inches='tight', dpi=100)
        buf.seek(0)

        # 转换为 base64
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        buf.close()

        # 关闭图表释放内存
        plt.close(plot_driver.figure)

        return {
            "success": True,
            "data": {
                "stock_code": stock_code,
                "period": period,
                "image_base64": f"data:image/png;base64,{img_base64}",
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        plt.close('all')  # 确保关闭所有图表
        raise HTTPException(
            status_code=500,
            detail=f"生成图表失败: {str(e)}"
        )


@router.get("/chart-mplfinance/{stock_code}")
async def get_chanlun_chart_mplfinance(
    stock_code: str,
    period: str = Query("day", description="K线周期: day, week, month"),
    days: int = Query(365, description="获取天数", ge=30, le=3650),
    data_source: str = Query("akshare", description="数据源: akshare, baostock"),
    width: int = Query(20, description="图表宽度（英寸）", ge=10, le=50),
    height: int = Query(12, description="图表高度（英寸）", ge=6, le=30),
    plot_bi: bool = Query(True, description="绘制笔"),
    plot_seg: bool = Query(True, description="绘制线段"),
    plot_zs: bool = Query(True, description="绘制中枢"),
    plot_bsp: bool = Query(True, description="绘制买卖点"),
    plot_ma: bool = Query(True, description="绘制移动平均线"),
    plot_macd: bool = Query(False, description="绘制 MACD 指标"),
    plot_kdj: bool = Query(False, description="绘制 KDJ 指标"),
):
    """
    获取缠论专业 K 线图表（基于 mplfinance）

    使用 mplfinance 库生成专业金融图表，返回 base64 编码的 PNG 图片数据。

    功能特性：
    - 专业的 K 线蜡烛图（红涨绿跌）
    - 成交量柱状图
    - 移动平均线（MA5、MA10、MA20、MA60）
    - 缠论笔、线段、中枢可视化
    - 买卖点标记
    - 可选 MACD、KDJ 技术指标

    替换 chan.py 原有的落后绘图功能。
    """
    import matplotlib
    matplotlib.use('Agg')  # 使用非交互式后端
    import matplotlib.pyplot as plt

    from Plot.MplfinancePlotDriver import MplfinancePlotDriver

    try:
        # 映射周期参数
        period_map = {
            "day": KL_TYPE.K_DAY,
            "week": KL_TYPE.K_WEEK,
            "month": KL_TYPE.K_MON,
        }
        kl_type = period_map.get(period, KL_TYPE.K_DAY)

        # 映射数据源
        src_map = {
            "akshare": DATA_SRC.AKSHARE,
            "baostock": DATA_SRC.BAO_STOCK,
        }
        src = src_map.get(data_source, DATA_SRC.AKSHARE)

        # 计算时间范围
        end_time = datetime.now()
        begin_time = end_time - timedelta(days=days)

        # 创建缠论配置
        config = CChanConfig(DEFAULT_CONFIG)

        # 创建缠论分析对象
        chan = CChan(
            code=stock_code,
            begin_time=begin_time.strftime("%Y-%m-%d"),
            end_time=end_time.strftime("%Y-%m-%d"),
            data_src=src,
            lv_list=[kl_type],
            config=config,
            autype=AUTYPE.QFQ,
        )

        # 绘图配置
        plot_config = {
            'plot_kline': True,
            'plot_volume': True,
            'plot_bi': plot_bi,
            'plot_seg': plot_seg,
            'plot_zs': plot_zs,
            'plot_bsp': plot_bsp,
            'plot_ma': plot_ma,
            'plot_macd': plot_macd,
            'plot_kdj': plot_kdj,
        }

        # 绘图参数
        plot_para = {
            'figure': {
                'w': width,
                'h': height,
            },
            'ma_periods': [5, 10, 20, 60],
        }

        # 使用 mplfinance 绘图驱动器
        plot_driver = MplfinancePlotDriver(
            chan,
            kl_type=kl_type,
            plot_config=plot_config,
            plot_para=plot_para,
        )

        # 生成图表并转换为 base64
        img_base64 = plot_driver.to_base64(format='png')

        # 关闭图表释放内存
        plt.close(plot_driver.fig)

        return {
            "success": True,
            "data": {
                "stock_code": stock_code,
                "period": period,
                "image_base64": img_base64,
                "plot_config": plot_config,
                "chart_engine": "mplfinance (enhanced)",
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        plt.close('all')  # 确保关闭所有图表
        raise HTTPException(
            status_code=500,
            detail=f"生成图表失败: {str(e)}"
        )


@router.get("/plot/{stock_code}")
async def get_chanlun_plot(
    stock_code: str,
    period: str = Query("day", description="K线周期"),
    days: int = Query(365, description="获取天数"),
    data_source: str = Query("akshare", description="数据源"),
    x_range: int = Query(120, description="显示最后N根K线", ge=30, le=500),
):
    """
    获取缠论绘图元素数据（用于动态交互式图表）

    使用 chan.py 的 CChanPlotMeta 提取绘图元数据，返回：
    - K线数据（OHLCV）
    - 笔的坐标列表 (begin_x, end_x, begin_y, end_y)
    - 线段的坐标列表
    - 中枢的矩形区域 (begin, end, low, high)
    - 买卖点标记
    """
    try:
        period_map = {
            "day": KL_TYPE.K_DAY,
            "week": KL_TYPE.K_WEEK,
            "month": KL_TYPE.K_MON,
        }
        kl_type = period_map.get(period, KL_TYPE.K_DAY)

        src_map = {
            "akshare": DATA_SRC.AKSHARE,
            "baostock": DATA_SRC.BAO_STOCK,
        }
        src = src_map.get(data_source, DATA_SRC.AKSHARE)

        end_time = datetime.now()
        begin_time = end_time - timedelta(days=days)

        config = CChanConfig(DEFAULT_CONFIG)

        chan = CChan(
            code=stock_code,
            begin_time=begin_time.strftime("%Y-%m-%d"),
            end_time=end_time.strftime("%Y-%m-%d"),
            data_src=src,
            lv_list=[kl_type],
            config=config,
            autype=AUTYPE.QFQ,
        )

        # 提取完整的绘图数据
        plot_data = _extract_plot_elements(chan, kl_type, x_range)

        return {
            "success": True,
            "data": plot_data
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"获取绘图数据失败: {str(e)}"
        )


def _extract_plot_elements(chan: CChan, kl_type: KL_TYPE, x_range: int) -> Dict[str, Any]:
    """使用 chan.py 的 CChanPlotMeta 提取绘图元数据"""
    from Plot.PlotMeta import CChanPlotMeta, CBi_meta, CSeg_meta, CZS_meta, CBS_Point_meta

    # 使用 chan.py 的绘图元数据类提取数据
    plot_meta = CChanPlotMeta(chan[kl_type])

    # 计算显示范围
    klu_len = plot_meta.klu_len
    start_idx = max(0, klu_len - x_range)

    # 提取K线数据
    klines = []
    for klc in plot_meta.klc_list:
        for klu in klc.klu_list:
            klines.append({
                "idx": klu.idx,
                "time": str(klu.time),
                "open": float(klu.open),
                "high": float(klu.high),
                "low": float(klu.low),
                "close": float(klu.close),
            })

    # 提取笔数据 - 使用 CBi_meta 的结构
    bi_lines = []
    for bi_meta in plot_meta.bi_list:
        bi_lines.append({
            "begin_x": bi_meta.begin_x,
            "end_x": bi_meta.end_x,
            "begin_y": float(bi_meta.begin_y),
            "end_y": float(bi_meta.end_y),
            "is_sure": bi_meta.is_sure,
        })

    # 提取线段数据 - 使用 CSeg_meta 的结构
    seg_lines = []
    for seg_meta in plot_meta.seg_list:
        seg_lines.append({
            "begin_x": seg_meta.begin_x,
            "end_x": seg_meta.end_x,
            "begin_y": float(seg_meta.begin_y),
            "end_y": float(seg_meta.end_y),
            "is_sure": seg_meta.is_sure,
        })

    # 提取中枢数据 - 使用 CZS_meta 的结构
    zs_boxes = []
    for zs_meta in plot_meta.zs_lst:
        zs_boxes.append({
            "begin": zs_meta.begin,
            "end": zs_meta.end,
            "low": float(zs_meta.low),
            "high": float(zs_meta.high),
            "width": zs_meta.w,
            "height": zs_meta.h,
            "is_sure": zs_meta.is_sure,
        })

    # 提取买卖点数据 - 使用 CBS_Point_meta 的结构
    bsp_list = []
    for bsp_meta in plot_meta.bs_point_lst:
        bsp_list.append({
            "x": bsp_meta.x,
            "y": float(bsp_meta.y),
            "is_buy": bsp_meta.is_buy,
            "type": bsp_meta.type,
            "type_str": bsp_meta.desc(),
        })

    return {
        "stock_code": chan.code,
        "period": str(kl_type),
        "x_range": x_range,
        "display_start_idx": start_idx,
        "datetick": plot_meta.datetick,  # 原始时间轴数据
        "klines": klines,
        "bi_lines": bi_lines,
        "seg_lines": seg_lines,
        "zs_boxes": zs_boxes,
        "bsp_list": bsp_list,
        "statistics": {
            "kline_count": len(klines),
            "bi_count": len(bi_lines),
            "seg_count": len(seg_lines),
            "zs_count": len(zs_boxes),
            "bsp_count": len(bsp_list),
        }
    }
