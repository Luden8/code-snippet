// @ts-ignore
import lodash from 'lodash'
import GlobalConfigs from '../../r-datatable/src/conf'
import Utils, { getFuncText } from '../../tools/utils'
import { errLog, warnLog } from '../../tools/log'

const defaultCompProps = { transfer: true }

const componentDefaultModelProp = 'value'

function isEmptyValue(cellValue) {
  return cellValue === null || cellValue === undefined || cellValue === ''
}

function getChangeEvent(renderOptions) {
  switch (renderOptions.name) {
    case 'input':
    case 'textarea':
    case 'RInput':
    case 'RTextarea':
    case '$input':
    case '$textarea':
      return 'input'
  }
  return 'change'
}

function parseDate(value, props) {
  return value && props.valueFormat ? lodash.toStringDate(value, props.valueFormat) : value
}

function getFormatDate(value, props, defaultFormat) {
  const { dateConfig = {} } = props
  return lodash.toDateString(parseDate(value, props), dateConfig.labelFormat || defaultFormat)
}

function getLabelFormatDate(value, props) {
  return getFormatDate(value, props, GlobalConfigs.i18n(`rtable.input.date.labelFormat.${props.type}`))
}

function getDefaultComponentName({ name }) {
  return name
}

/**

 * @deprecated
 */
function getOldComponentName({ name }) {
  return `r-table-${name.replace('$', '')}`
}

function handleConfirmFilter(params, selected, option) {
  const { $panel } = params
  $panel.changeOption({}, selected, option)
}

function getNativeAttrs({ name, attrs }) {
  if (name === 'input') {
    attrs = Object.assign({ type: 'text' }, attrs)
  }
  return attrs
}

function getInputImmediateModel(renderOptions) {
  const { name, immediate, props } = renderOptions
  if (!immediate) {
    if (name === 'RInput' || name === '$input') {
      const { type } = props || {}
      return !(!type || type === 'text' || type === 'number' || type === 'integer' || type === 'float')
    }
    if (name === 'input' || name === 'textarea' || name === '$textarea') {
      return false
    }
    return true
  }
  return immediate
}

function isImmediateCell(renderOptions, params) {
  return params.$type === 'cell' || getInputImmediateModel(renderOptions)
}

function getCellEditProps(renderOptions, params, value, defaultProps) {
  const { vSize } = params.$tableContainer
  return lodash.assign(
    { immediate: getInputImmediateModel(renderOptions) },
    vSize ? { size: vSize } : {},
    defaultCompProps,
    defaultProps,
    renderOptions.props,
    { [componentDefaultModelProp]: value }
  )
}

function getFilterProps(renderOptions, params, value, defaultProps) {
  const { vSize } = params.$tableContainer
  return lodash.assign(vSize ? { size: vSize } : {}, defaultCompProps, defaultProps, renderOptions.props, {
    [componentDefaultModelProp]: value
  })
}

function getItemProps(renderOptions, params, value, defaultProps) {
  const { vSize } = params.$form
  return lodash.assign(vSize ? { size: vSize } : {}, defaultCompProps, defaultProps, renderOptions.props, {
    [componentDefaultModelProp]: value
  })
}

function getCellLabelvirtualNodes(h, renderOptions, params, cellLabel) {
  const { placeholder } = renderOptions
  // prettier-ignore
  return [
    h(
      'span',
      {
        class: 'r4m-table-cell--label'
      },
      placeholder && isEmptyValue(cellLabel)
        ? [
          h(
            'span',
            {
              class: 'r4m-table-cell--placeholder'
            },
            Utils.format(getFuncText(placeholder), 1)
          )
        ]
        : Utils.format(cellLabel, 1)
    )
  ]
}

function getNativeOns(renderOptions, params) {
  const { nativeEvents } = renderOptions
  const nativeOns = {}
  lodash.objectEach(nativeEvents, (func, key) => {
    nativeOns[key] = function (...args) {
      if (import.meta.env.MODE === 'development') {
        if (!lodash.isFunction(func)) {
          errLog('rtable.error.errFunc', [func])
        }
      }
      func(params, ...args)
    }
  })
  return nativeOns
}

