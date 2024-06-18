import RTable from '../r-datatable'
import lodash from 'lodash'
import { ColumnInfo } from './columnInfo'
import DomUtils from '../tools/dom'

const getAllConvertColumns = (columns, parentColumn) => {
  const result = []
  columns.forEach((column) => {
    column.parentId = parentColumn ? parentColumn.id : null
    if (column.visible) {
      if (column.children && column.children.length && column.children.some((column) => column.visible)) {
        result.push(column)
        result.push(...getAllConvertColumns(column.children, column))
      } else {
        result.push(column)
      }
    }
  })
  return result
}

export const convertHeaderColumnToRows = (originColumns) => {
  let maxLevel = 1
  const traverse = (column, parent) => {
    if (parent) {
      column.level = parent.level + 1
      if (maxLevel < column.level) {
        maxLevel = column.level
      }
    }
    if (column.children && column.children.length && column.children.some((column) => column.visible)) {
      let colSpan = 0
      column.children.forEach((subColumn) => {
        if (subColumn.visible) {
          traverse(subColumn, column)
          colSpan += subColumn.colSpan
        }
      })
      column.colSpan = colSpan
    } else {
      column.colSpan = 1
    }
  }

  originColumns.forEach((column) => {
    column.level = 1
    traverse(column)
  })

  const rows = []
  for (let i = 0; i < maxLevel; i++) {
    rows.push([])
  }

  const allColumns = getAllConvertColumns(originColumns)

  allColumns.forEach((column) => {
    if (column.children && column.children.length && column.children.some((column) => column.visible)) {
      column.rowSpan = 1
    } else {
      column.rowSpan = maxLevel - column.level + 1
    }
    rows[column.level - 1].push(column)
  })

  return rows
}

const lineOffsetSizes = {
  mini: 3,
  small: 2,
  medium: 1
}

export function restoreScrollLocation(_vm, scrollLeft, scrollTop) {
  return _vm.clearScroll().then(() => {
    if (scrollLeft || scrollTop) {
      // Reset last scroll state
      _vm.lastScrollLeft = 0
      _vm.lastScrollTop = 0
      // Restore scroll state
      return _vm.scrollTo(scrollLeft, scrollTop)
    }
  })
}

export function toTreePathSeq(path) {
  return path.map((num, i) => (i % 2 === 0 ? Number(num) + 1 : '.')).join('')
}

export function removeScrollListener(scrollElem) {
  if (scrollElem && scrollElem._onscroll) {
    scrollElem.onscroll = null
  }
}

export function restoreScrollListener(scrollElem) {
  if (scrollElem && scrollElem._onscroll) {
    scrollElem.onscroll = scrollElem._onscroll
  }
}

// row primary key
export function getRowkey($rtable) {
  return $rtable.rowoptions.keyField || $rtable.rowId || '_X_ROW_KEY'
}

// row primary key value
export function getRowId($rtable, row) {
  const rowId = lodash.get(row, getRowkey($rtable))
  return lodash.eqNull(rowId) ? '' : encodeURIComponent(rowId)
}

function getPaddingLeftRightSize(elem) {
  if (elem) {
    const computedStyle = getComputedStyle(elem)
    const paddingLeft = lodash.toNumber(computedStyle.paddingLeft)
    const paddingRight = lodash.toNumber(computedStyle.paddingRight)
    return paddingLeft + paddingRight
  }
  return 0
}

function getElemenMarginWidth(elem) {
  if (elem) {
    const computedStyle = getComputedStyle(elem)
    const marginLeft = lodash.toNumber(computedStyle.marginLeft)
    const marginRight = lodash.toNumber(computedStyle.marginRight)
    return elem.offsetWidth + marginLeft + marginRight
  }
  return 0
}

export function handleFieldOrColumn(_vm, fieldOrColumn) {
  if (fieldOrColumn) {
    return lodash.isString(fieldOrColumn) ? _vm.getColumnByField(fieldOrColumn) : fieldOrColumn
  }
  return null
}

export function getRootColumn($rtable, column) {
  const fullColumnIdData = $rtable.fullColumnIdData
  if (!column) {
    return null
  }
  let parentColId = column.parentId
  while (fullColumnIdData[parentColId]) {
    const column = fullColumnIdData[parentColId].column
    parentColId = column.parentId
    if (!parentColId) {
      return column
    }
  }
  return column
}

function queryCellElement(cell, selector) {
  return cell.querySelector('.r4m-table-cell' + selector)
}

export function toFilters(filters) {
  if (filters && lodash.isArray(filters)) {
    return filters.map(({ label, value, data, resetValue, selected }) => {
      return { label, value, data, resetValue, selected: !!selected, _selected: !!selected }
    })
  }
  return filters
}

