(function( $ ) {

    /**
     * Appelle le service DQE à partir du champ de saisie d'un téléphone
     * Options disponibles :
     *   - server: URL du serveur
     *   - country: code d'un pays précis (3 caractères) OU sélecteur jQuery pointant sur le champ pays
     *   - autocheck: lance la vérification du téléphone lorsqu'on quitte le champ téléphone (par défaut = true)
     *   - format: format de sortie du numéro de téléphone (0=chiffres, 1=avec séparateurs, 2=international basique, 3=international complet)
     *
     * Méthodes disponibles :
     *   - check(callback_function_name, [output_format]) : lance manuellement la validation du téléphone saisi et appelle callback_function_name avec les résultats de la validation
     * 
     * Evènements disponibles :
     *   - checking: se lance juste avant la vérification d'un téléphone
     *   - checked(data): se lance dès qu'un téléphone est validé. Cet évènement doit obligatoirement être implémenté si autocheck est à true car c'est alors la seule façon de récupérer le résultat de la validation

     *
     * @param {object} options Tableau associatif des options
     * @returns {jQuery}
     */
    $.fn.dqephone = function(options) {

        var myDQE = this;
        
        //On initialise le conteneur du champ et l'icône de statut s'il y en a (uniquement pour des champs Bootstrap)
        var myDQEContainer = myDQE.closest('.form-group');
        var myDQEIcon = false;
        var myDQEIconMode = false;
        if (myDQEContainer.length) {
            myDQEIcon = myDQEContainer.find('span.glyphicon');
            if (myDQEIcon.length) myDQEIconMode = 'glyphicon';
            else myDQEIcon = myDQEContainer.find('i.fa');
            if (myDQEIcon.length) myDQEIconMode = 'fa';
            else myDQEIcon = false;
        }
        else myDQEContainer = false;
        
        var settings = $.extend({
            //Paramètres par défaut
            country: 'FRA',
            format: 0,
            license: ''
        }, options);
        myDQE.settings = settings;

        //On récupère les champs à partir de leur selecteur
        myDQE.server       = settings.server;
        myDQE.license      = settings.license;
        myDQE.host         = settings.host;
        myDQE.countryField = settings.country.length == 3 ? false : $(settings.country);
        myDQE.autocheck    = settings.autocheck === undefined ? true : settings.autocheck;
        myDQE.country      = settings.country;
        myDQE.format       = settings.format;
        myDQE.asmx         = myDQE.server.toLowerCase().indexOf(".asmx") > -1;

        //Paramètres d'appel AJAX par défaut pour .net
        if (myDQE.asmx) {
            $.ajaxSetup({
                type: "POST",
                contentType: "application/json; charset=utf-8",
                data: "{}",
                processData: false,
                dataFilter: function(data) {
                    if (typeof (JSON) !== 'undefined' && typeof (JSON.parse) === 'function') data = JSON.parse(data);
                    else data = eval('(' + data + ')');
                    if (data.hasOwnProperty('d')) return data.d;
                    return data;
                }
            });

            $.ajaxPrefilter(function(options, originalOptions, jqXHR) {
                options.data = JSON.stringify(originalOptions.data);
            });
        }

        if (myDQE.server == 'jsonp') {
            myDQE.ajax = function(url, callback) {
                $.ajax({
                    url: url,
                    dataType: 'jsonp',
                    jsonp: 'callback',
                    success: function(data) {
                        callback(JSON.parse(data));
                    }
                });
            };
        }
        else {
            myDQE.ajax = function(url, callback) {
                $.ajax({
                    url: myDQE.server,
                    data: {url: url},
                    method: 'POST',
                    dataType: 'json',
                    success: function(data) {
                        callback(data);
                    }
                });
            };
        }
        
        myDQE.check = function(callback_function_name, output_format, complete_check) {
            var input = myDQE.val();
            if (input) {
                myDQE.trigger('checking');
                myDQE.bootstrapState("loading");

                var fmt = output_format ? output_format : myDQE.format;
                var country = myDQE.selected_country();
                

                var ko = {status: 0, state: 'error'};
                if (!input) {
                    myDQE.trigger('checked', [ko]);
                    myDQE.bootstrapState('error');
                    if (callback_function_name) window[callback_function_name](ko);
                    return;
                }

                var query = {fn: "TEL", Pays: country, Tel: input, Format: fmt};
                complete_check = complete_check == 1;
                if (complete_check) query["complete_check"] = 1;
                var url = myDQE.url(query);
                myDQE.ajax(url, function(data) {
                    if (!data || !data[1]) data = ko;
                    else {
                        data = data[1];
                        var ok = parseInt(data['IdError'], 10);
                        //data = ok ? {status: 1, input: input, output: data['Tel'], state: 'success'} : ko;
                        data = ok ? {
                            location:   data['Geolocation'],
                            status:     data['IdError'],
                            state:      'success',
                            OldOperator:data['OldOperator'],
                            Operator:   data['Operator'],
                            Ported:     data['Ported'],
                            Tel:        data['Tel'],
                            TelOrigine: data['TelOrigine'],
                            Type:       data['Type']
                        } : ko;
                    }
                    myDQE.trigger('checked', [data]);
                    myDQE.bootstrapState(data.state);
                    if (callback_function_name) window[callback_function_name](data);
                });
            }
        };

        myDQE.isIE = function() {
            var ua = navigator.userAgent;
            return ua.indexOf("MSIE ") > -1 || ua.indexOf("Trident/") > -1 || ua.indexOf('Edge/') > -1;
        };
        
        myDQE.clearBootstrapState = function() {
            if (myDQEContainer) myDQEContainer.removeClass('has-success').removeClass('has-warning').removeClass('has-error');
            if (myDQEIcon) {
                if (myDQEIconMode == 'glyphicon') myDQEIcon.removeClass('glyphicon-ok').removeClass('glyphicon-warning-sign').removeClass('glyphicon-remove');
                else myDQEIcon.removeClass('icon-check-o').removeClass('icon-cancel-o').removeClass('icon-cancel-o').removeClass('icon-spin').removeClass('icon-refresh1');
            }
        };
        
        myDQE.bootstrapState = function(state) {
            myDQE.clearBootstrapState();
            if (state) myDQEContainer.addClass("has-" + state);
            var signs, sign;
            if (myDQEIcon) {
                if (myDQEIconMode == 'glyphicon') {
                    //glyph icons
                    signs = {success: 'ok', warning: 'warning-sign', error: 'remove'};
                    sign = signs[state];
                    if (state) myDQEIcon.addClass("glyphicon-" + sign);
                }
                else {
                    //font-awesome
                    signs = {success: 'check-o', warning: 'cancel-o', error: 'cancel-o', loading: 'refresh1'};
                    sign = signs[state];
                    if (state) myDQEIcon.addClass("icon-" + sign);
                    if (state == 'loading' && !myDQE.isIE()) myDQEIcon.addClass("icon-spin");
                }
            }
        };

        myDQE.selected_country  = function() {
            if (myDQE.countryField) return myDQE.countryField.val();
            return myDQE.country;
        };

        myDQE.removeAutocomplete = function(element) {
            if (element.data('ui-autocomplete')) {
                element.autocomplete("destroy");
                element.removeData("ui-autocomplete");
            }
        };

        myDQE.url = function(data) {
            var parameters = [];
            for (var key in data) {
                if (!data.hasOwnProperty(key) || key == "fn" || key == "server") continue;
                parameters.push(key + "=" + encodeURIComponent(data[key]));
            }

            return myDQE.host + data["fn"] + "/?" + parameters.join("&") + "&Licence=" + myDQE.license;
            //return 'https://preprod.dqe-software.com/' + data["fn"] + "/?" + parameters.join("&") + "&Licence=" + myDQE.license;
        };
        if (myDQE.autocheck) {
            myDQE.on('blur', function() {
                myDQE.check();
            });
        }
        
        //On enlève les icônes affichant l'état lorsque le champ est modifié
        if (myDQEIcon) {
            myDQE.on("keypress", function() {
                myDQE.clearBootstrapState();
            });
        }
        
        return myDQE;
    };

}( jQuery ));
