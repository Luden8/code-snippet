import lodash from 'lodash'
import DomUtils, { browse } from '../tools/dom'

function getTargetOffset(target, container) {
  let offsetTop = 0
  let offsetLeft = 0
  const triggerCheckboxLabel = !browse.firefox && DomUtils.hasClass(target, 'r-table-checkbox--label')
  if (triggerCheckboxLabel) {
    const checkboxLabelStyle = getComputedStyle(target)
    offsetTop -= lodash.toNumber(checkboxLabelStyle.paddingTop)
    offsetLeft -= lodash.toNumber(checkboxLabelStyle.paddingLeft)
  }
  while (target && target !== container) {
    offsetTop += target.offsetTop
    offsetLeft += target.offsetLeft
    target = target.offsetParent
    if (triggerCheckboxLabel) {
      const checkboxStyle = getComputedStyle(target)
      offsetTop -= lodash.toNumber(checkboxStyle.paddingTop)
      offsetLeft -= lodash.toNumber(checkboxStyle.paddingLeft)
    }
  }
  return { offsetTop, offsetLeft }
}

function getCheckboxRangeRows(_vm, params, targetTrElem, moveRange) {
  let countHeight = 0
  let rangeRows = []
  const isDown = moveRange > 0
  const moveSize = moveRange > 0 ? moveRange : Math.abs(moveRange) + targetTrElem.offsetHeight
  const { afterfullRowsData, scrollYState, virtualScrollYLoad } = _vm
  if (virtualScrollYLoad) {
    const _rowIndex = _vm.getVTRowIndex(params.row)
    if (isDown) {
      rangeRows = afterfullRowsData.slice(_rowIndex, _rowIndex + Math.ceil(moveSize / scrollYState.rowHeight))
    } else {
      rangeRows = afterfullRowsData.slice(_rowIndex - Math.floor(moveSize / scrollYState.rowHeight) + 1, _rowIndex + 1)
    }
  } else {
    const siblingProp = isDown ? 'next' : 'previous'
    while (targetTrElem && countHeight < moveSize) {
      rangeRows.push(_vm.getRowNode(targetTrElem).item)
      countHeight += targetTrElem.offsetHeight
      targetTrElem = targetTrElem[`${siblingProp}ElementSibling`]
    }
  }
  return rangeRows
}

