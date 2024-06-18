// import Table from '../../table'
import lodash from 'lodash'
import GlobalConfigs from '../r-datatable/src/conf'
import vSize from '../mixins/size'
import RTable from '../r-datatable'
import Utils, { isEnableConf } from '../tools/utils'
import DomUtils, { getOffsetHeight, getPaddingTopBottomSize } from '../tools/dom'
import { GlobalEvent } from '../tools/event'
import { warnLog, errLog } from '../tools/log'
import { getSlotVirtualNodes } from '../tools/vn'

import Table from '../table/table'

const methods = {}
const propKeys = Object.keys(Table.props)

function renderDefaultForm(h, _vm) {
  const { $scopedSlots, proxyConfig, proxyOpts, formData, formConfig, formOpts } = _vm
  if (isEnableConf(formConfig) && formoptions.items && formoptions.items.length) {
    const formSlots = {}
    if (!formoptions.inited) {
      formoptions.inited = true
      const beforeItem = proxyoptions.beforeItem
      if (proxyOpts && beforeItem) {
        formoptions.items.forEach((item) => {
          beforeItem.call(_vm, { $gridContainer: _vm, item })
        })
      }
    }
    // handle slot
    formoptions.items.forEach((item) => {
      lodash.each(item.slots, (func) => {
        if (!lodash.isFunction(func)) {
          if ($scopedSlots[func]) {
            formSlots[func] = $scopedSlots[func]
          }
        }
      })
    })
    return [
      h('r-table-form', {
        props: Object.assign({}, formOpts, {
          data: proxyConfig && proxyoptions.form ? formData : formoptions.data
        }),
        on: {
          submit: _vm.submitEvent,
          reset: _vm.resetEvent,
          collapse: _vm.collapseEvent,
          'submit-invalid': _vm.submitInvalidEvent
        },
        scopedSlots: formSlots
      })
    ]
  }
  return []
}

function getFuncSlot(_vm, optSlots, slotKey) {
  const { $scopedSlots } = _vm
  const funcSlot = optSlots[slotKey]
  if (funcSlot) {
    if (lodash.isString(funcSlot)) {
      if ($scopedSlots[funcSlot]) {
        return $scopedSlots[funcSlot]
      } else {
        if (import.meta.env.MODE === 'development') {
          errLog('rtable.error.notSlot', [funcSlot])
        }
      }
    } else {
      return funcSlot
    }
  }
  return null
}

function getToolbarSlots(_vm) {
  const { $scopedSlots, toolbarOpts } = _vm
  const toolbarOptSlots = toolbaroptions.slots
  let buttonsSlot
  let toolsSlot
  const slots = {}
  if (import.meta.env.MODE === 'development') {
    if ($scopedSlots.buttons && (!toolbarOptSlots || toolbarOptSlots.buttons !== 'buttons')) {
      warnLog('rtable.error.reqProp', ['toolbar-config.slots.buttons'])
    }
    if ($scopedSlots.tools && (!toolbarOptSlots || toolbarOptSlots.tools !== 'tools')) {
      warnLog('rtable.error.reqProp', ['toolbar-config.slots.tools'])
    }
  }
  if (toolbarOptSlots) {
    buttonsSlot = getFuncSlot(_vm, toolbarOptSlots, 'buttons')
    toolsSlot = getFuncSlot(_vm, toolbarOptSlots, 'tools')
    if (buttonsSlot) {
      slots.buttons = buttonsSlot
    }
    if (toolsSlot) {
      slots.tools = toolsSlot
    }
  }
  return slots
}

function getPagerSlots(_vm) {
  const { pagerOpts } = _vm
  const pagerOptSlots = pageroptions.slots
  const slots = {}
  let leftSlot
  let rightSlot
  if (pagerOptSlots) {
    leftSlot = getFuncSlot(_vm, pagerOptSlots, 'left')
    rightSlot = getFuncSlot(_vm, pagerOptSlots, 'right')
    if (leftSlot) {
      slots.left = leftSlot
    }
    if (rightSlot) {
      slots.right = rightSlot
    }
  }
  return slots
}

function getTableOns(_vm) {
  const { $listeners, proxyConfig, proxyOpts } = _vm
  const eventListeners = {}
  lodash.each($listeners, (cb, type) => {
    ons[type] = (...args) => {
      _vm.$emit(type, ...args)
    }
  })
  if (proxyConfig) {
    if (proxyoptions.sort) {
      ons['sort-change'] = _vm.sortChangeEvent
    }
    if (proxyoptions.filter) {
      ons['filter-change'] = _vm.filterChangeEvent
    }
  }
  return ons
}

