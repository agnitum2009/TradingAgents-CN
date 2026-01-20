import type { App } from 'vue'
import MarketSelector from './Global/MarketSelector.vue'
import MultiMarketStockSearch from './Global/MultiMarketStockSearch.vue'
import WebSocketStatus from './WebSocket/WebSocketStatus.vue'
import RealTimeQuotes from './WebSocket/RealTimeQuotes.vue'
import AnalysisProgressBar from './WebSocket/AnalysisProgressBar.vue'

// 全局组件注册
export function setupGlobalComponents(app: App) {
  // 注册多市场相关组件
  app.component('MarketSelector', MarketSelector)
  app.component('MultiMarketStockSearch', MultiMarketStockSearch)

  // 注册WebSocket相关组件 (可选全局注册)
  // 如需使用，取消注释以下行：
  // app.component('WebSocketStatus', WebSocketStatus)
  // app.component('RealTimeQuotes', RealTimeQuotes)
  // app.component('AnalysisProgressBar', AnalysisProgressBar)
}

// 导出WebSocket组件供单独导入使用
export { WebSocketStatus, RealTimeQuotes, AnalysisProgressBar }

export default setupGlobalComponents