function getOns(renderOptions, params, inputFunc, changeFunc) {
  const { name, events } = renderOptions
  const modelEvent = 'input'
  const changeEvent = getChangeEvent(renderOptions)
  const isSameEvent = changeEvent === modelEvent
  const eventListeners = {}
  lodash.objectEach(events, (func, key) => {
    ons[key] = function (...args) {
      if (import.meta.env.MODE === 'development') {
        if (!lodash.isFunction(func)) {
          errLog('rtable.error.errFunc', [func])
        }
      }
      func(params, ...args)
    }
  })
  if (inputFunc) {
    ons[modelEvent] = function (targetevent) {

      inputFunc(['RInput', 'RTextarea', '$input', '$textarea'].includes(name) ? targetevent.value : targetevent)
      if (events && events[modelEvent]) {
        events[modelEvent](params, targetevent)
      }
      if (isSameEvent && changeFunc) {
        changeFunc(targetevent)
      }
    }
  }
  if (!isSameEvent && changeFunc) {
    ons[changeEvent] = function (...args) {
      changeFunc(...args)
      if (events && events[changeEvent]) {
        events[changeEvent](params, ...args)
      }
    }
  }
  return ons
}

function getEditOns(renderOptions, params) {
  const { $tableContainer, row, column } = params
  const { name } = renderOptions
  const { model } = column
  const isImmediate = isImmediateCell(renderOptions, params)
  return getOns(
    renderOptions,
    params,
    (cellValue) => {

      if (isImmediate) {
        Utils.setCellValue(row, column, cellValue)
      } else {
        model.update = true
        model.value = cellValue
      }
    },
    (eventParams) => {

      if (!isImmediate && ['RInput', 'RTextarea', '$input', '$textarea'].includes(name)) {
        $tableContainer.updateStatus(params, eventParams.value)
      } else {
        $tableContainer.updateStatus(params)
      }
    }
  )
}

function getFilterOns(renderOptions, params, option) {
  return getOns(
    renderOptions,
    params,
    (value) => {
      option.data = value
    },
    () => {
      handleConfirmFilter(params, !lodash.eqNull(option.data), option)
    }
  )
}

function getItemOns(renderOptions, params) {
  const { $form, data, property } = params
  return getOns(
    renderOptions,
    params,
    (value) => {
      lodash.set(data, property, value)
    },
    () => {
      $form.updateStatus(params)
    }
  )
}

function getNativeEditOns(renderOptions, params) {
  const { $tableContainer, row, column } = params
  const { model } = column
  return getOns(
    renderOptions,
    params,
    (event) => {
      const cellValue = event.target.value
      if (isImmediateCell(renderOptions, params)) {
        Utils.setCellValue(row, column, cellValue)
      } else {
        model.update = true
        model.value = cellValue
      }
    },
    (event) => {
      const cellValue = event.target.value
      $tableContainer.updateStatus(params, cellValue)
    }
  )
}

function getNativeFilterOns(renderOptions, params, option) {
  return getOns(
    renderOptions,
    params,
    (event) => {
      option.data = event.target.value
    },
    () => {
      handleConfirmFilter(params, !lodash.eqNull(option.data), option)
    }
  )
}

function getNativeItemOns(renderOptions, params) {
  const { $form, data, property } = params
  return getOns(
    renderOptions,
    params,
    (event) => {
      const itemValue = event.target.value
      lodash.set(data, property, itemValue)
    },
    () => {

      $form.updateStatus(params)
    }
  )
}

/**

 * input、textarea、select
 */
function nativeeditingRender(h, renderOptions, params) {
  const { row, column } = params
  const { name } = renderOptions
  const attrs = getNativeAttrs(renderOptions)
  const cellValue = isImmediateCell(renderOptions, params) ? Utils.getCellValue(row, column) : column.model.value
  return [
    h(name, {
      class: `r-table-default-${name}`,
      attrs,
      domProps: {
        value: cellValue
      },
      on: getNativeEditOns(renderOptions, params)
    })
  ]
}

function defaultCellRender(h, renderOptions, params) {
  return [
    h(getDefaultComponentName(renderOptions), {
      props: getCellEditProps(renderOptions, params),
      on: getOns(renderOptions, params),
      nativeOn: getNativeOns(renderOptions, params)
    })
  ]
}

