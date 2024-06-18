import lodash from 'lodash'
import RTable from '../r-datatable'
import GlobalConfigs from '../r-datatable/src/conf'
import Utils, { isEnableConf } from '../tools/utils'
import { getRowId } from '../table/util'
import DomUtils, { browse } from '../tools/dom'
import { warnLog, errLog, getLog } from '../tools/log'

function insertTreeRow(_vm, newRecords, isAppend) {
  const { tableFullTreeRowsData, afterfullRowsData, fullRowsDatarowIdData, fullAllDatarowIdData, treeOptions } = _vm
  const { rowField, parentField, mapchildrenAccessField } = treeOptions
  const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
  const funcName = isAppend ? 'push' : 'unshift'
  newRecords.forEach((item) => {
    const parentrowId = item[parentField]
    const rowId = getRowId(_vm, item)
    const matchObj = parentrowId
      ? lodash.findTree(tableFullTreeRowsData, (item) => parentrowId === item[rowField], { children: mapchildrenAccessField })
      : null
    if (matchObj) {
      const { item: parentRow } = matchObj
      const parentRest = fullAllDatarowIdData[getRowId(_vm, parentRow)]
      const parentLevel = parentRest ? parentRest.level : 0
      let parentChilds = parentRow[childrenAccessField]
      let mapChilds = parentRow[mapchildrenAccessField]
      if (!lodash.isArray(parentChilds)) {
        parentChilds = parentRow[childrenAccessField] = []
      }
      if (!lodash.isArray(mapChilds)) {
        mapChilds = parentRow[childrenAccessField] = []
      }
      parentChilds[funcName](item)
      mapChilds[funcName](item)
      const rest = {
        row: item,
        rowId,
        seq: -1,
        index: -1,
        _index: -1,
        $index: -1,
        items: parentChilds,
        parent: parentRow,
        level: parentLevel + 1
      }
      fullRowsDatarowIdData[rowId] = rest
      fullAllDatarowIdData[rowId] = rest
    } else {
      if (import.meta.env.MODE === 'development') {
        if (parentrowId) {
          warnLog('rtable.error.unableInsert')
        }
      }
      afterfullRowsData[funcName](item)
      tableFullTreeRowsData[funcName](item)
      const rest = {
        row: item,
        rowId,
        seq: -1,
        index: -1,
        _index: -1,
        $index: -1,
        items: tableFullTreeRowsData,
        parent: null,
        level: 0
      }
      fullRowsDatarowIdData[rowId] = rest
      fullAllDatarowIdData[rowId] = rest
    }
  })
}

