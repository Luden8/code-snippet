import lodash from 'lodash'

export function getSlotVirtualNodes(virtualNodes) {
  if (lodash.isArray(virtualNodes)) {
    return virtualNodes
  }
  return [virtualNodes]
}
