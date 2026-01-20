<template>
  <div class="watchlist-manager">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>
            <el-icon><Star /></el-icon>
            自选股管理
          </span>
          <el-button type="primary" @click="showAddDialog = true">
            <el-icon><Plus /></el-icon>
            添加股票
          </el-button>
        </div>
      </template>

      <!-- 统计信息 -->
      <div class="stats-row">
        <el-statistic title="自选股数量" :value="watchlist.stocks?.length || 0" />
        <el-statistic title="最后更新" :value="lastUpdateTime" />
      </div>

      <!-- 股票列表 -->
      <el-table :data="watchlist.stocks" v-loading="loading" stripe>
        <el-table-column prop="code" label="代码" width="100" />
        <el-table-column prop="name" label="名称" width="150" />
        <el-table-column prop="notes" label="备注" />
        <el-table-column prop="add_time" label="添加时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.add_time) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              @click="analyzeStock(row.code)"
            >
              分析
            </el-button>
            <el-button
              type="danger"
              link
              size="small"
              @click="removeStock(row.code)"
            >
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty
        v-if="!loading && (!watchlist.stocks || watchlist.stocks.length === 0)"
        description="暂无自选股，点击上方按钮添加"
      />
    </el-card>

    <!-- 添加股票对话框 -->
    <el-dialog
      v-model="showAddDialog"
      title="添加自选股"
      width="400px"
    >
      <el-form :model="addForm" label-width="80px">
        <el-form-item label="股票代码">
          <el-input
            v-model="addForm.code"
            placeholder="例如: 600519"
            maxlength="6"
          />
        </el-form-item>
        <el-form-item label="股票名称">
          <el-input
            v-model="addForm.name"
            placeholder="例如: 贵州茅台"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="addForm.notes"
            type="textarea"
            placeholder="可选"
            :rows="2"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="addStock" :loading="addLoading">
          添加
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Star, Plus } from '@element-plus/icons-vue'
import axios from 'axios'

const router = useRouter()

// 数据状态
const loading = ref(false)
const watchlist = ref<any>({
  id: 'default',
  name: '默认自选股',
  stocks: [],
  stock_codes: []
})

// 添加对话框
const showAddDialog = ref(false)
const addLoading = ref(false)
const addForm = ref({
  code: '',
  name: '',
  notes: ''
})

// 获取自选股列表
const fetchWatchlist = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/daily-analysis/watchlist')
    watchlist.value = response.data
  } catch (error) {
    ElMessage.error('获取自选股列表失败')
  } finally {
    loading.value = false
  }
}

// 添加股票
const addStock = async () => {
  if (!addForm.value.code || !addForm.value.name) {
    ElMessage.warning('请输入股票代码和名称')
    return
  }

  addLoading.value = true
  try {
    await axios.post('/api/daily-analysis/watchlist/add', null, {
      params: {
        code: addForm.value.code,
        name: addForm.value.name,
        notes: addForm.value.notes
      }
    })
    ElMessage.success('添加成功')
    showAddDialog.value = false
    addForm.value = { code: '', name: '', notes: '' }
    await fetchWatchlist()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '添加失败')
  } finally {
    addLoading.value = false
  }
}

// 移除股票
const removeStock = async (code: string) => {
  try {
    await ElMessageBox.confirm(
      `确定要将 ${code} 从自选股中移除吗？`,
      '确认移除',
      { type: 'warning' }
    )
    await axios.delete(`/api/daily-analysis/watchlist/remove/${code}`)
    ElMessage.success('移除成功')
    await fetchWatchlist()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '移除失败')
    }
  }
}

// 分析股票
const analyzeStock = (code: string) => {
  // 跳转到趋势分析页面并传入代码
  router.push({ name: 'DailyAnalysisHome', query: { code, tab: 'trend' } })
}

// 格式化时间
const formatTime = (timeStr: string) => {
  if (!timeStr) return '-'
  return new Date(timeStr).toLocaleString('zh-CN')
}

// 最后更新时间
const lastUpdateTime = ref('-')

onMounted(() => {
  fetchWatchlist()
})
</script>

<style lang="scss" scoped>
.watchlist-manager {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    span {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
  }

  .stats-row {
    display: flex;
    gap: 40px;
    margin-bottom: 20px;
    padding: 16px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
  }

  .el-table {
    margin-top: 16px;
  }
}
</style>
