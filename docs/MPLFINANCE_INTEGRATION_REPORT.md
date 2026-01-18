# TradingAgents-CN v1.0.6 - mplfinance 绘图增强

**文档版本**: v1.0.6
**创建日期**: 2026-01-17
**项目**: TradingAgents-CN 缠论绘图增强

---

## 快速导航

| 章节 | 说明 |
|------|------|
| [变更概述](#变更概述) | 本次更新的核心内容 |
| [技术架构](#技术架构) | 系统架构说明 |
| [新增功能](#新增功能) | 新增的 API 和模块 |
| [使用指南](#使用指南) | 如何使用新功能 |
| [文件清单](#文件清单) | 修改和新增的文件 |

---

## 变更概述

### 版本信息

| 属性 | 值 |
|------|-----|
| **版本号** | v1.0.6 |
| **版本类型** | 功能增强版本 |
| **发布日期** | 2026-01-17 |
| **上一个版本** | v1.0.5 (缠论技术分析集成版本) |

### 核心变更

**问题**: chanlun 模块自带的绘图功能（PlotDriver.py）基于 matplotlib，样式陈旧，缺乏专业金融图表特性。

**解决方案**: 集成 **mplfinance** 专业金融图表库，创建增强版绘图驱动器。

---

## 技术架构

### 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户接口层                              │
├─────────────────────────────────────────────────────────────────┤
│  Vue3 前端 │ Streamlit │ CLI │ REST API                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      应用层 (FastAPI)                           │
├─────────────────────────────────────────────────────────────────┤
│  /api/chanlun/analysis/{code}    # 缠论分析                    │
│  /api/chanlun/kline/{code}       # K线数据                     │
│  /api/chanlun/bsp/{code}         # 买卖点                      │
│  /api/chanlun/chart-mplfinance/{code}  # ⭐ 新增专业图表       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    缠论分析层 (chanlun)                         │
├─────────────────────────────────────────────────────────────────┤
│  Chan.py │ ChanConfig.py │ KLine │ Bi │ Seg │ ZS │ BuySellPoint │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      绘图层 (Plot)                              │
├─────────────────────────────────────────────────────────────────┤
│  PlotDriver.py           # 原始绘图驱动器（保留）               │
│  PlotMeta.py             # 绘图元数据                           │
│  MplfinancePlotDriver.py # ⭐ 新增：mplfinance 增强驱动器       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   图表渲染 (mplfinance)                          │
├─────────────────────────────────────────────────────────────────┤
│  K线蜡烛图 │ 成交量 │ MA均线 │ MACD │ KDJ │ 缠论叠加           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 新增功能

### 1. MplfinancePlotDriver 模块

**文件**: `chanlun/Plot/MplfinancePlotDriver.py`

**核心类**:
```python
class MplfinancePlotDriver:
    """基于 mplfinance 的 K 线图表绘制驱动器"""

    def __init__(self, chan: CChan, kl_type: KL_TYPE, plot_config, plot_para)
    def plot(self) -> Figure
    def save(self, filepath: str, dpi: int = 100)
    def show(self)
    def to_base64(self, format: str = 'png') -> str
```

**绘图方法**:
| 方法 | 功能 |
|------|------|
| `_plot_kline_with_chanlun()` | 绘制 K 线和缠论元素 |
| `_plot_bi()` | 绘制缠论笔 |
| `_plot_seg()` | 绘制缠论线段 |
| `_plot_zs()` | 绘制缠论中枢 |
| `_plot_bsp()` | 绘制买卖点 |
| `_plot_ma_lines()` | 绘制移动平均线 |
| `_plot_macd()` | 绘制 MACD 指标 |
| `_plot_kdj()` | 绘制 KDJ 指标 |
| `_plot_volume()` | 绘制成交量 |

### 2. 新增 API 端点

**端点**: `GET /api/chanlun/chart-mplfinance/{stock_code}`

**请求参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| period | string | "day" | K线周期: day/week/month |
| days | int | 365 | 获取天数 |
| data_source | string | "akshare" | 数据源 |
| width | int | 20 | 图表宽度（英寸） |
| height | int | 12 | 图表高度（英寸） |
| plot_bi | bool | true | 绘制笔 |
| plot_seg | bool | true | 绘制线段 |
| plot_zs | bool | true | 绘制中枢 |
| plot_bsp | bool | true | 绘制买卖点 |
| plot_ma | bool | true | 绘制移动平均线 |
| plot_macd | bool | false | 绘制 MACD |
| plot_kdj | bool | false | 绘制 KDJ |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "stock_code": "sz000001",
    "period": "day",
    "image_base64": "data:image/png;base64,iVBORw0KGg...",
    "plot_config": { ... },
    "chart_engine": "mplfinance (enhanced)"
  }
}
```

### 3. 中式 K 线配色

**颜色方案**:
| 元素 | 颜色 | 说明 |
|------|------|------|
| 上涨 | #ff4d4f | 红色 |
| 下跌 | #26c6da | 绿色 |
| 向上笔 | #d32f2f | 深红色 |
| 向下笔 | #388e3c | 深绿色 |
| 中枢 | #ffd43b | 黄色半透明 |
| 买点 | #1971c2 | 蓝色 |
| 卖点 | #e03131 | 红色 |

---

## 使用指南

### API 调用示例

```python
import requests

# 获取专业缠论图表
response = requests.get(
    "http://localhost:8000/api/chanlun/chart-mplfinance/000001",
    params={
        "period": "day",
        "days": 365,
        "plot_bi": True,
        "plot_seg": True,
        "plot_macd": True,
    }
)

data = response.json()
if data["success"]:
    # data["data"]["image_base64"] 可直接在 <img> 标签中使用
    image_base64 = data["data"]["image_base64"]
```

### Python 代码示例

```python
from chanlun.Chan import CChan
from chanlun.ChanConfig import CChanConfig
from chanlun.Common.CEnum import AUTYPE, DATA_SRC, KL_TYPE
from chanlun.Plot.MplfinancePlotDriver import MplfinancePlotDriver

# 创建缠论分析对象
config = CChanConfig({
    "bi_strict": True,
    "zs_algo": "normal",
})

chan = CChan(
    code="000001",
    begin_time="2023-01-01",
    end_time="2024-01-01",
    data_src=DATA_SRC.AKSHARE,
    lv_list=[KL_TYPE.K_DAY],
    config=config,
    autype=AUTYPE.QFQ,
)

# 创建增强图表
plot_driver = MplfinancePlotDriver(
    chan,
    kl_type=KL_TYPE.K_DAY,
    plot_config={
        'plot_kline': True,
        'plot_bi': True,
        'plot_seg': True,
        'plot_zs': True,
        'plot_bsp': True,
        'plot_ma': True,
        'plot_macd': True,
    },
)

# 保存图表
plot_driver.save('chanlun_chart.png')
```

---

## 文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `chanlun/Plot/MplfinancePlotDriver.py` | mplfinance 增强绘图驱动器 |
| `docs/MPLFINANCE_INTEGRATION_REPORT.md` | 本文档 |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `app/routers/chanlun.py` | 新增 `/chart-mplfinance/{code}` 端点 |
| `pyproject.toml` | 添加 `mplfinance>=0.12.11` 依赖 |

### 保留文件

| 文件 | 说明 |
|------|------|
| `chanlun/Plot/PlotDriver.py` | 原始绘图驱动器（保留向后兼容） |
| `chanlun/Plot/PlotMeta.py` | 绘图元数据（两种驱动器共用） |
| `chanlun/Plot/AnimatePlotDriver.py` | 动画绘图驱动器 |

---

## 依赖更新

### 新增依赖

```toml
# pyproject.toml
"mplfinance>=0.12.11",  # 专业K线图表绘制库
```

### 安装方式

```bash
# 安装项目依赖（包含新增的 mplfinance）
pip install -e .

# 或单独安装
pip install mplfinance>=0.12.11
```

---

## 功能对比

### PlotDriver vs MplfinancePlotDriver

| 特性 | PlotDriver (原版) | MplfinancePlotDriver (增强版) |
|------|-------------------|-------------------------------|
| K 线蜡烛图 | ✅ | ✅ 专业样式 |
| 成交量 | ❌ | ✅ |
| 移动平均线 | ❌ | ✅ MA5/10/20/60 |
| MACD 指标 | ❌ | ✅ |
| KDJ 指标 | ❌ | ✅ |
| 中式配色 | ❌ | ✅ 红涨绿跌 |
| 缠论笔/线段/中枢 | ✅ | ✅ |
| 买卖点标记 | ✅ | ✅ |
| 交互功能 | ❌ | ✅ 滚动缩放 |
| 导出图片 | ✅ | ✅ |

---

## 后续建议

### 高优先级

1. **前端集成** - 在股票详情页集成新图表 API
2. **性能优化** - 添加图表缓存机制
3. **配置面板** - 前端可视化配置绘图选项

### 中优先级

1. **分时图** - 添加日内分时图支持
2. **更多指标** - RSI、BOLL、ATR 等
3. **图表模板** - 预设多种图表样式

### 低优先级

1. **导出功能** - 支持导出为 PDF/SVG
2. **图表对比** - 多股票图表对比
3. **历史回放** - 缠论演变历史回放

---

## 版本信息

- **当前版本**: v1.0.6 (mplfinance 绘图增强版本)
- **版本类型**: 功能增强版本
- **发布日期**: 2026-01-17
- **上一个版本**: v1.0.5（缠论技术分析集成版本）
- **下一个版本**: v1.0.7（计划中）

---

**移交状态**: ✅ 就绪

**会话完成**:
- ✅ 清理 YYKline 相关引用
- ✅ 创建 MplfinancePlotDriver 模块
- ✅ 新增 /chart-mplfinance API 端点
- ✅ 更新 pyproject.toml 依赖
- ✅ 创建项目转交文档
