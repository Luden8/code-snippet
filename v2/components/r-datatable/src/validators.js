import RStore from './store'

export const validators = new RStore()

if (import.meta.env.MODE === 'development') {
  Object.assign(validators, { _name: 'Validators' })
}
