<script setup>
import { FullScreen, ScaleToOriginal } from '@element-plus/icons-vue'
import { onMounted, ref, nextTick, onUnmounted, computed } from 'vue'
import * as echarts from 'echarts'
import { parseGeoData } from '@/utils/parseGeoData'

const geoData = parseGeoData()
const chartRef = ref(null)      // 小图容器
const maxChartRef = ref(null)   // 大图容器
let chartInstance = null
let maxChartInstance = null

// 全屏状态
const isMaximized = ref(false)
const tableData = ref([])

// 分页配置
const currentPage = ref(1)
const pageSize = ref(20)

// 表格数据
tableData.value = geoData.rawFeatures

// 计算当前页数据
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return tableData.value.slice(start, end)
})

const handleCurrentChange = (val) => {
  currentPage.value = val
}



const option = {
  tooltip: {
    trigger: 'item',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    formatter: '{b}: {c} ({d}%)'
  },
  legend: {
    top: 'bottom',
    left: 'center',
    textStyle: { color: '#fff' }
  },
  series: [
    {
      name: '昼夜分布',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: false,
        position: 'center'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 20,
          fontWeight: 'bold',
          color: '#fff'
        }
      },
      labelLine: {
        show: false
      },
      data: [
        { value: geoData.dayNightCounts.D, name: '白天 (Day)', itemStyle: { color: '#FFCC00' } },
        { value: geoData.dayNightCounts.N, name: '夜间 (Night)', itemStyle: { color: '#003366' } }
      ]
    }
  ]
}

const initChart = () => {
  if (chartRef.value) {
    if (chartInstance) chartInstance.dispose()
    chartInstance = echarts.init(chartRef.value)
    chartInstance.setOption(option)
  }
}

const initMaxChart = () => {
  if (maxChartRef.value) {
    if (maxChartInstance) maxChartInstance.dispose()
    maxChartInstance = echarts.init(maxChartRef.value)
    // Create a deep copy of option for maximized view to enable labels
    const maxOption = JSON.parse(JSON.stringify(option))
    if (maxOption.series && maxOption.series[0]) {
        maxOption.series[0].label = { 
          show: true, 
          position: 'outside', 
          color: '#fff', 
          formatter: '{b}: {c} ({d}%)',
          fontSize: 14
        }
        maxOption.series[0].labelLine = { show: true, lineStyle: { color: '#fff' } }
    }
    maxOption.legend = { bottom: '0%', left: 'center', textStyle: { color: '#fff', fontSize: 14 } }
    
    maxChartInstance.setOption(maxOption)
  }
}

const toggleMaximize = async () => {
  isMaximized.value = !isMaximized.value
  await nextTick()
  if (isMaximized.value) {
    initMaxChart()
  } else {
    // 退出全屏时，重新调整小图大小
    chartInstance && chartInstance.resize()
  }
}

const handleResize = () => {
  chartInstance && chartInstance.resize()
  maxChartInstance && maxChartInstance.resize()
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chartInstance) chartInstance.dispose()
  if (maxChartInstance) maxChartInstance.dispose()
})
</script>

<template>
  <div class="chart-wrapper">
    <!-- 正常模式 -->
    <div class="normal-view">
      <div class="expand-btn" @click="toggleMaximize">
        <el-icon size="20"><FullScreen /></el-icon>
      </div>
      <div class="chart-area" ref="chartRef"></div>
    </div>

    <!-- 全屏模式 (Teleport) -->
    <Teleport to="body">
      <div v-if="isMaximized" class="maximized-view">
        <div class="header-bar">
          <span class="max-title">昼夜火点分布详情</span>
          <el-button type="primary" circle @click="toggleMaximize">
            <el-icon size="20"><ScaleToOriginal /></el-icon>
          </el-button>
        </div>

        <div class="content-container">
          <!-- 左侧大图 -->
          <div class="chart-area-max" ref="maxChartRef"></div>
          
          <!-- 右侧表格 -->
          <div class="table-area">
             <el-table :data="paginatedData" style="width: 100%" height="calc(100% - 50px)" stripe>
               
          <el-table-column prop="acq_date" label="日期" width="120" sortable />
          <el-table-column prop="daynight" label="昼夜" width="100">
             <template #default="scope">
              <el-tag :type="scope.row.daynight === 'D' ? 'success' : 'info'">
                {{ scope.row.daynight === 'D' ? '日' : '夜' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="latitude" label="纬度" width="100" />
          <el-table-column prop="longitude" label="经度" width="100" />

             </el-table>
             <div class="pagination-container">
               <el-pagination
                 v-model:current-page="currentPage"
                 v-model:page-size="pageSize"
                 :total="tableData.length"
                 layout="total, prev, pager, next"
                 @current-change="handleCurrentChange"
               />
             </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.chart-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.normal-view {
  width: 100%;
  height: 100%;
  position: relative;
  
  .expand-btn {
    position: absolute;
    top: 0px;
    right: 0px;
    cursor: pointer;
    color: #fff;
    z-index: 10;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
  
  .chart-area {
    width: 100%;
    height: 100%;
  }
}

.maximized-view {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99999;
  background: #0d1b2e;
  padding: 20px;
  display: flex;
  flex-direction: column;
  
  .header-bar { padding-right: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    .max-title {
      font-size: 24px;
      color: #fff;
      font-weight: bold;
    }
  }
  
  .content-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    gap: 20px;
    
    .chart-area-max {
      flex: 1;
      height: 100%;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
    }
    
    .table-area {
      flex: 1;
      height: 100%;
      background: #fff;
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      
      .pagination-container {
        margin-top: 10px;
        display: flex;
        justify-content: center;
      }
    }
  }
}
</style>
