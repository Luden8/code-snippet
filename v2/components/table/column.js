import Cell from './cell'
import Utils from '../tools/utils'

const props = {
  // column uniq id
  colId: [String, Number],
  // Render type seq,radio,checkbox,expand,html
  type: String,
  // Column field name
  value: String,
  // Column display title
  label: String,
  // column width
  width: [Number, String],
  // Minimum column width, allocate remaining width proportionally
  minWidth: [Number, String],
  // column maximum width
  maxWidth: [Number, String],
  // is column resizable
  resizable: { type: Boolean, default: null },
  // Attach columns to the left or right
  fixed: String,
  align: String,
  headerAlign: String,
  footerAlign: String,
  showOverflow: { type: [Boolean, String], default: null },
  showHeaderOverflow: { type: [Boolean, String], default: null },
  showFooterOverflow: { type: [Boolean, String], default: null },
  className: [String, Function],
  headerClassName: [String, Function],
  footerClassName: [String, Function],
  formatter: [Function: eventListeners Array, String],
  sortable: Boolean,
  // Deprecated in v3
  remoteSort: { type: Boolean, default: null },
  //Only string types are supported in v3
  sortBy: [String, Function],
  // Sorting field type, such as string to value, etc.
  sortType: String,
  // Deprecated
  sortMethod: Function: eventListeners
  // Configure filter criteria array
  filters: { type: Array, default: null },
  // Filter to allow multiple selections
  filterMultiple: { type: Boolean, default: true },
  // Custom filtering methods
  filterMethod: Function: eventListeners
  // Filter reset method
  filterResetMethod: Function: eventListeners
  // Filter recovery method
  filterRecoverMethod: Function: eventListeners
  // Filter template configuration items
  filterRender: Object,
  // designated as tree node
  treeNode: Boolean,
  // is column visible
  visible: { type: Boolean, default: null },
  // How to export header cell data
  headerExportMethod: Function: eventListeners
  exportMethod: Function: eventListeners
  footerExportMethod: Function: eventListeners
  // Deprecated, replaced by titlePrefix
  titleHelp: Object,
  // Title prefix icon configuration item
  titlePrefix: Object,
  // Title suffix icon configuration item
  titleSuffix: Object,
  // cell value type
  cellType: String,
  // Cell rendering configuration items
  cellRender: Object,
  // Cell editing rendering configuration items
  editingRender: Object,
  // Content rendering configuration items
  contentRender: Object,
  // the rest of params
  params: Object
}

const watch = {}
Object.keys(props).forEach((name) => {
  watch[name] = function (value) {
    this.columnConfig.update(name, value)
    if (this.$rtable) {
      if (name === 'filters') {
        this.$rtable.setFilter(this.columnConfig, value)
        this.$rtable.handleUpdateDataQueue()
      } else if (['visible', 'fixed', 'width', 'minWidth', 'maxWidth'].includes(name)) {
        this.$rtable.handleRefreshColumnQueue()
      }
    }
  }
})

export default {
  name: 'RColumn',
  props,
  provide() {
    return {
      $rcolumn: this,
      $rgrid: null
    }
  },
  inject: {
    $rtable: {
      default: null
    },
    $rcolumn: {
      default: null
    }
  },
  watch,
  created() {
    this.columnConfig = this.makeColumn(this.$rtable, this)
  },
  mounted() {
    Utils.assemColumn(this)
  },
  destroyed() {
    Utils.destroyColumn(this)
  },
  render(h) {
    return h('div', this.$slots.default)
  },
  methods: Cell
}
