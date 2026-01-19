/**
 * Trend Analysis Service (趋势交易分析器)
 *
 * Ported from: app/routers/daily_analysis/trend_analyzer.py
 *
 * Trading Philosophy (交易理念核心原则):
 * 1. 严进策略 (Strict Entry) - No chasing highs, focus on success rate
 * 2. 趋势交易 (Trend Following) - MA5>MA10>MA20 bullish alignment
 * 3. 效率优先 (Efficiency First) - Focus on stocks with good chip structure
 * 4. 买点偏好 (Buy Point Preference) - Buy on pullback to MA5/MA10 support
 *
 * Technical Standards (技术标准):
 * - Bullish alignment: MA5 > MA10 > MA20
 * - Bias rate: (Close - MA5) / MA5 < 5% (no chasing highs)
 * - Volume pattern: Shrink volume pullback preferred
 */

import { injectable } from 'tsyringe';
import type { Kline } from '../../types/stock.js';
import type {
  TrendAnalysisResult,
} from '../../types/analysis.js';
import {
  TrendStatus,
  BuySignal,
} from '../../types/common.js';
import { VolumeDetailStatus } from '../../types/analysis.js';
import { Logger } from '../../utils/logger.js';

const logger = Logger.for('TrendAnalysisService');

/**
 * Trading parameters configuration
 */
const CONFIG = {
  /** Bias rate threshold (%) - exceeding this means don't chase */
  BIAS_THRESHOLD: 5.0,
  /** Shrink volume threshold (current vol / 5-day avg vol) */
  VOLUME_SHRINK_RATIO: 0.7,
  /** Heavy volume threshold */
  VOLUME_HEAVY_RATIO: 1.5,
  /** MA support tolerance (2%) */
  MA_SUPPORT_TOLERANCE: 0.02,
} as const;

/**
 * Input data for trend analysis
 */
export interface TrendAnalysisInput {
  /** Stock code */
  code: string;
  /** Stock name (optional) */
  name?: string;
  /** Kline data (OHLCV) - minimum 20 candles required */
  klines: Kline[];
}

/**
 * Internal data structure with calculated moving averages
 */
interface ExtendedKline extends Kline {
  MA5: number;
  MA10: number;
  MA20: number;
  MA60: number;
}

/**
 * Trend Analysis Service
 *
 * Analyzes stock trends based on moving average alignment, bias rates,
 * volume patterns, and support/resistance levels.
 */
@injectable()
export class TrendAnalysisService {
  /**
   * Analyze stock trend
   *
   * @param input - Analysis input with stock code and kline data
   * @returns Trend analysis result
   */
  async analyze(input: TrendAnalysisInput): Promise<TrendAnalysisResult> {
    const { code, name, klines } = input;

    // Initialize default result
    const defaultResult: TrendAnalysisResult = {
      code,
      name,
      trendStatus: TrendStatus.CONSOLIDATION,
      maAlignment: '',
      trendStrength: 0,
      ma5: 0,
      ma10: 0,
      ma20: 0,
      ma60: 0,
      currentPrice: 0,
      biasMa5: 0,
      biasMa10: 0,
      biasMa20: 0,
      volumeStatus: VolumeDetailStatus.NORMAL,
      volumeRatio5d: 0,
      volumeTrend: '',
      supportMa5: false,
      supportMa10: false,
      resistanceLevels: [],
      supportLevels: [],
      buySignal: BuySignal.WAIT,
      signalScore: 0,
      signalReasons: [],
      riskFactors: [],
      timestamp: Date.now(),
    };

    // Validate input
    if (!klines || klines.length < 20) {
      logger.warn(`${code}: Insufficient data for trend analysis`);
      defaultResult.riskFactors.push('数据不足，无法完成分析');
      return defaultResult;
    }

    // Sort klines by timestamp (ascending)
    const sortedKlines = [...klines].sort((a, b) => a.timestamp - b.timestamp);

    // Calculate moving averages
    const extendedKlines = this.calculateMas(sortedKlines);

    // Get latest data
    const latest = extendedKlines[extendedKlines.length - 1];
    if (!latest) {
      defaultResult.riskFactors.push('无法获取最新数据');
      return defaultResult;
    }

    // Build result
    const result: TrendAnalysisResult = {
      ...defaultResult,
      currentPrice: latest.close,
      ma5: latest.MA5,
      ma10: latest.MA10,
      ma20: latest.MA20,
      ma60: latest.MA60,
    };

    // 1. Analyze trend
    this.analyzeTrend(extendedKlines, result);

    // 2. Calculate bias rates
    this.calculateBias(result);

    // 3. Analyze volume
    this.analyzeVolume(extendedKlines, result);

    // 4. Analyze support/resistance
    this.analyzeSupportResistance(extendedKlines, result);

    // 5. Generate trading signal
    this.generateSignal(result);

    logger.info(`${code}: Trend analysis complete`, {
      trendStatus: result.trendStatus,
      buySignal: result.buySignal,
      signalScore: result.signalScore,
    });

    return result;
  }