/**
 * Render form
 */
function renderForms(h, _vm) {
  const { _e, $scopedSlots, formConfig } = _vm
  const formSlot = $scopedSlots.form
  const hasForm = !!(formSlot || isEnableConf(formConfig))
  // prettier-ignore
  return hasForm
    ? h(
      'div',
      {
        key: 'form',
        ref: 'formWrapper',
        class: 'r4m-grid--form-wrapper'
      },
      formSlot ? formSlot.call(_vm, { $gridContainer: _vm }, h) : renderDefaultForm(h, _vm)
    )
    : _e()
}

/**
 * Render toolbar
 */
function renderToolbars(h, _vm) {
  const { _e, $scopedSlots, toolbarConfig, toolbar } = _vm
  const toolbarSlot = $scopedSlots.toolbar
  const hasToolbar = !!(toolbarSlot || isEnableConf(toolbarConfig) || toolbar)
  // prettier-ignore
  return hasToolbar
    ? h(
      'div',
      {
        key: 'toolbar',
        ref: 'toolbarWrapper',
        class: 'r4m-grid--toolbar-wrapper'
      },
      toolbarSlot
        ? toolbarSlot.call(_vm, { $gridContainer: _vm }, h)
        : [
          h('r-table-toolbar', {
            props: _vm.toolbarOpts,
            ref: 'xToolbar',
            scopedSlots: getToolbarSlots(_vm)
          })
        ]
    )
    : _e()
}

/**
 * Render table top area
 */
function renderTops(h, _vm) {
  const { _e, $scopedSlots } = _vm
  const topSlot = $scopedSlots.top
  // prettier-ignore
  return topSlot
    ? h(
      'div',
      {
        key: 'top',
        ref: 'topWrapper',
        class: 'r4m-grid--top-wrapper'
      },
      topSlot.call(_vm, { $gridContainer: _vm }, h)
    )
    : _e()
}

/**
 * Render table
 */
function renderTables(h, _vm) {
  const { $scopedSlots, tableProps } = _vm

  return h(Table, {
    key: 'table',
    props: tableProps,
    on: getTableOns(_vm),
    scopedSlots: $scopedSlots,
    ref: 'xTable'
  })
}

/**
 * Render table bottom area
 */
function renderBottoms(h, _vm) {
  const { _e, $scopedSlots } = _vm
  const bottomSlot = $scopedSlots.bottom
  // prettier-ignore
  return bottomSlot
    ? h(
      'div',
      {
        key: 'bottom',
        ref: 'bottomWrapper',
        class: 'r4m-grid--bottom-wrapper'
      },
      bottomSlot.call(_vm, { $gridContainer: _vm }, h)
    )
    : _e()
}

/**
 * Render pagination
 */
function renderPagers(h, _vm) {
  const { _e, $scopedSlots, pagerConfig, proxyConfig, tablePage } = _vm
  const pagerSlot = $scopedSlots.pager
  const hasPager = !!(pagerSlot || isEnableConf(pagerConfig))
  // prettier-ignore
  return hasPager
    ? h(
      'div',
      {
        key: 'pager',
        ref: 'pagerWrapper',
        class: 'r4m-grid--pager-wrapper'
      },
      pagerSlot
        ? pagerSlot.call(_vm, { $gridContainer: _vm }, h)
        : [
          h('r-table-pager', {
            props: { ..._vm.pagerOpts, ...(proxyConfig ? tablePage : {}) },
            on: {
              'page-change': _vm.pageChangeEvent
            },
            scopedSlots: getPagerSlots(_vm)
          })
        ]
    )
    : _e()
}

const defaultLayouts = ['Form', 'Toolbar', 'Top', 'Table', 'Bottom', 'Pager']

function renderLayout(h, _vm) {
  const { layouts } = _vm
  const virtualNodes = []
  const currLayouts = layouts && layouts.length ? layouts : GlobalConfigs.grid.layouts || defaultLayouts
  currLayouts.forEach((name) => {
    switch (name) {
      case 'Form':
        virtualNodes.push(renderForms(h, _vm))
        break
      case 'Toolbar':
        virtualNodes.push(renderToolbars(h, _vm))
        break
      case 'Top':
        virtualNodes.push(renderTops(h, _vm))
        break
      case 'Table':
        virtualNodes.push(renderTables(h, _vm))
        break
      case 'Bottom':
        virtualNodes.push(renderBottoms(h, _vm))
        break
      case 'Pager':
        virtualNodes.push(renderPagers(h, _vm))
        break
      default:
        if (import.meta.env.MODE === 'development') {
          errLog('rtable.error.notProp', [`layouts -> ${name}`])
        }
        break
    }
  })
  return virtualNodes
}

