import GlobalConfigs from '../r-datatable/src/conf'

export function getLog(message, params) {
  return `[r4m-table v${3}] ${GlobalConfigs.i18n(message, params)}`
}

function outLog(type) {
  return function (message, params) {
    const msg = getLog(message, params)
    console[type](msg)
    return msg
  }
}

export const warnLog = outLog('warn')
export const errLog = outLog('error')
