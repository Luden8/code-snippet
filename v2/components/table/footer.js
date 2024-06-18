import lodash from 'lodash'
import Utils from '../tools/utils'
import DomUtils from '../tools/dom'

const cellType = 'footer'

function handleMergeFooter(mergeFooterList, _rowIndex, _columnIndex) {
  for (let mIndex = 0; mIndex < mergeFooterList.length; mIndex++) {
    const {
      row: mergeRowIndex,
      col: mergeColIndex,
      rowspan: mergeRowspan,
      colspan: mergeColspan
    } = mergeFooterList[mIndex]
    if (mergeColIndex > -1 && mergeRowIndex > -1 && mergeRowspan && mergeColspan) {
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

export default {
  name: 'RTableFooter',
  props: {
    footerData: Array,
    tableColumn: Array,
    fixedColumn: Array,
    isFixed: String,
    size: String
  },
  mounted() {
    const { $parent: $rtable, $el, $refs, isFixed } = this
    const { refsStore } = $rtable
    const prefix = `${isFixed || 'main'}-footer-`
    refsStore[`${prefix}wrapper`] = $el
    refsStore[`${prefix}table`] = $refs.table
    refsStore[`${prefix}colgroup`] = $refs.colgroup
    refsStore[`${prefix}list`] = $refs.tfoot
    refsStore[`${prefix}xSpace`] = $refs.xSpace
  },
  destroyed() {
    const { $parent: $rtable, isFixed } = this
    const { refsStore } = $rtable
    const prefix = `${isFixed || 'main'}-footer-`
    refsStore[`${prefix}wrapper`] = null
    refsStore[`${prefix}table`] = null
    refsStore[`${prefix}colgroup`] = null
    refsStore[`${prefix}list`] = null
    refsStore[`${prefix}xSpace`] = null
  },
  render(h) {
    let { tableColumn } = this
    const { _e, $parent: $rtable, isFixed, fixedColumn, footerData } = this
    const {
      $listeners: tableListeners,
      tId,
      footerRowClasses,
      footerCellClassName,
      footerRowStyles,
      footerCellStyle,
      footerAlign: allFooterAlign,
      mergeFooterList,
      footerCustomSpanFn,
      align: allAlign,
      scrollXLoad,
      columnKey,
      columnOptions,
      showFooterOverflow: allColumnFooterOverflow,
      currentColumn,
      overflowX,
      scrollbarWidth,
      tooltipOptions,
      visibleColumn,
      expandColumn
    } = $rtable
    // If you are using optimization mode
    if (isFixed) {
      // If there is an expanded row, use full rendering
      if (!expandColumn && (scrollXLoad || allColumnFooterOverflow)) {
        if (!mergeFooterList.length || !footerCustomSpanFn) {
          tableColumn = fixedColumn
        } else {
          tableColumn = visibleColumn
        }
      } else {
        tableColumn = visibleColumn
      }
    }
    // prettier-ignore
    return h(
      'div',
      {
        class: ['r4m-table--footer-wrapper', isFixed ? `fixed-${isFixed}--wrapper` : 'body--wrapper'],
        attrs: {
          xid: tId
        },
        on: {
          scroll: this.scrollEvent
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
            class: 'r4m-table--footer',
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
              tableColumn
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
             * Bottom
             */
            h(
              'tfoot',
              {
                ref: 'tfoot'
              },
              footerData.map((list, _rowIndex) => {
                const $rowIndex = _rowIndex
                const rowParams = {
                  $tableContainer: $rtable,
                  row: list,
                  _rowIndex,
                  $rowIndex,
                  fixed: isFixed,
                  type: cellType
                }
                // prettier-ignore
                return h(
                  'tr',
                  {
                    class: [
                      'r4m-table-footer--row',
                      footerRowClasses
                        ? lodash.isFunction(footerRowClasses)
                          ? footerRowClasses(rowParams)
                          : footerRowClasses
                        : ''
                    ],
                    style: footerRowStyles
                      ? lodash.isFunction(footerRowStyles)
                        ? footerRowStyles(rowParams)
                        : footerRowStyles
                      : null
                  },
                  tableColumn
                    .map((column, $columnIndex) => {
                      const { type, showFooterOverflow, footerAlign, align, footerClassName } = column
                      const showAllTip = tooltipOptions.showAll || tooltipOptions.enabled
                      const isColGroup = column.children && column.children.length
                      const fixedHiddenColumn = isFixed
                        ? column.fixed !== isFixed && !isColGroup
                        : column.fixed && overflowX
                      const footOverflow =
                        lodash.isUndefined(showFooterOverflow) || lodash.isNull(showFooterOverflow)
                          ? allColumnFooterOverflow
                          : showFooterOverflow
                      const footAlign = footerAlign || align || allFooterAlign || allAlign
                      let showEllipsis = footOverflow === 'ellipsis'
                      const showTitle = footOverflow === 'title'
                      const showTooltip = footOverflow === true || footOverflow === 'tooltip'
                      let hasEllipsis = showTitle || showTooltip || showEllipsis
                      const attrs = { colid: column.id }
                      const tfOns = {}
                      const columnIndex = $rtable.getColumnIndex(column)
                      const _columnIndex = $rtable.getVTColumnIndex(column)
                      const itemIndex = _columnIndex
                      const cellParams = {
                        $tableContainer: $rtable,
                        $gridContainer: $rtable.xegrid,
                        row: list,
                        _rowIndex,
                        $rowIndex,
                        column,
                        columnIndex,
                        $columnIndex,
                        _columnIndex,
                        itemIndex,
                        items: list,
                        fixed: isFixed,
                        type: cellType,
                        data: footerData
                      }
                      // Virtual scrolling does not support dynamic height
                      if (scrollXLoad && !hasEllipsis) {
                        showEllipsis = hasEllipsis = true
                      }
                      if (showTitle || showTooltip || showAllTip) {
                        tfOns.mouseenter = (event) => {
                          if (showTitle) {
                            DomUtils.updateCellTitle(event.currentTarget, column)
                          } else if (showTooltip || showAllTip) {
                            $rtable.triggerFooterTooltipEvent(event, cellParams)
                          }
                        }
                      }
                      if (showTooltip || showAllTip) {
                        tfOns.mouseleave = (event) => {
                          if (showTooltip || showAllTip) {
                            $rtable.handleTargetLeaveEvent(event)
                          }
                        }
                      }
                      if (tableListeners['footer-cell-click']) {
                        tfOns.click = (event) => {
                          $rtable.emitEvent(
                            'footer-cell-click',
                            Object.assign({ cell: event.currentTarget }, cellParams),
                            event
                          )
                        }
                      }
                      if (tableListeners['footer-cell-dblclick']) {
                        tfOns.dblclick = (event) => {
                          $rtable.emitEvent(
                            'footer-cell-dblclick',
                            Object.assign({ cell: event.currentTarget }, cellParams),
                            event
                          )
                        }
                      }
                      // Merge rows or columns
                      if (mergeFooterList.length) {
                        const spanRest = handleMergeFooter(mergeFooterList, _rowIndex, _columnIndex)
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
                      } else if (footercustomSpanFn) {
                        // Custom merge methods
                        const { rowspan = 1, colspan = 1 } = footercustomSpanFn(cellParams) || {}
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
                      return h(
                        'td',
                        {
                          class: [
                            'r4m-table-footer--column',
                            column.id,
                            {
                              [`col--${footAlign}`]: footAlign,
                              [`col--${type}`]: type,
                              'col--last': $columnIndex === tableColumn.length - 1,
                              'col--ellipsis': hasEllipsis,
                              'col--current': currentColumn === column,
                              'col--fixed': column.fixed
                            },
                            Utils.getClass(footerClassName, cellParams),
                            Utils.getClass(footerCellClassName, cellParams)
                          ],
                          attrs,
                          style: Object.assign({
                            left: column.fixed === 'left' ? column.renderLeft + 'px' : '',
                            right: column.fixed === 'right' ? column.renderRight + 'px' : ''
                          },
                          lodash.isFunction(footerCellStyle) ? footerCellStyle(cellParams) : footerCellStyle
                          ),
                          on: tfOns,
                          key: columnKey || columnOptions.useKey ? column.id : $columnIndex
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
                            column.footerRenderer(h, cellParams)
                          )
                        ]
                      )
                    })
                    .concat(
                      scrollbarWidth
                        ? [
                          h('td', {
                            class: 'r4m-table-footer--gutter col--gutter'
                          })
                        ]
                        : []
                    )
                )
              })
            )
          ]
        )
      ]
    )
  },
  methods: {
    /**
     * Scroll processing
     * If there is a column pinned left, the scrolling status is updated synchronously
     * If there is column pinning on the right, the scrolling status is updated synchronously
     */
    scrollEvent(event) {
      const { $parent: $rtable, isFixed } = this
      const { $refs, scrollXLoad, triggerScrollXEvent, lastScrollLeft } = $rtable
      const { tableHeader, tableBody, tableFooter, validTip } = $refs
      const headerElem = tableHeader ? tableHeader.$el : null
      const footerElem = tableFooter ? tableFooter.$el : null
      const bodyElem = tableBody.$el
      const scrollLeft = footerElem ? footerElem.scrollLeft : 0
      const isX = scrollLeft !== lastScrollLeft
      $rtable.lastScrollLeft = scrollLeft
      $rtable.lastScrollTime = Date.now()
      if (headerElem) {
        headerElem.scrollLeft = scrollLeft
      }
      if (bodyElem) {
        bodyElem.scrollLeft = scrollLeft
      }
      if (scrollXLoad && isX) {
        triggerScrollXEvent(event)
      }
      if (isX && validTip && validTip.visible) {
        validTip.updatePlacement()
      }
      $rtable.emitEvent(
        'scroll',
        { type: cellType, fixed: isFixed, scrollTop: bodyElem.scrollTop, scrollLeft, isX, isY: false },
        event
      )
    }
  }
}