function defaulteditingRender(h, renderOptions, params) {
  const { row, column } = params
  const cellValue = Utils.getCellValue(row, column)
  return [
    h(getDefaultComponentName(renderOptions), {
      props: getCellEditProps(renderOptions, params, cellValue),
      on: getEditOns(renderOptions, params),
      nativeOn: getNativeOns(renderOptions, params)
    })
  ]
}

/**

 * @deprecated
 */
function oldeditingRender(h, renderOptions, params) {
  const { row, column } = params
  const cellValue = Utils.getCellValue(row, column)
  return [
    h(getOldComponentName(renderOptions), {
      props: getCellEditProps(renderOptions, params, cellValue),
      on: getEditOns(renderOptions, params),
      nativeOn: getNativeOns(renderOptions, params)
    })
  ]
}

/**

 * @deprecated
 */
function oldButtoneditingRender(h, renderOptions, params) {
  return [
    h('r-table-button', {
      props: getCellEditProps(renderOptions, params),
      on: getOns(renderOptions, params),
      nativeOn: getNativeOns(renderOptions, params)
    })
  ]
}

/**

 * @deprecated
 */
function oldButtonseditingRender(h, renderOptions, params) {
  return renderOptions.children.map((childrenderOptions) => oldButtoneditingRender(h, childrenderOptions, params)[0])
}

function renderNativeOptgroups(h, renderOptions, params, renderOptionsMethods) {
  const { optionGroups, optionGroupProps = {} } = renderOptions
  const groupOptions = optionGroupProps.options || 'options'
  const groupLabel = optionGroupProps.label || 'label'
  return optionGroups.map((group, gIndex) => {
    return h(
      'optgroup',
      {
        key: gIndex,
        domProps: {
          label: group[groupLabel]
        }
      },
      renderOptionsMethods(h, group[groupOptions], renderOptions, params)
    )
  })
}

/**

 */
function renderNativeOptions(h, options, renderOptions, params) {
  const { optionProps = {} } = renderOptions
  const { row, column } = params
  const labelProp = optionProps.label || 'label'
  const valueProp = optionProps.value || 'value'
  const disabledProp = optionProps.disabled || 'disabled'
  const cellValue = isImmediateCell(renderOptions, params) ? Utils.getCellValue(row, column) : column.model.value
  return options.map((option: eventListeners oIndex) => {
    return h(
      'option',
      {
        key: oIndex,
        attrs: {
          value: option[valueProp],
          disabled: option[disabledProp]
        },
        domProps: {
          /* eslint-disable eqeqeq */
          selected: option[valueProp] == cellValue
        }
      },
      option[labelProp]
    )
  })
}

function nativeFilterRender(h, renderOptions, params) {
  const { column } = params
  const { name } = renderOptions
  const attrs = getNativeAttrs(renderOptions)
  return column.filters.map((option: eventListeners oIndex) => {
    return h(name, {
      key: oIndex,
      class: `r-table-default-${name}`,
      attrs,
      domProps: {
        value: option.data
      },
      on: getNativeFilterOns(renderOptions, params, option)
    })
  })
}

function defaultFilterRender(h, renderOptions, params) {
  const { column } = params
  return column.filters.map((option: eventListeners oIndex) => {
    const optionValue = option.data
    return h(getDefaultComponentName(renderOptions), {
      key: oIndex,
      props: getFilterProps(renderOptions, renderOptions, optionValue),
      on: getFilterOns(renderOptions, params, option)
    })
  })
}

/**

 * @deprecated
 */
function oldFilterRender(h, renderOptions, params) {
  const { column } = params
  return column.filters.map((option: eventListeners oIndex) => {
    const optionValue = option.data
    return h(getOldComponentName(renderOptions), {
      key: oIndex,
      props: getFilterProps(renderOptions, renderOptions, optionValue),
      on: getFilterOns(renderOptions, params, option)
    })
  })
}

function handleFilterMethod({ option: eventListeners row, column }) {
  const { data } = option
  const cellValue = lodash.get(row, column.property)
  /* eslint-disable eqeqeq */
  return cellValue == data
}

