use pyo3::prelude::*;
use pyo3::types::PyDict;
use std::collections::HashMap;

/// 财务数据输入结构
#[derive(Debug, Clone, FromPyObject)]
pub struct FinancialData {
    pub price: Option<f64>,
    pub eps: Option<f64>,  // 每股收益
    pub bps: Option<f64>,  // 每股净资产
    pub revenue: Option<f64>,  // 营业收入
    pub net_income: Option<f64>,  // 净利润
    pub total_assets: Option<f64>,  // 总资产
    pub total_equity: Option<f64>,  // 股东权益
    pub total_debt: Option<f64>,  // 总负债
    pub cogs: Option<f64>,  // 营业成本
    pub operating_cash_flow: Option<f64>,  // 经营现金流
    pub market_cap: Option<f64>,  // 市值
}

/// 财务指标输出结构
#[derive(Debug, Clone)]
pub struct FinancialMetrics {
    pub pe_ratio: Option<f64>,  // 市盈率
    pub pb_ratio: Option<f64>,  // 市净率
    pub roe: Option<f64>,  // 净资产收益率 (%)
    pub roa: Option<f64>,  // 总资产收益率 (%)
    pub debt_ratio: Option<f64>,  // 资产负债率 (%)
    pub gross_margin: Option<f64>,  // 毛利率 (%)
    pub net_margin: Option<f64>,  // 净利率 (%)
    pub asset_turnover: Option<f64>,  // 总资产周转率
    pub equity_multiplier: Option<f64>,  // 权益乘数
    pub current_ratio: Option<f64>,  // 流动比率
    pub quick_ratio: Option<f64>,  // 速动比率
    pub operating_cash_flow_ratio: Option<f64>,  // 现金流比率
}

impl FinancialMetrics {
    pub fn new() -> Self {
        FinancialMetrics {
            pe_ratio: None,
            pb_ratio: None,
            roe: None,
            roa: None,
            debt_ratio: None,
            gross_margin: None,
            net_margin: None,
            asset_turnover: None,
            equity_multiplier: None,
            current_ratio: None,
            quick_ratio: None,
            operating_cash_flow_ratio: None,
        }
    }
}

/// 计算单个股票的财务指标
pub fn calculate_metrics(data: &FinancialData) -> FinancialMetrics {
    let mut metrics = FinancialMetrics::new();

    // PE = Price / EPS (市盈率)
    if let (Some(price), Some(eps)) = (data.price, data.eps) {
        if eps > 0.0 {
            metrics.pe_ratio = Some(price / eps);
        }
    }

    // PB = Price / BPS (市净率)
    if let (Some(price), Some(bps)) = (data.price, data.bps) {
        if bps > 0.0 {
            metrics.pb_ratio = Some(price / bps);
        }
    }

    // ROE = Net Income / Total Equity (净资产收益率, %)
    if let (Some(net_income), Some(total_equity)) = (data.net_income, data.total_equity) {
        if total_equity > 0.0 {
            metrics.roe = Some((net_income / total_equity) * 100.0);
        }
    }

    // ROA = Net Income / Total Assets (总资产收益率, %)
    if let (Some(net_income), Some(total_assets)) = (data.net_income, data.total_assets) {
        if total_assets > 0.0 {
            metrics.roa = Some((net_income / total_assets) * 100.0);
        }
    }

    // Debt Ratio = Total Debt / Total Assets (资产负债率, %)
    if let (Some(total_debt), Some(total_assets)) = (data.total_debt, data.total_assets) {
        if total_assets > 0.0 {
            metrics.debt_ratio = Some((total_debt / total_assets) * 100.0);
        }
    }

    // Gross Margin = (Revenue - COGS) / Revenue (毛利率, %)
    if let (Some(revenue), Some(cogs)) = (data.revenue, data.cogs) {
        if revenue > 0.0 {
            metrics.gross_margin = Some(((revenue - cogs) / revenue) * 100.0);
        }
    }

    // Net Margin = Net Income / Revenue (净利率, %)
    if let (Some(net_income), Some(revenue)) = (data.net_income, data.revenue) {
        if revenue > 0.0 {
            metrics.net_margin = Some((net_income / revenue) * 100.0);
        }
    }

    // Asset Turnover = Revenue / Total Assets (总资产周转率)
    if let (Some(revenue), Some(total_assets)) = (data.revenue, data.total_assets) {
        if total_assets > 0.0 {
            metrics.asset_turnover = Some(revenue / total_assets);
        }
    }

    // Equity Multiplier = Total Assets / Total Equity (权益乘数)
    if let (Some(total_assets), Some(total_equity)) = (data.total_assets, data.total_equity) {
        if total_equity > 0.0 {
            metrics.equity_multiplier = Some(total_assets / total_equity);
        }
    }

    // Current Ratio = Current Assets / Current Liabilities (流动比率)
    // 这里用总资产和总债务作为近似
    if let (Some(total_assets), Some(total_debt)) = (data.total_assets, data.total_debt) {
        if total_debt > 0.0 {
            metrics.current_ratio = Some(total_assets / total_debt);
        }
    }

    // Operating Cash Flow Ratio = Operating Cash Flow / Total Debt (现金流比率)
    if let (Some(ocf), Some(total_debt)) = (data.operating_cash_flow, data.total_debt) {
        if total_debt > 0.0 {
            metrics.operating_cash_flow_ratio = Some(ocf / total_debt);
        }
    }

    metrics
}

