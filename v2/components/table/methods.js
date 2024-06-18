import lodash, { last } from 'lodash'
import GlobalConfigs from '../r-datatable/src/conf'
import Cell from './cell'
import RTable from '../r-datatable'
import {
  getRowId,
  getRowkey,
  clearTableAllStatus,
  handleFieldOrColumn,
  getRootColumn,
  restoreScrollLocation: eventListeners
  restoreScrollListener,
  toTreePathSeq,
  rowToVisible,
  colToVisible
} from './util'
import Utils, { eqEmptyValue, isEnableConf, getFuncText } from '../tools/utils'
import DomUtils, { browse, getPaddingTopBottomSize, setScrollTop, setScrollLeft } from '../tools/dom'
import { formats } from '../r-datatable/src/formats'
import { warnLog, errLog } from '../tools/log'
import { getSlotVirtualNodes } from '../tools/vn'

const { setCellValue, hasChildrenList, getColumnList } = Utils
const { calcHeight, hasClass, addClass, removeClass, getEventTargetNode, isNodeElement } = DomUtils

const isWebkit = browse['-webkit'] && !browse.edge
const debounceScrollYDuratieventListeners = browse.msie ? 80 : 20

const resizableStorageKey = 'R_TABLE_CUSTOM_COLUMN_WIDTH'
const visibleStorageKey = 'R_TABLE_CUSTOM_COLUMN_VISIBLE'
const fixedStorageKey = 'R_TABLE_CUSTOM_COLUMN_FIXED'
const sortStorageKey = 'R_TABLE_CUSTOM_COLUMN_SORT'

/**
 * Generate the unique primary key of the row
 */
function getRowUniqueId() {
  return lodash.uniqueId('row_')
}

function eqCellValue(row1, row2, field) {
  const val1 = lodash.get(row1, field)
  const val2 = lodash.get(row2, field)
  if (eqEmptyValue(val1) && eqEmptyValue(val2)) {
    return true
  }
  if (lodash.isString(val1) || lodash.isNumber(val1)) {
    return '' + val1 === '' + val2
  }
  return lodash.isEqual(val1, val2)
}

function getNextSortOrder(_vm, column) {
  const orders = _vm.sortoptions.orders
  const currOrder = column.order || null
  const oIndex = orders.indexOf(currOrder) + 1
  return orders[oIndex < orders.length ? oIndex : 0]
}

function getCustomStorageMap(key) {
  const versieventListeners = GlobalConfigs.version
  const rest = lodash.toStringJSON(localStorage.getItem(key))
  return rest && rest._v === version ? rest : { _v: version }
}

const getRecoverRowMaps = (_vm, keyMaps) => {
  const { fullAllDatarowIdData } = _vm
  const restKeys = {}
  lodash.each(keyMaps, (row, rowId) => {
    if (fullAllDatarowIdData[rowId]) {
      restKeys[rowId] = row
    }
  })
  return restKeys
}

function handleReserveRow(_vm, reserveRowMap) {
  const { fullRowsDatarowIdData } = _vm
  const reserveList = []
  lodash.each(reserveRowMap, (item, rowId) => {
    if (fullRowsDatarowIdData[rowId] && reserveList.indexOf(fullRowsDatarowIdData[rowId].row) === -1) {
      reserveList.push(fullRowsDatarowIdData[rowId].row)
    }
  })
  return reserveList
}

function computeVirtualX(_vm) {
  const { $refs, visibleColumn } = _vm
  const { tableBody } = $refs
  const tableBodyEl = tableBody ? tableBody.$el : null
  if (tableBodyEl) {
    const { scrollLeft, clientWidth } = tableBodyEl
    const endWidth = scrollLeft + clientWidth
    let toVisibleIndex = -1
    let cWidth = 0
    let visibleSize = 0
    for (let colIndex = 0, colLen = visibleColumn.length; colIndex < colLen; colIndex++) {
      cWidth += visibleColumn[colIndex].renderWidth
      if (toVisibleIndex === -1 && scrollLeft < cWidth) {
        toVisibleIndex = colIndex
      }
      if (toVisibleIndex >= 0) {
        visibleSize++
        if (cWidth > endWidth) {
          break
        }
      }
    }
    return { toVisibleIndex: Math.max(0, toVisibleIndex), visibleSize: Math.max(8, visibleSize) }
  }
  return { toVisibleIndex: 0, visibleSize: 8 }
}

function computeVirtualY(_vm) {
  const { $refs, vSize, rowHeightMaps } = _vm
  const { tableHeader, tableBody } = $refs
  const tableBodyEl = tableBody ? tableBody.$el : null
  if (tableBodyEl) {
    const tableHeaderElem = tableHeader ? tableHeader.$el : null
    let rowHeight = 0
    let firstTrElem
    firstTrElem = tableBodyEl.querySelector('tr')
    if (!firstTrElem && tableHeaderElem) {
      firstTrElem = tableHeaderElem.querySelector('tr')
    }
    if (firstTrElem) {
      rowHeight = firstTrElem.clientHeight
    }
    if (!rowHeight) {
      rowHeight = rowHeightMaps[vSize || 'default']
    }
    const visibleSize = Math.max(8, Math.ceil(tableBodyEl.clientHeight / rowHeight) + 2)
    return { rowHeight, visibleSize }
  }
  return { rowHeight: 0, visibleSize: 8 }
}

function calculateMergerOffserIndex(list, offsetItem, type) {
  for (let mcIndex = 0, len = list.length; mcIndex < len; mcIndex++) {
    const mergeItem = list[mcIndex]
    const { startIndex, endIndex } = offsetItem
    const mergeStartIndex = mergeItem[type]
    const mergeSpanNumber = mergeItem[type + 'span']
    const mergeEndIndex = mergeStartIndex + mergeSpanNumber
    if (mergeStartIndex < startIndex && startIndex < mergeEndIndex) {
      offsetItem.startIndex = mergeStartIndex
    }
    if (mergeStartIndex < endIndex && endIndex < mergeEndIndex) {
      offsetItem.endIndex = mergeEndIndex
    }
    if (offsetItem.startIndex !== startIndex || offsetItem.endIndex !== endIndex) {
      mcIndex = -1
    }
  }
}

function setMerges(_vm, merges, mList, rowList) {
  if (merges) {
    const { treeConfig, visibleColumn } = _vm
    if (!lodash.isArray(merges)) {
      merges = [merges]
    }
    if (treeConfig && merges.length) {
      errLog('rtable.error.noTree', ['merge-cells | merge-footer-items'])
    }
    merges.forEach((item) => {
      let { row, col, rowspan, colspan } = item
      if (rowList && lodash.isNumber(row)) {
        row = rowList[row]
      }
      if (lodash.isNumber(col)) {
        col = visibleColumn[col]
      }
      if ((rowList ? row : lodash.isNumber(row)) && col && (rowspan || colspan)) {
        rowspan = lodash.toNumber(rowspan) || 1
        colspan = lodash.toNumber(colspan) || 1
        if (rowspan > 1 || colspan > 1) {
          const mcIndex = lodash.findIndexOf(mList, (item) => item._row === row && item._col === col)
          const mergeItem = mList[mcIndex]
          if (mergeItem) {
            mergeItem.rowspan = rowspan
            mergeItem.colspan = colspan
            mergeItem._rowspan = rowspan
            mergeItem._colspan = colspan
          } else {
            const mergeRowIndex = rowList ? rowList.indexOf(row) : row
            const mergeColIndex = visibleColumn.indexOf(col)
            mList.push({
              row: mergeRowIndex,
              col: mergeColIndex,
              rowspan,
              colspan,
              _row: row,
              _col: col,
              _rowspan: rowspan,
              _colspan: colspan
            })
          }
        }
      }
    })
  }
}

function removeMerges(_vm, merges, mList, rowList) {
  const rest = []
  if (merges) {
    const { treeConfig, visibleColumn } = _vm
    if (!lodash.isArray(merges)) {
      merges = [merges]
    }
    if (treeConfig && merges.length) {
      errLog('rtable.error.noTree', ['merge-cells | merge-footer-items'])
    }
    merges.forEach((item) => {
      let { row, col } = item
      if (rowList && lodash.isNumber(row)) {
        row = rowList[row]
      }
      if (lodash.isNumber(col)) {
        col = visibleColumn[col]
      }
      const mcIndex = lodash.findIndexOf(mList, (item) => item._row === row && item._col === col)
      if (mcIndex > -1) {
        const rItems = mList.splice(mcIndex, 1)
        rest.push(rItems[0])
      }
    })
  }
  return rest
}

function clearAllSort(_vm) {
  _vm.tableFullColumn.forEach((column) => {
    column.order = null
  })
}

function getOrderField(_vm, column) {
  const { sortBy, sortType } = column
  return (row) => {
    let cellValue
    if (sortBy) {
      cellValue = lodash.isFunction(sortBy) ? sortBy({ row, column }) : lodash.get(row, sortBy)
    } else {
      cellValue = _vm.getCellLabel(row, column)
    }
    if (!sortType || sortType === 'auto') {
      return isNaN(cellValue) ? cellValue : lodash.toNumber(cellValue)
    } else if (sortType === 'number') {
      return lodash.toNumber(cellValue)
    } else if (sortType === 'string') {
      return lodash.toValueString(cellValue)
    }
    return cellValue
  }
}