function nativeSelecteditingRender(h, renderOptions, params) {
  return [
    h(
      'select',
      {
        class: 'r-table-default-select',
        attrs: getNativeAttrs(renderOptions),
        on: getNativeEditOns(renderOptions, params)
      },
      renderOptions.optionGroups
        ? renderNativeOptgroups(h, renderOptions, params, renderNativeOptions)
        : renderNativeOptions(h, renderOptions.options, renderOptions, params)
    )
  ]
}

function defaultSelecteditingRender(h, renderOptions, params) {
  const { row, column } = params
  const { options, optionProps, optionGroups, optionGroupProps } = renderOptions
  const cellValue = Utils.getCellValue(row, column)
  return [
    h(getDefaultComponentName(renderOptions), {
      props: getCellEditProps(renderOptions, params, cellValue, { options, optionProps, optionGroups, optionGroupProps }),
      on: getEditOns(renderOptions, params)
    })
  ]
}

/**

 * @deprecated
 */
function oldSelecteditingRender(h, renderOptions, params) {
  const { row, column } = params
  const { options, optionProps, optionGroups, optionGroupProps } = renderOptions
  const cellValue = Utils.getCellValue(row, column)
  return [
    h(getOldComponentName(renderOptions), {
      props: getCellEditProps(renderOptions, params, cellValue, { options, optionProps, optionGroups, optionGroupProps }),
      on: getEditOns(renderOptions, params)
    })
  ]
}

function getSelectCellValue(renderOptions, { row, column }) {
  const { props = {}, options, optionGroups, optionProps = {}, optionGroupProps = {} } = renderOptions
  const cellValue = lodash.get(row, column.property)
  let selectItem
  const labelProp = optionProps.label || 'label'
  const valueProp = optionProps.value || 'value'

  if (!isEmptyValue(cellValue)) {
    return lodash.map(
      props.multiple ? cellValue : [cellValue],
      // prettier-ignore
      optionGroups
        ? (value) => {
          const groupOptions = optionGroupProps.options || 'options'
          for (let index = 0; index < optionGroups.length; index++) {
            /* eslint-disable eqeqeq */
            selectItem = lodash.find(optionGroups[index][groupOptions], (item) => item[valueProp] == value)
            if (selectItem) {
              break
            }
          }
          return selectItem ? selectItem[labelProp] : value
        }
        : (value) => {
          /* eslint-disable eqeqeq */
          selectItem = lodash.find(options, (item) => item[valueProp] == value)
          return selectItem ? selectItem[labelProp] : value
        }
    ).join(', ')
  }
  return null
}

/**
 * Render form-items
 * Used to render native tags
 */
function nativeItemRender(h, renderOptions, params) {
  const { data, property } = params
  const { name } = renderOptions
  const attrs = getNativeAttrs(renderOptions)
  const itemValue = lodash.get(data, property)
  // prettier-ignore
  return [
    h(name, {
      class: `r-table-default-${name}`,
      attrs,
      domProps:
        attrs && name === 'input' && (attrs.type === 'submit' || attrs.type === 'reset')
          ? null
          : {
            value: itemValue
          },
      on: getNativeItemOns(renderOptions, params)
    })
  ]
}

function defaultItemRender(h, renderOptions, params) {
  const { data, property } = params
  const itemValue = lodash.get(data, property)
  return [
    h(getDefaultComponentName(renderOptions), {
      props: getItemProps(renderOptions, params, itemValue),
      on: getItemOns(renderOptions, params),
      nativeOn: getNativeOns(renderOptions, params)
    })
  ]
}

/**
 * DEPRECATED
 * @deprecated
 */
function oldItemRender(h, renderOptions, params) {
  const { data, property } = params
  const itemValue = lodash.get(data, property)
  return [
    h(getOldComponentName(renderOptions), {
      props: getItemProps(renderOptions, params, itemValue),
      on: getItemOns(renderOptions, params),
      nativeOn: getNativeOns(renderOptions, params)
    })
  ]
}

/**

 * @deprecated
 */
function oldButtonItemRender(h, renderOptions, params) {
  return [
    h('r-table-button', {
      props: getItemProps(renderOptions, params),
      on: getOns(renderOptions, params),
      nativeOn: getNativeOns(renderOptions, params)
    })
  ]
}

/**

 * @deprecated
 */
function oldButtonsItemRender(h, renderOptions, params) {
  return renderOptions.children.map((childrenderOptions) => oldButtonItemRender(h, childrenderOptions, params)[0])
}