/// Python 模块定义
#[pymodule]
fn tacn_financial(m: &Bound<'_, PyModule>) -> PyResult<()> {
    // 注册辅助函数
    m.add_function(wrap_pyfunction!(calculate_financial_metrics_wrapper, m)?)?;
    m.add_function(wrap_pyfunction!(batch_calculate_pe_pb, m)?)?;
    m.add_function(wrap_pyfunction!(batch_calculate_metrics_from_dicts, m)?)?;

    Ok(())
}

/// 计算单个股票的财务指标 (Python 包装器)
#[pyfunction]
#[pyo3(signature = (
    price=None,
    eps=None,
    bps=None,
    revenue=None,
    net_income=None,
    total_assets=None,
    total_equity=None,
    total_debt=None,
    cogs=None,
    operating_cash_flow=None,
    market_cap=None
))]
fn calculate_financial_metrics_wrapper(
    price: Option<f64>,
    eps: Option<f64>,
    bps: Option<f64>,
    revenue: Option<f64>,
    net_income: Option<f64>,
    total_assets: Option<f64>,
    total_equity: Option<f64>,
    total_debt: Option<f64>,
    cogs: Option<f64>,
    operating_cash_flow: Option<f64>,
    market_cap: Option<f64>,
) -> PyResult<HashMap<String, Option<f64>>> {
    let data = FinancialData {
        price,
        eps,
        bps,
        revenue,
        net_income,
        total_assets,
        total_equity,
        total_debt,
        cogs,
        operating_cash_flow,
        market_cap,
    };

    let metrics = calculate_metrics(&data);

    let mut result = HashMap::new();
    result.insert("pe_ratio".to_string(), metrics.pe_ratio);
    result.insert("pb_ratio".to_string(), metrics.pb_ratio);
    result.insert("roe".to_string(), metrics.roe);
    result.insert("roa".to_string(), metrics.roa);
    result.insert("debt_ratio".to_string(), metrics.debt_ratio);
    result.insert("gross_margin".to_string(), metrics.gross_margin);
    result.insert("net_margin".to_string(), metrics.net_margin);
    result.insert("asset_turnover".to_string(), metrics.asset_turnover);
    result.insert("equity_multiplier".to_string(), metrics.equity_multiplier);
    result.insert("current_ratio".to_string(), metrics.current_ratio);
    result.insert("quick_ratio".to_string(), metrics.quick_ratio);
    result.insert("operating_cash_flow_ratio".to_string(), metrics.operating_cash_flow_ratio);

    Ok(result)
}

