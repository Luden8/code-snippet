import GlobalConfigs from './conf'
import DomZIndex from 'dom-zindex'
import lodash from 'lodash'

/**
 * 
 */
export function config(options) {
  if (options && options.zIndex) {
    DomZIndex.setCurrent(options.zIndex)
  }
  return lodash.merge(GlobalConfigs, options)
}