  /**
   * Calculate moving averages
   */
  private calculateMas(klines: Kline[]): ExtendedKline[] {
    const result: ExtendedKline[] = [];

    for (let i = 0; i < klines.length; i++) {
      const kline = klines[i];

      // MA5
      let ma5 = 0;
      if (i >= 4) {
        let sum = 0;
        for (let j = i - 4; j <= i; j++) {
          sum += klines[j]?.close ?? 0;
        }
        ma5 = sum / 5;
      }

      // MA10
      let ma10 = 0;
      if (i >= 9) {
        let sum = 0;
        for (let j = i - 9; j <= i; j++) {
          sum += klines[j]?.close ?? 0;
        }
        ma10 = sum / 10;
      }

      // MA20
      let ma20 = 0;
      if (i >= 19) {
        let sum = 0;
        for (let j = i - 19; j <= i; j++) {
          sum += klines[j]?.close ?? 0;
        }
        ma20 = sum / 20;
      }

      // MA60 (use MA20 if insufficient data)
      let ma60 = ma20;
      if (i >= 59) {
        let sum = 0;
        for (let j = i - 59; j <= i; j++) {
          sum += klines[j]?.close ?? 0;
        }
        ma60 = sum / 60;
      }

      result.push({
        timestamp: kline.timestamp,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
        volume: kline.volume,
        amount: kline.amount,
        changePercent: kline.changePercent,
        changeAmount: kline.changeAmount,
        MA5: ma5,
        MA10: ma10,
        MA20: ma20,
        MA60: ma60,
      });
    }

    return result;
  }

