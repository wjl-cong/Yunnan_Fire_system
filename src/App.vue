<script setup>
import { ref, onMounted, onUnmounted, inject, nextTick, computed } from 'vue'
import Clock from '@/components/clock.vue'
import MapModule from '@/components/map.vue'
import { downloadMap } from '@/utils/downLoad'
import { upDateCurrentTime, upDateCurrentDate, fethLocation, fethWeather } from '@/utils/timeWeather'
import { createDraw } from '@/utils/draw'
import { calculateArea, calculateDistance } from '@/utils/computed'
import { ElMessage } from 'element-plus'

// 引入图表
import RightFirstChart from './views/chart/proportionFireRiskWarnings.vue'
import RightSecondChart from './views/chart/distributionFireRiskWarning.vue'
import LeftFirstChart from './views/chart/historicalFireHazardLevel.vue'
import LeftSecondChart from './views/chart/historicalFireFrequency.vue'

// 引入 OpenLayers
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import { Heatmap as HeatmapLayer } from 'ol/layer'
import GeoJSON from 'ol/format/GeoJSON'

// 引入数据
import fireDataJson from '@/assets/Yunnan_fire.json'
import borderDataJson from '@/assets/Yunnan_border.json'

const currentTime = ref('')
const currentDate = ref('')
const weatherInfo = ref(null)
const activeTool = ref('')
const layers = ref([])

const cityOptions = computed(() => {
  return borderDataJson.features.map(f => f.properties.name)
})

let drawSource = {}
let map = null // 地图实例
const mapRef = ref(null) // 地图组件引用

let drawInteraction = null
let measureInteraction = null
let measureSource = new VectorSource()
let measureLayer = new VectorLayer({
  source: measureSource,
  title: '测量图层'
})

// 火点详情抽屉
const drawerVisible = ref(false)
const clusterData = ref([])

// --- 数据切换与搜索 ---
const currentDataType = ref('history') // 'history' | 'predict'
const searchDate = ref('')
const searchCity = ref('')

const historyFireData = ref(fireDataJson)
const predictFireData = ref({ type: 'FeatureCollection', features: [] }) // 预测数据占位

// 计算当前显示的火点数据
const displayFireData = computed(() => {
  let sourceData = currentDataType.value === 'history' ? historyFireData.value : predictFireData.value
  
  // 如果是预测模式且无数据，直接返回空
  if (currentDataType.value === 'predict' && sourceData.features.length === 0) {
    return sourceData
  }

  // 按日期筛选
  if (searchDate.value) {
    const features = sourceData.features.filter(f => f.properties.acq_date && f.properties.acq_date.startsWith(searchDate.value))
    return { ...sourceData, features }
  }

  return sourceData
})

// 切换数据类型
const toggleDataType = (type) => {
  currentDataType.value = type
  if (type === 'predict') {
    ElMessage.info('预测火点数据暂未接入')
  }
}

// 执行搜索
const handleSearch = () => {
  // 1. 日期筛选已通过 computed 自动处理
  
  // 2. 城市定位
  if (searchCity.value) {
    const cityFeature = borderDataJson.features.find(f => f.properties.name.includes(searchCity.value))
    if (cityFeature) {
      const geometry = new GeoJSON().readFeature(cityFeature).getGeometry()
      // 转换坐标系 (数据是4326，视图也是4326，无需转换)
      const extent = geometry.getExtent()
      if (mapRef.value) {
        mapRef.value.flyToExtent(extent)
        mapRef.value.highlightCity(cityFeature)
        ElMessage.success(`已定位到 ${cityFeature.properties.name}`)
      }
    } else {
      ElMessage.warning('未找到该城市，请检查输入')
    }
  } else if (searchDate.value) {
     ElMessage.success(`已筛选 ${searchDate.value} 的火点数据`)
  }
}

// --- End 数据切换与搜索 ---

//天气开关
const amapKey = 'b09f93666c56d12e71ac488e70cdf2d3'
const showWeather = ref(false)
const toggleWeather = () => {
  showWeather.value = !showWeather.value
}

