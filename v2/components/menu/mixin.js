import lodash from 'lodash'
import Utils, { isEnableConf } from '../tools/utils'
import DomUtils from '../tools/dom'
import RTable from '../r-datatable'
import { warnLog } from '../tools/log'

export default {
  methods: {
    /**
     * Close context menu
     */
    _closeMenu() {
      Object.assign(this.ctxMenuStore, {
        visible: false,
        selected: null,
        selectChild: null,
        showChild: false
      })
      return this.$nextTick()
    },
    // Handle menu movement
    moveCtxMenu(event, keyCode, ctxMenuStore, property, operKey, operRest, menuList) {
      let selectItem
      const selectIndex = lodash.findIndexOf(menuList, (item) => ctxMenuStore[property] === item)
      if (keyCode === operKey) {
        if (operRest && Utils.hasChildrenList(ctxMenuStore.selected)) {
          ctxMenuStore.showChild = true
        } else {
          ctxMenuStore.showChild = false
          ctxMenuStore.selectChild = null
        }
      } else if (keyCode === 38) {
        for (let len = selectIndex - 1; len >= 0; len--) {
          if (menuList[len].visible !== false) {
            selectItem = menuList[len]
            break
          }
        }
        ctxMenuStore[property] = selectItem || menuList[menuList.length - 1]
      } else if (keyCode === 40) {
        for (let index = selectIndex + 1; index < menuList.length; index++) {
          if (menuList[index].visible !== false) {
            selectItem = menuList[index]
            break
          }
        }
        ctxMenuStore[property] = selectItem || menuList[0]
      } else if (ctxMenuStore[property] && (keyCode === 13 || keyCode === 32)) {
        this.ctxMenuLinkEvent(event, ctxMenuStore[property])
      }
    },
    /**
     * Shortcut menu event handling
     */
    handleGlobalContextmenuEvent(event) {
      const { $refs, tId, editingStore, menuConfig, contextMenu, ctxMenuStore, ctxMenuOpts, mouseConfig, mouseOpts } = this
      const { selected } = editingStore
      const layoutList = ['header', 'body', 'footer']
      if (isEnableConf(menuConfig) || contextMenu) {
        if (ctxMenuStore.visible && $refs.ctxWrapper && DomUtils.getEventTargetNode(event, $refs.ctxWrapper.$el).flag) {
          event.preventDefault()
          return
        }
        if (this._keyCtx) {
          const type = 'body'
          const params = {
            type,
            $gridContainer: this.$rgrid,
            $tableContainer: this,
            keyboard: true,
            columns: this.visibleColumn.slice(0),
            $event: event
          }
          // If you enable a cell range
          if (mouseConfig && mouseoptions.area) {
            const activeArea = this.getActiveCellArea()
            if (activeArea && activeArea.row && activeArea.column) {
              params.row = activeArea.row
              params.column = activeArea.column
              this.openContextMenu(event, type, params)
              return
            }
          } else if (mouseConfig && mouseoptions.selected) {
            // If keyboard navigation is enabled and a cell is selected
            if (selected.row && selected.column) {
              params.row = selected.row
              params.column = selected.column
              this.openContextMenu(event, type, params)
              return
            }
          }
        }
        // Match the shortcut menu of table footer, content and table footer respectively.
        for (let index = 0; index < layoutList.length; index++) {
          const layout = layoutList[index]
          const columnTargetNode = DomUtils.getEventTargetNode(event, this.$el, `r-table-${layout}--column`, (target) => {
            // target=td|th，Just look up the table to match it
            return target.parentNode.parentNode.parentNode.getAttribute('xid') === tId
          })
          const params = {
            type: layout,
            $gridContainer: this.$rgrid,
            $tableContainer: this,
            columns: this.visibleColumn.slice(0),
            $event: event
          }
          if (columnTargetNode.flag) {
            const cell = columnTargetNode.targetElem
            const column = this.getColumnNode(cell).item
            let typePrefix = `${layout}-`
            Object.assign(params, { column, columnIndex: this.getColumnIndex(column), cell })
            if (layout === 'body') {
              const row = this.getRowNode(cell.parentNode).item
              typePrefix = ''
              params.row = row
              params.rowIndex = this.getRowIndex(row)
            }
            this.openContextMenu(event, layout, params)
            // Deprecated events cell-context-menu, header-cell-context-menu, footer-cell-context-menu in v4
            if (this.$listeners[`${typePrefix}cell-context-menu`]) {
              if (import.meta.env.MODE === 'development') {
                warnLog('rtable.error.delEvent', [`${typePrefix}cell-context-menu`, `${typePrefix}cell-menu`])
              }
              this.emitEvent(`${typePrefix}cell-context-menu`, params, event)
            } else {
              this.emitEvent(`${typePrefix}cell-menu`, params, event)
            }
            return
          } else if (
            DomUtils.getEventTargetNode(
              event,
              this.$el,
              `r4m-table--${layout}-wrapper`,
              (target) => target.getAttribute('xid') === tId
            ).flag
          ) {
            if (ctxMenuoptions.trigger === 'cell') {
              event.preventDefault()
            } else {
              this.openContextMenu(event, layout, params)
            }
            return
          }
        }
      }
      if ($refs.filterWrapper && !DomUtils.getEventTargetNode(event, $refs.filterWrapper.$el).flag) {
        this.closeFilter()
      }
      this.closeMenu()
    },
    /**
     * Show shortcut menu
     */
    openContextMenu(event, type, params) {
      const { isCtxMenu, ctxMenuStore, ctxMenuOpts } = this
      const config = ctxMenuOpts[type]
      const visibleMethod = ctxMenuoptions.visibleMethod
      if (config) {
        const { options, disabled } = config
        if (disabled) {
          event.preventDefault()
        } else if (isCtxMenu && options && options.length) {
          params.options = options
          this.preventEvent(event, 'event.showMenu', params, () => {
            if (!visibleMethod || visibleMethod(params)) {
              event.preventDefault()
              this.updateZindex()
              const { scrollTop, scrollLeft, visibleHeight, visibleWidth } = DomUtils.getDomNode()
              let top = event.clientY + scrollTop
              let left = event.clientX + scrollLeft
              const handleVisible = () => {
                Object.assign(ctxMenuStore, {
                  args: params,
                  visible: true,
                  list: options,
                  selected: null,
                  selectChild: null,
                  showChild: false,
                  style: {
                    zIndex: this.tZindex,
                    top: `${top}px`,
                    left: `${left}px`
                  }
                })
                this.$nextTick(() => {
                  const ctxElem = this.$refs.ctxWrapper.$el
                  const clientHeight = ctxElem.clientHeight
                  const clientWidth = ctxElem.clientWidth
                  const { boundingTop, boundingLeft } = DomUtils.getAbsolutePos(ctxElem)
                  const offsetTop = boundingTop + clientHeight - visibleHeight
                  const offsetLeft = boundingLeft + clientWidth - visibleWidth
                  if (offsetTop > -10) {
                    ctxMenuStore.style.top = `${Math.max(scrollTop + 2, top - clientHeight - 2)}px`
                  }
                  if (offsetLeft > -10) {
                    ctxMenuStore.style.left = `${Math.max(scrollLeft + 2, left - clientWidth - 2)}px`
                  }
                })
              }
              const { keyboard, row, column } = params
              if (keyboard && row && column) {
                this.scrollToRow(row, column).then(() => {
                  const cell = this.getCell(row, column)
                  const { boundingTop, boundingLeft } = DomUtils.getAbsolutePos(cell)
                  top = boundingTop + scrollTop + Math.floor(cell.offsetHeight / 2)
                  left = boundingLeft + scrollLeft + Math.floor(cell.offsetWidth / 2)
                  handleVisible()
                })
              } else {
                handleVisible()
              }
            } else {
              this.closeMenu()
            }
          })
        }
      }
      this.closeFilter()
    },
    ctxMenuMouseoverEvent(event, item, child) {
      const menuElem = event.currentTarget
      const ctxMenuStore = this.ctxMenuStore
      event.preventDefault()
      event.stopPropagation()
      ctxMenuStore.selected = item
      ctxMenuStore.selectChild = child
      if (!child) {
        ctxMenuStore.showChild = Utils.hasChildrenList(item)
        if (ctxMenuStore.showChild) {
          this.$nextTick(() => {
            const childWrapperElem = menuElem.nextElementSibling
            if (childWrapperElem) {
              const { boundingTop, boundingLeft, visibleHeight, visibleWidth } = DomUtils.getAbsolutePos(menuElem)
              const posTop = boundingTop + menuElem.offsetHeight
              const posLeft = boundingLeft + menuElem.offsetWidth
              let left = ''
              let right = ''
              // Whether it exceeds the right side
              if (posLeft + childWrapperElem.offsetWidth > visibleWidth - 10) {
                left = 'auto'
                right = `${menuElem.offsetWidth}px`
              }
              // Whether it is beyond the bottom
              let top = ''
              let bottom = ''
              if (posTop + childWrapperElem.offsetHeight > visibleHeight - 10) {
                top = 'auto'
                bottom = '0'
              }
              childWrapperElem.style.left = left
              childWrapperElem.style.right = right
              childWrapperElem.style.top = top
              childWrapperElem.style.bottom = bottom
            }
          })
        }
      }
    },
    ctxMenuMouseoutEvent(event, item) {
      const ctxMenuStore = this.ctxMenuStore
      if (!item.children) {
        ctxMenuStore.selected = null
      }
      ctxMenuStore.selectChild = null
    },
    /**
     * Shortcut menu click event
     */
    ctxMenuLinkEvent(event, menu) {
      // If the first-level menu is configured with code, clicks are allowed, otherwise clicks are not allowed.
      if (!menu.disabled && (menu.code || !menu.children || !menu.children.length)) {
        const gMenuOpts = RTable.menus.get(menu.code)
        const params = Object.assign({ menu, $gridContainer: this.$rgrid, $tableContainer: this, $event: event }, this.ctxMenuStore.args)
        if (gMenuOpts && gMenuoptions.menuMethod) {
          gMenuoptions.menuMethod(params, event)
        }
        // Events deprecated in v4 context-menu-click
        if (this.$listeners['context-menu-click']) {
          if (import.meta.env.MODE === 'development') {
            warnLog('rtable.error.delEvent', ['context-menu-click', 'menu-click'])
          }
          this.emitEvent('context-menu-click', params, event)
        } else {
          this.emitEvent('menu-click', params, event)
        }
        this.closeMenu()
      }
    }
  }
}
