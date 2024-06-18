import lodash from 'lodash'
import GlobalConfigs from '../r-datatable/src/conf'
import vSize from '../mixins/size'
import Utils from '../tools/utils'
import DomUtils from '../tools/dom'

function updateTipStyle(_vm) {
  const { $el: wrapperElem, tipTarget, tipStore } = _vm
  if (tipTarget) {
    const { scrollTop, scrollLeft, visibleWidth } = DomUtils.getDomNode()
    const { top, left } = DomUtils.getAbsolutePos(tipTarget)
    const marginSize = 6
    const offsetHeight = wrapperElem.offsetHeight
    const offsetWidth = wrapperElem.offsetWidth
    // TODO: replace with UI kit popover later
    // let tipTop = top - offsetHeight - marginSize
    tipStore.placement = 'bottom'
    const tipTop = top + tipTarget.offsetHeight + marginSize
    let tipLeft = Math.max(marginSize, left + Math.floor((tipTarget.offsetWidth - offsetWidth) / 2))
    if (tipLeft + offsetWidth + marginSize > scrollLeft + visibleWidth) {
      tipLeft = scrollLeft + visibleWidth - offsetWidth - marginSize
    }
    // if (top - offsetHeight < scrollTop + marginSize) {
    //   console.log('top')
    //
    // }
    tipStore.style.top = `${tipTop}px`
    tipStore.style.left = `${tipLeft}px`
    tipStore.arrowStyle.left = `${left - tipLeft + tipTarget.offsetWidth / 2}px`
  }
}

function showTip(_vm) {
  const { $el, tipStore, zIndex } = _vm
  const parentNode = $el.parentNode
  if (!parentNode) {
    document.body.appendChild($el)
  }
  _vm.updateValue(true)
  _vm.updateZindex()
  tipStore.placement = 'bottom'
  tipStore.style = { width: 'auto', left: 0, top: 0, zIndex: zIndex || _vm.tipZindex }
  tipStore.arrowStyle = { left: '50%' }
  return _vm.updatePlacement()
}

function renderContent(h, _vm) {
  const { $scopedSlots, useHTML, tipContent } = _vm
  if ($scopedSlots.content) {
    return h(
      'div',
      {
        key: 1,
        class: 'r4m-table--tooltip-content'
      },
      $scopedSlots.content.call(this, {})
    )
  }
  if (useHTML) {
    return h('div', {
      key: 2,
      class: 'r4m-table--tooltip-content',
      domProps: {
        innerHTML: tipContent
      }
    })
  }
  return h(
    'div',
    {
      key: 3,
      class: 'r4m-table--tooltip-content'
    },
    Utils.format(tipContent)
  )
}