// 处理地图加载完成事件
const handleMapLoaded = (mapInstance) => {
  map = mapInstance
  console.log('Map loaded in App.vue', map)
  
  // 初始化图层列表
  layers.value = map.getLayers().getArray()
  
  // 初始化画笔图层
  drawSource = {
    Point: new VectorSource(),
    LineString: new VectorSource(),
    Polygon: new VectorSource(),
    Circle: new VectorSource()
  }
  
  for (const [type, source] of Object.entries(drawSource)) {
    const drawLayer = new VectorLayer({
      source,
      title: '画笔图层'
    })
    map.addLayer(drawLayer)
  }
  
  // 添加测量图层
  map.addLayer(measureLayer)
}

// 处理聚合点击事件
const handleClusterClick = (data) => {
  clusterData.value = data
  drawerVisible.value = true
}

// 设置动画效果
const animateView = () => {
  if (!map) return
  const view = map.getView()
  view.cancelAnimations()
  view.animate({
    center: [102.42, 25.02],
    zoom: 6,
    duration: 1000
  })
}

// 设置画笔激活
const activeDrawTool = (type) => {
  if (!map) return
  // Clear other interactions
  if (measureInteraction) {
    map.removeInteraction(measureInteraction)
    measureInteraction = null
  }
  if (drawInteraction) {
    map.removeInteraction(drawInteraction)
    drawInteraction = null
  }

  drawInteraction = createDraw({
    type,
    source: drawSource[type]
  })
  map.addInteraction(drawInteraction)
  
  drawInteraction.on('drawend', () => {
    // Optional: Keep drawing or stop after one shape. Usually keep drawing for tools.
    // map.removeInteraction(drawInteraction)
    // drawInteraction = null
  })
}

// 清空画布
const clearDraw = () => {
  for (const key in drawSource) {
    drawSource[key].clear()
  }
  // Also clear measure source
  measureSource.clear()
  // Also remove overlays if any (for measure tooltip)
  map.getOverlays().getArray().slice(0).forEach(overlay => map.removeOverlay(overlay))
}

// 激活 测量工具
const activeMeasureTool = (type) => {
  if (!map) return
  // Clear other interactions
  if (drawInteraction) {
    map.removeInteraction(drawInteraction)
    drawInteraction = null
  }
  if (measureInteraction) {
    map.removeInteraction(measureInteraction)
    measureInteraction = null
  }

  measureInteraction = createDraw({
    type,
    source: measureSource
  })
  map.addInteraction(measureInteraction)
  measureInteraction.on('drawend', (e) => {
    const geometry = e.feature.getGeometry()
    let coordinates = geometry.getCoordinates()
    if (type === 'LineString') {
      calculateDistance(coordinates)
    } else if (type === 'Polygon') {
      const exteriorRing = coordinates[0]
      calculateArea(exteriorRing)
    }
    map.removeInteraction(measureInteraction)
    measureInteraction = null
  })
}

onMounted(() => {
  upDateCurrentTime(currentTime)
  upDateCurrentDate(currentDate)
  const loadWeather = async () => {
    try {
      await fethLocation(amapKey, (city) => {
        fethWeather(city, amapKey, weatherInfo)
      })
      // 3秒后如果没有获取到，强制使用默认值
      // setTimeout(() => {
      //   if (!weatherInfo.value) fethWeather('昆明市', amapKey, weatherInfo)
      // }, 3000)
    } catch (e) {
      console.error('Auto location failed:', e)
      // fethWeather('昆明市', amapKey, weatherInfo) // Disable fallback
    }
  }
  loadWeather()
  const timer = setInterval(() => {
    upDateCurrentTime(currentTime)
    upDateCurrentDate(currentDate)
  }, 1000)

  onUnmounted(() => {
    clearInterval(timer)
    if (map) {
       if (drawInteraction) map.removeInteraction(drawInteraction)
       if (measureInteraction) map.removeInteraction(measureInteraction)
       map.setDoubleClickZoom(true)
    }
  })
})

// 切换工具
const toggleToolMenu = (tool) => {
  if (activeTool.value === tool) {
    activeTool.value = ''
  } else {
    activeTool.value = tool
  }
}

// 切换图层显隐
const toggleLayer = (layer) => {
  const currentVisibility = layer.getVisible()
  layer.setVisible(!currentVisibility)
}

// 通过title移除地图
const removeLayerByTitle = (title) => {
  if (!map) return
  map.getLayers().getArray().forEach((layer) => {
    if (layer.get('title') === title) {
      map.removeLayer(layer)
    }
  })
}

// 通过title获取图层
const getLayerByTitle = (title) => {
  if (!map) return null
  return map.getLayers().getArray().find((layer) => {
    return layer.get('title') === title
  })
}

