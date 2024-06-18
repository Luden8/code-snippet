import { getFuncText } from '../tools/utils'

export default {
  name: 'RTableMenuPanel',
  props: {
    ctxMenuStore: Object,
    ctxMenuOpts: Object
  },
  mounted() {
    document.body.appendChild(this.$el)
  },
  beforeDestroy() {
    const { $el } = this
    if ($el.parentNode) {
      $el.parentNode.removeChild($el)
    }
  },
  render(h) {
    const $rtable = this.$parent
    const { _e, ctxMenuOpts, ctxMenuStore } = this
    // prettier-ignore
    return h(
      'div',
      {
        class: [
          'r4m-table--context-menu-wrapper',
          ctxMenuoptions.className,
          {
            'is--visible': ctxMenuStore.visible
          }
        ],
        style: ctxMenuStore.style
      },
      ctxMenuStore.list.map((options, gIndex) => {
        return options.every((item) => item.visible === false)
          ? _e()
          : h(
            'ul',
            {
              class: 'r-table-context-menu--option-wrapper',
              key: gIndex
            },
            options.map((item, index) => {
              const hasChildMenus = item.children && item.children.some((child) => child.visible !== false)
              return item.visible === false
                ? null
                : h(
                  'li',
                  {
                    class: [
                      item.className,
                      {
                        'link--disabled': item.disabled,
                        'link--active': item === ctxMenuStore.selected
                      }
                    ],
                    key: `${gIndex}_${index}`
                  },
                  [
                    h(
                      'a',
                      {
                        class: 'r-table-context-menu--link',
                        on: {
                          click(event) {
                            $rtable.ctxMenuLinkEvent(event, item)
                          },
                          mouseover(event) {
                            $rtable.ctxMenuMouseoverEvent(event, item)
                          },
                          mouseout(event) {
                            $rtable.ctxMenuMouseoutEvent(event, item)
                          }
                        }
                      },
                      [
                        h('i', {
                          class: ['r-table-context-menu--link-prefix', item.prefixIcon]
                        }),
                        h(
                          'span',
                          {
                            class: 'r-table-context-menu--link-content'
                          },
                          getFuncText(item.name)
                        ),
                        h('i', {
                          class: [
                            'r-table-context-menu--link-suffix',
                            hasChildMenus ? item.suffixIcon || 'suffix--haschild' : item.suffixIcon
                          ]
                        })
                      ]
                    ),
                    hasChildMenus
                      ? h(
                        'ul',
                        {
                          class: [
                            'r4m-table--context-menu-clild-wrapper',
                            {
                              'is--show': item === ctxMenuStore.selected && ctxMenuStore.showChild
                            }
                          ]
                        },
                        item.children.map((child, cIndex) => {
                          return child.visible === false
                            ? null
                            : h(
                              'li',
                              {
                                class: [
                                  child.className,
                                  {
                                    'link--disabled': child.disabled,
                                    'link--active': child === ctxMenuStore.selectChild
                                  }
                                ],
                                key: `${gIndex}_${index}_${cIndex}`
                              },
                              [
                                h(
                                  'a',
                                  {
                                    class: 'r-table-context-menu--link',
                                    on: {
                                      click(event) {
                                        $rtable.ctxMenuLinkEvent(event, child)
                                      },
                                      mouseover(event) {
                                        $rtable.ctxMenuMouseoverEvent(event, item, child)
                                      },
                                      mouseout(event) {
                                        $rtable.ctxMenuMouseoutEvent(event, item, child)
                                      }
                                    }
                                  },
                                  [
                                    h('i', {
                                      class: ['r-table-context-menu--link-prefix', child.prefixIcon]
                                    }),
                                    h(
                                      'span',
                                      {
                                        class: 'r-table-context-menu--link-content'
                                      },
                                      getFuncText(child.name)
                                    )
                                  ]
                                )
                              ]
                            )
                        })
                      )
                      : null
                  ]
                )
            })
          )
      })
    )
  }
}
