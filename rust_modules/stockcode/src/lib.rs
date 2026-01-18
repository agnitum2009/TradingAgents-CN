use pyo3::prelude::*;
use regex::Regex;
use std::collections::HashMap;

/// 市场类型枚举
#[pyclass]
#[derive(Clone, Debug)]
pub enum MarketType {
    AShare,
    HK,
    US,
    Unknown,
}

/// 股票代码验证结果
#[pyclass]
#[derive(Clone, Debug)]
pub struct ValidationResult {
    #[pyo3(get, set)]
    pub is_valid: bool,
    #[pyo3(get, set)]
    pub stock_code: String,
    #[pyo3(get, set)]
    pub market_type: String,
    #[pyo3(get, set)]
    pub formatted_code: String,
    #[pyo3(get, set)]
    pub error_message: String,
}

#[pymethods]
impl ValidationResult {
    #[new]
    fn new(
        is_valid: bool,
        stock_code: String,
        market_type: String,
        formatted_code: String,
        error_message: String,
    ) -> Self {
        ValidationResult {
            is_valid,
            stock_code,
            market_type,
            formatted_code,
            error_message,
        }
    }

    fn to_dict(&self) -> HashMap<String, String> {
        let mut map = HashMap::new();
        map.insert("is_valid".to_string(), self.is_valid.to_string());
        map.insert("stock_code".to_string(), self.stock_code.clone());
        map.insert("market_type".to_string(), self.market_type.clone());
        map.insert("formatted_code".to_string(), self.formatted_code.clone());
        map.insert("error_message".to_string(), self.error_message.clone());
        map
    }
}

/// 检测市场类型
///
/// # 参数
/// * `stock_code` - 股票代码
///
/// # 返回
/// 市场类型字符串: "A股", "港股", "美股", "未知"
#[pyfunction]
fn detect_market_type(stock_code: &str) -> PyResult<String> {
    let code = stock_code.trim().to_uppercase();

    // A股：6位数字
    let a_share_re = Regex::new(r"^\d{6}$").unwrap();
    if a_share_re.is_match(&code) {
        return Ok("A股".to_string());
    }

    // 港股：4-5位数字.HK 或 纯4-5位数字
    let hk_re = Regex::new(r"^\d{4,5}\.HK$|^\d{4,5}$").unwrap();
    if hk_re.is_match(&code) {
        return Ok("港股".to_string());
    }

    // 美股：1-5位字母
    let us_re = Regex::new(r"^[A-Z]{1,5}$").unwrap();
    if us_re.is_match(&code) {
        return Ok("美股".to_string());
    }

    Ok("未知".to_string())
}

/// 标准化股票代码
///
/// # 参数
/// * `stock_code` - 股票代码
/// * `market_type` - 市场类型 ("auto", "A股", "港股", "美股")
///
/// # 返回
/// ValidationResult 对象
#[pyfunction]
fn normalize_stock_code(stock_code: &str, market_type: &str) -> PyResult<ValidationResult> {
    let code = stock_code.trim();

    if code.is_empty() {
        return Ok(ValidationResult::new(
            false,
            code.to_string(),
            "未知".to_string(),
            String::new(),
            "股票代码不能为空".to_string(),
        ));
    }

    // 自动检测市场类型
    let detected_market = if market_type == "auto" {
        detect_market_type(code)?
    } else {
        market_type.to_string()
    };

    match detected_market.as_str() {
        "A股" => {
            let a_share_re = Regex::new(r"^\d{6}$").unwrap();
            if !a_share_re.is_match(code) {
                return Ok(ValidationResult::new(
                    false,
                    code.to_string(),
                    "A股".to_string(),
                    String::new(),
                    "A股代码格式错误，应为6位数字".to_string(),
                ));
            }
            Ok(ValidationResult::new(
                true,
                code.to_string(),
                "A股".to_string(),
                code.to_string(),
                String::new(),
            ))
        }
        "港股" => {
            let code_upper = code.to_uppercase();
            let hk_format_re = Regex::new(r"^\d{4,5}\.HK$").unwrap();
            let digit_re = Regex::new(r"^\d{4,5}$").unwrap();

            let formatted = if hk_format_re.is_match(&code_upper) {
                code_upper
            } else if digit_re.is_match(code) {
                // 保留原始格式，只添加 .HK 后缀
                format!("{}.HK", code)
            } else {
                return Ok(ValidationResult::new(
                    false,
                    code.to_string(),
                    "港股".to_string(),
                    String::new(),
                    "港股代码格式错误，应为4-5位数字或4-5位数字.HK".to_string(),
                ));
            };

            Ok(ValidationResult::new(
                true,
                code.to_string(),
                "港股".to_string(),
                formatted,
                String::new(),
            ))
        }
        "美股" => {
            let code_upper = code.to_uppercase();
            let us_re = Regex::new(r"^[A-Z]{1,5}$").unwrap();
            if !us_re.is_match(&code_upper) {
                return Ok(ValidationResult::new(
                    false,
                    code.to_string(),
                    "美股".to_string(),
                    String::new(),
                    "美股代码格式错误，应为1-5位字母".to_string(),
                ));
            }
            Ok(ValidationResult::new(
                true,
                code.to_string(),
                "美股".to_string(),
                code_upper,
                String::new(),
            ))
        }
        _ => Ok(ValidationResult::new(
            false,
            code.to_string(),
            "未知".to_string(),
            String::new(),
            "无法识别的市场类型".to_string(),
        )),
    }
}

