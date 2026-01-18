# YYKline 集成方案 - 项目移交文档 v1.0.7

> **会话日期**: 2026-01-17
> **版本**: v1.0.7
> **移交状态**: 待集成 ⏳

---

## 📋 项目概述

### YYKline 项目简介

**项目地址**: https://github.com/WillkKang/YYKline

**项目定位**:
- Python 专业金融图表库
- 基于 PyQt5/PySide6 构建
- 支持丰富的金融图表组件
- 高性能、轻量级

---

## 📦 YYKline 代码结构

```
YYKline/
├── yykline/                    # 主包
│   ├── __init__.py
│   └── widgets/                 # 图表组件
│       ├── __init__.py
│       ├── klinewidget.py     # K线图组件
│       ├── macdwidget.py      # MACD 组件
│       ├── kdjwidget.py       # KDJ 组件
│       ├── volumewidget.py    # 成交量组件
│       ├── crosshaircursor.py # 十字光标
│       └── ...
├── examples/                   # 示例代码
└── docs/                      # 文档
```

### 核心功能组件

| 组件 | 功能说明 |
|------|---------|
| **KlineWidget** | 专业 K线蜡烛图 |
| **MACDWidget** | MACD 指标柱状图 |
| **KDJWidget** | KDJ 指标三条线图 |
| **VolumeWidget** | 成交量柱状图 |
| **CrosshairCursor** | 交互式十字光标 |
| **FigureWidget** | 多窗口图表容器 |
| **ChartGrid** | 图表网格系统 |

---

## 🎯 集成目标

### 目标 1: 集成 YYKline 到 chanlun 模块

```
chanlun/
├── YYKline/                 # 新增：YYKline 图表库
│   ├── __init__.py
│   ├── widgets/
│   └── adapters/             # 适配器
├── Chan.py                 # 修改：使用 YYKline 绘图
└── Plot/
    ├── YYKlinePlotDriver.py  # 新增：YYKline 绘图驱动器
    └── AnimatePlotDriver.py # 修改：YYKline 动画
```

### 目标 2: 创建 YYKline 绘图 API

```
app/routers/chanlun.py
├── /api/chanlun/yykline/{code}  # 新端点
├── /api/chanlun/matplotlib/{code}  # matplotlib 图表
└── /api/chanlun/plot/{code}       # 原有端点
```

### 目标 3: 前端图表页面

```
frontend/public/
├── chanlun-yykline.html       # YYKline 交互图表
├── chanlun-matplotlib.html    # matplotlib 静态图表
└── chanlun-dynamic.html       # ECharts 动态图表
```

---

## 📝 集成步骤

### 第一步：下载并本地化 YYKline

由于网络限制，需要手动下载：

1. 访问 https://github.com/WillkYang/YYKline
2. 下载 ZIP 文件
3. 解压到 `chanlun/YYKline/` 目录
4. 复制关键文件和代码

### 第二步：修改 chan.py 使用 YYKline 绘图

**当前代码**:
```python
from Plot.PlotDriver import CPlotDriver
plot_driver = CPlotDriver(chan, plot_config, plot_para)
plot_driver.figure.show()
```

**修改后**:
```python
from Plot.YYKlinePlotDriver import CYYKlinePlotDriver
plot_driver = CYYKlinePlotDriver(chan, plot_config, plot_para)
plot_driver.show()  # YYKline 交互式窗口
```

### 第三步：创建 YYKline API 端点

```python
@router.get("/yykline/{stock_code}")
async def get_yykline_chart(
    stock_code: str,
    period: str = Query("day"),
    days: int = Query(365),
    width: int = 1200,
    height: int = 600
):
    """使用 YYKline 生成交互式图表"""
    # TODO: 创建 YYKline 交互式图表
```

---

## 🔧 当前版本状态

### 已有功能

| 功能 | 状态 | 说明 |
|------|------|------|
| chan.py 模块 | ✅ 已集成 | 完整的缠论计算框架 |
| CPlotDriver | ✅ 可用 | matplotlib 静态图表 |
| AnimatePlotDriver | ✅ 可用 | matplotlib 动画 |
| 后端 API | ✅ 部分完成 | 3个端点可用 |
| matplotlib 图表 | ✅ 已完成 | `/api/chanlun/chart/{code}` |
| 前端测试页面 | ✅ 已创建 | 3 个测试页面 |

---

## 📊 YYKline 核心组件说明

### 1. K线图表组件 (KlineWidget)

**功能**:
- 专业蜡烛图绘制
- 支持 OHLCV 数据
- 自动处理涨跌颜色
- 支持多种图表样式

**伪代码示例**:
```python
from yykline.widgets import KlineWidget
from chanlun.Chan import CChan
from chanlun.Plot.YYKlinePlotDriver import CYYKlinePlotDriver

chan = CChan(code="000001", ...)
plot_driver = CYYKlinePlotDriver(chan)
plot_driver.add_widget(KlineWidget(
    kline_data=chan.klines,  # OHLCV 数据
    style='candlestick',    # 蜡烛图样式
    color_up='red',      # 上涨颜色
    color_down='green'     # 下跌颜色
))
```

### 2. MACD 指标组件 (MACDWidget)

**功能**:
- DIF/DEA 双线图
- MACD 柱状图
- 支持多种算法
- 自动缩放

### 3. 成交量组件 (VolumeWidget)

**功能**:
- 柱状图显示
- 支持填充颜色
- 对齐 K线

### 4. 十字光标 (CrosshairCursor)

**功能**:
- 鼠标跟踪
- 显示数值标签
- 跨窗口联动

---

## 📦 待完成工作

### 优先级 P0 ⚠️

1. **下载 YYKline 源码**
   - 手动下载 ZIP 包
   - 解压到 `chanlun/YYKline/`
   - 验证完整性

2. **测试 YYKline 基础功能**
   - 运行示例代码
   - 验证导入成功

### 优先级 P1

3. **创建 CYYKlinePlotDriver**
   - 继承 PlotDriver 接口
   - 使用 YYKline 组件

4. **创建 YYKline API 端点**
   - 生成 PNG 图片
   - 生成 HTML 交互图表

### 优先级 P2

5. **前端集成 YYKline**
   - WebSocket 实时推送
   - 交互式控制面板
   - 图表导出功能

---

## 📚 参考资料

| 文档 | 链接 |
|------|------|
| YYKline 主页 | https://github.com/WillkYang/YYKline |
| YYKline 文档 | https://yykline.readthedocs.io/ |
| YYKline 示例 | https://github.com/YYKline/yykline/tree/main/examples |
| YYKline Wiki | https://github.com/YYKline/yykline/wiki |

---

## 🚀 下一步行动

1. **手动下载**: 下载 YYKline ZIP 包
2. **解压集成**: 解压到 `chanlun/YYKline/`
3. **测试基础功能**: 运行示例代码
4. **创建适配器**: 创建 YYKline 适配层
5. **测试绘图**: 使用示例数据测试图表
6. **编写文档**: 完善集成文档

---

**版本**: v1.0.7 (YYKline 集成准备版本)

**状态**: ⏳ 待下载 YYKline 源码

**会话完成**: 已完成前期调研和架构设计
