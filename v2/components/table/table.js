import lodash from 'lodash'
import GlobalConfigss from '../r-datatable/src/conf'
import RTable from '../r-datatable'
import RTableBody from './body'
import RTableHeader from './header'
import RTableFooter from './footer'
import vSize from '../mixins/size'
import simplifiedMenuMixin from '../menu/simplified-menu'
import { isEnableConf, getFuncText } from '../tools/utils'
import { createResizeEvent } from '../tools/resize'
import { GlobalEvent } from '../tools/event'
import { getSlotVirtualNodes } from '../tools/vn'
import methods from './methods'
import { warnLog, errLog } from '../tools/log'
import Tooltip from '../tooltip'

/**
 * Render floating fixed columns
 * Render the left fixed column and the right fixed column respectively
 * If the width is sufficient, there is no need to render fixed columns
 * @param {Function} h Create VNode function
 * @param {Object} $rtable Table example
 * @param {String} isFixed fixed column type
 */
function renderFixed(h, $rtable, isFixed) {
  const { _e, tableData, tableColumn, tableGroupColumn, vSize, showHeader, showFooter, columnStore, footerData } =
    $rtable
  const fixedColumn = columnStore[`${isFixed}List`]
  // prettier-ignore
  return h(
    'div',
    {
      class: `r4m-table--fixed-${isFixed}-wrapper`,
      ref: `${isFixed}Container`
    },
    [
      showHeader
        ? h(RTableHeader, {
          props: {
            isFixed,
            tableData,
            tableColumn,
            tableGroupColumn,
            size: vSize,
            fixedColumn
          },
          ref: `${isFixed}Header`
        })
        : _e(),
      h(RTableBody, {
        props: {
          isFixed,
          tableData,
          tableColumn,
          fixedColumn,
          size: vSize
        },
        ref: `${isFixed}Body`
      }),
      showFooter
        ? h(RTableFooter, {
          props: {
            footerData,
            tableColumn,
            fixedColumn,
            isFixed,
            size: vSize
          },
          ref: `${isFixed}Footer`
        })
        : _e()
    ]
  )
}

function renderEmptyContenet(h, _vm) {
  const { $scopedSlots, emptyOpts } = _vm
  let emptyContent = ''
  const params = { $tableContainer: _vm }
  if ($scopedSlots.empty) {
    emptyContent = $scopedSlots.empty.call(_vm, params, h)
  } else {
    const compConf = emptyoptions.name ? RTable.renderer.get(emptyoptions.name) : null
    const renderEmpty = compConf ? compConf.renderEmpty : null
    if (renderEmpty) {
      emptyContent = getSlotVirtualNodes(renderEmpty.call(_vm, h, emptyOpts, params))
    } else {
      emptyContent = getFuncText(_vm.emptyText) || GlobalConfigss.i18n('rtable.table.emptyText')
    }
  }
  return emptyContent
}

function handleUupdateResize(_vm) {
  const { $el } = _vm
  if ($el && $el.clientWidth && $el.clientHeight) {
    _vm.recalculate()
  }
}

