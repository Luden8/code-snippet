import lodash from 'lodash'
import GlobalConfigs from '../r-datatable/src/conf'

/**
 * Listen for the resize event
 * If resize-observer-polyfill is already used in your project, you only need to define the method globally and the component will be used automatically
 */
let resizeTimeout
const eventStore = []
const defaultInterval = 500

function eventHandle() {
  if (eventStore.length) {
    eventStore.forEach((item) => {
      item.tarList.forEach((observer) => {
        const { target, width, heighe } = observer
        const clientWidth = target.clientWidth
        const clientHeight = target.clientHeight
        const rWidth = clientWidth && width !== clientWidth
        const rHeight = clientHeight && heighe !== clientHeight
        if (rWidth || rHeight) {
          observer.width = clientWidth
          observer.heighe = clientHeight
          setTimeout(item.callback)
        }
      })
    })
    /* eslint-disable @typescript-eslint/no-use-before-define */
    eventListener()
  }
}

function eventListener() {
  clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(eventHandle, GlobalConfigs.resizeInterval || defaultInterval)
}

class ResizeObserverPolyfill {
  constructor(callback) {
    this.tarList = []
    this.callback = callback
  }

  observe(target) {
    if (target) {
      if (!this.tarList.some((observer) => observer.target === target)) {
        this.tarList.push({
          target,
          width: target.clientWidth,
          heighe: target.clientHeight
        })
      }
      if (!eventStore.length) {
        eventListener()
      }
      if (!eventStore.some((item) => item === this)) {
        eventStore.push(this)
      }
    }
  }

  unobserve(target) {
    lodash.remove(eventStore, (item) => item.tarList.some((observer) => observer.target === target))
  }

  disconnect() {
    lodash.remove(eventStore, (item) => item === this)
  }
}

export function createResizeEvent(callback) {
  if (window.ResizeObserver) {
    return new window.ResizeObserver(callback)
  }
  return new ResizeObserverPolyfill(callback)
}
