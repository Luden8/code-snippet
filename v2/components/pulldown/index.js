import GlobalConfigs from '../r-datatable/src/conf'
import vSize from '../mixins/size'
import Utils from '../tools/utils'
import DomUtils from '../tools/dom'
import { GlobalEvent } from '../tools/event'
import lodash from 'lodash'

export default {
  name: 'RPulldown',
  mixins: [vSize],
  props: {
    value: Boolean,
    disabled: Boolean,
    placement: String,
    size: { type: String, default: () => GlobalConfigs.size },
    className: [String, Function],
    popupClassName: [String, Function],
    destroyOnClose: Boolean,
    transfer: Boolean
  },
  data() {
    return {
      inited: false,
      panelIndex: 0,
      panelStyle: null,
      panelPlacement: null,
      currentValue: null,
      visiblePanel: false,
      animatVisible: false,
      isActivated: false
    }
  },
  watch: {
    value(value) {
      if (value) {
        this.showPanel()
      } else {
        this.hidePanel()
      }
    }
  },
  created() {
    GlobalEvent.on(this, 'mousewheel', this.handleGlobalMousewheelEvent)
    GlobalEvent.on(this, 'mousedown', this.handleGlobalMousedownEvent)
    GlobalEvent.on(this, 'blur', this.handleGlobalBlurEvent)
  },
  beforeDestroy() {
    const panelElem = this.$refs.panel
    if (panelElem && panelElem.parentNode) {
      panelElem.parentNode.removeChild(panelElem)
    }
  },
  destroyed() {
    GlobalEvent.off(this, 'mousewheel')
    GlobalEvent.off(this, 'mousedown')
    GlobalEvent.off(this, 'blur')
  },
  render(h) {
    const {
      _e,
      $scopedSlots,
      inited,
      className,
      popupClassName,
      vSize,
      destroyOnClose,
      transfer,
      isActivated,
      disabled,
      animatVisible,
      visiblePanel,
      panelStyle,
      panelPlacement
    } = this
    const defaultSlot = $scopedSlots.default
    const headerColumnSlot = $scopedSlots.header
    const footerSlot = $scopedSlots.footer
    const dropdownSlot = $scopedSlots.dropdown
    // prettier-ignore
    return h(
      'div',
      {
        class: [
          'r-table-pulldown',
          className ? (lodash.isFunction(className) ? className({ $pulldown: this }) : className) : '',
          {
            [`size--${vSize}`]: vSize,
            'is--visivle': visiblePanel,
            'is--disabled': disabled,
            'is--active': isActivated
          }
        ]
      },
      [
        h(
          'div',
          {
            ref: 'content',
            class: 'r-table-pulldown--content'
          },
          defaultSlot ? defaultSlot.call(this, { $pulldown: this }, h) : []
        ),
        h(
          'div',
          {
            ref: 'panel',
            class: [
              'r4m-table--ignore-clear r-table-pulldown--panel',
              popupClassName
                ? lodash.isFunction(popupClassName)
                  ? popupClassName({ $pulldown: this })
                  : popupClassName
                : '',
              {
                [`size--${vSize}`]: vSize,
                'is--transfer': transfer,
                'animat--leave': animatVisible,
                'animat--enter': visiblePanel
              }
            ],
            attrs: {
              placement: panelPlacement
            },
            style: panelStyle
          },
          [
            h(
              'div',
              {
                class: 'r-table-pulldown--panel-wrapper'
              },
              !inited || (destroyOnClose && !visiblePanel && !animatVisible)
                ? []
                : [
                  headerColumnSlot
                    ? h(
                      'div',
                      {
                        class: 'r-table-pulldown--panel-header'
                      },
                      headerColumnSlot.call(this, { $pulldown: this })
                    )
                    : _e(),
                  h(
                    'div',
                    {
                      class: 'r-table-pulldown--panel-body'
                    },
                    dropdownSlot ? dropdownSlot.call(this, { $pulldown: this }, h) : []
                  ),
                  footerSlot
                    ? h(
                      'div',
                      {
                        class: 'r-table-pulldown--panel-footer'
                      },
                      footerSlot.call(this, { $pulldown: this })
                    )
                    : _e()
                ]
            )
          ]
        )
      ]
    )
  },
  methods: {
    handleGlobalMousewheelEvent(event) {
      const { $refs, disabled, visiblePanel } = this
      if (!disabled) {
        if (visiblePanel) {
          if (DomUtils.getEventTargetNode(event, $refs.panel).flag) {
            this.updatePlacement()
          } else {
            this.hidePanel()
            this.$emit('hide-panel', { $event: event })
          }
        }
      }
    },
    handleGlobalMousedownEvent(event) {
      const { $refs, $el, disabled, visiblePanel } = this
      if (!disabled) {
        this.isActivated =
          DomUtils.getEventTargetNode(event, $el).flag || DomUtils.getEventTargetNode(event, $refs.panel).flag
        if (visiblePanel && !this.isActivated) {
          this.hidePanel()
          this.$emit('hide-panel', { $event: event })
        }
      }
    },
    handleGlobalBlurEvent(event) {
      if (this.visiblePanel) {
        this.isActivated = false
        this.hidePanel()
        this.$emit('hide-panel', { $event: event })
      }
    },
    updateZindex() {
      if (this.panelIndex < Utils.getLastZIndex()) {
        this.panelIndex = Utils.nextZIndex()
      }
    },
    isPanelVisible() {
      return this.visiblePanel
    },
    /**
     * 
     */
    togglePanel() {
      if (this.visiblePanel) {
        return this.hidePanel()
      }
      return this.showPanel()
    },
    /**
     * 
     */
    showPanel() {
      if (!this.inited) {
        this.inited = true
        if (this.transfer) {
          document.body.appendChild(this.$refs.panel)
        }
      }
      return new Promise((resolve) => {
        if (!this.disabled) {
          clearTimeout(this.hidePanelTimeout)
          this.isActivated = true
          this.animatVisible = true
          setTimeout(() => {
            this.visiblePanel = true
            this.$emit('update:input', true)
            this.updatePlacement()
            setTimeout(() => {
              resolve(this.updatePlacement())
            }, 40)
          }, 10)
          this.updateZindex()
        } else {
          resolve(this.$nextTick())
        }
      })
    },
    /**
     * 
     */
    hidePanel() {
      this.visiblePanel = false
      this.$emit('update:input', false)
      return new Promise((resolve) => {
        if (this.animatVisible) {
          this.hidePanelTimeout = setTimeout(() => {
            this.animatVisible = false
            resolve(this.$nextTick())
          }, 350)
        } else {
          resolve(this.$nextTick())
        }
      })
    },
    /**
     * 
     */
    updatePlacement() {
      return this.$nextTick().then(() => {
        const { $refs, transfer, placement, panelIndex, visiblePanel } = this
        if (visiblePanel) {
          const panelElem = $refs.panel
          const targetElem = $refs.content
          if (panelElem && targetElem) {
            const targetHeight = targetElem.offsetHeight
            const targetWidth = targetElem.offsetWidth
            const panelHeight = panelElem.offsetHeight
            const panelWidth = panelElem.offsetWidth
            const marginSize = 5
            const panelStyle = {
              zIndex: panelIndex
            }
            const { boundingTop, boundingLeft, visibleHeight, visibleWidth } = DomUtils.getAbsolutePos(targetElem)
            let panelPlacement = 'bottom'
            if (transfer) {
              let left = boundingLeft
              let top = boundingTop + targetHeight
              if (placement === 'top') {
                panelPlacement = 'top'
                top = boundingTop - panelHeight
              } else if (!placement) {
                // ，
                if (top + panelHeight + marginSize > visibleHeight) {
                  panelPlacement = 'top'
                  top = boundingTop - panelHeight
                }
                // ，（）
                if (top < marginSize) {
                  panelPlacement = 'bottom'
                  top = boundingTop + targetHeight
                }
              }
              // 
              if (left + panelWidth + marginSize > visibleWidth) {
                left -= left + panelWidth + marginSize - visibleWidth
              }
              // 
              if (left < marginSize) {
                left = marginSize
              }
              Object.assign(panelStyle, {
                left: `${left}px`,
                top: `${top}px`,
                minWidth: `${targetWidth}px`
              })
            } else {
              if (placement === 'top') {
                panelPlacement = 'top'
                panelStyle.bottom = `${targetHeight}px`
              } else if (!placement) {
                // ，
                if (boundingTop + targetHeight + panelHeight > visibleHeight) {
                  // ，（）
                  if (boundingTop - targetHeight - panelHeight > marginSize) {
                    panelPlacement = 'top'
                    panelStyle.bottom = `${targetHeight}px`
                  }
                }
              }
            }
            this.panelStyle = panelStyle
            this.panelPlacement = panelPlacement
          }
        }
        return this.$nextTick()
      })
    }
  }
}
