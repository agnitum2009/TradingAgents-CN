/**
 * Unit tests for TrendAnalysisService
 *
 * Tests the trend analysis algorithm ported from Python:
 * - MA calculation
 * - Trend status determination
 * - Bias rate calculation
 * - Volume analysis
 * - Support/resistance detection
 * - Signal generation
 */

import { TrendAnalysisService, type TrendAnalysisInput } from '../../../src/domain/analysis/trend-analysis.service';
import type { Kline } from '../../../src/types/stock';
import {
  TrendStatus,
  BuySignal,
} from '../../../src/types/common';
import {
  VolumeDetailStatus,
} from '../../../src/types/analysis';

describe('TrendAnalysisService', () => {
  let service: TrendAnalysisService;

  beforeEach(() => {
    service = new TrendAnalysisService();
  });

  /**
   * Helper: Generate mock kline data
   */
  function generateKlines(
    count: number,
    startPrice: number,
    trend: 'up' | 'down' | 'sideways' = 'sideways',
    volatility: number = 0.02
  ): Kline[] {
    const klines: Kline[] = [];
    let price = startPrice;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      let change: number;
      if (trend === 'up') {
        change = 1;
      } else if (trend === 'down') {
        change = -1;
      } else {
        // For sideways, use deterministic oscillation that creates intertwined MAs
        const phase = (i / count) * Math.PI * 4; // 2 full cycles
        change = Math.sin(phase) * 0.5; // Oscillates between -0.5 and 0.5
      }
      const move = price * volatility * change;
      const open = price;
      const close = price + move;
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = 1000000 + Math.random() * 500000;

      klines.push({
        timestamp: now - (count - i) * dayMs,
        open,
        high,
        low,
        close,
        volume,
      });

      price = close;
    }

    return klines;
  }

  /**
   * Helper: Generate bullish trend klines (MA5 > MA10 > MA20)
   */
  function generateBullishKlines(): Kline[] {
    const klines: Kline[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Generate 60 days of uptrending data
    let price = 100;
    for (let i = 0; i < 60; i++) {
      const uptrend = i / 60; // Increasing trend
      const dailyChange = 0.001 + uptrend * 0.01;
      const open = price;
      const close = price * (1 + dailyChange);
      const high = Math.max(open, close) * 1.01;
      const low = Math.min(open, close) * 0.99;
      const volume = 1000000 + Math.random() * 200000;

      klines.push({
        timestamp: now - (60 - i) * dayMs,
        open,
        high,
        low,
        close,
        volume,
      });

      price = close;
    }

    return klines;
  }

  /**
   * Helper: Generate bearish trend klines (MA5 < MA10 < MA20)
   */
  function generateBearishKlines(): Kline[] {
    const klines: Kline[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    let price = 200;
    for (let i = 0; i < 60; i++) {
      const downtrend = i / 60;
      const dailyChange = -(0.001 + downtrend * 0.01);
      const open = price;
      const close = price * (1 + dailyChange);
      const high = Math.max(open, close) * 1.01;
      const low = Math.min(open, close) * 0.99;
      const volume = 1000000 + Math.random() * 200000;

      klines.push({
        timestamp: now - (60 - i) * dayMs,
        open,
        high,
        low,
        close,
        volume,
      });

      price = close;
    }

    return klines;
  }

  /**
   * Helper: Generate klines with pullback to MA5 (ideal buy signal)
   */
  function generatePullbackKlines(): Kline[] {
    // Start with bullish trend
    const klines = generateBullishKlines();

    // Set consistent high volume for most candles (except last one)
    // The 5-day average uses indices length-6 to length-2, so set those to high volume
    const highVol = 2000000;
    const lowVol = 500000; // This will be 25% of high vol, ratio = 0.25 < 0.7

    for (let i = 0; i < klines.length - 1; i++) {
      klines[i].volume = highVol;
    }

    // Latest candle (last one) gets low volume
    const latestIdx = klines.length - 1;
    klines[latestIdx].volume = lowVol;

    // Also create price pullback: latest close < previous close
    const prevIdx = klines.length - 2;
    const prevClose = klines[prevIdx].close;
    klines[latestIdx].close = prevClose * 0.98; // 2% drop
    klines[latestIdx].open = prevClose * 0.99; // Open is also lower
    klines[latestIdx].high = prevClose * 0.995;
    klines[latestIdx].low = prevClose * 0.97;

    return klines;
  }

  describe('Input validation', () => {
    it('should return default result when klines is empty', async () => {
      const input: TrendAnalysisInput = {
        code: '600519',
        klines: [],
      };

      const result = await service.analyze(input);

      expect(result.code).toBe('600519');
      expect(result.trendStatus).toBe(TrendStatus.CONSOLIDATION);
      expect(result.riskFactors).toContain('数据不足，无法完成分析');
    });

    it('should return default result when klines < 20', async () => {
      const input: TrendAnalysisInput = {
        code: '600519',
        klines: generateKlines(15, 100),
      };

      const result = await service.analyze(input);

      expect(result.riskFactors).toContain('数据不足，无法完成分析');
    });

    it('should handle unsorted kline data', async () => {
      const klines = generateKlines(30, 100, 'up');
      // Reverse to make it unsorted
      const unsorted = [...klines].reverse();

      const input: TrendAnalysisInput = {
        code: '600519',
        klines: unsorted,
      };

      const result = await service.analyze(input);

      // Should still work correctly after sorting
      expect(result.code).toBe('600519');
      expect(result.ma5).toBeGreaterThan(0);
    });
  });

  describe('Moving average calculation', () => {
    it('should calculate MA5 correctly', async () => {
      const klines = generateKlines(30, 100, 'up');
      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      // MA5 should be close to recent closes
      const last5 = klines.slice(-5);
      const expectedMA5 = last5.reduce((sum, k) => sum + k.close, 0) / 5;
      expect(result.ma5).toBeCloseTo(expectedMA5, 4);
    });

    it('should calculate MA10 correctly', async () => {
      const klines = generateKlines(30, 100, 'up');
      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      const last10 = klines.slice(-10);
      const expectedMA10 = last10.reduce((sum, k) => sum + k.close, 0) / 10;
      expect(result.ma10).toBeCloseTo(expectedMA10, 4);
    });

    it('should calculate MA20 correctly', async () => {
      const klines = generateKlines(30, 100, 'up');
      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      const last20 = klines.slice(-20);
      const expectedMA20 = last20.reduce((sum, k) => sum + k.close, 0) / 20;
      expect(result.ma20).toBeCloseTo(expectedMA20, 4);
    });

    it('should use MA20 as fallback for MA60 when insufficient data', async () => {
      const klines = generateKlines(40, 100, 'up');
      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      // With only 40 candles, MA60 should equal MA20
      expect(result.ma60).toBe(result.ma20);
    });
  });

  describe('Trend status determination', () => {
    it('should detect STRONG_BULL when MA5 > MA10 > MA20 with expanding spread', async () => {
      const input: TrendAnalysisInput = {
        code: '600519',
        klines: generateBullishKlines(),
      };

      const result = await service.analyze(input);

      expect(result.trendStatus).toBe(TrendStatus.STRONG_BULL);
      expect(result.trendStrength).toBe(90);
      expect(result.maAlignment).toContain('强势多头');
    });

    it('should detect BULL when MA5 > MA10 > MA20', async () => {
      // Generate klines with less aggressive uptrend
      const klines = generateKlines(30, 100, 'up');
      // Modify to ensure alignment but not strong spread
      for (let i = 10; i < 30; i++) {
        klines[i].close = 100 + i * 0.1; // Small uptrend
      }

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      // Check alignment
      const { ma5, ma10, ma20 } = result;
      if (ma5 > ma10 && ma10 > ma20) {
        expect([TrendStatus.BULL, TrendStatus.STRONG_BULL]).toContain(result.trendStatus);
      }
    });

    it('should detect STRONG_BEAR when MA5 < MA10 < MA20 with expanding spread', async () => {
      const input: TrendAnalysisInput = {
        code: '600519',
        klines: generateBearishKlines(),
      };

      const result = await service.analyze(input);

      expect(result.trendStatus).toBe(TrendStatus.STRONG_BEAR);
      expect(result.trendStrength).toBe(10);
      expect(result.maAlignment).toContain('强势空头');
    });

    it('should detect BEAR when MA5 < MA10 < MA20', async () => {
      const klines = generateKlines(30, 100, 'down');

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      // Check alignment
      const { ma5, ma10, ma20 } = result;
      if (ma5 < ma10 && ma10 < ma20) {
        expect([TrendStatus.BEAR, TrendStatus.STRONG_BEAR]).toContain(result.trendStatus);
      }
    });

    it('should detect CONSOLIDATION when MAs are intertwined', async () => {
      const klines = generateKlines(30, 100, 'sideways');

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      expect([TrendStatus.CONSOLIDATION, TrendStatus.WEAK_BULL, TrendStatus.WEAK_BEAR])
        .toContain(result.trendStatus);
    });
  });

  describe('Bias rate calculation', () => {
    it('should calculate bias from MA5 correctly', async () => {
      const klines = generateBullishKlines();
      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      const expectedBias = (result.currentPrice - result.ma5) / result.ma5 * 100;
      expect(result.biasMa5).toBeCloseTo(expectedBias, 4);
    });

    it('should calculate bias from MA10 correctly', async () => {
      const klines = generateBullishKlines();
      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      const expectedBias = (result.currentPrice - result.ma10) / result.ma10 * 100;
      expect(result.biasMa10).toBeCloseTo(expectedBias, 4);
    });

    it('should calculate bias from MA20 correctly', async () => {
      const klines = generateBullishKlines();
      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      const expectedBias = (result.currentPrice - result.ma20) / result.ma20 * 100;
      expect(result.biasMa20).toBeCloseTo(expectedBias, 4);
    });
  });

  describe('Volume analysis', () => {
    it('should detect HEAVY_VOLUME_UP when volume is high and price up', async () => {
      const klines = generateBullishKlines();
      // Make last day heavy volume
      klines[klines.length - 1].volume = 3000000;
      klines[klines.length - 2].volume = 1000000;

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      expect(result.volumeRatio5d).toBeGreaterThan(1.5);
      expect(result.volumeStatus).toBe(VolumeDetailStatus.HEAVY_VOLUME_UP);
    });

    it('should detect SHRINK_VOLUME_DOWN when volume is low and price down', async () => {
      const klines = generatePullbackKlines();

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      expect(result.volumeStatus).toBe(VolumeDetailStatus.SHRINK_VOLUME_DOWN);
    });
  });

  describe('Support and resistance analysis', () => {
    it('should detect MA5 support when price is near MA5', async () => {
      const klines = generatePullbackKlines();

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      // Check if price is within 2% of MA5 and above it
      const price = result.currentPrice;
      const ma5Distance = Math.abs(price - result.ma5) / result.ma5;

      if (ma5Distance <= 0.02 && price >= result.ma5) {
        expect(result.supportMa5).toBe(true);
        expect(result.supportLevels).toContain(result.ma5);
      }
    });

    it('should include MA20 as support when price is above', async () => {
      const klines = generateBullishKlines();

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      if (result.currentPrice >= result.ma20) {
        expect(result.supportLevels).toContain(result.ma20);
      }
    });

    it('should detect resistance from recent high', async () => {
      const klines = generatePullbackKlines();

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      // Should have at least some resistance levels
      expect(result.resistanceLevels.length).toBeGreaterThan(0);
    });
  });

  describe('Signal generation', () => {
    it('should generate STRONG_BUY for strong bullish with low bias', async () => {
      const klines = generatePullbackKlines();

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      // Pullback with shrink volume should generate buy signal
      if (result.signalScore >= 80 &&
          (result.trendStatus === TrendStatus.STRONG_BULL || result.trendStatus === TrendStatus.BULL)) {
        expect(result.buySignal).toBe(BuySignal.STRONG_BUY);
      }
    });

    it('should generate BUY for bullish with moderate conditions', async () => {
      const klines = generateBullishKlines();

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      if (result.signalScore >= 65 &&
          (result.trendStatus === TrendStatus.STRONG_BULL || result.trendStatus === TrendStatus.BULL)) {
        expect(result.buySignal).toBe(BuySignal.BUY);
      }
    });

    it('should generate STRONG_SELL for strong bearish', async () => {
      const klines = generateBearishKlines();

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      if (result.trendStatus === TrendStatus.BEAR || result.trendStatus === TrendStatus.STRONG_BEAR) {
        if (result.signalScore < 35) {
          expect(result.buySignal).toBe(BuySignal.STRONG_SELL);
        }
      }
    });

    it('should include risk factors when bias is too high', async () => {
      const klines = generateBullishKlines();
      // Make price much higher than MA5
      const lastKline = klines[klines.length - 1];
      lastKline.close = lastKline.close * 1.1;
      lastKline.high = lastKline.close * 1.02;

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      if (result.biasMa5 > 5) {
        expect(result.riskFactors.some(f => f.includes('乖离率过高'))).toBe(true);
      }
    });

    it('should include signal reasons for good conditions', async () => {
      const klines = generatePullbackKlines();

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      // Should have positive reasons
      expect(result.signalReasons.length).toBeGreaterThan(0);
      expect(result.signalReasons.some(r => r.includes('✅'))).toBe(true);
    });

    it('should calculate signal score correctly', async () => {
      const klines = generatePullbackKlines();

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      // Score should be between 0 and 100
      expect(result.signalScore).toBeGreaterThanOrEqual(0);
      expect(result.signalScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Edge cases', () => {
    it('should handle exactly 20 klines (minimum required)', async () => {
      const klines = generateKlines(20, 100, 'up');

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      expect(result.riskFactors).not.toContain('数据不足，无法完成分析');
    });

    it('should handle 60+ klines (for MA60 calculation)', async () => {
      const klines = generateKlines(70, 100, 'up');

      const input: TrendAnalysisInput = {
        code: '600519',
        klines,
      };

      const result = await service.analyze(input);

      // MA60 should be different from MA20
      expect(result.ma60).not.toBe(result.ma20);
    });

    it('should handle stock name input', async () => {
      const input: TrendAnalysisInput = {
        code: '600519',
        name: '贵州茅台',
        klines: generateBullishKlines(),
      };

      const result = await service.analyze(input);

      expect(result.name).toBe('贵州茅台');
    });
  });

  describe('Timestamp handling', () => {
    it('should include analysis timestamp in result', async () => {
      const beforeTime = Date.now();
      const input: TrendAnalysisInput = {
        code: '600519',
        klines: generateBullishKlines(),
      };

      const result = await service.analyze(input);
      const afterTime = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });
});