function handleInsertRowAt(_vm, records, row, isInsertNextRow) {
  const {
    tableFullTreeRowsData,
    mergeList,
    afterfullRowsData,
    editingStore,
    tableFullRowsData,
    treeConfig,
    fullRowsDatarowIdData,
    fullAllDatarowIdData,
    treeOptions
  } = _vm
  const { transform, rowField, mapchildrenAccessField } = treeOptions
  const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
  if (!lodash.isArray(records)) {
    records = [records]
  }
  const newRecords = _vm.defineField(
    records.map((record) =>
      Object.assign(treeConfig && transform ? { [mapchildrenAccessField]: [], [childrenAccessField]: [] } : {}, record)
    )
  )
  if (lodash.eqNull(row)) {
    // If it is a virtual tree
    if (treeConfig && transform) {
      insertTreeRow(_vm, newRecords, false)
    } else {
      afterfullRowsData.unshift(...newRecords)
      tableFullRowsData.unshift(...newRecords)
      // Refresh cell merge
      mergeList.forEach((mergeItem) => {
        const { row: mergeRowIndex } = mergeItem
        if (mergeRowIndex > 0) {
          mergeItem.row = mergeRowIndex + newRecords.length
        }
      })
    }
  } else {
    if (row === -1) {
      // If it is a virtual tree
      if (treeConfig && transform) {
        insertTreeRow(_vm, newRecords, true)
      } else {
        afterfullRowsData.push(...newRecords)
        tableFullRowsData.push(...newRecords)
        // Refresh cell merge
        mergeList.forEach((mergeItem) => {
          const { row: mergeRowIndex, rowspan: mergeRowspan } = mergeItem
          if (mergeRowIndex + mergeRowspan > afterfullRowsData.length) {
            mergeItem.rowspan = mergeRowspan + newRecords.length
          }
        })
      }
    } else {
      // If it is a virtual tree
      if (treeConfig && transform) {
        const matchMapObj = lodash.findTree(tableFullTreeRowsData, (item) => row[rowField] === item[rowField], {
          children: mapchildrenAccessField
        })
        if (matchMapObj) {
          const { parent: parentRow } = matchMapObj
          const parentMapChilds = parentRow ? parentRow[mapchildrenAccessField] : tableFullTreeRowsData
          const parentRest = fullAllDatarowIdData[getRowId(_vm, parentRow)]
          const parentLevel = parentRest ? parentRest.level : 0
          newRecords.forEach((item, i) => {
            const rowId = getRowId(_vm, item)
            if (import.meta.env.MODE === 'development') {
              if (item[treeOptions.parentField]) {
                if (parentRow && item[treeOptions.parentField] !== parentRow[rowField]) {
                  errLog('rtable.error.errProp', [
                    `${treeOptions.parentField}=${item[treeOptions.parentField]}`,
                    `${treeOptions.parentField}=${parentRow[rowField]}`
                  ])
                }
              }
            }
            if (parentRow) {
              item[treeOptions.parentField] = parentRow[rowField]
            }
            let targetIndex = matchMapObj.index + i
            if (isInsertNextRow) {
              targetIndex = targetIndex + 1
            }
            parentMapChilds.splice(targetIndex, 0, item)
            const rest = {
              row: item,
              rowId,
              seq: -1,
              index: -1,
              _index: -1,
              $index: -1,
              items: parentMapChilds,
              parent: parentRow,
              level: parentLevel + 1
            }
            fullRowsDatarowIdData[rowId] = rest
            fullAllDatarowIdData[rowId] = rest
          })

          // source
          if (parentRow) {
            const matchObj = lodash.findTree(tableFullTreeRowsData, (item) => row[rowField] === item[rowField], {
              children: childrenAccessField
            })
            if (matchObj) {
              const parentChilds = matchObj.items
              let targetIndex = matchObj.index
              if (isInsertNextRow) {
                targetIndex = targetIndex + 1
              }
              parentChilds.splice(targetIndex, 0, ...newRecords)
            }
          }
        } else {
          if (import.meta.env.MODE === 'development') {
            warnLog('rtable.error.unableInsert')
          }
          insertTreeRow(_vm, newRecords, true)
        }
      } else {
        if (treeConfig) {
          throw new Error(getLog('rtable.error.noTree', ['insert']))
        }
        let afIndex = -1
        // If it is a visual index
        if (lodash.isNumber(row)) {
          if (row < afterfullRowsData.length) {
            afIndex = row
          }
        } else {
          afIndex = _vm.findRowIndexOf(afterfullRowsData, row)
        }
        // If inserting the next row of the specified row
        if (isInsertNextRow) {
          afIndex = Math.min(afterfullRowsData.length, afIndex + 1)
        }
        if (afIndex === -1) {
          throw new Error(errLog('rtable.error.unableInsert'))
        }
        afterfullRowsData.splice(afIndex, 0, ...newRecords)
        tableFullRowsData.splice(_vm.findRowIndexOf(tableFullRowsData, row), 0, ...newRecords)
        // Refresh cell merge
        mergeList.forEach((mergeItem) => {
          const { row: mergeRowIndex, rowspan: mergeRowspan } = mergeItem
          if (mergeRowIndex > afIndex) {
            mergeItem.row = mergeRowIndex + newRecords.length
          } else if (mergeRowIndex + mergeRowspan > afIndex) {
            mergeItem.rowspan = mergeRowspan + newRecords.length
          }
        })
      }
    }
  }
  const { insertList, insertMaps } = editingStore
  newRecords.forEach((newRow) => {
    const rowId = getRowId(_vm, newRow)
    insertMaps[rowId] = newRow
  })
  insertList.unshift(...newRecords)
  _vm.cacheRowMap()
  _vm.updateScrollYStatus()
  _vm.updateTableData(treeConfig && transform)
  if (!(treeConfig && transform)) {
    _vm.updateAfterDataIndex()
  }
  _vm.updateFooterState()
  _vm.checkSelectionStatus()
  if (_vm.virtualScrollYLoad) {
    _vm.updateScrollYSpace()
  }
  return _vm
    .$nextTick()
    .then(() => {
      _vm.updateCellAreas()
      return _vm.recalculate()
    })
    .then(() => {
      return {
        row: newRecords.length ? newRecords[newRecords.length - 1] : null,
        rows: newRecords
      }
    })
}

