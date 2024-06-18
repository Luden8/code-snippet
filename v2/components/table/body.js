import lodash from 'lodash'
import GlobalConfigs from '../r-datatable/src/conf'
import RTable from '../r-datatable'
import Utils, { isEnableConf } from '../tools/utils'
import {
  getOffsetSize,
  calcTreeLine,
  mergeBodyMethod,
  removeScrollListener,
  restoreScrollListener,
  getRowId
} from './util'
import DomUtils from '../tools/dom'
import { getSlotVirtualNodes } from '../tools/vn'

const renderType = 'body'

// No need to trigger during scrolling and dragging
function isVMScrollProcess($rtable) {
  return $rtable._isResize || ($rtable.lastScrollTime && Date.now() < $rtable.lastScrollTime + $rtable.delayHover)
}

function renderLine(h, _vm, $rtable, params) {
  const { row, column } = params
  const { treeOptions, treeConfig, fullAllDatarowIdData } = $rtable
  const { slots, treeNode } = column
  const rowId = getRowId($rtable, row)
  const rest = fullAllDatarowIdData[rowId]
  let rLevel = 0
  let rIndex = 0
  let items = []
  if (rest) {
    rLevel = rest.level
    rIndex = rest._index
    items = rest.items
  }
  if (slots && slots.line) {
    return $rtable.callSlot(slots.line, params, h)
  }
  if (treeConfig && treeNode && (treeOptions.showLine || treeOptions.line)) {
    return [
      h(
        'div',
        {
          class: 'r-table-tree--line-wrapper'
        },
        [
          h('div', {
            class: 'r-table-tree--line',
            style: {
              height: `${calcTreeLine(params, items, rIndex)}px`,
              left: `${rLevel * treeOptions.indent + (rLevel ? 2 - getOffsetSize($rtable) : 0) + 16}px`
            }
          })
        ]
      )
    ]
  }
  return []
}

/**
 * render column
 */