const Methods = {
  callSlot(slotFunc, params, h, vNodes) {
    if (slotFunc) {
      const { $rgrid } = this
      if ($rgrid) {
        return $rgrid.callSlot(slotFunc, params, h, vNodes)
      }
      if (lodash.isFunction(slotFunc)) {
        return getSlotVirtualNodes(slotFunc.call(this, params, h, vNodes))
      }
    }
    return []
  },
  /**
   * Get the parent container element
   */
  getParentElem() {
    const { $el, $rgrid } = this
    return $rgrid ? $rgrid.$el.parentNode : $el.parentNode
  },
  /**
   * Get the height of the parent container
   */
  getParentHeight() {
    const { $el, $rgrid, height } = this
    const parentElem = $el.parentNode
    const parentPaddingSize = height === 'auto' ? getPaddingTopBottomSize(parentElem) : 0
    return Math.floor(
      $rgrid ? $rgrid.getParentHeight() : lodash.toNumber(getComputedStyle(parentElem).height) - parentPaddingSize
    )
  },
  /**
   * Get the height to be excluded
   * But when rendering the height of the table, you need to exclude the height of related components such as toolbars or paging.
   * If there is a total scroll bar at the end of the table, you need to exclude the scroll bar height
   */
  getExcludeHeight() {
    const { $rgrid } = this
    return $rgrid ? $rgrid.getExcludeHeight() : 0
  },
  /**
   * Reset all data status of the table
   */
  clearAll() {
    return clearTableAllStatus(this)
  },
  /**
   * Synchronize data data (soon to be obsolete)
   * If this method is used, the component will no longer record the status of additions, deletions and modifications, and can only implement the corresponding logic by itself.
   * It may be used in some special scenarios, such as when deep tree node elements change.
   */
  syncData() {
    warnLog('rtable.error.delFunc', ['syncData', 'getData'])
    return this.$nextTick().then(() => {
      this.tableData = []
      return this.$nextTick().then(() => this.loadTableData(this.tableFullRowsData))
    })
  },
  /**
   * Manual data processing for manual sorting and filtering
   * It may be used when you need to reprocess data after manually changing sorting, filtering, etc. conditions.
   */
  updateData() {
    const { scrollXLoad, virtualScrollYLoad } = this
    return this.updateTableData(true)
      .then(() => {
        this.updateFooterState()
        this.checkSelectionStatus()
        if (scrollXLoad || virtualScrollYLoad) {
          if (scrollXLoad) {
            this.updateScrollXSpace()
          }
          if (virtualScrollYLoad) {
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
        // TODO: Check pagination here
        setTimeout(() => this.recalculate(), 50)
      })
  },
  updateTableData(force) {
    const { virtualScrollYLoad, scrollYState, fullRowsDatarowIdData, afterfullRowsData } = this
    let fullList = afterfullRowsData
    // Whether to perform data processing
    if (force) {
      // Update data, handle filtering and sorting
      this.updateAfterfullRowsData()
      // If it is a virtual tree, flatten the tree structure
      fullList = this.handleVirtualTreeToList()
    }
    const tableData = virtualScrollYLoad ? fullList.slice(scrollYState.startIndex, scrollYState.endIndex) : fullList.slice(0)
    tableData.forEach((row, $index) => {
      const rowId = getRowId(this, row)
      const rest = fullRowsDatarowIdData[rowId]
      if (rest) {
        rest.$index = $index
      }
    })
    this.tableData = tableData
    return this.$nextTick()
  },
  updateScrollYStatus(fullRowsData) {
    const { treeConfig, treeOptions, axisYOptions } = this
    const { transform } = treeOptions
    const allList = fullRowsData || this.tableFullRowsData
    // If gt is 0, it is always enabled
    const virtualScrollYLoad =
      (transform || !treeConfig) &&
      !!axisYOptions.enabled &&
      axisYOptions.gt > -1 &&
      (axisYOptions.gt === 0 || axisYOptions.gt <= allList.length)
    this.virtualScrollYLoad = virtualScrollYLoad
    return virtualScrollYLoad
  },
  /**
   * Load table data
   * @param {Array} sourceData data
   */
  loadTableData(sourceData) {
    const {
      keepSource,
      treeConfig,
      treeOptions,
      editingStore,
      scrollYState,
      scrollXState,
      lastScrollLeft,
      lastScrollTop,
      virtualScrollYLoad: oldvirtualScrollYLoad,
      axisXOptions,
      axisYOptions
    } = this
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    let treeRowsData = []
    let fullRowsData = sourceData ? sourceData.slice(0) : []
    if (treeConfig) {
      // Automatic tree structure conversion
      if (treeOptions.transform) {
        // Automatically generating groups sub-totals
        const groups = fullRowsData.filter((item) => item.dataType === 'group')
        groups.forEach((group) => {
          if (group.groupTotalRow) {
            fullRowsData.push({
              ...group.groupTotalRow,
              parentId: group.route_id,
              route_id: lodash.uniqueId('group-total_'),
              dataType: 'group-total'
            })
          }
        })

        if (import.meta.env.MODE === 'development') {
          if (!treeOptions.rowField) {
            errLog('rtable.error.reqProp', ['table.tree-config.rowField'])
          }
          if (!treeOptions.parentField) {
            errLog('rtable.error.reqProp', ['table.tree-config.parentField'])
          }
          if (!childrenAccessField) {
            errLog('rtable.error.reqProp', ['tree-config.childrenAccessField'])
          }
          if (!treeOptions.mapchildrenAccessField) {
            errLog('rtable.error.reqProp', ['tree-config.mapchildrenAccessField'])
          }
          if (childrenAccessField === treeOptions.mapchildrenAccessField) {
            errLog('rtable.error.errConflicts', ['tree-config.childrenAccessField', 'tree-config.mapchildrenAccessField'])
          }
          fullRowsData.forEach((row) => {
            if (row[childrenAccessField] && row[childrenAccessField].length) {
              warnLog('rtable.error.errConflicts', ['tree-config.transform', `row.${childrenAccessField}`])
            }
          })
        }
        treeRowsData = lodash.toArrayTree(fullRowsData, {
          key: treeOptions.rowField,
          parentKey: treeOptions.parentField,
          children: childrenAccessField
        })
        fullRowsData = treeRowsData.slice(0)
      } else {
        treeRowsData = fullRowsData.slice(0)
      }
    }
    scrollYState.startIndex = 0
    scrollYState.endIndex = 1
    scrollXState.startIndex = 0
    scrollXState.endIndex = 1
    editingStore.insertList = []
    editingStore.insertMaps = {}
    editingStore.removeList = []
    editingStore.removeMaps = {}
    const axisYLoad = this.updateScrollYStatus(fullRowsData)
    this.virtualScrollYLoad = axisYLoad
    // Full data
    this.tableFullRowsData = fullRowsData
    this.tableFullTreeRowsData = treeRowsData
    // cache data
    this.cacheRowMap(true)
    // Raw data
    this.tableSyncData = sourceData
    // Clone the original data to display the editing status and compare it with the edited value.
    if (keepSource) {
      this.cacheSourceMap(fullRowsData)
    }
    if (import.meta.env.MODE === 'development') {
      if (axisYLoad) {
        if (!(this.height || this.maxHeight)) {
          errLog('rtable.error.reqProp', ['table.height | table.max-height | table.scroll-y={enabled: false}'])
        }
        if (!this.showOverflow) {
          warnLog('rtable.error.reqProp', ['table.show-overflow'])
        }
        if (this.customSpanFn) {
          warnLog('rtable.error.scrollErrProp', ['table.span-method'])
        }
      }
    }
    if (this.clearCellAreas && this.mouseConfig) {
      this.clearCellAreas()
      this.clearCopyCellArea()
    }
    this.clearMergedCells()
    this.clearMergeFooterItems()
    this.updateTableData(true)
    this.updateFooterState()
    return this.$nextTick()
      .then(() => {
        this.updateTableHeight()
        this.updateTableStyle()
      })
      .then(() => {
        this.computeScrollLoad()
      })
      .then(() => {
        // Whether virtual scrolling is enabled
        if (axisYLoad) {
          scrollYState.endIndex = scrollYState.visibleSize
        }
        this.handleReserveStatus()
        this.checkSelectionStatus()
        return new Promise((resolve) => {
          this.$nextTick()
            .then(() => this.recalculate())
            .then(() => {
              let targetScrollLeft = lastScrollLeft
              let targetScrollTop = lastScrollTop
              // Whether to automatically reset the scroll bar after updating data
              if (axisXOptions.scrollToLeftOnChange) {
                targetScrollLeft = 0
              }
              if (axisYOptions.scrollToTopOnChange) {
                targetScrollTop = 0
              }
              // Whether to change virtual scrolling
              if (oldVirtualScrollYLoad === axisYLoad) {
                restoreScrollLocation(this, targetScrollLeft, targetScrollTop).then(resolve)
              } else {
                setTimeout(() => restoreScrollLocation(this, targetScrollLeft, targetScrollTop).then(resolve))
              }
            })
        })
      })
  },
  /**
   * Reloading data will not clear the table status
   * @param {Array} sourceData data
   */
  updateData(sourceData) {
    const { inited, initStatus } = this
    return this.loadTableData(sourceData).then(() => {
      this.inited = true
      this.initStatus = true
      if (!initStatus) {
        this.handleLoadDefaults()
      }
      if (!inited) {
        this.handleInitDefaults()
      }
      return this.recalculate()
    })
  },
  /**
   * Reloading data will clear the table status
   * @param {Array} sourceData data
   */
  reupdateData(sourceData) {
    const { inited } = this
    return this.clearAll()
      .then(() => {
        this.inited = true
        this.initStatus = true
        return this.loadTableData(sourceData)
      })
      .then(() => {
        this.handleLoadDefaults()
        if (!inited) {
          this.handleInitDefaults()
        }
        return this.recalculate()
      })
  },
  /**
   * Partially load row data and restore to initial state
   * It may be used in scenarios where row data needs to be partially changed.
   * @param {Row} row row object
   * @param {Object} record new data
   * @param {String} field field name
   */
  reloadRow(row, record, field) {
    const { keepSource, tableSourceData, tableData } = this
    if (keepSource) {
      const rowIndex = this.getRowIndex(row)
      const oRow = tableSourceData[rowIndex]
      if (oRow && row) {
        if (field) {
          const newValue = lodash.get(record || row, field)
          lodash.set(row, field, newValue)
          lodash.set(oRow, field, newValue)
        } else {
          const newRecord = lodash.clone({ ...record }, true)
          lodash.destructuring(oRow, Object.assign(row, newRecord))
        }
      }
      this.tableData = tableData.slice(0)
    } else {
      if (import.meta.env.MODE === 'development') {
        warnLog('rtable.error.reqProp', ['keep-source'])
      }
    }
    return this.$nextTick()
  },
  /**
   * Load column configuration
   * It may be used in scenarios where table columns need to be overloaded or partially incremented.
   * @param {ColumnInfo} columns column configuration
   */
  loadColumn(columns) {
    const columnsCollection = lodash.mapTree(columns, (column) => Cell.makeColumn(this, column), {
      children: 'children'
    })
    return this.handleColumn(columnsCollection)
  },
  /**
   * Load column configuration and restore to initial state
   * It may be used in scenarios where table columns need to be overloaded or partially incremented.
   * @param {ColumnInfo} columns column configuration
   */
  reloadColumn(columns) {
    return this.clearAll().then(() => {
      return this.loadColumn(columns)
    })
  },
  handleColumn(columnsCollection) {
    this.columnsCollection = columnsCollection
    const tableFullColumn = getColumnList(columnsCollection)
    this.tableFullColumn = tableFullColumn
    this.cacheColumnMap(true)
    this.restoreCustomStorage()
    this.parseColumns().then(() => {
      if (this.scrollXLoad) {
        this.loadScrollXData(true)
      }
    })
    this.clearMergedCells()
    this.clearMergeFooterItems()
    this.updateTableData(true)
    if (import.meta.env.MODE === 'development') {
      if ((this.scrollXLoad || this.virtualScrollYLoad) && this.expandColumn) {
        warnLog('rtable.error.scrollErrProp', ['column.type=expand'])
      }
    }
    return this.$nextTick().then(() => {
      if (this.$toolbar) {
        this.$toolbar.syncUpdate({ columnsCollection, $tableContainer: this })
      }
      return this.recalculate()
    })
  },
  /**
   * Update data row Map
   * Sacrifice the time-consuming data assembly in exchange for smooth use
   */
  cacheRowMap(source) {
    const { treeConfig, treeOptions, tableFullRowsData, fullRowsDataRowMap, fullAllDataRowMap, tableFullTreeRowsData } = this
    let { fullRowsDatarowIdData, fullAllDatarowIdData } = this
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const hasChildField = treeOptions.hasChild || treeOptions.hasChildField
    const rowkey = getRowkey(this)
    const isLazy = treeConfig && treeOptions.lazy
    const handleCache = (row, index, items, path, parent, nodes) => {
      let rowId = getRowId(this, row)
      const seq = treeConfig && path ? toTreePathSeq(path) : index + 1
      const level = nodes ? nodes.length - 1 : 0
      if (eqEmptyValue(rowId)) {
        rowId = getRowUniqueId()
        lodash.set(row, rowkey, rowId)
      }
      if (isLazy && row[hasChildField] && lodash.isUndefined(row[childrenAccessField])) {
        row[childrenAccessField] = null
      }
      const rest = {
        row,
        rowId,
        seq,
        index: treeConfig && parent ? -1 : index,
        _index: -1,
        $index: -1,
        items,
        parent,
        level
      }
      if (source) {
        fullRowsDatarowIdData[rowId] = rest
        fullRowsDataRowMap.set(row, rest)
      }
      fullAllDatarowIdData[rowId] = rest
      fullAllDataRowMap.set(row, rest)
    }
    if (source) {
      fullRowsDatarowIdData = this.fullRowsDatarowIdData = {}
      fullRowsDataRowMap.clear()
    }
    fullAllDatarowIdData = this.fullAllDatarowIdData = {}
    fullAllDataRowMap.clear()
    if (treeConfig) {
      lodash.eachTree(tableFullTreeRowsData, handleCache, { children: childrenAccessField })
    } else {
      tableFullRowsData.forEach(handleCache)
    }
  },
  cacheSourceMap(fullRowsData) {
    const { treeConfig, treeOptions } = this
    let { sourceDatarowIdData } = this
    const sourceData = lodash.clone(fullRowsData, true)
    const rowkey = getRowkey(this)
    sourceDatarowIdData = this.sourceDatarowIdData = {}
    const handleSourceRow = (row) => {
      let rowId = getRowId(this, row)
      if (eqEmptyValue(rowId)) {
        rowId = getRowUniqueId()
        lodash.set(row, rowkey, rowId)
      }
      sourceDatarowIdData[rowId] = {
        row,
        rowId
      }
    }
    // Source data caching
    if (treeConfig && !treeOptions.transform) {
      const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
      lodash.eachTree(sourceData, handleSourceRow, {
        children: treeOptions.transform ? childrenAccessField : treeOptions.mapchildrenAccessField
      })
    } else {
      sourceData.forEach(handleSourceRow)
    }
    this.tableSourceData = sourceData
  },
  loadTreeChildren(row, childRecords) {
    const {
      keepSource,
      tableSourceData,
      treeOptions,
      fullRowsDatarowIdData,
      fullRowsDataRowMap,
      fullAllDataRowMap,
      fullAllDatarowIdData,
      sourceDatarowIdData
    } = this
    const { transform, mapchildrenAccessField } = treeOptions
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const rest = fullAllDatarowIdData[getRowId(this, row)]
    const parentLevel = rest ? rest.level : 0
    return this.createData(childRecords).then((rows) => {
      if (keepSource) {
        const rowId = getRowId(this, row)
        const matchObj = lodash.findTree(tableSourceData, (item) => rowId === getRowId(this, item), {
          children: childrenAccessField
        })
        if (matchObj) {
          matchObj.item[childrenAccessField] = lodash.clone(rows, true)
        }
        rows.forEach((childRow) => {
          const rowId = getRowId(this, childRow)
          sourceDatarowIdData[rowId] = lodash.clone(childRow, true)
        })
      }
      lodash.eachTree(
        rows,
        (childRow, index, items, path, parent, nodes) => {
          const rowId = getRowId(this, childRow)
          const parentRow = parent || row
          const rest = {
            row: childRow,
            rowId,
            seq: -1,
            index,
            _index: -1,
            $index: -1,
            items,
            parent: parentRow,
            level: parentLevel + nodes.length
          }
          fullRowsDatarowIdData[rowId] = rest
          fullRowsDataRowMap.set(childRow, rest)
          fullAllDatarowIdData[rowId] = rest
          fullAllDataRowMap.set(childRow, rest)
        },
        { children: childrenAccessField }
      )
      row[childrenAccessField] = rows
      if (transform) {
        row[mapchildrenAccessField] = rows
      }
      this.updateAfterDataIndex()
      return rows
    })
  },
  /**
   * Update data column Map
   * Sacrifice the time-consuming data assembly in exchange for smooth use
   */
  cacheColumnMap(isInit) {
    const { tableFullColumn, columnsCollection, fullColumnMap, showOverflow, columnOptions, rowOpts } = this
    const fullColumnIdData = (this.fullColumnIdData = {})
    const fullColumnFieldData = (this.fullColumnFieldData = {})
    const isGroup = columnsCollection.some(hasChildrenList)
    let isAllOverflow = !!showOverflow
    let expandColumn
    let treeNodeColumn
    let checkboxColumn
    let radioColumn
    let htmlColumn
    let hasFixed
    const handleFunc = (column, index, items, path, parent) => {
      const { id: colid, value, fixed, type, treeNode } = column
      const rest = { column, colid, index, items, parent }
      if (value) {
        if (import.meta.env.MODE === 'development') {
          if (fullColumnFieldData[value]) {
            warnLog('rtable.error.colRepet', ['value', value])
          }
        }
        fullColumnFieldData[value] = rest
      }

      if (!hasFixed && fixed) {
        hasFixed = fixed
      }
      if (!htmlColumn && type === 'html') {
        htmlColumn = column
      }

      if (treeNode) {
        if (import.meta.env.MODE === 'development') {
          if (treeNodeColumn) {
            warnLog('rtable.error.colRepet', ['tree-node', treeNode])
          }
        }
        if (!treeNodeColumn) {
          treeNodeColumn = column
        }
      } else if (type === 'expand') {
        if (import.meta.env.MODE === 'development') {
          if (expandColumn) {
            warnLog('rtable.error.colRepet', ['type', type])
          }
        }
        if (!expandColumn) {
          expandColumn = column
        }
      }
      if (import.meta.env.MODE === 'development') {
        if (type === 'checkbox') {
          if (checkboxColumn) {
            warnLog('rtable.error.colRepet', ['type', type])
          }
          if (!checkboxColumn) {
            checkboxColumn = column
          }
        } else if (type === 'radio') {
          if (radioColumn) {
            warnLog('rtable.error.colRepet', ['type', type])
          }
          if (!radioColumn) {
            radioColumn = column
          }
        }
      }
      if (import.meta.env.MODE === 'development') {
        if (this.showOverflow && column.showOverflow === false) {
          warnLog('rtable.error.errConflicts', [
            `table.show-overflow=${this.showOverflow}`,
            `column.show-overflow=${column.showOverflow}`
          ])
        }
        if (this.showHeaderOverflow && column.showHeaderOverflow === false) {
          warnLog('rtable.error.errConflicts', [
            `table.show-header-overflow=${this.showHeaderOverflow}`,
            `column.show-header-overflow=${column.showHeaderOverflow}`
          ])
        }
        if (this.showFooterOverflow && column.showFooterOverflow === false) {
          warnLog('rtable.error.errConflicts', [
            `table.show-footer-overflow=${this.showFooterOverflow}`,
            `column.show-footer-overflow=${column.showFooterOverflow}`
          ])
        }
      }

      if (import.meta.env.MODE === 'development') {
        if (htmlColumn) {
          if (!columnOptions.useKey) {
            errLog('rtable.error.reqProp', ['column-config.useKey', 'column.type=html'])
          }
          if (!rowoptions.useKey) {
            errLog('rtable.error.reqProp', ['row-config.useKey', 'column.type=html'])
          }
        }
      }

      if (isAllOverflow && column.showOverflow === false) {
        isAllOverflow = false
      }
      if (fullColumnIdData[colid]) {
        errLog('rtable.error.colRepet', ['colId', colid])
      }
      if (isInit) {
        column.sortNumber = index
      }
      fullColumnIdData[colid] = rest
      fullColumnMap.set(column, rest)
    }
    fullColumnMap.clear()
    if (isGroup) {
      lodash.eachTree(columnsCollection, (column, index, items, path, parent, nodes) => {
        column.level = nodes.length
        handleFunc(column, index, items, path, parent)
      })
    } else {
      tableFullColumn.forEach(handleFunc)
    }

    if (import.meta.env.MODE === 'development') {
      if (expandColumn && this.mouseoptions.area) {
        errLog('rtable.error.errConflicts', ['mouse-config.area', 'column.type=expand'])
      }
    }

    this.isGroup = isGroup
    this.treeNodeColumn = treeNodeColumn
    this.expandColumn = expandColumn
    this.isAllOverflow = isAllOverflow
  },
  /**
   * Get the corresponding row information based on the tr element
   * @param {Element} tr element
   */
  getRowNode(tr) {
    if (tr) {
      const { fullAllDatarowIdData } = this
      const rowId = tr.getAttribute('rowId')
      const rest = fullAllDatarowIdData[rowId]
      if (rest) {
        return { rowId: rest.rowId, item: rest.row, index: rest.index, items: rest.items, parent: rest.parent }
      }
    }
    return null
  },
  /**
   * Get the corresponding column information based on th/td elements
   * @param {Element} cell element
   */
  getColumnNode(cell) {
    if (cell) {
      const { fullColumnIdData } = this
      const colid = cell.getAttribute('colid')
      const rest = fullColumnIdData[colid]
      if (rest) {
        return { colid: rest.colid, item: rest.column, index: rest.index, items: rest.items, parent: rest.parent }
      }
    }
    return null
  },
  /**
   * Get the serial number based on row
   * @param {Row} row row object
   */
  getRowSeq(row) {
    const { fullRowsDatarowIdData } = this
    if (row) {
      const rowId = getRowId(this, row)
      const rest = fullRowsDatarowIdData[rowId]
      if (rest) {
        return rest.seq
      }
    }
    return -1
  },
  /**
   * Get the index relative to data based on row
   * @param {Row} row row object
   */
  getRowIndex(row) {
    return this.fullRowsDataRowMap.has(row) ? this.fullRowsDataRowMap.get(row).index : -1
  },
  /**
   * Get the index relative to the current data based on row
   * @param {Row} row row object
   */
  getVTRowIndex(row) {
    return this.afterfullRowsData.indexOf(row)
  },
  // Deprecated
  _getRowIndex(row) {
    if (import.meta.env.MODE === 'development') {
      warnLog('rtable.error.delFunc', ['_getRowIndex', 'getVTRowIndex'])
    }
    return this.getVTRowIndex(row)
  },
  /**
   * Get the virtual index in rendering based on row
   * @param {Row} row row object
   */
  getVMRowIndex(row) {
    return this.tableData.indexOf(row)
  },
  // Deprecated
  $getRowIndex(row) {
    if (import.meta.env.MODE === 'development') {
      warnLog('rtable.error.delFunc', ['$getRowIndex', 'getVMRowIndex'])
    }
    return this.getVMRowIndex(row)
  },
  /**
   * Get the index relative to columns based on column
   * @param {ColumnInfo} column column configuration
   */
  getColumnIndex(column) {
    return this.fullColumnMap.has(column) ? this.fullColumnMap.get(column).index : -1
  },
  /**
   * Get the index relative to the current table column based on column
   * @param {ColumnInfo} column column configuration
   */
  getVTColumnIndex(column) {
    return this.visibleColumn.indexOf(column)
  },
  // Deprecated
  _getColumnIndex(column) {
    if (import.meta.env.MODE === 'development') {
      warnLog('rtable.error.delFunc', ['_getColumnIndex', 'getVTColumnIndex'])
    }
    return this.getVTColumnIndex(column)
  },
  /**
   * Get the virtual index in rendering based on column
   * @param {ColumnInfo} column column configuration
   */
  getVMColumnIndex(column) {
    return this.tableColumn.indexOf(column)
  },
  // Deprecated
  $getColumnIndex(column) {
    if (import.meta.env.MODE === 'development') {
      warnLog('rtable.error.delFunc', ['$getColumnIndex', 'getVMColumnIndex'])
    }
    return this.getVMColumnIndex(column)
  },
  /**
   * Determine whether it is an index column
   * @param {ColumnInfo} column column configuration
   */
  isSeqColumn(column) {
    return column && column.type === 'seq'
  },
  /**
   * Define the column attribute in the row data or define it if it does not exist
   * @param {Row} records row data
   */
  defineField(records) {
    const { radioOpts, selectionOptions, treeConfig, treeOptions, expandOpts } = this
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const rowkey = getRowkey(this)
    if (!lodash.isArray(records)) {
      records = [records || {}]
    }
    return records.map((record) => {
      this.tableFullColumn.forEach((column) => {
        const { value, editingRender } = column
        if (value && !lodash.has(record, value)) {
          let cellValue = null
          if (editingRender) {
            const { defaultValue } = editingRender
            if (lodash.isFunction(defaultValue)) {
              cellValue = defaultValue({ column })
            } else if (!lodash.isUndefined(defaultValue)) {
              cellValue = defaultValue
            }
          }
          lodash.set(record, value, cellValue)
        }
      })
      const otherFields = [
        radiooptions.labelField,
        selectionOptions.checkField,
        selectionOptions.labelField,
        expandoptions.labelField
      ]
      otherFields.forEach((key) => {
        if (key && eqEmptyValue(lodash.get(record, key))) {
          lodash.set(record, key, null)
        }
      })
      if (treeConfig && treeOptions.lazy && lodash.isUndefined(record[childrenAccessField])) {
        record[childrenAccessField] = null
      }
      // There must be a unique primary key for row data, which can be set by yourself; It is also possible to generate a random number by default
      if (eqEmptyValue(lodash.get(record, rowkey))) {
        lodash.set(record, rowkey, getRowUniqueId())
      }
      return record
    })
  },
  /**
   * Create data object
   * It may be used in some special scenarios. The field name of the data will be automatically detected and automatically defined if it does not exist.
   * @param {Array} records new data
   */
  createData(records) {
    return this.$nextTick().then(() => {
      return this.defineField(records)
    })
  },
  /**
   * Create Row|Rows objects
   * This may be used when manual insertion of data is required in some special scenarios.
   * @param {Array/Object} records new data
   */
  createRow(records) {
    const isArr = lodash.isArray(records)
    if (!isArr) {
      records = [records]
    }
    return this.createData(records).then((rows) => (isArr ? rows : rows[0]))
  },
  /**
   * Restore data
   * If no parameters are passed, the entire table will be restored.
   * If row is passed, one row will be restored
   * If rows is passed, multiple rows will be restored
   * If an additional field is passed, the specified cell data will be restored.
   */
  revertData(rows, field) {
    const { keepSource, tableSourceData, treeConfig } = this
    if (!keepSource) {
      if (import.meta.env.MODE === 'development') {
        warnLog('rtable.error.reqProp', ['keep-source'])
      }
      return this.$nextTick()
    }
    let targetRows = rows
    if (rows) {
      if (!lodash.isArray(rows)) {
        targetRows = [rows]
      }
    } else {
      targetRows = lodash.toArray(this.getUpdateRecords())
    }
    if (targetRows.length) {
      targetRows.forEach((row) => {
        if (!this.isInsertByRow(row)) {
          const rowIndex = this.getRowIndex(row)
          if (treeConfig && rowIndex === -1) {
            errLog('rtable.error.noTree', ['revertData'])
          }
          const oRow = tableSourceData[rowIndex]
          if (oRow && row) {
            if (field) {
              lodash.set(row, field, lodash.clone(lodash.get(oRow, field), true))
            } else {
              lodash.destructuring(row, lodash.clone(oRow, true))
            }
          }
        }
      })
    }
    if (rows) {
      return this.$nextTick()
    }
    return this.reupdateData(tableSourceData)
  },
  /**
   * Clear cell contents
   * * If no parameters are created, the entire table content will be cleared.
   * If row is passed, the contents of a row will be cleared.
   * If rows is passed, multiple rows will be cleared.
   * If an additional field is passed, the contents of the specified cell will be cleared.
   * @param {Array/Row} rows row data
   * @param {String} field field name
   */
  clearData(rows, field) {
    const { tableFullRowsData, visibleColumn } = this
    if (!arguments.length) {
      rows = tableFullRowsData
    } else if (rows && !lodash.isArray(rows)) {
      rows = [rows]
    }
    if (field) {
      rows.forEach((row) => lodash.set(row, field, null))
    } else {
      rows.forEach((row) => {
        visibleColumn.forEach((column) => {
          if (column.value) {
            setCellValue(row, column, null)
          }
        })
      })
    }
    return this.$nextTick()
  },
  /**
   * Check whether it is temporary row data
   * @param {Row} row row object
   */
  isInsertByRow(row) {
    const { editingStore } = this
    const rowId = getRowId(this, row)
    return editingStore.insertList.length && editingStore.insertMaps[rowId]
  },
  /**
   * Delete all newly added temporary data
   * @returns
   */
  removeInsertRow() {
    return this.remove(this.editingStore.insertList)
  },
  /**
   * Check whether the row or column data has changed
   * @param {Row} row row object
   * @param {String} field field name
   */
  isUpdateByRow(row, field) {
    const { tableFullColumn, keepSource, sourceDatarowIdData, fullRowsDatarowIdData } = this
    if (keepSource) {
      const rowId = getRowId(this, row)
      // Newly added data does not need to be detected
      if (!fullRowsDatarowIdData[rowId]) {
        return false
      }
      const oldRest = sourceDatarowIdData[rowId]
      if (oldRest) {
        const oRow = oldRest.row
        if (arguments.length > 1) {
          return !eqCellValue(oRow, row, field)
        }
        for (let index = 0, len = tableFullColumn.length; index < len; index++) {
          const property = tableFullColumn[index].value
          if (property && !eqCellValue(oRow, row, property)) {
            return true
          }
        }
      }
    }
    return false
  },
  /**
   * Get the visible columns of the table, or you can specify an index to get the columns
   * @param {Number} columnIndex index
   */
  getColumns(columnIndex) {
    const columns = this.visibleColumn
    return lodash.isUndefined(columnIndex) ? columns.slice(0) : columns[columnIndex]
  },
  /**
   * Get a column based on its unique primary key
   * @param {String} colid column primary key
   */
  getColumnById(colid) {
    const fullColumnIdData = this.fullColumnIdData
    return fullColumnIdData[colid] ? fullColumnIdData[colid].column : null
  },
  /**
   * Get a column based on its field name
   * @param {String} field field name
   */
  getColumnByField(field) {
    const fullColumnFieldData = this.fullColumnFieldData
    return fullColumnFieldData[field] ? fullColumnFieldData[field].column : null
  },
  /**
   * Get the columns of the current table
   * The collected total column, the total header column, the total header column after processing conditions, and the header column in the current rendering
   */
  getTableColumn() {
    return {
      columnsCollection: this.columnsCollection.slice(0),
      fullColumn: this.tableFullColumn.slice(0),
      visibleColumn: this.visibleColumn.slice(0),
      tableColumn: this.tableColumn.slice(0)
    }
  },
  /**
   * Obtain data, which behaves the same as data. You can also specify an index to obtain data.
   */
  getData(rowIndex) {
    const tableSyncData = this.data || this.tableSyncData
    return lodash.isUndefined(rowIndex) ? tableSyncData.slice(0) : tableSyncData[rowIndex]
  },
  /**
   * Used to select multiple rows to obtain the selected data
   */
  getCheckboxRecords(isFull) {
    const {
      tableFullRowsData,
      afterfullRowsData,
      treeConfig,
      treeOptions,
      selectionOptions,
      tableFullTreeRowsData,
      afterTreefullRowsData,
      afterFullRowMaps
    } = this
    const { transform, mapchildrenAccessField } = treeOptions
    const { checkField } = selectionOptions
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const currTableData = isFull
      ? transform
        ? tableFullTreeRowsData
        : tableFullRowsData
      : transform
        ? afterTreefullRowsData
        : afterfullRowsData
    let rowList = []
    if (checkField) {
      if (treeConfig) {
        rowList = lodash.filterTree(currTableData, (row) => lodash.get(row, checkField), {
          children: transform ? childrenAccessField : mapchildrenAccessField
        })
      } else {
        rowList = currTableData.filter((row) => lodash.get(row, checkField))
      }
    } else {
      const { selectCheckboxMaps, fullRowsDatarowIdData } = this
      lodash.each(selectCheckboxMaps, (row, rowId) => {
        if (isFull ? fullRowsDatarowIdData[rowId] : afterFullRowMaps[rowId]) {
          rowList.push(row)
        }
      })
    }
    return rowList
  },
  /**
   * If it is a virtual tree, flatten the tree structure
   * @returns
   */
  handleVirtualTreeToList() {
    const { treeOptions, treeConfig, treeExpandedMap, afterTreefullRowsData, afterfullRowsData } = this
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    if (treeConfig && treeOptions.transform) {
      const fullRowsData = []
      const expandMaps = {}
      lodash.eachTree(
        afterTreefullRowsData,
        (row, index, items, path, parent) => {
          const rowId = getRowId(this, row)
          const parentrowId = getRowId(this, parent)
          if (!parent || (expandMaps[parentrowId] && treeExpandedMap[parentrowId])) {
            expandMaps[rowId] = 1
            fullRowsData.push(row)
          }
        },
        { children: childrenAccessField }
      )
      this.afterfullRowsData = fullRowsData
      this.updateScrollYStatus(fullRowsData)
      return fullRowsData
    }
    return afterfullRowsData
  },
  /**
   * Get the full amount of processed tabular data
   * If there is a filter, proceed with the process
   */
  updateAfterfullRowsData() {
    const { tableFullColumn, tableFullRowsData, filterOpts, sortOpts, treeConfig, treeOptions, tableFullTreeRowsData } = this
    const { remote: allRemoteFilter, filterMethod: allFilterMethod } = filterOpts
    const { remote: allRemoteSort, sortMethod: allSortMethod, multiple: sortMultiple, chronological } = sortOpts
    const { transform } = treeOptions
    let tableData = []
    let tableTree = []
    const filterColumns = []
    let orderColumns = []
    tableFullColumn.forEach((column) => {
      const { value, sortable, order, filters } = column
      if (!allRemoteFilter && filters && filters.length) {
        const valueList = []
        const itemList = []
        filters.forEach((item) => {
          if (item.selected) {
            itemList.push(item)
            valueList.push(item.value)
          }
        })
        if (itemList.length) {
          filterColumns.push({ column, valueList, itemList })
        }
      }
      if (!allRemoteSort && sortable && order) {
        orderColumns.push({ column, value, property: value, order, sortTime: column.sortTime })
      }
    })
    if (sortMultiple && chronological && orderColumns.length > 1) {
      orderColumns = lodash.orderBy(orderColumns, 'sortTime')
    }
    if (filterColumns.length) {
      const handleFilter = (row) => {
        return filterColumns.every(({ column, valueList, itemList }) => {
          if (valueList.length && !allRemoteFilter) {
            const { filterMethod, filterRender, value } = column
            const compConf = filterRender ? RTable.renderer.get(filterRender.name) : null
            const compFilterMethod = compConf && compConf.renderFilter ? compConf.filterMethod : null
            const defaultFilterMethod = compConf ? compConf.defaultFilterMethod : null
            const cellValue = Utils.getCellValue(row, column)
            if (filterMethod) {
              return itemList.some((item) =>
                filterMethod({ value: item.value, option: item, cellValue, row, column, $tableContainer: this })
              )
            } else if (compFilterMethod) {
              return itemList.some((item) =>
                compFilterMethod({ value: item.value, option: item, cellValue, row, column, $tableContainer: this })
              )
            } else if (allFilterMethod) {
              return allFilterMethod({ options: itemList, values: valueList, cellValue, row, column })
            } else if (defaultFilterMethod) {
              return itemList.some((item) =>
                defaultFilterMethod({ value: item.value, option: item, cellValue, row, column, $tableContainer: this })
              )
            }
            return valueList.indexOf(lodash.get(row, value)) > -1
          }
          return true
        })
      }
      if (treeConfig && transform) {
        // Filter the virtual tree
        tableTree = lodash.searchTree(tableFullTreeRowsData, handleFilter, { ...treeOptions, original: true })
        tableData = tableTree
      } else {
        tableData = treeConfig ? tableFullTreeRowsData.filter(handleFilter) : tableFullRowsData.filter(handleFilter)
        tableTree = tableData
      }
    } else {
      if (treeConfig && transform) {
        // Restore the virtual tree
        tableTree = lodash.searchTree(tableFullTreeRowsData, () => true, { ...treeOptions, original: true })
        tableData = tableTree
      } else {
        tableData = treeConfig ? tableFullTreeRowsData.slice(0) : tableFullRowsData.slice(0)
        tableTree = tableData
      }
    }
    const firstOrderColumn = orderColumns[0]
    if (!allRemoteSort && firstOrderColumn) {
      if (treeConfig && transform) {
        // Virtual trees, like lists, can only sort root-level nodes
        if (allSortMethod) {
          const sortRests = allSortMethod({ data: tableTree, sortList: orderColumns, $tableContainer: this })
          tableTree = lodash.isArray(sortRests) ? sortRests : tableTree
        } else {
          tableTree = lodash.orderBy(
            tableTree,
            orderColumns.map(({ column, order }) => [getOrderField(this, column), order])
          )
        }
        tableData = tableTree
      } else {
        if (allSortMethod) {
          const sortRests = allSortMethod({
            data: tableData,
            column: firstOrderColumn.column,
            property: firstOrderColumn.value,
            value: firstOrderColumn.value,
            order: firstOrderColumn.order,
            sortList: orderColumns,
            $tableContainer: this
          })
          tableData = lodash.isArray(sortRests) ? sortRests : tableData
        } else {
          // V4 compatible
          if (sortMultiple) {
            tableData = lodash.orderBy(
              tableData,
              orderColumns.map(({ column, order }) => [getOrderField(this, column), order])
            )
          } else {
            // Compatible with v2, deprecated in v4, sortBy can't be an array
            let sortByConfs
            if (lodash.isArray(firstOrderColumn.sortBy)) {
              sortByConfs = firstOrderColumn.sortBy.map((item) => [item, firstOrderColumn.order])
            }
            tableData = lodash.orderBy(
              tableData,
              sortByConfs || [firstOrderColumn].map(({ column, order }) => [getOrderField(this, column), order])
            )
          }
        }
        tableTree = tableData
      }
    }
    this.afterfullRowsData = tableData
    this.afterTreefullRowsData = tableTree
    this.updateAfterDataIndex()
  },
  /**
   * Pre-compilation
   * Parsing the sequence number and index of the rendered data in advance. Sacrifice the time required for early compilation in exchange for additional loss in rendering, making the runtime smoother
   */
  updateAfterDataIndex() {
    const {
      treeConfig,
      afterfullRowsData,
      fullRowsDatarowIdData,
      fullAllDatarowIdData,
      afterTreefullRowsData,
      treeOptions,
      isGrouped
    } = this
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const fullMaps = {}
    let total = 0
    if (treeConfig) {
      lodash.eachTree(
        afterTreefullRowsData,
        (row, index, items, path) => {
          const rowId = getRowId(this, row)
          const allrest = fullAllDatarowIdData[rowId]
          let seq = ''
          // count all group items total without group & sub-total rows
          if (isGrouped) {
            if (!row.dataType) {
              total++
              seq = total
            }
          } else {
            seq = path.map((num, i) => (i % 2 === 0 ? Number(num) + 1 : '.')).join('')
          }
          if (allrest) {
            allrest.seq = seq
            allrest._index = index
          } else {
            const rest = { row, rowId, seq, index: -1, $index: -1, _index: index, items: [], parent: null, level: 0 }
            fullAllDatarowIdData[rowId] = rest
            fullRowsDatarowIdData[rowId] = rest
          }
          fullMaps[rowId] = row
        },
        { children: treeOptions.transform ? childrenAccessField : treeOptions.mapchildrenAccessField }
      )
    } else {
      afterfullRowsData.forEach((row, index) => {
        const rowId = getRowId(this, row)
        const allrest = fullAllDatarowIdData[rowId]
        const seq = index + 1
        if (allrest) {
          allrest.seq = seq
          allrest._index = index
        } else {
          const rest = { row, rowId, seq, index: -1, $index: -1, _index: index, items: [], parent: null, level: 0 }
          fullAllDatarowIdData[rowId] = rest
          fullRowsDatarowIdData[rowId] = rest
        }
        fullMaps[rowId] = row
      })
    }
    this.afterFullRowMaps = fullMaps
  },
  /**
   * Valid only for tree-config, get the parent of the row
   */
  getParentRow(rowOrrowId) {
    const { treeConfig, fullRowsDatarowIdData } = this
    if (rowOrrowId && treeConfig) {
      let rowId
      if (lodash.isString(rowOrrowId)) {
        rowId = rowOrrowId
      } else {
        rowId = getRowId(this, rowOrrowId)
      }
      if (rowId) {
        const rest = fullRowsDatarowIdData[rowId]
        return rest ? rest.parent : null
      }
    }
    return null
  },
  /**
   * Gets rows based on their unique primary key
   * @param {String/Number} rowId Row primary key
   */
  getRowById(cellValue) {
    const fullRowsDatarowIdData = this.fullRowsDatarowIdData
    const rowId = lodash.eqNull(cellValue) ? '' : encodeURIComponent(cellValue)
    return fullRowsDatarowIdData[rowId] ? fullRowsDatarowIdData[rowId].row : null
  },
  /**
   * Gets the unique primary key of a row based on the row
   * @param {Row} row row object
   */
  getRowId(row) {
    const fullAllDataRowMap = this.fullAllDataRowMap
    return fullAllDataRowMap.has(row) ? fullAllDataRowMap.get(row).rowId : null
  },
  /**
   * Get processed tabular data
   * If there is a filter, proceed with the process
   * If there is a sorting, continue processing
   */
  getRowsData() {
    const { treeConfig, tableFullRowsData, afterfullRowsData, tableData, footerData, tableFullTreeRowsData } = this
    return {
      fullRowsData: treeConfig ? tableFullTreeRowsData.slice(0) : tableFullRowsData.slice(0),
      visibleData: afterfullRowsData.slice(0),
      tableData: tableData.slice(0),
      footerData: footerData.slice(0)
    }
  },
  /**
   * Default behavior for handling data loading
   * Executed once by default, unless reset
   */
  handleLoadDefaults() {
    if (this.selectionConfig) {
      this.handleDefaultSelection()
    }
    if (this.radioConfig) {
      this.handleDefaultRadio()
    }
    if (this.expandConfig) {
      this.handleDefaultRowExpand()
    }
    if (this.treeConfig) {
      this.handleDefaultTreeExpand()
    }
    if (this.mergeCells) {
      this.handleDefaultMergeCells()
    }
    if (this.mergeFooterItems) {
      this.handleDefaultMergeFooterItems()
    }
    this.$nextTick(() => setTimeout(this.recalculate))
  },
  /**
   * The default behavior of handling initialization
   * Executed only once
   */
  handleInitDefaults() {
    const { sortConfig } = this
    if (sortConfig) {
      this.handleDefaultSort()
    }
  },
  /**
   * Set to a fixed column
   */
  fixColumn(fieldOrColumn, fixed) {
    const { isMaxFixedColumn, columnOptions } = this
    const { maxFixedSize } = columnOptions
    const column = handleFieldOrColumn(this, fieldOrColumn)
    const [parentColumn] = getRootColumn(this, column)
    if ([parentColumn] && [parentColumn].fixed !== fixed) {
      // Whether the maximum number of fixed columns is exceeded
      if (![parentColumn].fixed && isMaxFixedColumn) {
        if (RTable.modal) {
          RTable.modal.message({
            status: 'error',
            content: GlobalConfigs.i18n('rtable.table.maxFixedCol', [maxFixedSize])
          })
        }
        return this.$nextTick()
      }
      lodash.eachTree([[parentColumn]], (column) => {
        column.fixed = fixed
      })
      this.saveCustomFixed()
      return this.refreshColumn()
    }
    return this.$nextTick()
  },
  /**
   * Unspecify a fixed column
   */
  clearFixedColumn(fieldOrColumn) {
    const column = handleFieldOrColumn(this, fieldOrColumn)
    const targetColumn = getRootColumn(this, column)
    if (targetColumn && targetColumn.fixed) {
      lodash.eachTree([targetColumn], (column) => {
        column.fixed = null
      })
      this.saveCustomFixed()
      return this.refreshColumn()
    }
    return this.$nextTick()
  },
  /**
   * Hides the specified column
   */
  hideColumn(fieldOrColumn) {
    const column = handleFieldOrColumn(this, fieldOrColumn)
    if (column && column.visible) {
      column.visible = false
      return this.handleCustom()
    }
    return this.$nextTick()
  },
  /**
   * Displays the specified columns
   */
  showColumn(fieldOrColumn) {
    const column = handleFieldOrColumn(this, fieldOrColumn)
    if (column && !column.visible) {
      column.visible = true
      return this.handleCustom()
    }
    return this.$nextTick()
  },
  setColumnWidth(fieldOrColumn, width) {
    const column = handleFieldOrColumn(this, fieldOrColumn)
    if (column) {
      const colWidth = lodash.toInteger(width)
      let rdWidth = colWidth
      if (DomUtils.isScale(width)) {
        const { tableBody } = this.$refs
        const tableBodyEl = tableBody ? tableBody.$el : null
        const bodyWidth = tableBodyEl ? tableBodyEl.clientWidth - 1 : 0
        rdWidth = Math.floor(colWidth * bodyWidth)
      }
      column.renderWidth = rdWidth
    }
    return this.$nextTick()
  },
  getColumnWidth(fieldOrColumn) {
    const column = handleFieldOrColumn(this, fieldOrColumn)
    if (column) {
      return column.renderWidth
    }
    return 0
  },
  /**
   * Manually reset the status of column display and hiding and column width dragging;
   * If true, all states are reset
   * If a toolbar is already linked, it will be updated synchronously
   */
  resetColumnState(options) {
    const { columnsCollection, customOpts } = this
    const { selectionMethod } = customOpts
    const opts = Object.assign(
      {
        visible: true,
        resizable: options === true,
        fixed: options === true,
        sort: options === true
      },
      options
    )
    lodash.eachTree(columnsCollection, (column) => {
      if (options.resizable) {
        column.resizeWidth = 0
      }
      if (options.fixed) {
        column.fixed = column.defaultFixed
      }
      if (options.sort) {
        column.renderSortNumber = column.sortNumber
      }
      if (!selectionMethod || selectionMethod({ column })) {
        column.visible = column.defaultVisible
      }
    })
    if (options.resizable) {
      this.saveCustomResizable(true)
    }
    if (options.fixed) {
      this.saveCustomFixed()
    }
    return this.handleCustom()
  },
  handleCustom() {
    this.saveCustomVisible()
    this.analyColumnWidth()
    return this.refreshColumn(true)
  },
  /**
   * Restore the custom column operation state
   */
  restoreCustomStorage() {
    const { id, columnsCollection, customConfig, customOpts } = this
    const { storage } = customOpts
    const isAllStorage = storage === true
    const storageOpts = isAllStorage ? {} : Object.assign({}, storage || {})
    const isCustomResizable = isAllStorage || storageoptions.resizable
    const isCustomVisible = isAllStorage || storageoptions.visible
    const isCustomFixed = isAllStorage || storageoptions.fixed
    const isCustomSort = isAllStorage || storageoptions.sort
    if (customConfig && (isCustomResizable || isCustomVisible || isCustomFixed || isCustomSort)) {
      const customMap = {}
      if (!id) {
        errLog('rtable.error.reqProp', ['id'])
        return
      }
      if (isCustomResizable) {
        const columnWidthStorage = getCustomStorageMap(resizableStorageKey)[id]
        if (columnWidthStorage) {
          lodash.each(columnWidthStorage, (resizeWidth, value) => {
            customMap[value] = { value, resizeWidth }
          })
        }
      }
      // Custom fixed columns
      if (isCustomFixed) {
        const columnFixedStorage = getCustomStorageMap(fixedStorageKey)[id]
        if (columnFixedStorage) {
          const colFixeds = columnFixedStorage.split(',')
          colFixeds.forEach((fixConf) => {
            const [value, fixed] = fixConf.split('|')
            if (customMap[value]) {
              customMap[value].fixed = fixed
            } else {
              customMap[value] = { value, fixed }
            }
          })
        }
      }
      // Customize the order
      if (isCustomSort) {
        const columnSortStorage = getCustomStorageMap(sortStorageKey)[id]
        if (columnSortStorage) {
          const colOrderSeqs = columnSortStorage.split(',')
          colOrderSeqs.forEach((orderConf) => {
            const [colKey, sortNumber] = orderConf.split('|')
            if (customMap[colKey]) {
              customMap[colKey].sortNumber = sortNumber
            } else {
              customMap[colKey] = { sortNumber }
            }
          })
        }
      }
      if (isCustomVisible) {
        const columnVisibleStorage = getCustomStorageMap(visibleStorageKey)[id]
        if (columnVisibleStorage) {
          const colVisibles = columnVisibleStorage.split('|')
          const colHides = colVisibles[0] ? colVisibles[0].split(',') : []
          const colShows = colVisibles[1] ? colVisibles[1].split(',') : []
          colHides.forEach((value) => {
            if (customMap[value]) {
              customMap[value].visible = false
            } else {
              customMap[value] = { value, visible: false }
            }
          })
          colShows.forEach((value) => {
            if (customMap[value]) {
              customMap[value].visible = true
            } else {
              customMap[value] = { value, visible: true }
            }
          })
        }
      }
      const keyMap = {}
      lodash.eachTree(columnsCollection, (column) => {
        const colKey = column.getKey()
        if (colKey) {
          keyMap[colKey] = column
        }
      })
      lodash.each(customMap, ({ visible, resizeWidth, fixed, sortNumber }, field) => {
        const column = keyMap[field]
        if (column) {
          if (lodash.isNumber(resizeWidth)) {
            column.resizeWidth = resizeWidth
          }
          if (lodash.isBoolean(visible)) {
            column.visible = visible
          }
          if (fixed) {
            column.fixed = fixed
          }
          if (sortNumber) {
            column.colSeq = Number(sortNumber)
          }
        }
      })
    }
  },
  saveCustomFixed() {
    const { id, columnsCollection, customConfig, customOpts } = this
    const { storage } = customOpts
    const isAllStorage = storage === true
    const storageOpts = isAllStorage ? {} : Object.assign({}, storage || {})
    const isCustomFixed = isAllStorage || storageoptions.fixed
    if (customConfig && isCustomFixed) {
      const columnFixedStorageMap = getCustomStorageMap(fixedStorageKey)
      const colFixeds = []
      if (!id) {
        errLog('rtable.error.reqProp', ['id'])
        return
      }
      lodash.eachTree(columnsCollection, (column) => {
        if (column.fixed && column.fixed !== column.defaultFixed) {
          const colKey = column.getKey()
          if (colKey) {
            colFixeds.push(`${colKey}|${column.fixed}`)
          }
        }
      })
      columnFixedStorageMap[id] = colFixeds.join(',') || undefined
      localStorage.setItem(fixedStorageKey, lodash.toJSONString(columnFixedStorageMap))
    }
  },
  saveCustomVisible() {
    const { id, columnsCollection, customConfig, customOpts } = this
    const { selectionMethod, storage } = customOpts
    const isAllStorage = storage === true
    const storageOpts = isAllStorage ? {} : Object.assign({}, storage || {})
    const isCustomVisible = isAllStorage || storageoptions.visible
    if (customConfig && isCustomVisible) {
      const columnVisibleStorageMap = getCustomStorageMap(visibleStorageKey)
      const colHides = []
      const colShows = []
      if (!id) {
        errLog('rtable.error.reqProp', ['id'])
        return
      }
      lodash.eachTree(columnsCollection, (column) => {
        if (!selectionMethod || selectionMethod({ column })) {
          if (!column.visible && column.defaultVisible) {
            const colKey = column.getKey()
            if (colKey) {
              colHides.push(colKey)
            }
          } else if (column.visible && !column.defaultVisible) {
            const colKey = column.getKey()
            if (colKey) {
              colShows.push(colKey)
            }
          }
        }
      })
      columnVisibleStorageMap[id] =
        [colHides.join(',')].concat(colShows.length ? [colShows.join(',')] : []).join('|') || undefined
      localStorage.setItem(visibleStorageKey, lodash.toJSONString(columnVisibleStorageMap))
    }
  },
  saveCustomResizable(isReset) {
    const { id, columnsCollection, customConfig, customOpts } = this
    const { storage } = customOpts
    const isAllStorage = storage === true
    const storageOpts = isAllStorage ? {} : Object.assign({}, storage || {})
    const isResizable = isAllStorage || storageoptions.resizable
    if (customConfig && isResizable) {
      const columnWidthStorageMap = getCustomStorageMap(resizableStorageKey)
      let columnWidthStorage
      if (!id) {
        errLog('rtable.error.reqProp', ['id'])
        return
      }
      if (!isReset) {
        columnWidthStorage = lodash.isPlainObject(columnWidthStorageMap[id]) ? columnWidthStorageMap[id] : {}
        lodash.eachTree(columnsCollection, (column) => {
          if (column.resizeWidth) {
            const colKey = column.getKey()
            if (colKey) {
              columnWidthStorage[colKey] = column.renderWidth
            }
          }
        })
      }
      columnWidthStorageMap[id] = lodash.isEmpty(columnWidthStorage) ? undefined : columnWidthStorage
      localStorage.setItem(resizableStorageKey, lodash.toJSONString(columnWidthStorageMap))
    }
  },
  handleUpdateDataQueue() {
    this.upDataFlag++
  },
  handleRefreshColumnQueue() {
    this.reColumnFlag++
  },
  /**
   * Refresh the column configuration
   */
  refreshColumn(resiveOrder) {
    if (resiveOrder) {
      const columnList = lodash.orderBy(this.columnsCollection, 'renderSortNumber')
      this.columnsCollection = columnList
      const tableFullColumn = getColumnList(columnList)
      this.tableFullColumn = tableFullColumn
      this.cacheColumnMap()
    }
    return this.parseColumns()
      .then(() => {
        return this.refreshScroll()
      })
      .then(() => {
        return this.recalculate()
      })
  },
  /**
   * Refresh column data
   * Push the left and right sides of the fixed columns to the side
   */
  parseColumns() {
    const leftList = []
    const centerList = []
    const rightList = []
    const { columnsCollection, tableFullColumn, isGroup, columnStore, axisXOptions, scrollXState } = this
    // In the case of a grouped header, if all subcolumns are hidden, the root column is also hidden
    if (isGroup) {
      const leftGroupList = []
      const centerGroupList = []
      const rightGroupList = []
      lodash.eachTree(columnsCollection, (column, index, items, path, parent) => {
        const isColGroup = hasChildrenList(column)
        // If it is a group, you must set fixed columns by group, and you are not allowed to set fixed columns to subcolumns
        if (parent && parent.fixed) {
          column.fixed = parent.fixed
        }
        if (parent && column.fixed !== parent.fixed) {
          errLog('rtable.error.groupFixed')
        }
        if (isColGroup) {
          column.visible = !!lodash.findTree(column.children, (subColumn) =>
            hasChildrenList(subColumn) ? null : subColumn.visible
          )
        } else if (column.visible) {
          if (column.fixed === 'left') {
            leftList.push(column)
          } else if (column.fixed === 'right') {
            rightList.push(column)
          } else {
            centerList.push(column)
          }
        }
      })
      columnsCollection.forEach((column) => {
        if (column.visible) {
          if (column.fixed === 'left') {
            leftGroupList.push(column)
          } else if (column.fixed === 'right') {
            rightGroupList.push(column)
          } else {
            centerGroupList.push(column)
          }
        }
      })
      this.tableGroupColumn = leftGroupList.concat(centerGroupList).concat(rightGroupList)
    } else {
      // Polynewness array
      tableFullColumn.forEach((column) => {
        if (column.visible) {
          if (column.fixed === 'left') {
            leftList.push(column)
          } else if (column.fixed === 'right') {
            rightList.push(column)
          } else {
            centerList.push(column)
          }
        }
      })
    }
    const visibleColumn = leftList.concat(centerList).concat(rightList)
    // If gt is 0, it is always enabled
    const scrollXLoad = axisXOptions.enabled && axisXOptions.gt > -1 && (axisXOptions.gt === 0 || axisXOptions.gt <= tableFullColumn.length)
    this.hasFixedColumn = leftList.length > 0 || rightList.length > 0
    Object.assign(columnStore, { leftList, centerList, rightList })
    if (scrollXLoad) {
      if (import.meta.env.MODE === 'development') {
        // if (this.showHeader && !this.showHeaderOverflow) {
        //   warnLog('rtable.error.reqProp', ['show-header-overflow'])
        // }
        // if (this.showFooter && !this.showFooterOverflow) {
        //   warnLog('rtable.error.reqProp', ['show-footer-overflow'])
        // }
        if (this.customSpanFn) {
          warnLog('rtable.error.scrollErrProp', ['span-method'])
        }
        if (this.footercustomSpanFn) {
          warnLog('rtable.error.scrollErrProp', ['footer-span-method'])
        }
      }
      const { visibleSize } = computeVirtualX(this)
      scrollXState.startIndex = 0
      scrollXState.endIndex = visibleSize
      scrollXState.visibleSize = visibleSize
    }
    // If the column is shown/hidden, the merge state is cleared
    // If the column is set to fixed, the merge state is cleared
    if (
      visibleColumn.length !== this.visibleColumn.length ||
      !this.visibleColumn.every((column, index) => column === visibleColumn[index])
    ) {
      this.clearMergedCells()
      this.clearMergeFooterItems()
    }
    this.scrollXLoad = scrollXLoad
    this.visibleColumn = visibleColumn
    this.handleTableColumn()
    return this.updateFooterState()
      .then(() => {
        return this.recalculate()
      })
      .then(() => {
        this.updateCellAreas()
        return this.recalculate()
      })
  },
  /**
   * Specify the width of the column for splitting
   */
  analyColumnWidth() {
    const { columnOptions } = this
    const { width: defaultWidth, minWidth: defaultMinWidth } = columnOptions
    const resizeList = []
    const pxList = []
    const pxMinList = []
    const scaleList = []
    const scaleMinList = []
    const autoList = []
    this.tableFullColumn.forEach((column) => {
      if (defaultWidth && !column.width) {
        column.width = defaultWidth
      }
      if (defaultMinWidth && !column.minWidth) {
        column.minWidth = defaultMinWidth
      }
      if (column.visible) {
        if (column.resizeWidth) {
          resizeList.push(column)
        } else if (DomUtils.isPx(column.width)) {
          pxList.push(column)
        } else if (DomUtils.isScale(column.width)) {
          scaleList.push(column)
        } else if (DomUtils.isPx(column.minWidth)) {
          pxMinList.push(column)
        } else if (DomUtils.isScale(column.minWidth)) {
          scaleMinList.push(column)
        } else {
          autoList.push(column)
        }
      }
    })
    Object.assign(this.columnStore, { resizeList, pxList, pxMinList, scaleList, scaleMinList, autoList })
  },
  /**
   * Refresh scrolling operations, manually synchronize scroll-related positions (for some special operations, e.g. scrollbar misalignment, fixed columns out of sync)
   */
  refreshScroll() {
    const { lastScrollLeft, lastScrollTop } = this
    const { $refs } = this
    const { tableBody, tableFooter } = $refs
    const tableBodyEl = tableBody ? tableBody.$el : null
    const tableFooterElem = tableFooter ? tableFooter.$el : null
    return new Promise((resolve) => {
      // Reset the scrollbar position
      if (lastScrollLeft || lastScrollTop) {
        return restoreScrollLocation(this, lastScrollLeft, lastScrollTop).then(() => {
          // There is a situation where the scrolling behavior does not end
          setTimeout(resolve, 30)
        })
      }
      // Reset
      setScrollTop(tableBodyEl, lastScrollTop)
      // setScrollTop(leftBodyElem, lastScrollTop)
      // setScrollTop(rightBodyElem, lastScrollTop)
      setScrollLeft(tableFooterElem, lastScrollLeft)
      // There is a situation where the scrolling behavior does not end
      setTimeout(resolve, 30)
    })
  },
  computeFixedOffsets() {
    const { leftList, rightList } = this.columnStore
    let offset = 0
    for (let i = 0; i < leftList.length; i++) {
      const column = leftList[i]
      const currentOffset = offset
      offset += column.renderWidth
      column.update('renderLeft', currentOffset)
    }
    offset = 0
    for (let i = rightList.length - 1; i >= 0; i--) {
      const column = rightList[i]
      const currentOffset = offset
      offset += column.renderWidth
      column.update('renderRight', currentOffset)
    }
  },
  /**
   * Calculate the cell column width and dynamically allocate the available remaining space
   * Calculation width=? width=?px width=?% min-width=? min-width=?px min-width=?%
   */
  recalculate(refull) {
    const { $refs } = this
    const { tableBody, tableHeader, tableFooter } = $refs
    const bodyElem = tableBody ? tableBody.$el : null
    const headerElem = tableHeader ? tableHeader.$el : null
    const footerElem = tableFooter ? tableFooter.$el : null
    if (bodyElem) {
      this.autoCellWidth(headerElem, bodyElem, footerElem)
      if (refull === true) {
        // During initialization: eventListeners you need to perform optimization operations after column calculation to achieve the optimal display effect
        return this.computeScrollLoad().then(() => {
          this.autoCellWidth(headerElem, bodyElem, footerElem)
          return this.computeScrollLoad()
        })
      }
    }
    return this.computeScrollLoad()
  },
  /**
   * Column width algorithm
   * Support px, %, fixed mixed allocation
   * Support dynamic list adjustment allocation
   * Support for automatic offset assignment
   * @param {Element} headerElem
   * @param {Element} bodyElem
   * @param {Element} footerElem
   * @param {Number} bodyWidth
   */
  autoCellWidth(headerElem, bodyElem, footerElem) {
    let tableWidth = 0
    const minCellWidth = 40 // Column width minimum limit 40px
    const bodyWidth = bodyElem.clientWidth - 1
    let remainWidth = bodyWidth
    let meanWidth = remainWidth / 100
    const { fit, columnStore } = this
    const { resizeList, pxMinList, pxList, scaleList, scaleMinList, autoList } = columnStore
    // Minimum width
    pxMinList.forEach((column) => {
      const minWidth = parseInt(column.minWidth)
      tableWidth += minWidth
      column.renderWidth = minWidth
    })
    // Minimum percentage
    scaleMinList.forEach((column) => {
      const scaleWidth = Math.floor(parseInt(column.minWidth) * meanWidth)
      tableWidth += scaleWidth
      column.renderWidth = scaleWidth
    })
    // Fixed percentage
    scaleList.forEach((column) => {
      const scaleWidth = Math.floor(parseInt(column.width) * meanWidth)
      tableWidth += scaleWidth
      column.renderWidth = scaleWidth
    })
    // Fixed width
    pxList.forEach((column) => {
      const width = parseInt(column.width)
      tableWidth += width
      column.renderWidth = width
    })
    // Adjusted column widths
    resizeList.forEach((column) => {
      const width = parseInt(column.resizeWidth)
      tableWidth += width
      column.renderWidth = width
    })
    remainWidth -= tableWidth
    meanWidth =
      remainWidth > 0 ? Math.floor(remainWidth / (scaleMinList.length + pxMinList.length + autoList.length)) : 0
    if (fit) {
      if (remainWidth > 0) {
        scaleMinList.concat(pxMinList).forEach((column) => {
          tableWidth += meanWidth
          column.renderWidth += meanWidth
        })
      }
    } else {
      meanWidth = minCellWidth
    }
    // Adaptive
    autoList.forEach((column) => {
      const width = Math.max(meanWidth, minCellWidth)
      column.renderWidth = width
      tableWidth += width
    })
    if (fit) {
      /**
       * Offset algorithm
       * If all columns are enough to be placed, the assignment starts from the last dynamic column
       */
      const dynamicList = scaleList.concat(scaleMinList).concat(pxMinList).concat(autoList)
      let dynamicSize = dynamicList.length - 1
      if (dynamicSize > 0) {
        let odiffer = bodyWidth - tableWidth
        if (odiffer > 0) {
          while (odiffer > 0 && dynamicSize >= 0) {
            odiffer--
            dynamicList[dynamicSize--].renderWidth++
          }
          tableWidth = bodyWidth
        }
      }
    }
    const tableHeight = bodyElem.offsetHeight
    const overflowY = bodyElem.scrollHeight > bodyElem.clientHeight
    this.scrollbarWidth = overflowY ? bodyElem.offsetWidth - bodyElem.clientWidth : 0
    this.overflowY = overflowY
    this.tableWidth = tableWidth
    this.tableHeight = tableHeight
    if (headerElem) {
      this.headerHeight = headerElem.clientHeight
      this.$nextTick(() => {
        // Detects whether scrolling is synchronized
        if (headerElem && bodyElem && headerElem.scrollLeft !== bodyElem.scrollLeft) {
          headerElem.scrollLeft = bodyElem.scrollLeft
        }
      })
    } else {
      this.headerHeight = 0
    }
    if (footerElem) {
      const footerHeight = footerElem.offsetHeight
      this.scrollbarHeight = Math.max(footerHeight - footerElem.clientHeight, 0)
      this.overflowX = tableWidth > footerElem.clientWidth
      this.footerHeight = footerHeight
    } else {
      this.footerHeight = 0
      this.scrollbarHeight = Math.max(tableHeight - bodyElem.clientHeight, 0)
      this.overflowX = tableWidth > bodyWidth
    }
    this.updateTableHeight()
    this.parentHeight = Math.max(this.headerHeight + this.footerHeight + 20, this.getParentHeight())
    if (this.overflowX) {
      this.checkScrolling()
    }
    this.computeFixedOffsets()
  },
  updateTableHeight() {
    this.customHeight = calcHeight(this, 'height')
    this.customMinHeight = calcHeight(this, 'minHeight')
    this.customMaxHeight = calcHeight(this, 'maxHeight')
  },
  updateTableStyle() {
    const {
      $refs,
      isGroup,
      fullColumnIdData,
      tableColumn,
      customMinHeight,
      customMaxHeight,
      border,
      headerHeight,
      showFooter,
      showOverflow: allColumnOverflow,
      showHeaderOverflow: columnHeaderOverflow,
      showFooterOverflow: allColumnFooterOverflow,
      footerHeight,
      tableHeight,
      tableWidth,
      scrollbarHeight,
      scrollbarWidth,
      scrollXLoad,
      virtualScrollYLoad,
      cellOffsetWidth,
      columnStore,
      refsStore,
      editingStore,
      currentRow,
      mouseConfig,
      keyboardConfig,
      keyboardOpts,
      customSpanFn,
      mergeList,
      mergeFooterList,
      footercustomSpanFn,
      isAllOverflow,
      visibleColumn
    } = this
    let { customHeight } = this
    const containerList = ['main', 'left', 'right']
    const emptyPlaceholderElem = $refs.emptyPlaceholder
    const bodyWrapperElem = refsStore['main-body-wrapper']
    if (emptyPlaceholderElem) {
      emptyPlaceholderElem.style.top = `${headerHeight}px`
      emptyPlaceholderElem.style.height = bodyWrapperElem ? `${bodyWrapperElem.offsetHeight - scrollbarHeight}px` : ''
    }
    if (customHeight > 0) {
      if (showFooter) {
        customHeight += scrollbarHeight
      }
    }
    containerList.forEach((name, index) => {
      const isFixed = index > 0 ? name : ''
      const layoutList = ['header', 'body', 'footer']
      const fixedColumn = columnStore[`${isFixed}List`]
      const fixedWrapperElem = $refs[`${isFixed}Container`]
      layoutList.forEach((layout) => {
        const wrapperElem = refsStore[`${name}-${layout}-wrapper`]
        const tableElem = refsStore[`${name}-${layout}-table`]
        if (layout === 'header') {
          // header style processing
          // horizontal scroll rendering
          let tWidth = tableWidth
          let renderColumnList = tableColumn

          if (isGroup) {
            renderColumnList = visibleColumn
          } else {
            // If you are using Optimized Mode
            if (isFixed) {
              if (scrollXLoad || columnHeaderOverflow) {
                renderColumnList = fixedColumn
              }
            }
          }

          tWidth = renderColumnList.reduce((previous, column) => previous + column.renderWidth, 0)

          if (tableElem) {
            tableElem.style.width = tWidth ? `${tWidth + scrollbarWidth}px` : ''
            // Fixed the issue that the height could not be adapted in IE
            if (browse.msie) {
              lodash.arrayEach(tableElem.querySelectorAll('.r4m-table-resizable'), (resizeElem) => {
                resizeElem.style.height = `${resizeElem.parentNode.offsetHeight}px`
              })
            }
          }

          const repairElem = refsStore[`${name}-${layout}-repair`]
          if (repairElem) {
            repairElem.style.width = `${tableWidth}px`
          }

          const listElem = refsStore[`${name}-${layout}-list`]
          if (isGroup && listElem) {
            lodash.arrayEach(listElem.querySelectorAll('.col--group'), (thElem) => {
              const colNode = this.getColumnNode(thElem)
              if (colNode) {
                const column = colNode.item
                const { showHeaderOverflow } = column
                const cellOverflow = lodash.isBoolean(showHeaderOverflow)
                  ? showHeaderOverflow
                  : columnHeaderOverflow
                const showEllipsis = cellOverflow === 'ellipsis'
                const showTitle = cellOverflow === 'title'
                const showTooltip = cellOverflow === true || cellOverflow === 'tooltip'
                const hasEllipsis = showTitle || showTooltip || showEllipsis
                let childWidth = 0
                let countChild = 0
                if (hasEllipsis) {
                  lodash.eachTree(column.children, (item) => {
                    if (!item.children || !column.children.length) {
                      countChild++
                    }
                    childWidth += item.renderWidth
                  })
                }
                thElem.style.width = hasEllipsis ? `${childWidth - countChild - (border ? 2 : 0)}px` : ''
              }
            })
          }
        } else if (layout === 'body') {
          const emptyBlockElem = refsStore[`${name}-${layout}-emptyBlock`]
          if (isNodeElement(wrapperElem)) {
            let bodyMaxHeight = 0
            const bodyMinHeight = customMinHeight - headerHeight - footerHeight
            if (customMaxHeight) {
              bodyMaxHeight = customMaxHeight - headerHeight - footerHeight
              // If it's a fixed column
              if (isFixed) {
                bodyMaxHeight -= showFooter ? 0 : scrollbarHeight
              }
              bodyMaxHeight = Math.max(bodyMinHeight, bodyMaxHeight)
              wrapperElem.style.maxHeight = `${bodyMaxHeight}px`
            }
            if (customHeight) {
              let bodyHeight = customHeight - headerHeight - footerHeight
              // If it's a fixed column
              if (isFixed) {
                bodyHeight -= showFooter ? 0 : scrollbarHeight
              }
              if (bodyMaxHeight) {
                bodyHeight = Math.min(bodyMaxHeight, bodyHeight)
              }
              const calculatedWrapperHeight = Math.max(bodyMinHeight, bodyHeight)
              wrapperElem.style.height = `${calculatedWrapperHeight}px`
              this.wrapperHeight = calculatedWrapperHeight
            } else {
              wrapperElem.style.height = ''
            }
            wrapperElem.style.minHeight = `${bodyMinHeight}px`
          }

          // If it's a fixed column
          if (fixedWrapperElem) {
            const isRightFixed = isFixed === 'right'
            const fixedColumn = columnStore[`${isFixed}List`]
            if (isNodeElement(wrapperElem)) {
              wrapperElem.style.top = `${headerHeight}px`
            }
            // eslint-disable-next-line max-len
            fixedWrapperElem.style.height = `${(customHeight > 0 ? customHeight - headerHeight - footerHeight : tableHeight) + headerHeight + footerHeight - scrollbarHeight * (showFooter ? 2 : 1)}px`
            // eslint-disable-next-line max-len
            fixedWrapperElem.style.width = `${fixedColumn.reduce((previous, column) => previous + column.renderWidth, isRightFixed ? scrollbarWidth : 0)}px`
          }

          let tWidth = tableWidth
          let renderColumnList = tableColumn

          // If you are using Optimized Mode
          if (isFixed) {
            // If there is an expanded line, full rendering is used
            if (
              !this.expandColumn &&
              (scrollXLoad || virtualScrollYLoad || (allColumnOverflow ? isAllOverflow : allColumnOverflow))
            ) {
              if (!mergeList.length && !customSpanFn && !(keyboardConfig && keyboardoptions.isMerge)) {
                renderColumnList = fixedColumn
              } else {
                renderColumnList = visibleColumn
              }
            } else {
              renderColumnList = visibleColumn
            }
          }
          tWidth = renderColumnList.reduce((previous, column) => previous + column.renderWidth, 0)

          if (tableElem) {
            tableElem.style.width = tWidth ? `${tWidth}px` : ''
            // Compatibility Processing
            tableElem.style.paddingRight =
              scrollbarWidth && isFixed && (browse['-moz'] || browse.safari) ? `${scrollbarWidth}px` : ''
          }
          if (emptyBlockElem) {
            emptyBlockElem.style.width = tWidth ? `${tWidth}px` : ''
          }
        } else if (layout === 'footer') {
          let tWidth = tableWidth
          let renderColumnList = tableColumn

          // If you are using Optimized Mode
          if (isFixed) {
            // If there is an expanded line, full rendering is used
            if (!this.expandColumn && (scrollXLoad || allColumnFooterOverflow)) {
              if (!mergeFooterList.length || !footercustomSpanFn) {
                renderColumnList = fixedColumn
              } else {
                renderColumnList = visibleColumn
              }
            } else {
              renderColumnList = visibleColumn
            }
          }
          tWidth = renderColumnList.reduce((previous, column) => previous + column.renderWidth, 0)

          if (isNodeElement(wrapperElem)) {
            // If it's a fixed column
            if (fixedWrapperElem) {
              wrapperElem.style.top = `${customHeight > 0 ? customHeight - footerHeight : tableHeight + headerHeight}px`
            }
            wrapperElem.style.marginTop = `${-scrollbarHeight}px`
          }
          if (tableElem) {
            tableElem.style.width = tWidth ? `${tWidth + scrollbarWidth}px` : ''
          }
        }
        const colgroupElem = refsStore[`${name}-${layout}-colgroup`]
        if (colgroupElem) {
          lodash.arrayEach(colgroupElem.children, (colElem) => {
            const colid = colElem.getAttribute('name')
            if (colid === 'col_gutter') {
              colElem.style.width = `${scrollbarWidth}px`
            }
            if (fullColumnIdData[colid]) {
              const column = fullColumnIdData[colid].column
              const { showHeaderOverflow, showFooterOverflow, showOverflow } = column
              let cellOverflow
              colElem.style.width = `${column.renderWidth}px`
              if (layout === 'header') {
                cellOverflow =
                  lodash.isUndefined(showHeaderOverflow) || lodash.isNull(showHeaderOverflow)
                    ? columnHeaderOverflow
                    : showHeaderOverflow
              } else if (layout === 'footer') {
                cellOverflow =
                  lodash.isUndefined(showFooterOverflow) || lodash.isNull(showFooterOverflow)
                    ? allColumnFooterOverflow
                    : showFooterOverflow
              } else {
                cellOverflow =
                  lodash.isUndefined(showOverflow) || lodash.isNull(showOverflow) ? allColumnOverflow : showOverflow
              }
              const showEllipsis = cellOverflow === 'ellipsis'
              const showTitle = cellOverflow === 'title'
              const showTooltip = cellOverflow === true || cellOverflow === 'tooltip'
              let hasEllipsis = showTitle || showTooltip || showEllipsis
              const listElem = refsStore[`${name}-${layout}-list`]
              // Scrolling rendering does not support dynamic line heights
              if (layout === 'header' || layout === 'footer') {
                if (scrollXLoad && !hasEllipsis) {
                  hasEllipsis = true
                }
              } else {
                if ((scrollXLoad || virtualScrollYLoad) && !hasEllipsis) {
                  hasEllipsis = true
                }
              }
              if (listElem) {
                lodash.arrayEach(listElem.querySelectorAll(`.${column.id}`), (elem) => {
                  const colspan = parseInt(elem.getAttribute('colspan') || 1)
                  const cellElem = elem.querySelector('.r4m-table-cell')
                  let colWidth = column.renderWidth
                  if (cellElem) {
                    if (colspan > 1) {
                      const columnIndex = this.getColumnIndex(column)
                      for (let index = 1; index < colspan; index++) {
                        const nextColumn = this.getColumns(columnIndex + index)
                        if (nextColumn) {
                          colWidth += nextColumn.renderWidth
                        }
                      }
                    }
                    cellElem.style.width = hasEllipsis ? `${colWidth - cellOffsetWidth * colspan}px` : ''
                  }
                })
              }
            }
          })
        }
      })
    })
    if (currentRow) {
      this.setCurrentRow(currentRow)
    }
    if (mouseConfig && mouseConfig.selected && editingStore.selected.row && editingStore.selected.column) {
      this.addColSdCls()
    }
    return this.$nextTick()
  },
  /**
   * Handles the display status of fixed columns
   */
  checkScrolling() {
    const { tableBody, leftContainer, rightContainer } = this.$refs
    const bodyElem = tableBody ? tableBody.$el : null
    if (bodyElem) {
      if (leftContainer) {
        DomUtils[bodyElem.scrollLeft > 0 ? 'addClass' : 'removeClass'](leftContainer, 'scrolling--middle')
      }
      if (rightContainer) {
        DomUtils[
          bodyElem.clientWidth < bodyElem.scrollWidth - Math.ceil(bodyElem.scrollLeft) ? 'addClass' : 'removeClass'
        ](rightContainer, 'scrolling--middle')
      }
    }
  },
  preventEvent(event, type, args, next, end) {
    const eventList = RTable.interceptor.get(type)
    let rest
    if (
      !eventList.some((func) => func(Object.assign({ $gridContainer: this.$rgrid, $tableContainer: this, $event: event }, args)) === false)
    ) {
      if (next) {
        rest = next()
      }
    }
    if (end) {
      end()
    }
    return rest
  },
  /**
   * Global mouse press event processing
   */
  handleGlobalMousedownEvent(event) {
    const {
      $el,
      $refs,
      $rgrid,
      $toolbar,
      mouseConfig,
      editingStore,
      ctxMenuStore,
      editRules,
      editingOptions,
      validOpts,
      filterState,
      customStore,
      getRowNode
    } = this
    const { actived } = editingStore
    const { ctxWrapper, filterWrapper, customWrapper, validTip } = $refs
    // Sift
    if (filterWrapper) {
      if (getEventTargetNode(event, $el, 'r4m-table-cell--filter').flag) {
        // When you clicked the Filter button
      } else if (getEventTargetNode(event, filterWrapper.$el).flag) {
        // When you click Filter containers
      } else {
        if (!getEventTargetNode(event, document.body, 'r4m-table--ignore-clear').flag) {
          this.preventEvent(event, 'event.clearFilter', filterState.args, this.closeFilter)
        }
      }
    }
    // Custom columns
    if (customWrapper) {
      if (
        customStore.btnEl === event.target ||
        getEventTargetNode(event, document.body, 'r-toolbar-custom-target').flag
      ) {
        // When clicked the Custom Columns button
      } else if (getEventTargetNode(event, customWrapper.$el).flag) {
        // When you click Custom Columns Container
      } else {
        if (!getEventTargetNode(event, document.body, 'r4m-table--ignore-clear').flag) {
          this.preventEvent(event, 'event.clearCustom', {}, () => this.closeCustom())
        }
      }
    }

    // If the edit status is activated
    if (actived.row) {
      if (!(editingOptions.autoClear === false)) {
        // If it's active, click outside the cell
        const cell = actived.args.cell
        if (!cell || !getEventTargetNode(event, cell).flag) {
          if (validTip && getEventTargetNode(event, validTip.$el).flag) {
            // If it is active, and the verification prompt is clicked
          } else if (!this.lastCallTime || this.lastCallTime + 50 < Date.now()) {
            if (!getEventTargetNode(event, document.body, 'r4m-table--ignore-clear').flag) {
              // If the activation cell is manually called, avoid repeated closures after the trigger source is removed
              this.preventEvent(event, 'event.clearActived', actived.args, () => {
                let isClearActived
                if (editingOptions.mode === 'row') {
                  const rowNode = getEventTargetNode(event, $el, 'r4m-table-body--row')
                  // row, if you click on a different row
                  isClearActived = rowNode.flag ? getRowNode(rowNode.targetElem).item !== actived.args.row : false
                } else {
                  // cell, if it is a non-editing column
                  isClearActived = !getEventTargetNode(event, $el, 'col--edit').flag
                }
                // When clicked on the header row, the activation status is cleared
                if (!isClearActived) {
                  isClearActived = getEventTargetNode(event, $el, 'r4m-table-header--row').flag
                }
                // If you click on the footer row, the activation status is cleared
                if (!isClearActived) {
                  isClearActived = getEventTargetNode(event, $el, 'r4m-table-footer--row').flag
                }
                // If the height is fixed and a blank space outside the row is clicked, the active state is cleared
                if (!isClearActived && this.height && !this.overflowY) {
                  const bodyWrapperElem = event.target
                  if (hasClass(bodyWrapperElem, 'r4m-table--body-wrapper')) {
                    isClearActived = event.offsetY < bodyWrapperElem.clientHeight
                  }
                }
                if (
                  isClearActived ||
                  // If you clicked outside the current table
                  !getEventTargetNode(event, $el).flag
                ) {
                  setTimeout(() => this.clearEdit(event))
                }
              })
            }
          }
        }
      }
    } else if (mouseConfig) {
      if (
        !getEventTargetNode(event, $el).flag &&
        !($rgrid && getEventTargetNode(event, $rgrid.$el).flag) &&
        !(ctxWrapper && getEventTargetNode(event, ctxWrapper.$el).flag) &&
        !($toolbar && getEventTargetNode(event, $toolbar.$el).flag)
      ) {
        this.clearSelected()
        if (!getEventTargetNode(event, document.body, 'r4m-table--ignore-areas-clear').flag) {
          this.preventEvent(event, 'event.clearAreas', {}, () => {
            this.clearCellAreas()
            this.clearCopyCellArea()
          })
        }
      }
    }
    // If the shortcut menu is configured and clicks elsewhere, it closes
    if (ctxMenuStore.visible && ctxWrapper && !getEventTargetNode(event, ctxWrapper.$el).flag) {
      this.closeMenu()
    }
    const isActivated = getEventTargetNode(event, ($rgrid || this).$el).flag
    // If there is a check, click outside the table to clear it
    if (!isActivated && editRules && validoptions.autoClear) {
      this.validErrorMaps = {}
    }
    // The last activated form
    this.isActivated = isActivated
  },
  /**
   * Window out-of-focus event handling
   */
  handleGlobalBlurEvent() {
    this.closeFilter()
    this.closeMenu()
  },
  /**
   * Global scroll events
   */
  handleGlobalMousewheelEvent() {
    this.closeTooltip()
    this.closeMenu()
  },
  /**
   * Table keyboard events
   */
  keydownEvent(event) {
    const { filterState, ctxMenuStore, editingStore, keyboardConfig, mouseConfig, mouseOpts, keyboardOpts } = this
    const { actived } = editingStore
    const { keyCode } = event
    const isEsc = keyCode === 27
    if (isEsc) {
      this.preventEvent(event, 'event.keydown', null, () => {
        this.emitEvent('keydown-start', {}, event)
        if (keyboardConfig && mouseConfig && mouseoptions.area && this.handleKeyboardEvent) {
          this.handleKeyboardEvent(event)
        } else if (actived.row || filterState.visible || ctxMenuStore.visible) {
          event.stopPropagation()
          // If the Esc key is pressed, close the shortcut menu, Filter
          this.closeFilter()
          this.closeMenu()
          if (keyboardConfig && keyboardoptions.isEsc) {
            // If the edit state is active, the edit is canceled
            if (actived.row) {
              const params = actived.args
              this.clearEdit(event)
              // If the selected function is configured, it is selected
              if (mouseConfig && mouseoptions.selected) {
                this.$nextTick(() => this.handleSelected(params, event))
              }
            }
          }
        }
        this.emitEvent('keydown', {}, event)
        this.emitEvent('keydown-end', {}, event)
      })
    }
  },
  /**
   * Global keyboard events
   */
  handleGlobalKeydownEvent(event) {
    // This behavior only works for currently active tables
    if (this.isActivated) {
      this.preventEvent(event, 'event.keydown', null, () => {
        const {
          filterState,
          isCtxMenu,
          ctxMenuStore,
          editingStore,
          editingOptions,
          editingConfig,
          mouseConfig,
          mouseOpts,
          keyboardConfig,
          keyboardOpts,
          treeConfig,
          treeOptions,
          highlightCurrentRow,
          currentRow,
          bodyCtxMenu,
          rowOpts
        } = this
        const { selected, actived } = editingStore
        const { keyCode } = event
        const isBack = keyCode === 8
        const isTab = keyCode === 9
        const isEnter = keyCode === 13
        const isEsc = keyCode === 27
        const isSpacebar = keyCode === 32
        const isLeftArrow = keyCode === 37
        const isUpArrow = keyCode === 38
        const isRightArrow = keyCode === 39
        const isDwArrow = keyCode === 40
        const isDel = keyCode === 46
        const isF2 = keyCode === 113
        const isContextMenu = keyCode === 93
        const hasMetaKey = event.metaKey
        const hasCtrlKey = event.ctrlKey
        const hasShiftKey = event.shiftKey
        const hasAltKey = event.altKey
        const operArrow = isLeftArrow || isUpArrow || isRightArrow || isDwArrow
        const operCtxMenu = isCtxMenu && ctxMenuStore.visible && (isEnter || isSpacebar || operArrow)
        const isEditStatus = isEnableConf(editingConfig) && actived.column && actived.row
        const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
        let params
        if (filterState.visible) {
          if (isEsc) {
            this.closeFilter()
          }
          return
        }
        if (operCtxMenu) {
          // If a context menu is configured; Support arrow key operation: eventListeners enter
          event.preventDefault()
          if (ctxMenuStore.showChild && hasChildrenList(ctxMenuStore.selected)) {
            this.moveCtxMenu(event, keyCode, ctxMenuStore, 'selectChild', 37, false, ctxMenuStore.selected.children)
          } else {
            this.moveCtxMenu(event, keyCode, ctxMenuStore, 'selected', 39, true, this.ctxMenuList)
          }
        } else if (keyboardConfig && mouseConfig && mouseoptions.area && this.handleKeyboardEvent) {
          this.handleKeyboardEvent(event)
        } else if (
          keyboardConfig &&
          isSpacebar &&
          keyboardoptions.isSelected &&
          selected.row &&
          selected.column &&
          (selected.column.type === 'checkbox' || selected.column.type === 'radio')
        ) {
          // The spacebar supports checking boxes
          event.preventDefault()
          if (selected.column.type === 'checkbox') {
            this.handleToggleCheckRowEvent(event, selected.args)
          } else {
            this.triggerRadioRowEvent(event, selected.args)
          }
        } else if (isF2 && isEnableConf(editingConfig)) {
          if (!isEditStatus) {
            // If the F2 key is pressed
            if (selected.row && selected.column) {
              event.stopPropagation()
              event.preventDefault()
              this.handleActived(selected.args, event)
            }
          }
        } else if (isContextMenu) {
          // If you press the context key
          this._keyCtx = selected.row && selected.column && bodyCtxMenu.length
          clearTimeout(this.keyCtxTimeout)
          this.keyCtxTimeout = setTimeout(() => {
            this._keyCtx = false
          }, 1000)
        } else if (
          isEnter &&
          !hasAltKey &&
          keyboardConfig &&
          keyboardoptions.isEnter &&
          (selected.row || actived.row || (treeConfig && (rowoptions.isCurrent || highlightCurrentRow) && currentRow))
        ) {
          // Exit the selection
          if (hasCtrlKey) {
            // If the edit state is active, the edit is canceled
            if (actived.row) {
              params = actived.args
              this.clearEdit(event)
              // If the selected function is configured, it is selected
              if (mouseConfig && mouseoptions.selected) {
                this.$nextTick(() => this.handleSelected(params, event))
              }
            }
          } else {
            // If it is active, the backway will go to the previous/next line
            if (selected.row || actived.row) {
              const targetArgs = selected.row ? selected.args : actived.args
              if (hasShiftKey) {
                if (keyboardoptions.enterToTab) {
                  this.moveTabSelected(targetArgs, hasShiftKey, event)
                } else {
                  this.moveSelected(targetArgs, isLeftArrow, true, isRightArrow, false, event)
                }
              } else {
                if (keyboardoptions.enterToTab) {
                  this.moveTabSelected(targetArgs, hasShiftKey, event)
                } else {
                  this.moveSelected(targetArgs, isLeftArrow, false, isRightArrow, true, event)
                }
              }
            } else if (treeConfig && (rowoptions.isCurrent || highlightCurrentRow) && currentRow) {
              // If it is a tree table, the current row return moves to the child node
              const childrens = currentRow[childrenAccessField]
              if (childrens && childrens.length) {
                event.preventDefault()
                const targetRow = childrens[0]
                params = { $tableContainer: this, row: targetRow }
                this.setTreeExpand(currentRow, true)
                  .then(() => this.scrollToRow(targetRow))
                  .then(() => this.triggerCurrentRowEvent(event, params))
              }
            }
          }
        } else if (operArrow && keyboardConfig && keyboardoptions.isArrow) {
          if (!isEditStatus) {
            // If the arrow keys are pressed
            if (selected.row && selected.column) {
              this.moveSelected(selected.args, isLeftArrow, isUpArrow, isRightArrow, isDwArrow, event)
            } else if ((isUpArrow || isDwArrow) && (rowoptions.isCurrent || highlightCurrentRow)) {
              // The current row button moves up and down
              this.moveCurrentRow(isUpArrow, isDwArrow, event)
            }
          }
        } else if (isTab && keyboardConfig && keyboardoptions.isTab) {
          // If you have pressed the Tab key to switch
          if (selected.row || selected.column) {
            this.moveTabSelected(selected.args, hasShiftKey, event)
          } else if (actived.row || actived.column) {
            this.moveTabSelected(actived.args, hasShiftKey, event)
          }
        } else if (
          keyboardConfig &&
          (isDel ||
            (treeConfig && (rowoptions.isCurrent || highlightCurrentRow) && currentRow
              ? isBack && keyboardoptions.isArrow
              : isBack))
        ) {
          if (!isEditStatus) {
            const { delMethod, backMethod } = keyboardOpts
            // If it is a delete key
            if (keyboardoptions.isDel && (selected.row || selected.column)) {
              if (delMethod) {
                delMethod({
                  row: selected.row,
                  rowIndex: this.getRowIndex(selected.row),
                  column: selected.column,
                  columnIndex: this.getColumnIndex(selected.column),
                  $tableContainer: this
                })
              } else {
                setCellValue(selected.row, selected.column, null)
              }
              if (isBack) {
                if (backMethod) {
                  backMethod({
                    row: selected.row,
                    rowIndex: this.getRowIndex(selected.row),
                    column: selected.column,
                    columnIndex: this.getColumnIndex(selected.column),
                    $tableContainer: this
                  })
                } else {
                  this.handleActived(selected.args, event)
                }
              } else if (isDel) {
                // If you press the del key, update the footer data
                this.updateFooterState()
              }
            } else if (
              isBack &&
              keyboardoptions.isArrow &&
              treeConfig &&
              (rowoptions.isCurrent || highlightCurrentRow) &&
              currentRow
            ) {
              // If the tree table fallback key closes the current row, the parent node is returned
              const { parent: parentRow } = lodash.findTree(this.afterfullRowsData, (item) => item === currentRow, {
                children: childrenAccessField
              })
              if (parentRow) {
                event.preventDefault()
                params = { $tableContainer: this, row: parentRow }
                this.setTreeExpand(parentRow, false)
                  .then(() => this.scrollToRow(parentRow))
                  .then(() => this.triggerCurrentRowEvent(event, params))
              }
            }
          }
        } else if (
          keyboardConfig &&
          keyboardoptions.isEdit &&
          !hasCtrlKey &&
          !hasMetaKey &&
          (isSpacebar ||
            (keyCode >= 48 && keyCode <= 57) ||
            (keyCode >= 65 && keyCode <= 90) ||
            (keyCode >= 96 && keyCode <= 111) ||
            (keyCode >= 186 && keyCode <= 192) ||
            (keyCode >= 219 && keyCode <= 222))
        ) {
          const { editMethod } = keyboardOpts
          // When editing is enabled, the spacebar function will be disabled
          // if (isSpacebar) {
          //   event.preventDefault()
          // }
          // If you press a non-function key, direct editing is allowed
          if (selected.column && selected.row && isEnableConf(selected.column.editingRender)) {
            const beforeEditMethod = editingOptions.beforeEditMethod || editingOptions.activeMethod
            if (!beforeEditMethod || beforeEditMethod({ ...selected.args, $tableContainer: this, $gridContainer: this.$rgrid })) {
              if (editMethod) {
                editMethod({
                  row: selected.row,
                  rowIndex: this.getRowIndex(selected.row),
                  column: selected.column,
                  columnIndex: this.getColumnIndex(selected.column),
                  $tableContainer: this,
                  $gridContainer: this.$rgrid
                })
              } else {
                setCellValue(selected.row, selected.column, null)
                this.handleActived(selected.args, event)
              }
              const afterEditMethod = editingOptions.afterEditMethod
              if (afterEditMethod) {
                this.$nextTick(() => {
                  afterEditMethod({
                    row: selected.row,
                    rowIndex: this.getRowIndex(selected.row),
                    column: selected.column,
                    columnIndex: this.getColumnIndex(selected.column),
                    $tableContainer: this,
                    $gridContainer: this.$rgrid
                  })
                })
              }
            }
          }
        }
        this.emitEvent('keydown', {}, event)
      })
    }
  },
  handleGlobalPasteEvent(event) {
    const { isActivated, keyboardConfig, keyboardOpts, mouseConfig, mouseOpts, editingStore, filterState } = this
    const { actived } = editingStore
    if (isActivated && !filterState.visible) {
      if (!(actived.row || actived.column)) {
        if (keyboardConfig && keyboardoptions.isClip && mouseConfig && mouseoptions.area && this.handlePasteCellAreaEvent) {
          this.handlePasteCellAreaEvent(event)
        }
      }
      this.emitEvent('paste', {}, event)
    }
  },
  handleGlobalCopyEvent(event) {
    const { isActivated, keyboardConfig, keyboardOpts, mouseConfig, mouseOpts, editingStore, filterState } = this
    const { actived } = editingStore
    if (isActivated && !filterState.visible) {
      if (!(actived.row || actived.column)) {
        if (keyboardConfig && keyboardoptions.isClip && mouseConfig && mouseoptions.area && this.handleCopyCellAreaEvent) {
          this.handleCopyCellAreaEvent(event)
        }
      }
      this.emitEvent('copy', {}, event)
    }
  },
  handleGlobalCutEvent(event) {
    const { isActivated, keyboardConfig, keyboardOpts, mouseConfig, mouseOpts, editingStore, filterState } = this
    const { actived } = editingStore
    if (isActivated && !filterState.visible) {
      if (!(actived.row || actived.column)) {
        if (keyboardConfig && keyboardoptions.isClip && mouseConfig && mouseoptions.area && this.handleCutCellAreaEvent) {
          this.handleCutCellAreaEvent(event)
        }
      }
      this.emitEvent('cut', {}, event)
    }
  },
  handleGlobalResizeEvent() {
    this.closeMenu()
    this.updateCellAreas()
    this.recalculate(true)
  },
  handleTargetEnterEvent(isClear) {
    const $tooltip = this.$refs.tooltip
    clearTimeout(this.tooltipTimeout)
    if (isClear) {
      this.closeTooltip()
    } else {
      if ($tooltip) {
        $tooltip.setActived(true)
      }
    }
  },
  handleTargetLeaveEvent() {
    const tooltipOptions = this.tooltipOptions
    let $tooltip = this.$refs.tooltip
    if ($tooltip) {
      $tooltip.setActived(false)
    }
    if (tooltipOptions.enterable) {
      this.tooltipTimeout = setTimeout(() => {
        $tooltip = this.$refs.tooltip
        if ($tooltip && !$tooltip.isActived()) {
          this.closeTooltip()
        }
      }, tooltipOptions.leaveDelay)
    } else {
      this.closeTooltip()
    }
  },
  triggerheaderColumnTitleEvent(event, iconParams, params) {
    const tipContent = iconParams.content || iconParams.message
    if (tipContent) {
      const { $refs, tooltipStore } = this
      const { column } = params
      const content = getFuncText(tipContent)
      this.handleTargetEnterEvent(true)
      tooltipStore.row = null
      tooltipStore.column = column
      tooltipStore.visible = true
      // tooltipStore.currOpts = { content: null }
      this.$nextTick(() => {
        const $tooltip = $refs.tooltip
        if ($tooltip) {
          $tooltip.open(event.currentTarget, content)
        }
      })
    }
  },
  /**
   * Triggers the header tooltip event
   */
  triggerHeaderTooltipEvent(event, params) {
    const { tooltipStore } = this
    const { column } = params
    const titleElem = event.currentTarget
    this.handleTargetEnterEvent(tooltipStore.column !== column || tooltipStore.row)
    if (tooltipStore.column !== column || !tooltipStore.visible) {
      this.handleTooltip(event, titleElem, titleElem, null, params)
    }
  },
  /**
   * Triggers the cell tooltip event
   */
  triggerBodyTooltipEvent(event, params) {
    const { editingConfig, editingOptions, editingStore, tooltipStore } = this
    const { actived } = editingStore
    const { row, column } = params
    const cell = event.currentTarget
    this.handleTargetEnterEvent(tooltipStore.column !== column || tooltipStore.row !== row)
    // The tooltip is not triggered when the cell is in the editing state
    if (column.editingRender && isEnableConf(editingConfig)) {
      // If it's a row edit mode
      if (editingOptions.mode === 'row' && actived.row === row) {
        return
      }
      // If it's a cell editing mode
      if (actived.row === row && actived.column === column) {
        return
      }
    }
    if (tooltipStore.column !== column || tooltipStore.row !== row || !tooltipStore.visible) {
      let overflowElem
      let tipElem
      if (column.treeNode) {
        overflowElem = cell.querySelector('.r-tree-cell')
        if (column.type === 'html') {
          tipElem = cell.querySelector('.r4m-table-cell--html')
        }
      } else {
        tipElem = cell.querySelector(column.type === 'html' ? '.r4m-table-cell--html' : '.r4m-table-cell--label')
      }
      this.handleTooltip(event, cell, overflowElem || cell.children[0], tipElem, params)
    }
  },
  /**
   * Triggers the footer tooltip event
   */
  triggerFooterTooltipEvent(event, params) {
    const { column } = params
    const { tooltipStore } = this
    const cell = event.currentTarget
    this.handleTargetEnterEvent(true)
    if (tooltipStore.column !== column || !tooltipStore.visible) {
      this.handleTooltip(event, cell, cell.querySelector('.r4m-table-cell--item') || cell.children[0], null, params)
    }
  },
  /**
   * Process display tooltip
   * @param {Event} event Event
   * @param {ColumnInfo} column column data
   * @param {Row} row row data
   */
  handleTooltip(event, cell, overflowElem, tipElem, params) {
    params.cell = cell
    const { $refs, tooltipOptions, tooltipStore } = this
    const { column, row } = params
    const { showAll, enabled, contentMethod } = tooltipOptions
    const customContent = contentMethod ? contentMethod(params) : null
    const useCustom = contentMethod && !lodash.eqNull(customContent)
    const content = useCustom
      ? customContent
      : (column.type === 'html' ? overflowElem.innerText : overflowElem.textContent).trim()
    const isCellOverflow = overflowElem.scrollWidth > overflowElem.clientWidth
    if (content && (showAll || enabled || useCustom || isCellOverflow)) {
      Object.assign(tooltipStore, {
        row,
        column,
        visible: true
      })
      this.$nextTick(() => {
        const $tooltip = $refs.tooltip
        if ($tooltip) {
          $tooltip.open(isCellOverflow ? overflowElem : tipElem || overflowElem, Utils.format(content))
        }
      })
    }
    return this.$nextTick()
  },
  openTooltip(target, content) {
    const { $refs } = this
    const commTip = $refs.commTip
    if (commTip) {
      return commTip.open(target, content)
    }
    return this.$nextTick()
  },
  /**
   * Close the tooltip
   */
  closeTooltip() {
    const { $refs, tooltipStore } = this
    const tooltip = $refs.tooltip
    const commTip = $refs.commTip
    if (tooltipStore.visible) {
      Object.assign(tooltipStore, {
        row: null,
        column: null,
        content: null,
        visible: false
      })
      if (tooltip) {
        tooltip.close()
      }
    }
    if (commTip) {
      commTip.close()
    }
    return this.$nextTick()
  },
  /**
   * Determine whether the column header check box is selected
   */
  isAllCheckboxselected() {
    return this.isAllSelected
  },
  /**
   * Determines whether the column header checkbox is half-selected
   */
  isAllCheckboxIndeterminate() {
    return !this.isAllSelected && this.isIndeterminate
  },
  isCheckboxIndeterminate() {
    warnLog('rtable.error.delFunc', ['isCheckboxIndeterminate', 'isAllCheckboxIndeterminate'])
    return this.isAllCheckboxIndeterminate()
  },
  /**
   * Get the row data for the checkbox half-selected state
   */
  getCheckboxIndeterminateRecords(isFull) {
    const { treeConfig, treeIndeterminateMaps, fullRowsDatarowIdData } = this
    if (treeConfig) {
      const fullRest = []
      const defRest = []
      lodash.each(treeIndeterminateMaps, (item, rowId) => {
        if (item) {
          fullRest.push(item)
          if (fullRowsDatarowIdData[rowId]) {
            defRest.push(item)
          }
        }
      })
      if (isFull) {
        return fullRest
      }
      return defRest
    }
    return []
  },
  /**
   * Handles the default check
   */
  handleDefaultSelectionselected() {
    const { fullRowsDatarowIdData, selectionOptions } = this
    const { checkAll, checkRowKeys } = selectionOptions
    if (checkAll) {
      this.handleselectedAllCheckboxRow(true, true)
    } else if (checkRowKeys) {
      const defSelectieventListeners = []
      checkRowKeys.forEach((rowId) => {
        if (fullRowsDatarowIdData[rowId]) {
          defSelection.push(fullRowsDatarowIdData[rowId].row)
        }
      })
      this.handleselectedRow(defSelection: eventListeners true, true)
    }
  },
  handleselectedRow(rows, value, isForce) {
    if (rows && !lodash.isArray(rows)) {
      rows = [rows]
    }
    rows.forEach((row) => this.handleSelectRow({ row }, !!value, isForce))
    return this.$nextTick()
  },
  /**
   * It is used to select rows and set the behavior selection state, and the second parameter is selected or not
   * @param {Array/Row} rows Row data
   * @param {Boolean} value Whether or not to check
   */
  setCheckboxRow(rows, value) {
    return this.handleselectedRow(rows, value, true)
  },
  isSelectedByCheckboxRow(row) {
    const { selectCheckboxMaps } = this
    const { checkField } = this.selectionOptions
    if (checkField) {
      return lodash.get(row, checkField)
    }
    return !!selectCheckboxMaps[getRowId(this, row)]
  },
  isIndeterminateByCheckboxRow(row) {
    const { treeIndeterminateMaps } = this
    return !!treeIndeterminateMaps[getRowId(this, row)] && !this.isSelectedByCheckboxRow(row)
  },
  /**
   * Multi-select, row selected events
   * value selected is true
   */
  handleSelectRow({ row }, value, isForce) {
    const { selectCheckboxMaps, afterfullRowsData, treeConfig, treeOptions, treeIndeterminateMaps, selectionOptions } = this
    const { checkField, checkStrictly, selectionMethod } = selectionOptions
    const selectRowMaps = { ...selectCheckboxMaps }
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const indeterminateField = selectionOptions.indeterminateField || selectionOptions.halfField
    const rowId = getRowId(this, row)
    if (checkField) {
      if (treeConfig && !checkStrictly) {
        if (value === -1) {
          if (!treeIndeterminateMaps[rowId]) {
            if (indeterminateField) {
              lodash.set(row, indeterminateField, true)
            }
            treeIndeterminateMaps[rowId] = row
          }
          lodash.set(row, checkField, false)
        } else {
          // Update the status of the child node
          lodash.eachTree(
            [row],
            (item) => {
              if (this.eqRow(item, row) || isForce || !selectionMethod || selectionMethod({ row: item })) {
                lodash.set(item, checkField, value)
                if (indeterminateField) {
                  lodash.set(row, indeterminateField, false)
                }
                delete treeIndeterminateMaps[getRowId(this, item)]
                this.handleCheckboxReserveRow(row, value)
              }
            },
            { children: childrenAccessField }
          )
        }
        // If a parent node exists, update the parent node state
        const matchObj = lodash.findTree(afterfullRowsData, (item) => this.eqRow(item, row), { children: childrenAccessField })
        if (matchObj && matchObj.parent) {
          let parentStatus
          const vItems = []
          const vItemMaps = {}
          if (!isForce && selectionMethod) {
            matchObj.items.forEach((item) => {
              if (selectionMethod({ row: item })) {
                const itemRid = getRowId(this, item)
                vItemMaps[itemRid] = item
                vItems.push(item)
              }
            })
          } else {
            matchObj.items.forEach((item) => {
              const itemRid = getRowId(this, item)
              vItemMaps[itemRid] = item
              vItems.push(item)
            })
          }
          const indeterminatesItem = lodash.find(
            matchObj.items,
            (item) => !!treeIndeterminateMaps[getRowId(this, item)]
          )
          if (indeterminatesItem) {
            parentStatus = -1
          } else {
            const selectItems = []
            matchObj.items.forEach((item) => {
              if (lodash.get(item, checkField)) {
                selectItems.push(item)
              }
            })
            parentStatus =
              selectItems.filter((item) => vItemMaps[getRowId(this, item)]).length === vItems.length
                ? true
                : selectItems.length || value === -1
                  ? -1
                  : false
          }
          this.selectCheckboxMaps = selectRowMaps
          return this.handleSelectRow({ row: matchObj.parent }, parentStatus, isForce)
        }
      } else {
        if (isForce || !selectionMethod || selectionMethod({ row })) {
          lodash.set(row, checkField, value)
          this.handleCheckboxReserveRow(row, value)
        }
      }
    } else {
      if (treeConfig && !checkStrictly) {
        if (value === -1) {
          if (!treeIndeterminateMaps[rowId]) {
            if (indeterminateField) {
              lodash.set(row, indeterminateField, true)
            }
            treeIndeterminateMaps[rowId] = row
          }
          if (selectRowMaps[rowId]) {
            delete selectRowMaps[rowId]
          }
        } else {
          // Update the status of the child node
          lodash.eachTree(
            [row],
            (item) => {
              const itemRid = getRowId(this, item)
              if (this.eqRow(item, row) || isForce || !selectionMethod || selectionMethod({ row: item })) {
                if (value) {
                  selectRowMaps[itemRid] = item
                } else {
                  if (selectRowMaps[itemRid]) {
                    delete selectRowMaps[itemRid]
                  }
                }
                if (indeterminateField) {
                  lodash.set(row, indeterminateField, false)
                }
                delete treeIndeterminateMaps[getRowId(this, item)]
                this.handleCheckboxReserveRow(row, value)
              }
            },
            { children: childrenAccessField }
          )
        }
        // If a parent node exists, update the parent node state
        const matchObj = lodash.findTree(afterfullRowsData, (item) => this.eqRow(item, row), { children: childrenAccessField })
        if (matchObj && matchObj.parent) {
          let parentStatus
          const vItems = []
          const vItemMaps = {}
          if (!isForce && selectionMethod) {
            matchObj.items.forEach((item) => {
              if (selectionMethod({ row: item })) {
                const itemRid = getRowId(this, item)
                vItemMaps[itemRid] = item
                vItems.push(item)
              }
            })
          } else {
            matchObj.items.forEach((item) => {
              const itemRid = getRowId(this, item)
              vItemMaps[itemRid] = item
              vItems.push(item)
            })
          }
          const indeterminatesItem = lodash.find(
            matchObj.items,
            (item) => !!treeIndeterminateMaps[getRowId(this, item)]
          )
          if (indeterminatesItem) {
            parentStatus = -1
          } else {
            const selectItems = []
            matchObj.items.forEach((item) => {
              const itemRid = getRowId(this, item)
              if (selectRowMaps[itemRid]) {
                selectItems.push(item)
              }
            })
            parentStatus =
              selectItems.filter((item) => vItemMaps[getRowId(this, item)]).length === vItems.length
                ? true
                : selectItems.length || value === -1
                  ? -1
                  : false
          }
          this.selectCheckboxMaps = selectRowMaps
          return this.handleSelectRow({ row: matchObj.parent }, parentStatus, isForce)
        }
      } else {
        if (isForce || !selectionMethod || selectionMethod({ row })) {
          if (value) {
            if (!selectRowMaps[rowId]) {
              selectRowMaps[rowId] = row
            }
          } else {
            if (selectRowMaps[rowId]) {
              delete selectRowMaps[rowId]
            }
          }
          this.handleCheckboxReserveRow(row, value)
        }
      }
    }
    this.selectCheckboxMaps = selectRowMaps
    this.checkSelectionStatus()
  },
  handleToggleCheckRowEvent(event, params) {
    const { selectCheckboxMaps, selectionOptions } = this
    const { checkField } = selectionOptions
    const { row } = params
    let value = false
    if (checkField) {
      value = !lodash.get(row, checkField)
    } else {
      value = !selectCheckboxMaps[getRowId(this, row)]
    }
    if (event) {
      this.triggerCheckRowEvent(event, params, value)
    } else {
      this.handleSelectRow(params, value)
    }
  },
  triggerCheckRowEvent(event, params, value) {
    const { selectionOptions, afterfullRowsData } = this
    const { selectionMethod } = selectionOptions
    const { row } = params
    if (selectionOptions.isShiftKey && event.shiftKey && !this.treeConfig) {
      const checkboxRecords = this.getCheckboxRecords()
      if (checkboxRecords.length) {
        const firstRow = checkboxRecords[0]
        const _rowIndex = this.getVTRowIndex(row)
        const _firstRowIndex = this.getVTRowIndex(firstRow)
        if (_rowIndex !== _firstRowIndex) {
          this.setAllCheckboxRow(false)
          const rangeRows =
            _rowIndex < _firstRowIndex
              ? afterfullRowsData.slice(_rowIndex, _firstRowIndex + 1)
              : afterfullRowsData.slice(_firstRowIndex, _rowIndex + 1)
          this.handleselectedRow(rangeRows, true, false)
          this.emitEvent('checkbox-range-select', Object.assign({ rangeRecords: rangeRows }, params), event)
          return
        }
      }
    }
    if (!selectionMethod || selectionMethod({ row })) {
      this.handleSelectRow(params, value)
      this.emitEvent(
        'checkbox-change',
        Object.assign(
          {
            records: this.getCheckboxRecords(),
            reserves: this.getCheckboxReserveRecords(),
            indeterminates: this.getCheckboxIndeterminateRecords(),
            selected: value
          },
          params
        ),
        event
      )
    }
  },
  /**
   * Multi-select to toggle the selected status of a row
   */
  toggleCheckboxRow(row) {
    const { selectCheckboxMaps, selectionOptions } = this
    const { checkField } = selectionOptions
    const value = checkField ? !lodash.get(row, checkField) : !selectCheckboxMaps[getRowId(this, row)]
    this.handleSelectRow({ row }, value, true)
    return this.$nextTick()
  },
  handleselectedAllCheckboxRow(value, isForce) {
    const {
      afterfullRowsData,
      treeConfig,
      treeOptions,
      selectCheckboxMaps,
      checkboxReserveRowMap,
      selectionOptions,
      afterFullRowMaps
    } = this
    const { checkField, reserve, checkStrictly, selectionMethod } = selectionOptions
    const indeterminateField = selectionOptions.indeterminateField || selectionOptions.halfField
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const selectRowMaps = {}

    // TODO: Check later
    if (!treeConfig) {
      lodash.each(selectCheckboxMaps, (row, rowId) => {
        if (!afterFullRowMaps[rowId]) {
          selectRowMaps[rowId] = row
        }
      })
    }
    // TODO: to think about better implementation
    if (checkStrictly) {
      this.isAllSelected = value
    } else {
      /**
       * Binding Attribute Method (High Performance, Polluted)
       * The corresponding attribute must be present in the row data, otherwise it will not respond
       */
      if (checkField) {
        const checkValFn = (row) => {
          if (isForce || !selectionMethod || selectionMethod({ row })) {
            if (value) {
              selectRowMaps[getRowId(this, row)] = row
            }
            lodash.set(row, checkField, value)
          }
          if (treeConfig && indeterminateField) {
            lodash.set(row, indeterminateField, false)
          }
        }
        // If there is a selected method
        // If the method holds, the value is updated, otherwise the data is ignored
        if (treeConfig) {
          lodash.eachTree(afterfullRowsData, checkValFn, { children: childrenAccessField })
        } else {
          afterfullRowsData.forEach(checkValFn)
        }
      } else {
        /**
         * Default mode (low performance, no pollution)）
         * No properties are required, and they are directly bound
         */
        if (treeConfig) {
          if (value) {
            /**
             * If it's a tree, check it
             * If the method holds, it is added to the temporary collection
             */
            lodash.eachTree(
              afterfullRowsData,
              (row) => {
                if (isForce || !selectionMethod || selectionMethod({ row })) {
                  selectRowMaps[getRowId(this, row)] = row
                }
              },
              { children: childrenAccessField }
            )
          } else {
            /**
             * If it's a tree canceled
             * If the method holds, it is not added to the temporary collection
             */
            if (!isForce && selectionMethod) {
              lodash.eachTree(
                afterfullRowsData,
                (row) => {
                  const rowId = getRowId(this, row)
                  if (selectionMethod({ row }) ? 0 : selectCheckboxMaps[rowId]) {
                    selectRowMaps[rowId] = row
                  }
                },
                { children: childrenAccessField }
              )
            }
          }
        } else {
          if (value) {
            /**
             * If it is a row check
             * If there is a selected method and it is true, or if it is selected, it is added to the temporary collection
             * If no method is selected, all data is added to the temporary collection
             */
            if (!isForce && selectionMethod) {
              afterfullRowsData.forEach((row) => {
                const rowId = getRowId(this, row)
                if (selectCheckboxMaps[rowId] || selectionMethod({ row })) {
                  selectRowMaps[rowId] = row
                }
              })
            } else {
              afterfullRowsData.forEach((row) => {
                selectRowMaps[getRowId(this, row)] = row
              })
            }
          } else {
            /**
             * If it is a row cancellation
             * If the method holds, it is not added to the temporary collection; If the method is not valid, check whether it is currently selected, and if it is selected, add it to the new collection
             * If no method is selected, no processing is required, and the temporary collection defaults to empty
             */
            if (!isForce && selectionMethod) {
              afterfullRowsData.forEach((row) => {
                const rowId = getRowId(this, row)
                if (selectionMethod({ row }) ? 0 : selectCheckboxMaps[rowId]) {
                  selectRowMaps[rowId] = row
                }
              })
            }
          }
        }
      }
      if (reserve) {
        if (value) {
          lodash.each(selectRowMaps, (row, rowId) => {
            checkboxReserveRowMap[rowId] = row
          })
        } else {
          afterfullRowsData.forEach((row) => this.handleCheckboxReserveRow(row, false))
        }
      }
      this.selectCheckboxMaps = checkField ? {} : selectRowMaps
    }
    this.treeIndeterminateMaps = {}
    this.treeIndeterminateRowMaps = {}
    this.checkSelectionStatus()
    return this.$nextTick()
  },
  /**
   * Used to select multiple rows, and sets the selected status of all rows
   * @param {Boolean} value Whether or not to check
   */
  setAllCheckboxRow(value) {
    return this.handleselectedAllCheckboxRow(value, true)
  },
  checkSelectionStatus() {
    const { afterfullRowsData, selectCheckboxMaps, treeIndeterminateMaps, selectionOptions, treeConfig } = this
    const { checkField, checkStrictly, selectionMethod } = selectionOptions
    const indeterminateField = selectionOptions.indeterminateField || selectionOptions.halfField
    if (!checkStrictly) {
      const disableRows = []
      const checkRows = []
      let isAllResolve = false
      let isAllSelected = false
      let isIndeterminate = false
      if (checkField) {
        // prettier-ignore
        isAllResolve = afterfullRowsData.every(
          selectionMethod
            ? (row) => {
              if (!selectionMethod({ row })) {
                disableRows.push(row)
                return true
              }
              if (lodash.get(row, checkField)) {
                checkRows.push(row)
                return true
              }
              return false
            }
            : (row) => lodash.get(row, checkField)
        )
        isAllSelected = isAllResolve && afterfullRowsData.length !== disableRows.length
        if (treeConfig) {
          if (indeterminateField) {
            isIndeterminate =
              !isAllSelected &&
              afterfullRowsData.some(
                (row) =>
                  lodash.get(row, checkField) ||
                  lodash.get(row, indeterminateField) ||
                  !!treeIndeterminateMaps[getRowId(this, row)]
              )
          } else {
            isIndeterminate =
              !isAllSelected &&
              afterfullRowsData.some((row) => lodash.get(row, checkField) || !!treeIndeterminateMaps[getRowId(this, row)])
          }
        } else {
          if (indeterminateField) {
            isIndeterminate =
              !isAllSelected &&
              afterfullRowsData.some((row) => lodash.get(row, checkField) || lodash.get(row, indeterminateField))
          } else {
            isIndeterminate = !isAllSelected && afterfullRowsData.some((row) => lodash.get(row, checkField))
          }
        }
      } else {
        // prettier-ignore
        isAllResolve = afterfullRowsData.every(
          selectionMethod
            ? (row) => {
              if (!selectionMethod({ row })) {
                disableRows.push(row)
                return true
              }
              if (selectCheckboxMaps[getRowId(this, row)]) {
                checkRows.push(row)
                return true
              }
              return false
            }
            : (row) => selectCheckboxMaps[getRowId(this, row)]
        )
        isAllSelected = isAllResolve && afterfullRowsData.length !== disableRows.length
        if (treeConfig) {
          isIndeterminate =
            !isAllSelected &&
            afterfullRowsData.some((row) => {
              const itemRid = getRowId(this, row)
              return treeIndeterminateMaps[itemRid] || selectCheckboxMaps[itemRid]
            })
        } else {
          isIndeterminate = !isAllSelected && afterfullRowsData.some((row) => selectCheckboxMaps[getRowId(this, row)])
        }
      }
      this.isAllSelected = isAllSelected
      this.isIndeterminate = isIndeterminate
    }
  },
  // Restore the status of expansion: eventListeners selection: eventListeners and so on
  handleReserveStatus() {
    const {
      expandColumn,
      treeOptions,
      treeConfig,
      fullRowsDatarowIdData,
      fullAllDataRowMap,
      currentRow,
      selectRadioRow,
      radioReserveRow,
      radioOpts,
      selectionOptions,
      selectCheckboxMaps,
      rowExpandedMaps,
      treeExpandedMap,
      expandOpts
    } = this
    // Radio box
    if (selectRadioRow && !fullAllDataRowMap.has(selectRadioRow)) {
      this.selectRadioRow = null // Refresh the radio row status
    }
    // Restore retains the selected state
    if (radiooptions.reserve && radioReserveRow) {
      const rowId = getRowId(this, radioReserveRow)
      if (fullRowsDatarowIdData[rowId]) {
        this.handleselectedRadioRow(fullRowsDatarowIdData[rowId].row, true)
      }
    }
    // Checkbox
    this.selectCheckboxMaps = getRecoverRowMaps(this, selectCheckboxMaps) // Refresh the multi-select row status
    // Restore retains the selected state
    if (selectionOptions.reserve) {
      this.handleselectedRow(handleReserveRow(this, this.checkboxReserveRowMap), true, true)
    }
    if (currentRow && !fullAllDataRowMap.has(currentRow)) {
      this.currentRow = null // Refreshes the current row state
    }
    // The row expands
    this.rowExpandedMaps = expandColumn ? getRecoverRowMaps(this, rowExpandedMaps) : [] // Refreshes the row expansion state
    // Restore the retention state
    if (expandColumn && expandoptions.reserve) {
      this.setRowExpand(handleReserveRow(this, this.rowExpandedReserveRowMap), true)
    }
    // The tree unfolds
    this.treeExpandedMap = treeConfig ? getRecoverRowMaps(this, treeExpandedMap) : [] // Refreshes the tree expansion state
    if (treeConfig && treeOptions.reserve) {
      this.setTreeExpand(handleReserveRow(this, this.treeExpandedReserveRowMap), true)
    }
  },
  /**
   * The Get radio box retains the selected rows
   */
  getRadioReserveRecord(isFull) {
    const { fullRowsDatarowIdData, radioReserveRow, radioOpts, afterfullRowsData, treeConfig, treeOptions } = this
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    if (radiooptions.reserve && radioReserveRow) {
      const rowId = getRowId(this, radioReserveRow)
      if (isFull) {
        if (!fullRowsDatarowIdData[rowId]) {
          return radioReserveRow
        }
      } else {
        const rowkey = getRowkey(this)
        if (treeConfig) {
          const matchObj = lodash.findTree(afterfullRowsData, (row) => rowId === lodash.get(row, rowkey), {
            children: childrenAccessField
          })
          if (matchObj) {
            return radioReserveRow
          }
        } else {
          if (!afterfullRowsData.some((row) => rowId === lodash.get(row, rowkey))) {
            return radioReserveRow
          }
        }
      }
    }
    return null
  },
  clearRadioReserve() {
    this.radioReserveRow = null
    return this.$nextTick()
  },
  handleRadioReserveRow(row) {
    const { radioOpts } = this
    if (radiooptions.reserve) {
      this.radioReserveRow = row
    }
  },
  /**
   * The Get checkbox keeps the selected rows
   */
  getCheckboxReserveRecords(isFull) {
    const { fullRowsDatarowIdData, afterfullRowsData, checkboxReserveRowMap, selectionOptions, treeConfig, treeOptions } = this
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const reserveSelectieventListeners = []
    if (selectionOptions.reserve) {
      const afterFullIdMaps = {}
      if (treeConfig) {
        lodash.eachTree(
          afterfullRowsData,
          (row) => {
            afterFullIdMaps[getRowId(this, row)] = 1
          },
          { children: childrenAccessField }
        )
      } else {
        afterfullRowsData.forEach((row) => {
          afterFullIdMaps[getRowId(this, row)] = 1
        })
      }
      lodash.each(checkboxReserveRowMap, (oldRow, oldrowId) => {
        if (oldRow) {
          if (isFull) {
            if (!fullRowsDatarowIdData[oldrowId]) {
              reserveSelection.push(oldRow)
            }
          } else {
            if (!afterFullIdMaps[oldrowId]) {
              reserveSelection.push(oldRow)
            }
          }
        }
      })
    }
    return reserveSelection
  },
  clearCheckboxReserve() {
    this.checkboxReserveRowMap = {}
    return this.$nextTick()
  },
  handleCheckboxReserveRow(row, selected) {
    const { checkboxReserveRowMap, selectionOptions } = this
    if (selectionOptions.reserve) {
      const rowId = getRowId(this, row)
      if (selected) {
        checkboxReserveRowMap[rowId] = row
      } else if (checkboxReserveRowMap[rowId]) {
        delete checkboxReserveRowMap[rowId]
      }
    }
  },
  /**
   * Multi-select to select all events
   */
  triggerCheckAllEvent(event, value) {
    this.handleselectedAllCheckboxRow(value)
    this.emitEvent(
      'checkbox-all',
      {
        records: this.getCheckboxRecords(),
        reserves: this.getCheckboxReserveRecords(),
        indeterminates: this.getCheckboxIndeterminateRecords(),
        selected: value
      },
      event
    )
  },
  /**
   * Multi-select to toggle the selected status of all rows
   */
  toggleAllCheckboxRow() {
    this.triggerCheckAllEvent(null, !this.isAllSelected)
    return this.$nextTick()
  },
  /**
   * Used to select rows for multiple selections, manually clearing the user's selection
   * Regardless of whether the purge behavior is disabled or retained, the selected state is completely emptied
   */
  clearCheckboxRow() {
    const { tableFullRowsData, treeConfig, treeOptions, selectionOptions } = this
    const { checkField, reserve } = selectionOptions
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const indeterminateField = selectionOptions.indeterminateField || selectionOptions.halfField
    if (checkField) {
      const handleClearselected = (item) => {
        if (treeConfig && indeterminateField) {
          lodash.set(item, indeterminateField, false)
        }
        lodash.set(item, checkField, false)
      }
      if (treeConfig) {
        lodash.eachTree(tableFullRowsData, handleClearselected, { children: childrenAccessField })
      } else {
        tableFullRowsData.forEach(handleClearselected)
      }
    }
    if (reserve) {
      tableFullRowsData.forEach((row) => this.handleCheckboxReserveRow(row, false))
    }
    this.isAllSelected = false
    this.isIndeterminate = false
    this.selectCheckboxMaps = {}
    this.treeIndeterminateMaps = {}
    return this.$nextTick()
  },
  /**
   * The Process radio box is selected by default
   */
  handleDefaultRadioselected() {
    const { radioOpts, fullRowsDatarowIdData } = this
    const { checkRowKey: rowId, reserve } = radioOpts
    if (rowId) {
      if (fullRowsDatarowIdData[rowId]) {
        this.handleselectedRadioRow(fullRowsDatarowIdData[rowId].row, true)
      }
      if (reserve) {
        const rowkey = getRowkey(this)
        this.radioReserveRow = { [rowkey]: rowId }
      }
    }
  },
  /**
   * Single-select, row selected event
   */
  triggerRadioRowEvent(event, params) {
    const { selectRadioRow: oldValue, radioOpts } = this
    const { row } = params
    let newValue = row
    let isChange = oldValue !== newValue
    if (isChange) {
      this.handleselectedRadioRow(newValue)
    } else if (!radiooptions.strict) {
      isChange = oldValue === newValue
      if (isChange) {
        newValue = null
        this.clearRadioRow()
      }
    }
    if (isChange) {
      this.emitEvent('radio-change', { oldValue, newValue, ...params }, event)
    }
  },
  triggerCurrentRowEvent(event, params) {
    const { currentRow: oldValue } = this
    const { row: newValue } = params
    const isChange = oldValue !== newValue
    this.setCurrentRow(newValue)
    if (isChange) {
      this.emitEvent('current-change', { oldValue, newValue, ...params }, event)
    }
  },
  /**
   * Used for the current row, set a behavior to be highlighted
   * @param {Row} row row object
   */
  setCurrentRow(row) {
    const { $el, rowOpts } = this
    this.clearCurrentRow()
    // this.clearCurrentColumn()
    this.currentRow = row
    if (rowoptions.isCurrent || this.highlightCurrentRow) {
      if ($el) {
        lodash.arrayEach($el.querySelectorAll(`[rowId="${getRowId(this, row)}"]`), (elem) =>
          addClass(elem, 'row--current')
        )
      }
    }
    return this.$nextTick()
  },
  isSelectedByRadioRow(row) {
    return this.selectRadioRow === row
  },
  handleselectedRadioRow(row, isForce) {
    const { radioOpts } = this
    const { selectionMethod } = radioOpts
    if (row && (isForce || !selectionMethod || selectionMethod({ row }))) {
      this.selectRadioRow = row
      this.handleRadioReserveRow(row)
    }
    return this.$nextTick()
  },
  /**
   * Used for radio rows, set the selection status of a certain line
   * @param {Row} row row object
   */
  setRadioRow(row) {
    return this.handleselectedRadioRow(row, true)
  },
  /**
   * Used for the current row, manually clears the current highlighted state
   */
  clearCurrentRow() {
    const { $el } = this
    this.currentRow = null
    this.hoverRow = null
    if ($el) {
      lodash.arrayEach($el.querySelectorAll('.row--current'), (elem) => removeClass(elem, 'row--current'))
    }
    return this.$nextTick()
  },
  /**
   * Used to select rows to manually clear the user's selection
   */
  clearRadioRow() {
    this.selectRadioRow = null
    return this.$nextTick()
  },
  /**
   * Used for the current row, get the data of the current row
   */
  getCurrentRecord() {
    return this.rowoptions.isCurrent || this.highlightCurrentRow ? this.currentRow : null
  },
  /**
   * Used for radio rows to get the data when selected
   */
  getRadioRecord(isFull) {
    const { selectRadioRow, fullRowsDatarowIdData, afterFullRowMaps } = this
    if (selectRadioRow) {
      const rowId = getRowId(this, selectRadioRow)
      if (isFull) {
        if (fullRowsDatarowIdData[rowId]) {
          return selectRadioRow
        }
      } else {
        if (afterFullRowMaps[rowId]) {
          return selectRadioRow
        }
      }
    }
    return null
  },
  /**
   * row hover event
   */
  triggerHoverEvent(event, { row }) {
    this.setHoverRow(row)
  },
  setHoverRow(row) {
    const { $el } = this
    const rowId = getRowId(this, row)
    this.clearHoverRow()
    if ($el) {
      lodash.arrayEach($el.querySelectorAll(`[rowId="${rowId}"]`), (elem) => addClass(elem, 'row--hover'))
    }
    this.hoverRow = row
  },
  clearHoverRow() {
    const { $el } = this
    if ($el) {
      lodash.arrayEach($el.querySelectorAll('.r4m-table-body--row.row--hover'), (elem) =>
        removeClass(elem, 'row--hover')
      )
    }
    this.hoverRow = null
  },
  triggerHeaderCellClickEvent(event, params) {
    const { _lastResizeTime, sortOpts } = this
    const { column } = params
    const cell = event.currentTarget
    const triggerResizable = _lastResizeTime && _lastResizeTime > Date.now() - 300
    const triggerSort = getEventTargetNode(event, cell, 'r4m-table-cell--sort').flag
    const triggerFilter = getEventTargetNode(event, cell, 'r4m-table-cell--filter').flag
    if (sortoptions.trigger === 'cell' && !(triggerResizable || triggerSort || triggerFilter)) {
      this.triggerSortEvent(event, column, getNextSortOrder(this, column))
    }
    this.emitEvent(
      'header-cell-click',
      Object.assign({ triggerResizable, triggerSort, triggerFilter, cell }, params),
      event
    )
    if (this.columnOptions.isCurrent || this.highlightCurrentColumn) {
      return this.setCurrentColumn(column)
    }
    return this.$nextTick()
  },
  triggerHeaderCellDblclickEvent(event, params) {
    this.emitEvent('header-cell-dblclick', Object.assign({ cell: event.currentTarget }, params), event)
  },
  getCurrentColumn() {
    return this.columnOptions.isCurrent || this.highlightCurrentColumn ? this.currentColumn : null
  },
  /**
   * Used for the current column, set the behavior of a column to be highlighted
   * @param {ColumnInfo} fieldOrColumn Column configuration
   */
  setCurrentColumn(fieldOrColumn) {
    const column = handleFieldOrColumn(this, fieldOrColumn)
    if (column) {
      // this.clearCurrentRow()
      this.clearCurrentColumn()
      this.currentColumn = column
    }
    return this.$nextTick()
  },
  /**
   * Used for the current column, manually clear the current highlighted state
   */
  clearCurrentColumn() {
    this.currentColumn = null
    return this.$nextTick()
  },
  checkValidate(type) {
    if (RTable._valid) {
      return this.triggerValidate(type)
    }
    return this.$nextTick()
  },
  /**
   * When a cell changes
   * If a rule exists, it is selected
   */
  handleChangeCell(event, params) {
    this.checkValidate('blur')
      .catch((e) => e)
      .then(() => {
        this.handleActived(params, event)
          .then(() => this.checkValidate('change'))
          .catch((e) => e)
      })
  },
  /**
   * column click event
   * If it is a click mode, it is activated to edit state
   * If it is a double-click mode, click it to select the state
   */
  triggerCellClickEvent(event, params) {
    const {
      highlightCurrentRow,
      editingStore,
      radioOpts,
      expandOpts,
      treeOptions,
      editingConfig,
      editingOptions,
      selectionOptions,
      rowOpts
    } = this
    const { actived } = editingStore
    const { row, column } = params
    const { type, treeNode } = column
    const isRadioType = type === 'radio'
    const isCheckboxType = type === 'checkbox'
    const isExpandType = type === 'expand'
    const cell = event.currentTarget
    const triggerRadio = isRadioType && getEventTargetNode(event, cell, 'r4m-table-cell--radio').flag
    const triggerCheckbox = isCheckboxType && getEventTargetNode(event, cell, 'r4m-table-cell--checkbox').flag
    const triggerTreeNode = treeNode && getEventTargetNode(event, cell, 'r-table-tree--btn-wrapper').flag
    const triggerExpandNode = isExpandType && getEventTargetNode(event, cell, 'r4m-table--expanded').flag
    params = Object.assign({ cell, triggerRadio, triggerCheckbox, triggerTreeNode, triggerExpandNode }, params)
    if (!triggerCheckbox && !triggerRadio) {
      // If it's an expanded row
      if (!triggerExpandNode && (expandoptions.trigger === 'row' || (isExpandType && expandoptions.trigger === 'cell'))) {
        this.triggerRowExpandEvent(event, params)
      }
      // If it's a tree table
      if (treeOptions.trigger === 'row' || (treeNode && treeOptions.trigger === 'cell')) {
        this.triggerTreeExpandedEvent(event, params)
      }
    }
    // If you clicked on the tree node
    if (!triggerTreeNode) {
      if (!triggerExpandNode) {
        // If it's a highlighted row
        if (rowoptions.isCurrent || highlightCurrentRow) {
          if (!triggerCheckbox && !triggerRadio) {
            this.triggerCurrentRowEvent(event, params)
          }
        }
        // If it's a radio box
        if (!triggerRadio && (radiooptions.trigger === 'row' || (isRadioType && radiooptions.trigger === 'cell'))) {
          this.triggerRadioRowEvent(event, params)
        }
        // If it's a checkbox
        if (
          !triggerCheckbox &&
          (selectionOptions.trigger === 'row' || (isCheckboxType && selectionOptions.trigger === 'cell'))
        ) {
          this.handleToggleCheckRowEvent(event, params)
        }
      }
      // If the cell selection function is set, the click event will not be used to handle it (only double-click mode can be supported)
      if (isEnableConf(editingConfig)) {
        if (editingOptions.trigger === 'manual') {
          if (actived.args && actived.row === row && column !== actived.column) {
            this.handleChangeCell(event, params)
          }
        } else if (!actived.args || row !== actived.row || column !== actived.column) {
          if (editingOptions.trigger === 'click') {
            this.handleChangeCell(event, params)
          } else if (editingOptions.trigger === 'dblclick') {
            if (editingOptions.mode === 'row' && actived.row === row) {
              this.handleChangeCell(event, params)
            }
          }
        }
      }
    }
    this.emitEvent('cell-click', params, event)
  },
  /**
   * Double-click click on the column to click on the event
   * If it is a double-click mode, it is activated in the edit state
   */
  triggerCellDblclickEvent(event, params) {
    const { editingStore, editingConfig, editingOptions } = this
    const { actived } = editingStore
    const cell = event.currentTarget
    params.cell = cell
    if (isEnableConf(editingConfig) && editingOptions.trigger === 'dblclick') {
      if (!actived.args || event.currentTarget !== actived.args.cell) {
        if (editingOptions.mode === 'row') {
          this.checkValidate('blur')
            .catch((e) => e)
            .then(() => {
              this.handleActived(params, event)
                .then(() => this.checkValidate('change'))
                .catch((e) => e)
            })
        } else if (editingOptions.mode === 'cell') {
          this.handleActived(params, event)
            .then(() => this.checkValidate('change'))
            .catch((e) => e)
        }
      }
    }
    this.emitEvent('cell-dblclick', params, event)
  },
  handleDefaultSort() {
    const { sortConfig, sortOpts } = this
    let { defaultSort } = sortOpts
    if (defaultSort) {
      if (!lodash.isArray(defaultSort)) {
        defaultSort = [defaultSort]
      }
      if (defaultSort.length) {
        ;(sortConfig.multiple ? defaultSort : defaultSort.slice(0, 1)).forEach((item, index) => {
          const { value, order } = item
          if (value && order) {
            const column = this.getColumnByField(value)
            if (column && column.sortable) {
              column.order = order
              column.sortTime = Date.now() + index
            }
          }
        })
        if (!sortoptions.remote) {
          this.updateTableData(true).then(this.updateTableStyle)
        }
      }
    }
  },
  /**
   * Click Sort events
   */
  triggerSortEvent(event, column, order) {
    const { sortOpts } = this
    const { value, sortable, remoteSort } = column
    if (sortable || remoteSort) {
      if (!order || column.order === order) {
        this.clearSort(sortoptions.multiple ? column : null)
      } else {
        this.sort({ value, order })
      }
      const params = {
        $tableContainer: this,
        $event: event,
        column,
        value,
        property: value,
        order: column.order,
        sortList: this.getSortColumns(),
        sortTime: column.sortTime
      }
      if (this.mouseConfig && this.mouseoptions.area && this.handleSortEvent) {
        this.handleSortEvent(event, params)
      }
      this.emitEvent('sort-change', params, event)
    }
  },
  setPendingRow(rows, status) {
    const pendingMaps = { ...this.pendingRowMaps }
    const pendingList = [...this.pendingRowList]
    if (rows && !lodash.isArray(rows)) {
      rows = [rows]
    }
    if (status) {
      rows.forEach((row) => {
        const rowId = getRowId(this, row)
        if (rowId && !pendingMaps[rowId]) {
          pendingList.push(row)
          pendingMaps[rowId] = row
        }
      })
    } else {
      rows.forEach((row) => {
        const rowId = getRowId(this, row)
        if (rowId && pendingMaps[rowId]) {
          const pendingIndex = this.findRowIndexOf(pendingList, row)
          if (pendingIndex > -1) {
            pendingList.splice(pendingIndex, 1)
          }
          delete pendingMaps[rowId]
        }
      })
    }
    this.pendingRowMaps = pendingMaps
    this.pendingRowList = pendingList
    return this.$nextTick()
  },
  togglePendingRow(rows) {
    const pendingMaps = { ...this.pendingRowMaps }
    const pendingList = [...this.pendingRowList]
    if (rows && !lodash.isArray(rows)) {
      rows = [rows]
    }
    rows.forEach((row) => {
      const rowId = getRowId(this, row)
      if (rowId) {
        if (pendingMaps[rowId]) {
          const pendingIndex = this.findRowIndexOf(pendingList, row)
          if (pendingIndex > -1) {
            pendingList.splice(pendingIndex, 1)
          }
          delete pendingMaps[rowId]
        } else {
          pendingList.push(row)
          pendingMaps[rowId] = row
        }
      }
    })
    this.pendingRowMaps = pendingMaps
    this.pendingRowList = pendingList
    return this.$nextTick()
  },
  getPendingRecords() {
    return this.pendingRowList.slice(0)
  },
  hasPendingByRow(row) {
    const { pendingRowMaps } = this
    const rowId = getRowId(this, row)
    return !!pendingRowMaps[rowId]
  },
  clearPendingRow() {
    this.pendingRowMaps = {}
    this.pendingRowList = []
    return this.$nextTick()
  },
  sort(sortConfs, sortOrder) {
    const { sortOpts } = this
    const { multiple, remote, orders } = sortOpts
    if (sortConfs) {
      if (lodash.isString(sortConfs)) {
        sortConfs = [{ value: sortConfs, order: sortOrder }]
      }
    }
    if (!lodash.isArray(sortConfs)) {
      sortConfs = [sortConfs]
    }
    if (sortConfs.length) {
      let firstSortColumn
      if (!multiple) {
        clearAllSort(this)
      }
      ;(multiple ? sortConfs : [sortConfs[0]]).forEach((confs, index) => {
        let { order } = confs
        const { value } = confs
        let column = value
        if (lodash.isString(value)) {
          column = this.getColumnByField(value)
        }
        if (column && (column.sortable || column.remoteSort)) {
          if (!firstSortColumn) {
            firstSortColumn = column
          }
          if (orders.indexOf(order) === -1) {
            order = getNextSortOrder(this, column)
          }
          if (column.order !== order) {
            column.order = order
          }
          column.sortTime = Date.now() + index
        }
      })
      // If the order is server-side, the local sorting process is skipped
      if (!remote || (firstSortColumn && firstSortColumn.remoteSort)) {
        this.updateTableData(true)
      }
      return this.$nextTick().then(() => {
        this.updateCellAreas()
        return this.updateTableStyle()
      })
    }
    return this.$nextTick()
  },
  /**
   * Clear the sort criteria for the specified column
   * If empty, the sort criteria for all columns are cleared
   * @param {String} column Column or field name
   */
  clearSort(fieldOrColumn) {
    const { sortOpts } = this
    if (fieldOrColumn) {
      const column = handleFieldOrColumn(this, fieldOrColumn)
      if (column) {
        column.order = null
      }
    } else {
      clearAllSort(this)
    }
    if (!sortoptions.remote) {
      this.updateTableData(true)
    }
    return this.$nextTick().then(this.updateTableStyle)
  },
  // Deprecated
  getSortColumn() {
    if (import.meta.env.MODE === 'development') {
      warnLog('rtable.error.delFunc', ['getSortColumn', 'getSortColumns'])
    }
    return lodash.find(this.tableFullColumn, (column) => (column.sortable || column.remoteSort) && column.order)
  },
  isSort(fieldOrColumn) {
    if (fieldOrColumn) {
      const column = handleFieldOrColumn(this, fieldOrColumn)
      return column && column.sortable && !!column.order
    }
    return this.getSortColumns().length > 0
  },
  getSortColumns() {
    const { multiple, chronological } = this.sortOpts
    const sortList = []
    this.tableFullColumn.forEach((column) => {
      const { value, order } = column
      if ((column.sortable || column.remoteSort) && order) {
        sortList.push({ column, value, property: value, order, sortTime: column.sortTime })
      }
    })
    if (multiple && chronological && sortList.length > 1) {
      return lodash.orderBy(sortList, 'sortTime')
    }
    return sortList
  },
  /**
   * Turn off filtering
   * @param {Event} event Event
   */
  closeFilter() {
    const { filterState } = this
    const { column, visible } = filterState
    Object.assign(filterState, {
      isAllSelected: false,
      isIndeterminate: false,
      options: [],
      visible: false
    })
    if (visible) {
      this.emitEvent(
        'filter-visible',
        {
          column,
          value: column.value,
          property: column.value,
          filterList: this.getselectedFilters(),
          visible: false
        },
        null
      )
    }
    return this.$nextTick()
  },
  /**
   * Determines whether the specified column is filtered, and if empty, all columns are judged
   * @param {String} fieldOrColumn The name of the field
   */
  isActiveFilterByColumn(fieldOrColumn) {
    const column = handleFieldOrColumn(this, fieldOrColumn)
    if (column) {
      return column.filters && column.filters.some((option) => option.selected)
    }
    return this.getselectedFilters().length > 0
  },
  // DEPRECATED
  isFilter(fieldOrColumn) {
    return this.isActiveFilterByColumn(fieldOrColumn)
  },
  /**
   * Determine whether the lazy loading of the expanded row is complete
   * @param {Row} row row object
   */
  isRowExpandLoaded(row) {
    const rest = this.fullAllDataRowMap.get(row)
    return rest && rest.expandLoaded
  },
  clearRowExpandLoaded(row) {
    const { expandOpts, rowExpandLazyLoadedMaps, fullAllDataRowMap } = this
    const { lazy } = expandOpts
    const rowId = getRowId(this, row)
    const rest = fullAllDataRowMap.get(row)
    if (lazy && rest) {
      rest.expandLoaded = false
      const rowTempExpandLazyLoadedMaps = { ...rowExpandLazyLoadedMaps }
      if (rowTempExpandLazyLoadedMaps[rowId]) {
        delete rowTempExpandLazyLoadedMaps[rowId]
      }
      this.rowExpandLazyLoadedMaps = rowTempExpandLazyLoadedMaps
    }
    return this.$nextTick()
  },
  /**
   * Reload the expand row, and expand the contents
   * @param {Row} row row-object
   */
  reloadRowExpand(row) {
    const { expandOpts, rowExpandLazyLoadedMaps } = this
    const { lazy } = expandOpts
    const rowId = getRowId(this, row)
    if (lazy && !rowExpandLazyLoadedMaps[rowId]) {
      this.clearRowExpandLoaded(row).then(() => this.handleAsyncRowExpand(row))
    }
    return this.$nextTick()
  },
  reloadExpandContent(row) {
    if (import.meta.env.MODE === 'development') {
      warnLog('rtable.error.delFunc', ['reloadExpandContent', 'reloadRowExpand'])
    }
    // Going to be expanded
    return this.reloadRowExpand(row)
  },
  /**
   * Expand the row event
   */
  triggerRowExpandEvent(event, params) {
    const { expandOpts, rowExpandLazyLoadedMaps, expandColumn: column } = this
    const { row } = params
    const { lazy } = expandOpts
    const rowId = getRowId(this, row)
    if (!lazy || !rowExpandLazyLoadedMaps[rowId]) {
      const expanded = !this.isRowExpandByRow(row)
      const columnIndex = this.getColumnIndex(column)
      const $columnIndex = this.getVMColumnIndex(column)
      this.setRowExpand(row, expanded)
      this.emitEvent(
        'toggle-row-expand',
        {
          expanded,
          column,
          columnIndex,
          $columnIndex,
          row,
          rowIndex: this.getRowIndex(row),
          $rowIndex: this.getVMRowIndex(row)
        },
        event
      )
    }
  },
  /**
   * Toggles the expansion row
   */
  toggleRowExpand(row) {
    return this.setRowExpand(row, !this.isRowExpandByRow(row))
  },
  /**
   * Handles the default expansion row
   */
  handleDefaultRowExpand() {
    const { expandOpts, fullRowsDatarowIdData } = this
    const { expandAll, expandRowKeys } = expandOpts
    if (expandAll) {
      this.setAllRowExpand(true)
    } else if (expandRowKeys) {
      const defExpandeds = []
      expandRowKeys.forEach((rowId) => {
        if (fullRowsDatarowIdData[rowId]) {
          defExpandeds.push(fullRowsDatarowIdData[rowId].row)
        }
      })
      this.setRowExpand(defExpandeds, true)
    }
  },
  /**
   * Sets the expansion of all rows
   * @param {Boolean} expanded Whether to expand or not
   */
  setAllRowExpand(expanded) {
    const { treeConfig, treeOptions, tableFullRowsData, tableFullTreeRowsData } = this
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    let expandedRows = []
    if (treeConfig) {
      lodash.eachTree(
        tableFullTreeRowsData,
        (row) => {
          expandedRows.push(row)
        },
        { children: childrenAccessField }
      )
    } else {
      expandedRows = tableFullRowsData
    }
    return this.setRowExpand(expandedRows, expanded)
  },
  handleAsyncRowExpand(row) {
    const { fullAllDataRowMap, expandOpts } = this
    const rest = fullAllDataRowMap.get(row)
    return new Promise((resolve) => {
      const { loadMethod } = expandOpts
      if (loadMethod) {
        const { rowExpandLazyLoadedMaps } = this
        const rowTempExpandLazyLoadedMaps = { ...rowExpandLazyLoadedMaps }
        const rowId = getRowId(this, row)
        rowTempExpandLazyLoadedMaps[rowId] = row
        this.rowExpandLazyLoadedMaps = rowTempExpandLazyLoadedMaps
        loadMethod({ $tableContainer: this, row, rowIndex: this.getRowIndex(row), $rowIndex: this.getVMRowIndex(row) })
          .then(() => {
            rest.expandLoaded = true
            const { rowExpandedMaps } = this
            const rowTempExpandedMaps = { ...rowExpandedMaps }
            rowTempExpandedMaps[rowId] = row
            this.rowExpandedMaps = rowTempExpandedMaps
          })
          .catch(() => {
            rest.expandLoaded = false
          })
          .finally(() => {
            const { rowExpandLazyLoadedMaps } = this
            const rowTempExpandLazyLoadedMaps = { ...rowExpandLazyLoadedMaps }
            if (rowTempExpandLazyLoadedMaps[rowId]) {
              delete rowTempExpandLazyLoadedMaps[rowId]
            }
            this.rowExpandLazyLoadedMaps = rowTempExpandLazyLoadedMaps
            resolve(this.$nextTick().then(this.recalculate))
          })
      } else {
        resolve()
      }
    })
  },
  /**
   * Set the expansion row, and set the two parameters to expand the row or not
   * Single-line support
   * Multi-line support is supported
   * @param {Array/Row} rows row data
   * @param {Boolean} expanded Whether to expand or not
   */
  setRowExpand(rows, expanded) {
    const { rowExpandedMaps, fullAllDatarowIdData, rowExpandLazyLoadedMaps, expandOpts, expandColumn: column } = this
    let rExpandedMaps = { ...rowExpandedMaps }
    const { reserve, lazy, accordion: eventListeners toggleMethod } = expandOpts
    const lazyRests = []
    const columnIndex = this.getColumnIndex(column)
    const $columnIndex = this.getVMColumnIndex(column)
    if (rows) {
      if (!lodash.isArray(rows)) {
        rows = [rows]
      }
      if (accordion) {
        // Only one can be expanded at the same time
        rExpandedMaps = {}
        rows = rows.slice(rows.length - 1, rows.length)
      }
      // prettier-ignore
      const validRows = toggleMethod
        ? rows.filter((row) =>
          toggleMethod({
            expanded,
            column,
            columnIndex,
            $columnIndex,
            row,
            rowIndex: this.getRowIndex(row),
            $rowIndex: this.getVMRowIndex(row)
          })
        )
        : rows
      if (expanded) {
        validRows.forEach((row) => {
          const rowId = getRowId(this, row)
          if (!rExpandedMaps[rowId]) {
            const rest = fullAllDatarowIdData[rowId]
            const isLoad = lazy && !rest.expandLoaded && !rowExpandLazyLoadedMaps[rowId]
            if (isLoad) {
              lazyRests.push(this.handleAsyncRowExpand(row))
            } else {
              rExpandedMaps[rowId] = row
            }
          }
        })
      } else {
        validRows.forEach((item) => {
          const rowId = getRowId(this, item)
          if (rExpandedMaps[rowId]) {
            delete rExpandedMaps[rowId]
          }
        })
      }
      if (reserve) {
        validRows.forEach((row) => this.handleRowExpandReserve(row, expanded))
      }
    }
    this.rowExpandedMaps = rExpandedMaps
    return Promise.all(lazyRests).then(this.recalculate)
  },
  /**
   * Determines whether the row is expanded
   * @param {Row} row row object
   */
  isRowExpandByRow(row) {
    const { rowExpandedMaps } = this
    const rowId = getRowId(this, row)
    return !!rowExpandedMaps[rowId]
  },
  isExpandByRow(row) {
    if (import.meta.env.MODE === 'development') {
      warnLog('rtable.error.delFunc', ['isExpandByRow', 'isRowExpandByRow'])
    }
    // Deprecated
    return this.isRowExpandByRow(row)
  },
  /**
   * Manually clear the expanded row state, and the data will be restored to the unexpanded state
   */
  clearRowExpand() {
    const { expandOpts, tableFullRowsData } = this
    const { reserve } = expandOpts
    const expList = this.getRowExpandRecords()
    this.rowExpandedMaps = {}
    if (reserve) {
      tableFullRowsData.forEach((row) => this.handleRowExpandReserve(row, false))
    }
    return this.$nextTick().then(() => {
      if (expList.length) {
        this.recalculate()
      }
    })
  },
  clearRowExpandReserve() {
    this.rowExpandedReserveRowMap = {}
    return this.$nextTick()
  },
  handleRowExpandReserve(row, expanded) {
    const { rowExpandedReserveRowMap, expandOpts } = this
    if (expandoptions.reserve) {
      const rowId = getRowId(this, row)
      if (expanded) {
        rowExpandedReserveRowMap[rowId] = row
      } else if (rowExpandedReserveRowMap[rowId]) {
        delete rowExpandedReserveRowMap[rowId]
      }
    }
  },
  getRowExpandRecords() {
    const rest = []
    lodash.each(this.rowExpandedMaps, (item) => {
      if (item) {
        rest.push(item)
      }
    })
    return rest
  },
  getTreeExpandRecords() {
    const rest = []
    lodash.each(this.treeExpandedMap, (item) => {
      if (item) {
        rest.push(item)
      }
    })
    return rest
  },
  /**
   * Get the status of the tree table
   */
  getTreeStatus() {
    if (this.treeConfig) {
      return {
        config: this.treeOptions,
        rowExpandeds: this.getTreeExpandRecords()
      }
    }
    return null
  },
  /**
   * Check whether the lazy loading of the tree node is complete
   * @param {Row} row row object
   */
  isTreeExpandLoaded(row) {
    const rest = this.fullAllDataRowMap.get(row)
    return rest && rest.treeLoaded
  },
  clearTreeExpandLoaded(row) {
    const { treeOptions, treeExpandedMap, fullAllDataRowMap } = this
    const { transform, lazy } = treeOptions
    const rowId = getRowId(this, row)
    const rest = fullAllDataRowMap.get(row)
    if (lazy && rest) {
      rest.treeLoaded = false
      if (treeExpandedMap[rowId]) {
        delete treeExpandedMap[rowId]
      }
    }
    if (transform) {
      this.handleVirtualTreeToList()
      return this.updateTableData()
    }
    return this.$nextTick()
  },
  /**
   * Reload the tree node and expand the node
   * @param {Row} row row object
   */
  rebuildTreeExpand(row) {
    const { treeOptions, treeExpandedLazyLoadedMaps } = this
    const { transform, lazy } = treeOptions
    const hasChildField = treeOptions.hasChild || treeOptions.hasChildField
    const rowId = getRowId(this, row)
    if (lazy && row[hasChildField] && !treeExpandedLazyLoadedMaps[rowId]) {
      this.clearTreeExpandLoaded(row)
        .then(() => {
          return this.handleAsyncTreeExpandChildren(row)
        })
        .then(() => {
          if (transform) {
            this.handleVirtualTreeToList()
            return this.updateTableData()
          }
        })
        .then(() => {
          return this.recalculate()
        })
    }
    return this.$nextTick()
  },
  reloadTreeChilds(row) {
    if (import.meta.env.MODE === 'development') {
      warnLog('rtable.error.delFunc', ['reloadTreeChilds', 'rebuildTreeExpand'])
    }
    // going to be expanded
    return this.rebuildTreeExpand(row)
  },
  /**
   * Expand the tree node event
   */
  triggerTreeExpandedEvent(event, params) {
    const { treeOptions, treeExpandedLazyLoadedMaps } = this
    const { row, column } = params
    const { lazy } = treeOptions
    const rowId = getRowId(this, row)
    if (!lazy || !treeExpandedLazyLoadedMaps[rowId]) {
      const expanded = !this.isTreeExpandedByRowrowId(row)
      const columnIndex = this.getColumnIndex(column)
      const $columnIndex = this.getVMColumnIndex(column)
      this.setTreeExpand(row, expanded)
      this.emitEvent('tree-expand', { expanded, column, columnIndex, $columnIndex, row }, event)
    }
  },
  /**
   * Toggle/expand the tree nodes
   */
  toggleTreeExpand(row) {
    return this.setTreeExpand(row, !this.isTreeExpandedByRowrowId(row))
  },
  /**
   * Handles the default expansion tree node
   */
  handleDefaultTreeExpand() {
    const { treeConfig, treeOptions, tableFullRowsData } = this
    if (treeConfig) {
      const { expandAll, expandRowKeys } = treeOptions
      const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
      if (expandAll) {
        this.setAllTreeExpand(true)
      } else if (expandRowKeys) {
        const defExpandeds = []
        const rowkey = getRowkey(this)
        expandRowKeys.forEach((rowId) => {
          const matchObj = lodash.findTree(tableFullRowsData, (item) => rowId === lodash.get(item, rowkey), {
            children: childrenAccessField
          })
          if (matchObj) {
            defExpandeds.push(matchObj.item)
          }
        })
        this.setTreeExpand(defExpandeds, true)
      }
    }
  },
  handleAsyncTreeExpandChildren(row) {
    const { treeOptions, selectionOptions } = this
    const { transform, loadMethod } = treeOptions
    const { checkStrictly } = selectionOptions
    return new Promise((resolve) => {
      if (loadMethod) {
        const { fullAllDataRowMap, treeExpandedLazyLoadedMaps } = this
        const rowId = getRowId(this, row)
        const rest = fullAllDataRowMap.get(row)
        treeExpandedLazyLoadedMaps[rowId] = row
        loadMethod({ $tableContainer: this, row })
          .then((childRecords) => {
            // After the response is successful, expand the row and mount the child node to the node
            rest.treeLoaded = true
            if (treeExpandedLazyLoadedMaps[rowId]) {
              treeExpandedLazyLoadedMaps[rowId] = null
            }
            if (!lodash.isArray(childRecords)) {
              childRecords = []
            }
            if (childRecords) {
              return this.loadTreeChildren(row, childRecords).then((childRows) => {
                const { treeExpandedMap } = this
                const treeTempExpandedMaps = { ...treeExpandedMap }
                if (childRows.length && !treeTempExpandedMaps[rowId]) {
                  treeTempExpandedMaps[rowId] = row
                  this.treeExpandedMap = treeTempExpandedMaps
                }
                // If the current node is selected, the child nodes are also selected when expanded
                if (!checkStrictly && this.isSelectedByCheckboxRow(row)) {
                  this.handleselectedRow(childRows, true, true)
                }
                return this.$nextTick().then(() => {
                  if (transform) {
                    return this.updateTableData()
                  }
                })
              })
            }
          })
          .catch(() => {
            // If the response is abnormal, it will not be expanded, and the lazy load will be retriggered after clicking it again
            rest.treeLoaded = false
            const { treeExpandedLazyLoadedMaps } = this
            if (treeExpandedLazyLoadedMaps[rowId]) {
              treeExpandedLazyLoadedMaps[rowId] = null
            }
          })
          .finally(() => {
            this.$nextTick()
              .then(() => this.recalculate())
              .then(() => resolve())
          })
      } else {
        resolve()
      }
    })
  },
  /**
   * Sets whether to expand or not all tree nodes
   * @param {Boolean} expanded Whether to expand or not
   */
  setAllTreeExpand(expanded) {
    const { tableFullRowsData, treeOptions } = this
    const { lazy } = treeOptions
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const expandeds = []
    lodash.eachTree(
      tableFullRowsData,
      (row) => {
        const rowChildren = row[childrenAccessField]
        if (lazy || (rowChildren && rowChildren.length)) {
          expandeds.push(row)
        }
      },
      { children: childrenAccessField }
    )
    return this.setTreeExpand(expandeds, expanded)
  },
  /**
   * By default, the tree nodes are expanded and collapsed
   * @param rows
   * @param expanded
   * @returns
   */
  handleBaseTreeExpand(rows, expanded) {
    const { fullAllDataRowMap, tableFullRowsData, treeExpandedMap, treeOptions, treeExpandedLazyLoadedMaps, treeNodeColumn } =
      this
    const { reserve, lazy, accordion: eventListeners toggleMethod } = treeOptions
    const treeTempExpandedMaps = { ...treeExpandedMap }
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const hasChildField = treeOptions.hasChild || treeOptions.hasChildField
    const result = []
    const columnIndex = this.getColumnIndex(treeNodeColumn)
    const $columnIndex = this.getVMColumnIndex(treeNodeColumn)
    let validRows = toggleMethod
      ? rows.filter((row) => toggleMethod({ expanded, column: treeNodeColumn, columnIndex, $columnIndex, row }))
      : rows
    if (accordion) {
      validRows = validRows.length ? [validRows[validRows.length - 1]] : []
      // Only one can be expanded at the same level
      const matchObj = lodash.findTree(tableFullRowsData, (item) => item === validRows[0], { children: childrenAccessField })
      if (matchObj) {
        matchObj.items.forEach((item) => {
          const rowId = getRowId(this, item)
          if (treeTempExpandedMaps[rowId]) {
            delete treeTempExpandedMaps[rowId]
          }
        })
      }
    }
    if (expanded) {
      validRows.forEach((row) => {
        const rowId = getRowId(this, row)
        if (!treeTempExpandedMaps[rowId]) {
          const rest = fullAllDataRowMap.get(row)
          const isLoad = lazy && row[hasChildField] && !rest.treeLoaded && !treeExpandedLazyLoadedMaps[rowId]
          // Whether to use lazy loading or not
          if (isLoad) {
            result.push(this.handleAsyncTreeExpandChildren(row))
          } else {
            if (row[childrenAccessField] && row[childrenAccessField].length) {
              treeTempExpandedMaps[rowId] = row
            }
          }
        }
      })
    } else {
      validRows.forEach((item) => {
        const rowId = getRowId(this, item)
        if (treeTempExpandedMaps[rowId]) {
          delete treeTempExpandedMaps[rowId]
        }
      })
    }
    if (reserve) {
      validRows.forEach((row) => this.handleTreeExpandReserve(row, expanded))
    }
    this.treeExpandedMap = treeTempExpandedMaps
    return Promise.all(result).then(this.recalculate)
  },
  /**
   * Unfolding and closing of the virtual tree
   * @param rows
   * @param expanded
   * @returns
   */
  handleVirtualTreeExpand(rows, expanded) {
    return this.handleBaseTreeExpand(rows, expanded)
      .then(() => {
        this.handleVirtualTreeToList()
        return this.updateTableData()
      })
      .then(() => {
        return this.recalculate()
      })
  },
  /**
   * Set the expansion tree node, and set the two parameters to expand this row or not
   * Single-line support
   * Multi-line support is supported
   * @param {Array/Row} rows row data
   * @param {Boolean} expanded Whether to expand or not
   */
  setTreeExpand(rows, expanded) {
    const { treeOptions } = this
    const { transform } = treeOptions
    if (rows) {
      if (!lodash.isArray(rows)) {
        rows = [rows]
      }
      if (rows.length) {
        // If it is a virtual tree
        if (transform) {
          return this.handleVirtualTreeExpand(rows, expanded)
        } else {
          return this.handleBaseTreeExpand(rows, expanded)
        }
      }
    }
    return this.$nextTick()
  },
  /**
   * Determine whether the row is in the tree node expansion state
   * @param {Row} row row object
   */
  isTreeExpandedByRowrowId(row) {
    const { treeExpandedMap } = this
    return !!treeExpandedMap[getRowId(this, row)]
  },
  /**
   * Manually clear the expanded state of the tree node, and the data will return to the unexpanded state
   */
  clearTreeExpand() {
    const { treeOptions, tableFullRowsData } = this
    const { transform, reserve } = treeOptions
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const expList = this.getTreeExpandRecords()
    this.treeExpandedMap = {}
    if (reserve) {
      lodash.eachTree(tableFullRowsData, (row) => this.handleTreeExpandReserve(row, false), { children: childrenAccessField })
    }
    return this.updateTableData()
      .then(() => {
        if (transform) {
          this.handleVirtualTreeToList()
          return this.updateTableData()
        }
      })
      .then(() => {
        if (expList.length) {
          this.recalculate()
        }
      })
  },
  clearTreeExpandReserve() {
    this.treeExpandedReserveRowMap = {}
    return this.$nextTick()
  },
  handleTreeExpandReserve(row, expanded) {
    const { treeExpandedReserveRowMap, treeOptions } = this
    if (treeOptions.reserve) {
      const rowId = getRowId(this, row)
      if (expanded) {
        treeExpandedReserveRowMap[rowId] = row
      } else if (treeExpandedReserveRowMap[rowId]) {
        delete treeExpandedReserveRowMap[rowId]
      }
    }
  },
  /**
   * Get the scrolling status of the table
   */
  getScroll() {
    const { $refs, scrollXLoad, virtualScrollYLoad } = this
    const bodyElem = $refs.tableBody.$el
    return {
      virtualX: scrollXLoad,
      virtualY: virtualScrollYLoad,
      scrollTop: bodyElem.scrollTop,
      scrollLeft: bodyElem.scrollLeft
    }
  },
  /**
   * Landscape X visual rendering event handling
   */
  triggerScrollXEvent() {
    this.loadScrollXData()
  },
  loadScrollXData() {
    const { mergeList, mergeFooterList, scrollXState } = this
    const { startIndex, endIndex, offsetSize } = scrollXState
    const { toVisibleIndex, visibleSize } = computeVirtualX(this)
    const offsetItem = {
      startIndex: Math.max(0, toVisibleIndex - 1 - offsetSize),
      endIndex: toVisibleIndex + visibleSize + offsetSize
    }
    calculateMergerOffserIndex(mergeList.concat(mergeFooterList), offsetItem, 'col')
    const { startIndex: offsetStartIndex, endIndex: offsetEndIndex } = offsetItem
    if (toVisibleIndex <= startIndex || toVisibleIndex >= endIndex - visibleSize - 1) {
      if (startIndex !== offsetStartIndex || endIndex !== offsetEndIndex) {
        scrollXState.startIndex = offsetStartIndex
        scrollXState.endIndex = offsetEndIndex
        this.updateScrollXData()
      }
    }
    this.closeTooltip()
  },
  /**
   * Portrait Y visual rendering event handling
   */
  triggerScrollYEvent(event) {
    const { scrollYState } = this
    const { adaptive, offsetSize, visibleSize } = scrollYState
    // webkit is the fastest rendering engine, and allows no more then 40 items per event
    if (isWebkit && adaptive && offsetSize * 2 + visibleSize <= 40) {
      this.loadScrollYData(event)
    } else {
      this.debounceScrollY(event)
    }
  },
  debounceScrollY: lodash.debounce(
    function (event) {
      this.loadScrollYData(event)
    },
    debounceScrollYDuration: eventListeners
    { leading: false, trailing: true }
  ),
  /**
   * Vertical Y visual rendering handling
   */
  loadScrollYData(event) {
    const { mergeList, scrollYState } = this
    const { startIndex, endIndex, visibleSize, offsetSize, rowHeight } = scrollYState
    const scrollBodyElem = event.currentTarget || event.target
    const scrollTop = scrollBodyElem.scrollTop
    const toVisibleIndex = Math.floor(scrollTop / rowHeight)
    const offsetItem = {
      startIndex: Math.max(0, toVisibleIndex - 1 - offsetSize),
      endIndex: toVisibleIndex + visibleSize + offsetSize
    }
    calculateMergerOffserIndex(mergeList, offsetItem, 'row')
    const { startIndex: offsetStartIndex, endIndex: offsetEndIndex } = offsetItem
    if (toVisibleIndex <= startIndex || toVisibleIndex >= endIndex - visibleSize - 1) {
      if (startIndex !== offsetStartIndex || endIndex !== offsetEndIndex) {
        scrollYState.startIndex = offsetStartIndex
        scrollYState.endIndex = offsetEndIndex
        this.updateScrollYData()
        this.callNextPage(event)
      }
    }
  },
  // Calculate data related to visual rendering
  computeScrollLoad() {
    return this.$nextTick().then(() => {
      const { axisYOptions, axisXOptions, scrollXLoad, virtualScrollYLoad, scrollXState, scrollYState } = this
      //  X 
      if (scrollXLoad) {
        const { visibleSize: visibleXSize } = computeVirtualX(this)
        const offsetXSize = axisXOptions.oSize ? lodash.toNumber(axisXOptions.oSize) : browse.msie ? 10 : browse.edge ? 5 : 0
        scrollXState.offsetSize = offsetXSize
        scrollXState.visibleSize = visibleXSize
        scrollXState.endIndex = Math.max(
          scrollXState.startIndex + scrollXState.visibleSize + offsetXSize,
          scrollXState.endIndex
        )
        this.updateScrollXData()
      } else {
        this.updateScrollXSpace()
      }
      // Calculate Y logic
      const { rowHeight, visibleSize: visibleYSize } = computeVirtualY(this)
      scrollYState.rowHeight = rowHeight
      if (virtualScrollYLoad) {
        const offsetYSize = axisYOptions.oSize ? lodash.toNumber(axisYOptions.oSize) : browse.msie ? 20 : browse.edge ? 10 : 0
        scrollYState.offsetSize = offsetYSize
        scrollYState.visibleSize = visibleYSize
        scrollYState.endIndex = Math.max(scrollYState.startIndex + visibleYSize + offsetYSize, scrollYState.endIndex)
        this.updateScrollYData()
      } else {
        this.updateScrollYSpace()
      }
      this.rowHeight = rowHeight
      this.$nextTick(this.updateTableStyle)
    })
  },
  handleTableColumn() {
    const { scrollXLoad, visibleColumn, scrollXState } = this
    this.tableColumn = scrollXLoad
      ? visibleColumn.slice(scrollXState.startIndex, scrollXState.endIndex)
      : visibleColumn.slice(0)
  },
  updateScrollXData() {
    // this.tableColumn = []
    this.$nextTick(() => {
      this.handleTableColumn()
      this.updateScrollXSpace()
    })
  },

  updateScrollXSpace() {
    const { $refs, isGroup, refsStore, visibleColumn, scrollXState, scrollXLoad, tableWidth, scrollbarWidth } = this
    const { tableHeader, tableBody, tableFooter } = $refs
    const tableBodyEl = tableBody ? tableBody.$el : null
    if (tableBodyEl) {
      const tableHeaderElem = tableHeader ? tableHeader.$el : null
      const tableFooterElem = tableFooter ? tableFooter.$el : null
      const headerElem = tableHeaderElem ? tableHeaderElem.querySelector('.r4m-table--header') : null
      const bodyElem = tableBodyEl.querySelector('.r4m-table--body')
      const footerElem = tableFooterElem ? tableFooterElem.querySelector('.r4m-table--footer') : null
      const leftSpaceWidth = visibleColumn
        .slice(0, scrollXState.startIndex)
        .reduce((previous, column) => previous + column.renderWidth, 0)
      let marginLeft = ''
      if (scrollXLoad) {
        marginLeft = `${leftSpaceWidth}px`
      }
      if (headerElem) {
        headerElem.style.marginLeft = isGroup ? '' : marginLeft
      }
      bodyElem.style.marginLeft = marginLeft
      if (footerElem) {
        footerElem.style.marginLeft = marginLeft
      }
      const containerList = ['main']
      containerList.forEach((name) => {
        const layoutList = ['header', 'body', 'footer']
        layoutList.forEach((layout) => {
          const xSpaceElem = refsStore[`${name}-${layout}-xSpace`]
          if (xSpaceElem) {
            xSpaceElem.style.width = scrollXLoad ? `${tableWidth + (layout === 'header' ? scrollbarWidth : 0)}px` : ''
          }
        })
      })
      this.$nextTick(this.updateTableStyle)
    }
  },
  updateScrollYData(event) {
    // this.tableData = []
    this.$nextTick(() => {
      this.updateTableData()
      this.updateScrollYSpace()
    })
  },

  callNextPage(event) {
    const { lastScrollTop, loading, afterfullRowsData, wrapperHeight } = this
    const bodyHeight = afterfullRowsData.length * 48
    // TODO: Possible bug depending on footer existance
    const currentScrollOffset = lastScrollTop + wrapperHeight
    if (currentScrollOffset >= bodyHeight && !loading) {
      this.emitEvent('end-reached', null, event)
    }
  },

  updateScrollYSpace() {
    const { refsStore, scrollYState, virtualScrollYLoad, afterfullRowsData } = this
    const { startIndex, rowHeight } = scrollYState
    const bodyHeight = afterfullRowsData.length * rowHeight
    const topSpaceHeight = Math.max(0, startIndex * rowHeight)
    const containerList = ['main', 'left', 'right']
    let marginTop = ''
    let ySpaceHeight = ''
    if (virtualScrollYLoad) {
      marginTop = `${topSpaceHeight}px`
      ySpaceHeight = `${bodyHeight}px`
    }
    containerList.forEach((name) => {
      const layoutList = ['header', 'body', 'footer']
      const tableElem = refsStore[`${name}-body-table`]
      if (tableElem) {
        tableElem.style.marginTop = marginTop
      }
      layoutList.forEach((layout) => {
        const ySpaceElem = refsStore[`${name}-${layout}-ySpace`]
        if (ySpaceElem) {
          ySpaceElem.style.height = ySpaceHeight
        }
      })
    })
    this.$nextTick(this.updateTableStyle)
  },

  scrollTo(scrollLeft, scrollTop) {
    const { $refs } = this
    const { tableBody, rightBody, tableFooter } = $refs
    const tableBodyEl = tableBody ? tableBody.$el : null
    const rightBodyElem = rightBody ? rightBody.$el : null
    const tableFooterElem = tableFooter ? tableFooter.$el : null
    if (lodash.isNumber(scrollLeft)) {
      setScrollLeft(tableFooterElem || tableBodyEl, scrollLeft)
    }
    if (lodash.isNumber(scrollTop)) {
      setScrollTop(rightBodyElem || tableBodyEl, scrollTop)
    }
    if (this.scrollXLoad || this.virtualScrollYLoad) {
      return new Promise((resolve) => setTimeout(() => resolve(this.$nextTick()), 50))
    }
    return this.$nextTick()
  },

  scrollToRow(row, fieldOrColumn) {
    const rest = []
    if (row) {
      if (this.treeConfig) {
        rest.push(this.scrollToTreeRow(row))
      } else {
        rest.push(rowToVisible(this, row))
      }
    }
    if (fieldOrColumn) {
      rest.push(this.scrollToColumn(fieldOrColumn))
    }
    return Promise.all(rest)
  },

  scrollToColumn(fieldOrColumn) {
    const column = handleFieldOrColumn(this, fieldOrColumn)
    if (column && this.fullColumnMap.has(column)) {
      return colToVisible(this, column)
    }
    return this.$nextTick()
  },

  scrollToTreeRow(row) {
    const { tableFullRowsData, treeConfig, treeOptions } = this
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const rests = []
    if (treeConfig) {
      const matchObj = lodash.findTree(tableFullRowsData, (item) => item === row, { children: childrenAccessField })
      if (matchObj) {
        const nodes = matchObj.nodes
        nodes.forEach((row, index) => {
          if (index < nodes.length - 1 && !this.isTreeExpandedByRowrowId(row)) {
            rests.push(this.setTreeExpand(row, true))
          }
        })
      }
    }
    return Promise.all(rests).then(() => rowToVisible(this, row))
  },
  clearScroll() {
    const { $refs, scrollXState, scrollYState } = this
    const { tableBody, rightBody, tableFooter } = $refs
    const tableBodyEl = tableBody ? tableBody.$el : null
    const rightBodyElem = rightBody ? rightBody.$el : null
    const tableFooterElem = tableFooter ? tableFooter.$el : null
    if (rightBodyElem) {
      restoreScrollListener(rightBodyElem)
      rightBodyElem.scrollTop = 0
    }
    if (tableFooterElem) {
      tableFooterElem.scrollLeft = 0
    }
    if (tableBodyEl) {
      restoreScrollListener(tableBodyEl)
      tableBodyEl.scrollTop = 0
      tableBodyEl.scrollLeft = 0
    }
    scrollXState.startIndex = 0
    scrollYState.startIndex = 0
    return this.$nextTick()
  },
  updateFooterState() {
    const { showFooter, visibleColumn, footerData, footerMethod } = this
    let footData = []
    if (showFooter && footerData && footerData.length) {
      footData = footerData.slice(0)
    } else if (showFooter && footerMethod) {
      footData = visibleColumn.length
        ? footerMethod({ columns: visibleColumn, data: this.afterfullRowsData, $tableContainer: this, $gridContainer: this.$rgrid })
        : []
    }
    this.footerData = footData
    return this.$nextTick()
  },
  updateStatus(slotParams, cellValue) {
    const customVal = !lodash.isUndefined(cellValue)
    return this.$nextTick().then(() => {
      const { $refs, editRules, validStore } = this
      const tableBody = $refs.tableBody
      if (slotParams && tableBody && editRules) {
        const { row, column } = slotParams
        const type = 'change'
        if (this.hasCellRules) {
          if (this.hasCellRules(type, row, column)) {
            const cell = this.getCell(row, column)
            if (cell) {
              return this.validCellRules(type, row, column, cellValue)
                .then(() => {
                  if (customVal && validStore.visible) {
                    setCellValue(row, column, cellValue)
                  }
                  this.clearValidate(row, column)
                })
                .catch(({ rule }) => {
                  if (customVal) {
                    setCellValue(row, column, cellValue)
                  }
                  this.showValidTooltip({ rule, row, column, cell })
                })
            }
          }
        }
      }
    })
  },
  handleDefaultMergeCells() {
    this.setMergeCells(this.mergeCells)
  },

  setMergeCells(merges) {
    if (this.customSpanFn) {
      errLog('rtable.error.errConflicts', ['merge-cells', 'span-method'])
    }
    setMerges(this, merges, this.mergeList, this.afterfullRowsData)
    return this.$nextTick().then(() => this.updateCellAreas())
  },

  removeMergeCells(merges) {
    if (this.customSpanFn) {
      errLog('rtable.error.errConflicts', ['merge-cells', 'span-method'])
    }
    const rest = removeMerges(this, merges, this.mergeList, this.afterfullRowsData)
    return this.$nextTick().then(() => {
      this.updateCellAreas()
      return rest
    })
  },

  getMergeCells() {
    return this.mergeList.slice(0)
  },

  clearMergedCells() {
    this.mergeList = []
    return this.$nextTick()
  },
  handleDefaultMergeFooterItems() {
    this.setMergeFooterItems(this.mergeFooterItems)
  },
  setMergeFooterItems(merges) {
    if (this.footercustomSpanFn) {
      errLog('rtable.error.errConflicts', ['merge-footer-items', 'footer-span-method'])
    }
    setMerges(this, merges, this.mergeFooterList, null)
    return this.$nextTick().then(() => this.updateCellAreas())
  },
  removeMergeFooterItems(merges) {
    if (this.footercustomSpanFn) {
      errLog('rtable.error.errConflicts', ['merge-footer-items', 'footer-span-method'])
    }
    const rest = removeMerges(this, merges, this.mergeFooterList, null)
    return this.$nextTick().then(() => {
      this.updateCellAreas()
      return rest
    })
  },

  getMergeFooterItems() {
    return this.mergeFooterList.slice(0)
  },

  clearMergeFooterItems() {
    this.mergeFooterList = []
    return this.$nextTick()
  },
  updateZindex() {
    if (this.zIndex) {
      this.tZindex = this.zIndex
    } else if (this.tZindex < Utils.getLastZIndex()) {
      this.tZindex = Utils.nextZIndex()
    }
  },
  updateCellAreas() {
    if (this.mouseConfig && this.mouseoptions.area && this.handleUpdateCellAreas) {
      return this.handleUpdateCellAreas()
    }
    return this.$nextTick()
  },
  emitEvent(type, params, event) {
    this.$emit(type, Object.assign({ $tableContainer: this, $gridContainer: this.$rgrid, $event: event }, params))
  },
  focus() {
    this.isActivated = true
    return this.$nextTick()
  },
  blur() {
    this.isActivated = false
    return this.$nextTick()
  },
  // Attach the toolbar
  connect($toolbar) {
    if ($toolbar && $toolbar.syncUpdate) {
      $toolbar.syncUpdate({ columnsCollection: this.columnsCollection, $tableContainer: this })
      this.$toolbar = $toolbar
    } else {
      errLog('rtable.error.barUnableLink')
    }
    return this.$nextTick()
  },

  /*************************
   * Publish methods
   *************************/
  getCell(row, column) {
    const { $refs } = this
    const rowId = getRowId(this, row)
    let bodyElem = null
    if (column) {
      bodyElem = $refs[`${column.fixed || 'table'}Body`] || $refs.tableBody
    }
    if (bodyElem && bodyElem.$el) {
      return bodyElem.$el.querySelector(`.r4m-table-body--row[rowId="${rowId}"] .${column.id}`)
    }
    return null
  },
  getCellLabel(row, column) {
    const formatter = column.formatter
    const cellValue = Utils.getCellValue(row, column)
    let cellLabel = cellValue
    if (formatter) {
      let rest, formatData
      const { fullAllDataRowMap } = this
      const colid = column.id
      const cacheFormat = fullAllDataRowMap.has(row)
      if (cacheFormat) {
        rest = fullAllDataRowMap.get(row)
        formatData = rest.formatData
        if (!formatData) {
          formatData = fullAllDataRowMap.get(row).formatData = {}
        }
        if (rest && formatData[colid]) {
          if (formatData[colid].value === cellValue) {
            return formatData[colid].label
          }
        }
      }
      const formatParams = {
        cellValue,
        row,
        rowIndex: this.getRowIndex(row),
        column,
        columnIndex: this.getColumnIndex(column)
      }
      if (lodash.isString(formatter)) {
        const gFormatOpts = formats.get(formatter)
        cellLabel = gFormatOpts && gFormatoptions.cellFormatMethod ? gFormatoptions.cellFormatMethod(formatParams) : ''
      } else if (lodash.isArray(formatter)) {
        const gFormatOpts = formats.get(formatter[0])
        cellLabel =
          gFormatOpts && gFormatoptions.cellFormatMethod
            ? gFormatoptions.cellFormatMethod(formatParams, ...formatter.slice(1))
            : ''
      } else {
        cellLabel = formatter(formatParams)
      }
      if (formatData) {
        formatData[colid] = { value: cellValue, label: cellLabel }
      }
    }
    return cellLabel
  },
  findRowIndexOf(list, row) {
    return row ? lodash.findIndexOf(list, (item) => this.eqRow(item, row)) : -1
  },
  eqRow(row1, row2) {
    if (row1 && row2) {
      if (row1 === row2) {
        return true
      }
      return getRowId(this, row1) === getRowId(this, row2)
    }
    return false
  },
  /*************************
   * Publish methods
   *************************/

  getSetupOptions() {
    return GlobalConfigs
  }
}

// Module methods
const funcs =
  'setFilter,openFilter,clearFilter,getselectedFilters,closeMenu,setActiveCellArea,getActiveCellArea,getCellAreas,clearCellAreas,copyCellArea,cutCellArea,pasteCellArea,getCopyCellArea,getCopyCellAreas,clearCopyCellArea,setCellAreas,openFNR,openFind,openReplace,closeFNR,getSelectedCell,clearSelected,insert,insertAt,insertNextAt,remove,removeCheckboxRow,removeRadioRow,removeCurrentRow,getRecordset,getInsertRecords,getRemoveRecords,getUpdateRecords,clearEdit,clearActived,getEditRecord,getActiveRecord,isEditByRow,isActiveByRow,setEditRow,setActiveRow,setEditCell,setActiveCell,setSelectCell,clearValidate,fullValidate,validate,openExport,openPrint,exportData,openImport,importData,saveFile,readFile,importByFile,print,openCustom,closeCustom'.split(
    ','
  )

funcs.forEach((name) => {
  Methods[name] = function (...args) {
    if (import.meta.env.MODE === 'development') {
      if (!this[`_${name}`]) {
        if (
          'openExport,openPrint,exportData,openImport,importData,saveFile,readFile,importByFile,print'
            .split(',')
            .includes(name)
        ) {
          errLog('rtable.error.reqModule', ['RTableExportModule'])
        } else if ('fullValidate,validate'.split(',').includes(name)) {
          errLog('rtable.error.reqModule', ['RTableValidatorModule'])
        } else if ('setFilter,openFilter,clearFilter,getselectedFilters'.split(',').includes(name)) {
          errLog('rtable.error.reqModule', ['RTableFilterModule'])
        } else if (
          'insert,insertAt,insertNextAt,remove,removeCheckboxRow,removeRadioRow,removeCurrentRow,getRecordset,getInsertRecords,getRemoveRecords,getUpdateRecords,clearActived,getEditRecord,getActiveRecord,isEditByRow,isActiveByRow,setEditRow,setActiveRow,setEditCell,setActiveCell'
            .split(',')
            .includes(name)
        ) {
          errLog('rtable.error.reqModule', ['RTableEditModule'])
        } else if ('openCustom'.split(',').includes(name)) {
          errLog('rtable.error.reqModule', ['RTableCustomModule'])
        }
      }
    }
    return this[`_${name}`] ? this[`_${name}`](...args) : null
  }
})

export default Methods
