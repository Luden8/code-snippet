import lodash from 'lodash'
import { warnLog } from '../../tools/log'

class RCommandsStore {
  constructor() {
    this.store = {}
  }

  mixin(options) {
    lodash.each(options, (item, key) => {
      this.add(key, item)
    })
    return RCommandsStore
  }

  get(name) {
    return this.store[name]
  }

  add(name, render) {
    const conf = this.store[name]
    // 
    if (lodash.isFunction(render)) {
      // if (import.meta.env.MODE === 'development') {
      //   warnLog('rtable.error.delProp', ['commands -> callback', 'commandMethod'])
      // }
      render = {
        commandMethod: render
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
    return RCommandsStore
  }

  delete(name) {
    delete this.store[name]
    return RCommandsStore
  }
}

export const commands = new RCommandsStore()

if (import.meta.env.MODE === 'development') {
  Object.assign(commands, { _name: 'Commands' })
}
