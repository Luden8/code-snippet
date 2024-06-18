import RTableColumn from './column'

export default {
  name: 'RColgroup',
  extends: RTableColumn,
  provide() {
    return {
      xecolgroup: this,
      $rgrid: null
    }
  }
}