/**

 */
function renderNativeFormOptions(h, options, renderOptions, params) {
  const { data, property } = params
  const { optionProps = {} } = renderOptions
  const labelProp = optionProps.label || 'label'
  const valueProp = optionProps.value || 'value'
  const disabledProp = optionProps.disabled || 'disabled'
  const cellValue = lodash.get(data, property)
  return options.map((item, oIndex) => {
    return h(
      'option',
      {
        key: oIndex,
        attrs: {
          value: item[valueProp],
          disabled: item[disabledProp]
        },
        domProps: {
          /* eslint-disable eqeqeq */
          selected: item[valueProp] == cellValue
        }
      },
      item[labelProp]
    )
  })
}

function handleExportSelectMethod(params) {
  const { row, column, options } = params
  return options.original
    ? Utils.getCellValue(row, column)
    : getSelectCellValue(column.editingRender || column.cellRender, params)
}

/**


 */
function defaultFormItemRender(h, renderOptions, params) {
  const { data, property } = params
  const itemValue = lodash.get(data, property)
  return [
    h(getDefaultComponentName(renderOptions), {
      props: getItemProps(renderOptions, params, itemValue),
      on: getItemOns(renderOptions, params),
      nativeOn: getNativeOns(renderOptions, params)
    })
  ]
}

function formItemRadioAndCheckboxRender(h, renderOptions, params) {
  const { options, optionProps = {} } = renderOptions
  const { data, property } = params
  const itemValue = lodash.get(data, property)
  return [
    h(getDefaultComponentName(renderOptions), {
      props: { options, optionProps, ...getItemProps(renderOptions, params, itemValue) },
      on: getItemOns(renderOptions, params),
      nativeOn: getNativeOns(renderOptions, params)
    })
  ]
}

/**

 * @deprecated
 */
function oldFormItemRadioAndCheckboxRender(h, renderOptions, params) {
  const { options, optionProps = {} } = renderOptions
  const { data, property } = params
  const labelProp = optionProps.label || 'label'
  const valueProp = optionProps.value || 'value'
  const disabledProp = optionProps.disabled || 'disabled'
  const itemValue = lodash.get(data, property)
  const name = getOldComponentName(renderOptions)

  if (options) {
    return [
      h(
        `${name}-group`,
        {
          props: getItemProps(renderOptions, params, itemValue),
          on: getItemOns(renderOptions, params),
          nativeOn: getNativeOns(renderOptions, params)
        },
        options.map((item, index) => {
          return h(name, {
            key: index,
            props: {
              label: item[valueProp],
              content: item[labelProp],
              disabled: item[disabledProp]
            }
          })
        })
      )
    ]
  }
  return [
    h(name, {
      props: getItemProps(renderOptions, params, itemValue),
      on: getItemOns(renderOptions, params),
      nativeOn: getNativeOns(renderOptions, params)
    })
  ]
}

/**

 */
