import lodash from 'lodash'
import Utils from '../tools/utils'
import DomUtils from '../tools/dom'
import { convertHeaderColumnToRows, getColReMinWidth } from './util'

const cellType = 'header'

export default {
  name: 'RTableHeader',
  props: {
    tableData: Array,
    tableColumn: Array,
    tableGroupColumn: Array,
    fixedColumn: Array,
    size: String,
    isFixed: String
  },
  data() {
    return {
      headerColumn: []
    }
  },
  watch: {
    tableColumn() {
      this.uploadColumn()
    }
  },
  created() {
    this.uploadColumn()
  },
  mounted() {
    const { $parent: $rtable, $el, $refs, isFixed } = this
    const { refsStore } = $rtable
    const prefix = `${isFixed || 'main'}-header-`
    refsStore[`${prefix}wrapper`] = $el
    refsStore[`${prefix}table`] = $refs.table
    refsStore[`${prefix}colgroup`] = $refs.colgroup
    refsStore[`${prefix}list`] = $refs.thead
    refsStore[`${prefix}xSpace`] = $refs.xSpace
    refsStore[`${prefix}repair`] = $refs.repair
  },
  destroyed() {
    const { $parent: $rtable, isFixed } = this
    const { refsStore } = $rtable
    const prefix = `${isFixed || 'main'}-header-`
    refsStore[`${prefix}wrapper`] = null
    refsStore[`${prefix}table`] = null
    refsStore[`${prefix}colgroup`] = null
    refsStore[`${prefix}list`] = null
    refsStore[`${prefix}xSpace`] = null
    refsStore[`${prefix}repair`] = null
  },
  render(h) {
    const { _e, $parent: $rtable, isFixed, headerColumn, tableColumn, fixedColumn } = this
    const {
      $listeners: tableListeners,
      tId,
      isGroup,
      visibleColumn,
      resizable,
      border,
      columnKey,
      headerRowClassName,
      headerCellClassName,
      headerRowStyle,
      headerCellStyle,
      showHeaderOverflow: columnHeaderOverflow,
      headerAlign: allHeaderAlign,
      align: allAlign,
      highlightCurrentColumn,
      currentColumn,
      scrollXLoad,
      overflowX,
      scrollbarWidth,
      sortOpts,
      mouseConfig,
      columnOptions
    } = $rtable
    let headerGroups = headerColumn
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
      headerGroups = [renderColumnList]
    }
    // prettier-ignore
    return h(
      'div',
      {
        class: ['r4m-table--header-wrapper', isFixed ? `fixed-${isFixed}--wrapper` : 'body--wrapper'],
        attrs: {
          xid: tId
        }
      },
      [
        isFixed
          ? _e()
          : h('div', {
            class: 'r4m-table-body--x-space',
            ref: 'xSpace'
          }),
        h(
          'table',
          {
            class: 'r4m-table--header',
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
             * Column width
             */
            // prettier-ignore
            h(
              'colgroup',
              {
                ref: 'colgroup'
              },
              renderColumnList
                .map((column, $columnIndex) => {
                  return h('col', {
                    attrs: {
                      name: column.id
                    },
                    key: $columnIndex
                  })
                })
                .concat(
                  scrollbarWidth
                    ? [
                      h('col', {
                        attrs: {
                          name: 'col_gutter'
                        }
                      })
                    ]
                    : []
                )
            ),
            /**
             * Head
             */
            h(
              'thead',
              {
                ref: 'thead'
              },
              headerGroups.map((cols, $rowIndex) => {
                return h(
                  'tr',
                  {
                    class: [
                      'r4m-table-header--row',
                      headerRowClassName
                        ? lodash.isFunction(headerRowClassName)
                          ? headerRowClassName({ $tableContainer: $rtable, $rowIndex, fixed: isFixed, type: cellType })
                          : headerRowClassName
                        : ''
                    ],
                    style: headerRowStyle
                      ? lodash.isFunction(headerRowStyle)
                        ? headerRowStyle({ $tableContainer: $rtable, $rowIndex, fixed: isFixed, type: cellType })
                        : headerRowStyle
                      : null
                  },
                  cols
                    .map((column, $columnIndex) => {
                      const { type, showHeaderOverflow, headerAlign, align, headerClassName } = column
                      // const { enabled } = tooltipOptions
                      const isColGroup = column.children && column.children.length
                      const headOverflow =
                        lodash.isUndefined(showHeaderOverflow) || lodash.isNull(showHeaderOverflow)
                          ? columnHeaderOverflow
                          : showHeaderOverflow
                      const headAlign = headerAlign || align || allHeaderAlign || allAlign
                      let showEllipsis = headOverflow === 'ellipsis'
                      const showTitle = headOverflow === 'title'
                      const showTooltip = headOverflow === true || headOverflow === 'tooltip'
                      let hasEllipsis = showTitle || showTooltip || showEllipsis
                      const thOns = {}
                      const hasFilter = column.filters && column.filters.some((item) => item.selected)
                      const columnIndex = $rtable.getColumnIndex(column)
                      const _columnIndex = $rtable.getVTColumnIndex(column)
                      const params = {
                        $tableContainer: $rtable,
                        $gridContainer: $rtable.xegrid,
                        $rowIndex,
                        column,
                        columnIndex,
                        $columnIndex,
                        _columnIndex,
                        fixed: isFixed,
                        type: cellType,
                        hasFilter
                      }
                      // Virtual scrolling does not support dynamic height
                      if (scrollXLoad && !hasEllipsis) {
                        showEllipsis = hasEllipsis = true
                      }
                      if (
                        columnOptions.isCurrent ||
                        highlightCurrentColumn ||
                        tableListeners['header-cell-click'] ||
                        sortoptions.trigger === 'cell'
                      ) {
                        thOns.click = (event) => $rtable.triggerHeaderCellClickEvent(event, params)
                      }
                      if (tableListeners['header-cell-dblclick']) {
                        thOns.dblclick = (event) => $rtable.triggerHeaderCellDblclickEvent(event, params)
                      }
                      // mouse onpress event handling
                      if (mouseConfig) {
                        thOns.mousedown = (event) => $rtable.triggerHeaderCellMousedownEvent(event, params)
                      }
                      return h(
                        'th',
                        {
                          class: [
                            'r4m-table-header--column',
                            column.id,
                            {
                              [`col--${headAlign}`]: headAlign,
                              [`col--${type}`]: type,
                              'col--last': $columnIndex === cols.length - 1,
                              'col--fixed': column.fixed,
                              'col--group': isColGroup,
                              'col--ellipsis': hasEllipsis,
                              'is--sortable': column.sortable,
                              'col--filter': !!column.filters,
                              'is--filter-active': hasFilter,
                              'is--sort-active': column.order,
                              'col--current': currentColumn === column
                            },
                            Utils.getClass(headerClassName, params),
                            Utils.getClass(headerCellClassName, params)
                          ],
                          attrs: {
                            colid: column.id,
                            colspan: column.colSpan > 1 ? column.colSpan : null,
                            rowspan: column.rowSpan > 1 ? column.rowSpan : null
                          },
                          style: Object.assign({
                            left: column.fixed === 'left' ? column.renderLeft + 'px' : '',
                            right: column.fixed === 'right' ? column.renderRight + 'px' : ''
                          },
                          lodash.isFunction(headerCellStyle) ? headerCellStyle(params) : headerCellStyle
                          ),
                          on: thOns,
                          key: columnKey || columnOptions.useKey || isColGroup ? column.id : $columnIndex
                        },
                        [
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
                              ]
                            },
                            column.headerRenderer(h, params)
                          ),
                          /**
                           * Drag the column width
                           */
                          // prettier-ignore
                          !isColGroup &&
                          (lodash.isBoolean(column.resizable) ? column.resizable : columnOptions.resizable || resizable)
                            ? h('div', {
                              class: [
                                'r4m-table-resizable',
                                {
                                  'is--line': true
                                }
                              ],
                              on: {
                                mousedown: (event) => this.resizeMousedown(event, params)
                              }
                            })
                            : null
                        ]
                      )
                    })
                    .concat(
                      scrollbarWidth
                        ? [
                          h('th', {
                            class: 'r4m-table-header--gutter col--gutter'
                          })
                        ]
                        : []
                    )
                )
              })
            )
          ]
        ),
        /**
         * Other
         */
        h('div', {
          class: 'r4m-table--header-border-line',
          ref: 'repair'
        })
      ]
    )
  },
  methods: {
    uploadColumn() {
      const { $parent: $rtable } = this
      this.headerColumn = $rtable.isGroup ? convertHeaderColumnToRows(this.tableGroupColumn) : []
    },
    resizeMousedown(event, params) {
      const { column } = params
      const { $parent: $rtable, $el, isFixed } = this
      const { tableBody, leftContainer, rightContainer, resizeBar: resizeBarElem } = $rtable.$refs
      const { target: dragBtnElem, clientX: dragClientX } = event
      const cell = (params.cell = dragBtnElem.parentNode)
      let dragLeft = 0
      const tableBodyEl = tableBody.$el
      const pos = DomUtils.getOffsetPos(dragBtnElem, $el)
      const dragBtnWidth = dragBtnElem.clientWidth
      const dragBtnOffsetWidth = Math.floor(dragBtnWidth / 2)
      const minInterval = getColReMinWidth(params) - dragBtnOffsetWidth // The minimum spacing between columns
      let dragMinLeft = pos.left - cell.clientWidth + dragBtnWidth + minInterval
      let dragPosLeft = pos.left + dragBtnOffsetWidth
      const domMousemove = document.onmousemove
      const domMouseup = document.onmouseup
      const isLeftFixed = isFixed === 'left'
      const isRightFixed = isFixed === 'right'

      // Calculate the left and right fixed column offsets
      let fixedOffsetWidth = 0
      if (isLeftFixed || isRightFixed) {
        const siblingProp = isLeftFixed ? 'nextElementSibling' : 'previousElementSibling'
        let tempCellElem = cell[siblingProp]
        while (tempCellElem) {
          if (DomUtils.hasClass(tempCellElem, 'fixed--hidden')) {
            break
          } else if (!DomUtils.hasClass(tempCellElem, 'col--group')) {
            fixedOffsetWidth += tempCellElem.offsetWidth
          }
          tempCellElem = tempCellElem[siblingProp]
        }
        if (isRightFixed && rightContainer) {
          dragPosLeft = rightContainer.offsetLeft + fixedOffsetWidth
        }
      }

      // Handle drag events
      const updateEvent = function (event) {
        event.stopPropagation()
        event.preventDefault()
        const offsetX = event.clientX - dragClientX
        let left = dragPosLeft + offsetX
        const scrollLeft = isFixed ? 0 : tableBodyEl.scrollLeft
        if (isLeftFixed) {
          // Left pinned column (no more than the right pinned column, no more than the right margin.)）
          left = Math.min(
            left,
            (rightContainer ? rightContainer.offsetLeft : tableBodyEl.clientWidth) - fixedOffsetWidth - minInterval
          )
        } else if (isRightFixed) {
          // Right fixed column (no more than the left fixed column, no more than the left margin.）
          dragMinLeft = (leftContainer ? leftContainer.clientWidth : 0) + fixedOffsetWidth + minInterval
          left = Math.min(left, dragPosLeft + cell.clientWidth - minInterval)
        } else {
          dragMinLeft = Math.max(tableBodyEl.scrollLeft, dragMinLeft)
          // left = Math.min(left, tableBodyEl.clientWidth + tableBodyEl.scrollLeft - 40)
        }
        dragLeft = Math.max(left, dragMinLeft)
        resizeBarElem.style.left = `${dragLeft - scrollLeft}px`
      }

      $rtable._isResize = true
      DomUtils.addClass($rtable.$el, 'drag--resize')
      resizeBarElem.style.display = 'block'
      document.onmousemove = updateEvent
      document.onmouseup = function (event) {
        document.onmousemove = domMousemove
        document.onmouseup = domMouseup
        const resizeWidth = column.renderWidth + (isRightFixed ? dragPosLeft - dragLeft : dragLeft - dragPosLeft)
        column.resizeWidth = resizeWidth
        resizeBarElem.style.display = 'none'
        $rtable._isResize = false
        $rtable._lastResizeTime = Date.now()
        $rtable.analyColumnWidth()
        $rtable.recalculate(true).then(() => {
          $rtable.saveCustomResizable()
          $rtable.updateCellAreas()
          $rtable.emitEvent('resizable-change', { ...params, resizeWidth }, event)
        })
        DomUtils.removeClass($rtable.$el, 'drag--resize')
      }
      updateEvent(event)
      $rtable.closeMenu()
    }
  }
}
