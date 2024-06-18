import lodash from 'lodash'
import GlobalConfigs from '../r-datatable/src/conf'
import RTable from '../r-datatable'
import DomUtils from '../tools/dom'
import Utils, { eqEmptyValue, isEnableConf, getFuncText } from '../tools/utils'
import { getRowId, getColumnConfig } from './util'
import { getSlotVirtualNodes } from '../tools/vn'

function toggleSort(value) {
  const values = ['desc', 'asc', null]
  const nextIndex = (values.indexOf(value) + 1) % values.length
  return values[nextIndex]
}

function renderTitlePrefixIcon(h, params) {
  const { $tableContainer, column } = params
  const titlePrefix = column.titlePrefix || column.titleHelp
  // prettier-ignore
  return titlePrefix
    ? [
      h('i', {
        class: ['r4m-table-cell-title-prefix-icon', titlePrefix.icon || GlobalConfigs.icon.TABLE_TITLE_PREFIX],
        on: {
          mouseenter(event) {
            $tableContainer.triggerheaderColumnTitleEvent(event, titlePrefix, params)
          },
          mouseleave(event) {
            $tableContainer.handleTargetLeaveEvent(event)
          }
        }
      })
    ]
    : []
}

function renderTitleSuffixIcon(h, params) {
  const { $tableContainer, column } = params
  const titleSuffix = column.titleSuffix
  // prettier-ignore
  return titleSuffix
    ? [
      h('i', {
        class: ['r4m-table-cell-title-suffix-icon', titleSuffix.icon || GlobalConfigs.icon.TABLE_TITLE_SUFFIX],
        on: {
          mouseenter(event) {
            $tableContainer.triggerheaderColumnTitleEvent(event, titleSuffix, params)
          },
          mouseleave(event) {
            $tableContainer.handleTargetLeaveEvent(event)
          }
        }
      })
    ]
    : []
}

function renderTitleContent(h, params, content) {
  const { $tableContainer, column } = params
  const { type, showHeaderOverflow } = column
  const { showHeaderOverflow: columnHeaderOverflow, tooltipOptions } = $tableContainer
  const showAllTip = tooltipOptions.showAll || tooltipOptions.enabled
  const headOverflow =
    lodash.isUndefined(showHeaderOverflow) || lodash.isNull(showHeaderOverflow)
      ? columnHeaderOverflow
      : showHeaderOverflow
  const showTitle = headOverflow === 'title'
  const showTooltip = headOverflow === true || headOverflow === 'tooltip'
  const eventListeners = {}
  if (showTitle || showTooltip || showAllTip) {
    ons.mouseenter = (event) => {
      if ($tableContainer._isResize) {
        return
      }
      if (showTitle) {
        DomUtils.updateCellTitle(event.currentTarget, column)
      } else if (showTooltip || showAllTip) {
        $tableContainer.triggerHeaderTooltipEvent(event, params)
      }
    }
  }
  if (showTooltip || showAllTip) {
    ons.mouseleave = (event) => {
      if ($tableContainer._isResize) {
        return
      }
      if (showTooltip || showAllTip) {
        $tableContainer.handleTargetLeaveEvent(event)
      }
    }
  }
  // prettier-ignore
  return [
    type === 'html' && lodash.isString(content)
      ? h('span', {
        class: 'r4m-table-cell--title',
        domProps: {
          innerHTML: content
        },
        on: eventListeners
      })
      : h(
        'span',
        {
          class: 'r4m-table-cell--title',
          on: eventListeners
        },
        getSlotVirtualNodes(content)
      )
  ]
}

function getFooterSlot(h, params) {
  const { $tableContainer, column, _columnIndex, row, items } = params
  const { slots, editingRender, cellRender } = column
  const renderOptions = editingRender || cellRender
  if (slots && slots.footer) {
    return $tableContainer.callSlot(slots.footer, params, h)
  }
  if (renderOptions) {
    const compConf = RTable.renderer.get(renderOptions.name)
    if (compConf && compConf.footerRenderer) {
      return getSlotVirtualNodes(compConf.footerRenderer.call($tableContainer, h, renderOptions, params))
    }
  }
  // Compatible with old models
  if (lodash.isArray(items)) {
    return [Utils.format(items[_columnIndex], 1)]
  }
  return [Utils.format(lodash.get(row, column.value), 1)]
}