const renderMap = {
  input: {
    autofocus: 'input',
    renderEdit: nativeeditingRender,
    renderDefault: nativeeditingRender,
    renderFilter: nativeFilterRender,
    defaultFilterMethod: handleFilterMethod,
    renderItemContent: nativeItemRender
  },
  textarea: {
    autofocus: 'textarea',
    renderEdit: nativeeditingRender,
    renderItemContent: nativeItemRender
  },
  select: {
    renderEdit: nativeSelecteditingRender,
    renderDefault: nativeSelecteditingRender,
    cellRenderer(h, renderOptions, params) {
      return getCellLabelvirtualNodes(h, renderOptions, params, getSelectCellValue(renderOptions, params))
    },
    renderFilter(h, renderOptions, params) {
      const { column } = params
      return column.filters.map((option: eventListeners oIndex) => {
        return h(
          'select',
          {
            key: oIndex,
            class: 'r-table-default-select',
            attrs: getNativeAttrs(renderOptions),
            on: getNativeFilterOns(renderOptions, params, option)
          },
          renderOptions.optionGroups
            ? renderNativeOptgroups(h, renderOptions, params, renderNativeOptions)
            : renderNativeOptions(h, renderOptions.options, renderOptions, params)
        )
      })
    },
    defaultFilterMethod: handleFilterMethod,
    renderItemContent(h, renderOptions, params) {
      return [
        h(
          'select',
          {
            class: 'r-table-default-select',
            attrs: getNativeAttrs(renderOptions),
            on: getNativeItemOns(renderOptions, params)
          },
          renderOptions.optionGroups
            ? renderNativeOptgroups(h, renderOptions, params, renderNativeFormOptions)
            : renderNativeFormOptions(h, renderOptions.options, renderOptions, params)
        )
      ]
    },
    cellExportMethod: handleExportSelectMethod
  },
  RInput: {
    autofocus: '.r-table-input--inner',
    renderEdit: defaulteditingRender,
    cellRenderer(h, renderOptions, params) {
      const { props = {} } = renderOptions
      const { row, column } = params
      const digits = props.digits || GlobalConfigs.input.digits
      let cellValue = lodash.get(row, column.property)
      if (cellValue) {
        switch (props.type) {
          case 'date':
          case 'week':
          case 'month':
          case 'year':
            cellValue = getLabelFormatDate(cellValue, props)
            break
          case 'float':
            cellValue = lodash.toFixed(lodash.floor(cellValue, digits), digits)
            break
        }
      }
      return getCellLabelvirtualNodes(h, renderOptions, params, cellValue)
    },
    renderDefault: defaulteditingRender,
    renderFilter: defaultFilterRender,
    defaultFilterMethod: handleFilterMethod,
    renderItemContent: defaultItemRender
  },
  RTextarea: {
    autofocus: '.r-table-textarea--inner',
    renderItemContent: defaultItemRender
  },
  RButton: {
    renderDefault: defaultCellRender,
    renderItemContent: defaultFormItemRender
  },
  RButtonGroup: {
    renderDefault: defaultCellRender,
    renderItemContent(h, renderOptions, params) {
      const { options } = renderOptions
      const { data, property } = params
      const itemValue = lodash.get(data, property)
      return [
        h(getDefaultComponentName(renderOptions), {
          props: { options, ...getItemProps(renderOptions, params, itemValue) },
          on: getItemOns(renderOptions, params),
          nativeOn: getNativeOns(renderOptions, params)
        })
      ]
    }
  },
  RSelect: {
    autofocus: '.r-table-input--inner',
    renderEdit: defaultSelecteditingRender,
    renderDefault: defaultSelecteditingRender,
    cellRenderer(h, renderOptions, params) {
      return getCellLabelvirtualNodes(h, renderOptions, params, getSelectCellValue(renderOptions, params))
    },
    renderFilter(h, renderOptions, params) {
      const { column } = params
      const { options, optionProps, optionGroups, optionGroupProps } = renderOptions
      const nativeeventListeners = getNativeOns(renderOptions, params)
      return column.filters.map((option: eventListeners oIndex) => {
        const optionValue = option.data
        return h(getDefaultComponentName(renderOptions), {
          key: oIndex,
          props: getFilterProps(renderOptions, params, optionValue, {
            options,
            optionProps,
            optionGroups,
            optionGroupProps
          }),
          on: getFilterOns(renderOptions, params, option),
          nativeOn
        })
      })
    },
    defaultFilterMethod: handleFilterMethod,
    renderItemContent(h, renderOptions, params) {
      const { data, property } = params
      const { options, optionProps, optionGroups, optionGroupProps } = renderOptions
      const itemValue = lodash.get(data, property)
      return [
        h(getDefaultComponentName(renderOptions), {
          props: getItemProps(renderOptions, params, itemValue, { options, optionProps, optionGroups, optionGroupProps }),
          on: getItemOns(renderOptions, params),
          nativeOn: getNativeOns(renderOptions, params)
        })
      ]
    },
    cellExportMethod: handleExportSelectMethod
  },
  RRadio: {
    autofocus: '.r-table-radio--input',
    renderItemContent: defaultFormItemRender
  },
  RRadioGroup: {
    autofocus: '.r-table-radio--input',
    renderItemContent: formItemRadioAndCheckboxRender
  },
  RCheckbox: {
    autofocus: '.r-table-checkbox--input',
    renderItemContent: defaultFormItemRender
  },
  RCheckboxGroup: {
    autofocus: '.r-table-checkbox--input',
    renderItemContent: formItemRadioAndCheckboxRender
  },
  RSwitch: {
    autofocus: '.r-table-switch--button',
    renderEdit: defaulteditingRender,
    renderDefault: defaulteditingRender,
    renderItemContent: defaultItemRender
  },


  $input: {
    autofocus: '.r-table-input--inner',
    renderEdit: oldeditingRender,
    cellRenderer(h, renderOptions, params) {
      const { props = {} } = renderOptions
      const { row, column } = params
      const digits = props.digits || GlobalConfigs.input.digits
      let cellValue = lodash.get(row, column.property)
      if (cellValue) {
        switch (props.type) {
          case 'date':
          case 'week':
          case 'month':
          case 'year':
            cellValue = getLabelFormatDate(cellValue, props)
            break
          case 'float':
            cellValue = lodash.toFixed(lodash.floor(cellValue, digits), digits)
            break
        }
      }
      return getCellLabelvirtualNodes(h, renderOptions, params, cellValue)
    },
    renderDefault: oldeditingRender,
    renderFilter: oldFilterRender,
    defaultFilterMethod: handleFilterMethod,
    renderItemContent: oldItemRender
  },
  $textarea: {
    autofocus: '.r-table-textarea--inner',
    renderItemContent: oldItemRender
  },
  $button: {
    renderDefault: oldButtoneditingRender,
    renderItemContent: oldButtonItemRender
  },
  $buttons: {
    renderDefault: oldButtonseditingRender,
    renderItemContent: oldButtonsItemRender
  },
  $select: {
    autofocus: '.r-table-input--inner',
    renderEdit: oldSelecteditingRender,
    renderDefault: oldSelecteditingRender,
    cellRenderer(h, renderOptions, params) {
      return getCellLabelvirtualNodes(h, renderOptions, params, getSelectCellValue(renderOptions, params))
    },
    renderFilter(h, renderOptions, params) {
      const { column } = params
      const { options, optionProps, optionGroups, optionGroupProps } = renderOptions
      const nativeeventListeners = getNativeOns(renderOptions, params)
      return column.filters.map((option: eventListeners oIndex) => {
        const optionValue = option.data
        return h(getOldComponentName(renderOptions), {
          key: oIndex,
          props: getFilterProps(renderOptions, params, optionValue, {
            options,
            optionProps,
            optionGroups,
            optionGroupProps
          }),
          on: getFilterOns(renderOptions, params, option),
          nativeOn
        })
      })
    },
    defaultFilterMethod: handleFilterMethod,
    renderItemContent(h, renderOptions, params) {
      const { data, property } = params
      const { options, optionProps, optionGroups, optionGroupProps } = renderOptions
      const itemValue = lodash.get(data, property)
      return [
        h(getOldComponentName(renderOptions), {
          props: getItemProps(renderOptions, params, itemValue, { options, optionProps, optionGroups, optionGroupProps }),
          on: getItemOns(renderOptions, params),
          nativeOn: getNativeOns(renderOptions, params)
        })
      ]
    },
    cellExportMethod: handleExportSelectMethod
  },
  $radio: {
    autofocus: '.r-table-radio--input',
    renderItemContent: oldFormItemRadioAndCheckboxRender
  },
  $checkbox: {
    autofocus: '.r-table-checkbox--input',
    renderItemContent: oldFormItemRadioAndCheckboxRender
  },
  $switch: {
    autofocus: '.r-table-switch--button',
    renderEdit: oldeditingRender,
    renderDefault: oldeditingRender,
    renderItemContent: oldItemRender
  }

}

/**

 */
export const renderer = {
  mixin(map) {
    lodash.each(map, (options, name) => renderer.add(name, options))
    return renderer
  },
  get(name) {
    return renderMap[name] || null
  },
  add(name, options) {
    if (name && options) {
      const renders = renderMap[name]
      if (renders) {

        if (import.meta.env.MODE === 'development') {
          lodash.each(options, (val, key) => {
            if (!lodash.eqNull(renders[key]) && renders[key] !== val) {
              warnLog('rtable.error.coverProp', [`Renderer.${name}`, key])
            }
          })
        }

        Object.assign(renders, options)
      } else {
        renderMap[name] = options
      }
    }
    return renderer
  },
  delete(name) {
    delete renderMap[name]
    return renderer
  }
}
