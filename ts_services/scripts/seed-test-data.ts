/**
 * MongoDB Test Data Seeder
 *
 * Populates MongoDB with sample financial and historical K-line data
 * for testing the v2 API endpoints.
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { Logger } from '../src/utils/logger.js';

const logger = Logger.for('TestDataSeeder');

// MongoDB connection - build from environment variables
function getMongoConfig() {
  // If MONGODB_URI is provided, use it directly
  if (process.env.MONGODB_URI) {
    return {
      uri: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB_NAME || process.env.MONGO_DB_NAME || 'tradingagents',
    };
  }

  // Build connection string from components
  const host = process.env.MONGODB_HOST || 'localhost';
  const port = process.env.MONGODB_PORT || '27017';
  const username = process.env.MONGODB_USERNAME || 'admin';
  const password = process.env.MONGODB_PASSWORD || 'tradingagents123';
  const authSource = process.env.MONGODB_AUTH_SOURCE || 'admin';
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || 'tradingagents';

  const uri = `mongodb://${username}:${password}@${host}:${port}/${dbName}?authSource=${authSource}`;

  return { uri, dbName };
}

const { uri: MONGO_URI, dbName: DB_NAME } = getMongoConfig();

// Test stock
const TEST_SYMBOL = '000001';
const TEST_SYMBOL_NAME = '平安银行';

/**
 * Sample financial data
 */
const SAMPLE_FINANCIAL_DATA = {
  symbol: TEST_SYMBOL,
  code: TEST_SYMBOL,
  data_source: 'tushare',
  report_type: 'quarterly',

  // Q4 2024
  reports: [
    {
      report_period: '20241231',
      report_date: '2025-01-20',
      data_source: 'tushare',
      report_type: 'quarterly',

      // Financial indicators
      financial_indicators: {
        roe: 12.5,              // 净资产收益率
        debt_to_assets: 92.3,    // 资产负债率
        current_ratio: 1.8,      // 流动比率
        quick_ratio: 1.2,        // 速动比率
        gross_profit_margin: 45.2, // 毛利率
        net_profit_margin: 18.5,   // 净利率
      },

      // Profit statement (in million yuan)
      revenue: 156800000000,
      revenue_ttm: 623400000000,
      net_profit: 28950000000,
      operating_profit: 35200000000,
      total_profit: 35680000000,

      // Balance sheet
      total_assets: 4587000000000,
      total_liabilities: 4236000000000,
      shareholder_equity: 351000000000,

      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      report_period: '20240930',
      report_date: '2024-10-25',
      data_source: 'tushare',
      report_type: 'quarterly',

      financial_indicators: {
        roe: 11.8,
        debt_to_assets: 91.5,
        current_ratio: 1.7,
        quick_ratio: 1.1,
        gross_profit_margin: 44.8,
        net_profit_margin: 17.2,
      },

      revenue: 152300000000,
      revenue_ttm: 589200000000,
      net_profit: 26180000000,
      operating_profit: 31800000000,
      total_profit: 32250000000,

      total_assets: 4456000000000,
      total_liabilities: 4082000000000,
      shareholder_equity: 374000000000,

      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      report_period: '20240630',
      report_date: '2024-08-20',
      data_source: 'tushare',
      report_type: 'quarterly',

      financial_indicators: {
        roe: 10.5,
        debt_to_assets: 90.8,
        current_ratio: 1.6,
        quick_ratio: 1.0,
        gross_profit_margin: 43.2,
        net_profit_margin: 16.0,
      },

      revenue: 145600000000,
      revenue_ttm: 543100000000,
      net_profit: 23250000000,
      operating_profit: 28400000000,
      total_profit: 28780000000,

      total_assets: 4289000000000,
      total_liabilities: 3897000000000,
      shareholder_equity: 392000000000,

      created_at: new Date(),
      updated_at: new Date(),
    },
  ],
};

/**
 * Sample historical K-line data (daily)
 */