export default {
  methods: {
    //  Tab 
    moveTabSelected(args, isLeft, event) {
      const { afterfullRowsData, visibleColumn, editingConfig, editingOptions } = this
      let targetRow
      let targetRowIndex
      let targetColumnIndex
      const params = Object.assign({}, args)
      const _rowIndex = this.getVTRowIndex(params.row)
      const _columnIndex = this.getVTColumnIndex(params.column)
      event.preventDefault()
      if (isLeft) {
        // 
        if (_columnIndex <= 0) {
          // ，
          if (_rowIndex > 0) {
            targetRowIndex = _rowIndex - 1
            targetRow = afterfullRowsData[targetRowIndex]
            targetColumnIndex = visibleColumn.length - 1
          }
        } else {
          targetColumnIndex = _columnIndex - 1
        }
      } else {
        if (_columnIndex >= visibleColumn.length - 1) {
          // ，
          if (_rowIndex < afterfullRowsData.length - 1) {
            targetRowIndex = _rowIndex + 1
            targetRow = afterfullRowsData[targetRowIndex]
            targetColumnIndex = 0
          }
        } else {
          targetColumnIndex = _columnIndex + 1
        }
      }
      const targetColumn = visibleColumn[targetColumnIndex]
      if (targetColumn) {
        if (targetRow) {
          params.rowIndex = targetRowIndex
          params.row = targetRow
        } else {
          params.rowIndex = _rowIndex
        }
        params.columnIndex = targetColumnIndex
        params.column = targetColumn
        params.cell = this.getCell(params.row, params.column)
        if (editingConfig) {
          if (editingOptions.trigger === 'click' || editingOptions.trigger === 'dblclick') {
            if (editingOptions.mode === 'row') {
              this.handleActived(params, event)
            } else {
              this.scrollToRow(params.row, params.column).then(() => this.handleSelected(params, event))
            }
          }
        } else {
          this.scrollToRow(params.row, params.column).then(() => this.handleSelected(params, event))
        }
      }
    },
    // 
    moveCurrentRow(isUpArrow, isDwArrow, event) {
      const { currentRow, treeConfig, treeOptions, afterfullRowsData } = this
      const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
      let targetRow
      event.preventDefault()
      if (currentRow) {
        if (treeConfig) {
          const { index, items } = lodash.findTree(afterfullRowsData, (item) => item === currentRow, {
            children: childrenAccessField
          })
          if (isUpArrow && index > 0) {
            targetRow = items[index - 1]
          } else if (isDwArrow && index < items.length - 1) {
            targetRow = items[index + 1]
          }
        } else {
          const _rowIndex = this.getVTRowIndex(currentRow)
          if (isUpArrow && _rowIndex > 0) {
            targetRow = afterfullRowsData[_rowIndex - 1]
          } else if (isDwArrow && _rowIndex < afterfullRowsData.length - 1) {
            targetRow = afterfullRowsData[_rowIndex + 1]
          }
        }
      } else {
        targetRow = afterfullRowsData[0]
      }
      if (targetRow) {
        const params = { $tableContainer: this, row: targetRow }
        this.scrollToRow(targetRow).then(() => this.triggerCurrentRowEvent(event, params))
      }
    },
    // 
    moveSelected(args, isLeftArrow, isUpArrow, isRightArrow, isDwArrow, event) {
      const { afterfullRowsData, visibleColumn } = this
      const params = Object.assign({}, args)
      const _rowIndex = this.getVTRowIndex(params.row)
      const _columnIndex = this.getVTColumnIndex(params.column)
      event.preventDefault()
      if (isUpArrow && _rowIndex > 0) {
        // 
        params.rowIndex = _rowIndex - 1
        params.row = afterfullRowsData[params.rowIndex]
      } else if (isDwArrow && _rowIndex < afterfullRowsData.length - 1) {
        // 
        params.rowIndex = _rowIndex + 1
        params.row = afterfullRowsData[params.rowIndex]
      } else if (isLeftArrow && _columnIndex) {
        // 
        params.columnIndex = _columnIndex - 1
        params.column = visibleColumn[params.columnIndex]
      } else if (isRightArrow && _columnIndex < visibleColumn.length - 1) {
        // 
        params.columnIndex = _columnIndex + 1
        params.column = visibleColumn[params.columnIndex]
      }
      this.scrollToRow(params.row, params.column).then(() => {
        params.cell = this.getCell(params.row, params.column)
        this.handleSelected(params, event)
      })
    },
    /**
     * 
     */
    triggerHeaderCellMousedownEvent(event, params) {
      const { mouseConfig, mouseOpts } = this
      if (mouseConfig && mouseoptions.area && this.handleHeaderCellAreaEvent) {
        const cell = event.currentTarget
        const triggerSort = DomUtils.getEventTargetNode(event, cell, 'r4m-table-cell--sort').flag
        const triggerFilter = DomUtils.getEventTargetNode(event, cell, 'r4m-table-cell--filter').flag
        this.handleHeaderCellAreaEvent(event, Object.assign({ cell, triggerSort, triggerFilter }, params))
      }
      this.focus()
      this.closeMenu()
    },
    /**
     * 
     */
    triggerCellMousedownEvent(event, params) {
      const cell = event.currentTarget
      params.cell = cell
      this.handleCellMousedownEvent(event, params)
      this.focus()
      this.closeFilter()
      this.closeMenu()
    },
    handleCellMousedownEvent(event, params) {
      const { editingConfig, editingOptions, handleSelected, selectionConfig, selectionOptions, mouseConfig, mouseOpts } = this
      if (mouseConfig && mouseoptions.area && this.handleCellAreaEvent) {
        return this.handleCellAreaEvent(event, params)
      } else {
        if (selectionConfig && selectionOptions.range) {
          this.handleCheckboxRangeEvent(event, params)
        }
        if (mouseConfig && mouseoptions.selected) {
          if (!editingConfig || editingOptions.mode === 'cell') {
            handleSelected(params, event)
          }
        }
      }
    },
    handleCheckboxRangeEvent(event, params) {
      const { column, cell } = params
      if (column.type === 'checkbox') {
        const { $el, refsStore } = this
        const disX = event.clientX
        const disY = event.clientY
        const bodyWrapperElem = refsStore[`${column.fixed || 'main'}-body-wrapper`] || refsStore['main-body-wrapper']
        const checkboxRangeElem = bodyWrapperElem.querySelector('.r4m-table--checkbox-range')
        const domMousemove = document.onmousemove
        const domMouseup = document.onmouseup
        const trElem = cell.parentNode
        const selectRecords = this.getCheckboxRecords()
        let lastRangeRows = []
        const marginSize = 1
        const offsetRest = getTargetOffset(event.target, bodyWrapperElem)
        const startTop = offsetRest.offsetTop + event.offsetY
        const startLeft = offsetRest.offsetLeft + event.offsetX
        const startScrollTop = bodyWrapperElem.scrollTop
        const rowHeight = trElem.offsetHeight
        let mouseScrollTimeout = null
        let isMouseScrollDown = false
        let mouseScrollSpaceSize = 1
        const triggerEvent = (type, event) => {
          this.emitEvent(
            `checkbox-range-${type}`,
            { records: this.getCheckboxRecords(), reserves: this.getCheckboxReserveRecords() },
            event
          )
        }
        const handleselected = (event) => {
          const { clientX, clientY } = event
          const offsetLeft = clientX - disX
          const offsetTop = clientY - disY + (bodyWrapperElem.scrollTop - startScrollTop)
          let rangeHeight = Math.abs(offsetTop)
          let rangeWidth = Math.abs(offsetLeft)
          let rangeTop = startTop
          let rangeLeft = startLeft
          if (offsetTop < marginSize) {
            // 
            rangeTop += offsetTop
            if (rangeTop < marginSize) {
              rangeTop = marginSize
              rangeHeight = startTop
            }
          } else {
            // 
            rangeHeight = Math.min(rangeHeight, bodyWrapperElem.scrollHeight - startTop - marginSize)
          }
          if (offsetLeft < marginSize) {
            // 
            rangeLeft += offsetLeft
            if (rangeWidth > startLeft) {
              rangeLeft = marginSize
              rangeWidth = startLeft
            }
          } else {
            // 
            rangeWidth = Math.min(rangeWidth, bodyWrapperElem.clientWidth - startLeft - marginSize)
          }
          checkboxRangeElem.style.height = `${rangeHeight}px`
          checkboxRangeElem.style.width = `${rangeWidth}px`
          checkboxRangeElem.style.left = `${rangeLeft}px`
          checkboxRangeElem.style.top = `${rangeTop}px`
          checkboxRangeElem.style.display = 'block'
          const rangeRows = getCheckboxRangeRows(
            this,
            params,
            trElem,
            offsetTop < marginSize ? -rangeHeight : rangeHeight
          )
          //  10px 
          if (rangeHeight > 10 && rangeRows.length !== lastRangeRows.length) {
            lastRangeRows = rangeRows
            if (event.ctrlKey) {
              rangeRows.forEach((row) => {
                this.handleSelectRow({ row }, selectRecords.indexOf(row) === -1)
              })
            } else {
              this.setAllCheckboxRow(false)
              this.handleselectedRow(rangeRows, true, false)
            }
            triggerEvent('change', event)
          }
        }
        // 
        const stopMouseScroll = () => {
          clearTimeout(mouseScrollTimeout)
          mouseScrollTimeout = null
        }
        // 
        const startMouseScroll = (event) => {
          stopMouseScroll()
          mouseScrollTimeout = setTimeout(() => {
            if (mouseScrollTimeout) {
              const { scrollLeft, scrollTop, clientHeight, scrollHeight } = bodyWrapperElem
              const topSize = Math.ceil((mouseScrollSpaceSize * 50) / rowHeight)
              if (isMouseScrollDown) {
                if (scrollTop + clientHeight < scrollHeight) {
                  this.scrollTo(scrollLeft, scrollTop + topSize)
                  startMouseScroll(event)
                  handleselected(event)
                } else {
                  stopMouseScroll()
                }
              } else {
                if (scrollTop) {
                  this.scrollTo(scrollLeft, scrollTop - topSize)
                  startMouseScroll(event)
                  handleselected(event)
                } else {
                  stopMouseScroll()
                }
              }
            }
          }, 50)
        }
        DomUtils.addClass($el, 'drag--range')
        document.onmousemove = (event) => {
          event.preventDefault()
          event.stopPropagation()
          const { clientY } = event
          const { boundingTop } = DomUtils.getAbsolutePos(bodyWrapperElem)
          // ，
          if (clientY < boundingTop) {
            isMouseScrollDown = false
            mouseScrollSpaceSize = boundingTop - clientY
            if (!mouseScrollTimeout) {
              startMouseScroll(event)
            }
          } else if (clientY > boundingTop + bodyWrapperElem.clientHeight) {
            isMouseScrollDown = true
            mouseScrollSpaceSize = clientY - boundingTop - bodyWrapperElem.clientHeight
            if (!mouseScrollTimeout) {
              startMouseScroll(event)
            }
          } else if (mouseScrollTimeout) {
            stopMouseScroll()
          }
          handleselected(event)
        }
        document.onmouseup = (event) => {
          stopMouseScroll()
          DomUtils.removeClass($el, 'drag--range')
          checkboxRangeElem.removeAttribute('style')
          document.onmousemove = domMousemove
          document.onmouseup = domMouseup
          triggerEvent('end', event)
        }
        triggerEvent('start', event)
      }
    }
  }
}
