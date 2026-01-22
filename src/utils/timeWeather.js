// 格式化时间
export const upDateCurrentTime = (currentTimeRef) => {
  const now = new Date()
  const nowTime = now.toLocaleTimeString('zh-CN',{hour12:false})
  currentTimeRef.value = nowTime
}
// 格式化日期
export const upDateCurrentDate = (currentDateRef) => {
  const now = new Date()
  const options = {years:'numeric', month:'long', day:'numeric',weekday:'long'}
  currentDateRef.value = now.toLocaleDateString('zh-CN',options)
}
// 地址查询
export const fethLocation = async (amapKey,fethWeather) => {
  try{
    const response = await fetch(`https://restapi.amap.com/v3/ip?key=${amapKey}`)
    const data = await response.json()
    console.log('Location API Response:', data); if(data.status === '1') {
      const city = (data.city && data.city.length > 0) ? data.adcode : '511700' // Default to Dazhou (511700) if city is empty
      fethWeather(city,amapKey)
    }else {
      console.error('获取位置失败',data.info, data)
    }
  }catch (error) {
    console.error('获取位置失败',error)
  }
}
// 天气查询
export const fethWeather = async (city,amapKey,weatherInfoRef) => {
  try {
    const response = await fetch(`https://restapi.amap.com/v3/weather/weatherInfo?city=${city}&key=${amapKey}`)
    const data = await response.json()
    console.log('Weather API Response:', data); if(data.status === '1' && data.lives && data.lives.length > 0) {
      const weather = data.lives[0]
      weatherInfoRef.value = weather
    }else {
      console.error('获取天气失败',data.info, data)
    }
  }catch(error) {
    console.error('获取天气失败',error)
  }
}