function getDefaultCellLabel(params) {
  const { $tableContainer, row, column } = params
  return Utils.format($tableContainer.getCellLabel(row, column), 1)
}

export const Cell = {
  makeColumn($rtable, _vm) {
    const { type, sortable, remoteSort, filters, editingRender, treeNode } = _vm
    const { editingConfig, editingOptions, selectionOptions } = $rtable
    const renMaps = {
      headerRenderer: this.defaultTableHeaderRenderer,
      cellRenderer: treeNode ? this.renderTreeCell : this.defaultTableCellRenderer,
      footerRenderer: this.defaultFooterRenderer
    }
    switch (type) {
      case 'seq':
        renMaps.headerRenderer = this.sequenceHeaderRenderFn
        renMaps.cellRenderer = treeNode ? this.treeIndexCellRenderFn : this.sequenceCellRenderer
        break
      case 'radio':
        renMaps.headerRenderer = this.renderRadioHeader
        renMaps.cellRenderer = treeNode ? this.treeradioCellRendererRenderer : this.renderradioCellRenderer
        break
      case 'checkbox':
        renMaps.headerRenderer = this.selectionHeaderRenderer
        renMaps.cellRenderer = selectionOptions.checkField
          ? treeNode
            ? this.renderTreeSelectionCellByProp
            : this.renderCheckboxCellByProp
          : treeNode
            ? this.renderTreeSelectionCell
            : this.renderCheckboxCell
        break
      case 'expand':
        renMaps.cellRenderer = this.expandCellRenderer
        renMaps.renderData = this.renderExpandData
        break
      case 'html':
        renMaps.cellRenderer = treeNode ? this.renderTreeHTMLCell : this.renderHTMLCell
        if (filters && (sortable || remoteSort)) {
          renMaps.headerRenderer = this.renderSortAndFilterHeader
        } else if (sortable || remoteSort) {
          renMaps.headerRenderer = this.renderSortHeader
        } else if (filters) {
          renMaps.headerRenderer = this.renderFilterHeader
        }
        break
      default:
        if (editingConfig && editingRender) {
          renMaps.headerRenderer = this.renderEditHeader
          renMaps.cellRenderer =
            editingOptions.mode === 'cell'
              ? treeNode
                ? this.renderTreeCellEdit
                : this.cellRendererEdit
              : treeNode
                ? this.renderTreeRowEdit
                : this.renderRowEdit
        } else if (filters && (sortable || remoteSort)) {
          renMaps.headerRenderer = this.renderSortAndFilterHeader
        } else if (sortable || remoteSort) {
          renMaps.headerRenderer = this.renderSortHeader
        } else if (filters) {
          renMaps.headerRenderer = this.renderFilterHeader
        }
    }
    return getColumnConfig($rtable, _vm, renMaps)
  },
  /**
   * Cell
   */
  headerRendererTitle(h, params) {
    const { $tableContainer, column } = params
    const { slots, editingRender, cellRender } = column
    const renderOptions = editingRender || cellRender
    if (slots && slots.header) {
      return renderTitleContent(h, params, $tableContainer.callSlot(slots.header, params, h))
    }
    if (renderOptions) {
      const compConf = RTable.renderer.get(renderOptions.name)
      if (compConf && compConf.headerRenderer) {
        return getSlotVirtualNodes(renderTitleContent(h, params, compConf.headerRenderer.call($tableContainer, h, renderOptions, params)))
      }
    }
    return renderTitleContent(h, params, Utils.format(column.getLabel(), 1))
  },
  defaultTableHeaderRenderer(h, params) {
    return renderTitlePrefixIcon(h, params)
      .concat(Cell.headerRendererTitle(h, params))
      .concat(renderTitleSuffixIcon(h, params))
  },
  defaultTableCellRenderer(h, params) {
    const { $tableContainer, row, column } = params
    const { slots, editingRender, cellRender } = column
    const renderOptions = editingRender || cellRender
    if (slots && slots.default) {
      return $tableContainer.callSlot(slots.default, params, h)
    }
    if (renderOptions) {
      const funName = editingRender ? 'cellRenderer' : 'renderDefault'
      const compConf = RTable.renderer.get(renderOptions.name)
      if (compConf && compConf[funName]) {
        return getSlotVirtualNodes(
          compConf[funName].call($tableContainer, h, renderOptions, Object.assign({ $type: editingRender ? 'edit' : 'cell' }, params))
        )
      }
    }
    const cellValue = $tableContainer.getCellLabel(row, column)
    const cellPlaceholder = editingRender ? editingRender.placeholder : ''
    // prettier-ignore
    return [
      h(
        'span',
        {
          class: 'r4m-table-cell--label'
        },
        editingRender && eqEmptyValue(cellValue)
          ? [
            // If you set the placeholder
            h(
              'span',
              {
                class: 'r4m-table-cell--placeholder'
              },
              Utils.format(getFuncText(cellPlaceholder), 1)
            )
          ]
          : Utils.format(cellValue, 1)
      )
    ]
  },
  renderTreeCell(h, params) {
    return Cell.renderTreeIcon(h, params, Cell.defaultTableCellRenderer.call(this, h, params))
  },
  defaultFooterRenderer(h, params) {
    return [
      h(
        'span',
        {
          class: 'r4m-table-cell--item'
        },
        getFooterSlot(h, params)
      )
    ]
  },

  /**
   * tree node
   */
  renderTreeIcon(h, params, cellVirtualNodes) {
    const { $tableContainer, isHidden } = params
    const { treeOptions, treeExpandedMap, treeExpandedLazyLoadedMaps } = $tableContainer
    const { row, column } = params
    const { slots } = column
    const {lazy, trigger, iconLoaded, showIcon: eventListeners iconOpen, iconClose } = treeOptions
    const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
    const hasChildField = treeOptions.hasChild || treeOptions.hasChildField
    const rowChildren = row[childrenAccessField]
    let hasLazyChildren = false
    let isActive = false
    let isLazyLoaded = false
    const eventListeners = {}
    if (slots && slots.icon) {
      return $tableContainer.callSlot(slots.icon: eventListeners params, h, cellVirtualNodes)
    }
    if (!isHidden) {
      const rowId = getRowId($tableContainer, row)
      isActive = !!treeExpandedMap[rowId]
      if (lazy) {
        isLazyLoaded = !!treeExpandedLazyLoadedMaps[rowId]
        hasLazyChildren = row[hasChildField]
      }
    }
    if (!trigger || trigger === 'default') {
      on.click = (event) => {
        event.stopPropagation()
        $tableContainer.triggerTreeExpandedEvent(event, params)
      }
    }
    // prettier-ignore
    return [
      h(
        'div',
        {
          class: [
            'r4m-table-cell--tree-node',
            {
              'is--active': isActive
            }
          ]
        },
        [
          showIcon && ((rowChildren && rowChildren.length) || hasLazyChildren)
            ? [
              h(
                'div',
                {
                  class: 'r-table-tree--btn-wrapper',
                  on
                },
                [
                  h('i', {
                    class: [
                      'r-table-tree--node-btn',
                      isLazyLoaded
                        ? iconLoaded || GlobalConfigs.icon.TABLE_TREE_READY
                        : isActive
                          ? iconOpen || 'r4m-t-icon-chevron-outline-left rotate90'
                          : iconClose || 'r4m-t-icon-chevron-outline-left'
                    ]
                  })
                ]
              )
            ]
            : null,
          h(
            'div',
            {
              class: 'r-table-tree-cell'
            },
            cellVirtualNodes
          )
        ]
      )
    ]
  },

  /**
   * index
   */
  sequenceHeaderRenderFn(h, params) {
    const { $tableContainer, column } = params
    const { slots } = column
    return renderTitleContent(
      h,
      params,
      slots && slots.header ? $tableContainer.callSlot(slots.header, params, h) : Utils.format(column.getLabel(), 1)
    )
  },
  sequenceCellRenderer(h, params) {
    const { $tableContainer, column } = params
    const { treeConfig, sequenceOptions } = $tableContainer
    const { slots } = column
    if (slots && slots.default) {
      return $tableContainer.callSlot(slots.default, params, h)
    }
    const { seq } = params
    const sequenceMethod = sequenceOptions.sequenceMethod
    return [Utils.format(sequenceMethod ? sequenceMethod(params) : treeConfig ? seq : (sequenceOptions.startIndex || 0) + seq, 1)]
  },
  treeIndexCellRenderFn(h, params) {
    return Cell.renderTreeIcon(h, params, Cell.sequenceCellRenderer(h, params))
  },

  /**
   * Single selection
   */
  renderRadioHeader(h, params) {
    const { $tableContainer, column } = params
    const { slots } = column
    const headerColumnSlot = slots ? slots.header : null
    const titleSlot = slots ? slots.title : null
    // prettier-ignore
    return renderTitleContent(
      h,
      params,
      headerColumnSlot
        ? $tableContainer.callSlot(headerColumnSlot, params, h)
        : [
          h(
            'span',
            {
              class: 'r-table-radio--label'
            },
            titleSlot ? $tableContainer.callSlot(titleSlot, params, h) : Utils.format(column.getLabel(), 1)
          )
        ]
    )
  },
  renderradioCellRenderer(h, params) {
    const { $tableContainer, column, isHidden } = params
    const { radioOpts, selectRadioRow } = $tableContainer
    const { slots } = column
    const { labelField, selectionMethod, visibleMethod } = radioOpts
    const { row } = params
    const defaultSlot = slots ? slots.default : null
    const radioSlot = slots ? slots.radio : null
    const isSelected = row === selectRadioRow
    const isVisible = !visibleMethod || visibleMethod({ row })
    let isDisabled = !!selectionMethod
    let eventListeners
    if (!isHidden) {
      eventListeners = {
        click(event) {
          if (!isDisabled && isVisible) {
            event.stopPropagation()
            $tableContainer.triggerRadioRowEvent(event, params)
          }
        }
      }
      if (selectionMethod) {
        isDisabled = !selectionMethod({ row })
      }
    }
    const radioParams = { ...params, selected: isSelected, disabled: isDisabled, visible: isVisible }
    if (radioSlot) {
      return $tableContainer.callSlot(radioSlot, radioParams, h)
    }
    const radioVirtualNodes = []
    if (isVisible) {
      radioVirtualNodes.push(
        h('span', {
          class: [
            'r-table-radio--icon',
            isSelected ? GlobalConfigs.icon.TABLE_RADIO_selected : GlobalConfigs.icon.TABLE_RADIO_UNselected
          ]
        })
      )
    }
    if (defaultSlot || labelField) {
      radioVirtualNodes.push(
        h(
          'span',
          {
            class: 'r-table-radio--label'
          },
          defaultSlot ? $tableContainer.callSlot(defaultSlot, radioParams, h) : lodash.get(row, labelField)
        )
      )
    }
    return [
      h(
        'span',
        {
          class: [
            'r4m-table-cell--radio',
            {
              'is--selected': isSelected,
              'is--disabled': isDisabled
            }
          ],
          on
        },
        radioVirtualNodes
      )
    ]
  },
  treeRadioCellRendererRenderer(h, params) {
    return Cell.renderTreeIcon(h, params, Cell.renderRadioCellRenderer(h, params))
  },

  /**
   * Multiple choices
   */
  selectionHeaderRenderer(h, params) {
    const { $tableContainer, column, isHidden } = params
    const {
      isAllSelected: isAllCheckboxSelected,
      isIndeterminate: isAllCheckboxIndeterminate,
      isAllCheckboxDisabled
    } = $tableContainer
    const { slots } = column
    const headerColumnSlot = slots ? slots.header : null
    const titleSlot = slots ? slots.title : null
    const selectionOptions = $tableContainer.selectionOptions
    const headerColumnTitle = column.getLabel()
    let eventListeners
    if (!isHidden) {
      eventListeners = {
        click(event) {
          if (!isAllCheckboxDisabled) {
            event.stopPropagation()
            $tableContainer.triggerCheckAllEvent(event, !isAllCheckboxSelected)
          }
        }
      }
    }
    const checkboxParams = {
      ...params,
      selected: isAllCheckboxSelected,
      disabled: isAllCheckboxDisabled,
      indeterminate: isAllCheckboxIndeterminate
    }
    if (headerColumnSlot) {
      return renderTitleContent(h, checkboxParams, $tableContainer.callSlot(headerColumnSlot, checkboxParams, h))
    }
    if (selectionOptions.checkStrictly ? !selectionOptions.showHeader : selectionOptions.showHeader === false) {
      return renderTitleContent(h, checkboxParams, [
        h(
          'span',
          {
            class: 'r-table-checkbox--label'
          },
          titleSlot ? $tableContainer.callSlot(titleSlot, checkboxParams, h) : headerColumnTitle
        )
      ])
    }
    // prettier-ignore
    return renderTitleContent(h, checkboxParams, [
      h(
        'span',
        {
          class: [
            'r4m-table-cell--checkbox',
            {
              'is--selected': isAllCheckboxSelected,
              'is--disabled': isAllCheckboxDisabled,
              'is--indeterminate': isAllCheckboxIndeterminate
            }
          ],
          attrs: {
            // title: GlobalConfigs.i18n('rtable.table.allTitle')
          },
          on
        },
        [
          h('span', {
            class: [
              'r4m-t-icon',
              isAllCheckboxIndeterminate
                ? 'r4m-t-icon-checkbox-mixed'
                : isAllCheckboxSelected
                  ? 'r4m-t-icon-checkbox-selected'
                  : 'r4m-t-icon-checkbox-unselected'
            ]
          })
        ].concat(
          titleSlot || headerColumnTitle
            ? [
              h(
                'span',
                {
                  class: 'r-table-checkbox--label'
                },
                titleSlot ? $tableContainer.callSlot(titleSlot, checkboxParams, h) : headerColumnTitle
              )
            ]
            : []
        )
      )
    ])
  },
  renderCheckboxCell(h, params) {
    const { $tableContainer, row, column, isHidden } = params
    const { treeConfig, treeIndeterminateMaps, selectCheckboxMaps } = $tableContainer
    const { labelField, selectionMethod, visibleMethod } = $tableContainer.selectionOptions
    const { slots } = column
    const defaultSlot = slots ? slots.default : null
    const selectionSlot = slots ? slots.selection : null
    let indeterminate = false
    let isSelected = false
    const isVisible = !visibleMethod || visibleMethod({ row })
    let isDisabled = !!selectionMethod
    let eventListeners
    if (!isHidden) {
      const rowId = getRowId($tableContainer, row)
      isSelected = !!selectCheckboxMaps[rowId]
      eventListeners = {
        click(event) {
          if (!isDisabled && isVisible) {
            event.stopPropagation()
            $tableContainer.triggerCheckRowEvent(event, params, !isSelected)
          }
        }
      }
      if (selectionMethod) {
        isDisabled = !selectionMethod({ row })
      }
      if (treeConfig) {
        indeterminate = !!treeIndeterminateMaps[rowId]
      }
    }
    const checkboxParams = { ...params, selected: isSelected, disabled: isDisabled, visible: isVisible, indeterminate }
    if (selectionSlot) {
      return $tableContainer.callSlot(selectionSlot, checkboxParams, h)
    }
    const checkVirtualNodes = []
    if (isVisible) {
      checkVirtualNodes.push(
        h('span', {
          class: [
            'r4m-t-icon',
            indeterminate
              ? 'r4m-t-icon-checkbox-mixed'
              : isSelected
                ? 'r4m-t-icon-checkbox-selected'
                : 'r4m-t-icon-checkbox-unselected'
          ]
        })
      )
    }
    if (defaultSlot || labelField) {
      checkVirtualNodes.push(
        h(
          'span',
          {
            class: 'r-table-checkbox--label'
          },
          defaultSlot ? $tableContainer.callSlot(defaultSlot, checkboxParams, h) : lodash.get(row, labelField)
        )
      )
    }
    return [
      h(
        'span',
        {
          class: [
            'r4m-table-cell--checkbox',
            {
              'is--selected': isSelected,
              'is--disabled': isDisabled,
              'is--indeterminate': indeterminate,
              'is--hidden': !isVisible
            }
          ],
          on
        },
        checkVirtualNodes
      )
    ]
  },
  renderTreeSelectionCell(h, params) {
    return Cell.renderTreeIcon(h, params, Cell.renderCheckboxCell(h, params))
  },
  renderCheckboxCellByProp(h, params) {
    const { $tableContainer, row, column, isHidden } = params
    const { treeConfig, treeIndeterminateMaps, selectionOptions } = $tableContainer
    const { labelField, checkField, selectionMethod, visibleMethod } = selectionOptions
    const indeterminateField = selectionOptions.indeterminateField || selectionOptions.halfField
    const { slots } = column
    const defaultSlot = slots ? slots.default : null
    const selectionSlot = slots ? slots.selection : null
    let isIndeterminate = false
    let isSelected = false
    const isVisible = !visibleMethod || visibleMethod({ row })
    let isDisabled = !!selectionMethod
    let eventListeners
    if (!isHidden) {
      const rowId = getRowId($tableContainer, row)
      isSelected = lodash.get(row, checkField)
      eventListeners = {
        click(event) {
          if (!isDisabled && isVisible) {
            event.stopPropagation()
            $tableContainer.triggerCheckRowEvent(event, params, !isSelected)
          }
        }
      }
      if (selectionMethod) {
        isDisabled = !selectionMethod({ row })
      }
      if (treeConfig) {
        isIndeterminate = !!treeIndeterminateMaps[rowId]
      }
    }
    const checkboxParams = {
      ...params,
      selected: isSelected,
      disabled: isDisabled,
      visible: isVisible,
      indeterminate: isIndeterminate
    }
    if (selectionSlot) {
      return $tableContainer.callSlot(selectionSlot, checkboxParams, h)
    }
    const checkVirtualNodes = []
    if (isVisible) {
      checkVirtualNodes.push(
        h('span', {
          class: [
            'r4m-t-icon',
            isIndeterminate
              ? 'r4m-t-icon-checkbox-mixed'
              : isSelected
                ? 'r4m-t-icon-checkbox-selected'
                : 'r4m-t-icon-checkbox-unselected'
          ]
        })
      )
    }
    if (defaultSlot || labelField) {
      checkVirtualNodes.push(
        h(
          'span',
          {
            class: 'r-table-checkbox--label'
          },
          defaultSlot ? $tableContainer.callSlot(defaultSlot, checkboxParams, h) : lodash.get(row, labelField)
        )
      )
    }
    return [
      h(
        'span',
        {
          class: [
            'r4m-table-cell--checkbox',
            {
              'is--selected': isSelected,
              'is--disabled': isDisabled,
              'is--indeterminate': indeterminateField && !isSelected ? row[indeterminateField] : isIndeterminate,
              'is--hidden': !isVisible
            }
          ],
          on
        },
        checkVirtualNodes
      )
    ]
  },
  renderTreeSelectionCellByProp(h, params) {
    if (params.level === 0) {
      return Cell.renderTreeIcon(h, params)
    }
    return Cell.renderTreeIcon(h, params, Cell.renderCheckboxCellByProp(h, params))
  },

  /**
   * Expand the rows
   */
  expandCellRenderer(h, params) {
    const { $tableContainer, isHidden, row, column } = params
    const { expandOpts, rowExpandedMaps, rowExpandLazyLoadedMaps } = $tableContainer
    const { lazy, labelField, iconLoaded, showIcon: eventListeners iconOpen, iconClose, visibleMethod } = expandOpts
    const { slots } = column
    const defaultSlot = slots ? slots.default : null
    let isActive = false
    let isLazyLoaded = false
    if (slots && slots.icon) {
      return $tableContainer.callSlot(slots.icon: eventListeners params, h)
    }
    if (!isHidden) {
      const rowId = getRowId($tableContainer, row)
      isActive = !!rowExpandedMaps[rowId]
      if (lazy) {
        isLazyLoaded = !!rowExpandLazyLoadedMaps[rowId]
      }
    }
    // prettier-ignore
    return [
      showIcon && (!visibleMethod || visibleMethod(params))
        ? h(
          'span',
          {
            class: [
              'r4m-table--expanded',
              {
                'is--active': isActive
              }
            ],
            on: {
              click(event) {
                event.stopPropagation()
                $tableContainer.triggerRowExpandEvent(event, params)
              }
            }
          },
          [
            h('i', {
              class: [
                'r4m-table--expand-btn',
                isLazyLoaded
                  ? iconLoaded || GlobalConfigs.icon.TABLE_EXPAND_LOADED
                  : isActive
                    ? iconOpen || GlobalConfigs.icon.TABLE_EXPAND_OPEN
                    : iconClose || GlobalConfigs.icon.TABLE_EXPAND_CLOSE
              ]
            })
          ]
        )
        : null,
      defaultSlot || labelField
        ? h(
          'span',
          {
            class: 'r4m-table--expand-label'
          },
          defaultSlot ? $tableContainer.callSlot(defaultSlot, params, h) : lodash.get(row, labelField)
        )
        : null
    ]
  },
  renderExpandData(h, params) {
    const { $tableContainer, column } = params
    const { slots, contentRender } = column
    if (slots && slots.content) {
      return $tableContainer.callSlot(slots.content, params, h)
    }
    if (contentRender) {
      const compConf = RTable.renderer.get(contentRender.name)
      if (compConf && compConf.renderExpand) {
        return getSlotVirtualNodes(compConf.renderExpand.call($tableContainer, h, contentRender, params))
      }
    }
    return []
  },

  /**
   * HTML tag
   */
  renderHTMLCell(h, params) {
    const { $tableContainer, column } = params
    const { slots } = column
    if (slots && slots.default) {
      return $tableContainer.callSlot(slots.default, params, h)
    }
    return [
      h('span', {
        class: 'r4m-table-cell--html',
        domProps: {
          innerHTML: getDefaultCellLabel(params)
        }
      })
    ]
  },
  renderTreeHTMLCell(h, params) {
    return Cell.renderTreeIcon(h, params, Cell.renderHTMLCell(h, params))
  },

  /**
   * Sort and filter
   */
  renderSortAndFilterHeader(h, params) {
    return Cell.defaultTableHeaderRenderer(h, params)
      .concat(Cell.renderSortIcon(h, params))
      .concat(Cell.renderFilterIcon(h, params))
  },

  /**
   * Sort
   */
  renderSortHeader(h, params) {
    return Cell.defaultTableHeaderRenderer(h, params).concat(Cell.renderSortIcon(h, params))
  },
  renderSortIcon(h, params) {
    const { $tableContainer, column } = params
    const { showIcon: eventListeners iconLayout, iconAsc, iconDesc } = $tableContainer.sortOpts
    const value = toggle(column.order)
    // prettier-ignore
    return showIcon
      ? [
        h(
          'span',
          {
            class: ['r4m-table-cell--sort', `r4m-table-cell--sort-${iconLayout}-layout`],
            on: {
              click(event) {
                event.stopPropagation()
                $tableContainer.triggerSortEvent(event, column, value)
              }
            }
          },
          [
            h('i', {
              class: [
                'r4m-table-sort--asc-btn',
                'r4m-t-icon-chevron-up',
                {
                  'sort--active': column.order === 'asc'
                }
              ]
            }),
            h('i', {
              class: [
                'r4m-table-sort--desc-btn',
                'r4m-t-icon-chevron-down',
                {
                  'sort--active': column.order === 'desc'
                }
              ]
            })
          ]
        )
      ]
      : []
  },

  /**
   * Filter
   */
  renderFilterHeader(h, params) {
    return Cell.defaultTableHeaderRenderer(h, params).concat(Cell.renderFilterIcon(h, params))
  },
  renderFilterIcon(h, params) {
    const { $tableContainer, column, hasFilter } = params
    const { filterState, filterOpts } = $tableContainer
    const { showIcon: eventListeners iconNone, iconMatch } = filterOpts
    // prettier-ignore
    return showIcon
      ? [
        h(
          'span',
          {
            class: [
              'r4m-table-cell--filter',
              {
                'is--active': filterState.visible && filterState.column === column
              }
            ]
          },
          [
            h('i', {
              class: [
                'r-table-filter--btn',
                hasFilter
                  ? iconMatch || GlobalConfigs.icon.TABLE_FILTER_MATCH
                  : iconNone || GlobalConfigs.icon.TABLE_FILTER_NONE
              ],
              attrs: {
                title: GlobalConfigs.i18n('rtable.table.filter')
              },
              on: {
                click(event) {
                  if ($tableContainer.triggerFilterEvent) {
                    $tableContainer.triggerFilterEvent(event, params.column, params)
                  }
                }
              }
            })
          ]
        )
      ]
      : []
  },

  /**
   * Editable
   */
  renderEditHeader(h, params) {
    const { $tableContainer, column } = params
    const { editingConfig, editRules, editingOptions } = $tableContainer
    const { sortable, remoteSort, filters, editingRender } = column
    let isRequired = false
    if (editRules) {
      const columnRules = lodash.get(editRules, column.value)
      if (columnRules) {
        isRequired = columnRules.some((rule) => rule.required)
      }
    }
    // prettier-ignore
    return (
      isEnableConf(editingConfig)
        ? [
          isRequired && editingOptions.showAsterisk
            ? h('i', {
              class: 'r4m-table-cell--required-icon'
            })
            : null,
          isEnableConf(editingRender) && editingOptions.showIcon
            ? h('i', {
              class: ['r4m-table-cell--edit-icon', editingOptions.icon || GlobalConfigs.icon.TABLE_EDIT]
            })
            : null
        ]
        : []
    )
      .concat(Cell.defaultTableHeaderRenderer(h, params))
      .concat(sortable || remoteSort ? Cell.renderSortIcon(h, params) : [])
      .concat(filters ? Cell.renderFilterIcon(h, params) : [])
  },
  // Grid editing mode
  renderRowEdit(h, params) {
    const { $tableContainer, column } = params
    const { editingRender } = column
    const { actived } = $tableContainer.editingStore
    return Cell.runRenderer(h, params, this, isEnableConf(editingRender) && actived && actived.row === params.row)
  },
  renderTreeRowEdit(h, params) {
    return Cell.renderTreeIcon(h, params, Cell.renderRowEdit(h, params))
  },
  // Cell editing mode
  cellRendererEdit(h, params) {
    const { $tableContainer, column } = params
    const { editingRender } = column
    const { actived } = $tableContainer.editingStore
    return Cell.runRenderer(
      h,
      params,
      this,
      isEnableConf(editingRender) && actived && actived.row === params.row && actived.column === params.column
    )
  },
  renderTreeCellEdit(h, params) {
    return Cell.renderTreeIcon(h, params, Cell.cellRendererEdit(h, params))
  },
  runRenderer(h, params, _vm, isEdit) {
    const { $tableContainer, column } = params
    const { slots, editingRender, formatter } = column
    const compConf = RTable.renderer.get(editingRender.name)
    if (isEdit) {
      if (slots && slots.edit) {
        return $tableContainer.callSlot(slots.edit, params, h)
      }
      if (compConf && compConf.renderEdit) {
        return getSlotVirtualNodes(compConf.renderEdit.call($tableContainer, h, editingRender, Object.assign({ $type: 'edit' }, params)))
      }
      return []
    }
    if (slots && slots.default) {
      return $tableContainer.callSlot(slots.default, params, h)
    }
    if (formatter) {
      return [
        h(
          'span',
          {
            class: 'r4m-table-cell--label'
          },
          [getDefaultCellLabel(params)]
        )
      ]
    }
    return Cell.defaultTableCellRenderer.call(_vm, h, params)
  }
}

export default Cell