function renderColumn(
  h,
  _vm,
  $rtable,
  seq,
  rowId,
  isFixed,
  rowLevel,
  row,
  rowIndex,
  $rowIndex,
  _rowIndex,
  column,
  $columnIndex,
  columns,
  items,
  localMerges
) {
  const {
    $listeners: tableListeners,
    afterfullRowsData,
    tableData,
    height,
    columnKey,
    overflowX,
    axisYOptions,
    scrollXLoad,
    virtualScrollYLoad,
    highlightCurrentRow,
    showOverflow: allColumnOverflow,
    isAllOverflow,
    align: allAlign,
    currentColumn,
    cellClassName: allCellClassName,
    cellStyle,
    mergeList,
    customSpanFn,
    radioOpts,
    selectionOptions,
    expandOpts,
    treeOptions,
    tooltipOptions,
    mouseConfig,
    editingConfig,
    editingOptions,
    editRules,
    validOpts,
    editingStore,
    tooltipConfig,
    rowOpts,
    columnOptions,
    validErrorMaps
  } = $rtable
  const { type, cellRender, editingRender, align, showOverflow, className, treeNode, slots } = column
  const { actived } = editingStore
  const { rHeight: scrollYRHeight } = axisYOptions
  const { height: rowHeight } = rowOpts
  const renderOptions = editingRender || cellRender
  const compConf = renderOptions ? RTable.renderer.get(renderOptions.name) : null
  const compCellClassName = compConf ? compConf.cellClassName : ''
  const compCellStyle = compConf ? compConf.cellStyle : ''
  const showAllTip = tooltipOptions.showAll || tooltipOptions.enabled
  const columnIndex = $rtable.getColumnIndex(column)
  const _columnIndex = $rtable.getVTColumnIndex(column)
  const isEdit = isEnableConf(editingRender)
  const cellOverflow =
    lodash.isUndefined(showOverflow) || lodash.isNull(showOverflow) ? allColumnOverflow : showOverflow
  let showEllipsis = cellOverflow === 'ellipsis'
  const showTitle = cellOverflow === 'title'
  const showTooltip = cellOverflow === true || cellOverflow === 'tooltip'
  let hasEllipsis = showTitle || showTooltip || showEllipsis
  let isDirty
  const tdOns = {}
  const cellAlign = align || allAlign
  const errorValidItem = validErrorMaps[`${rowId}:${column.id}`]
  const showValidTip =
    editRules &&
    validoptions.showMessage &&
    (validoptions.message === 'default' ? height || tableData.length > 1 : validoptions.message === 'inline')
  const attrs = { colid: column.id }
  const bindMouseenter = tableListeners['cell-mouseenter']
  const bindMouseleave = tableListeners['cell-mouseleave']
  const triggerDblclick = editingRender && editingConfig && editingOptions.trigger === 'dblclick'
  const params = {
    $tableContainer: $rtable,
    $gridContainer: $rtable.$rgrid,
    seq,
    rowId,
    row,
    rowIndex,
    $rowIndex,
    _rowIndex,
    column,
    columnIndex,
    $columnIndex,
    _columnIndex,
    fixed: isFixed,
    type: renderType,
    level: rowLevel,
    visibleData: afterfullRowsData,
    data: tableData,
    items
  }
  // Virtual scrolling does not support dynamic height!!!!
  if ((scrollXLoad || virtualScrollYLoad) && !hasEllipsis) {
    showEllipsis = hasEllipsis = true
  }
  // hover entry event
  if (showTitle || showTooltip || showAllTip || bindMouseenter || tooltipConfig) {
    tdOns.mouseenter = (event) => {
      if (isVMScrollProcess($rtable)) {
        return
      }
      if (showTitle) {
        DomUtils.updateCellTitle(event.currentTarget, column)
      } else if (showTooltip || showAllTip) {
        // If configured to display tooltip
        $rtable.triggerBodyTooltipEvent(event, params)
      }
      if (bindMouseenter) {
        $rtable.emitEvent('cell-mouseenter', Object.assign({ cell: event.currentTarget }, params), event)
      }
    }
  }
  // hover exit event
  if (showTooltip || showAllTip || bindMouseleave || tooltipConfig) {
    tdOns.mouseleave = (event) => {
      if (isVMScrollProcess($rtable)) {
        return
      }
      if (showTooltip || showAllTip) {
        $rtable.handleTargetLeaveEvent(event)
      }
      if (bindMouseleave) {
        $rtable.emitEvent('cell-mouseleave', Object.assign({ cell: event.currentTarget }, params), event)
      }
    }
  }
  // Press event handling
  if (selectionOptions.range || mouseConfig) {
    tdOns.mousedown = (event) => {
      $rtable.triggerCellMousedownEvent(event, params)
    }
  }
  // Click event handling
  if (
    rowoptions.isCurrent ||
    highlightCurrentRow ||
    tableListeners['cell-click'] ||
    (editingRender && editingConfig) ||
    expandoptions.trigger === 'row' ||
    expandoptions.trigger === 'cell' ||
    radiooptions.trigger === 'row' ||
    (column.type === 'radio' && radiooptions.trigger === 'cell') ||
    selectionOptions.trigger === 'row' ||
    (column.type === 'checkbox' && selectionOptions.trigger === 'cell') ||
    treeOptions.trigger === 'row' ||
    (column.treeNode && treeOptions.trigger === 'cell')
  ) {
    tdOns.click = (event) => {
      $rtable.triggerCellClickEvent(event, params)
    }
  }
  // Double click event handling
  if (triggerDblclick || tableListeners['cell-dblclick']) {
    tdOns.dblclick = (event) => {
      $rtable.triggerCellDblclickEvent(event, params)
    }
  }
  // Merge rows or columns
  // TODO: Dirty hardcoded logic
  if (localMerges.length > 0) {
    const spanRest = mergeBodyMethod(localMerges, _rowIndex, _columnIndex)
    if (spanRest) {
      const { rowspan, colspan } = spanRest
      if (!rowspan && !colspan) {
        return null
      }
      if (rowspan > 1) {
        attrs.rowspan = rowspan
      }
      if (colspan > 1) {
        attrs.colspan = colspan
      }
    }
  }
  if (mergeList.length) {
    const spanRest = mergeBodyMethod(mergeList, _rowIndex, _columnIndex)
    if (spanRest) {
      const { rowspan, colspan } = spanRest
      if (!rowspan || !colspan) {
        return null
      }
      if (rowspan > 1) {
        attrs.rowspan = rowspan
      }
      if (colspan > 1) {
        attrs.colspan = colspan
      }
    }
  } else if (customSpanFn) {
    // Customize how to merge rows or columns
    const { rowspan = 1, colspan = 1 } = customSpanFn(params) || {}
    if (!rowspan || !colspan) {
      return null
    }
    if (rowspan > 1) {
      attrs.rowspan = rowspan
    }
    if (colspan > 1) {
      attrs.colspan = colspan
    }
  }

  // If the edit column is turned on: eventListeners the display status
  if (editingConfig && (editingRender || cellRender) && (editingOptions.showStatus || editingOptions.showUpdateStatus)) {
    isDirty = $rtable.isUpdateByRow(row, column.value)
  }
  const tdvirtualNodes = []
  tdvirtualNodes.push(
    ...renderLine(h, _vm, $rtable, params),
    h(
      'div',
      {
        class: [
          'r4m-table-cell',
          {
            'c--title': showTitle,
            'c--tooltip': showTooltip,
            'c--ellipsis': showEllipsis
          }
        ],
        style: {
          maxHeight: hasEllipsis && (scrollYRHeight || rowHeight) ? `${scrollYRHeight || rowHeight}px` : ''
        },
        attrs: {
          title: showTitle ? $rtable.getCellLabel(row, column) : null
        }
      },
      column.cellRenderer(h, params)
    )
  )
  if (showValidTip && errorValidItem) {
    const errRule = errorValidItem.rule
    const validSlot = slots ? slots.valid : null
    const validParams = { ...params, ...errorValidItem }
    // prettier-ignore
    tdvirtualNodes.push(
      h(
        'div',
        {
          class: ['r4m-table-cell--valid-error-hint', Utils.getClass(validoptions.className, errorValidItem)],
          style:
            errRule && errRule.maxWidth
              ? {
                width: `${errRule.maxWidth}px`
              }
              : null
        },
        validSlot
          ? $rtable.callSlot(validSlot, validParams, h)
          : [
            h(
              'span',
              {
                class: 'r4m-table-cell--valid-error-msg'
              },
              errorValidItem.content
            )
          ]
      )
    )
  }
  return h(
    'td',
    {
      class: [
        'r4m-table-body--column',
        column.id,
        {
          [`col--${cellAlign}`]: cellAlign,
          [`col--${type}`]: type,
          'col--last': $columnIndex === columns.length - 1,
          'col--tree-node': treeNode,
          'col--edit': isEdit,
          'col--ellipsis': hasEllipsis,
          'col--dirty': isDirty,
          'col--fixed': column.fixed,
          'col--active':
            editingConfig && isEdit && actived.row === row && (actived.column === column || editingOptions.mode === 'row'),
          'col--valid-error': !!errorValidItem,
          'col--current': currentColumn === column
        },
        Utils.getClass(compCellClassName, params),
        Utils.getClass(className, params),
        Utils.getClass(allCellClassName, params)
      ],
      key: columnKey || columnOptions.useKey ? column.id : $columnIndex,
      attrs,
      style: Object.assign(
        {
          height: hasEllipsis && (scrollYRHeight || rowHeight) ? `${scrollYRHeight || rowHeight}px` : '',
          left: column.fixed === 'left' ? column.renderLeft + 'px' : '',
          right: column.fixed === 'right' ? column.renderRight + 'px' : ''
        },
        lodash.isFunction(compCellStyle) ? compCellStyle(params) : compCellStyle,
        lodash.isFunction(cellStyle) ? cellStyle(params) : cellStyle
      ),
      on: tdOns
    },
    tdvirtualNodes
  )
}