export default {
  methods: {
    /**
     * Insert temporary data into the table
     *
     * @param {*} records
     */
    _insert(records) {
      return handleInsertRowAt(this, records, null)
    },
    /**
     * Insert temporary data into specified rows of the table
     * If row is empty, insert from top to top
     * If row is -1 then insert from bottom to bottom
     * If row is a valid row, insert it into the position of the row
     * @param {Object/Array} records new data
     * @param {Row} row Specify row
     * @returns
     */
    _insertAt(records, row) {
      return handleInsertRowAt(this, records, row)
    },
    _insertNextAt(records, row) {
      return handleInsertRowAt(this, records, row, true)
    },
    /**
     * Delete specified row data
     * If row is passed, delete a row
     * If rows is passed, multiple rows will be deleted
     * If empty delete all
     */
    _remove(rows) {
      const {
        afterfullRowsData,
        tableFullRowsData,
        tableFullTreeRowsData,
        treeConfig,
        mergeList,
        editingStore,
        selectionOptions,
        selectCheckboxMaps,
        isInsertByRow,
        treeOptions
      } = this
      const { transform, mapchildrenAccessField } = treeOptions
      const childrenAccessField = treeOptions.children || treeOptions.childrenAccessField
      const { actived, removeList, insertList, insertMaps } = editingStore
      const { checkField } = selectionOptions
      let delList = []
      if (!rows) {
        rows = tableFullRowsData
      } else if (!lodash.isArray(rows)) {
        rows = [rows]
      }
      // If it is new, save the record
      rows.forEach((row) => {
        if (!isInsertByRow(row)) {
          removeList.push(row)
        }
      })
      // If the multi-select attribute is bound, update the status
      if (!checkField) {
        const selectRowMaps = { ...selectCheckboxMaps }
        rows.forEach((row) => {
          const rowId = getRowId(this, row)
          if (selectRowMaps[rowId]) {
            delete selectRowMaps[rowId]
          }
        })
        this.selectCheckboxMaps = selectRowMaps
      }
      // Remove from data source
      if (tableFullRowsData === rows) {
        rows = delList = tableFullRowsData.slice(0)
        this.tableFullRowsData = []
        this.afterfullRowsData = []
        this.clearMergedCells()
      } else {
        // If it is a virtual tree
        if (treeConfig && transform) {
          rows.forEach((row) => {
            const rowId = getRowId(this, row)
            const matchMapObj = lodash.findTree(tableFullTreeRowsData, (item) => rowId === getRowId(this, item), {
              children: mapchildrenAccessField
            })
            if (matchMapObj) {
              const rItems = matchMapObj.items.splice(matchMapObj.index, 1)
              delList.push(rItems[0])
            }
            const matchObj = lodash.findTree(tableFullTreeRowsData, (item) => rowId === getRowId(this, item), {
              children: childrenAccessField
            })
            if (matchObj) {
              matchObj.items.splice(matchObj.index, 1)
            }
            const afIndex = this.findRowIndexOf(afterfullRowsData, row)
            if (afIndex > -1) {
              afterfullRowsData.splice(afIndex, 1)
            }
          })
        } else {
          rows.forEach((row) => {
            const tfIndex = this.findRowIndexOf(tableFullRowsData, row)
            if (tfIndex > -1) {
              const rItems = tableFullRowsData.splice(tfIndex, 1)
              delList.push(rItems[0])
            }
            const afIndex = this.findRowIndexOf(afterfullRowsData, row)
            if (afIndex > -1) {
              // Refresh cell merge
              mergeList.forEach((mergeItem) => {
                const { row: mergeRowIndex, rowspan: mergeRowspan } = mergeItem
                if (mergeRowIndex > afIndex) {
                  mergeItem.row = mergeRowIndex - 1
                } else if (mergeRowIndex + mergeRowspan > afIndex) {
                  mergeItem.rowspan = mergeRowspan - 1
                }
              })
              afterfullRowsData.splice(afIndex, 1)
            }
          })
        }
      }
      // If the current row is active for editing, clear the activation status
      if (actived.row && this.findRowIndexOf(rows, actived.row) > -1) {
        this.clearActived()
      }
      // Remove deleted data from new
      rows.forEach((row) => {
        const rowId = getRowId(this, row)
        const iIndex = this.findRowIndexOf(insertList, row)
        if (iIndex > -1) {
          insertList.splice(iIndex, 1)
        }
        delete insertMaps[rowId]
      })
      this.updateTableData(treeConfig && transform)
      if (!(treeConfig && transform)) {
        this.updateAfterDataIndex()
      }
      this.updateFooterState()
      this.cacheRowMap()
      this.checkSelectionStatus()
      if (this.virtualScrollYLoad) {
        this.updateScrollYSpace()
      }
      return this.$nextTick()
        .then(() => {
          this.updateCellAreas()
          return this.recalculate()
        })
        .then(() => {
          return { row: delList.length ? delList[delList.length - 1] : null, rows: delList }
        })
    },
    /**
     * Delete data selected by checkbox
     */
    _removeCheckboxRow() {
      return this.remove(this.getCheckboxRecords()).then((params) => {
        this.clearCheckboxRow()
        return params
      })
    },
    /**
     * Delete data selected by radio button
     */
    _removeRadioRow() {
      const radioRecord = this.getRadioRecord()
      return this.remove(radioRecord || []).then((params) => {
        this.clearRadioRow()
        return params
      })
    },
    /**
     * Delete the selected data in the current row
     */
    _removeCurrentRow() {
      const currentRecord = this.getCurrentRecord()
      return this.remove(currentRecord || []).then((params) => {
        this.clearCurrentRow()
        return params
      })
    },
    /**
     * Get the table data set, including adding, deleting, and modifying
     */
    _getRecordset() {
      return {
        insertRecords: this.getInsertRecords(),
        removeRecords: this.getRemoveRecords(),
        updateRecords: this.getUpdateRecords(),
        pendingRecords: this.getPendingRecords()
      }
    },
    /**
     * Get new temporary data
     */
    _getInsertRecords() {
      const { fullAllDatarowIdData } = this
      const insertList = this.editingStore.insertList
      const insertRecords = []
      insertList.forEach((row) => {
        const rowId = getRowId(this, row)
        if (fullAllDatarowIdData[rowId]) {
          insertRecords.push(row)
        }
      })
      return insertRecords
    },
    /**
     * Get deleted data
     */
    _getRemoveRecords() {
      return this.editingStore.removeList
    },
    /**
     * Get updated data
     * Exactly match only changes in row
     * If it is a tree table, the changing status of the child node will not affect the update status of the parent node.
     */
    _getUpdateRecords() {
      const { keepSource, tableFullRowsData, isUpdateByRow, treeConfig, treeOptions, editingStore } = this
      if (keepSource) {
        const { actived } = editingStore
        const { row, column } = actived
        if (row || column) {
          this._syncActivedCell()
        }
        if (treeConfig) {
          return lodash.filterTree(tableFullRowsData, (row) => isUpdateByRow(row), treeOptions)
        }
        return tableFullRowsData.filter((row) => isUpdateByRow(row))
      }
      return []
    },
    /**
     * Handle active editing
     */
    handleActived(params, event) {
      const { editingStore, editingOptions, tableColumn, editingConfig, mouseConfig } = this
      const { mode } = editingOptions
      const { actived } = editingStore
      const { row, column } = params
      const { editingRender } = column
      const cell = (params.cell = params.cell || this.getCell(row, column))
      const beforeEditMethod = editingOptions.beforeEditMethod || editingOptions.activeMethod
      if (isEnableConf(editingConfig) && isEnableConf(editingRender) && !this.hasPendingByRow(row) && cell) {
        if (actived.row !== row || (mode === 'cell' ? actived.column !== column : false)) {
          // Determine whether editing is disabled
          let type = 'edit-disabled'
          if (!beforeEditMethod || beforeEditMethod({ ...params, $tableContainer: this, $gridContainer: this.$rgrid })) {
            if (mouseConfig) {
              this.clearSelected(event)
              this.clearCellAreas(event)
              this.clearCopyCellArea(event)
            }
            this.closeTooltip()
            if (actived.column) {
              this.clearActived(event)
            }
            type = 'edit-activated'
            column.renderHeight = cell.offsetHeight
            actived.args = params
            actived.row = row
            actived.column = column
            if (mode === 'row') {
              tableColumn.forEach((column) => this._getColumnModel(row, column))
            } else {
              this._getColumnModel(row, column)
            }
            const afterEditMethod = editingOptions.afterEditMethod
            this.$nextTick(() => {
              this.handleFocus(params, event)
              if (afterEditMethod) {
                afterEditMethod({ ...params, $tableContainer: this, $gridContainer: this.$rgrid })
              }
            })
          }
          this.emitEvent(
            type,
            {
              row,
              rowIndex: this.getRowIndex(row),
              $rowIndex: this.getVMRowIndex(row),
              column,
              columnIndex: this.getColumnIndex(column),
              $columnIndex: this.getVMColumnIndex(column)
            },
            event
          )

          // v4 is obsolete
          if (type === 'edit-activated') {
            this.emitEvent(
              'edit-actived',
              {
                row,
                rowIndex: this.getRowIndex(row),
                $rowIndex: this.getVMRowIndex(row),
                column,
                columnIndex: this.getColumnIndex(column),
                $columnIndex: this.getVMColumnIndex(column)
              },
              event
            )
          }
        } else {
          const { column: oldColumn } = actived
          if (mouseConfig) {
            this.clearSelected(event)
            this.clearCellAreas(event)
            this.clearCopyCellArea(event)
          }
          if (oldColumn !== column) {
            const { model: oldModel } = oldColumn
            if (oldModel.update) {
              Utils.setCellValue(row, oldColumn, oldModel.value)
            }
            this.clearValidate()
          }
          column.renderHeight = cell.offsetHeight
          actived.args = params
          actived.column = column
          setTimeout(() => {
            this.handleFocus(params, event)
          })
        }
        this.focus()
      }
      return this.$nextTick()
    },
    _getColumnModel(row, column) {
      const { model, editingRender } = column
      if (editingRender) {
        model.value = Utils.getCellValue(row, column)
        model.update = false
      }
    },
    _setColumnModel(row, column) {
      const { model, editingRender } = column
      if (editingRender && model.update) {
        Utils.setCellValue(row, column, model.value)
        model.update = false
        model.value = null
      }
    },
    _syncActivedCell() {
      const { tableColumn, editingStore, editingOptions } = this
      const { actived } = editingStore
      const { row, column } = actived
      if (row || column) {
        if (editingOptions.mode === 'row') {
          tableColumn.forEach((column) => this._setColumnModel(row, column))
        } else {
          this._setColumnModel(row, column)
        }
      }
    },
    _clearActived(event) {
      // if (import.meta.env.MODE === 'development') {
      //   warnLog('rtable.error.delFunc', ['clearActived', 'clearEdit'])
      // }
      // About to be abandoned
      return this.clearEdit(event)
    },
    /**
     * Clear active edits
     */
    _clearEdit(event) {
      const { editingStore } = this
      const { actived } = editingStore
      const { row, column } = actived
      if (row || column) {
        this._syncActivedCell()
        actived.args = null
        actived.row = null
        actived.column = null
        this.updateFooterState()
        this.emitEvent(
          'edit-closed',
          {
            row,
            rowIndex: this.getRowIndex(row),
            $rowIndex: this.getVMRowIndex(row),
            column,
            columnIndex: this.getColumnIndex(column),
            $columnIndex: this.getVMColumnIndex(column)
          },
          event
        )
      }
      if (GlobalConfigs.cellVaildMode === 'obsolete') {
        if (this.clearValidate) {
          return this.clearValidate()
        }
      }
      return this.$nextTick()
    },
    _getActiveRecord() {
      // if (import.meta.env.MODE === 'development') {
      //   warnLog('rtable.error.delFunc', ['getActiveRecord', 'getEditRecord'])
      // }
      // About to be abandoned
      return this.getEditRecord()
    },
    _getEditRecord() {
      const { $el, editingStore, afterfullRowsData } = this
      const { actived } = editingStore
      const { args, row } = actived
      if (
        args &&
        this.findRowIndexOf(afterfullRowsData, row) > -1 &&
        $el.querySelectorAll('.r4m-table-body--column.col--active').length
      ) {
        return Object.assign({}, args)
      }
      return null
    },
    _isActiveByRow(row) {
      // if (import.meta.env.MODE === 'development') {
      //   warnLog('rtable.error.delFunc', ['isActiveByRow', 'isEditByRow'])
      // }
      // the rest of the rows
      return this.isEditByRow(row)
    },
    /**
     * Determine whether the row is in active editing state
     * @param {Row} row row object
     */
    _isEditByRow(row) {
      return this.editingStore.actived.row === row
    },
    /**
     * processing focus
     */
    handleFocus(params) {
      const { row, column, cell } = params
      const { editingRender } = column
      if (isEnableConf(editingRender)) {
        const compRender = RTable.renderer.get(editingRender.name)
        let { autofocus, autoselect } = editingRender
        let inputElem
        if (!autofocus && compRender) {
          autofocus = compRender.autofocus
        }
        if (!autoselect && compRender) {
          autoselect = compRender.autoselect
        }
        // If focus class is specified
        if (lodash.isFunction(autofocus)) {
          inputElem = autofocus.call(this, params)
        } else if (autofocus) {
          inputElem = cell.querySelector(autofocus)
          if (inputElem) {
            inputElem.focus()
          }
        }
        if (inputElem) {
          if (autoselect) {
            inputElem.select()
          } else {
            // To maintain consistent behavior, the cursor moves to the end
            if (browse.msie) {
              const textRange = inputElem.createTextRange()
              textRange.collapse(false)
              textRange.select()
            }
          }
        } else {
          // Display into viewable area
          this.scrollToRow(row, column)
        }
      }
    },
    _setActiveRow(row) {
      // if (import.meta.env.MODE === 'development') {
      //   warnLog('rtable.error.delFunc', ['setActiveRow', 'setEditRow'])
      // }
      // About to be abandoned
      return this.setEditRow(row)
    },
    /**
     * Activate line editing
     */
    _setEditRow(row, fieldOrColumn) {
      let column = lodash.find(this.visibleColumn, (column) => isEnableConf(column.editingRender))
      if (fieldOrColumn) {
        column = lodash.isString(fieldOrColumn) ? this.getColumnByField(fieldOrColumn) : fieldOrColumn
      }
      return this.setEditCell(row, column)
    },
    _setActiveCell(row) {
      // if (import.meta.env.MODE === 'development') {
      //   warnLog('rtable.error.delFunc', ['setActiveCell', 'setEditCell'])
      // }
      // to be abandoned
      return this.setEditCell(row)
    },
    /**
     * Activate cell editing
     */
    _setEditCell(row, fieldOrColumn) {
      const { editingConfig } = this
      const column = lodash.isString(fieldOrColumn) ? this.getColumnByField(fieldOrColumn) : fieldOrColumn
      if (row && column && isEnableConf(editingConfig) && isEnableConf(column.editingRender)) {
        return this.scrollToRow(row, true).then(() => {
          const cell = this.getCell(row, column)
          if (cell) {
            this.handleActived({
              row,
              rowIndex: this.getRowIndex(row),
              column,
              columnIndex: this.getColumnIndex(column),
              cell,
              $tableContainer: this
            })
            this.lastCallTime = Date.now()
          }
        })
      }
      return this.$nextTick()
    },
    /**
     * Only valid for trigger=dblclick, selected cell
     */
    _setSelectCell(row, fieldOrColumn) {
      const { tableData, editingOptions, visibleColumn } = this
      const column = lodash.isString(fieldOrColumn) ? this.getColumnByField(fieldOrColumn) : fieldOrColumn
      if (row && column && editingOptions.trigger !== 'manual') {
        const rowIndex = this.findRowIndexOf(tableData, row)
        if (rowIndex > -1) {
          const cell = this.getCell(row, column)
          const params = { row, rowIndex, column, columnIndex: visibleColumn.indexOf(column), cell }
          this.handleSelected(params, {})
        }
      }
      return this.$nextTick()
    },
    /**
     * Process selected source
     */
    handleSelected(params, event) {
      const { mouseConfig, mouseOpts, editingOptions, editingStore } = this
      const { actived, selected } = editingStore
      const { row, column } = params
      const isMouseSelected = mouseConfig && mouseoptions.selected
      const selectMethod = () => {
        if (isMouseSelected && (selected.row !== row || selected.column !== column)) {
          if (actived.row !== row || (editingOptions.mode === 'cell' ? actived.column !== column : false)) {
            this.clearActived(event)
            this.clearSelected(event)
            this.clearCellAreas(event)
            this.clearCopyCellArea(event)
            selected.args = params
            selected.row = row
            selected.column = column
            if (isMouseSelected) {
              this.addColSdCls()
            }
            this.focus()
            if (event) {
              this.emitEvent('cell-selected', params, event)
            }
          }
        }
        return this.$nextTick()
      }
      return selectMethod()
    },
    /**
     * Get selected cells
     */
    _getSelectedCell() {
      const { args, column } = this.editingStore.selected
      if (args && column) {
        return Object.assign({}, args)
      }
      return null
    },
    /**
     * Clear selected source status
     */
    _clearSelected() {
      const { selected } = this.editingStore
      selected.row = null
      selected.column = null
      this.reColTitleSdCls()
      this.reColSdCls()
      return this.$nextTick()
    },
    reColTitleSdCls() {
      const headerElem = this.refsStore['main-header-list']
      if (headerElem) {
        lodash.arrayEach(headerElem.querySelectorAll('.col--title-selected'), (elem) =>
          DomUtils.removeClass(elem, 'col--title-selected')
        )
      }
    },
    reColSdCls() {
      const cell = this.$el.querySelector('.col--selected')
      if (cell) {
        DomUtils.removeClass(cell, 'col--selected')
      }
    },
    addColSdCls() {
      const { selected } = this.editingStore
      const { row, column } = selected
      this.reColSdCls()
      if (row && column) {
        const cell = this.getCell(row, column)
        if (cell) {
          DomUtils.addClass(cell, 'col--selected')
        }
      }
    }
  }
}
