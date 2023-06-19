
let createForm = function() {
    function _init(params) {
        window.onload = function() {
            const formio = document.getElementById('formio');
            let url = formio.getAttribute("url-data");
            Formio.createForm(formio, url);
        };
    }

    return {
        init: _init
    }

}()

export default createForm