function renderRows(h, _vm, $rtable, isFixed, tableData, tableColumn) {
  const {
    stripe,
    rowKey,
    highlightHoverRow,
    rowClassName,
    rowStyle,
    editingConfig,
    showOverflow: allColumnOverflow,
    treeConfig,
    treeOptions,
    expandOpts,
    editingOptions,
    treeExpandedMap,
    virtualScrollYLoad,
    rowExpandedMaps,
    radioOpts,
    selectionOptions,
    expandColumn,
    hasFixedColumn,
    fullAllDatarowIdData,
    rowOpts,
    pendingRowList,
    pendingRowMaps,
    afterfullRowsData,
    hasMoreRecords
  } = $rtable
  const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
  const rows = []
  tableData.forEach((row, $rowIndex) => {
    const treventListeners = {}
    let rowIndex = $rowIndex
    const _rowIndex = $rtable.getVTRowIndex(row)
    // Runtime subtotal rows calculation
    const localMergesSet = new Set()
    const localMerges = []
    if (row.dataType === 'group-total') {
      if (!localMergesSet.has(_rowIndex)) {
        localMergesSet.add(_rowIndex)
        localMerges.push({
          row: _rowIndex,
          col: 0,
          colspan: 3,
          rowspan: 0
        })
      }
    }
    rowIndex = $rtable.getRowIndex(row)
    if (rowoptions.isHover || highlightHoverRow) {
      trOn.mouseenter = (event) => {
        if (isVMScrollProcess($rtable)) {
          return
        }
        $rtable.triggerHoverEvent(event, { row, rowIndex })
      }
      trOn.mouseleave = () => {
        if (isVMScrollProcess($rtable)) {
          return
        }
        $rtable.clearHoverRow()
      }
    }
    const rowId = getRowId($rtable, row)
    const rest = fullAllDatarowIdData[rowId]
    const rowLevel = rest ? rest.level : 0
    const seq = rest ? rest.seq : -1
    const params = {
      $tableContainer: $rtable,
      seq,
      rowId,
      fixed: isFixed,
      type: renderType,
      level: rowLevel,
      row,
      rowIndex,
      $rowIndex
    }
    // Whether the row is expanded
    const isExpandRow = expandColumn && !!rowExpandedMaps[rowId]
    // Whether the tree node is expanded
    let isExpandTree = false
    let rowChildren = []
    // Whether to add new rows
    let isNewRow = false
    if (editingConfig) {
      isNewRow = $rtable.isInsertByRow(row)
    }
    if (treeConfig && !virtualScrollYLoad && !treeOptions.transform) {
      rowChildren = row[childrenAccessField]
      isExpandTree = rowChildren && rowChildren.length && !!treeExpandedMap[rowId]
    }
    rows.push(
      h(
        'tr',
        {
          class: [
            'r4m-table-body--row',
            treeConfig ? `row--level-${rowLevel}` : '',
            {
              'row--stripe': stripe && ($rtable.getVTRowIndex(row) + 1) % 2 === 0,
              'is--new': isNewRow,
              'is--expand-row': isExpandRow,
              'is--expand-tree': isExpandTree,
              'row--new': isNewRow && (editingOptions.showStatus || editingOptions.showInsertStatus),
              'row--radio': radiooptions.highlight && $rtable.selectRadioRow === row,
              'row--selected': selectionOptions.highlight && $rtable.isSelectedByCheckboxRow(row),
              'row--pending': pendingRowList.length && !!pendingRowMaps[rowId],
              'row--group': row.dataType === 'group',
              'row--total': row.dataType === 'group-total',
              'row--highlight': row.highlight
            },
            rowClassName ? (lodash.isFunction(rowClassName) ? rowClassName(params) : rowClassName) : ''
          ],
          attrs: {
            rowId
          },
          style: rowStyle ? (lodash.isFunction(rowStyle) ? rowStyle(params) : rowStyle) : null,
          key: rowKey || rowoptions.useKey || treeConfig ? rowId : $rowIndex,
          on: trOn
        },
        tableColumn.map((column, $columnIndex) => {
          // TODO: Dirty hardcoded value to build subtotals
          if (localMergesSet.has(_rowIndex)) {
            if (column.value === 'actions' || column.type === 'checkbox') {
              return null
            }
          }

          return renderColumn(
            h,
            _vm,
            $rtable,
            seq,
            rowId,
            isFixed,
            rowLevel,
            row,
            rowIndex,
            $rowIndex,
            _rowIndex,
            column,
            $columnIndex,
            tableColumn,
            tableData,
            localMerges,
            localMergesSet
          )
        })
      )
    )
    // If the row is expanded
    if (isExpandRow) {
      const { height: expandHeight } = expandOpts
      const cellStyle = {}
      if (expandHeight) {
        cellStyle.height = `${expandHeight}px`
      }
      if (treeConfig) {
        cellStyle.paddingLeft = `${rowLevel * treeOptions.indent + 30}px`
      }
      const { showOverflow } = expandColumn
      const hasEllipsis =
        lodash.isUndefined(showOverflow) || lodash.isNull(showOverflow) ? allColumnOverflow : showOverflow
      const expandParams = {
        $tableContainer: $rtable,
        seq,
        column: expandColumn,
        fixed: isFixed,
        type: renderType,
        level: rowLevel,
        row,
        rowIndex,
        $rowIndex
      }
      rows.push(
        h(
          'tr',
          {
            class: 'r4m-table-body--expanded-row',
            key: `expand_${rowId}`,
            style: rowStyle ? (lodash.isFunction(rowStyle) ? rowStyle(expandParams) : rowStyle) : null,
            on: trOn
          },
          [
            h(
              'td',
              {
                class: {
                  'r4m-table-body--expanded-column': 1,
                  'fixed--hidden': isFixed && !hasFixedColumn,
                  'col--ellipsis': hasEllipsis
                },
                attrs: {
                  colspan: tableColumn.length
                }
              },
              [
                h(
                  'div',
                  {
                    class: {
                      'r4m-table-body--expanded-cell': 1,
                      'is--ellipsis': expandHeight
                    },
                    style: cellStyle
                  },
                  [expandColumn.renderData(h, expandParams)]
                )
              ]
            )
          ]
        )
      )
    }
    // If it is a tree table
    if (isExpandTree) {
      rows.push(...renderRows(h, _vm, $rtable, isFixed, rowChildren, tableColumn))
    }
    // Rendering loading state
    // TODO: Put this logic out of body context
    if (hasMoreRecords) {
      const treeRowIndex = $rtable.getVTRowIndex(row)
      if (afterfullRowsData.length > 0 && afterfullRowsData.length - 1 === treeRowIndex) {
        rows.push(
          h(
            'tr',
            {
              class: ['r4m-table-body--row'],
              style: rowStyle ? (lodash.isFunction(rowStyle) ? rowStyle(params) : rowStyle) : null,
              key: 'loading'
            },
            [
              h(
                'td',
                {
                  class: ['r4m-table-body--column'],
                  attrs: {
                    colspan: tableColumn.length
                  }
                },
                [
                  h(
                    'div',
                    {
                      class: 'r4m-table-body--expanded-cell'
                    },
                    [
                      h(
                        'div',
                        {
                          class: 'r4m-table-loader'
                        },
                        [
                          h('div', {
                            class: 'r4m-t-icon-loader roll r4m-table-loading--default-icon'
                          })
                        ]
                      )
                    ]
                  )
                ]
              )
            ]
          )
        )
      }
    }
  })
  return rows
}