export default {
  name: 'RTooltip',
  mixins: [vSize],
  props: {
    value: Boolean,
    size: { type: String, default: () => GlobalConfigs.tooltip.size || GlobalConfigs.size },
    trigger: { type: String, default: () => GlobalConfigs.tooltip.trigger },
    theme: { type: String, default: () => GlobalConfigs.tooltip.theme },
    content: { type: [String, Number], default: null },
    useHTML: Boolean,
    zIndex: [String, Number],
    popupClassName: [String, Function],
    isArrow: { type: Boolean, default: true },
    enterable: Boolean,
    enterDelay: { type: Number, default: () => GlobalConfigs.tooltip.enterDelay },
    leaveDelay: { type: Number, default: () => GlobalConfigs.tooltip.leaveDelay }
  },
  data() {
    return {
      isUpdate: false,
      visible: false,
      tipContent: '',
      tipActive: false,
      tipTarget: null,
      tipZindex: 0,
      tipStore: {
        style: {},
        placement: '',
        arrowStyle: null
      }
    }
  },
  watch: {
    content(value) {
      this.tipContent = value
    },
    value(value) {
      if (!this.isUpdate) {
        this[value ? 'open' : 'close']()
      }
      this.isUpdate = false
    }
  },
  created() {
    this.showDelayTip = lodash.debounce(
      () => {
        if (this.tipActive) {
          showTip(this)
        }
      },
      this.enterDelay,
      { leading: false, trailing: true }
    )
  },
  mounted() {
    const { $el, trigger, content, value } = this
    const parentNode = $el.parentNode
    if (parentNode) {
      let target
      this.tipContent = content
      this.tipZindex = Utils.nextZIndex()
      lodash.arrayEach($el.children, (elem, index) => {
        if (index > 1) {
          parentNode.insertBefore(elem, $el)
          if (!target) {
            target = elem
          }
        }
      })
      parentNode.removeChild($el)
      this.target = target
      if (target) {
        if (trigger === 'hover') {
          target.onmouseleave = this.targetMouseleaveEvent
          target.onmouseenter = this.targetMouseenterEvent
        } else if (trigger === 'click') {
          target.onclick = this.clickEvent
        }
      }
      if (value) {
        this.open()
      }
    }
  },
  beforeDestroy() {
    const { $el, target, trigger } = this
    const parentNode = $el.parentNode
    if (target) {
      if (trigger === 'hover') {
        target.onmouseenter = null
        target.onmouseleave = null
      } else if (trigger === 'click') {
        target.onclick = null
      }
    }
    if (parentNode) {
      parentNode.removeChild($el)
    }
  },
  render(h) {
    const { $scopedSlots, vSize, popupClassName, theme, tipActive, isArrow, visible, tipStore, enterable } = this
    let eventListeners
    if (enterable) {
      eventListeners = {
        mouseenter: this.wrapperMouseenterEvent,
        mouseleave: this.wrapperMouseleaveEvent
      }
    }
    return h(
      'div',
      {
        class: [
          'r4m-table--tooltip-wrapper',
          `theme--${theme}`,
          popupClassName
            ? lodash.isFunction(popupClassName)
              ? popupClassName({ $tooltip: this })
              : popupClassName
            : '',
          {
            [`size--${vSize}`]: vSize,
            [`placement--${tipStore.placement}`]: tipStore.placement,
            'is--enterable': enterable,
            'is--visible': visible,
            'is--arrow': isArrow,
            'is--active': tipActive
          }
        ],
        style: tipStore.style,
        ref: 'tipWrapper',
        on
      },
      [renderContent(h, this)].concat($scopedSlots.default ? $scopedSlots.default.call(this, {}) : [])
    )
  },
  methods: {
    open(target, content) {
      return this.toVisible(target || this.target, content)
    },
    close() {
      this.tipTarget = null
      this.tipActive = false
      Object.assign(this.tipStore, {
        style: {},
        placement: '',
        arrowStyle: null
      })
      this.updateValue(false)
      return this.$nextTick()
    },
    updateValue(value) {
      if (value !== this.visible) {
        this.visible = value
        this.isUpdate = true
        if (this.$listeners.input) {
          this.$emit('input', this.visible)
        }
      }
    },
    updateZindex() {
      if (this.tipZindex < Utils.getLastZIndex()) {
        this.tipZindex = Utils.nextZIndex()
      }
    },
    toVisible(target, content) {
      if (target) {
        const { trigger, enterDelay } = this
        this.tipActive = true
        this.tipTarget = target
        if (content) {
          this.tipContent = content
        }
        if (enterDelay && trigger === 'hover') {
          this.showDelayTip()
        } else {
          return showTip(this)
        }
      }
      return this.$nextTick()
    },
    updatePlacement() {
      return this.$nextTick().then(() => {
        const { $el: wrapperElem, tipTarget } = this
        if (tipTarget && wrapperElem) {
          updateTipStyle(this)
          return this.$nextTick().then(() => updateTipStyle(this))
        }
      })
    },
    isActived() {
      return this.tipActive
    },
    setActived(actived) {
      this.tipActive = !!actived
    },
    clickEvent() {
      this[this.visible ? 'close' : 'open']()
    },
    targetMouseenterEvent() {
      this.open()
    },
    targetMouseleaveEvent() {
      const { trigger, enterable, leaveDelay } = this
      this.tipActive = false
      if (enterable && trigger === 'hover') {
        setTimeout(() => {
          if (!this.tipActive) {
            this.close()
          }
        }, leaveDelay)
      } else {
        this.close()
      }
    },
    wrapperMouseenterEvent() {
      this.tipActive = true
    },
    wrapperMouseleaveEvent() {
      const { trigger, enterable, leaveDelay } = this
      this.tipActive = false
      if (enterable && trigger === 'hover') {
        setTimeout(() => {
          if (!this.tipActive) {
            this.close()
          }
        }, leaveDelay)
      }
    }
  }
}
