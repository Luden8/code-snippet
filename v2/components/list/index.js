import lodash from 'lodash'
import GlobalConfigs from '../r-datatable/src/conf'
import vSize from '../mixins/size'
import { createResizeEvent } from '../tools/resize'
import { GlobalEvent } from '../tools/event'
import { browse } from '../tools/dom'
import RLoading from '../loading'

export default {
  name: 'RList',
  mixins: [vSize],
  props: {
    data: Array,
    height: [Number, String],
    maxHeight: [Number, String],
    loading: Boolean,
    className: [String, Function],
    size: { type: String, default: () => GlobalConfigs.list.size || GlobalConfigs.size },
    autoResize: { type: Boolean, default: () => GlobalConfigs.list.autoResize },
    syncResize: [Boolean, String, Number],
    scrollY: Object
  },
  data() {
    return {
      virtualScrollYLoad: false,
      bodyHeight: 0,
      topSpaceHeight: 0,
      items: []
    }
  },
  computed: {
    axisYOptions() {
      return Object.assign({}, GlobalConfigs.list.scrollY, this.scrollY)
    },
    styles() {
      const { height, maxHeight } = this
      const style = {}
      if (height) {
        style.height = isNaN(height) ? height : `${height}px`
      } else if (maxHeight) {
        style.height = 'auto'
        style.maxHeight = isNaN(maxHeight) ? maxHeight : `${maxHeight}px`
      }
      return style
    }
  },
  watch: {
    data(value) {
      this.updateData(value)
    },
    syncResize(value) {
      if (value) {
        this.recalculate()
        this.$nextTick(() => setTimeout(() => this.recalculate()))
      }
    }
  },
  created() {
    Object.assign(this, {
      fullRowsData: [],
      lastScrollLeft: 0,
      lastScrollTop: 0,
      scrollYState: {
        startIndex: 0,
        endIndex: 0,
        visibleSize: 0
      }
    })
    this.updateData(this.data)
    GlobalEvent.on(this, 'resize', this.handleGlobalResizeEvent)
  },
  mounted() {
    if (this.autoResize) {
      const resizeObserver = createResizeEvent(() => this.recalculate())
      resizeObserver.observe(this.$el)
      this.$resize = resizeObserver
    }
  },
  activated() {
    this.recalculate().then(() => this.refreshScroll())
  },
  beforeDestroy() {
    if (this.$resize) {
      this.$resize.disconnect()
    }
  },
  destroyed() {
    GlobalEvent.off(this, 'resize')
  },
  render(h) {
    const { $scopedSlots, styles, bodyHeight, topSpaceHeight, items, className, loading } = this
    return h(
      'div',
      {
        class: [
          'r-table-list',
          className ? (lodash.isFunction(className) ? className({ $list: this }) : className) : '',
          {
            'is--loading': loading
          }
        ]
      },
      [
        h(
          'div',
          {
            ref: 'virtualWrapper',
            class: 'r-table-list--virtual-wrapper',
            style: styles,
            on: {
              scroll: this.scrollEvent
            }
          },
          [
            h('div', {
              ref: 'ySpace',
              class: 'r-table-list--y-space',
              style: {
                height: bodyHeight ? `${bodyHeight}px` : ''
              }
            }),
            h(
              'div',
              {
                ref: 'virtualBody',
                class: 'r-table-list--body',
                style: {
                  marginTop: topSpaceHeight ? `${topSpaceHeight}px` : ''
                }
              },
              $scopedSlots.default ? $scopedSlots.default.call(this, { items, $list: this }, h) : []
            )
          ]
        ),
        /**
         * loading
         */
        h(RLoading, {
          class: 'r-table-list--loading',
          props: {
            value: loading
          }
        })
      ]
    )
  },
  methods: {
    getParentElem() {
      return this.$el.parentNode
    },
    /**
     * Download Data
     * @param {Array} sourceData data
     */
    updateData(sourceData) {
      const { axisYOptions, scrollYState } = this
      const fullRowsData = sourceData || []
      Object.assign(scrollYState, {
        startIndex: 0,
        endIndex: 1,
        visibleSize: 0
      })
      this.fullRowsData = fullRowsData
      // If gt is 0, it is always enabled
      this.virtualScrollYLoad = axisYOptions.enabled && axisYOptions.gt > -1 && (axisYOptions.gt === 0 || axisYOptions.gt <= fullRowsData.length)
      this.handleData()
      return this.computeScrollLoad().then(() => {
        this.refreshScroll()
      })
    },
    /**
     * Reload data
     * @param {Array} sourceData data
     */
    reupdateData(sourceData) {
      this.clearScroll()
      return this.updateData(sourceData)
    },
    handleData() {
      const { fullRowsData, virtualScrollYLoad, scrollYState } = this
      this.items = virtualScrollYLoad ? fullRowsData.slice(scrollYState.startIndex, scrollYState.endIndex) : fullRowsData.slice(0)
      return this.$nextTick()
    },
    /**
     * Recalculate list
     */
    recalculate() {
      const { $el } = this
      if ($el.clientWidth && $el.clientHeight) {
        return this.computeScrollLoad()
      }
      return Promise.resolve()
    },
    /**
     * clear scrollbar
     */
    clearScroll() {
      const scrollBodyElem = this.$refs.virtualWrapper
      if (scrollBodyElem) {
        scrollBodyElem.scrollTop = 0
      }
      return this.$nextTick()
    },
    /**
     * refresh scroll bar
     */
    refreshScroll() {
      const { lastScrollLeft, lastScrollTop } = this
      return this.clearScroll().then(() => {
        if (lastScrollLeft || lastScrollTop) {
          this.lastScrollLeft = 0
          this.lastScrollTop = 0
          return this.scrollTo(lastScrollLeft, lastScrollTop)
        }
      })
    },
    /**
     * If there is a scroll bar, scroll to the corresponding position
     * @param {Number} scrollLeft left distance
     * @param {Number} scrollTop upper distance
     */
    scrollTo(scrollLeft, scrollTop) {
      const scrollBodyElem = this.$refs.virtualWrapper
      if (lodash.isNumber(scrollLeft)) {
        scrollBodyElem.scrollLeft = scrollLeft
      }
      if (lodash.isNumber(scrollTop)) {
        scrollBodyElem.scrollTop = scrollTop
      }
      if (this.virtualScrollYLoad) {
        return new Promise((resolve) => setTimeout(() => resolve(this.$nextTick()), 50))
      }
      return this.$nextTick()
    },
    computeScrollLoad() {
      return this.$nextTick().then(() => {
        const { $refs, axisYOptions, virtualScrollYLoad, scrollYState } = this
        const { virtualWrapper: virtualWrapperElem, virtualBody: virtualBodyElem } = $refs
        let rowHeight = 0
        let firstItemElem
        if (virtualBodyElem) {
          if (axisYOptions.sItem) {
            firstItemElem = virtualBodyElem.querySelector(axisYOptions.sItem)
          }
          if (!firstItemElem) {
            firstItemElem = virtualBodyElem.children[0]
          }
        }
        if (firstItemElem) {
          rowHeight = firstItemElem.offsetHeight
        }
        rowHeight = Math.max(20, rowHeight)
        scrollYState.rowHeight = rowHeight
        // Calculate Y logic
        if (virtualScrollYLoad) {
          const visibleYSize = Math.max(8, Math.ceil(virtualWrapperElem.clientHeight / rowHeight))
          const offsetYSize = axisYOptions.oSize ? lodash.toNumber(axisYOptions.oSize) : browse.msie ? 20 : browse.edge ? 10 : 0
          scrollYState.offsetSize = offsetYSize
          scrollYState.visibleSize = visibleYSize
          scrollYState.endIndex = Math.max(scrollYState.startIndex, visibleYSize + offsetYSize, scrollYState.endIndex)
          this.updateYData()
        } else {
          this.updateYSpace()
        }
        this.rowHeight = rowHeight
      })
    },
    scrollEvent(event) {
      const scrollBodyElem = event.target
      const scrollTop = scrollBodyElem.scrollTop
      const scrollLeft = scrollBodyElem.scrollLeft
      const isX = scrollLeft !== this.lastScrollLeft
      const isY = scrollTop !== this.lastScrollTop
      this.lastScrollTop = scrollTop
      this.lastScrollLeft = scrollLeft
      if (this.virtualScrollYLoad) {
        this.loadYData(event)
      }
      this.$emit('scroll', { scrollLeft, scrollTop, isX, isY, $event: event })
    },
    loadYData(event) {
      const { scrollYState } = this
      const { startIndex, endIndex, visibleSize, offsetSize, rowHeight } = scrollYState
      const scrollBodyElem = event.target
      const scrollTop = scrollBodyElem.scrollTop
      const toVisibleIndex = Math.floor(scrollTop / rowHeight)
      const offsetStartIndex = Math.max(0, toVisibleIndex - 1 - offsetSize)
      const offsetEndIndex = toVisibleIndex + visibleSize + offsetSize
      if (toVisibleIndex <= startIndex || toVisibleIndex >= endIndex - visibleSize - 1) {
        if (startIndex !== offsetStartIndex || endIndex !== offsetEndIndex) {
          scrollYState.startIndex = offsetStartIndex
          scrollYState.endIndex = offsetEndIndex
          this.updateYData()
        }
      }
    },
    updateYData() {
      this.handleData()
      this.updateYSpace()
    },
    updateYSpace() {
      const { scrollYState, virtualScrollYLoad, fullRowsData } = this
      this.bodyHeight = virtualScrollYLoad ? fullRowsData.length * scrollYState.rowHeight : 0
      this.topSpaceHeight = virtualScrollYLoad ? Math.max(scrollYState.startIndex * scrollYState.rowHeight, 0) : 0
    },
    handleGlobalResizeEvent() {
      this.recalculate()
    }
  }
}