  /**
   * Analyze trend status
   *
   * Core logic: Determine MA alignment and trend strength
   */
  private analyzeTrend(klines: ExtendedKline[], result: TrendAnalysisResult): void {
    const latest = klines[klines.length - 1];
    if (!latest) {
      return;
    }

    const { MA5: ma5, MA10: ma10, MA20: ma20 } = latest;

    // Check if MA5 > MA10 > MA20 (bullish alignment)
    if (ma5 > ma10 && ma10 > ma20) {
      // Check if spread is expanding (strong trend)
      const prev = klines.length >= 5 ? klines[klines.length - 5] : latest;
      const prevSpread = prev.MA20 > 0 ? (prev.MA5 - prev.MA20) / prev.MA20 * 100 : 0;
      const currSpread = ma20 > 0 ? (ma5 - ma20) / ma20 * 100 : 0;

      if (currSpread > prevSpread && currSpread > 5) {
        result.trendStatus = TrendStatus.STRONG_BULL;
        result.maAlignment = '强势多头排列，均线发散上行';
        result.trendStrength = 90;
      } else {
        result.trendStatus = TrendStatus.BULL;
        result.maAlignment = '多头排列 MA5>MA10>MA20';
        result.trendStrength = 75;
      }
    }
    // MA5 > MA10 but MA10 <= MA20 (weak bullish)
    else if (ma5 > ma10 && ma10 <= ma20) {
      result.trendStatus = TrendStatus.WEAK_BULL;
      result.maAlignment = '弱势多头，MA5>MA10 但 MA10≤MA20';
      result.trendStrength = 55;
    }
    // Check if MA5 < MA10 < MA20 (bearish alignment)
    else if (ma5 < ma10 && ma10 < ma20) {
      const prev = klines.length >= 5 ? klines[klines.length - 5] : latest;
      const prevSpread = prev.MA5 > 0 ? (prev.MA20 - prev.MA5) / prev.MA5 * 100 : 0;
      const currSpread = ma5 > 0 ? (ma20 - ma5) / ma5 * 100 : 0;

      if (currSpread > prevSpread && currSpread > 5) {
        result.trendStatus = TrendStatus.STRONG_BEAR;
        result.maAlignment = '强势空头排列，均线发散下行';
        result.trendStrength = 10;
      } else {
        result.trendStatus = TrendStatus.BEAR;
        result.maAlignment = '空头排列 MA5<MA10<MA20';
        result.trendStrength = 25;
      }
    }
    // MA5 < MA10 but MA10 >= MA20 (weak bearish)
    else if (ma5 < ma10 && ma10 >= ma20) {
      result.trendStatus = TrendStatus.WEAK_BEAR;
      result.maAlignment = '弱势空头，MA5<MA10 但 MA10≥MA20';
      result.trendStrength = 40;
    }
    // Consolidation
    else {
      result.trendStatus = TrendStatus.CONSOLIDATION;
      result.maAlignment = '均线缠绕，趋势不明';
      result.trendStrength = 50;
    }
  }

  /**
   * Calculate bias rates (deviation from moving averages)
   *
   * Bias = (Close - MA) / MA * 100%
   *
   * Strict entry strategy: Bias over 5% means don't chase
   */
  private calculateBias(result: TrendAnalysisResult): void {
    const price = result.currentPrice;

    if (result.ma5 > 0) {
      result.biasMa5 = (price - result.ma5) / result.ma5 * 100;
    }
    if (result.ma10 > 0) {
      result.biasMa10 = (price - result.ma10) / result.ma10 * 100;
    }
    if (result.ma20 > 0) {
      result.biasMa20 = (price - result.ma20) / result.ma20 * 100;
    }
  }

  /**
   * Analyze volume
   *
   * Preference: Shrink volume pullback > Heavy volume up > Shrink volume up > Heavy volume down
   */
  private analyzeVolume(klines: ExtendedKline[], result: TrendAnalysisResult): void {
    if (klines.length < 5) {
      return;
    }

    const latest = klines[klines.length - 1];
    const prev = klines[klines.length - 2];

    if (!latest || !prev) {
      return;
    }

    // Calculate 5-day average volume
    let volSum = 0;
    const count = Math.min(5, klines.length - 1);
    for (let i = klines.length - 1 - count; i < klines.length - 1; i++) {
      volSum += klines[i]?.volume ?? 0;
    }
    const vol5dAvg = volSum / count;

    if (vol5dAvg > 0) {
      result.volumeRatio5d = latest.volume / vol5dAvg;
    }

    // Calculate price change
    const priceChange = prev.close > 0 ? (latest.close - prev.close) / prev.close * 100 : 0;

    // Determine volume status
    if (result.volumeRatio5d >= CONFIG.VOLUME_HEAVY_RATIO) {
      if (priceChange > 0) {
        result.volumeStatus = VolumeDetailStatus.HEAVY_VOLUME_UP;
        result.volumeTrend = '放量上涨，多头力量强劲';
      } else {
        result.volumeStatus = VolumeDetailStatus.HEAVY_VOLUME_DOWN;
        result.volumeTrend = '放量下跌，注意风险';
      }
    } else if (result.volumeRatio5d <= CONFIG.VOLUME_SHRINK_RATIO) {
      if (priceChange > 0) {
        result.volumeStatus = VolumeDetailStatus.SHRINK_VOLUME_UP;
        result.volumeTrend = '缩量上涨，上攻动能不足';
      } else {
        result.volumeStatus = VolumeDetailStatus.SHRINK_VOLUME_DOWN;
        result.volumeTrend = '缩量回调，洗盘特征明显（好）';
      }
    } else {
      result.volumeStatus = VolumeDetailStatus.NORMAL;
      result.volumeTrend = '量能正常';
    }
  }