export function getColReMinWidth(params) {
  const { $tableContainer, column, cell } = params
  const { showHeaderOverflow: columnHeaderOverflow, resizableOpts } = $tableContainer
  const { minWidth } = resizableOpts
  // If you customize the width adjustment logic
  if (minWidth) {
    const customMinWidth = lodash.isFunction(minWidth) ? minWidth(params) : minWidth
    if (customMinWidth !== 'auto') {
      return Math.max(1, lodash.toNumber(customMinWidth))
    }
  }
  const { showHeaderOverflow, minWidth: colMinWidth } = column
  const headOverflow =
    lodash.isUndefined(showHeaderOverflow) || lodash.isNull(showHeaderOverflow)
      ? columnHeaderOverflow
      : showHeaderOverflow
  const showEllipsis = headOverflow === 'ellipsis'
  const showTitle = headOverflow === 'title'
  const showTooltip = headOverflow === true || headOverflow === 'tooltip'
  const hasEllipsis = showTitle || showTooltip || showEllipsis
  const minTitleWidth = lodash.floor((lodash.toNumber(getComputedStyle(cell).fontSize) || 14) * 1.6)
  const paddingLeftRight = getPaddingLeftRightSize(cell) + getPaddingLeftRightSize(queryCellElement(cell, ''))
  let mWidth = minTitleWidth + paddingLeftRight
  // Default minimum width processing
  if (hasEllipsis) {
    const checkboxIconWidth = getPaddingLeftRightSize(queryCellElement(cell, '--title>.r4m-table-cell--checkbox'))
    const requiredIconWidth = getElemenMarginWidth(queryCellElement(cell, '>.r4m-table-cell--required-icon'))
    const editIconWidth = getElemenMarginWidth(queryCellElement(cell, '>.r4m-table-cell--edit-icon'))
    const prefixIconWidth = getElemenMarginWidth(queryCellElement(cell, '>.r4m-table-cell-title-prefix-icon'))
    const suffixIconWidth = getElemenMarginWidth(queryCellElement(cell, '>.r4m-table-cell-title-suffix-icon'))
    const sortIconWidth = getElemenMarginWidth(queryCellElement(cell, '>.r4m-table-cell--sort'))
    const filterIconWidth = getElemenMarginWidth(queryCellElement(cell, '>.r4m-table-cell--filter'))
    mWidth +=
      checkboxIconWidth +
      requiredIconWidth +
      editIconWidth +
      prefixIconWidth +
      suffixIconWidth +
      filterIconWidth +
      sortIconWidth
  }
  // If you set the minimum width
  if (colMinWidth) {
    const { tableBody } = $tableContainer.$refs
    const bodyElem = tableBody ? tableBody.$el : null
    if (bodyElem) {
      if (DomUtils.isScale(colMinWidth)) {
        const bodyWidth = bodyElem.clientWidth - 1
        const meanWidth = bodyWidth / 100
        return Math.max(mWidth, Math.floor(lodash.toInteger(colMinWidth) * meanWidth))
      } else if (DomUtils.isPx(colMinWidth)) {
        return Math.max(mWidth, lodash.toInteger(colMinWidth))
      }
    }
  }
  return mWidth
}

function countTreeExpand(prevRow, params) {
  let count = 1
  if (!prevRow) {
    return count
  }
  const { $tableContainer } = params
  const { treeOptions } = $tableContainer
  const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
  const rowChildren = prevRow[childrenAccessField]
  if (rowChildren && $tableContainer.isTreeExpandedByRowrowId(prevRow)) {
    for (let index = 0; index < rowChildren.length; index++) {
      count += countTreeExpand(rowChildren[index], params)
    }
  }
  return count
}

export function getOffsetSize($rtable) {
  return lineOffsetSizes[$rtable.vSize] || 0
}

export function calcTreeLine(params, items, rIndex) {
  const { $tableContainer } = params
  let expandSize = 1
  if (rIndex) {
    expandSize = countTreeExpand(items[rIndex - 1], params)
  }
  return $tableContainer.rowHeight * expandSize - (rIndex ? 1 : 12 - getOffsetSize($tableContainer))
}

