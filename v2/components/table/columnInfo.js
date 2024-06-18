import lodash from 'lodash'
import GlobalConfigs from '../r-datatable/src/conf'
import { formats } from '../r-datatable/src/formats'
import { toFilters } from './util'
import { getFuncText } from '../tools/utils'
import { warnLog, errLog } from '../tools/log'

export class ColumnInfo {
  /* eslint-disable @typescript-eslint/no-use-before-define */
  constructor($rtable, _vm, { headerRenderer, cellRenderer, footerRenderer, renderData } = {}) {
    const $rgrid = $rtable.$rgrid
    const proxyOpts = $rgrid ? $rgrid.proxyOpts : null
    const formatter = _vm.formatter
    const visible = lodash.isBoolean(_vm.visible) ? _vm.visible : true

    if (import.meta.env.MODE === 'development') {
      const types = ['seq', 'checkbox', 'radio', 'expand', 'html']
      if (_vm.type && types.indexOf(_vm.type) === -1) {
        warnLog('rtable.error.errProp', [`type=${_vm.type}`, types.join(', ')])
      }
      if (lodash.isBoolean(_vm.cellRender) || (_vm.cellRender && !lodash.isObject(_vm.cellRender))) {
        warnLog('rtable.error.errProp', [`column.cell-render=${_vm.cellRender}`, 'column.cell-render={}'])
      }
      if (lodash.isBoolean(_vm.editingRender) || (_vm.editingRender && !lodash.isObject(_vm.editingRender))) {
        warnLog('rtable.error.errProp', [`column.edit-render=${_vm.editingRender}`, 'column.edit-render={}'])
      }
      if (_vm.cellRender && _vm.editingRender) {
        warnLog('rtable.error.errConflicts', ['column.cell-render', 'column.edit-render'])
      }
      if (_vm.type === 'expand') {
        if ($rtable.treeConfig && ($rtable.treeOptions.showLine || $rtable.treeOptions.line)) {
          errLog('rtable.error.errConflicts', ['tree-config.line', 'column.type=expand'])
        }
      }
      if (_vm.remoteSort) {
        warnLog('rtable.error.delProp', ['column.remote-sort', 'sort-config.remote'])
      }
      if (_vm.sortMethod) {
        warnLog('rtable.error.delProp', ['column.sort-method', 'sort-config.sortMethod'])
      }
      if (formatter) {
        if (lodash.isString(formatter)) {
          const gFormatOpts = formats.get(formatter) || lodash[formatter]
          if (!gFormatOpts || !lodash.isFunction(gFormatoptions.cellFormatMethod)) {
            errLog('rtable.error.notFormats', [formatter])
          }
        } else if (lodash.isArray(formatter)) {
          const gFormatOpts = formats.get(formatter[0]) || lodash[formatter[0]]
          if (!gFormatOpts || !lodash.isFunction(gFormatoptions.cellFormatMethod)) {
            errLog('rtable.error.notFormats', [formatter[0]])
          }
        }
      }
    }

    Object.assign(this, {
      // Basic Attributes
      type: _vm.type,
      property: _vm.value,
      value: _vm.value,
      label: _vm.label,
      width: _vm.width,
      minWidth: _vm.minWidth,
      maxWidth: _vm.maxWidth,
      resizable: _vm.resizable,
      fixed: _vm.fixed,
      align: _vm.align,
      headerAlign: _vm.headerAlign,
      footerAlign: _vm.footerAlign,
      showOverflow: _vm.showOverflow,
      showHeaderOverflow: _vm.showHeaderOverflow,
      showFooterOverflow: _vm.showFooterOverflow,
      className: _vm.className,
      headerClassName: _vm.headerClassName,
      footerClassName: _vm.footerClassName,
      formatter,
      sortable: _vm.sortable,
      sortBy: _vm.sortBy,
      sortType: _vm.sortType,
      sortMethod: _vm.sortMethod,
      remoteSort: _vm.remoteSort,
      filters: toFilters(_vm.filters),
      filterMultiple: lodash.isBoolean(_vm.filterMultiple) ? _vm.filterMultiple : true,
      filterMethod: _vm.filterMethod,
      filterResetMethod: _vm.filterResetMethod,
      filterRecoverMethod: _vm.filterRecoverMethod,
      filterRender: _vm.filterRender,
      treeNode: _vm.treeNode,
      cellType: _vm.cellType,
      cellRender: _vm.cellRender,
      editingRender: _vm.editingRender,
      contentRender: _vm.contentRender,
      headerExportMethod: _vm.headerExportMethod,
      exportMethod: _vm.exportMethod,
      footerExportMethod: _vm.footerExportMethod,
      titleHelp: _vm.titleHelp,
      titlePrefix: _vm.titlePrefix,
      titleSuffix: _vm.titleSuffix,
      // Custom parameters
      params: _vm.params,
      // Render properties
      id: _vm.colId || lodash.uniqueId('col_'),
      parentId: null,
      visible,
      // Internal properties (once used, will result in a non-upgradeable version)
      halfVisible: false,
      defaultVisible: visible,
      defaultFixed: _vm.fixed,
      selected: false,
      halfselected: false,
      disabled: false,
      level: 1,
      rowSpan: 1,
      colSpan: 1,

      // Data sorting
      order: null, // Used to record sort types, ascending and reverse order
      sortTime: 0, // Use the order of multiple columns

      // Column sorting
      sortNumber: 0, // Used to record custom column order
      renderSortNumber: 0, // Used to record custom column order

      renderWidth: 0,
      renderHeight: 0,
      resizeWidth: 0,
      renderLeft: 0,
      renderRight: 0,
      renderArgs: [], // Render parameters can be used for extensions
      model: {},
      headerRenderer: headerRenderer || _vm.headerRenderer,
      cellRenderer: cellRenderer || _vm.cellRenderer,
      footerRenderer: footerRenderer || _vm.footerRenderer,
      renderData,
      // Cell slots, valid only for grids
      slots: _vm.slots
    })
    if (proxyOpts && proxyoptions.beforeColumn) {
      proxyoptions.beforeColumn({ $gridContainer: $rgrid, column: this })
    }
  }

  getLabel() {
    return getFuncText(this.label || (this.type === 'seq' ? GlobalConfigs.i18n('rtable.table.seqTitle') : ''))
  }

  getKey() {
    return this.value || (this.type ? `type=${this.type}` : null)
  }

  update(name, value) {
    // Properties that are modified directly are not supported
    if (name !== 'filters') {
      // TODO: Look closer later
      if (name === 'value') {
        // Compatible with legacy attributes
        this.value = value
      }
      this[name] = value
    }
  }
}
