import * as turf from "@turf/turf"
// 调用turf计算线长度
export  const calculateDistance = (coordinates) => {
  const line = turf.lineString(coordinates)
  const length = turf.length(line,{units:'kilometers'})
  ElMessageBox.alert(`距离为：${length.toFixed(2)}千米`)
}
// 调用turf计算面积
export  const calculateArea = (coordinates) => {
  const polygon = turf.polygon([coordinates])
  const area = turf.area(polygon)

  const perimeterLine = turf.lineString(coordinates)
  const perimeter = turf.length(perimeterLine,{units:'kilometers'})
  ElMessageBox.alert(`面积是:${area.toFixed(2)}平方千米,周长是:${perimeter.toFixed(2)}千米`)
}