/// 批量标准化股票代码
///
/// # 参数
/// * `stock_codes` - 股票代码列表
/// * `market_type` - 市场类型 ("auto", "A股", "港股", "美股")
///
/// # 返回
/// Python 列表，包含 ValidationResult 对象
#[pyfunction]
fn normalize_stock_codes(stock_codes: Vec<String>, market_type: &str) -> PyResult<Vec<ValidationResult>> {
    let mut results = Vec::new();

    for code in stock_codes {
        let result = normalize_stock_code(&code, market_type)?;
        results.push(result);
    }

    Ok(results)
}

/// 验证股票代码格式
///
/// # 参数
/// * `stock_code` - 股票代码
/// * `market_type` - 市场类型 ("auto", "A股", "港股", "美股")
///
/// # 返回
/// bool，代码是否有效
#[pyfunction]
fn validate_stock_code(stock_code: &str, market_type: &str) -> PyResult<bool> {
    let result = normalize_stock_code(stock_code, market_type)?;
    Ok(result.is_valid)
}

/// 添加市场后缀（如果需要）
///
/// # 参数
/// * `stock_code` - 股票代码
/// * `market_type` - 市场类型
///
/// # 返回
/// 带市场后缀的股票代码
#[pyfunction]
fn add_market_suffix(stock_code: &str, market_type: &str) -> PyResult<String> {
    let result = normalize_stock_code(stock_code, market_type)?;

    if !result.is_valid {
        return Ok(result.formatted_code);
    }

    // A股添加 .SS 或 .SZ 后缀（根据代码首位）
    if result.market_type == "A股" {
        let first = result.formatted_code.chars().next().unwrap();
        if first == '6' {
            return Ok(format!("{}.SS", result.formatted_code));
        } else if first == '0' || first == '3' {
            return Ok(format!("{}.SZ", result.formatted_code));
        }
    }

    Ok(result.formatted_code)
}

/// Rust 模块定义
#[pymodule]
fn tacn_stockcode(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(detect_market_type, m)?)?;
    m.add_function(wrap_pyfunction!(normalize_stock_code, m)?)?;
    m.add_function(wrap_pyfunction!(normalize_stock_codes, m)?)?;
    m.add_function(wrap_pyfunction!(validate_stock_code, m)?)?;
    m.add_function(wrap_pyfunction!(add_market_suffix, m)?)?;
    m.add_class::<ValidationResult>()?;
    m.add_class::<MarketType>()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_a_share() {
        assert_eq!(detect_market_type("000001").unwrap(), "A股");
        assert_eq!(detect_market_type("600519").unwrap(), "A股");
    }

    #[test]
    fn test_detect_hk() {
        assert_eq!(detect_market_type("0700").unwrap(), "港股");
        assert_eq!(detect_market_type("0700.HK").unwrap(), "港股");
    }

    #[test]
    fn test_detect_us() {
        assert_eq!(detect_market_type("AAPL").unwrap(), "美股");
        assert_eq!(detect_market_type("TSLA").unwrap(), "美股");
    }

    #[test]
    fn test_normalize_a_share() {
        let result = normalize_stock_code("000001", "auto").unwrap();
        assert!(result.is_valid);
        assert_eq!(result.market_type, "A股");
    }

    #[test]
    fn test_normalize_hk() {
        let result = normalize_stock_code("0700", "auto").unwrap();
        assert!(result.is_valid);
        assert_eq!(result.formatted_code, "0700.HK");
    }

    #[test]
    fn test_normalize_us() {
        let result = normalize_stock_code("aapl", "auto").unwrap();
        assert!(result.is_valid);
        assert_eq!(result.formatted_code, "AAPL");
    }
}
