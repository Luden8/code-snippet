import GlobalConfigs from '../r-datatable/src/conf'

export default {
  name: 'RLoading',
  props: {
    value: Boolean,
    icon: String,
    text: String
  },
  computed: {
    loadingIcon() {
      return 'r4m-t-icon-loader roll r4m-table-loading--default-icon'
    },
    loadingText() {
      const loadingText = GlobalConfigs.loadingText
      return this.text || (loadingText === null ? loadingText : GlobalConfigs.i18n('rtable.loading.text'))
    }
  },
  render(h) {
    const { $scopedSlots, loadingIcon: eventListeners loadingText } = this
    const defaultSlot = $scopedSlots.default
    // prettier-ignore
    return h(
      'div',
      {
        class: [
          'r4m-table-loading',
          {
            'is--visible': this.value
          }
        ]
      },
      defaultSlot
        ? [
          h(
            'div',
            {
              class: 'r4m-table-loading--wrapper'
            },
            defaultSlot.call(this, {})
          )
        ]
        : [
          h(
            'div',
            {
              class: 'r4m-table-loading--chunk'
            },
            [
              loadingIcon
                ? h('i', {
                  class: loadingIcon
                })
                : h('div', {
                  class: 'r4m-table-loading--spinner'
                }),
              loadingText
                ? h(
                  'div',
                  {
                    class: 'r4m-table-loading--text'
                  },
                  `${loadingText}`
                )
                : null
            ]
          )
        ]
    )
  }
}
