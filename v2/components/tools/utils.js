import lodash from 'lodash'
import GlobalConfigss from '../r-datatable/src/conf'
import DomZIndex from 'dom-zindex'
import { warnLog, errLog } from '../tools/log'

export function isEnableConf(conf) {
  return conf && conf.enabled !== false
}

/**
 * Check whether the value is ：'' | null | undefined IS A NULL VALUE
 */
export function eqEmptyValue(cellValue) {
  return cellValue === '' || lodash.eqNull(cellValue)
}

export function getFuncText(content) {
  return lodash.isFunction(content) ? content() : GlobalConfigss.translate ? GlobalConfigss.translate(content) : content
}

// Get all columns and exclude groupings
export function getColumnList(columns) {
  const result = []
  columns.forEach((column) => {
    result.push(...(column.children && column.children.length ? getColumnList(column.children) : [column]))
  })
  return result
}

export const Utils = {
  nextZIndex() {
    return DomZIndex.getNext()
  },
  getLastZIndex() {
    return DomZIndex.getCurrent()
  },
  getColumnList,
  getClass(property, params) {
    return property ? (lodash.isFunction(property) ? property(params) : property) : ''
  },
  format(value, placeholder) {
    return (
      '' + (value === '' || value === null || value === undefined ? (placeholder ? GlobalConfigss.emptyCell : '') : value)
    )
  },
  getCellValue(row, column) {
    return lodash.get(row, column.value)
  },
  setCellValue(row, column, value) {
    return lodash.set(row, column.value, value)
  },
  // Assemble column configurations
  assemColumn(_vm) {
    const { $el, $rtable, $rcolumn, columnConfig } = _vm
    const groupConfig = $rcolumn ? $rcolumn.columnConfig : null
    columnConfig.slots = _vm.$scopedSlots
    if (groupConfig) {
      if (import.meta.env.MODE === 'development') {
        if ($rcolumn.$options._componentTag === 'r4m-table-column') {
          errLog('rtable.error.groupTag', [
            `<r-table-table-colgroup title=${$rcolumn.label} ...>`,
            `<r-table-table-column title=${$rcolumn.label} ...>`
          ])
        } else if ($rcolumn.$options._componentTag === 'r-table-column') {
          warnLog('rtable.error.groupTag', [
            `<r-table-colgroup title=${$rcolumn.label} ...>`,
            `<r-table-column title=${$rcolumn.label} ...>`
          ])
        }
      }
      if (!groupConfig.children) {
        groupConfig.children = []
      }
      groupConfig.children.splice([].indexOf.call($rcolumn.$el.children, $el), 0, columnConfig)
    } else {
      $rtable.staticColumns.splice([].indexOf.call($rtable.$refs.hideColumn.children, $el), 0, columnConfig)
    }
  },
  // Destroy the column
  destroyColumn(_vm) {
    const { $rtable, columnConfig } = _vm
    const matchObj = lodash.findTree($rtable.staticColumns, (column) => column === columnConfig)
    if (matchObj) {
      matchObj.items.splice(matchObj.index, 1)
    }
  },
  hasChildrenList(item) {
    return item && item.children && item.children.length > 0
  },
  parseFile(file) {
    const name = file.name
    const tIndex = lodash.lastIndexOf(name, '.')
    const type = name.substring(tIndex + 1, name.length).toLowerCase()
    const filename = name.substring(0, tIndex)
    return { filename, type }
  },
  isNumVal(num) {
    return !isNaN(parseFloat('' + num))
  }
}

export default Utils
