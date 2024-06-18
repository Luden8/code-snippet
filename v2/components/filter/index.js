import GlobalConfigs from '../r-datatable/src/conf'
import RTable from '../r-datatable'
import Utils from '../tools/utils'
import lodash from 'lodash'
import { getSlotVirtualNodes } from '../tools/vn'

export default {
  name: 'RTableFilterPanel',
  props: {
    filterState: Object
  },
  computed: {
    hasCheckOption() {
      const { filterState } = this
      return filterState && filterState.options.some((option) => option.selected)
    }
  },
  render(h) {
    const { $parent: $rtable, filterState } = this
    const { args, column } = filterState
    const filterRender = column ? column.filterRender : null
    const compConf = filterRender ? RTable.renderer.get(filterRender.name) : null
    const filterClassName = compConf ? compConf.filterClassName : ''
    return h(
      'div',
      {
        class: [
          'r4m-table--filter-wrapper',
          'filter--prevent-default',
          compConf && compConf.className ? compConf.className : '',
          Utils.getClass(filterClassName, Object.assign({ $panel: this, $tableContainer: $rtable }, args)),
          {
            'is--animat': $rtable.animat,
            'is--multiple': filterState.multiple,
            'is--active': filterState.visible
          }
        ],
        style: filterState.style
      },
      filterState.visible ? this.renderOptions(h, filterRender, compConf).concat(this.footerRenderer(h)) : []
    )
  },
  methods: {
    renderOptions(h, filterRender, compConf) {
      const { $parent: $rtable, filterState } = this
      const { args, column, multiple, maxHeight } = filterState
      const { slots } = column
      if (slots && slots.filter) {
        return [
          h(
            'div',
            {
              class: 'r4m-table--filter-template'
            },
            $rtable.callSlot(slots.filter, Object.assign({ $panel: this, context: this }, args), h)
          )
        ]
      } else if (compConf && compConf.renderFilter) {
        return [
          h(
            'div',
            {
              class: 'r4m-table--filter-template'
            },
            getSlotVirtualNodes(
              compConf.renderFilter.call(
                $rtable,
                h,
                filterRender,
                Object.assign({ $panel: this, context: this }, args)
              )
            )
          )
        ]
      }
      const isAllselected = multiple ? filterState.isAllSelected : !filterState.options.some((item) => item._selected)
      const isAllIndeterminate = multiple && filterState.isIndeterminate
      // prettier-ignore
      return [
        h(
          'ul',
          {
            class: 'r4m-table--filter-header'
          },
          [
            h(
              'li',
              {
                class: [
                  'r4m-table--filter-option',
                  {
                    'is--selected': isAllselected,
                    'is--indeterminate': isAllIndeterminate
                  }
                ],
                attrs: {
                  title: GlobalConfigs.i18n(multiple ? 'rtable.table.allTitle' : 'rtable.table.allFilter')
                },
                on: {
                  click: (event) => {
                    this.changeAllOption(event, !filterState.isAllSelected)
                  }
                }
              },
              (multiple
                ? [
                  h('span', {
                    class: [
                      'r-table-checkbox--icon',
                      isAllIndeterminate
                        ? GlobalConfigs.icon.TABLE_CHECKBOX_INDETERMINATE
                        : isAllselected
                          ? GlobalConfigs.icon.TABLE_CHECKBOX_selected
                          : GlobalConfigs.icon.TABLE_CHECKBOX_UNselected
                    ]
                  })
                ]
                : []
              ).concat([
                h(
                  'span',
                  {
                    class: 'r-table-checkbox--label'
                  },
                  GlobalConfigs.i18n('rtable.table.allFilter')
                )
              ])
            )
          ]
        ),
        h(
          'ul',
          {
            class: 'r4m-table--filter-body',
            style: maxHeight
              ? {
                maxHeight: `${maxHeight}px`
              }
              : {}
          },
          filterState.options.map((item) => {
            const isSelected = item._selected
            const isIndeterminate = false
            return h(
              'li',
              {
                class: [
                  'r4m-table--filter-option',
                  {
                    'is--selected': isSelected
                  }
                ],
                attrs: {
                  title: item.label
                },
                on: {
                  click: (event) => {
                    this.changeOption(event, !item._selected, item)
                  }
                }
              },
              // prettier-ignore
              (multiple
                ? [
                  h('span', {
                    class: [
                      'r-table-checkbox--icon',
                      isIndeterminate
                        ? GlobalConfigs.icon.TABLE_CHECKBOX_INDETERMINATE
                        : isSelected
                          ? GlobalConfigs.icon.TABLE_CHECKBOX_selected
                          : GlobalConfigs.icon.TABLE_CHECKBOX_UNselected
                    ]
                  })
                ]
                : []
              ).concat([
                h(
                  'span',
                  {
                    class: 'r-table-checkbox--label'
                  },
                  Utils.format(item.label, 1)
                )
              ])
            )
          })
        )
      ]
    },
    footerRenderer(h) {
      const { $parent: $rtable, hasCheckOption: eventListeners filterState } = this
      const { filterOpts } = $rtable
      const { column, multiple } = filterState
      const filterRender = column.filterRender
      const compConf = filterRender ? RTable.renderer.get(filterRender.name) : null
      const isDisabled = !hasCheckOption && !filterState.isAllSelected && !filterState.isIndeterminate
      // prettier-ignore
      return multiple &&
        (!compConf ||
          (lodash.isBoolean(compConf.showFilterFooter)
            ? compConf.showFilterFooter !== false
            : compConf.isFooter !== false))
        ? [
          h(
            'div',
            {
              class: 'r4m-table--filter-footer'
            },
            [
              h(
                'button',
                {
                  class: {
                    'is--disabled': isDisabled
                  },
                  attrs: {
                    disabled: isDisabled
                  },
                  on: {
                    click: this.confirmFilter
                  }
                },
                filteroptions.confirmButtonText || GlobalConfigs.i18n('rtable.table.confirmFilter')
              ),
              h(
                'button',
                {
                  on: {
                    click: this.resetFilter
                  }
                },
                filteroptions.resetButtonText || GlobalConfigs.i18n('rtable.table.resetFilter')
              )
            ]
          )
        ]
        : []
    },
    // 
    filterCheckAllEvent(event, value) {
      const filterState = this.filterState
      filterState.options.forEach((option) => {
        option._selected = value
        option.selected = value
      })
      filterState.isAllSelected = value
      filterState.isIndeterminate = false
    },

    /*************************
     * Publish methods
     *************************/
    // （）
    changeRadioOption(event, selected, item) {
      const { $parent: $rtable, filterState } = this
      filterState.options.forEach((option) => {
        option._selected = false
      })
      item._selected = selected
      $rtable.checkFilterOptions()
      this.confirmFilter(event)
    },
    // （）
    changeMultipleOption(event, selected, item) {
      const { $parent: $rtable } = this
      item._selected = selected
      $rtable.checkFilterOptions()
    },
    changeAllOption(event, selected) {
      if (this.filterState.multiple) {
        this.filterCheckAllEvent(event, selected)
      } else {
        this.resetFilter(event)
      }
    },
    // 
    changeOption(event, selected, item) {
      if (this.filterState.multiple) {
        this.changeMultipleOption(event, selected, item)
      } else {
        this.changeRadioOption(event, selected, item)
      }
    },
    // 
    confirmFilter(event) {
      const { $parent: $rtable, filterState } = this
      filterState.options.forEach((option) => {
        option.selected = option._selected
      })
      $rtable.confirmFilterEvent(event)
    },
    // 
    resetFilter(event) {
      const { $parent: $rtable } = this
      $rtable.resetFilterEvent(event)
    }
    /*************************
     * Publish methods
     *************************/
  }
}