export default {
  name: 'R4mTable',
  mixins: [vSize, simplifiedMenuMixin],
  props: {
    /** common props */
    id: String,
    data: Array,
    isGrouped: { type: Boolean, default: false },
    height: [Number, String],
    minHeight: { type: [Number, String], default: () => GlobalConfigss.table.minHeight },
    maxHeight: [Number, String],
    hasMoreRecords: { type: Boolean, default: false },
    // Deprecated, replaced by column-config.resizable
    resizable: { type: Boolean, default: () => GlobalConfigss.table.resizable },
    stripe: { type: Boolean, default: () => GlobalConfigss.table.stripe },
    border: { type: [Boolean, String], default: () => GlobalConfigss.table.border },
    round: { type: Boolean, default: () => GlobalConfigss.table.round },
    size: { type: String, default: () => GlobalConfigss.table.size || GlobalConfigss.size },
    // Whether the width of the column is self-supporting (a parameter that may be deprecated, do not use it)
    fit: { type: Boolean, default: () => GlobalConfigss.table.fit },
    loading: Boolean,
    align: { type: String, default: () => GlobalConfigss.table.align },
    headerAlign: { type: String, default: () => GlobalConfigss.table.headerAlign },
    footerAlign: { type: String, default: () => GlobalConfigss.table.footerAlign },
    showHeader: { type: Boolean, default: () => GlobalConfigss.table.showHeader },
    // Deprecated, replaced by row-config.isCurrent
    highlightCurrentRow: { type: Boolean, default: () => GlobalConfigss.table.highlightCurrentRow },
    // Deprecated, replaced by row-config.isHover
    highlightHoverRow: { type: Boolean, default: () => GlobalConfigss.table.highlightHoverRow },
    // // Deprecated, replaced by column-config.isCurrent
    highlightCurrentColumn: { type: Boolean, default: () => GlobalConfigss.table.highlightCurrentColumn },
    // Deprecated, replaced by column-config.isHover
    highlightHoverColumn: { type: Boolean, default: () => GlobalConfigss.table.highlightHoverColumn },
    // Deprecated, delete later
    highlightCell: Boolean,
    showFooter: Boolean,
    footerData: Array,
    footerMethod: Function: eventListeners
    rowClassName: [String, Function],
    cellClassName: [String, Function],
    headerRowClassName: [String, Function],
    headerCellClassName: [String, Function],
    footerRowClasses: [String, Function],
    footerCellClassName: [String, Function],
    cellStyle: [Object, Function],
    headerCellStyle: [Object, Function],
    footerCellStyle: [Object, Function],
    rowStyle: [Object, Function],
    headerRowStyle: [Object, Function],
    footerRowStyles: [Object, Function],
    mergeCells: Array,
    mergeFooterItems: Array,
    customSpanFn: Function: eventListeners
    footercustomSpanFn: Function: eventListeners
    // Set all content to be displayed as ellipses when it is too long
    showOverflow: { type: [Boolean, String], default: () => GlobalConfigss.table.showOverflow },
    // Set all content in the header to be displayed as ellipses when it is too long
    showHeaderOverflow: { type: [Boolean, String], default: () => GlobalConfigss.table.showHeaderOverflow },
    // Set all content at the end of the table to be displayed as ellipses when it is too long
    showFooterOverflow: { type: [Boolean, String], default: () => GlobalConfigss.table.showFooterOverflow },

    /** Advanced properties */
    // Deprecated and replaced by column-config.useKey
    columnKey: Boolean,
    // Deprecated and replaced by row-config.useKey
    rowKey: Boolean,
    // Deprecated and replaced by row-config.keyField
    rowId: { type: String, default: () => GlobalConfigss.table.rowId },
    zIndex: Number,
    emptyText: { type: String, default: () => GlobalConfigss.table.emptyText },
    keepSource: { type: Boolean, default: () => GlobalConfigss.table.keepSource },
    // Whether to automatically monitor changes in the parent container to update the width and height of the responsive table
    autoResize: { type: Boolean, default: () => GlobalConfigss.table.autoResize },
    // Whether to automatically update the width and height of the responsive table based on the attribute
    syncResize: [Boolean, String, Number],
    // Responsive layout configuration items
    resizeConfig: Object,
    columnConfig: Object,
    rowConfig: Object,
    resizableConfig: Object,
    seqConfig: Object,
    sortConfig: Object,
    filterConfig: Object,
    radioConfig: Object,
    selectionConfig: Object,
    tooltipConfig: Object,
    exportConfig: [Boolean, Object],
    importConfig: [Boolean, Object],
    printConfig: Object,
    expandConfig: Object,
    treeConfig: [Boolean, Object],
    menuConfig: [Boolean, Object],
    // contextMenu deprecated in v4
    contextMenu: [Boolean, Object],
    mouseConfig: Object,
    areaConfig: Object,
    keyboardConfig: Object,
    clipConfig: Object,
    fnrConfig: Object,
    editingConfig: [Boolean, Object],
    validConfig: Object,
    editRules: Object,
    loadingConfig: Object,
    emptyRender: [Boolean, Object],
    customConfig: [Boolean, Object],
    scrollX: Object,
    scrollY: Object,
    animat: { type: Boolean, default: () => GlobalConfigss.table.animat },
    // Deprecated
    delayHover: { type: Number, default: () => GlobalConfigss.table.delayHover },
    // rest params
    params: Object
  },
  provide() {
    return {
      $rtable: this,
      xecolgroup: null
    }
  },
  inject: {
    $rgrid: {
      default: null
    }
  },
  localMerges: [],
  localMergesSet: new Set(),
  data() {
    return {
      tId: `${lodash.uniqueId()}`,
      // eager performance cols
      staticColumns: [],
      // grouped columns
      tableGroupColumn: [],
      // table columns
      tableColumn: [],
      // data to render
      tableData: [],
      // Whether horizontal X visual rendering mode loading is enabled
      scrollXLoad: false,
      // Whether vertical Y visual rendering mode loading is enabled
      virtualScrollYLoad: false,
      // has vertical scroll bar
      overflowY: true,
      // has horizontal scroll bar
      overflowX: false,
      // vertical scroll bar width
      scrollbarWidth: 0,
      // vertical scroll bar height
      scrollbarHeight: 0,
      wrapperHeight: 0,
      rowHeight: 0,
      // table's container height
      parentHeight: 0,
      // has grouped headers
      isGroup: false,
      isAllOverflow: false,
      // check whether all checkboxes selected
      isAllSelected: false,
      // check whether selection is in indeterminated state
      isIndeterminate: false,
      // Checkbox attribute, selected row collection
      selectCheckboxMaps: {},
      currentRow: null,
      currentColumn: null,
      selectRadioRow: null,
      footerData: [],
      expandColumn: null,
      hasFixedColumn: false,
      treeNodeColumn: null,
      rowExpandedMaps: {},
      rowExpandLazyLoadedMaps: {},
      treeExpandedMap: {},
      treeExpandedLazyLoadedMaps: {},
      treeIndeterminateMaps: {},
      // TODO: add description
      mergeList: [],
      mergeFooterList: [],
      initStore: {
        filter: false,
        import: false,
        export: false,
        custom: false
      },
      customColumnList: [],
      // Refresh the column identifier, which triggers the table to refresh data when the column filter is changed.
      upDataFlag: 0,
      // Refresh the column identifier, which triggers the table to refresh the column when specific attributes of the column are changed.
      reColumnFlag: 0,
      // tagged object set
      pendingRowMaps: {},
      // marked row
      pendingRowList: [],
      // custom columns
      customStore: {
        btnEl: null,
        isAll: false,
        isIndeterminate: false,
        activeBtn: false,
        activeWrapper: false,
        visible: false,
        maxHeight: 0
      },
      // filter's storage
      filterState: {
        isAllSelected: false,
        isIndeterminate: false,
        style: null,
        options: [],
        column: null,
        multiple: false,
        visible: false,
        maxHeight: null
      },
      // column's storage
      columnStore: {
        leftList: [],
        centerList: [],
        rightList: [],
        resizeList: [],
        pxList: [],
        pxMinList: [],
        scaleList: [],
        scaleMinList: [],
        autoList: []
      },
      // context menu storage
      ctxMenuStore: {
        selected: null,
        visible: false,
        showChild: false,
        selectChild: null,
        list: [],
        style: null
      },
      // store editable data
      editingStore: {
        indexs: {
          columns: []
        },
        titles: {
          columns: []
        },
        // selected cell
        selected: {
          row: null,
          column: null
        },
        // Whether cell is copied
        copyed: {
          cut: false,
          rows: [],
          columns: []
        },
        // whether cell is active
        actived: {
          row: null,
          column: null
        },
        insertList: [],
        insertMaps: {},
        removeList: [],
        removeMaps: {}
      },
      // tooltip storage
      tooltipStore: {
        row: null,
        column: null,
        visible: false
      },
      // validation storage
      validStore: {
        visible: false
      },
      validErrorMaps: {},
      // import table storage
      importStore: {
        inited: false,
        file: null,
        type: '',
        modeList: [],
        typeList: [],
        filename: '',
        visible: false
      },
      importParams: {
        mode: '',
        types: null,
        message: true
      },
      // export storage
      exportStore: {
        inited: false,
        name: '',
        modeList: [],
        typeList: [],
        columns: [],
        isPrint: false,
        hasFooter: false,
        hasTree: false,
        hasMerge: false,
        hasColgroup: false,
        visible: false
      },
      exportParams: {
        filename: '',
        sheetName: '',
        mode: '',
        type: '',
        isColgroup: false,
        isMerge: false,
        isAllExpand: false,
        useStyle: false,
        original: false,
        message: true,
        isHeader: false,
        isFooter: false
      }
    }
  },
  computed: {
    validOpts() {
      return Object.assign({ message: 'default' }, GlobalConfigss.table.validConfig, this.validConfig)
    },
    xAxisOptions() {
      return Object.assign({}, GlobalConfigss.table.scrollX, this.scrollX)
    },
    yAxisOptions() {
      return Object.assign({}, GlobalConfigss.table.scrollY, this.scrollY)
    },
    rowHeightMaps() {
      return {
        default: 48,
        medium: 44,
        small: 40,
        mini: 36
      }
    },
    columnOptions() {
      return Object.assign({}, GlobalConfigss.table.columnConfig, this.columnConfig)
    },
    rowOpts() {
      return Object.assign({}, GlobalConfigss.table.rowConfig, this.rowConfig)
    },
    resizeOpts() {
      return Object.assign({}, GlobalConfigss.table.resizeConfig, this.resizeConfig)
    },
    resizableOpts() {
      return Object.assign({}, GlobalConfigss.table.resizableConfig, this.resizableConfig)
    },
    sequenceOptions() {
      return Object.assign({ startIndex: 0 }, GlobalConfigss.table.seqConfig, this.seqConfig)
    },
    radioOpts() {
      return Object.assign({}, GlobalConfigss.table.radioConfig, this.radioConfig)
    },
    selectionOptions() {
      return Object.assign({}, GlobalConfigss.table.selectionConfig, this.selectionConfig)
    },
    tooltipOptions() {
      return Object.assign({}, GlobalConfigss.tooltip, GlobalConfigss.table.tooltipConfig, this.tooltipConfig)
    },
    tipConfig() {
      return { ...this.tooltipOptions }
    },
    validTipOpts() {
      return Object.assign({ isArrow: false }, this.tooltipOptions)
    },
    editingOptions() {
      return Object.assign({}, GlobalConfigss.table.editingConfig, this.editingConfig)
    },
    sortOpts() {
      return Object.assign({ orders: ['asc', 'desc', null] }, GlobalConfigss.table.sortConfig, this.sortConfig)
    },
    filterOpts() {
      return Object.assign({}, GlobalConfigss.table.filterConfig, this.filterConfig)
    },
    mouseOpts() {
      return Object.assign({}, GlobalConfigss.table.mouseConfig, this.mouseConfig)
    },
    areaOpts() {
      return Object.assign({}, GlobalConfigss.table.areaConfig, this.areaConfig)
    },
    keyboardOpts() {
      return Object.assign({}, GlobalConfigss.table.keyboardConfig, this.keyboardConfig)
    },
    clipOpts() {
      return Object.assign({}, GlobalConfigss.table.clipConfig, this.clipConfig)
    },
    fnrOpts() {
      return Object.assign({}, GlobalConfigss.table.fnrConfig, this.fnrConfig)
    },
    hasTip() {
      return RTable._tooltip
    },
    headerCtxMenu() {
      const headerOpts = this.ctxMenuoptions.header
      return headerOpts && headeroptions.options ? headeroptions.options : []
    },
    bodyCtxMenu() {
      const bodyOpts = this.ctxMenuoptions.body
      return bodyOpts && bodyoptions.options ? bodyoptions.options : []
    },
    footerCtxMenu() {
      const footerOpts = this.ctxMenuoptions.footer
      return footerOpts && footeroptions.options ? footeroptions.options : []
    },
    isCtxMenu() {
      return !!(
        (this.contextMenu || this.menuConfig) &&
        isEnableConf(this.ctxMenuOpts) &&
        (this.headerCtxMenu.length || this.bodyCtxMenu.length || this.footerCtxMenu.length)
      )
    },
    ctxMenuOpts() {
      return Object.assign({}, GlobalConfigss.table.menuConfig, this.contextMenu, this.menuConfig)
    },
    ctxMenuList() {
      const rest = []
      this.ctxMenuStore.list.forEach((list) => {
        list.forEach((item) => {
          rest.push(item)
        })
      })
      return rest
    },
    exportOpts() {
      return Object.assign({}, GlobalConfigss.table.exportConfig, this.exportConfig)
    },
    importOpts() {
      return Object.assign({}, GlobalConfigss.table.importConfig, this.importConfig)
    },
    printOpts() {
      return Object.assign({}, GlobalConfigss.table.printConfig, this.printConfig)
    },
    expandOpts() {
      return Object.assign({}, GlobalConfigss.table.expandConfig, this.expandConfig)
    },
    treeOptions() {
      return Object.assign({}, GlobalConfigss.table.treeConfig, this.treeConfig)
    },
    emptyOpts() {
      return Object.assign({}, GlobalConfigss.table.emptyRender, this.emptyRender)
    },
    loadingOpts() {
      return Object.assign({}, GlobalConfigss.table.loadingConfig, this.loadingConfig)
    },
    cellOffsetWidth() {
      return this.border ? Math.max(2, Math.ceil(this.scrollbarWidth / this.tableColumn.length)) : 1
    },
    customOpts() {
      return Object.assign({}, GlobalConfigss.table.customConfig, this.customConfig)
    },
    fixedColumnSize() {
      const { columnsCollection } = this
      let fixedSize = 0
      columnsCollection.forEach((column) => {
        if (column.fixed) {
          fixedSize++
        }
      })
      return fixedSize
    },
    isMaxFixedColumn() {
      const { maxFixedSize } = this.columnOptions
      if (maxFixedSize) {
        return this.fixedColumnSize >= maxFixedSize
      }
      return false
    },
    tableBorder() {
      const { border } = this
      if (border === true) {
        return 'full'
      }
      if (border) {
        return border
      }
      return 'default'
    },
    /**
     * Determine whether the checkbox for selecting all columns is disabled
     */
    isAllCheckboxDisabled() {
      const { tableFullRowsData, tableData, treeConfig, selectionOptions } = this
      const { strict, selectionMethod } = selectionOptions
      if (strict) {
        if (tableData.length || tableFullRowsData.length) {
          if (selectionMethod) {
            if (treeConfig) {
              // Tree structures are not supported at the moment
            }
            // If all rows are disabled
            return tableFullRowsData.every((row) => !selectionMethod({ row }))
          }
          return false
        }
        return true
      }
      return false
    }
  },
  watch: {
    data(value) {
      const { inited, initStatus } = this
      this.loadTableData(value).then(() => {
        this.inited = true
        this.initStatus = true
        if (!initStatus) {
          this.handleLoadDefaults()
        }
        if (!inited) {
          this.handleInitDefaults()
        }
        // const checkboxColumn = this.tableFullColumn.find(column => column.type === 'checkbox')
        // if (checkboxColumn && this.tableFullRowsData.length > 300 && !this.selectionOptions.checkField) {
        //   warnLog('rtable.error.checkProp', ['checkbox-config.checkField'])
        // }
        if ((this.scrollXLoad || this.virtualScrollYLoad) && this.expandColumn) {
          warnLog('rtable.error.scrollErrProp', ['column.type=expand'])
        }
        this.recalculate()
      })
    },
    staticColumns(value) {
      this.handleColumn(value)
    },
    tableColumn() {
      this.analyColumnWidth()
    },
    upDataFlag() {
      this.$nextTick().then(() => this.updateData())
    },
    reColumnFlag() {
      this.$nextTick().then(() => this.refreshColumn())
    },
    showHeader() {
      this.$nextTick(() => {
        this.recalculate(true).then(() => this.refreshScroll())
      })
    },
    showFooter() {
      this.$nextTick(() => {
        this.recalculate(true).then(() => this.refreshScroll())
      })
    },
    height() {
      this.$nextTick(() => this.recalculate(true))
    },
    maxHeight() {
      this.$nextTick(() => this.recalculate(true))
    },
    syncResize(value) {
      if (value) {
        handleUupdateResize(this)
        this.$nextTick(() => {
          handleUupdateResize(this)
          setTimeout(() => handleUupdateResize(this))
        })
      }
    },
    mergeCells(value) {
      this.clearMergedCells()
      this.$nextTick(() => this.setMergeCells(value))
    },
    mergeFooterItems(value) {
      this.clearMergeFooterItems()
      this.$nextTick(() => this.setMergeFooterItems(value))
    }
  },
  created() {
    const { scrollXState, axisYOptions, scrollYState, data, editingOptions, treeOptions, treeConfig, showOverflow, rowOpts } =
      Object.assign(this, {
        tZindex: 0,
        refsStore: {},
        // Store information related to horizontal X virtual scrolling
        scrollXState: {},
        // Store vertical Y virtual scroll related information
        scrollYState: {},
        tableWidth: 0,
        tableHeight: 0,
        headerHeight: 0,
        footerHeight: 0,
        // current hover row
        // hoverRow: null,
        // last scroll position
        lastScrollLeft: 0,
        lastScrollTop: 0,
        // Radio button attribute, reserved rows selected
        radioReserveRow: null,
        // Checkbox attribute, selected reserved rows
        checkboxReserveRowMap: {},
        // Row data, reserved rows expanded
        rowExpandedReserveRowMap: {},
        // Tree structured data, reserved rows expanded
        treeExpandedReserveRowMap: {},
        // After complete data and condition processing
        tableFullRowsData: [],
        afterfullRowsData: [],
        // Data collection after list condition processing
        afterFullRowMaps: {},
        // Collected column configuration (with grouping)
        columnsCollection: [],
        // Complete all columns (without grouping)
        tableFullColumn: [],
        // Render all columns
        visibleColumn: [],
        // Cache sourceDataet
        fullAllDataRowMap: new Map(),
        fullAllDatarowIdData: {},
        fullRowsDataRowMap: new Map(),
        fullRowsDatarowIdData: {},
        fullColumnMap: new Map(),
        fullColumnIdData: {},
        fullColumnFieldData: {}
      })

    if (import.meta.env.MODE === 'development') {
      // if (this.rowId) {
      //   warnLog('rtable.error.delProp', ['row-id', 'row-config.keyField'])
      // }
      // if (this.rowKey) {
      //   warnLog('rtable.error.delProp', ['row-id', 'row-config.useKey'])
      // }
      // if (this.columnKey) {
      //   warnLog('rtable.error.delProp', ['row-id', 'column-config.useKey'])
      // }
      if (
        !(this.rowId || rowoptions.keyField) &&
        (this.selectionOptions.reserve ||
          this.selectionOptions.checkRowKeys ||
          this.radiooptions.reserve ||
          this.radiooptions.checkRowKey ||
          this.expandoptions.expandRowKeys ||
          this.treeOptions.expandRowKeys)
      ) {
        warnLog('rtable.error.reqProp', ['row-config.keyField'])
      }
      if (this.editingConfig && editingOptions.showStatus && !this.keepSource) {
        warnLog('rtable.error.reqProp', ['keep-source'])
      }
      if (treeConfig && (treeOptions.showLine || treeOptions.line) && (!(this.rowKey || rowoptions.useKey) || !showOverflow)) {
        warnLog('rtable.error.reqProp', ['row-config.useKey | show-overflow'])
      }
      if (this.showFooter && !(this.footerMethod || this.footerData)) {
        warnLog('rtable.error.reqProp', ['footer-data | footer-method'])
      }
      if (treeConfig && this.stripe) {
        warnLog('rtable.error.noTree', ['stripe'])
      }
      if (this.tooltipOptions.enabled) {
        warnLog('rtable.error.delProp', ['tooltip-config.enabled', 'tooltip-config.showAll'])
      }
      // if (this.highlightCurrentRow) {
      //   warnLog('rtable.error.delProp', ['highlight-current-row', 'row-config.isCurrent'])
      // }
      // if (this.highlightHoverRow) {å
      //   warnLog('rtable.error.delProp', ['highlight-hover-row', 'row-config.isHover'])
      // }
      // if (this.highlightCurrentColumn) {
      //   warnLog('rtable.error.delProp', ['highlight-current-column', 'column-config.isCurrent'])
      // }
      // if (this.highlightHoverColumn) {
      //   warnLog('rtable.error.delProp', ['highlight-hover-column', 'column-config.isHover'])
      // }
      // Check the import and export type. If the import and export method is customized, the type will not be verified.
      const { exportConfig, exportOpts, importConfig, importOpts } = this
      if (
        importConfig &&
        importoptions.types &&
        !importoptions.importMethod &&
        !lodash.includeArrays(RTable.globalConfigs.importTypes, importoptions.types)
      ) {
        warnLog('rtable.error.errProp', [
          `export-config.types=${importoptions.types.join(',')}`,
          importoptions.types.filter((type) => lodash.includes(RTable.globalConfigs.importTypes, type)).join(',') ||
          RTable.globalConfigs.importTypes.join(',')
        ])
      }
      if (
        exportConfig &&
        exportoptions.types &&
        !exportoptions.exportMethod &&
        !lodash.includeArrays(RTable.globalConfigs.exportTypes, exportoptions.types)
      ) {
        warnLog('rtable.error.errProp', [
          `export-config.types=${exportoptions.types.join(',')}`,
          exportoptions.types.filter((type) => lodash.includes(RTable.globalConfigs.exportTypes, type)).join(',') ||
          RTable.globalConfigs.exportTypes.join(',')
        ])
      }
    }

    if (import.meta.env.MODE === 'development') {
      const customOpts = this.customOpts
      if (
        !this.id &&
        this.customConfig &&
        (customoptions.storage === true ||
          (customoptions.storage && customoptions.storage.resizable) ||
          (customoptions.storage && customoptions.storage.visible))
      ) {
        errLog('rtable.error.reqProp', ['id'])
      }
      if (this.treeConfig && this.selectionOptions.range) {
        errLog('rtable.error.noTree', ['checkbox-config.range'])
      }
      if (this.rowoptions.height && !this.showOverflow) {
        warnLog('rtable.error.notProp', ['table.show-overflow'])
      }
      if (!this.handleUpdateCellAreas) {
        if (this.clipConfig) {
          warnLog('rtable.error.notProp', ['clip-config'])
        }
        if (this.fnrConfig) {
          warnLog('rtable.error.notProp', ['fnr-config'])
        }
        if (this.mouseoptions.area) {
          errLog('rtable.error.notProp', ['mouse-config.area'])
          return
        }
      }
      if (this.treeConfig && treeOptions.children) {
        warnLog('rtable.error.delProp', ['tree-config.children', 'tree-config.childrenAccessField'])
      }
      if (this.treeConfig && treeOptions.line) {
        warnLog('rtable.error.delProp', ['tree-config.line', 'tree-config.showLine'])
      }
      if (this.mouseoptions.area && this.mouseoptions.selected) {
        warnLog('rtable.error.errConflicts', ['mouse-config.area', 'mouse-config.selected'])
      }
      if (this.mouseoptions.area && this.selectionOptions.range) {
        warnLog('rtable.error.errConflicts', ['mouse-config.area', 'checkbox-config.range'])
      }
      if (this.treeConfig && this.mouseoptions.area) {
        errLog('rtable.error.noTree', ['mouse-config.area'])
      }
    }

    // Only object types are supported in v4
    if (import.meta.env.MODE === 'development') {
      // In v3.0 soft deprication context-menu
      if (this.contextMenu) {
        warnLog('rtable.error.delProp', ['context-menu', 'menu-config'])
        if (!lodash.isObject(this.contextMenu)) {
          warnLog('rtable.error.errProp', [`table.context-menu=${this.contextMenu}`, 'table.context-menu={}'])
        }
      }
      if (this.menuConfig && !lodash.isObject(this.menuConfig)) {
        warnLog('rtable.error.errProp', [`table.menu-config=${this.menuConfig}`, 'table.menu-config={}'])
      }
      if (this.exportConfig && !lodash.isObject(this.exportConfig)) {
        warnLog('rtable.error.errProp', [`table.export-config=${this.exportConfig}`, 'table.export-config={}'])
      }
      if (this.importConfig && !lodash.isObject(this.importConfig)) {
        warnLog('rtable.error.errProp', [`table.import-config=${this.importConfig}`, 'table.import-config={}'])
      }
      if (this.printConfig && !lodash.isObject(this.printConfig)) {
        warnLog('rtable.error.errProp', [`table.print-config=${this.printConfig}`, 'table.print-config={}'])
      }
      if (this.treeConfig && !lodash.isObject(this.treeConfig)) {
        warnLog('rtable.error.errProp', [`table.tree-config=${this.treeConfig}`, 'table.tree-config={}'])
      }
      if (this.customConfig && !lodash.isObject(this.customConfig)) {
        warnLog('rtable.error.errProp', [`table.custom-config=${this.customConfig}`, 'table.custom-config={}'])
      }
      if (this.editingConfig && !lodash.isObject(this.editingConfig)) {
        warnLog('rtable.error.errProp', [`table.edit-config=${this.editingConfig}`, 'table.edit-config={}'])
      }
      if (this.emptyRender && !lodash.isObject(this.emptyRender)) {
        warnLog('rtable.error.errProp', [`table.empty-render=${this.emptyRender}`, 'table.empty-render={}'])
      }
      if (this.editingConfig && this.editingOptions.activeMethod) {
        warnLog('rtable.error.delProp', ['table.edit-config.activeMethod', 'table.edit-config.beforeEditMethod'])
      }
      if (this.treeConfig && this.selectionOptions.isShiftKey) {
        errLog('rtable.error.errConflicts', ['tree-config', 'checkbox-config.isShiftKey'])
      }
      if (this.selectionOptions.halfField) {
        warnLog('rtable.error.delProp', ['checkbox-config.halfField', 'checkbox-config.indeterminateField'])
      }
    }

    // Check whether the required modules are installed
    if (import.meta.env.MODE === 'development') {
      if (this.editingConfig && !this._insert) {
        errLog('rtable.error.reqModule', ['Edit'])
      }
      if (this.editRules && !this._validate) {
        errLog('rtable.error.reqModule', ['Validator'])
      }
      if ((this.selectionOptions.range || this.keyboardConfig || this.mouseConfig) && !this.triggerCellMousedownEvent) {
        errLog('rtable.error.reqModule', ['Keyboard'])
      }
      if ((this.printConfig || this.importConfig || this.exportConfig) && !this._exportData) {
        errLog('rtable.error.reqModule', ['Export'])
      }
    }

    Object.assign(scrollYState, {
      startIndex: 0,
      endIndex: 1,
      visibleSize: 0,
      adaptive: axisYOptions.adaptive !== false
    })
    Object.assign(scrollXState, {
      startIndex: 0,
      endIndex: 1,
      visibleSize: 0
    })
    this.loadTableData(data).then(() => {
      if (data && data.length) {
        this.inited = true
        this.initStatus = true
        this.handleLoadDefaults()
        this.handleInitDefaults()
      }
      this.updateTableStyle()
    })
    GlobalEvent.on(this, 'paste', this.handleGlobalPasteEvent)
    GlobalEvent.on(this, 'copy', this.handleGlobalCopyEvent)
    GlobalEvent.on(this, 'cut', this.handleGlobalCutEvent)
    GlobalEvent.on(this, 'mousedown', this.handleGlobalMousedownEvent)
    GlobalEvent.on(this, 'blur', this.handleGlobalBlurEvent)
    GlobalEvent.on(this, 'mousewheel', this.handleGlobalMousewheelEvent)
    GlobalEvent.on(this, 'keydown', this.handleGlobalKeydownEvent)
    GlobalEvent.on(this, 'resize', this.handleGlobalResizeEvent)
    GlobalEvent.on(this, 'contextmenu', this.handleGlobalContextmenuEvent)
    this.preventEvent(null, 'created')
  },
  mounted() {
    if (import.meta.env.MODE === 'development') {
      const { $listeners } = this
      if (
        !this.menuConfig &&
        ($listeners['menu-click'] ||
          $listeners['cell-menu'] ||
          $listeners['header-cell-menu'] ||
          $listeners['footer-cell-menu'])
      ) {
        warnLog('rtable.error.reqProp', ['menu-config'])
      }
      if (!this.tooltipConfig && ($listeners['cell-mouseenter'] || $listeners['cell-mouseleave'])) {
        warnLog('rtable.error.reqProp', ['tooltip-config'])
      }
    }
    // prettier-ignore
    if (this.autoResize) {
      const handleWarpperResize = this.resizeoptions.refreshDelay
        ? lodash.throttle(() => this.recalculate(true), this.resizeoptions.refreshDelay, {
          leading: true,
          trailing: true
        })
        : null
      const resizeObserver = createResizeEvent(
        handleWarpperResize
          ? () => {
            if (this.autoResize) {
              requestAnimationFrame(handleWarpperResize)
            }
          }
          : () => {
            if (this.autoResize) {
              this.recalculate(true)
            }
          }
      )
      resizeObserver.observe(this.$el)
      resizeObserver.observe(this.getParentElem())
      this.$resize = resizeObserver
    }
    this.preventEvent(null, 'mounted')
  },
  activated() {
    this.recalculate().then(() => this.refreshScroll())
    this.preventEvent(null, 'activated')
  },
  deactivated() {
    this.preventEvent(null, 'deactivated')
  },
  beforeDestroy() {
    if (this.$resize) {
      this.$resize.disconnect()
    }
    this.closeFilter()
    this.closeMenu()
    this.preventEvent(null, 'beforeDestroy')
  },
  destroyed() {
    GlobalEvent.off(this, 'paste')
    GlobalEvent.off(this, 'copy')
    GlobalEvent.off(this, 'cut')
    GlobalEvent.off(this, 'mousedown')
    GlobalEvent.off(this, 'blur')
    GlobalEvent.off(this, 'mousewheel')
    GlobalEvent.off(this, 'keydown')
    GlobalEvent.off(this, 'resize')
    GlobalEvent.off(this, 'contextmenu')
    this.preventEvent(null, 'destroyed')
  },
  render(h) {
    const {
      _e,
      $scopedSlots,
      tId,
      tableData,
      tableColumn,
      tableGroupColumn,
      isGroup,
      loading,
      stripe,
      showHeader,
      height,
      tableBorder,
      treeOptions,
      treeConfig,
      mouseConfig,
      mouseOpts,
      vSize,
      validOpts,
      showFooter,
      overflowX,
      overflowY,
      scrollXLoad,
      virtualScrollYLoad,
      scrollbarHeight,
      highlightCell,
      highlightHoverRow,
      highlightHoverColumn,
      editingConfig,
      validTipOpts,
      initStore,
      columnStore,
      filterState,
      customStore,
      ctxMenuStore,
      ctxMenuOpts,
      footerData,
      hasTip,
      columnOptions,
      rowOpts,
      loadingOpts,
      editRules
    } = this
    const { leftList, rightList } = columnStore
    return h(
      'div',
      {
        class: [
          'r4m-table',
          'r4m-table--render-default',
          `tid_${tId}`,
          vSize ? `size--${vSize}` : '',
          `border--${tableBorder}`,
          {
            [`valid-msg--${validoptions.msgMode}`]: !!editRules,
            'r-table-editable': !!editingConfig,
            'old-cell-valid': editRules && GlobalConfigss.cellVaildMode === 'obsolete',
            'cell--highlight': highlightCell,
            'cell--selected': mouseConfig && mouseoptions.selected,
            'cell--area': mouseConfig && mouseoptions.area,
            'row--highlight': rowoptions.isHover || highlightHoverRow,
            'column--highlight': columnOptions.isHover || highlightHoverColumn,
            'is--header': showHeader,
            'is--footer': showFooter,
            'is--group': isGroup,
            'is--tree-line': treeConfig && (treeOptions.showLine || treeOptions.line),
            'is--fixed-left': leftList.length,
            'is--fixed-right': rightList.length,
            'is--animat': !!this.animat,
            'is--round': this.round,
            'is--stripe': !treeConfig && stripe,
            'is--loading': loading,
            'is--empty': !loading && !tableData.length,
            'is--scroll-y': overflowY,
            'is--scroll-x': overflowX,
            'is--virtual-x': scrollXLoad,
            'is--virtual-y': virtualScrollYLoad
          }
        ],
        on: {
          keydown: this.keydownEvent
        }
      },
      [
        /**
         * Hide columns
         */
        h(
          'div',
          {
            class: 'r4m-table-slots',
            ref: 'hideColumn'
          },
          this.$slots.default
        ),
        h(
          'div',
          {
            class: 'r4m-table--render-wrapper'
          },
          [
            // prettier-ignore
            h(
              'div',
              {
                class: 'r4m-table--main-wrapper'
              },
              [
                /**
                 * Header
                 */
                showHeader
                  ? h(RTableHeader, {
                    ref: 'tableHeader',
                    props: {
                      tableData,
                      tableColumn,
                      tableGroupColumn,
                      size: vSize
                    }
                  })
                  : _e(),
                /**
                 * body
                 */
                h(RTableBody, {
                  ref: 'tableBody',
                  props: {
                    tableData,
                    tableColumn,
                    size: vSize
                  }
                }),
                /**
                 * footer
                 */
                showFooter
                  ? h(RTable, {
                    ref: 'tableFooter',
                    props: {
                      footerData,
                      tableColumn,
                      size: vSize
                    }
                  })
                  : _e()
              ]
            )
            // h(
            //   'div',
            //   {
            //     class: 'r4m-table--fixed-wrapper'
            //   },
            //   [
            //     /**
            //      * Fixed area on the left side
            //      */
            //     leftList && leftList.length && overflowX ? renderFixed(h, this, 'left') : _e(),
            //     /**
            //      * Fixed area on the right side
            //      */
            //     rightList && rightList.length && overflowX ? renderFixed(h, this, 'right') : _e()
            //   ]
            // )
          ]
        ),
        /**
         * empty state
         */
        h(
          'div',
          {
            ref: 'emptyPlaceholder',
            class: 'r4m-table--empty-placeholder'
          },
          [
            h(
              'div',
              {
                class: 'r4m-table--empty-content'
              },
              renderEmptyContenet(h, this)
            )
          ]
        ),
        /**
         * Borders
         */
        h('div', {
          class: 'r4m-table--border-line'
        }),
        /**
         * Column resize
         */
        // prettier-ignore
        h('div', {
          class: 'r4m-table--resizable-bar',
          style: overflowX
            ? {
              'padding-bottom': `${scrollbarHeight}px`
            }
            : null,
          ref: 'resizeBar'
        }),
        /**
         * Custom columns
         */
        // prettier-ignore
        initStore.custom
          ? h('r4m-table-custom-panel', {
            ref: 'customWrapper',
            props: {
              customStore
            }
          })
          : _e(),
        /**
         * filter
         */
        // prettier-ignore
        initStore.filter
          ? h('r4m-table-filter-panel', {
            ref: 'filterWrapper',
            props: {
              filterState
            }
          })
          : _e(),
        /**
         * Import
         */
        // prettier-ignore
        initStore.import && this.importConfig
          ? h('r4m-table-import-panel', {
            props: {
              defaultOptions: this.importParams,
              storeData: this.importStore
            }
          })
          : _e(),
        /**
         * Export
         */
        // prettier-ignore
        initStore.export && (this.exportConfig || this.printConfig)
          ? h('r4m-table-export-panel', {
            props: {
              defaultOptions: this.exportParams,
              storeData: this.exportStore
            }
          })
          : _e(),
        /**
         * Context menu
         */
        // prettier-ignore
        ctxMenuStore.visible && this.isCtxMenu
          ? h('r4m-table-menu-panel', {
            ref: 'ctxWrapper',
            props: {
              ctxMenuStore,
              ctxMenuOpts
            }
          })
          : _e(),
        /**
         * General tooltip
         */
        // prettier-ignore
        hasTip
          ? h(Tooltip, {
            ref: 'commTip',
            props: {
              isArrow: false,
              enterable: false
            }
          })
          : _e(),
        /**
         * Tooltip
         */
        // prettier-ignore
        hasTip
          ? h(Tooltip, {
            ref: 'tooltip',
            props: this.tipConfig
          })
          : _e(),
        /**
         * Confirmation prompt
         */
        // prettier-ignore
        hasTip &&
        this.editRules &&
        validoptions.showMessage &&
        (validoptions.message === 'default' ? !height : validoptions.message === 'tooltip')
          ? h(Tooltip, {
            ref: 'validTip',
            class: [
              {
                'old-cell-valid': editRules && GlobalConfigss.cellVaildMode === 'obsolete'
              },
              'r4m-table--valid-error'
            ],
            props: validoptions.message === 'tooltip' || tableData.length === 1 ? validTipOpts : null
          })
          : _e()
      ]
    )
  },
  methods
}
