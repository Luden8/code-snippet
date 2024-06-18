import lodash from 'lodash'
import { warnLog } from '../../tools/log'

class RMenusState {
  constructor() {
    this.store = {}
  }

  mixin(options) {
    lodash.each(options, (item, key) => {
      this.add(key, item)
    })
    return RMenusState
  }

  get(name) {
    return this.store[name]
  }

  add(name, render) {
    const conf = this.store[name]
    // 
    if (lodash.isFunction(render)) {
      // if (import.meta.env.MODE === 'development') {
      //   warnLog('rtable.error.delProp', ['menus -> callback', 'menuMethod'])
      // }
      render = {
        menuMethod: render
      }
    }

    // 
    if (import.meta.env.MODE === 'development') {
      const confKeys = lodash.keys(conf)
      lodash.each(render, (item, key) => {
        if (confKeys.includes(key)) {
          warnLog('rtable.error.coverProp', [name, key])
        }
      })
    }
    this.store[name] = conf ? lodash.merge(conf, render) : render
    return RMenusState
  }

  delete(name) {
    delete this.store[name]
    return RMenusState
  }
}

export const menus = new RMenusState()

if (import.meta.env.MODE === 'development') {
  Object.assign(menus, { _name: 'Menus' })
}
