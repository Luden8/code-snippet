import lodash from 'lodash'
import GlobalConfigs from '../r-datatable/src/conf'
import { interceptor } from './src/interceptor'
import { renderer } from './src/renderer'
import { commands } from './src/commands'
import { menus } from './src/menus'
import { formats } from './src/formats'
import { validators } from './src/validators'
import { config } from './src/config'
import { Utils } from '../tools/utils'
import { errLog } from '../tools/log'

const installedPlugins = []

export function use(Plugin, options) {
  /* eslint-disable @typescript-eslint/no-use-before-define */
  if (Plugin && Plugin.install) {
    if (installedPlugins.indexOf(Plugin) === -1) {
      Plugin.install(RTable, options)
      installedPlugins.push(Plugin)
    }
  }
  return RTable
}

/**
 * Check whether the modules are installed in the correct order
 */
function reg(key) {
  /* eslint-disable @typescript-eslint/no-use-before-define */
  // Check that the installation sequence is correct
  if (import.meta.env.MODE === 'development') {
    if (RTable.Table) {
      errLog('rtable.error.useErr', [key])
    }
  }
  RTable[`_${key}`] = 1
}

function getExportOrImpotType(types, flag) {
  const rest = []
  lodash.objectEach(types, (val, type) => {
    if (val === 0 || val === flag) {
      rest.push(type)
    }
  })
  return rest
}

class RTableConfig {
  /**
   * Get the current zIndex
   */
  get zIndex() {
    return Utils.getLastZIndex()
  }

  /**
   * Get the next zIndex
   */
  get nextZIndex() {
    return Utils.nextZIndex()
  }

  /**
   * Get all export types
   */
  get exportTypes() {
    return getExportOrImpotType(GlobalConfigs.export.types, 1)
  }

  /**
   * Get all import types
   */
  get importTypes() {
    return getExportOrImpotType(GlobalConfigs.export.types, 2)
  }
}

// DEPRECATED
export const globalConfigs = new RTableConfig()

export function t(key, args) {
  return GlobalConfigs.i18n(key, args)
}

export function _t(key, args) {
  return key ? lodash.toValueString(GlobalConfigs.translate ? GlobalConfigs.translate(key, args) : key) : ''
}

export const v = 'v3'
export const setup = config

export const globalStore = {}

export const RTable = {
  v,
  version: '3.8.2',
  reg,
  use,
  setup,
  globalStore,
  interceptor,
  renderer,
  commands,
  formats,
  menus,
  validators,
  t,
  _t,

  // Hardcoded
  _tooltip: 1,

  // DEPRECATED
  config,
  globalConfigs
}

export * from './src/formats'
export * from './src/config'
export * from './src/renderer'
export * from './src/interceptor'
export * from './src/menus'
export * from './src/commands'

export default RTable
