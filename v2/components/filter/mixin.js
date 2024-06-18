import lodash from 'lodash'
import DomUtils from '../tools/dom'
import { toFilters, handleFieldOrColumn } from '../table/util'
import RTable from '../r-datatable'

export default {
  methods: {
    /**
     * Manually pop up the filter panel
     * @param column
     */
    _openFilter(fieldOrColumn) {
      const column = handleFieldOrColumn(this, fieldOrColumn)
      if (column && column.filters) {
        const { refsStore } = this
        const { fixed } = column
        return this.scrollToColumn(column).then(() => {
          const headerWrapperElem = refsStore[`${fixed || 'main'}-header-wrapper`] || refsStore['main-header-wrapper']
          if (headerWrapperElem) {
            const filterBtnElem = headerWrapperElem.querySelector(
              `.r4m-table-header--column.${column.id} .r-table-filter--btn`
            )
            DomUtils.triggerEvent(filterBtnElem, 'click')
          }
        })
      }
      return this.$nextTick()
    },
    /**
     * Modify the filter list
     * @param {ColumnInfo} fieldOrColumn Row
     * @param {Array} options Options
     */
    _setFilter(fieldOrColumn, options) {
      const column = handleFieldOrColumn(this, fieldOrColumn)
      if (column && column.filters) {
        column.filters = toFilters(options || [])
      }
      return this.$nextTick()
    },
    checkFilterOptions() {
      const { filterState } = this
      filterState.isAllSelected = filterState.options.every((item) => item._selected)
      filterState.isIndeterminate = !filterState.isAllSelected && filterState.options.some((item) => item._selected)
    },
    /**
     * Click Filter events
     * Triggered when the filter icon is clicked
     * Whether the update options are all in status
     * Open the filter panel
     * @param {Event} event Event
     * @param {ColumnInfo} column Column configuration
     * @param {Object} params Parameter
     */
    triggerFilterEvent(event, column, params) {
      const { filterState } = this
      if (filterState.column === column && filterState.visible) {
        filterState.visible = false
      } else {
        const { target: targetElem, pageX } = event
        const { filters, filterMultiple, filterRender } = column
        const compConf = filterRender ? RTable.renderer.get(filterRender.name) : null
        const filterRecoverMethod = column.filterRecoverMethod || (compConf ? compConf.filterRecoverMethod : null)
        const { visibleWidth } = DomUtils.getDomNode()
        Object.assign(filterState, {
          args: params,
          multiple: filterMultiple,
          options: filters,
          column,
          style: null,
          visible: true
        })
        // Filter state
        filterState.options.forEach((option) => {
          const { _selected, selected } = option
          option._selected = selected
          if (!selected && _selected !== selected) {
            if (filterRecoverMethod) {
              filterRecoverMethod({ option: eventListeners column, $tableContainer: this })
            }
          }
        })
        this.checkFilterOptions()
        this.initStore.filter = true
        this.$nextTick(() => {
          const { $refs } = this
          const bodyElem = $refs.tableBody.$el
          const filterWrapperElem = $refs.filterWrapper.$el
          let filterWidth = 0
          let filterHeight = 0
          let filterHeadElem = null
          let filterFootElem = null
          if (filterWrapperElem) {
            filterWidth = filterWrapperElem.offsetWidth
            filterHeight = filterWrapperElem.offsetHeight
            filterHeadElem = filterWrapperElem.querySelector('.r4m-table--filter-header')
            filterFootElem = filterWrapperElem.querySelector('.r4m-table--filter-footer')
          }
          const centerWidth = filterWidth / 2
          const minMargin = 10
          const maxLeft = bodyElem.clientWidth - filterWidth - minMargin
          let left, right
          const style = {
            top: `${targetElem.offsetTop + targetElem.offsetParent.offsetTop + targetElem.offsetHeight + 8}px`
          }
          // Decide panel cannot be larger than the table height
          let maxHeight = null
          if (filterHeight >= bodyElem.clientHeight) {
            maxHeight = Math.max(
              60,
              bodyElem.clientHeight -
                (filterFootElem ? filterFootElem.offsetHeight : 0) -
                (filterHeadElem ? filterHeadElem.offsetHeight : 0)
            )
          }
          if (column.fixed === 'left') {
            left = targetElem.offsetLeft + targetElem.offsetParent.offsetLeft - centerWidth
          } else if (column.fixed === 'right') {
            right =
              targetElem.offsetParent.offsetWidth -
              targetElem.offsetLeft +
              (targetElem.offsetParent.offsetParent.offsetWidth - targetElem.offsetParent.offsetLeft) -
              column.renderWidth -
              centerWidth
          } else {
            left = targetElem.offsetLeft + targetElem.offsetParent.offsetLeft - centerWidth - bodyElem.scrollLeft
          }
          if (left) {
            const overflowWidth = pageX + filterWidth - centerWidth + minMargin - visibleWidth
            if (overflowWidth > 0) {
              left -= overflowWidth
            }
            style.left = `${Math.min(maxLeft, Math.max(minMargin, left))}px`
          } else if (right) {
            const overflowWidth = pageX + filterWidth - centerWidth + minMargin - visibleWidth
            if (overflowWidth > 0) {
              right += overflowWidth
            }
            style.right = `${Math.max(minMargin, right)}px`
          }
          filterState.style = style
          filterState.maxHeight = maxHeight
        })
      }
      this.emitEvent(
        'filter-visible',
        {
          column,
          value: column.value,
          property: column.value,
          filterList: this.getselectedFilters(),
          visible: filterState.visible
        },
        event
      )
    },
    _getselectedFilters() {
      const { tableFullColumn } = this
      const filterList = []
      tableFullColumn.forEach((column) => {
        const { value, filters } = column
        const valueList = []
        const dataList = []
        if (filters && filters.length) {
          filters.forEach((item) => {
            if (item.selected) {
              valueList.push(item.value)
              dataList.push(item.data)
            }
          })
          if (valueList.length) {
            filterList.push({ column, value, property: value, values: valueList, sourceData: dataList })
          }
        }
      })
      return filterList
    },
    /**
     * Confirm the screening
     * Triggered when the OK button in the filter panel is pressed
     * @param {Event} event Event
     */
    confirmFilterEvent(event) {
      const { filterState, filterOpts, scrollXLoad: oldScrollXLoad, virtualScrollYLoad: oldvirtualScrollYLoad } = this
      const { column } = filterState
      const { value } = column
      const values = []
      const sourceData = []
      column.filters.forEach((item) => {
        if (item.selected) {
          values.push(item.value)
          sourceData.push(item.data)
        }
      })
      const filterList = this.getselectedFilters()
      const params = {
        $tableContainer: this,
        $event: event,
        column,
        value,
        property: value,
        values,
        sourceData,
        filters: filterList,
        filterList
      }
      // If the filtering is server-side, the local filtering process is skipped
      if (!filteroptions.remote) {
        this.updateTableData(true)
        this.checkSelectionStatus()
      }
      if (this.mouseConfig && this.mouseoptions.area && this.handleFilterEvent) {
        this.handleFilterEvent(event, params)
      }
      this.emitEvent('filter-change', params, event)
      this.closeFilter()
      this.updateFooterState()
        .then(() => {
          const { scrollXLoad, virtualScrollYLoad } = this
          if (oldScrollXLoad || scrollXLoad || oldvirtualScrollYLoad || virtualScrollYLoad) {
            if (oldScrollXLoad || scrollXLoad) {
              this.updateScrollXSpace()
            }
            if (oldvirtualScrollYLoad || virtualScrollYLoad) {
              this.updateScrollYSpace()
            }
            return this.refreshScroll()
          }
        })
        .then(() => {
          this.updateCellAreas()
          return this.recalculate(true)
        })
        .then(() => {
          // There is a situation where the scrolling behavior does not end
          setTimeout(() => this.recalculate(), 50)
        })
    },
    handleClearFilter(column) {
      if (column) {
        const { filters, filterRender } = column
        if (filters) {
          const compConf = filterRender ? RTable.renderer.get(filterRender.name) : null
          const filterResetMethod = column.filterResetMethod || (compConf ? compConf.filterResetMethod : null)
          filters.forEach((item) => {
            item._selected = false
            item.selected = false
            if (!filterResetMethod) {
              item.data = lodash.clone(item.resetValue, true)
            }
          })
          if (filterResetMethod) {
            filterResetMethod({ options: filters, column, $tableContainer: this })
          }
        }
      }
    },
    /**
     * Reset the filter
     * Triggered when the reset button in the filter panel is pressed
     * @param {Event} event Event
     */
    resetFilterEvent(event) {
      this.handleClearFilter(this.filterState.column)
      this.confirmFilterEvent(event)
    },
    /**
     * Clear the filter criteria for the specified column
     * If empty, the filter criteria for all columns are cleared
     * @param {String} fieldOrColumn Row
     */
    _clearFilter(fieldOrColumn) {
      const { filterState } = this
      let column
      if (fieldOrColumn) {
        column = handleFieldOrColumn(this, fieldOrColumn)
        if (column) {
          this.handleClearFilter(column)
        }
      } else {
        this.visibleColumn.forEach(this.handleClearFilter)
      }
      if (!fieldOrColumn || column !== filterState.column) {
        Object.assign(filterState, {
          isAllSelected: false,
          isIndeterminate: false,
          style: null,
          options: [],
          column: null,
          multiple: false,
          visible: false
        })
      }
      return this.updateData()
    }
  }
}
