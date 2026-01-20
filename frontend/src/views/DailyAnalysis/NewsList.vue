<template>
  <div class="news-list">
    <div v-if="results.length === 0" class="empty-result">
      <el-empty :description="emptyText" />
    </div>

    <div v-else>
      <div
        v-for="(news, index) in results"
        :key="index"
        class="news-item"
      >
        <div class="news-header">
          <h4 class="news-title">
            <a :href="news.url" target="_blank" rel="noopener">{{ news.title }}</a>
          </h4>
          <div class="news-meta">
            <el-tag size="small" type="info">{{ news.source }}</el-tag>
            <span v-if="news.published_date" class="news-date">{{ news.published_date }}</span>
          </div>
        </div>
        <p class="news-snippet">{{ news.snippet }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface NewsItem {
  title: string
  snippet: string
  url: string
  source: string
  published_date?: string
}

interface Props {
  results: NewsItem[]
  emptyText?: string
}

withDefaults(defineProps<Props>(), {
  emptyText: '未找到相关新闻'
})
</script>

<style lang="scss" scoped>
.news-list {
  .empty-result {
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .news-item {
    padding: 16px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);

    &:last-child {
      border-bottom: none;
    }

    .news-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;

      .news-title {
        margin: 0;
        flex: 1;

        a {
          color: var(--el-text-color-primary);
          text-decoration: none;
          transition: color 0.3s;

          &:hover {
            color: var(--el-color-primary);
          }
        }
      }

      .news-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: 16px;
        flex-shrink: 0;

        .news-date {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }
    }

    .news-snippet {
      margin: 0;
      color: var(--el-text-color-secondary);
      line-height: 1.6;
      font-size: 14px;
    }
  }
}
</style>