Object.keys(Table.methods).forEach((name) => {
  methods[name] = function (...args) {
    return this.$refs.xTable && this.$refs.xTable[name](...args)
  }
})

export default {
  name: 'RGrid',
  mixins: [vSize],
  props: {
    ...Table.props,
    layouts: Array,
    columns: Array,
    pagerConfig: [Boolean, Object],
    proxyConfig: Object,
    toolbar: [Boolean, Object],
    toolbarConfig: [Boolean, Object],
    formConfig: [Boolean, Object],
    zoomConfig: Object,
    size: { type: String, default: () => GlobalConfigs.grid.size || GlobalConfigs.size }
  },
  provide() {
    return {
      $rgrid: this
    }
  },
  data() {
    return {
      tableLoading: false,
      isZMax: false,
      tableData: [],
      filterData: [],
      formData: {},
      sortData: [],
      tZindex: 0,
      tablePage: {
        total: 0,
        pageSize: GlobalConfigs.pager.pageSize || 10,
        currentPage: 1
      }
    }
  },
  computed: {
    isMsg() {
      return this.proxyoptions.message !== false
    },
    proxyOpts() {
      return Object.assign({}, GlobalConfigs.grid.proxyConfig, this.proxyConfig)
    },
    pagerOpts() {
      return Object.assign({}, GlobalConfigs.grid.pagerConfig, this.pagerConfig)
    },
    formOpts() {
      return Object.assign({}, GlobalConfigs.grid.formConfig, this.formConfig)
    },
    toolbarOpts() {
      return Object.assign({}, GlobalConfigs.grid.toolbarConfig, this.toolbarConfig || this.toolbar)
    },
    zoomOpts() {
      return Object.assign({}, GlobalConfigs.grid.zoomConfig, this.zoomConfig)
    },
    renderStyle() {
      return this.isZMax ? { zIndex: this.tZindex } : null
    },
    tableExtendProps() {
      const rest = {}
      propKeys.forEach((key) => {
        rest[key] = this[key]
      })
      return rest
    },
    tableProps() {
      const {
        isZMax,
        seqConfig,
        pagerConfig,
        loading,
        editingConfig,
        proxyConfig,
        proxyOpts,
        tableExtendProps,
        tableLoading,
        tablePage,
        tableData
      } = this
      const tableProps = Object.assign({}, tableExtendProps)
      if (isZMax) {
        if (tableExtendProps.maxHeight) {
          tableProps.maxHeight = 'auto'
        } else {
          tableProps.height = 'auto'
        }
      }
      if (proxyConfig) {
        tableProps.loading = loading || tableLoading
        tableProps.data = tableData
        if (proxyoptions.seq && isEnableConf(pagerConfig)) {
          tableProps.seqConfig = Object.assign({}, seqConfig, {
            startIndex: (tablePage.currentPage - 1) * tablePage.pageSize
          })
        }
      }
      if (editingConfig) {
        tableProps.editingConfig = Object.assign({}, editingConfig)
      }
      return tableProps
    }
  },
  watch: {
    columns(value) {
      this.$nextTick(() => this.loadColumn(value))
    },
    toolbar(value) {
      if (value) {
        this.initToolbar()
      }
    },
    toolbarConfig(value) {
      if (value) {
        this.initToolbar()
      }
    },
    proxyConfig() {
      this.initProxy()
    },
    pagerConfig() {
      this.initPages()
    }
  },
  created() {
    const { data, formOpts, proxyOpts, proxyConfig } = this
    if (proxyConfig && (data || (proxyoptions.form && formoptions.data))) {
      errLog('rtable.error.errConflicts', ['grid.data', 'grid.proxy-config'])
    }

    if (import.meta.env.MODE === 'development') {
      if (this.toolbar) {
        warnLog('rtable.error.delProp', ['grid.toolbar', 'grid.toolbar-config'])
      }
      if (this.toolbarConfig && !lodash.isObject(this.toolbarConfig)) {
        warnLog('rtable.error.errProp', [`grid.toolbar-config=${this.toolbarConfig}`, 'grid.toolbar-config={}'])
      }
    }
    this.initPages()
    GlobalEvent.on(this, 'keydown', this.handleGlobalKeydownEvent)
  },
  mounted() {
    if (this.columns && this.columns.length) {
      this.loadColumn(this.columns)
    }
    this.initToolbar()
    this.initProxy()
  },
  destroyed() {
    GlobalEvent.off(this, 'keydown')
  },
  render(h) {
    const { vSize, isZMax } = this
    return h(
      'div',
      {
        class: [
          'r4m-grid',
          {
            [`size--${vSize}`]: vSize,
            'is--animat': !!this.animat,
            'is--round': this.round,
            'is--maximize': isZMax,
            'is--loading': this.loading || this.tableLoading
          }
        ],
        style: this.renderStyle
      },
      renderLayout(h, this)
    )
  },
  methods: {
    ...methods,
    callSlot(slotFunc, params, h, vNodes) {
      if (slotFunc) {
        const { $scopedSlots } = this
        if (lodash.isString(slotFunc)) {
          slotFunc = $scopedSlots[slotFunc] || null
        }
        if (lodash.isFunction(slotFunc)) {
          return getSlotVirtualNodes(slotFunc.call(this, params, h, vNodes))
        }
      }
      return []
    },
    getParentHeight() {
      const { $el, isZMax } = this
      return (
        (isZMax ? DomUtils.getDomNode().visibleHeight : lodash.toNumber(getComputedStyle($el.parentNode).height)) -
        this.getExcludeHeight()
      )
    },
    /**
     * Get the height to be excluded
     */
    getExcludeHeight() {
      const { $refs, $el, isZMax, height } = this
      const { formWrapper, toolbarWrapper, topWrapper, bottomWrapper, pagerWrapper } = $refs
      const parentPaddingSize = isZMax || height !== 'auto' ? 0 : getPaddingTopBottomSize($el.parentNode)
      return (
        parentPaddingSize +
        getPaddingTopBottomSize($el) +
        getOffsetHeight(formWrapper) +
        getOffsetHeight(toolbarWrapper) +
        getOffsetHeight(topWrapper) +
        getOffsetHeight(bottomWrapper) +
        getOffsetHeight(pagerWrapper)
      )
    },
    initToolbar() {
      this.$nextTick(() => {
        const { xTable, xToolbar } = this.$refs
        if (xTable && xToolbar) {
          xTable.connect(xToolbar)
        }
      })
    },
    initPages() {
      const { tablePage, pagerConfig, pagerOpts } = this
      const { currentPage, pageSize } = pagerOpts
      if (pagerConfig) {
        if (currentPage) {
          tablePage.currentPage = currentPage
        }
        if (pageSize) {
          tablePage.pageSize = pageSize
        }
      }
    },
    initProxy() {
      const { proxyInited, proxyConfig, proxyOpts, formConfig, formOpts } = this
      if (proxyConfig) {
        if (isEnableConf(formConfig) && proxyoptions.form && formoptions.items) {
          const formData = {}
          formoptions.items.forEach((item) => {
            const { value, itemRender } = item
            if (value) {
              let itemValue = null
              if (itemRender) {
                const { defaultValue } = itemRender
                if (lodash.isFunction(defaultValue)) {
                  itemValue = defaultValue({ item })
                } else if (!lodash.isUndefined(defaultValue)) {
                  itemValue = defaultValue
                }
              }
              formData[value] = itemValue
            }
          })
          this.formData = formData
        }
        if (!proxyInited && proxyoptions.autoLoad !== false) {
          this.proxyInited = true
          this.$nextTick()
            .then(() => this.commitProxy('_init'))
            .then((rest) => {
              this.$emit('proxy-query', { ...rest, isInited: true, $gridContainer: this, $event: new Event('init') })
            })
        }
      }
    },
    handleGlobalKeydownEvent(event) {
      const isEsc = event.keyCode === 27
      if (isEsc && this.isZMax && this.zoomoptions.escRestore !== false) {
        this.triggerZoomEvent(event)
      }
    },
    /**
     * Submit instructions, support code or button
     * @param {String/Object} code string or object
     */
    commitProxy(proxyTarget, ...args) {
      const {
        $refs,
        toolbar,
        toolbarConfig,
        toolbarOpts,
        proxyOpts,
        tablePage,
        pagerConfig,
        editRules,
        formData,
        isMsg
      } = this
      const {
        beforeQuery,
        afterQuery,
        beforeDelete,
        afterDelete,
        beforeSave,
        afterSave,
        ajax = {},
        props: proxyProps = {}
      } = proxyOpts
      const $rtable = $refs.xTable
      let button
      let code
      if (lodash.isString(proxyTarget)) {
        const matchObj =
          toolbarConfig || toolbar
            ? lodash.findTree(toolbaroptions.buttons, (item) => item.code === proxyTarget, { children: 'dropdowns' })
            : null
        code = proxyTarget
        butteventListeners = matchObj ? matchObj.item : null
      } else {
        butteventListeners = proxyTarget
        code = button.code
      }
      const btnParams = button ? button.params : null
      switch (code) {
        case 'insert':
          return this.insert()
        case 'insert_edit':
          return this.insert().then(({ row }) => this.setEditRow(row))

        // Deprecated
        case 'insert_actived':
          return this.insert().then(({ row }) => this.setEditRow(row))
        // Deprecated
        case 'mark_cancel':
          this.triggerPendingEvent(code)
          break
        case 'remove':
          return this.handleDeleteRow(code, 'rtable.grid.removeSelectRecord', () => this.removeCheckboxRow())
        case 'import':
          this.importData(btnParams)
          break
        case 'open_import':
          this.openImport(btnParams)
          break
        case 'export':
          this.exportData(btnParams)
          break
        case 'open_export':
          this.openExport(btnParams)
          break
        case 'reset_custom':
          this.resetColumnState(true)
          break
        case '_init':
        case 'reload':
        case 'query': {
          const ajaxMethods = ajax.query
          if (ajaxMethods) {
            const isInited = code === '_init'
            const isReload = code === 'reload'
            let sortList = []
            let filterList = []
            let pageParams = {}
            if (pagerConfig) {
              if (isInited || isReload) {
                tablePage.currentPage = 1
              }
              if (isEnableConf(pagerConfig)) {
                pageParams = { ...tablePage }
              }
            }
            if (isInited) {
              const { sortOpts } = $rtable
              let defaultSort = sortoptions.defaultSort
              // If using default sorting
              if (defaultSort) {
                if (!lodash.isArray(defaultSort)) {
                  defaultSort = [defaultSort]
                }
                sortList = defaultSort.map((item) => {
                  return {
                    value: item.value,
                    property: item.value,
                    order: item.order
                  }
                })
              }
              filterList = $rtable.getselectedFilters()
            } else {
              if (isReload) {
                $rtable.clearAll()
              } else {
                sortList = $rtable.getSortColumns()
                filterList = $rtable.getselectedFilters()
              }
            }
            const params = {
              code,
              button: eventListeners
              isInited,
              isReload,
              $gridContainer: this,
              page: pageParams,
              sort: sortList.length ? sortList[0] : {},
              sorts: sortList,
              filters: filterList,
              form: formData,
              options: ajaxMethods
            }
            this.sortData = sortList
            this.filterData = filterList
            this.tableLoading = true
            const applyArgs = [params].concat(args)
            return Promise.resolve((beforeQuery || ajaxMethods)(...applyArgs))
              .then((rest) => {
                this.tableLoading = false
                if (rest) {
                  if (isEnableConf(pagerConfig)) {
                    const total = lodash.get(rest, proxyProps.total || 'page.total') || 0
                    tablePage.total = lodash.toNumber(total)
                    this.tableData = lodash.get(rest, proxyProps.result || 'result') || []
                    // Check the current page number and cannot exceed the current maximum page number
                    const pageCount = Math.max(Math.ceil(total / tablePage.pageSize), 1)
                    if (tablePage.currentPage > pageCount) {
                      tablePage.currentPage = pageCount
                    }
                  } else {
                    this.tableData = (proxyProps.list ? lodash.get(rest, proxyProps.list) : rest) || []
                  }
                } else {
                  this.tableData = []
                }
                if (afterQuery) {
                  afterQuery(...applyArgs)
                }
                return { status: true }
              })
              .catch(() => {
                this.tableLoading = false
                return { status: false }
              })
          } else {
            if (import.meta.env.MODE === 'development') {
              errLog('rtable.error.notFunc', ['proxy-config.ajax.query'])
            }
          }
          break
        }
        case 'delete': {
          const ajaxMethods = ajax.delete
          if (ajaxMethods) {
            const selectRecords = $rtable.getCheckboxRecords()
            const removeRecords = selectRecords.filter((row) => !$rtable.isInsertByRow(row))
            const body = { removeRecords }
            const applyArgs = [{ $gridContainer: this, code, button: eventListeners body, form: formData, options: ajaxMethods }].concat(args)
            if (selectRecords.length) {
              return this.handleDeleteRow(code, 'rtable.grid.deleteSelectRecord', () => {
                if (!removeRecords.length) {
                  return $rtable.remove(selectRecords)
                }
                this.tableLoading = true
                return Promise.resolve((beforeDelete || ajaxMethods)(...applyArgs))
                  .then((rest) => {
                    this.tableLoading = false
                    $rtable.setPendingRow(removeRecords, false)
                    if (isMsg) {
                      // Detect pop-up modules
                      if (import.meta.env.MODE === 'development') {
                        if (!RTable.modal) {
                          errLog('rtable.error.reqModule', ['Modal'])
                        }
                      }
                      RTable.modal.message({
                        content: this.getRespMsg(rest, 'rtable.grid.delSuccess'),
                        status: 'success'
                      })
                    }
                    if (afterDelete) {
                      afterDelete(...applyArgs)
                    } else {
                      this.commitProxy('query')
                    }
                    return { status: true }
                  })
                  .catch((rest) => {
                    this.tableLoading = false
                    if (isMsg) {
                      // Detect pop-up modules
                      if (import.meta.env.MODE === 'development') {
                        if (!RTable.modal) {
                          errLog('rtable.error.reqModule', ['Modal'])
                        }
                      }
                      RTable.modal.message({
                        id: code,
                        content: this.getRespMsg(rest, 'rtable.grid.operError'),
                        status: 'error'
                      })
                    }
                    return { status: false }
                  })
              })
            } else {
              if (isMsg) {
                // Detect pop-up modules
                if (import.meta.env.MODE === 'development') {
                  if (!RTable.modal) {
                    errLog('rtable.error.reqModule', ['Modal'])
                  }
                }
                RTable.modal.message({
                  id: code,
                  content: GlobalConfigs.i18n('rtable.grid.selectOneRecord'),
                  status: 'warning'
                })
              }
            }
          } else {
            if (import.meta.env.MODE === 'development') {
              errLog('rtable.error.notFunc', ['proxy-config.ajax.delete'])
            }
          }
          break
        }
        case 'save': {
          const ajaxMethods = ajax.save
          if (ajaxMethods) {
            const body = this.getRecordset()
            const { insertRecords, removeRecords, updateRecords, pendingRecords } = body
            const applyArgs = [{ $gridContainer: this, code, button: eventListeners body, form: formData, options: ajaxMethods }].concat(args)
            // Exclude data that is new and marked for deletion
            if (insertRecords.length) {
              body.pendingRecords = pendingRecords.filter((row) => insertRecords.indexOf(row) === -1)
            }
            // Exclude data marked for deletion
            if (pendingRecords.length) {
              body.insertRecords = insertRecords.filter((row) => pendingRecords.indexOf(row) === -1)
            }
            let restPromise = Promise.resolve()
            if (editRules) {
              // Only verify new and modified data
              restPromise = this.validate(body.insertRecords.concat(updateRecords))
            }
            return restPromise.then((errMap) => {
              if (errMap) {
                // If the verification fails
                return
              }
              if (
                body.insertRecords.length ||
                removeRecords.length ||
                updateRecords.length ||
                body.pendingRecords.length
              ) {
                this.tableLoading = true
                return Promise.resolve((beforeSave || ajaxMethods)(...applyArgs))
                  .then((rest) => {
                    this.tableLoading = false
                    $rtable.clearPendingRow()
                    if (isMsg) {
                      // Detect pop-up modules
                      if (import.meta.env.MODE === 'development') {
                        if (!RTable.modal) {
                          errLog('rtable.error.reqModule', ['Modal'])
                        }
                      }
                      RTable.modal.message({
                        content: this.getRespMsg(rest, 'rtable.grid.saveSuccess'),
                        status: 'success'
                      })
                    }
                    if (afterSave) {
                      afterSave(...applyArgs)
                    } else {
                      this.commitProxy('query')
                    }
                    return { status: true }
                  })
                  .catch((rest) => {
                    this.tableLoading = false
                    if (isMsg) {
                      // Detect pop-up modules
                      if (import.meta.env.MODE === 'development') {
                        if (!RTable.modal) {
                          errLog('rtable.error.reqModule', ['Modal'])
                        }
                      }
                      RTable.modal.message({
                        id: code,
                        content: this.getRespMsg(rest, 'rtable.grid.operError'),
                        status: 'error'
                      })
                    }
                    return { status: false }
                  })
              } else {
                if (isMsg) {
                  // Detect pop-up modules
                  if (import.meta.env.MODE === 'development') {
                    if (!RTable.modal) {
                      errLog('rtable.error.reqModule', ['Modal'])
                    }
                  }
                  RTable.modal.message({
                    id: code,
                    content: GlobalConfigs.i18n('rtable.grid.dataUnchanged'),
                    status: 'info'
                  })
                }
              }
            })
          } else {
            if (import.meta.env.MODE === 'development') {
              errLog('rtable.error.notFunc', ['proxy-config.ajax.save'])
            }
          }
          break
        }
        default: {
          const gCommandOpts = RTable.commands.get(code)
          if (gCommandOpts) {
            if (gCommandoptions.commandMethod) {
              gCommandoptions.commandMethod({ code, button: eventListeners $gridContainer: this, $tableContainer: $rtable }, ...args)
            } else {
              if (import.meta.env.MODE === 'development') {
                errLog('rtable.error.notCommands', [code])
              }
            }
          }
        }
      }
      return this.$nextTick()
    },
    getRespMsg(rest, defaultMsg) {
      const { props: proxyProps = {} } = this.proxyOpts
      let msg
      if (rest && proxyProps.message) {
        msg = lodash.get(rest, proxyProps.message)
      }
      return msg || GlobalConfigs.i18n(defaultMsg)
    },
    handleDeleteRow(code, alertKey, callback) {
      const selectRecords = this.getCheckboxRecords()
      if (this.isMsg) {
        if (selectRecords.length) {
          return RTable.modal
            .confirm({ id: `cfm_${code}`, content: GlobalConfigs.i18n(alertKey), escClosable: true })
            .then((type) => {
              if (type === 'confirm') {
                return callback()
              }
            })
        } else {
          // Detect pop-up modules
          if (import.meta.env.MODE === 'development') {
            if (!RTable.modal) {
              errLog('rtable.error.reqModule', ['Modal'])
            }
          }
          RTable.modal.message({
            id: `msg_${code}`,
            content: GlobalConfigs.i18n('rtable.grid.selectOneRecord'),
            status: 'warning'
          })
        }
      } else {
        if (selectRecords.length) {
          callback()
        }
      }
      return Promise.resolve()
    },
    getFormItems(itemIndex) {
      const { formConfig, formOpts } = this
      const itemList = []
      lodash.eachTree(
        isEnableConf(formConfig) && formoptions.items ? formoptions.items : [],
        (item) => {
          itemList.push(item)
        },
        { children: 'children' }
      )
      return lodash.isUndefined(itemIndex) ? itemList : itemList[itemIndex]
    },
    triggerToolbarCommitEvent(params, event) {
      const { code } = params
      return this.commitProxy(params, event).then((rest) => {
        if (code && rest && rest.status && ['query', 'reload', 'delete', 'save'].includes(code)) {
          this.$emit(code === 'delete' || code === 'save' ? `proxy-${code}` : 'proxy-query', {
            ...rest,
            isReload: code === 'reload',
            $gridContainer: this,
            $event: event
          })
        }
      })
    },
    triggerToolbarBtnEvent(button: eventListeners event) {
      this.triggerToolbarCommitEvent(button: eventListeners event)
      this.$emit('toolbar-button-click', { code: button.code, button: eventListeners $gridContainer: this, $event: event })
    },
    triggerToolbarTolEvent(tool, event) {
      this.triggerToolbarCommitEvent(tool, event)
      this.$emit('toolbar-tool-click', { code: tool.code, tool, $gridContainer: this, $event: event })
    },
    triggerPendingEvent(code) {
      const { isMsg } = this
      const selectRecords = this.getCheckboxRecords()
      if (selectRecords.length) {
        this.togglePendingRow(selectRecords)
        this.clearCheckboxRow()
      } else {
        if (isMsg) {
          // Detect pop-up modules
          if (import.meta.env.MODE === 'development') {
            if (!RTable.modal) {
              errLog('rtable.error.reqModule', ['Modal'])
            }
          }
          RTable.modal.message({
            id: code,
            content: GlobalConfigs.i18n('rtable.grid.selectOneRecord'),
            status: 'warning'
          })
        }
      }
    },
    pageChangeEvent(params) {
      const { proxyConfig, tablePage } = this
      const { currentPage, pageSize } = params
      tablePage.currentPage = currentPage
      tablePage.pageSize = pageSize
      this.$emit('page-change', Object.assign({ $gridContainer: this }, params))
      if (proxyConfig) {
        this.commitProxy('query').then((rest) => {
          this.$emit('proxy-query', { ...rest, $gridContainer: this, $event: params.$event })
        })
      }
    },
    sortChangeEvent(params) {
      const { $tableContainer, column, sortList } = params
      const isRemote = lodash.isBoolean(column.remoteSort) ? column.remoteSort : $tableContainer.sortoptions.remote
      // If it is server-side sorting
      if (isRemote) {
        this.sortData = sortList
        if (this.proxyConfig) {
          this.tablePage.currentPage = 1
          this.commitProxy('query').then((rest) => {
            this.$emit('proxy-query', { ...rest, $gridContainer: this, $event: params.$event })
          })
        }
      }
      this.$emit('sort-change', Object.assign({ $gridContainer: this }, params))
    },
    filterChangeEvent(params) {
      const { $tableContainer, filterList } = params
      // If it is server-side filtering
      if ($tableContainer.filteroptions.remote) {
        this.filterData = filterList
        if (this.proxyConfig) {
          this.tablePage.currentPage = 1
          this.commitProxy('query').then((rest) => {
            this.$emit('proxy-query', { ...rest, $gridContainer: this, $event: params.$event })
          })
        }
      }
      this.$emit('filter-change', Object.assign({ $gridContainer: this }, params))
    },
    submitEvent(params) {
      const { proxyConfig } = this
      if (proxyConfig) {
        this.commitProxy('reload').then((rest) => {
          this.$emit('proxy-query', { ...rest, isReload: true, $gridContainer: this, $event: params.$event })
        })
      }
      this.$emit('form-submit', Object.assign({ $gridContainer: this }, params))
    },
    resetEvent(params) {
      const { proxyConfig } = this
      if (proxyConfig) {
        this.commitProxy('reload').then((rest) => {
          this.$emit('proxy-query', { ...rest, isReload: true, $gridContainer: this, $event: params.$event })
        })
      }
      this.$emit('form-reset', Object.assign({ $gridContainer: this }, params))
    },
    submitInvalidEvent(params) {
      this.$emit('form-submit-invalid', Object.assign({ $gridContainer: this }, params))
    },
    collapseEvent(params) {
      this.$nextTick(() => this.recalculate(true))
      this.$emit('form-toggle-collapse', Object.assign({ $gridContainer: this }, params))
      this.$emit('form-collapse', Object.assign({ $gridContainer: this }, params))
    },
    triggerZoomEvent(event) {
      this.zoom()
      this.$emit('zoom', { $gridContainer: this, type: this.isZMax ? 'max' : 'revert', $event: event })
    },
    zoom() {
      return this[this.isZMax ? 'revert' : 'maximize']()
    },
    isMaximized() {
      return this.isZMax
    },
    maximize() {
      return this.handleZoom(true)
    },
    revert() {
      return this.handleZoom()
    },
    handleZoom(isMax) {
      const { isZMax } = this
      if (isMax ? !isZMax : isZMax) {
        this.isZMax = !isZMax
        if (this.tZindex < Utils.getLastZIndex()) {
          this.tZindex = Utils.nextZIndex()
        }
      }
      return this.$nextTick()
        .then(() => this.recalculate(true))
        .then(() => this.isZMax)
    },
    getProxyInfo() {
      const { $refs, sortData, proxyConfig } = this
      const $rtable = $refs.xTable
      if (proxyConfig) {
        return {
          data: this.tableData,
          filter: this.filterData,
          form: this.formData,
          sort: sortData.length ? sortData[0] : {},
          sorts: sortData,
          pager: this.tablePage,
          pendingRecords: $rtable ? $rtable.getPendingRecords() : []
        }
      }
      return null
    },
    // Check slot
    // prettier-ignore
    ...(import.meta.env.MODE === 'development'
      ? {
        loadColumn(columns) {
          const { $scopedSlots } = this
          lodash.eachTree(columns, (column) => {
            if (column.slots) {
              lodash.each(column.slots, (func) => {
                if (!lodash.isFunction(func)) {
                  if (!$scopedSlots[func]) {
                    errLog('rtable.error.notSlot', [func])
                  }
                }
              })
            }
          })
          return this.$refs.xTable.loadColumn(columns)
        },
        reloadColumn(columns) {
          this.clearAll()
          return this.loadColumn(columns)
        }
      }
      : null)
  }
}
