# echarts-extension-tmap
# 基于天地图的echarts扩展
# 使用方式
1. 安装 npm install echarts-extension-tmap 或 yarn add echarts-extension-tmap
2. 引入 require('echarts-extension-tmap')
3. 使用 
tmap: {
    // 天地图中心经纬度
    center: this.center,
    // 天地图缩放
    zoom: this.zoom,
    // 拖拽
    roam: false,
    // 天地图自定义样式  只有 默认、black、indigo三种样式
    mapStyle: 'indigo'
},
series: [
    {
        name: '投资指数',
        type: 'scatter',
        coordinateSystem: 'tmap',
        data: this.convertData(this.map_list)
    }
]