// 热力图
const showHeatmap = ref(false)
let heatMapLayer = ref(null) // 存储热力图图层实例

const performHeatmapAnalysis = () => {
  if (!map) return
  
  if (showHeatmap.value) {
    // 关闭热力图
    removeLayerByTitle('热力图')
    const pointLayer = getLayerByTitle('火点分布')
    if (pointLayer) pointLayer.setVisible(true)
  } else {
    // 创建热力图
    // 使用导入的 GeoJSON 数据创建 source
    // 注意：热力图也应该使用当前的 displayFireData
    const heatSource = new VectorSource({
      features: new GeoJSON().readFeatures(displayFireData.value)
    })

    heatMapLayer.value = new HeatmapLayer({
      source: heatSource,
      blur: 10,
      radius: 5,
      gradient: ['#00f', '#0ff', '#0f0', '#ff0', '#f00'],
      weight: (feature) => {
        const frp = feature.get('frp')
        return frp ? Math.min(frp / 100, 1) : 0.1
      },
    })
    removeLayerByTitle('热力图')
    const pointLayer = getLayerByTitle('火点分布')
    if (pointLayer) pointLayer.setVisible(false)
    
    heatMapLayer.value.set('title', '热力图')
    map.addLayer(heatMapLayer.value)
  }

  showHeatmap.value = !showHeatmap.value
  map.render()
}

</script>

