import '../dqe/jquery.dqe'
import '../dqe/jquery.dqemail'
import '../dqe/jquery.dqeb2b'
import '../dqe/jquery.dqephone'
import '../dqe/jquery.dqefirstname'

let DqeValidator = {
    anonymousHost: 'https://dqehost/',
    route: null,
    formSelector: null,
    email: null,
    phoneOrCellNumber: null,
    cityOrZipCode: null,
    handlers: {},
    msgRequired: 'Veuillez renseigner ce champ.',
    msgRadioRequired: "Veuillez sélectionner l'une de ces options.",
    msgPhoneInvalid: "Ce numéro de téléphone n'existe pas",
    msgEmailRectified: 'Nous vous suggérons la correction suivante :',
    msgZipcityInvalid: 'Veuillez sélectionner une adresse parmi celles proposées.',

    /**
     * Requires jQuery UI 1.12
     * Based on the DQE Jquery plugin modified by ACX
     * Use the dqe_parameters Twig function to build the parameters argument
     * See \GA\Bundle\MerBundle\Twig\DqeExtension::dqeParameters for details
     *
     * You can override the DqeValidator methods by defining your own method through the handlers parameter
     * Overrided methods are called with the DqeValidator has last argument. See each method for details
     *
     * let handlers = {
     *  checkRequired: function(target, {DqeValidator} validator)
     *  methodName: callable
     * }
     *
     * @constructor
     * @param {object} params
     * @param {object} handlers
     *
     */
    init: function (params, handlers) {
        if (typeof jQuery === 'undefined' || typeof jQuery.ui === 'undefined') {
            console.error('DQE validation requires JQuery UI 1.12')
            return
        }

        this.route = params.route
        this.formSelector = 'form[name="' + params.formName + '"]'
        this.email = '#' + params.email
        this.phoneOrCellNumber = '#' + params.phoneOrCellNumber
        this.address = '#' + params.address
        this.cityOrZipCode = '#' + params.cityOrZipCode
        this.setHandlers(handlers)

        if (params.hasOwnProperty('msgRequired')) {
            this.msgRequired = params.msgRequired
        }
        if (params.hasOwnProperty('msgRadioRequired')) {
            this.msgRequired = params.msgRadioRequired
        }
        if (params.hasOwnProperty('msgPhoneInvalid')) {
            this.msgRequired = params.msgPhoneInvalid
        }
        if (params.hasOwnProperty('msgEmailRectified')) {
            this.msgEmailRectified = params.msgEmailRectified
        }

        let that = this
        $('input,textarea,select')
            .filter('[required]:visible')
            .on('blur', function (event) {
                that.checkRequired(event.target)
            })

        this.checkEmail()
        this.checkPhone()
    },

    /**
     * Plugs the DQE email validation on the email field
     *
     * @return {undefined}
     * @private
     */
    checkEmail: function () {
        let that = this
        $(this.email)
            .dqemail({
                host: this.anonymousHost,
                server: this.route,
                autocheck: true,
                rectify: true,
            })
            .on('checking', function () {
                that.fieldReset(that.email)
            })
            .on('keypress', function () {
                that.fieldReset(that.email)
            })
            .on('checked', function (event, data) {
                if (
                    data.rectified &&
                    data.code !== '01' &&
                    data.code !== '02' &&
                    data.suggestion.indexOf('@') > -1
                ) {
                    that.emailRectified(that.email, data)
                } else if (data.msg.length === 0) {
                    that.fieldSuccess(that.email, data)
                } else {
                    that.fieldError(that.email, data)
                }
            })
    },

    /**
     * Plugs the DQE phone validation on the email field
     *
     * @return {undefined}
     * @private
     */
    checkPhone: function () {
        let that = this
        $(this.phoneOrCellNumber)
            .dqephone({
                host: this.anonymousHost,
                server: this.route,
                autocheck: true,
                country: 'FRA',
                format: 0,
            })
            .on('checking', function () {
                that.fieldReset(that.phoneOrCellNumber)
            })
            .on('keypress', function () {
                that.fieldReset(that.phoneOrCellNumber)
            })
            .on('checked', function (event, data) {
                if (data.status) {
                    that.fieldSuccess(that.phoneOrCellNumber, data)
                } else {
                    data.msg = that.msgPhoneInvalid
                    that.fieldError(that.phoneOrCellNumber, data)
                }
            })
    },


}

export default DqeValidator
