import $ from 'jquery'
import { Formio } from './formio.full.min'
import createForm from './createForm'
import formIODQE  from './dqe/dqe'
window.$ = window.jQuery = $
createForm.init()
formIODQE.init()
