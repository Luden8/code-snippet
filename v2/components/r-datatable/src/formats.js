import lodash from 'lodash'
import { warnLog } from '../../tools/log'

class RFormatsStore {
  constructor() {
    this.store = {}
  }

  mixin(options) {
    lodash.each(options, (item, key) => {
      this.add(key, item)
    })
    return RFormatsStore
  }

  get(name) {
    return this.store[name]
  }

  add(name, render) {
    const conf = this.store[name]

    if (lodash.isFunction(render)) {
      // if (import.meta.env.MODE === 'development') {
      //   warnLog('rtable.error.delProp', ['formats -> callback', 'cellFormatMethod'])
      // }
      render = {
        cellFormatMethod: render
      }
    }


    if (import.meta.env.MODE === 'development') {
      const confKeys = lodash.keys(conf)
      lodash.each(render, (item, key) => {
        if (confKeys.includes(key)) {
          warnLog('rtable.error.coverProp', [name, key])
        }
      })
    }
    this.store[name] = conf ? lodash.merge(conf, render) : render
    return RFormatsStore
  }

  delete(name) {
    delete this.store[name]
    return RFormatsStore
  }
}

export const formats = new RFormatsStore()

if (import.meta.env.MODE === 'development') {
  Object.assign(formats, { _name: 'Formats' })
}
