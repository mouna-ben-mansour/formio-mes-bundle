(function( $ ) {

    /**
     * Appelle le service DQE à partir du champ de saisie de l'adresse e-mail
     * Options disponibles :
     *   - server: URL du serveur
     *   - country: code d'un pays précis (3 caractères) OU sélecteur jQuery pointant sur le champ pays
     *   - autocheck: lance la vérification de l'adresse e-mail lorsqu'on quitte le champ e-mail (par défaut = true)
     *   - suggest: Propose des adresses e-mail en autocomplétion lors de la saisie (par défaut = false)
     *   - last_name: sélecteur jquery qui pointe sur le champ nom
     *   - first_name: sélecteur jquery qui pointe sur le champ prénom
     *   
     *   Méthodes disponibles :
     *   - check(): lance manuellement le contrôle de l'adresse e-mail
     *
     * Evènements disponibles :
     *   - checking: se lance juste avant la vérification d'une adresse e-mail
     *   - checked(data): se lance dès qu'une adresse e-mail est validée

     *
     * @param {object} options Tableau associatif des options
     * @returns {jQuery}
     */
    $.fn.dqemail = function(options) {

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
            suggest: false,
            autocheck: true,
            license: '',
            extendedsyntax: 'n',
            checkuser: 'y',
            rectify: 0
        }, options);
        myDQE.settings = settings;

        //On récupère les champs à partir de leur selecteur
        myDQE.server     = settings.server;
        myDQE.license    = settings.license;
        myDQE.host       = settings.host;
        myDQE.suggest    = settings.suggest;
        myDQE.last_name  = settings.last_name ? $(settings.last_name) : false;
        myDQE.first_name = settings.first_name ? $(settings.first_name) : false;
        myDQE.autocheck  = settings.autocheck ? settings.autocheck : false;
        myDQE.rectify    = !!settings.rectify;
        myDQE.extended   = settings.extendedsyntax === 'y' ? 'y' : 'n';
        myDQE.checkuser  = !settings.checkuser || settings.checkuser === 'y' ? 'y' : 'n';

        myDQE.countryField = settings.country.length === 3 ? false : $(settings.country);
        myDQE.country = settings.country;

        myDQE.asmx = myDQE.server.toLowerCase().indexOf(".asmx") > -1;

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

        if (myDQE.server === 'jsonp') {
            myDQE.ajax = function(url, callback) {
                $.ajax({
                    url: url,
                    dataType: 'jsonp',
                    jsonp: 'callback',
                    success: function(data) {
                        callback(JSON.parse(data));
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        var response = {code: 99, msg: 'Service non disponible', state: 'error'};
                        callback(response);
                        myDQE.trigger('checked', [response]);
                        myDQE.bootstrapState(response.state);
                    }
                });
            };
        }
        else {
            if (myDQE.server === 'cors') {
                myDQE.ajax = function(url, callback) {
                    $.ajax({
                        url: url,
                        method: 'GET',
                        dataType: 'text',
                        crossdomain: true,
                        success: function(data) {
                            var response = data ? JSON.parse(data) : {};
                            myDQE.trigger('checked', [response]);
                            callback(response);
                        }
                    });
                };
            }
            else {
                myDQE.ajax = function (url, callback) {
                    $.ajax({
                        url: myDQE.server,
                        data: {url: url},
                        method: 'POST',
                        dataType: 'json',
                        success: function (data) {
                            callback(data);
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            var response = {code: 99, msg: 'Service non disponible', state: 'error'};
                            callback(response);
                            myDQE.trigger('checked', [response]);
                            myDQE.bootstrapState(response.state);
                        }
                    });
                };
            }
        }
        
        myDQE.render_item = function (ul, item) {
            var s = item.label;
            var p = s.indexOf("@");
            var highlighted;
            if (p > -1) {
                var user = s.substr(0, p);
                var domain = s.substr(p + 1);
                //#3276b4 ou #69f
                p = domain.lastIndexOf(".");
                if (p > -1) {
                    domain = '<span style="color:#070">' + domain.substr(0, p) + '</span><span style="color:#888">' + domain.substr(p) + '</span>';
                }
                else domain = '<span style="color:#070">' + domain + '</span>';
                highlighted = '<span style="color:#3276b4">' + user + '</span>@' + domain;
            }
            else {
                highlighted = '<span style="color:#3276b4">' + s + '</span>';
            }

            return $("<li></li>")
                .data("item.autocomplete", item)
                .append("<div>" + highlighted + "</div>")
                .appendTo(ul);
        };

        myDQE.remove_accents = function(s) {
            var ko = 'ÀÁÂÃÄÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇçàáâãèéêëîïòôõöùúûüñ';
            var ok = 'AAAAAEEEEIIIIOOOOOUUUUCcaaaaeeeeiioooouuuun';
            var len = s.length;
            var p;
            var c;
            var result = "";
            for (var i = 0; i < len; i++) {
                c = s.charAt(i);
                p = ko.indexOf(c);
                result += p === -1 ? c : ok.charAt(p);
            }
            return result;
        };
        
        myDQE.check = function() {
            var input = myDQE.val();
            if (input) {
                myDQE.trigger('checking');
                myDQE.bootstrapState('loading');
                
                var clean_mail = myDQE.remove_accents(input);
                var autocorrect = false;
                if (clean_mail !== input) {
                    myDQE.val(clean_mail);
                    autocorrect = true;
                }
                //var parameters = {fn: "DQEEMAILLOOKUP", Email: encodeURIComponent(clean_mail), extendedsyntax: myDQE.extended, checkuser: myDQE.checkuser};
                var parameters = {fn: "DQEEMAILLOOKUP", Email: encodeURIComponent(clean_mail)};
                if (myDQE.rectify) parameters['Rectify'] = 1;
                var url = myDQE.url(parameters);
                myDQE.ajax(url, function(data) {
                    var ko = {code: 99, msg: 'Le domaine ne répond pas', state: 'error'};
                    if (!data || !data[1]) return ko;

                    var code = data[1]['IdError'];
                    var parts = input.split('@');
                    var messages = {
                        '91': "Veuillez renseigner une adresse email complète",
                        '92': "Les adresses emails en " + parts[1] + " sont inconnues",
                        '93': "Domaine " + parts[1] + " en blacklist",
                        '94': "Nom d'utilisateur non autorisé (nom réservé ou interdit)",
                        '95': "Les adresses emails temporaires ne sont pas acceptées",
                        '99': 'Le domaine ne répond pas',
                        '04': "E-mail non fourni",
                        '03': "Boîte de réception pleine",
                        '02': "Cette adresse email n'existe pas sur " + parts[1],
                        '01': "",
                        '00': ""
                    };

                    var states = {'91': 'error', '92': 'error', '93': 'error', '94': 'error', '99': 'error', '04': 'error', '03': 'error', '02': 'error', '01': 'success', '00': 'success', '95': 'error'};
                    var response = {code: code, msg: messages[code], state: states[code]};
                    if ((code === '00' || code === '01') && autocorrect) {
                        response['autocorrect'] = 1;
                        response['input'] = input;
                    }
                    data = data[1];
                    if (data['Redressement'] && data['eMail'] !== data['eMailOrigine']) {
                        response['suggestion'] = data['eMail'];
                        if (myDQE.rectify && (code === '02' || code === '91' || code === '92')) response['rectified'] = true;
                    }

                    
                    myDQE.trigger('checked', [response]);
                    myDQE.bootstrapState(response.state);
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
                if (myDQEIconMode === 'glyphicon') {
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
        
        if (myDQE.autocheck) {
            myDQE.on('blur', function() {
                myDQE.check();
            });
        }
        
        if (myDQE.suggest) {
            myDQE.removeAutocomplete(myDQE);
            myDQE.autocomplete({
                source: function(request, response) {
                    //MAILSUGGEST/?Nom=$last_name&Prenom=$first_name&Email=$encoded_email&Instance=0&Pays=$country
                    var last = myDQE.last_name ? myDQE.remove_accents(myDQE.last_name.val().toLowerCase()) : '';
                    var first = myDQE.first_name ? myDQE.remove_accents(myDQE.first_name.val().toLowerCase()) : '';
                    var input = myDQE.remove_accents(request.term.toLowerCase());
                    var url = myDQE.url({fn: "MAILSUGGEST", Nom: last, Prenom: first, Email: input, Instance: 0, Pays: myDQE.selected_country()});
                    var suggestions = {};
                    myDQE.ajax(url, function(data) {
                        if (!data || !data['suggest']) return [];

                        if(myDQE.selected_country() != 'FRA'){
                            for (var key in data['suggest']){
                                if (data['suggest'].hasOwnProperty(key)){
                                    if(!data['suggest'][key].endsWith('.fr') && !data['suggest'][key].endsWith('.gouv')) suggestions[key] = data['suggest'][key];
                                }
                            }
                        }
                        else suggestions = data['suggest'];
                        response(suggestions);
                    });
                },
                minLength: 0,
                delay: 0,
                create: function() {
                    $(this).data('ui-autocomplete')._renderItem = myDQE.render_item;
                },
                open: function(event, ui) {
                    $('.ui-autocomplete').css('max-height', '150px').css('overflow-y', 'auto').css('overflow-x', 'hidden');
                },
                select: function(event, ui) {
                    myDQE.trigger('suggest', ui.item);
                    return true;
                },
                close: function( event, ui ) {
                    var value = $(this).val();
                    if (value && value.charAt(value.length - 1) === "@") {
                        $(this).autocomplete("search", value);
                    }
                },
                focus: function(event, ui) {
                    event.preventDefault();
                }
            }).focus(function() {
                if ($(this).data('ui-autocomplete')) $(this).autocomplete("search", $(this).val());
            });
        }

        myDQE.url = function(data) {
            var parameters = [];
            for (var key in data) {
                if (!data.hasOwnProperty(key) || key === "fn" || key === "server") continue;
                parameters.push(key + "=" + encodeURIComponent(data[key]));
            }
            return myDQE.host + data["fn"] + "/?" + parameters.join("&") + "&Licence=" + myDQE.license;
            //return 'https://preprod.dqe-software.com/' + data["fn"] + "/?" + parameters.join("&") + "&Licence=" + myDQE.license;
        };
        
        //On enlève les icônes affichant l'état lorsque le champ est modifié
        if (myDQEIcon) {
            myDQE.on("keypress", function() {
                myDQE.clearBootstrapState();
            });
        }
        
        return myDQE;
    };

}( jQuery ));
