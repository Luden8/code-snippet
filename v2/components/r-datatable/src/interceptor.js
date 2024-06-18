import lodash from 'lodash'
import { warnLog } from '../../tools/log'

function toType(type) {
  return lodash.toValueString(type).replace('_', '').toLowerCase()
}

const eventTypes =
  'event.showMenu,mounted,event.clearFilter,event.clearAreas,event.clearActived,beforeDestroy,destroyed,created,event.export,event.import,activated,event.keydown'
    .split(',')
    .map(toType)
const storeMap = {}

export const interceptor = {
  mixin(map) {
    lodash.each(map, (callback, type) => interceptor.add(type, callback))
    return interceptor
  },
  get(type) {
    return storeMap[toType(type)] || []
  },
  add(type, callback) {
    type = toType(type)

    // 
    if (import.meta.env.MODE === 'development') {
      if (eventTypes.indexOf(type) === -1) {
        warnLog('rtable.error.errProp', [`Interceptor.${type}`, eventTypes.join('|')])
      }
    }

    if (callback && eventTypes.indexOf(type) > -1) {
      let eList = storeMap[type]
      if (!eList) {
        eList = storeMap[type] = []
      }

      // 
      if (import.meta.env.MODE === 'development') {
        if (eList.indexOf(callback) > -1) {
          warnLog('rtable.error.coverProp', ['Interceptor', type])
        }
      }

      eList.push(callback)
    }
    return interceptor
  },
  delete(type, callback) {
    const eList = storeMap[toType(type)]
    if (eList) {
      lodash.remove(eList, (fn) => fn === callback)
    }
    return interceptor
  }
}
