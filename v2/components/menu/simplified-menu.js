import DomUtils from '../tools/dom'
import { warnLog } from '../tools/log'

export default {
  methods: {
    /**
     * Shortcut menu event handling
     */
    handleGlobalContextmenuEvent(event) {
      const { tId } = this
      const layoutList = ['header', 'body', 'footer']

      // Match the shortcut menu of table footer, content and table footer respectively.
      for (let index = 0; index < layoutList.length; index++) {
        const layout = layoutList[index]
        // eslint-disable-next-line max-len
        const columnTargetNode = DomUtils.getEventTargetNode(
          event,
          this.$el,
          `r4m-table-${layout}--column`,
          (target) => {
            // target=td|th，Just look up the table to match it
            return target.parentNode.parentNode.parentNode.getAttribute('xid') === tId
          }
        )
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
            event.preventDefault()
            const row = this.getRowNode(cell.parentNode).item
            typePrefix = ''
            params.row = row
            params.rowIndex = this.getRowIndex(row)
          }
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
        }
      }
    }
  }
}
