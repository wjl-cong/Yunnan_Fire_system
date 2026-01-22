<script setup>
import { ref, onMounted, computed, markRaw, watch } from 'vue'
import 'ol/ol.css'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'
import Cluster from 'ol/source/Cluster'
import GeoJSON from 'ol/format/GeoJSON'
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style'
import { defaults as defaultInteractions, Select } from 'ol/interaction'
import { click } from 'ol/events/condition'

// 接收父组件传入的数据
const props = defineProps({
  fireData: {
    type: Object,
    default: () => ({ type: 'FeatureCollection', features: [] })
  }
})

// 引入边界数据 (用于底图显示，不变)
import yunnanBorder from '@/assets/Yunnan_border.json'

const emit = defineEmits(['map-loaded', 'cluster-click'])

// 根据火点置信度渲染颜色
const colors = ref({
  low: "#FFCC00",      // 黄色
  nominal: "#FF9900",  // 橙色
  high: "#FF0000",     // 红色
})

const getStyle = (feature) => {
  const conf = feature.get('conf') // 'low', 'nominal', 'high'
  const color = colors.value[conf] || '#999999' // 默认灰色
  return new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: color }),
      stroke: new Stroke({
        color: '#ffffff',
        width: 1
      })
    })
  })
}

// 设置聚合样式
const getClusterStyle = (feature) => {
  const size = feature.get('features').length
  let style

  if (size > 1) {
    const color = size > 20 ? '#ff0000' : size > 10 ? '#ff9900' : '#3399cc'
    const radius = Math.min(12 + size, 20)
    style = new Style({
      image: new CircleStyle({
        radius: radius,
        fill: new Fill({
          color: color
        }),
        stroke: new Stroke({
          color: '#fff',
          width: 2
        })
      }),
      text: new Text({
        text: size.toString(),
        fill: new Fill({
          color: '#fff'
        }),
        font: 'bold 14px Arial, sans-serif',
        stroke: new Stroke({
          color: '#000',
          width: 2
        }),
      }),
    })
  } else {
    const originalFeature = feature.get('features')[0]
    style = getStyle(originalFeature)
  }
  return style
}

// 坐标
let coordinate = ref([])
const formatCoordinate = computed(() => {
  if (coordinate.value.length === 2) {
    const [lon, lat] = coordinate.value
    return `lon:${lon.toFixed(3)},lat:${lat.toFixed(3)}`
  } else {
    return ''
  }
})

// 设置底图
const tiandituVecLayer = new TileLayer({
  title: '天地图矢量图层',
  source: new XYZ({
    url: 'http://t0.tianditu.com/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=' + '24997a7210dbb9dc59c64076193a2e10',
    wrapX: false,
    crossOrigin: "anonymous"
  })
})
const tiandituImgLayer = new TileLayer({
  title: '天地图影像图层',
  source: new XYZ({
    url: 'http://t0.tianditu.com/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=' + '24997a7210dbb9dc59c64076193a2e10',
    wrapX: false,
    crossOrigin: "anonymous"
  })
})
const tiandutiCvaLayer = new TileLayer({
  title: '天地图矢量注记图层',
  source: new XYZ({
    url: 'http://t0.tianditu.com/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=' + '24997a7210dbb9dc59c64076193a2e10',
    wrapX: false,
    crossOrigin: "anonymous"
  })
})

// 数据源 (动态更新)
const vectorSource = new VectorSource({
  features: new GeoJSON().readFeatures(props.fireData)
})

// 点聚合
const clusterSource = new Cluster({
  wrapX: false,
  distance: 40,
  source: vectorSource
})

const disasterPointLayer = new VectorLayer({
  title: '火点分布',
  source: clusterSource,
  style: getClusterStyle
})

// 云南省边界

