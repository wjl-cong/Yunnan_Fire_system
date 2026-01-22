import Draw, { createRegularPolygon } from 'ol/interaction/Draw';
import Polygon from 'ol/geom/Polygon';

export const createDraw = ({type,source,success}) => {
let geometryFunction = null
let maxPoints = null
if(type === 'Square') {
  type = 'Circle'
  geometryFunction = createRegularPolygon(4)
}
if(type === 'Box') {
  type = 'LineString'
  geometryFunction = (coordinate,geometry) => {
    if(!geometry) {
      geometry = new Polygon(null)
    }
    const start = coordinate[0]
    const end = coordinate[1]
    geometry.setCoordinates([
      [start,[start[0],end[1]],end,[end[0],start[1]],start]
    ])
    return geometry
  }
  maxPoints = 2
}
let draw = new Draw({
  type,
  source,
  geometryFunction,
  maxPoints,
})
if(typeof success === 'function') {
  draw.on('drawend',(e) => {
    success(e.feature)
  })
}
return draw
}
