let formIODQE = function () {
    let host = ''

    let server =  Routing.generate('formio_dqe_proxy')

    function _init(params) {
        $('#formio').on('change', ':input[type=email]', function (event) {
            checkEmail($(this))
            console.log('test')
        })
        $('#formio').on('change', '.formio-component-phoneNumber :input', function (event) {
            checkPhone($(this))
        })
        $('#formio').on('change', '.address-dqe :input', function (event) {
            let $id = $('#' + $(this).attr('id'))
            checkAddress($id)
        })
    }

    /**
     * Validation Tel
     */
    function checkPhone($phoneInput) {
        let options = {
            server: server,
            country: 'FRA',
            format: 0,
            host: host
        }
        let $myDqePhone = $phoneInput.dqephone(options)
        let errorDiv = $myDqePhone.parent().next('.help-block')
        console.log($myDqePhone.parent().parent().parent().parent().parent().next('.help-block'));
        $myDqePhone.on('checked', function (ui, data) {
            if (data.status === 1) {
                $phoneInput.addClass('is-valid').removeClass('is-invalid')
                errorDiv.html('')
            } else {
                $phoneInput.removeClass('is-valid').addClass('is-invalid')
                errorDiv.html('Veuillez renseigner un numéro de téléphone valide')
            }
        })
        return $myDqePhone
    }

    function checkEmail($emailInput) {
        let options = {
            server: server,
            rectify: true,
            host: host
        }
        let $myDqeEmail = $emailInput.dqemail(options)
        let errorDiv = $myDqeEmail.parent().next('.help-block')
        $myDqeEmail.on('checked', function (ui, data) {
            //console.log(data.state);
            if (data.state === 'error') {
                $emailInput.removeClass('is-valid').addClass('is-invalid')
                errorDiv.html(data.msg)
            } else {
                $emailInput.addClass('is-valid').removeClass('is-invalid')
                errorDiv.html('')
            }
        })
       console.log($myDqeEmail);
        return $myDqeEmail
    }

    /**
     * Validation d'adresse
     */
    function checkAddress(idAddress) {
        const form = $('#formio')
        if (form.length) {
            form.dqe({
                country: 'FRA',
                street: idAddress,
                single: idAddress,
                server: server,
                host: host
            })
        }
    }

    return {
        init: _init,
        checkPhone: checkPhone,
        checkEmail: checkEmail,
        checkAddress: checkAddress
    }

}();
export default formIODQE