import lodash from 'lodash'
import { browse } from './dom'

export const EVENT_KEYS_MAP = {
  F2: 'F2',
  ESCAPE: 'Escape',
  ENTER: 'Enter',
  TAB: 'Tab',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace',
  SPACEBAR: ' ',
  CONTEXT_MENU: 'ContextMenu',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown'
}

const convertEventKeysMap = {
  ' ': 'Spacebar',
  Apps: EVENT_KEYS.CONTEXT_MENU,
  Del: EVENT_KEYS.DELETE,
  Up: EVENT_KEYS.ARROW_UP,
  Down: EVENT_KEYS.ARROW_DOWN,
  Left: EVENT_KEYS.ARROW_LEFT,
  Right: EVENT_KEYS.ARROW_RIGHT
}

// Listen for global events
const wheelName = browse.firefox ? 'DOMMouseScroll' : 'mousewheel'
const eventStore = []

export const hasEventKey = (event, targetKey) => {
  const { key } = event
  targetKey = targetKey.toLowerCase()
  return key
    ? targetKey === key.toLowerCase() || !!(convertEventKeys[key] && convertEventKeys[key].toLowerCase() === targetKey)
    : false
}

export const GlobalEvent = {
  on(comp, type, cb) {
    if (cb) {
      eventStore.push({ comp, type, cb })
    }
  },
  off(comp, type) {
    lodash.remove(eventStore, (item) => item.comp === comp && item.type === type)
  },
  trigger(event) {
    const isWheel = event.type === wheelName
    eventStore.forEach(({ comp, type, cb }) => {
      // If it is canceled bubbling, it will no longer be executed
      if (!event.cancelBubble) {
        if (type === event.type || (isWheel && type === 'mousewheel')) {
          cb.call(comp, event)
        }
      }
    })
  },
  eqKeypad(event, keyVal) {
    const { key } = event
    if (keyVal.toLowerCase() === key.toLowerCase()) {
      return true
    }
    return false
  }
}

if (browse.isDoc) {
  if (!browse.msie) {
    window.addEventListener('copy', GlobalEvent.trigger, false)
    window.addEventListener('cut', GlobalEvent.trigger, false)
    window.addEventListener('paste', GlobalEvent.trigger, false)
  }
  document.addEventListener('keydown', GlobalEvent.trigger, false)
  document.addEventListener('contextmenu', GlobalEvent.trigger, false)
  window.addEventListener('mousedown', GlobalEvent.trigger, false)
  window.addEventListener('blur', GlobalEvent.trigger, false)
  window.addEventListener('resize', GlobalEvent.trigger, false)
  window.addEventListener(
    wheelName,
    lodash.throttle(GlobalEvent.trigger, 100, { leading: true, trailing: false }),
    false
  )
}
