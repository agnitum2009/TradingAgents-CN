/**
 * Stock-related type definitions
 */

import type { Entity, Market, KlineInterval, TrendDirection, VolumeStatus } from './common.js';

/**
 * Basic stock information
 */
export interface StockBasic extends Entity {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** Market */
  market: Market;
  /** Industry */
  industry?: string;
  /** Sector */
  sector?: string;
  /** List date */
  listDate?: string;
  /** Is active */
  isActive: boolean;
}

/**
 * Kline (candlestick) data
 */
export interface Kline {
  /** Timestamp */
  timestamp: number;
  /** Open price */
  open: number;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Close price */
  close: number;
  /** Volume */
  volume: number;
  /** Amount (turnover) */
  amount?: number;
  /** Change percent */
  changePercent?: number;
  /** Change amount */
  changeAmount?: number;
}

/**
 * Real-time quote data
 */
export interface Quote {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** Current price */
  price: number;
  /** Change percent */
  changePercent: number;
  /** Change amount */
  changeAmount: number;
  /** Open price */
  open: number;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Previous close */
  preClose: number;
  /** Volume */
  volume: number;
  /** Amount */
  amount: number;
  /** Buy volume */
  bidVol?: number[];
  /** Buy price */
  bidPrice?: number[];
  /** Sell volume */
  askVol?: number[];
  /** Sell price */
  askPrice?: number[];
  /** Timestamp */
  timestamp: number;
  /** Is market open */
  isOpen: boolean;
}

/**
 * Technical indicator data point
 */
export interface IndicatorData {
  /** Timestamp */
  timestamp: number;
  /** Indicator value */
  value: number;
  /** Optional signal */
  signal?: string;
}

/**
 * MACD indicator
 */
export interface MACD {
  /** DIF line */
  dif: number;
  /** DEA line */
  dea: number;
  /** MACD histogram */
  histogram: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * KDJ indicator
 */
export interface KDJ {
  /** K line */
  k: number;
  /** D line */
  d: number;
  /** J line */
  j: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * RSI indicator
 */
export interface RSI {
  /** RSI value (0-100) */
  value: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Bollinger Bands
 */
export interface BollingerBands {
  /** Upper band */
  upper: number;
  /** Middle band (SMA) */
  middle: number;
  /** Lower band */
  lower: number;
  /** Bandwidth */
  bandwidth: number;
  /** %B position */
  percentB: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Moving average data
 */
export interface MovingAverage {
  /** MA value */
  value: number;
  /** MA period */
  period: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * All technical indicators combined
 */
export interface TechnicalIndicators {
  /** MACD data */
  macd: MACD[];
  /** KDJ data */
  kdj: KDJ[];
  /** RSI data */
  rsi: RSI[];
  /** Bollinger Bands */
  bollinger: BollingerBands[];
  /** Moving averages */
  ma: Record<number, MovingAverage[]>;
}

/**
 * Stock financial data
 */
export interface FinancialData {
  /** Stock code */
  code: string;
  /** Report date */
  reportDate: string;
  /** Report type */
  reportType: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'annual';

  // Income statement
  /** Total revenue */
  revenue?: number;
  /** Net profit */
  netProfit?: number;
  /** Gross profit margin */
  grossMargin?: number;
  /** Net profit margin */
  netMargin?: number;

  // Balance sheet
  /** Total assets */
  totalAssets?: number;
  /** Total liabilities */
  totalLiabilities?: number;
  /** Shareholder equity */
  equity?: number;

  // Cash flow
  /** Operating cash flow */
  operatingCashFlow?: number;
  /** Free cash flow */
  freeCashFlow?: number;

  // Ratios
  /** PE ratio */
  pe?: number;
  /** PB ratio */
  pb?: number;
  /** PS ratio */
  ps?: number;
  /** Debt to asset ratio */
  debtToAsset?: number;
  /** ROE */
  roe?: number;
  /** ROA */
  roa?: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Dividend information
 */
export interface Dividend {
  /** Stock code */
  code: string;
  /** Ex-dividend date */
  exDate: string;
  /** Dividend per share */
  dividendPerShare: number;
  /** Dividend yield */
  dividendYield?: number;
  /** Payout ratio */
  payoutRatio?: number;
}

/**
 * Corporate action
 */
export interface CorporateAction {
  /** Stock code */
  code: string;
  /** Action date */
  actionDate: string;
  /** Action type */
  actionType: 'dividend' | 'split' | 'bonus' | 'rights' | 'merger' | 'spinoff';
  /** Description */
  description: string;
  /** Details (JSON) */
  details: Record<string, unknown>;
}

/**
 * Watchlist item
 */
export interface WatchlistItem extends Entity {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** Notes */
  notes?: string;
  /** Tags */
  tags?: string[];
  /** Added date */
  addTime: number;
}

/**
 * Stock ranking data
 */
export interface StockRanking {
  /** Stock code */
  code: string;
  /** Stock name */
  name: string;
  /** Rank */
  rank: number;
  /** Score */
  score: number;
  /** Change in rank */
  rankChange?: number;
  /** Category */
  category: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Sector performance
 */
export interface SectorPerformance {
  /** Sector name */
  name: string;
  /** Change percent */
  changePercent: number;
  /** Leading stocks */
  leaders: string[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Market index data
 */
export interface MarketIndex {
  /** Index code */
  code: string;
  /** Index name */
  name: string;
  /** Current value */
  value: number;
  /** Change percent */
  changePercent: number;
  /** Change amount */
  changeAmount: number;
  /** Open */
  open: number;
  /** High */
  high: number;
  /** Low */
  low: number;
  /** Volume */
  volume: number;
  /** Amount */
  amount: number;
  /** Timestamp */
  timestamp: number;
}