<template>
  <div class="dashboard-container">
    
    
    
    <div class="header">
      <!-- 左上角天气 -->
      <div class="header-weather">
        <div class="weather-button-mini" @click.stop="toggleWeather">
          <i class="iconfont icon-duoyun"></i>
          <span v-if="weatherInfo && weatherInfo.city">{{ weatherInfo.city }} {{ weatherInfo.temperature }}℃</span>
          <span v-else>正在获取天气...</span>
        </div>
        <div class="weather-popup" v-if="showWeather && weatherInfo && weatherInfo.city" @click.stop>
          <div class="weather-details">
            <div class="city">
              <div>{{ weatherInfo.city }}</div>
              <span>{{ weatherInfo.weather }}</span>
            </div>
            <div class="info">
              <span><i class="iconfont icon-wendu"></i>{{ weatherInfo.temperature }}℃</span>
              <span><i class="iconfont icon-fengxiang"></i>{{ weatherInfo.winddirection }}</span>
              <span><i class="iconfont icon-shidu"></i>{{ weatherInfo.humidity }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 绝对居中的标题及其下方的控制按钮 -->
      <div class="title-container">
        <div class="title-wrapper">
          <img class="logo" src="/src/assets/logo.png" alt="logo" />
          <h1 class="title">云南省火险预警数据大屏</h1>
        </div>
        
        <!-- 新增：标题正下方的控制区 -->
        <div class="center-controls">
          <div class="control-left">
            <el-button-group>
              <el-button 
                :type="currentDataType === 'history' ? 'primary' : 'default'" 
                @click="toggleDataType('history')"
                size="small"
              >
                历史火点数据
              </el-button>
              <el-button 
                :type="currentDataType === 'predict' ? 'primary' : 'default'" 
                @click="toggleDataType('predict')"
                size="small"
              >
                预测火点数据
              </el-button>
            </el-button-group>
          </div>

          <div class="control-right">
            <div class="search-box">
              <el-date-picker
                v-model="searchDate"
                type="month"
                placeholder="月份"
                size="small"
                format="YYYY-MM"
                value-format="YYYY-MM"
                style="width: 90px; margin-right: 5px;"
              />
              <el-select
                v-model="searchCity"
                placeholder="城市"
                size="small"
                style="width: 90px; margin-right: 5px;"
                filterable
                clearable
              >
                <el-option
                  v-for="city in cityOptions"
                  :key="city"
                  :label="city"
                  :value="city"
                />
              </el-select>
              <el-button type="primary" size="small" icon="Search" @click="handleSearch">搜索</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右上角时间 -->
      <div class="header-time">
        <Clock />
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧面板 -->
      <div class="side-panel left">
        <div class="chart panel">
          <div class="title">历史火点危害等级</div>
          <div class="chart-container">
            <LeftFirstChart />
          </div>
        </div>
        <div class="chart panel">
          <div class="title">历史火点发生频次</div>
          <div class="chart-container">
            <LeftSecondChart />
          </div>
        </div>
      </div>

      <!-- 中间地图 -->
      <div class="map-container">
        <div class="map">
          <MapModule 
            ref="mapRef" 
            :fireData="displayFireData"
            @map-loaded="handleMapLoaded" 
            @cluster-click="handleClusterClick" 
          />
        </div>
        <div class="toolbox">
          <div class="tool-item" @click="toggleToolMenu('layer')">
            <i class="iconfont icon-023tuceng"></i>
            <div class="text">图层管理</div>
            <div v-if="activeTool === 'layer'" class="tool-options">
              <div
                v-for="layer in layers"
                :key="layer.get('title')"
                @click="toggleLayer(layer)"
                :class="{ activelayer: layer.getVisible() }"
              >
                {{ layer.get("title") }}
              </div>
            </div>
          </div>
          <div class="tool-item" @click="toggleToolMenu('draw')">
            <i class="iconfont icon-xihuabi"></i>
            <div class="text">画笔</div>
            <div v-if="activeTool === 'draw'" class="tool-options">
              <div @click="activeDrawTool('Point')">点画笔</div>
              <div @click="activeDrawTool('LineString')">线画笔</div>
              <div @click="activeDrawTool('Polygon')">面画笔</div>
              <div @click="clearDraw">清空画布</div>
            </div>
          </div>
          <div class="tool-item" @click="toggleToolMenu('measure')">
            <i class="iconfont icon-celiangleixing"></i>
            <div class="text">测量</div>
            <div v-if="activeTool === 'measure'" class="tool-options">
              <div @click="activeMeasureTool('LineString')">测量距离</div>
              <div @click="activeMeasureTool('Polygon')">测量面积</div>
            </div>
          </div>
          <div class="tool-item" @click="toggleToolMenu('analysis')">
            <i class="iconfont icon-relitu" :class="{ 'active-tool': showHeatmap }"></i>
            <div class="text" @click="performHeatmapAnalysis">
            {{ showHeatmap ? '关闭热力' : '热力图' }}
            </div>
          </div>
          <div class="tool-item">
            <i class="iconfont icon-ico_dituxiazai"></i>
            <div class="text" @click="downloadMap(map)">下载地图</div>
          </div>
          <div class="tool-item">
            <i class="iconfont icon-ditu01"></i>
            <div class="text" @click="animateView">定位到云南</div>
          </div>
        </div>
      </div>

      <!-- 右侧面板 -->
      <div class="side-panel right">
        <div class="chart panel">
          <div class="title">昼夜火点分布</div>
          <div class="chart-container">
            <RightFirstChart />
          </div>
        </div>
        <div class="chart panel">
          <div class="title">火点辐射功率(FRP)分布</div>
          <div class="chart-container">
            <RightSecondChart />
          </div>
        </div>
      </div>
    </div>
    
    <!-- 侧边详情抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      title="区域火点详细信息"
      direction="rtl"
      size="400px"
      :modal="false" 
      :lock-scroll="false"
      class="fire-drawer"
    >
      <el-table :data="clusterData" style="width: 100%" height="calc(100vh - 100px)" stripe>
        <el-table-column prop="acq_date" label="日期" width="100" />
        <el-table-column prop="acq_time" label="时间" width="60" />
        <el-table-column prop="frp" label="FRP" width="60" />
        <el-table-column prop="conf" label="置信度" width="70">
           <template #default="scope">
              <el-tag :type="scope.row.conf === 'high' ? 'danger' : 'success'" size="small">
                {{ scope.row.conf === 'high' ? '高' : '低' }}
              </el-tag>
            </template>
        </el-table-column>
      </el-table>
    </el-drawer>

    <div class="footer">
      © 2026 云南省火险预警数据大屏&nbsp;<a href="">HXP</a>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-container {
  user-select: none;
  width: 100%;
  height: 100vh;
  background: url("@/assets/dashBoardBG.jpeg") no-repeat center -12px;
  background-size: cover;
  position: relative;
  overflow: hidden;
}

// 通用面板样式
.panel {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-width: 0.6375rem 0.475rem 0.25rem 1.65rem;
  border-image-source: url("@/assets/border.png");
  border-image-slice: 51 38 20 132;
  border-image-repeat: stretch;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(2px);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
  padding-right: 5px;
  margin-bottom: 20px;
  width: 100%;
  height: 250px;
  display: flex;
  flex-direction: column;

  .title {
    text-align: center;
    margin-bottom: 5px;
    color: #ffffff;
    font-weight: bold;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    flex-shrink: 0;
  }

  .chart-container {
    flex: 1;
    width: 100%;
    overflow: hidden;
  }

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  }
}