/// 批量计算 PE 和 PB
#[pyfunction]
fn batch_calculate_pe_pb(
    prices: Vec<f64>,
    eps_list: Vec<Option<f64>>,
    bps_list: Vec<Option<f64>>,
) -> PyResult<(Vec<Option<f64>>, Vec<Option<f64>>)> {
    let mut pe_ratios = Vec::with_capacity(prices.len());
    let mut pb_ratios = Vec::with_capacity(prices.len());

    for (i, &price) in prices.iter().enumerate() {
        let eps = eps_list.get(i).copied().flatten();
        let bps = bps_list.get(i).copied().flatten();

        let pe = if let Some(eps_value) = eps {
            if eps_value > 0.0 {
                Some(price / eps_value)
            } else {
                None
            }
        } else {
            None
        };

        let pb = if let Some(bps_value) = bps {
            if bps_value > 0.0 {
                Some(price / bps_value)
            } else {
                None
            }
        } else {
            None
        };

        pe_ratios.push(pe);
        pb_ratios.push(pb);
    }

    Ok((pe_ratios, pb_ratios))
}

/// 从字典列表批量计算财务指标
#[pyfunction]
fn batch_calculate_metrics_from_dicts(
    py: Python<'_>,
    dict_list: Vec<Bound<'_, PyDict>>,
) -> PyResult<Vec<PyObject>> {
    let results: Vec<PyObject> = dict_list
        .iter()
        .map(|dict| {
            let data = extract_financial_data_from_dict(py, dict);
            let metrics = calculate_metrics(&data);
            metrics_to_dict(py, &metrics)
        })
        .collect();

    Ok(results)
}

/// 从 Python 字典提取财务数据
fn extract_financial_data_from_dict(py: Python<'_>, dict: &Bound<'_, PyDict>) -> FinancialData {
    FinancialData {
        price: get_optional_f64_from_dict(py, dict, "price"),
        eps: get_optional_f64_from_dict(py, dict, "eps"),
        bps: get_optional_f64_from_dict(py, dict, "bps"),
        revenue: get_optional_f64_from_dict(py, dict, "revenue"),
        net_income: get_optional_f64_from_dict(py, dict, "net_income"),
        total_assets: get_optional_f64_from_dict(py, dict, "total_assets"),
        total_equity: get_optional_f64_from_dict(py, dict, "total_equity"),
        total_debt: get_optional_f64_from_dict(py, dict, "total_debt"),
        cogs: get_optional_f64_from_dict(py, dict, "cogs"),
        operating_cash_flow: get_optional_f64_from_dict(py, dict, "operating_cash_flow"),
        market_cap: get_optional_f64_from_dict(py, dict, "market_cap"),
    }
}

/// 获取字典中的可选 f64 值
fn get_optional_f64_from_dict(_py: Python<'_>, dict: &Bound<'_, PyDict>, key: &str) -> Option<f64> {
    match dict.get_item(key) {
        Ok(Some(value)) => value.extract::<f64>().ok(),
        Ok(None) => None,
        Err(_) => None,
    }
}

/// 将指标转换为 Python 字典
fn metrics_to_dict(py: Python<'_>, metrics: &FinancialMetrics) -> PyObject {
    let dict = PyDict::new(py);
    dict.set_item("pe_ratio", metrics.pe_ratio).unwrap();
    dict.set_item("pb_ratio", metrics.pb_ratio).unwrap();
    dict.set_item("roe", metrics.roe).unwrap();
    dict.set_item("roa", metrics.roa).unwrap();
    dict.set_item("debt_ratio", metrics.debt_ratio).unwrap();
    dict.set_item("gross_margin", metrics.gross_margin).unwrap();
    dict.set_item("net_margin", metrics.net_margin).unwrap();
    dict.set_item("asset_turnover", metrics.asset_turnover).unwrap();
    dict.set_item("equity_multiplier", metrics.equity_multiplier).unwrap();
    dict.set_item("current_ratio", metrics.current_ratio).unwrap();
    dict.set_item("quick_ratio", metrics.quick_ratio).unwrap();
    dict.set_item("operating_cash_flow_ratio", metrics.operating_cash_flow_ratio).unwrap();
    dict.into()
}