function generateSampleKlineData(symbol: string, startDate: string, days: number) {
  const data = [];
  const start = new Date(startDate);
  let price = 10.50; // Starting price

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() - i); // Go backwards

    // Skip weekends
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    // Simulate price movement
    const change = (Math.random() - 0.5) * 0.4; // Random change ±0.2
    price = price + change;

    const open = price;
    const close = price + (Math.random() - 0.5) * 0.1;
    const high = Math.max(open, close) + Math.random() * 0.05;
    const low = Math.min(open, close) - Math.random() * 0.05;
    const volume = Math.floor(Math.random() * 1000000) + 500000;

    const change_amt = close - open;
    const change_pct = (change_amt / open) * 100;

    data.push({
      symbol: symbol,
      code: symbol,
      trade_date: date.toISOString().split('T')[0].replace(/-/g, ''), // YYYYMMDD
      date: date.toISOString().split('T')[0], // YYYY-MM-DD
      data_source: 'tushare',
      period: 'daily',

      // OHLCV
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: volume,
      amount: volume * close,

      // Additional metrics
      change_pct: Number(change_pct.toFixed(2)),
      change_amt: Number(change_amt.toFixed(2)),
      turnover_rate: Number((Math.random() * 2).toFixed(2)),

      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  return data;
}

/**
 * Seed financial data
 */
async function seedFinancialData(db: Db): Promise<void> {
  const collection = db.collection('stock_financial_data');

  logger.info('Seeding financial data...');

  // Clear existing data for test symbol
  await collection.deleteMany({ symbol: TEST_SYMBOL });

  // Insert sample reports - add symbol to each report
  const documents = SAMPLE_FINANCIAL_DATA.reports.map(report => ({
    ...report,
    symbol: TEST_SYMBOL,
    code: TEST_SYMBOL,
  }));
  await collection.insertMany(documents);

  logger.info(`✅ Inserted ${documents.length} financial reports for ${TEST_SYMBOL}`);
}

/**
 * Seed historical K-line data
 */
async function seedHistoricalData(db: Db): Promise<void> {
  const collection = db.collection('stock_daily_data');

  logger.info('Seeding historical K-line data...');

  // Clear existing data for test symbol
  await collection.deleteMany({ symbol: TEST_SYMBOL });

  // Generate 60 trading days of data
  const data = generateSampleKlineData(TEST_SYMBOL, '2025-01-20', 90);

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await collection.insertMany(batch);
  }

  logger.info(`✅ Inserted ${data.length} K-line records for ${TEST_SYMBOL}`);

  // Print data range
  const sortedData = data.sort((a, b) => b.trade_date.localeCompare(a.trade_date));
  if (sortedData.length > 0) {
    logger.info(`   Date range: ${sortedData[sortedData.length - 1].date} to ${sortedData[0].date}`);
  }
}

/**
 * Verify seeded data
 */
async function verifySeededData(db: Db): Promise<void> {
  logger.info('Verifying seeded data...');

  // Check financial data
  const financialCollection = db.collection('stock_financial_data');
  const financialCount = await financialCollection.countDocuments({ symbol: TEST_SYMBOL });
  const latestFinancial = await financialCollection
    .find({ symbol: TEST_SYMBOL })
    .sort({ report_period: -1 })
    .limit(1)
    .toArray();

  logger.info(`Financial data: ${financialCount} records`);
  if (latestFinancial.length > 0) {
    logger.info(`   Latest report: ${latestFinancial[0].report_period}`);
    logger.info(`   ROE: ${latestFinancial[0].financial_indicators?.roe}%`);
  }

  // Check historical data
  const historicalCollection = db.collection('stock_daily_data');
  const historicalCount = await historicalCollection.countDocuments({ symbol: TEST_SYMBOL });
  const latestKline = await historicalCollection
    .find({ symbol: TEST_SYMBOL })
    .sort({ trade_date: -1 })
    .limit(1)
    .toArray();

  logger.info(`Historical K-line data: ${historicalCount} records`);
  if (latestKline.length > 0) {
    logger.info(`   Latest date: ${latestKline[0].date}`);
    logger.info(`   Close price: ${latestKline[0].close}`);
  }

  logger.info('✅ Data verification complete');
}

/**
 * Main seeder function
 */
async function seedTestData(): Promise<void> {
  let client: MongoClient | null = null;

  try {
    logger.info('='.repeat(60));
    logger.info('MongoDB Test Data Seeder');
    logger.info('='.repeat(60));
    logger.info(`MongoDB URI: ${MONGO_URI.replace(/:.*@/, ':****@')}`);
    logger.info(`Database: ${DB_NAME}`);
    logger.info(`Test Symbol: ${TEST_SYMBOL}`);
    logger.info('='.repeat(60));

    // Connect to MongoDB
    client = new MongoClient(MONGO_URI);
    await client.connect();
    logger.info('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Seed data
    await seedFinancialData(db);
    await seedHistoricalData(db);

    // Verify
    await verifySeededData(db);

    logger.info('='.repeat(60));
    logger.info('✅ Test data seeding completed successfully!');
    logger.info('='.repeat(60));

  } catch (error) {
    logger.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      logger.info('MongoDB connection closed');
    }
  }
}

// Run the seeder
seedTestData()
  .then(() => {
    logger.info('TestDataSeeder completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('TestDataSeeder failed:', error);
    process.exit(1);
  });