/* 头部布局深度融合重构 - 标题居中且控制按钮位于其正下方 */
.header {
  width: 100%;
  height: 70px; /* 增加高度以容纳下移的按钮 */
  background: url("@/assets/Header.png") no-repeat center center;
  background-size: 100% 100%;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0 20px;
  position: relative;
  z-index: 1000;

  .header-weather {
    margin-top: 15px;
    width: 220px;
    position: relative;
    z-index: 1002;
    
    .weather-button-mini {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #fff;
      cursor: pointer;
      background: rgba(0, 162, 255, 0.1);
      border: 1px solid rgba(0, 162, 255, 0.2);
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 13px;
      backdrop-filter: blur(4px);
      &:hover { background: rgba(0, 162, 255, 0.3); }
      .iconfont { font-size: 16px; color: #ffdd57; }
    }

    /* 修复：天气弹出框定位在右侧 */
    .weather-popup {
      position: absolute;
      top: 0px;
      left: 100%; /* 定位在按钮右侧 */
      margin-left: -95px;
      background: rgba(13, 27, 46, 0.95);
      border: 1px solid #409eff;
      border-radius: 8px;
      padding: 15px;
      color: #fff;
      min-width: 220px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      z-index: 1003;
      .weather-details {
        .city { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; font-size: 16px; }
        .info { display: flex; justify-content: space-between; font-size: 13px; .iconfont { color: #409eff; margin-right: 4px; } }
      }
    }
  }

  /* 标题及其下方控制按钮的容器 */
  .title-container {
    position: absolute;
    left: 50%;
    top: 0;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    height: auto;
    width: auto;
    
    .title-wrapper {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 15px;
      margin-top: 0;
      .logo { width: 42px; height: 42px; border-radius: 50%; filter: drop-shadow(0 0 8px rgba(0, 162, 255, 0.8)); }
      .title { 
        font-size: 35px; 
        letter-spacing: 3px;
        font-weight: bold; 
        color: #fff; 
        text-shadow: 0 0 15px rgba(0, 162, 255, 0.6), 0 2px 4px rgba(0,0,0,0.5); 
        margin: 0; 
      }
    }

    /* 按钮控制区：位于标题正下方 */
    .center-controls {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 30px;
      margin-top: 12px; /* 适度回调，消除过大空白 */
      
      .control-left, .control-right {
        display: flex;
        align-items: center;
      }

      .el-button {
        background: rgba(0, 40, 80, 0.4) !important;
        border: 1px solid rgba(0, 162, 255, 0.3) !important;
        color: #fff !important;
        height: 26px;
        font-size: 12px;
        &.el-button--primary {
          background: rgba(0, 162, 255, 0.3) !important;
          border-color: #00a2ff !important;
        }
      }

      .search-box {
        display: flex;
        align-items: center;
        background: rgba(0, 40, 80, 0.4);
        padding: 2px 8px;
        border-radius: 4px;
        border: 1px solid rgba(0, 162, 255, 0.3);
        
        :deep(.el-input__wrapper) {
          background: transparent !important;
          box-shadow: none !important;
          height: 24px;
          .el-input__inner { color: #fff !important; font-size: 12px; }
        }
        
        .el-button {
          height: 24px;
          background: #0066cc !important;
          border: none !important;
        }
      }
    }
  }

  .header-time {
    margin-top: 12px;
    width: 180px;
    display: flex;
    justify-content: flex-end; padding-right: 20px;
    z-index: 1002;
  }
}





/* 抽屉样式深度优化 */
:deep(.fire-drawer) {
  .el-drawer__header {
    background-color: #0d1b2e !important;
    margin-bottom: 0 !important;
    padding: 15px 20px !important;
    color: #fff !important;
    border-bottom: 1px solid rgba(64, 158, 255, 0.3) !important;
  }
  .el-drawer__body {
    background-color: #0d1b2e !important;
    padding: 10px !important;
  }
  .el-table {
    background-color: transparent !important;
    color: #fff !important;
    --el-table-border-color: rgba(255, 255, 255, 0.1);
    --el-table-header-bg-color: rgba(64, 158, 255, 0.1);
    --el-table-row-hover-bg-color: rgba(64, 158, 255, 0.2);
    
    tr, th, td {
      background-color: transparent !important;
      color: #fff !important;
    }
    
    // 解决斑马纹导致的白色背景
    &.el-table--striped .el-table__row--striped td {
      background-color: rgba(255, 255, 255, 0.05) !important;
    }
    
    .el-table__inner-wrapper::before {
      background-color: rgba(255, 255, 255, 0.1) !important;
    }
  }
}

// 内容区域
.main-content {
  display: flex;
  width: 100%;
  height: calc(100vh - 80px);
  color: white;
  
  .side-panel {
    width: 320px; /* 固定宽度 */
    padding: 0 15px;
    z-index: 99;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding-top: 20px;
  }

  .left {
    align-items: flex-start;
  }

  .right {
    align-items: flex-end;
  }

  .map-container {
    position: relative;
    padding-top: 30px;
    flex: 1;
    .map {
      position: fixed;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.5);
    }
    .toolbox {
      position: absolute;
      bottom: 80px; /* 下调工具栏位置，使其紧邻页脚上方 */
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      display: flex;
      justify-content: space-between;

      .tool-item {
        position: relative; /* 设置相对定位以便子元素绝对定位 */
        width: 65px;
        height: 55px;
        background: url("@/assets/baseBottom.png") no-repeat center center;
        background-size: cover;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        .activelayer {
          color: #ffcc00; /* 高亮颜色 */
          font-weight: bold; /* 文字加粗 */
          text-shadow: 0 0 5px rgba(255, 255, 0, 0.7); /* 添加文本阴影以增强可见性 */
        }

        .iconfont {
          transform: translateY(-10px);
          color: #ffffff;
          font-size: 20px;
          transition: color 0.3s ease;
        }

        .text {
          transform: translateY(-8px);
          color: #ffffff;
          font-size: 12px;
          font-weight: bold;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
          transition: color 0.3s ease;
        }

        &:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);

          .iconfont,
          .text {
            color: #ffcc00;
          }
        }

        .tool-options {
          position: absolute; /* 绝对定位以便可以自由定位 */
          bottom: 80px; /* 初始位置在工具项的上方 */
          left: 50%;
          transform: translateX(-50%) translateY(10px); /* 向上偏移10px */
          opacity: 0; /* 初始透明度为0 */
          background-color: rgba(0, 0, 0, 0.8);
          border-radius: 5px;
          padding: 15px 10px;
          padding-bottom: 5px;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: opacity 0.3s ease, transform 0.3s ease; /* 添加过渡效果 */

          div {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-gap: 6x;
            color: #ffffff;
            font-size: 10px; /* 调小文字大小 */
            margin-bottom: 4px; /* 选项间距 */
            cursor: pointer;
            white-space: nowrap; /* 防止文字换行 */
          }
        }

        &:hover .tool-options {
          transform: translateX(-50%) translateY(0); /* 悬停时向上移动 */
          opacity: 1; /* 悬停时显示 */
        }
      }
    }
  }
}
.footer {
  user-select: text;
  text-align: center;
  position: fixed;
  bottom: 50px;
  padding: 6px;
  background-color: rgba(0, 0, 0, 0.7); /* 半透明的深色背景 */
  color: #f0f0f0; /* 柔和的白色文字 */
  left: 50%;
  transform: translateX(-50%);
  font: 200 12px "华文细黑";
  border-radius: 8px; /* 更圆的边角 */
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.2); /* 较轻的阴影效果 */
  .iconfont {
    font: 1em sans-serif;
    margin: 0 1px;
  }
  a {
    color: #ffdd57; /* 柔和的黄色 */
    text-decoration: none; /* 去掉下划线 */
    margin-left: 3px;
  }
}

/* 抽屉样式覆盖 */
:deep(.fire-drawer) {
  background-color: rgba(13, 27, 46, 0.95) !important;
  color: #fff !important;
  
  .el-drawer__header {
    color: #fff;
    margin-bottom: 10px;
  }
  
  .el-table {
    background-color: transparent !important;
    color: #fff;
    
    th, tr {
      background-color: transparent !important;
    }
    
    td {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .el-table__inner-wrapper::before {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }
}
</style>