// 搜索高亮图层
const highlightSource = new VectorSource()
const highlightLayer = new VectorLayer({
  title: '搜索高亮',
  source: highlightSource,
  style: new Style({
    stroke: new Stroke({
      color: '#ffcc00', // 高亮黄色
      width: 5          // 加粗
    }),
    fill: new Fill({
      color: 'rgba(255, 204, 0, 0.2)' // 半透明填充
    })
  }),
  zIndex: 100 // 确保在最上层
})

const sichuanBoundaryLayer = new VectorLayer({
  title: '云南省边界',
  source: new VectorSource({
    features: new GeoJSON().readFeatures(yunnanBorder)
  }),
  style: new Style({
    stroke: new Stroke({
      color: '#0056b3',
      width: 3
    })
  })
})

let map = null

// 监听数据变化
watch(() => props.fireData, (newData) => {
  if (vectorSource) {
    vectorSource.clear()
    if (newData && newData.features && newData.features.length > 0) {
      vectorSource.addFeatures(new GeoJSON().readFeatures(newData))
    }
  }
}, { deep: true })

// 暴露定位方法

// 暴露高亮方法
const highlightCity = (cityFeature) => {
  if (highlightSource) {
    highlightSource.clear()
    if (cityFeature) {
      const feature = new GeoJSON().readFeature(cityFeature)
      highlightSource.addFeature(feature)
    }
  }
}

const flyToExtent = (extent) => {
  if (map && extent) {
    map.getView().fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 1000,
      maxZoom: 10 // 限制最大缩放级别，防止对于小区域缩放过大
    })
  }
}

// 暴露方法给父组件
defineExpose({
  flyToExtent,
  highlightCity
})

onMounted(() => {
  map = new Map({
    target: 'map',
    layers: [tiandituVecLayer, tiandituImgLayer, tiandutiCvaLayer, disasterPointLayer, sichuanBoundaryLayer, highlightLayer],
    view: new View({
      center: [102.42, 25.02],
      zoom: 6,
      projection: 'EPSG:4326'
    }),
    interactions: defaultInteractions({
      doubleClickZoom: false,
    }),
  })

  map.on('pointermove', (e) => {
    coordinate.value = e.coordinate
  })

  // 添加点击交互
  const selectClick = new Select({
    condition: click,
    layers: [disasterPointLayer], // 只选择火点图层
    style: null // 保持原有样式，不使用默认选择样式
  })
  
  map.addInteraction(selectClick)
  
  selectClick.on('select', (e) => {
    if (e.selected.length > 0) {
      const feature = e.selected[0]
      const features = feature.get('features') // 获取聚合中的所有feature
      
      if (features && features.length > 0) {
         // 提取所有 properties
         const props = features.map(f => {
            const p = f.getProperties()
            // 补充经纬度
            const geom = f.getGeometry().getCoordinates()
            p.longitude = geom[0].toFixed(3)
            p.latitude = geom[1].toFixed(3)
            return p
         })
         emit('cluster-click', props)
      }
      // 清除选择，以便下次可以再次点击
      selectClick.getFeatures().clear()
    }
  })

  // 发送 map 实例给父组件
  emit('map-loaded', markRaw(map))
})
</script>

<template>
  <div class="map-module-container">
    <div id="map"></div>
    <div v-if="coordinate.length > 0" id="mousePosition">
      <i class="iconfont icon-jingweidu"></i> {{ formatCoordinate }}
    </div>
    <div v-else id="mousePosition">请把你的鼠标放在地图上</div>
  </div>
</template>

<style lang="scss" scoped>
.map-module-container {
  width: 100%;
  height: 100%;
  position: relative;

  #map {
    width: 100%;
    height: 100%;
  }

  #mousePosition {
    position: absolute;
    right: 10px;
    bottom: 10px;
    width: 250px;
    background-color: rgba(0, 0, 0, 0.6);
    color: #ffffff;
    padding: 10px 15px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: bold;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    overflow: hidden;
    white-space: nowrap;
    text-align: center;
    z-index: 1000;

    .iconfont {
      color: #ffcc00;
      margin-right: 5px;
    }
  }

  #mousePosition:hover {
    transform: scale(1.07);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.7);
  }
}
</style>