  /**
   * Analyze support and resistance levels
   *
   * Buy point preference: Pullback to MA5/MA10 support
   */
  private analyzeSupportResistance(klines: ExtendedKline[], result: TrendAnalysisResult): void {
    const price = result.currentPrice;
    const { ma5, ma10, ma20 } = result;

    // Check if price is supported by MA5
    if (ma5 > 0) {
      const ma5Distance = Math.abs(price - ma5) / ma5;
      if (ma5Distance <= CONFIG.MA_SUPPORT_TOLERANCE && price >= ma5) {
        result.supportMa5 = true;
        result.supportLevels.push(ma5);
      }
    }

    // Check if price is supported by MA10
    if (ma10 > 0) {
      const ma10Distance = Math.abs(price - ma10) / ma10;
      if (ma10Distance <= CONFIG.MA_SUPPORT_TOLERANCE && price >= ma10) {
        result.supportMa10 = true;
        if (!result.supportLevels.includes(ma10)) {
          result.supportLevels.push(ma10);
        }
      }
    }

    // MA20 as important support
    if (ma20 > 0 && price >= ma20 && !result.supportLevels.includes(ma20)) {
      result.supportLevels.push(ma20);
    }

    // Recent high as resistance
    if (klines.length >= 20) {
      let recentHigh = klines[klines.length - 20]?.high ?? 0;
      for (let i = klines.length - 20; i < klines.length; i++) {
        const kline = klines[i];
        if (kline && kline.high > recentHigh) {
          recentHigh = kline.high;
        }
      }
      if (recentHigh > price && !result.resistanceLevels.includes(recentHigh)) {
        result.resistanceLevels.push(recentHigh);
      }
    }
  }

