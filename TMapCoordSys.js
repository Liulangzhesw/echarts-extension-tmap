
/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/

var _echarts = require('echarts')

var zrUtil = _echarts.util
var graphic = _echarts.graphic
var matrix = _echarts.matrix
const T = require('T')

/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/

/* global BMap */
function BMapCoordSys (bmap, api) {
  this._bmap = bmap
  this.dimensions = ['lng', 'lat']
  this._mapOffset = [0, 0]
  this._api = api
}

BMapCoordSys.prototype.dimensions = ['lng', 'lat']

BMapCoordSys.prototype.setZoom = function (zoom) {
  this._zoom = zoom
}

BMapCoordSys.prototype.setCenter = function (center) {
  this._center = this._bmap.lngLatToContainerPoint(new T.LngLat(center[0], center[1]))
}

BMapCoordSys.prototype.setMapOffset = function (mapOffset) {
  this._mapOffset = mapOffset
}

BMapCoordSys.prototype.getBMap = function () {
  return this._bmap
}

BMapCoordSys.prototype.dataToPoint = function (data) {
  var point = new T.LngLat(data[0], data[1]) // TODO mercator projection is toooooooo slow
  // var mercatorPoint = this._projection.lngLatToPoint(point);
  // var width = this._api.getZr().getWidth();
  // var height = this._api.getZr().getHeight();
  // var divider = Math.pow(2, 18 - 10);
  // return [
  //     Math.round((mercatorPoint.x - this._center.x) / divider + width / 2),
  //     Math.round((this._center.y - mercatorPoint.y) / divider + height / 2)
  // ];

  var px = this._bmap.lngLatToContainerPoint(point)
  var mapOffset = this._mapOffset
  return [px.x - mapOffset[0], px.y - mapOffset[1]]
}

BMapCoordSys.prototype.pointToData = function (pt) {
  var mapOffset = this._mapOffset

  var point = new T.Point({
    x: pt[0] + mapOffset[0],
    y: pt[1] + mapOffset[1]
  })

  return [point.lng, point.lat]
}

BMapCoordSys.prototype.getViewRect = function () {
  var api = this._api
  return new graphic.BoundingRect(0, 0, api.getWidth(), api.getHeight())
}

BMapCoordSys.prototype.getRoamTransform = function () {
  return matrix.create()
}

BMapCoordSys.prototype.prepareCustoms = function (data) {
  var rect = this.getViewRect()
  return {
    coordSys: {
      // The name exposed to user is always 'cartesian2d' but not 'grid'.
      type: 'tmap',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    },
    api: {
      coord: zrUtil.bind(this.dataToPoint, this),
      size: zrUtil.bind(dataToCoordSize, this)
    }
  }
}

function dataToCoordSize (dataSize, dataItem) {
  dataItem = dataItem || [0, 0]
  return zrUtil.map([0, 1], function (dimIdx) {
    var val = dataItem[dimIdx]
    var halfSize = dataSize[dimIdx] / 2
    var p1 = []
    var p2 = []
    p1[dimIdx] = val - halfSize
    p2[dimIdx] = val + halfSize
    p1[1 - dimIdx] = p2[1 - dimIdx] = dataItem[1 - dimIdx]
    return Math.abs(this.dataToPoint(p1)[dimIdx] - this.dataToPoint(p2)[dimIdx])
  }, this)
}

var Overlay // For deciding which dimensions to use when creating list data

BMapCoordSys.dimensions = BMapCoordSys.prototype.dimensions

function createOverlayCtor () {
  function Overlay (root) {
    this._root = root
  }

  Overlay.prototype = new T.Overlay()

  Overlay.prototype.initialize = function (map) {
    map.getPanes().labelPane.appendChild(this._root)
    return this._root
  }
  Overlay.prototype.onAdd = function (map) {
    map.getPanes().overlayPane.appendChild(this._root)
  }

  Overlay.prototype.draw = function () {}

  return Overlay
}

BMapCoordSys.create = function (ecModel, api) {
  var bmapCoordSys
  var root = api.getDom() // TODO Dispose

  ecModel.eachComponent('tmap', function (bmapModel) {
    var painter = api.getZr().painter
    var viewportRoot = painter.getViewportRoot()

    if (typeof T === 'undefined') {
      throw new Error('TMap api is not loaded')
    }

    Overlay = Overlay || createOverlayCtor()

    if (bmapCoordSys) {
      throw new Error('Only one tmap component can exist')
    }

    if (!bmapModel.__bmap) {
      // Not support IE8
      var bmapRoot = root.querySelector('.ec-extension-tmap')

      if (bmapRoot) {
        // Reset viewport left and top, which will be changed
        // in moving handler in BMapView
        viewportRoot.style.left = '0px'
        viewportRoot.style.top = '0px'
        root.removeChild(bmapRoot)
      }

      bmapRoot = document.createElement('div')
      bmapRoot.style.cssText = 'width:100%;height:100%' // Not support IE8

      bmapRoot.classList.add('ec-extension-tmap')
      root.appendChild(bmapRoot)
      var bmap = bmapModel.__bmap = new T.Map(bmapRoot)
      var overlay = new Overlay(viewportRoot)
      bmap.addOverLay(overlay) // Override

      painter.getViewportRootOffset = function () {
        return {
          offsetLeft: 0,
          offsetTop: 0
        }
      }
    }

    var bmap = bmapModel.__bmap // Set bmap options
    // centerAndZoom before layout and render

    var center = bmapModel.get('center')
    var zoom = bmapModel.get('zoom')

    if (center && zoom) {
      var pt = new T.LngLat(center[0], center[1])
      bmap.centerAndZoom(pt, zoom)
    }

    bmapCoordSys = new BMapCoordSys(bmap, api)
    bmapCoordSys.setMapOffset(bmapModel.__mapOffset || [0, 0])
    bmapCoordSys.setZoom(zoom)
    bmapCoordSys.setCenter(center)
    bmapModel.coordinateSystem = bmapCoordSys
  })
  ecModel.eachSeries(function (seriesModel) {
    if (seriesModel.get('coordinateSystem') === 'tmap') {
      seriesModel.coordinateSystem = bmapCoordSys
    }
  })
}

var _default = BMapCoordSys
module.exports = _default