export function mergeBodyMethod(mergeList, _rowIndex, _columnIndex) {
  for (let mIndex = 0; mIndex < mergeList.length; mIndex++) {
    const { row: mergeRowIndex, col: mergeColIndex, rowspan: mergeRowspan, colspan: mergeColspan } = mergeList[mIndex]
    if (mergeColIndex > -1 && mergeRowIndex > -1 && mergeRowspan > -1 && mergeColspan) {
      if (mergeRowIndex === _rowIndex && mergeColIndex === _columnIndex) {
        return { rowspan: mergeRowspan, colspan: mergeColspan }
      }
      if (
        _rowIndex >= mergeRowIndex &&
        _rowIndex < mergeRowIndex + mergeRowspan &&
        _columnIndex >= mergeColIndex &&
        _columnIndex < mergeColIndex + mergeColspan
      ) {
        return { rowspan: 0, colspan: 0 }
      }
    }
  }
}

export function clearTableDefaultStatus(_vm) {
  _vm.initStatus = false
  _vm.clearSort()
  _vm.clearCurrentRow()
  _vm.clearCurrentColumn()
  _vm.clearRadioRow()
  _vm.clearRadioReserve()
  _vm.clearCheckboxRow()
  _vm.clearCheckboxReserve()
  _vm.clearRowExpand()
  _vm.clearTreeExpand()
  _vm.clearTreeExpandReserve()
  if (_vm.clearActived && RTable._edit) {
    _vm.clearActived()
  }
  if (_vm.clearSelected && (_vm.keyboardConfig || _vm.mouseConfig)) {
    _vm.clearSelected()
  }
  if (_vm.clearCellAreas && _vm.mouseConfig) {
    _vm.clearCellAreas()
    _vm.clearCopyCellArea()
  }
  return _vm.clearScroll()
}

export function clearTableAllStatus(_vm) {
  if (_vm.clearFilter && RTable._filter) {
    _vm.clearFilter()
  }
  return clearTableDefaultStatus(_vm)
}

export function isColumnInfo(column) {
  return column instanceof ColumnInfo
}

export function getColumnConfig($rtable, _vm, options) {
  return isColumnInfo(_vm) ? _vm : new ColumnInfo($rtable, _vm, options)
}

export function rowToVisible($rtable, row) {
  const { tableBody } = $rtable.$refs
  const bodyElem = tableBody ? tableBody.$el : null
  if (bodyElem) {
    const trElem = bodyElem.querySelector(`[rowId="${getRowId($rtable, row)}"]`)
    if (trElem) {
      const bodyHeight = bodyElem.clientHeight
      const bodySrcollTop = bodyElem.scrollTop
      const trOffsetTop = trElem.offsetTop + (trElem.offsetParent ? trElem.offsetParent.offsetTop : 0)
      const trHeight = trElem.clientHeight
      // Check if row is in viewable area
      if (trOffsetTop < bodySrcollTop || trOffsetTop > bodySrcollTop + bodyHeight) {
        // Position upward
        return $rtable.scrollTo(null, trOffsetTop)
      } else if (trOffsetTop + trHeight >= bodyHeight + bodySrcollTop) {
        // Position down
        return $rtable.scrollTo(null, bodySrcollTop + trHeight)
      }
    } else {
      // If it is virtual rendering and scrolling across lines
      if ($rtable.virtualScrollYLoad) {
        return $rtable.scrollTo(null, ($rtable.afterfullRowsData.indexOf(row) - 1) * $rtable.scrollYState.rowHeight)
      }
    }
  }
  return Promise.resolve()
}

export function colToVisible($rtable, column) {
  const { tableBody } = $rtable.$refs
  const bodyElem = tableBody ? tableBody.$el : null
  if (bodyElem) {
    const tdElem = bodyElem.querySelector(`.${column.id}`)
    if (tdElem) {
      const bodyWidth = bodyElem.clientWidth
      const bodySrcollLeft = bodyElem.scrollLeft
      const tdOffsetLeft = tdElem.offsetLeft + (tdElem.offsetParent ? tdElem.offsetParent.offsetLeft : 0)
      const tdWidth = tdElem.clientWidth
      // Check if row is in viewable area
      if (tdOffsetLeft < bodySrcollLeft || tdOffsetLeft > bodySrcollLeft + bodyWidth) {
        // Position left
        return $rtable.scrollTo(tdOffsetLeft)
      } else if (tdOffsetLeft + tdWidth >= bodyWidth + bodySrcollLeft) {
        // Position right
        return $rtable.scrollTo(bodySrcollLeft + tdWidth)
      }
    } else {
      // If it is virtual rendering and scrolling across lines
      if ($rtable.scrollXLoad) {
        const visibleColumn = $rtable.visibleColumn
        let scrollLeft = 0
        for (let index = 0; index < visibleColumn.length; index++) {
          if (visibleColumn[index] === column) {
            break
          }
          scrollLeft += visibleColumn[index].renderWidth
        }
        return $rtable.scrollTo(scrollLeft)
      }
    }
  }
  return Promise.resolve()
}