  /**
   * Generate trading signal
   *
   * Scoring system:
   * - Trend (40 pts): Bullish alignment scores higher
   * - Bias rate (30 pts): Closer to MA5 scores higher
   * - Volume (20 pts): Shrink volume pullback preferred
   * - Support (10 pts): MA support effectiveness
   */
  private generateSignal(result: TrendAnalysisResult): void {
    let score = 0;
    const reasons: string[] = [];
    const risks: string[] = [];

    // === Trend Score (40 pts) ===
    const trendScores: Record<TrendStatus, number> = {
      [TrendStatus.STRONG_BULL]: 40,
      [TrendStatus.BULL]: 35,
      [TrendStatus.WEAK_BULL]: 25,
      [TrendStatus.CONSOLIDATION]: 15,
      [TrendStatus.WEAK_BEAR]: 10,
      [TrendStatus.BEAR]: 5,
      [TrendStatus.STRONG_BEAR]: 0,
    };
    const trendScore = trendScores[result.trendStatus as TrendStatus] ?? 15;
    score += trendScore;

    if (result.trendStatus === TrendStatus.STRONG_BULL || result.trendStatus === TrendStatus.BULL) {
      reasons.push(`✅ ${result.maAlignment}，顺势做多`);
    } else if (result.trendStatus === TrendStatus.BEAR || result.trendStatus === TrendStatus.STRONG_BEAR) {
      risks.push(`⚠️ ${result.maAlignment}，不宜做多`);
    }

    // === Bias Rate Score (30 pts) ===
    const bias = result.biasMa5;
    if (bias < 0) {
      // Price below MA5 (pullback)
      if (bias > -3) {
        score += 30;
        reasons.push(`✅ 价格略低于MA5(${bias.toFixed(1)}%)，回踩买点`);
      } else if (bias > -5) {
        score += 25;
        reasons.push(`✅ 价格回踩MA5(${bias.toFixed(1)}%)，观察支撑`);
      } else {
        score += 10;
        risks.push(`⚠️ 乖离率过大(${bias.toFixed(1)}%)，可能破位`);
      }
    } else if (bias < 2) {
      score += 28;
      reasons.push(`✅ 价格贴近MA5(${bias.toFixed(1)}%)，介入好时机`);
    } else if (bias < CONFIG.BIAS_THRESHOLD) {
      score += 20;
      reasons.push(`⚡ 价格略高于MA5(${bias.toFixed(1)}%)，可小仓介入`);
    } else {
      score += 5;
      risks.push(`❌ 乖离率过高(${bias.toFixed(1)}%>5%)，严禁追高！`);
    }

    // === Volume Score (20 pts) ===
    const volumeScores: Record<string, number> = {
      [VolumeDetailStatus.SHRINK_VOLUME_DOWN]: 20,  // Best: shrink pullback
      [VolumeDetailStatus.HEAVY_VOLUME_UP]: 15,     // Second: heavy volume up
      [VolumeDetailStatus.NORMAL]: 12,
      [VolumeDetailStatus.SHRINK_VOLUME_UP]: 8,     // Poor: low volume up
      [VolumeDetailStatus.HEAVY_VOLUME_DOWN]: 0,    // Worst: heavy volume down
    };
    const volScore = volumeScores[result.volumeStatus] ?? 10;
    score += volScore;

    if (result.volumeStatus === VolumeDetailStatus.SHRINK_VOLUME_DOWN) {
      reasons.push('✅ 缩量回调，主力洗盘');
    } else if (result.volumeStatus === VolumeDetailStatus.HEAVY_VOLUME_DOWN) {
      risks.push('⚠️ 放量下跌，注意风险');
    }

    // === Support Score (10 pts) ===
    if (result.supportMa5) {
      score += 5;
      reasons.push('✅ MA5支撑有效');
    }
    if (result.supportMa10) {
      score += 5;
      reasons.push('✅ MA10支撑有效');
    }

    // === Final Signal ===
    result.signalScore = score;
    result.signalReasons = reasons;
    result.riskFactors = risks;

    // Generate buy signal based on score and trend
    if (score >= 80 && (result.trendStatus === TrendStatus.STRONG_BULL || result.trendStatus === TrendStatus.BULL)) {
      result.buySignal = BuySignal.STRONG_BUY;
    } else if (score >= 65 && (result.trendStatus === TrendStatus.STRONG_BULL || result.trendStatus === TrendStatus.BULL || result.trendStatus === TrendStatus.WEAK_BULL)) {
      result.buySignal = BuySignal.BUY;
    } else if (score >= 50) {
      result.buySignal = BuySignal.HOLD;
    } else if (score >= 35) {
      result.buySignal = BuySignal.WAIT;
    } else if (result.trendStatus === TrendStatus.BEAR || result.trendStatus === TrendStatus.STRONG_BEAR) {
      result.buySignal = BuySignal.STRONG_SELL;
    } else {
      result.buySignal = BuySignal.SELL;
    }
  }
}

/**
 * Convenience function: Analyze a single stock
 *
 * @param input - Analysis input
 * @returns Trend analysis result
 */
export async function analyzeTrend(input: TrendAnalysisInput): Promise<TrendAnalysisResult> {
  const service = new TrendAnalysisService();
  return await service.analyze(input);
}