/**
 * Synchronized scroll bars
 */
let scrollProcessTimeout
function syncBodyScroll(_vm, isFixed, scrollTop, elem1, elem2) {
  if (elem1 || elem2) {
    if (elem1) {
      removeScrollListener(elem1)
      elem1.scrollTop = scrollTop
    }
    if (elem2) {
      removeScrollListener(elem2)
      elem2.scrollTop = scrollTop
    }
    clearTimeout(scrollProcessTimeout)
    scrollProcessTimeout = setTimeout(() => {
      // const { tableBody, leftBody, rightBody } = _vm.$refs
      // const bodyElem = tableBody.$el
      // const leftElem = leftBody ? leftBody.$el : null
      // const rightElem = rightBody ? rightBody.$el : null
      restoreScrollListener(elem1)
      restoreScrollListener(elem2)
      // Check that the scroll bars are synchronized
      // let targetTop = bodyElem.scrollTop
      // if (isFixed === 'left') {
      //   if (leftElem) {
      //     targetTop = leftElem.scrollTop
      //   }
      // } else if (isFixed === 'right') {
      //   if (rightElem) {
      //     targetTop = rightElem.scrollTop
      //   }
      // }
      // setScrollTop(bodyElem, targetTop)
      // setScrollTop(leftElem, targetTop)
      // setScrollTop(rightElem, targetTop)
    }, 300)
  }
}

