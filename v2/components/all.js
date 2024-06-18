import lodash from 'lodash'
import { RTable } from './r-datatable'

// TODO: Place locales outside
import enUS from './locale/lang/en-US'

import Grid from './grid'
import Table from './table/table'

RTable.config({
  i18n: (key, args) => lodash.toFormatString(lodash.get(enUS, key), args)
})

RTable.reg('menu')

export { Grid, Table }
