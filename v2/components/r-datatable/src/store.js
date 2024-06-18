import lodash from 'lodash'
import { warnLog } from '../../tools/log'

/**
 * 
 */
class Store {
  constructor() {
    this.store = {}
  }

  mixin(options) {
    lodash.each(options, (item, key) => {
      this.add(key, item)
    })
    return Store
  }

  get(name) {
    return this.store[name]
  }

  add(name, render) {
    const conf = this.store[name]
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
    return Store
  }

  delete(name) {
    delete this.store[name]
    return Store
  }
}

export default Store