export default {
  name: 'RTableBody',
  props: {
    tableData: Array,
    tableColumn: Array,
    fixedColumn: Array,
    size: String,
    isFixed: String
  },
  data() {
    return {
      wheelTime: null,
      wheelYSize: 0,
      wheelYInterval: 0,
      wheelYTotal: 0
    }
  },
  mounted() {
    const { $parent: $rtable, $el, $refs, isFixed } = this
    const { refsStore } = $rtable
    const prefix = `${isFixed || 'main'}-body-`
    refsStore[`${prefix}wrapper`] = $el
    refsStore[`${prefix}table`] = $refs.table
    refsStore[`${prefix}colgroup`] = $refs.colgroup
    refsStore[`${prefix}list`] = $refs.tbody
    refsStore[`${prefix}xSpace`] = $refs.xSpace
    refsStore[`${prefix}ySpace`] = $refs.ySpace
    refsStore[`${prefix}emptyBlock`] = $refs.emptyBlock
    if (this.$el) {
      this.$el.onscroll = this.scrollEvent
      this.$el._onscroll = this.scrollEvent
    }
  },
  beforeDestroy() {
    clearTimeout(this.wheelTime)
    if (this.$el) {
      this.$el._onscroll = null
      this.$el.onscroll = null
    }
  },
  destroyed() {
    const { $parent: $rtable, isFixed } = this
    const { refsStore } = $rtable
    const prefix = `${isFixed || 'main'}-body-`
    refsStore[`${prefix}wrapper`] = null
    refsStore[`${prefix}table`] = null
    refsStore[`${prefix}colgroup`] = null
    refsStore[`${prefix}list`] = null
    refsStore[`${prefix}xSpace`] = null
    refsStore[`${prefix}ySpace`] = null
    refsStore[`${prefix}emptyBlock`] = null
  },
  render(h) {
    const { _e, $parent: $rtable, fixedColumn, isFixed } = this
    let { tableColumn } = $rtable
    const {
      $scopedSlots,
      tId,
      tableData,
      visibleColumn,
      expandColumn,
      showOverflow: allColumnOverflow,
      keyboardConfig,
      keyboardOpts,
      mergeList,
      customSpanFn,
      scrollXLoad,
      virtualScrollYLoad,
      isAllOverflow,
      emptyOpts,
      mouseConfig,
      mouseOpts,
      axisYOptions
    } = $rtable
    // If you are using optimization mode
    if (isFixed) {
      // If there is an expanded row, use full rendering
      if (!expandColumn && (scrollXLoad || virtualScrollYLoad || (allColumnOverflow ? isAllOverflow : allColumnOverflow))) {
        if (!mergeList.length && !customSpanFn && !(keyboardConfig && keyboardoptions.isMerge)) {
          tableColumn = fixedColumn
        } else {
          tableColumn = visibleColumn
          // Check whether fixed columns are merged and whether the merge range exceeds fixed columns
          // if (mergeList.length && !isMergeLeftFixedExceeded && isFixed === 'left') {
          //   tableColumn = fixedColumn
          // } else if (mergeList.length && !isMergeRightFixedExceeded && isFixed === 'right') {
          //   tableColumn = fixedColumn
          // } else {
          //   tableColumn = visibleColumn
          // }
        }
      } else {
        tableColumn = visibleColumn
      }
    }
    let emptyContent
    if ($scopedSlots.empty) {
      emptyContent = $scopedSlots.empty.call(this, { $tableContainer: $rtable }, h)
    } else {
      const compConf = emptyoptions.name ? RTable.renderer.get(emptyoptions.name) : null
      const renderEmpty = compConf ? compConf.renderEmpty : null
      if (renderEmpty) {
        emptyContent = getSlotVirtualNodes(renderEmpty.call(this, h, emptyOpts, { $tableContainer: $rtable }))
      } else {
        emptyContent = $rtable.emptyText || GlobalConfigs.i18n('rtable.table.emptyText')
      }
    }
    // prettier-ignore
    return h(
      'div',
      {
        class: ['r4m-table--body-wrapper', isFixed ? `fixed-${isFixed}--wrapper` : 'body--wrapper'],
        attrs: {
          xid: tId
        },
        on:
          virtualScrollYLoad && axisYOptions.mode === 'wheel'
            ? {
              wheel: this.wheelEvent
            }
            : {}
      },
      [
        isFixed
          ? _e()
          : h('div', {
            class: 'r4m-table-body--x-space',
            ref: 'xSpace'
          }),
        h('div', {
          class: 'r4m-table-body--y-space',
          ref: 'ySpace'
        }),
        h(
          'table',
          {
            class: 'r4m-table--body',
            attrs: {
              xid: tId,
              cellspacing: 0,
              cellpadding: 0,
              border: 0
            },
            ref: 'table'
          },
          [
            /**
             * column width
             */
            h(
              'colgroup',
              {
                ref: 'colgroup'
              },
              tableColumn.map((column, $columnIndex) => {
                return h('col', {
                  attrs: {
                    name: column.id
                  },
                  key: $columnIndex
                })
              })
            ),
            /**
             * tbody
             */
            h(
              'tbody',
              {
                ref: 'tbody'
              },
              renderRows(h, this, $rtable, isFixed, tableData, tableColumn)
            )
          ]
        ),
        h('div', {
          class: 'r4m-table--checkbox-range'
        }),
        mouseConfig && mouseoptions.area
          ? h(
            'div',
            {
              class: 'r4m-table--cell-area'
            },
            [
              h(
                'span',
                {
                  class: 'r4m-table--cell-main-area'
                },
                mouseoptions.extension
                  ? [
                    h('span', {
                      class: 'r4m-table--cell-main-area-btn',
                      on: {
                        mousedown(event) {
                          $rtable.triggerCellExtendMousedownEvent(event, {
                            $tableContainer: $rtable,
                            fixed: isFixed,
                            type: renderType
                          })
                        }
                      }
                    })
                  ]
                  : null
              ),
              h('span', {
                class: 'r4m-table--cell-copy-area'
              }),
              h('span', {
                class: 'r4m-table--cell-extend-area'
              }),
              h('span', {
                class: 'r4m-table--cell-multi-area'
              }),
              h('span', {
                class: 'r4m-table--cell-active-area'
              })
            ]
          )
          : null,
        !isFixed
          ? h(
            'div',
            {
              class: 'r4m-table--empty-block',
              ref: 'emptyBlock'
            },
            [
              h(
                'div',
                {
                  class: 'r4m-table--empty-content'
                },
                emptyContent
              )
            ]
          )
          : null
      ]
    )
  },
  methods: {
    scrollEvent(event) {
      const { $el: scrollBodyElem, $parent: $rtable, isFixed } = this
      const {
        $refs,
        refsStore,
        highlightHoverRow,
        scrollXLoad,
        virtualScrollYLoad,
        lastScrollTop,
        lastScrollLeft,
        rowOpts,
        customHeight,
        scrollYState,
        loading
      } = $rtable
      const { tableHeader, tableBody, leftBody, rightBody, tableFooter, validTip } = $refs
      const headerElem = tableHeader ? tableHeader.$el : null
      const footerElem = tableFooter ? tableFooter.$el : null
      const bodyElem = tableBody.$el
      const leftElem = leftBody ? leftBody.$el : null
      const rightElem = rightBody ? rightBody.$el : null
      const bodyYElem = refsStore['main-body-ySpace']
      const bodyXElem = refsStore['main-body-xSpace']
      const bodyHeight = virtualScrollYLoad && bodyYElem ? bodyYElem.clientHeight : bodyElem.clientHeight
      const bodyWidth = scrollXLoad && bodyXElem ? bodyXElem.clientWidth : bodyElem.clientWidth
      let scrollTop = scrollBodyElem.scrollTop
      const scrollLeft = bodyElem.scrollLeft
      const isRollX = scrollLeft !== lastScrollLeft
      const isRollY = scrollTop !== lastScrollTop
      $rtable.lastScrollTop = scrollTop
      $rtable.lastScrollLeft = scrollLeft
      $rtable.lastScrollTime = Date.now()
      if (rowoptions.isHover || highlightHoverRow) {
        $rtable.clearHoverRow()
      }
      // TODO: get rid of this
      if (leftElem && isFixed === 'left') {
        scrollTop = leftElem.scrollTop
        syncBodyScroll($rtable, isFixed, scrollTop, bodyElem, rightElem)
      } else if (rightElem && isFixed === 'right') {
        scrollTop = rightElem.scrollTop
        syncBodyScroll($rtable, isFixed, scrollTop, bodyElem, leftElem)
      } else {
        if (isRollX) {
          if (headerElem) {
            headerElem.scrollLeft = bodyElem.scrollLeft
          }
          if (footerElem) {
            footerElem.scrollLeft = bodyElem.scrollLeft
          }
        }
        if (leftElem || rightElem) {
          $rtable.checkScrolling()
          if (isRollY) {
            syncBodyScroll($rtable, isFixed, scrollTop, leftElem, rightElem)
          }
        }
      }
      if (scrollXLoad && isRollX) {
        $rtable.triggerScrollXEvent(event)
      }
      if (virtualScrollYLoad && isRollY) {
        $rtable.triggerScrollYEvent(event)
      }
      if (isRollX && validTip && validTip.visible) {
        validTip.updatePlacement()
      }
      $rtable.emitEvent(
        'scroll',
        {
          type: renderType,
          fixed: isFixed,
          scrollTop,
          scrollLeft,
          scrollHeight: bodyElem.scrollHeight,
          scrollWidth: bodyElem.scrollWidth,
          bodyHeight,
          bodyWidth,
          isX: isRollX,
          isY: isRollY
        },
        event
      )
    },
    handleWheel(event, isTopWheel, deltaTop, isRollX, isRollY) {
      const { $parent: $rtable } = this
      const { $refs, refsStore, virtualScrollYLoad, scrollXLoad } = $rtable
      const { tableBody, leftBody, rightBody } = $refs
      const bodyElem = tableBody.$el
      const leftElem = leftBody ? leftBody.$el : null
      const rightElem = rightBody ? rightBody.$el : null
      const remainSize = this.isPrevWheelTop === isTopWheel ? Math.max(0, this.wheelYSize - this.wheelYTotal) : 0
      const bodyYElem = refsStore['main-body-ySpace']
      const bodyXElem = refsStore['main-body-xSpace']
      const bodyHeight = virtualScrollYLoad && bodyYElem ? bodyYElem.clientHeight : bodyElem.clientHeight
      const bodyWidth = scrollXLoad && bodyXElem ? bodyXElem.clientWidth : bodyElem.clientWidth
      this.isPrevWheelTop = isTopWheel
      this.wheelYSize = Math.abs(isTopWheel ? deltaTop - remainSize : deltaTop + remainSize)
      this.wheelYInterval = 0
      this.wheelYTotal = 0
      clearTimeout(this.wheelTime)
      const handleSmooth = () => {
        let { wheelYTotal, wheelYInterval } = this
        const { isFixed, wheelYSize } = this
        if (wheelYTotal < wheelYSize) {
          wheelYInterval = Math.max(5, Math.floor(wheelYInterval * 1.5))
          wheelYTotal = wheelYTotal + wheelYInterval
          if (wheelYTotal > wheelYSize) {
            wheelYInterval = wheelYInterval - (wheelYTotal - wheelYSize)
          }
          const { scrollTop, clientHeight, scrollHeight } = bodyElem
          const targetTop = scrollTop + wheelYInterval * (isTopWheel ? -1 : 1)
          bodyElem.scrollTop = targetTop
          if (leftElem) {
            leftElem.scrollTop = targetTop
          }
          if (rightElem) {
            rightElem.scrollTop = targetTop
          }
          if (isTopWheel ? targetTop < scrollHeight - clientHeight : targetTop >= 0) {
            this.wheelTime = setTimeout(handleSmooth, 10)
          }
          this.wheelYTotal = wheelYTotal
          this.wheelYInterval = wheelYInterval
          $rtable.emitEvent(
            'scroll',
            {
              type: renderType,
              fixed: isFixed,
              scrollTop: bodyElem.scrollTop,
              scrollLeft: bodyElem.scrollLeft,
              scrollHeight: bodyElem.scrollHeight,
              scrollWidth: bodyElem.scrollWidth,
              bodyHeight,
              bodyWidth,
              isX: isRollX,
              isY: isRollY
            },
            event
          )
        }
      }
      handleSmooth()
    },

    wheelEvent(event) {
      const { deltaY, deltaX } = event
      const { $el: scrollBodyElem, $parent: $rtable } = this
      const { $refs, highlightHoverRow, virtualScrollYLoad, lastScrollTop, lastScrollLeft, rowOpts } = $rtable
      const { tableBody } = $refs
      const bodyElem = tableBody.$el

      const deltaTop = deltaY
      const deltaLeft = deltaX
      const isTopWheel = deltaTop < 0
      if (
        isTopWheel
          ? scrollBodyElem.scrollTop <= 0
          : scrollBodyElem.scrollTop >= scrollBodyElem.scrollHeight - scrollBodyElem.clientHeight
      ) {
        return
      }

      const scrollTop = scrollBodyElem.scrollTop + deltaTop
      const scrollLeft = bodyElem.scrollLeft + deltaLeft
      const isRollX = scrollLeft !== lastScrollLeft
      const isRollY = scrollTop !== lastScrollTop

      if (isRollY) {
        event.preventDefault()
        $rtable.lastScrollTop = scrollTop
        $rtable.lastScrollLeft = scrollLeft
        $rtable.lastScrollTime = Date.now()
        if (rowoptions.isHover || highlightHoverRow) {
          $rtable.clearHoverRow()
        }
        this.handleWheel(event, isTopWheel, deltaTop, isRollX, isRollY)
        if (virtualScrollYLoad) {
          $rtable.triggerScrollYEvent(event)
        }
      }
    }
  }
}
