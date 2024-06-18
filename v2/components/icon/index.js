export default {
  name: 'RIcon',
  props: {
    name: String,
    roll: Boolean,
    status: String
  },
  render(h) {
    const { name, roll, status } = this
    return h('i', {
      class: [`r4m-table-icon-${name}`, roll ? 'roll' : '', status ? [`theme--${status}`] : ''],
      on: {
        click: this.clickEvent
      }
    })
  },
  methods: {
    clickEvent(event) {
      this.$emit('click', { $event: event })
    }
  }
}
