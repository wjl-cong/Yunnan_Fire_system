import defaultGeoData from '@/assets/Yunnan_fire.json'

export const parseGeoData = (geoData = defaultGeoData) => {
  // 1. 基础安全检查
  if (!geoData || !geoData.features || !Array.isArray(geoData.features)) {
    console.warn('GeoData is invalid or empty:', geoData)
    return {
      rawFeatures: [],
      confidenceCounts: { low: 0, nominal: 0, high: 0 },
      dailyCounts: [],
      dayNightCounts: { D: 0, N: 0 },
      frpDistribution: { '0-20': 0, '20-50': 0, '50-100': 0, '>100': 0 }
    }
  }

  try {
    // 提取属性数据并补充经纬度
    const features = geoData.features.map(feature => {
      const props = feature.properties || {}
      if (feature.geometry && feature.geometry.coordinates) {
        props.longitude = feature.geometry.coordinates[0].toFixed(3)
        props.latitude = feature.geometry.coordinates[1].toFixed(3)
      }
      return props
    }).sort((a, b) => {
      // 按日期降序排序 (最新的在前)
      return new Date(b.acq_date + ' ' + b.acq_time.substring(0,2) + ':' + b.acq_time.substring(2,4)) - 
             new Date(a.acq_date + ' ' + a.acq_time.substring(0,2) + ':' + a.acq_time.substring(2,4))
    })

    // 1. 火险等级统计 (Confidence Level)
    const confidenceCounts = { low: 0, nominal: 0, high: 0 }

    // 2. 每日火点频次统计 (Daily Frequency)
    const dailyCountsMap = {}

    // 3. 昼夜分布统计
    const dayNightCounts = { D: 0, N: 0 }

    // 4. FRP 分布统计
    const frpDistribution = { '0-20': 0, '20-50': 0, '50-100': 0, '>100': 0 }

    features.forEach((props) => {
      // 统计置信度等级
      const conf = props.conf || 'low'
      if (confidenceCounts[conf] !== undefined) {
        confidenceCounts[conf]++
      } else {
        confidenceCounts['low']++
      }

      // 统计每日火点
      const date = props.acq_date
      if (date) {
        dailyCountsMap[date] = (dailyCountsMap[date] || 0) + 1
      }

      // 统计昼夜
      const dn = props.daynight
      if (dn === 'D' || dn === 'N') {
        dayNightCounts[dn]++
      }

      // 统计 FRP
      const frp = parseFloat(props.frp)
      if (!isNaN(frp)) {
        if (frp <= 20) frpDistribution['0-20']++
        else if (frp <= 50) frpDistribution['20-50']++
        else if (frp <= 100) frpDistribution['50-100']++
        else frpDistribution['>100']++
      }
    })

    // 格式化每日数据为数组，并按日期排序
    const dailyCounts = Object.entries(dailyCountsMap)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, count]) => ({ name: date, value: count }))

    return {
      rawFeatures: features,
      confidenceCounts,
      dailyCounts,
      dayNightCounts,
      frpDistribution
    }
  } catch (error) {
    console.error('Error parsing GeoData:', error)
    return {
      rawFeatures: [],
      confidenceCounts: { low: 0, nominal: 0, high: 0 },
      dailyCounts: [],
      dayNightCounts: { D: 0, N: 0 },
      frpDistribution: { '0-20': 0, '20-50': 0, '50-100': 0, '>100': 0 }
    }
  }
}
