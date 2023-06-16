(function( $ ) {

    /**
     * Version 2.3.20180320
     *
     * Appelle le service DQE Address à partir d'une FORM ou d'une DIV contenant les champs
     * Options disponibles :
     *   - server: URL du serveur ou - pour des appels directs - 'jsonp' ou 'cors'
     *   - license: code licence. Uniquement pour des appels directs jsonp ou CORS
     *   - country: code d'un pays précis (3 caractères) OU sélecteur jQuery pointant sur le champ pays
     *   - city: sélecteur jQuery pointant sur le champ ville
     *   - zip: sélecteur jQuery pointant sur le champ code postal
     *   - street: sélecteur jQuery pointant sur le champ rue
     *   - number: sélecteur jQuery pointant sur le champ numéro
     *   - compl: sélecteur jQuery pointant sur le champ complément d'adresse
     *   - local: sélecteur jQuery pointant sur le champ lieu-dit
     *   - prov: sélecteur jQuery pointant sur le champ province (uniquement pour certains pays)
     *   - insee : sélecteur jQuery pointant sur le champ du code insee (uniquement entonnoir)
     *   - iris : sélecteur jQuery pointant sur le champ iris (uniquement RNVP)
     *   - taille : Taille maximum des retour, 30 ou 38 (uniquement RNVP)
     *   - zipcity: sélecteur jQuery pointant sur le champ code postal+ville (en remplacement des champs zip et city)
     *   - company: sélecteur jQuery pointant vers le champ société
     *   - single: sélecteur jQuery pointant vers un champ de recherche d'adresses en une seule ligne
     *   - geoloc: nom de la fonction de callback à appeler une fois lat et lng de l'adresse recherchée obtenues (si ce param est présent, les coordonnées lat/lng sont récupérées dès qu'un num dans la rue est renvoyé)
     *   - city_search: 0 ou 1 (si ce paramètre est présent et vaut 1, il est possible de trouver le premier code postal français lié à une ville)
     *   - force_nums: Liste des pays sous la forme {code_iso_3: 1, ...} pour lesquels on doit présenter une liste de numéros même si le webservice n'en fournit pas
     *   - min_bound: integer (lorsque le numéro dans la voie n'a pas été renseigné : si ce paramètre est fourni, une liste de numéros commençant par min_bound est affichée)
     *   - max_bound: integer (lorsque le numéro dans la voie n'a pas été renseigné : si ce paramètre est fourni, une liste de numéros se terminant par max_bound est affichée)
     *   - nearest: integer (si l'utilisateur accepte de fournir ses coordonnées, trie les résultats par proximité et pas par pertinence)
     *   - oauth2 : 0 ou 1, paramètre de selection de la méthode d'authentification sur les serveurs.
     *
     * Méthodes disponibles :
     *   - idcheck (street, zip, city, lastname, firstname, callback_function_name) : renvoie la présence ou non d'un foyer à l'adresse indiquée
     *   - lifestyle(street, zip, city, callback_function_name) : renvoie le profil des foyers situés à l'adresse indiquée
     *   - check(callback_function_name, [address]) : Vérifie si l'adresse saisie ou passée en paramètre est correcte
     *   - parse(callback_function_name, address) : Extrait les différents composantes de l'adresse passée en paramètre (uniquement pour la France)
     *   - iptracker(ip) : renvoie les coordonnées géographiques liées à l'adresse IP
     *
     * Evènements disponibles :
     *   - number(event, number): se déclenche quand un numéro est choisi
     *   - street(event, street): se déclenche quand une rue est choisie
     *   - zip(event, zip): se déclenche quand un code postal est validé
     *   - city(event, city_id, city_name): se déclenche quand une ville est choisie
     *   - compl(event, complement): se déclenche quand un complément d'adresse est choisi
     *   - complements(event): se déclenche quand des compléments sont disponibles pour l'adresse choisie
     *   - prov(event, province): se déclenche quand une province est choisie
     *   - company(event, company_name): se déclenche quand une société est choisie avec la ville (via un CEDEX)
     *   - single(event, company_name): se déclenche quand une adresse complète est choisie via une recherche sur une ligne
     *   - override(event): se déclenche quand l'utilisateur force l'adresse (quand le statut override change)
     *
     * @param {object} options Tableau associatif des options
     * @returns {jQuery}
     */
    $.fn.dqe = function(options) {
        var myDQE = this;

        function string_replace(string, text, by) {
            string = string + "";
            var result = "";
            var slen = string.length;
            var len = text.length;
            var pos = string.indexOf(text);
            while (pos > -1) {
                result += string.substring(0, pos) + by;
                string = string.substring(pos + len, slen);
                pos = string.indexOf(text);
            }
            if (string != "") result += string;
            return result;
        }

        function highlight_term(source, term) {
            if (!term || !source) return source;
            var simple_source = myDQE.remove_accents(source).toLowerCase();
            var simple_term = myDQE.remove_accents(term).toLowerCase();
            var result = "";
            var len = term.length;
            var pos = simple_source.indexOf(simple_term);
            while (pos > -1) {
                result += source.substr(0, pos) + '{' + source.substr(pos, len) + '}';
                source = source.substr(pos + len);
                simple_source = simple_source.substr(pos + len);
                pos = simple_source.indexOf(simple_term);
            }
            if (source != "") result += source;
            return result;
        }

        myDQE.render_item = function (ul, item) {
            var highlighted;
            var term = this.term;
            if (term.indexOf(" ") > -1) {
                var terms = term.split(" ");
                var len = terms.length;
                highlighted = item.label;
                for (var i = 0; i < len; i++)
                    highlighted = highlight_term(highlighted, terms[i]);
            }
            else highlighted = highlight_term(item.label, this.term);
            highlighted = string_replace(highlighted, '{', '<strong>');
            highlighted = string_replace(highlighted, '}', '</strong>');
            highlighted = string_replace(highlighted, '|', '<br/><span style="color:#070">') + '</span>';
            highlighted = string_replace(highlighted, '[', '<span class="ko">');
            highlighted = string_replace(highlighted, ']', '</span>');
            return $("<li></li>")
                .data("item.autocomplete", item)
                .append("<div>" + highlighted + "</div>")
                .appendTo(ul);
        };

        //Expressions régulières permettant de tester si un code postal a été complètement saisi pour lancer la recherche de villes
        myDQE.zip_pattern = {
            'FRA':      /^\d{5}$/,
            'DZA':      /^\d{5}$/,
            'DEU':      /^\d{5}$/,
            'AUT':      /^\d{4}$/,
            'TUN':      /^\d{4}$/,
            'AUS':      /^\d{4}$/,
            'BEL':      /^\d{4}$/,
            'BRA':      /^\d{5}[ -]?\d{3}$/,
            'CAN':      /^[A-Z\d]{3} ?[A-Z\d]{3}$/,
            'KOR':      /^\d{3}[ -]?\d{3}$/,
            'ESP':      /^\d{5}$/,
            'USA':      /^([A-Z]{2})?[ -]?\d{5}[ -]?(\d{4})?$/i,
            'ISR':      /^\d{5}$/,
            'ITA':      /^\d{5}$/,
            'JPN':      /^\d{3}[ -]\d{4}$/,
            'JPN-en':   /^\d{3}[ -]\d{4}$/,
            'LUX':      /^L?-?\d{4}$/i,
            'NLD':      /^\d{4} ?([A-Z]{2})?$/,
            'POL':      /^\d\d-?\d{3}$/,
            'PRT':      /^\d{4}-?\d{3}$/,
            'CZE':      /^\d{3} ?\d{2}$/,
            'ROU':      /^\d{6}$/,
            'GBR':      /^[A-Z][A-Z\d]{1,3} ?\d[A-Z]{2}$/i,
            'SGP':      /^\d{6}$/,
            'SVN':      /^\d{4}$/,
            'SWE':      /^(SE)?-?\d{3} ?\d{2}$/,
            'CHE':      /^\d{4}$/,
            'TUR':      /^\d{5}$/,
            'CHN':      /^\d{6}$/,
            'CHN-en':   /^\d{6}$/,
            'RUS':      /^\d{6}$/,
            'NOR':      /^\d{4}$/,
            'DNK':      /^\d{4}$/,
            'FIN':      /^\d{5}$/,
            'THA':      /^\d{5}$/,
            'MAR':      /^\d{5}$/,
            'HUN':      /^\d{4}$/,
            'HKG':      /^.*$/, //Hong-kong
            'HKG-en':   /^.*$/, //Hong-kong
            'QAT':      /^.*$/, //Qatar
            'NZL':      /^\d{4}$/, //Nouvelle-zélande
            'HRV':      /^(HR)?-?\d{5}$/ //Croatie
        };

        //Liste des pays pour lesquels le numéro est situé après le nom de la voie
        myDQE.reversed_countries = {
                AUT: 1, BEL: 1, CHE: 1, CZE: 1, DEU: 1, ESP: 1, HRV: 1, ISR: 1, ITA: 1, NLD: 1, POL: 1, PRT: 1,
                ROU: 1, SWE: 1, TUR: 1, RUS: 1, SVN: 1, DNK: 1, FIN: 1, HUN: 1, NOR: 1
        };

        //Vérifie si la saisie comporte des numéros
        myDQE.has_number = function(street) {
            street = myDQE.trim(street);
            if (!street) return false;
            var country = myDQE.selected_country();
            var code = myDQE.reversed_countries[country] ? street.charCodeAt(street.length - 1) : street.charCodeAt(0);
            return code >= 48 && code <= 57;
        };

        //Liste des pays renvoyant des caractères spéciaux qu'il faidra décoder
        myDQE.specific_charset = function() {
            var country = myDQE.selected_country();
            //Liste des pays renvoyant des caractères spéciaux qu'il faidra décoder
            var countries = {
                CHN: 1,KOR: 1, RUS: 1, THA: 1, SGP: 1, ISR: 1, DNK: 1, SVN: 1, 'CHN-en': 1, HRV: 1,
                HKG: 1, 'HKG-en': 1, JPN: 1, DEU: 1
            };
            return !!countries[country];
        };

        //Liste des pays utilisant une base interne : délai à 0 avant interrogation
        myDQE.fast_country = function() {
            var country = myDQE.selected_country();
            //Liste des pays utilisant une base interne : on peut les requêter avec un délai à 0
            var fast_countries = {FRA: 1, GBR: 1, LUX: 1, BEL: 1, ESP: 1, NLD: 1, DEU: 1, 'CH2': 1, MAR: 1};
            return !!fast_countries[country];
        };

        //Decode les caractères particuliers retournés en unicode
        myDQE.udecode = function(s) {
            if (s.indexOf('\\\\u') == -1) return s;
            var regex = /\\\\u([\d\w]{4})/gi;
            s = s.replace(regex, function (match, grp) {
                return String.fromCharCode(parseInt(grp, 16));
            });
            return s;
        };

        //Chargement des paramètres
        var settings = $.extend({
            //Paramètres par défaut
            country: "FRA",
            trace: 0,
            license: '',
            append_locality: 0 //On concatène le lieu-dit d'adresse au bout de la ville
        }, options );
        myDQE.settings = settings;

        //On récupère les champs à partir de leur selecteur
        myDQE.server        = settings.server;
        myDQE.license       = settings.license; //obligatoire si jsonp ou cors
        myDQE.host          = settings.host;
        myDQE.oauth         = settings.oauth        ? settings.oauth        : false;
        myDQE.client_secret = settings.client_secret? settings.client_secret: false;
        myDQE.grant_type    = "client_address";
        myDQE.token         = "";
        myDQE.tokenTimeout  = 250000;
        //champs autocomplétés
        myDQE.city          = settings.city          ? $(settings.city)       : false;
        myDQE.zip           = settings.zip           ? $(settings.zip)        : false;
        myDQE.street        = settings.street        ? $(settings.street)     : false;
        myDQE.street_type   = settings.street_type   ? $(settings.street_type): false;
        myDQE.number        = settings.number        ? $(settings.number)     : false;
        myDQE.compl         = settings.compl         ? $(settings.compl)      : false;
        myDQE.local         = settings.local         ? $(settings.local)      : false; //Lieu-dit
        myDQE.prov          = settings.prov          ? $(settings.prov)       : false; //Province
        myDQE.zipcity       = settings.zipcity       ? $(settings.zipcity)    : false; //CP et Ville regroupés
        myDQE.only_zipcity  = settings.only_zipcity  ? $(settings.only_zipcity): false;
        myDQE.company       = settings.company       ? $(settings.company)    : false; //Nom de la société
        myDQE.single        = settings.single        ? $(settings.single)     : false; //Recherche sur une ligne
        myDQE.insee         = settings.insee         ? $(settings.insee)      : false; //code insee

        myDQE.cedex         = (settings.cedex==false)? settings.cedex         : true;  //Recherche avec ou sans cedex
        myDQE.restricted    = settings.restricted    ? settings.restricted    : false; //Formulaire sans ligne d'adresse (correction du CP pour Paris, Lyon etc... impossible.)
        myDQE.arrondissements = [];

        //options de géoloc
        myDQE.geoloc       = settings.geoloc ? settings.geoloc : false; //Fonction à appeler avec les coordonnées de l'emplacement
        myDQE.city_search  = settings.city_search ? 1 : 0;
        myDQE.min_bound    = settings.min_bound ? settings.min_bound : -1;
        myDQE.max_bound    = settings.max_bound ? settings.max_bound : -1;
        myDQE.force_nums   = settings.force_nums? settings.force_nums : {};
        myDQE.taille       = settings.taille    ? settings.taille : false;

        myDQE.countryField = settings.country.length === 3 ? false : $(settings.country);
        myDQE.country = settings.country;

        myDQE.lat = 0;
        myDQE.lon = 0;
        if (myDQE.nearest && myDQE.single) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function(obj) {
                    var coords = obj.coords;
                    myDQE.lat = coords.latitude ? coords.latitude : 0;
                    myDQE.lon = coords.longitude ? coords.longitude : 0;
                }, function() {
                    myDQE.lat = 0;
                    myDQE.lon = 0;
                }, {enableHighAccuracy: true, timeout: 10000, maximumAge: 0});
            }
        }

        if (myDQE.countryField) {
            myDQE.countryField.on("change", function() {
                myDQE.clearSection("zip");
                myDQE.clearSection("zipcity");
                myDQE.clearSection("single");
                myDQE.activate_zipcity_autocomplete();
                myDQE.activate_single_autocomplete();
            });
        }

        myDQE.asmx = myDQE.server.toLowerCase().indexOf(".asmx") > -1;

        //Paramètres AJAX
        if (myDQE.server === 'jsonp') {
            myDQE.ajax = function(url, callback) {
                $.ajax({
                    url: url,
                    dataType: 'jsonp',
                    jsonp: 'callback',
                    error: function(xhr, status, error) {
                        if( status == 401 && myDQE.oauth === 1){
                            myDQE.auth(myDQE.client_secret);
                        }
                    },
                    success: function(data) {
                        if (data && myDQE.specific_charset()) {
                            data = myDQE.udecode(data);
                        }
                        if (myDQE.street) {
                            var myDQEContainer = myDQE.street.closest('.form-group'),
                              helpBlock = myDQE.street.closest('div').children('.help-block');
                            helpBlock.addClass('list-unstyled');
                            if (data != "{}") {
                                result = JSON.parse(data);
                                myDQEContainer.removeClass('has-error');
                                helpBlock.html('');
                            } else {
                                result = {};
                                myDQEContainer.addClass('has-error');
                                helpBlock.html('Adresse introuvable.');
                            }
                        } else {
                            var result = data ? JSON.parse(data) : {};
                        }
                        callback(result);
                    }
                });
            };
        }
        else {
            if (myDQE.server == 'cors') {
                myDQE.ajax = function(url, callback) {
                    $.ajax({
                        url: url,
                        method: 'GET',
                        dataType: 'text',
                        crossdomain: true,
                        error: function(xhr, status, error) {
                            if( status == 401 && myDQE.oauth === 1){
                                myDQE.auth(myDQE.client_secret);
                            }
                        },
                        success: function(data) {
                            if (data && myDQE.specific_charset()){
                                data = myDQE.udecode(data);
                            }
                            if (myDQE.street) {
                                var myDQEContainer = myDQE.street.closest('.form-group'),
                                  helpBlock =myDQE.street.closest('div').children('.help-block');

                                helpBlock.addClass('list-unstyled');
                                if (data != "{}") {
                                    result = JSON.parse(data);
                                    myDQEContainer.removeClass('has-error');
                                    helpBlock.html('');
                                } else {
                                    result = {};
                                    myDQEContainer.addClass('has-error');
                                    helpBlock.html('Adresse introuvable.');
                                }
                            } else {
                                var result = data ? JSON.parse(data) : {};
                            }
                            callback(result);
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
                        dataType: 'text',
                        error: function(xhr, status, error) {
                            if( status == 401 && myDQE.oauth === 1){
                                myDQE.auth(myDQE.client_secret);
                            }
                        },
                        success: function(data) {
                            if (data && myDQE.specific_charset()) {
                                data = myDQE.udecode(data);
                            }
                            if (myDQE.street) {
                                var myDQEContainer = myDQE.street.closest('.form-group'),
                                  helpBlock = myDQE.street.closest('div').children('.help-block');
                                helpBlock.addClass('list-unstyled');
                                if (data != "{}") {
                                    result = JSON.parse(data);
                                    myDQEContainer.addClass('has-success');
                                    myDQEContainer.removeClass('has-error');
                                    myDQEContainer.removeClass('has-danger');
                                    helpBlock.html('');
                                    if (myDQE.zipcity) {
                                        myDQE.zipcity.closest('.form-group').removeClass('hide');
                                    }
                                } else {
                                    result = {};
                                    myDQEContainer.addClass('has-error');
                                    myDQEContainer.removeClass('has-success');
                                    helpBlock.html('Adresse introuvable.');
                                    if (myDQE.zipcity) {
                                        myDQE.zipcity.closest('.form-group').addClass('hide');
                                        myDQE.zipcity.val("");
                                    }
                                }
                            } else {
                                var result = data ? JSON.parse(data) : {};
                                if (result !== {}) {
                                    myDQE.convert_result(result)
                                }
                            }
                            callback(result);
                        }
                    });
                };
            }
        }
        myDQE.convert_result = function (result) {
            var terms = ['le', 'la', 'les', 'en', 'de', 'sur', 'du', 'pres', 'et', 'sous' ]
            var tochange = {'st': 'saint'}
            $.each(result, function (key, elem) {
                if (elem.hasOwnProperty('Localite')) {
                    var array = elem.Localite.split(' ');
                    var startWithTerms = false;
                    var cedexExist = false
                    var text = '';
                    $.each(array, function (k,v) {
                        array[k] = v.toLowerCase()
                        if (k === 0) {
                            if (terms.indexOf(array[k]) > -1) {
                                startWithTerms = true
                            }
                            if (array[k] in tochange) {
                                array[k] = tochange[array[k]]
                            }
                            array[k] = array[k].toLowerCase().replace(/\b[a-z]/g, function(letter) {
                                return letter.toUpperCase();
                            });
                        } else {
                            if (terms.indexOf(array[k]) === -1) {
                                console.log(array[k])
                                array[k] = array[k].toLowerCase().replace(/\b[a-z]/g, function(letter) {
                                    return letter.toUpperCase();
                                });
                            }
                            if (array[k].indexOf('Cedex') > -1) {
                                cedexExist = true
                                delete array[k];
                            }
                        }
                        if (cedexExist) {
                            delete array[k];
                        }
                    })
                    text = array.join("-");

                    if (startWithTerms) {
                        text = text.replace(new RegExp("-"), ' ')
                    }
                    if (cedexExist) {
                        text = text.replace(new RegExp("-+$"), '')
                    }
                    elem.Localite = text
                }
            })
        }

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

        //clear selection
        myDQE.override_reset = function() {
            myDQE.zip_override = true;
            myDQE.city_override = true;
            myDQE.street_override = true;
            myDQE.selected_zip_value = "";
            myDQE.selected_city_value = "";
            myDQE.selected_street_value = "";
            myDQE.selected_zipcity_value = "";
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
                result += p == -1 ? c : ok.charAt(p);
            }
            return result;
        };

        myDQE.override_events = function() {
            myDQE.override_reset();

            if (myDQE.city) myDQE.city.on("input", function() {
                var city = myDQE.city.val();
                if (city && myDQE.selected_city_value && city == myDQE.selected_city_value) {
                    myDQE.override(false, "city");
                } else {
                    myDQE.override(true, "city");
                }
            });
            if (myDQE.street) myDQE.street.on("input", function() {
                var street = myDQE.street.val();
                if (street && myDQE.selected_street_value && street.indexOf(myDQE.selected_street_value) >= 0) {
                    myDQE.override(false, "street");
                } else {
                    myDQE.override(true, "street");
                }
            });
            if (myDQE.zipcity) myDQE.zipcity.on("input", function() {
                var zipcity = myDQE.zipcity.val();
                if (myDQE.selected_zipcity_value && zipcity !== myDQE.selected_zipcity_value) {
                    myDQE.override(true, "zip");
                    myDQE.override(true, "city");
                }
                else {
                    if (zipcity && zipcity == myDQE.selected_zipcity_value) {
                        myDQE.override(false, "zip");
                        myDQE.override(false, "city");
                    }
                }
            });
        };

        myDQE.execute_trigger = function(field, value) {
            myDQE.trigger(field, value);
            if (field === "zip") {
                myDQE.override(false, "zip");
                if (myDQE.zip) myDQE.selected_zip_value = myDQE.zip.val();
                if (myDQE.zipcity) myDQE.selected_zipcity_value = myDQE.zipcity.val();
            }
            if (field === "city") {
                myDQE.override(false, "city");
                if (myDQE.city) myDQE.selected_city_value = myDQE.city.val();
                if (myDQE.zipcity) myDQE.selected_zipcity_value = myDQE.zipcity.val();
            }
            if (field === "street") {
                myDQE.override(false, "street");
                myDQE.selected_street_value = myDQE.street.val();
            }

            if (field === "single") {
                myDQE.override(false, "zip");
                if (myDQE.zip) myDQE.selected_zip_value = myDQE.zip.val();
                if (myDQE.zipcity) myDQE.selected_zipcity_value = myDQE.zipcity.val();

                myDQE.override(false, "city");
                if (myDQE.city) myDQE.selected_city_value = myDQE.city.val();
                if (myDQE.zipcity) myDQE.selected_zipcity_value = myDQE.zipcity.val();

                myDQE.override(false, "street");
                myDQE.selected_street_value = myDQE.street.val();
            }
        };

        myDQE.override = function(value, field) {
            if (value === true || value === false) {
                if (!field || field === "zip")    myDQE.zip_override = value;
                if (!field || field === "city")   myDQE.city_override = value;
                if (!field || field === "street") myDQE.street_override = value;

                myDQE.execute_trigger("override");
            }

            return {
                'zip'    : myDQE.zip_override,
                'city'   : myDQE.city_override,
                'street' : myDQE.street_override
            };
        };

        myDQE.count = function(t) {
            var cnt = 0;
            for (var key in t) {
                if (!t.hasOwnProperty(key)) continue;
                cnt++
            }
            return cnt;
        };

        myDQE.trimLeft = function(s, charlist) {
            if (!s) return '';
            if (charlist === undefined)
                return s.replace(/^\s+/gm,'');

            return s.replace(new RegExp("^[" + charlist + "]+"), "");
        };

        myDQE.trimRight = function(s, charlist) {
            if (!s) return '';
            if (charlist === undefined)
                return s.replace(/\s+$/gm,'');

            return s.replace(new RegExp("[" + charlist + "]+$"), "");
        };

        myDQE.trim = function(s, charlist) {
            if (!s) return '';
            if (charlist === undefined)
                return s.replace(/^\s+|\s+$/gm,'');

            s = myDQE.trimLeft(s, charlist);
            s = myDQE.trimRight(s, charlist);
            return s;
        };

        myDQE.replace = function(string, text, by) {
            string = string + "";
            var result = "";
            var slen = string.length;
            var len = text.length;
            var pos = string.indexOf(text);
            while (pos > -1) {
                result += string.substring(0, pos) + by;
                string = string.substring(pos + len, slen);
                pos = string.indexOf(text);
            }
            if (string != "") result += string;
            return result;
        };

        if (!Array.prototype.indexOf) {
            Array.prototype.indexOf = function(searchElement, fromIndex) {
                var k;
                if (this == null) throw new TypeError('"this" vaut null ou n est pas défini');
                var O = Object(this);
                var len = O.length >>> 0;
                if (len === 0) return -1;
                var n = +fromIndex || 0;

                if (Math.abs(n) === Infinity) n = 0;
                if (n >= len) return -1;
                k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

                while (k < len) {
                    if (k in O && O[k] === searchElement) return k;
                    k++;
                }
                return -1;
            };
        }

        myDQE.filter_cities = function(result) {
            var i = 1;
            var cities = [];
            var result_count = myDQE.count(result);
            var name, lieudit, province, returned_zip, len_zip, company, city, voie, voies, id, label, zip;
            var country = myDQE.selected_country();
            var bp = false;
            while (result[i]) {
                id = result[i]['IDLocalite'];
                if (!id && result_count === 1) return [];

                name     = myDQE.trim(result[i]["Localite"]);
                lieudit  = myDQE.trim(result[i]["LieuDit"]);
                province = myDQE.trim(result[i]["Province"]);
                if (province === name || !myDQE.trim(province, '*-')) province = '';

                if (country !== 'FRA' && province) {
                    var p = province.indexOf("-");
                    if (p > -1) {
                        province = province.substr(0, p);
                        p = id.indexOf("-");
                        if (p > -1) id = id.substr(0, p);
                    }
                }

                returned_zip = myDQE.trim(result[i]["CodePostal"]);

                if (returned_zip && name) {
                    len_zip = returned_zip.length - name.length - 1;
                    if (returned_zip.substr(len_zip) === ' ' + name) returned_zip = returned_zip.substr(0, len_zip);
                }

                company  = result[i]['Entreprise'] ? myDQE.trim(result[i]['Entreprise']) : '';

                if (province) label = name + ", " + province;
                else label = lieudit ? returned_zip + ' ' + name + ", " + lieudit : returned_zip + ' ' + name;

                city = {'city_id': id, 'city': name};
                voie = result[i]['Voie'] ? result[i]['Voie'] : '';
                if (voie.indexOf('_BP_') > -1) bp = true;
                voies = voie ? voie.split(',') : [];

                for (var k = 0; k < voies.length; k++) {
                    voies[k] = myDQE.trim(voies[k]);
                }

                if (company) city['company'] = company;

                var zip_complements = [];

                if(myDQE.selected_country() !== 'ARE' && myDQE.selected_country() !== 'SAU'){ //countries without zipcity are ignored
                    if (!myDQE.zip_pattern.hasOwnProperty(myDQE.selected_country()) && myDQE.zip.val() != returned_zip){
                        zip_complements.push(returned_zip);
                    }
                }

                if (voies.length == 3) {

                    if (voies[0] && voies[1]) {
                        //Société avec 2 noms (courant au royaume uni)
                        city['company'] = voies[0] + ", " + voies[1];
                        zip_complements.push(city['company']);
                    }
                    else {
                        //Societe,complément,voie
                        if (voies[0]) {
                            city['company'] = voies[0];
                            zip_complements.push(voies[0]);
                        }
                        if (voies[1]) {
                            city['compl'] = voies[1];
                            zip_complements.push(voies[1]);
                        }
                    }
                    if (voies[2]) {
                        city['street']  = voies[2];
                        zip_complements.push(voies[2]);
                    }
                }
                else {
                    if (city['company']) zip_complements.push(city['company']);
                    if (voie) {
                        //Parfois le code postal seul nous permet de renseigner la rue
                        city['street'] = myDQE.trim(voie);
                        city['number'] = myDQE.trim(result[i]["Numero"]);
                        city['street_id'] = myDQE.trim(result[i]['IDVoie']);
                        zip_complements.push(city['street']);
                    }
                }

                if (zip_complements.length > 0) {
                    label += " (" + zip_complements.join(', ') + ")";
                }

                city['label'] = myDQE.no_bp(label);

                if (zip) city['zipcity'] = zip;
                if (returned_zip) city['zip'] = returned_zip;
                if (lieudit) city['local'] = lieudit;
                if (province) city['prov'] = province;
                if (result[i]['ListeNumero']) city['numbers'] = result[i]['ListeNumero'].split(';'); //Liste de boites postales retournées pour un CP précis (comme en Suède)
                city['zipcity'] = name.indexOf('(') === -1 ? returned_zip + ' ' + name : name;

                //Si mode sans CEDEX et localité trouvée est un CEDEX, on l'ignore.
                if(myDQE.cedex == true){
                    cities.push(city);
                }
                else{
                    if((String(name).indexOf('CEDEX') == -1)) {
                        cities.push(city);
                    }
                }

                i++;
            }
            return cities;
        };

        myDQE.filter_adr = function(result) {
            var i = 1;
            var streets = [];
            var adr, street, number, nums, zip, city, id, city_id, lieudit, label1, label2, line, label_compl, prov;
            var company = "";
            var nia = myDQE.num_is_after();
            while (result[i]) {
                adr = result[i];
                street  = myDQE.trim(adr["Voie"]);
                number  = myDQE.trim(adr["Numero"]);
                prov = "";

                if (adr['ListeNumero']) {
                    nums = adr['ListeNumero'].split(';');
                    if (nums.indexOf(number) === -1) number = '';
                }
                else nums = [];

                zip     = myDQE.trim(adr['CodePostal']);
                city    = myDQE.trim(adr['Localite']);
                id      = myDQE.trim(adr['IDVoie']);
                city_id = myDQE.trim(adr['IDLocalite']);
                lieudit = adr["LieuDit"] ? myDQE.trim(result[i]["LieuDit"]) : '';

                //Avec 2 virgules dans la rue : société et/ou segment de ville a été renvoyé en plus de la voie
                var p = street.indexOf(",");
                if (p > -1) {
                    var parts = street.split(",");
                    if (parts.length === 3) {
                        company = myDQE.trim(parts[0]);
                        prov = myDQE.trim(parts[1]);
                        street = myDQE.trim(parts[2]);
                    }
                }
                
                label1 = nia ? myDQE.trim(street + ' ' + number) : myDQE.trim(number + ' ' + street);
                label_compl = (company ? ", " + company : "") + (prov ? ", " + prov : "") + (lieudit ? ", " + lieudit : "");
                label2 = zip ? label1 + " (" + zip + label_compl + ")" : label1 + label_compl;

                if (result[i]['Entreprise']) label2 += " (" + result[i]['Entreprise'] + ")";

                line = {'id': id, 'label': label2, 'simple_label': label1, 'street': street, 'number': number,'list_numbers': nums,'zip': zip, 'city': city, 'city_id': city_id, 'local': lieudit, 'company': company};
                if (prov) line["prov"] = prov;
                if (company) line["company"] = company;
                
                streets.push(line);
                i++;
            }
            return streets;
        };

        myDQE.filter_num = function(result) {
            var list = result && result['1'] && result['1']['ListeNumero'] ? result['1']['ListeNumero'].split(';') : [];
            var numbers = [];
            var len = list.length;
            for (var i = 0; i < len; i++) {
                numbers.push({value: list[i], label: list[i]});
            }
            return numbers;
        };

        myDQE.filter_single = function(result) {
            if (!result || result === "{}") return [];
            var addresses = [];
            var i = 1;
            var line, street, len, label, address;
            var nia = myDQE.num_is_after();
            while (result[i]) {
                line = result[i];
                line['Numero'] = myDQE.trim(line['Numero']);
                if (line['Voie'].indexOf(',') > -1) {
                    street = line['Voie'].split(',');
                    len = street.length;
                    line['Voie'] = myDQE.trim(street[len - 1]);
                }
                else line['Voie'] = myDQE.trim(line['Voie']);

                if (line['label']) label = line['label'];
                else {
                    label = myDQE.recombine_street(line['Numero'], line['TypeVoie'], line['Voie'], nia);
                    label += ' ' + myDQE.trim(line['CodePostal'] + ' ' + line['Localite']);
                    if (line['Entreprise']) label += " (" + line['Entreprise'] + ")";
                    else {
                        if (line['LieuDit']) label += " (" + line['LieuDit'] + ")";
                    }
                    label = myDQE.trim(label);
                }

                address = {
                    street: line['Voie'],
                    num: line['Numero'],
                    numonly: line['NumSeul'],
                    type: line['TypeVoie'],
                    id: line['IDVoie'],
                    zip: line['CodePostal'],
                    city: line['Localite'],
                    label: label,
                    value: label,
                    region1: line['Region1'],
                    region2: line['Region2'],
                    region3: line['Region3'],
                    region4: line['Region4'],
                    city_id: line['IDLocalite']
                };

                if (line["complement"]) address["numcompl"] = line["complement"];

                if (line['Entreprise']) address['company'] = line['Entreprise'];
                if (line['LieuDit']) address['local'] = line['LieuDit'];
                if (line['Complement']) address['compl'] = line['Complement'];
                if (line['Province'] && line['Province'] !== '*') address['prov'] = line['Province'];
                if (line['SousLocalite']) address['subcity'] = line['SousLocalite'];
                if (line['ListeNumero']) {
                    var nums = line['ListeNumero'].split(';');
                    var missing = !line['Numero'];
                    var wrong = nums.indexOf(line['Numero']) === -1;
                    if (missing) address['missing_number'] = 1;
                    if (wrong) address['wrong_number'] = 1;
                    if (missing || wrong) address['nums'] = nums;
                }
                else {
                    //La liste des numéros est vide. Si on a un numéro saisi, il est vraisemblablement incorrect
                    if (line['Numero']) address['unexpected_number'] = 1;
                }
                if (line['Latitude']) address['latitude'] = line['Latitude'];
                if (line['Longitude']) address['longitude'] = line['Longitude'];

                addresses.push(address);
                i++;
            }
            return addresses;
        };

        myDQE.house_typo = function(data, code) {
            var typo = '';
            var value;
            for (var key in data) {
                if (!data.hasOwnProperty(key)) continue;
                value = data[key];
                if (key.substr(0, 5) === 'TYPO_' && parseInt(value, 10) == 1) {
                    typo = key.substr(5);
                    break;
                }
            }
            if (!typo) return '';

            if (code) return typo;

            var typos = {
                A1: [
                    "Grandes maisons récentes",
                    "Familles matures avec adolescents",
                    "CSP et niveau d'études supérieures",
                    "Propriétaires et au moins 2 voitures"
                ],
                A2: [
                    "Propriétaires de grandes maisons en ville",
                    "Couples 40 ans et plus avec adolescents",
                    "Cadres, prof. interm. ou retraités",
                    "Niveau d'études supérieures"
                ],
                A3: [
                    "Couples matures sans enfant ou retraités",
                    "Maisons en périphérie des villes",
                    "Bons revenus",
                    "Grands utilisateurs de la voiture"
                ],
                A4: [
                    "Ouvriers qualifiés ou prof. interm.",
                    "Couples 40-54 ans avec enfants",
                    "Grandes maisons avec garage",
                    "Installés depuis plus de 10 ans"
                ],
                B1: [
                    "Jeunes actifs ou retraités en ville",
                    "Personnes seules 18-39 ans ou 65+",
                    "CSP et niveau d'études moyen",
                    "Installés depuis moins de 5 ans"
                ],
                B2: [
                    "Jeunes célibataires en centre-ville",
                    "Petits appartements très anciens",
                    "Commerces et équipements importants",
                    "Récemment installés"
                ],
                B3: [
                    "Retraités ou employés",
                    "Appartements anciens de taille moyenne",
                    "Faible niveau d'études, revenus moyens",
                    "Ménages installés depuis plus de 10 ans"
                ],
                B4: [
                    "Ouvriers peu qualifiés ou prof. interm.",
                    "Familles monoparentales",
                    "Locataires d'appartements HLM",
                    "Pop étrangère aux revenus modestes"
                ],
                C1: [
                    "Population entre 18 et 39 ans",
                    "Très petits appartements dans Paris",
                    "Cadres ou étudiants en hautes études",
                    "Gros utilisateurs des transports en commun"
                ],
                C2: [
                    "Jeunes cadres, prof. interm. ou employés",
                    "Anciens appartements de taille moyenne",
                    "Gde couronne parisienne ou gdes agglos"
                ],
                D1: [
                    "Jeunes ménages cultivés, bonne situation",
                    "Log. récents en périphérie des villes",
                    "Professions interm., cadres et employés",
                    "Familles avec enfants"
                ],
                D2: [
                    "Ménages avec enfants (&lt; 10 ans)",
                    "Log. individuels nouvellement construits",
                    "Niveau d'études et revenus moyens",
                    "Installation récente"
                ],
                D3: [
                    "Familles ouvrières avec enfants",
                    "Métiers techniques",
                    "Grandes maisons très anciennes",
                    "Revenus modestes"
                ],
                E1: [
                    "Etudiants 18-24 ans, célibataire",
                    "Locataires de petits appartements",
                    "Adeptes de transports en commun"
                ],
                F1: [
                    "Familles avec enfants ou adolescents",
                    "Actifs avec revenus dans la moyenne",
                    "Grande couronne parisienne",
                    "Habitat collectif type HLM"
                ],
                F2: [
                    "Ménages sans famille ou monoparentaux",
                    "Employés et ouvriers",
                    "Population étrangère et immigrés",
                    "Habitat collectif HLM de petite taille"
                ],
                F3: [
                    "Familles nombreuses, 25-39 ans",
                    "HLM en gde agglomération",
                    "Grande proportion d'immigrés",
                    "Revenus très faibles"
                ],
                G1: [
                    "Couples sans enfant",
                    "Ménages ouvriers en zone isolée",
                    "Faibles revenus",
                    "Log. individuels de superficie moyenne"
                ],
                G2: [
                    "Retraités de plus de 65 ans",
                    "Habitat hétérogène de taille moyenne",
                    "Faibles revenus",
                    "Nbr. infrastructures, notamment"
                ],
                H1: [
                    "Retraités au soleil et vacanciers",
                    "Activité touristique importante",
                    "Habitat hétérogène, princ. rés. secondaire",
                    "Population âgée sans enfant à charge"
                ],
                H2: [
                    "Ouvriers / retraités aux revenus modestes",
                    "Logements individuels, d'avant 1949",
                    "Zone rurale",
                    "Nbr. équipements : alim; santé, enseign."
                ],
                H3: [
                    "Ouvriers, agriculteurs ou retraités",
                    "Propriétaires de grandes maisons anciennes",
                    "Revenus modestes",
                    "Au moins 2 voitures"
                ],
                H4: [
                    "Ouvriers de plus de 40 ans ou retraités",
                    "Propriétaires de maisons individuelles anciennes",
                    "Faible niveau d'études"
                ],
                H5: [
                    "Familles d'artisans ou commerçants",
                    "Ménages de 40-54 ans avec adolescents",
                    "Maisons, parfois en rés. secondaires",
                    "Installés depuis plus de 10 ans"
                ],
                H6: [
                    "Forte part d'agriculteurs et de retraités",
                    "Revenus dans la moyenne",
                    "Propriétaire de maison à la campagne"
                ]
            };

            return typos[typo] ? typos[typo] : '';
        };

        myDQE.fill_zip = function(zip) {
            myDQE.execute_trigger('zip', [zip]);
            var country = myDQE.selected_country();
            if (country == 'PRT' && zip.match(/^\d{7}$/)) {
                zip = zip.substr(0, 4) + '-' + zip.substr(4);
            }
            if (myDQE.zip) myDQE.zip.val(zip);
        };

        myDQE.convert_iso2 = function(country) {
            var table = {
                AF:'AFG',AX:'ALA',AL:'ALB',DZ:'DZA',AS:'ASM',AD:'AND',AO:'AGO',AI:'AIA',AQ:'ATA',AG:'ATG',AR:'ARG',AM:'ARM',AW:'ABW',
                AU:'AUS',AT:'AUT',AZ:'AZE',BS:'BHS',BH:'BHR',BD:'BGD',BB:'BRB',BY:'BLR',BE:'BEL',BZ:'BLZ',BJ:'BEN',BM:'BMU',BT:'BTN',
                BO:'BOL',BA:'BIH',BW:'BWA',BV:'BVT',BR:'BRA',VG:'VGB',IO:'IOT',BN:'BRN',BG:'BGR',BF:'BFA',BI:'BDI',KH:'KHM',CM:'CMR',
                CA:'CAN',CV:'CPV',KY:'CYM',CF:'CAF',TD:'TCD',CL:'CHL',CN:'CHN',HK:'HKG',MO:'MAC',CX:'CXR',CC:'CCK',CO:'COL',KM:'COM',
                CG:'COG',CD:'COD',CK:'COK',CR:'CRI',CI:'CIV',HR:'HRV',CU:'CUB',CY:'CYP',CZ:'CZE',DK:'DNK',DJ:'DJI',DM:'DMA',DO:'DOM',
                EC:'ECU',EG:'EGY',SV:'SLV',GQ:'GNQ',ER:'ERI',EE:'EST',ET:'ETH',FK:'FLK',FO:'FRO',FJ:'FJI',FI:'FIN',FR:'FRA',GF:'GUF',
                PF:'PYF',TF:'ATF',GA:'GAB',GM:'GMB',GE:'GEO',DE:'DEU',GH:'GHA',GI:'GIB',GR:'GRC',GL:'GRL',GD:'GRD',GP:'GLP',GU:'GUM',
                GT:'GTM',GG:'GGY',GN:'GIN',GW:'GNB',GY:'GUY',HT:'HTI',HM:'HMD',VA:'VAT',HN:'HND',HU:'HUN',IS:'ISL',IN:'IND',ID:'IDN',
                IR:'IRN',IQ:'IRQ',IE:'IRL',IM:'IMN',IL:'ISR',IT:'ITA',JM:'JAM',JP:'JPN',JE:'JEY',JO:'JOR',KZ:'KAZ',KE:'KEN',KI:'KIR',
                KP:'PRK',KR:'KOR',KW:'KWT',KG:'KGZ',LA:'LAO',LV:'LVA',LB:'LBN',LS:'LSO',LR:'LBR',LY:'LBY',LI:'LIE',LT:'LTU',LU:'LUX',
                MK:'MKD',MG:'MDG',MW:'MWI',MY:'MYS',MV:'MDV',ML:'MLI',MT:'MLT',MH:'MHL',MQ:'MTQ',MR:'MRT',MU:'MUS',YT:'MYT',MX:'MEX',
                FM:'FSM',MD:'MDA',MC:'MCO',MN:'MNG',ME:'MNE',MS:'MSR',MA:'MAR',MZ:'MOZ',MM:'MMR',NA:'NAM',NR:'NRU',NP:'NPL',NL:'NLD',
                AN:'ANT',NC:'NCL',NZ:'NZL',NI:'NIC',NE:'NER',NG:'NGA',NU:'NIU',NF:'NFK',MP:'MNP',NO:'NOR',OM:'OMN',PK:'PAK',PW:'PLW',
                PS:'PSE',PA:'PAN',PG:'PNG',PY:'PRY',PE:'PER',PH:'PHL',PN:'PCN',PL:'POL',PT:'PRT',PR:'PRI',QA:'QAT',RE:'REU',RO:'ROU',
                RU:'RUS',RW:'RWA',BL:'BLM',SH:'SHN',KN:'KNA',LC:'LCA',MF:'MAF',PM:'SPM',VC:'VCT',WS:'WSM',SM:'SMR',ST:'STP',SA:'SAU',
                SN:'SEN',RS:'SRB',SC:'SYC',SL:'SLE',SG:'SGP',SK:'SVK',SI:'SVN',SB:'SLB',SO:'SOM',ZA:'ZAF',GS:'SGS',SS:'SSD',ES:'ESP',
                LK:'LKA',SD:'SDN',SR:'SUR',SJ:'SJM',SZ:'SWZ',SE:'SWE',CH:'CHE',SY:'SYR',TW:'TWN',TJ:'TJK',TZ:'TZA',TH:'THA',TL:'TLS',
                TG:'TGO',TK:'TKL',TO:'TON',TT:'TTO',TN:'TUN',TR:'TUR',TM:'TKM',TC:'TCA',TV:'TUV',UG:'UGA',UA:'UKR',AE:'ARE',GB:'GBR',
                US:'USA',UM:'UMI',UY:'URY',UZ:'UZB',VU:'VUT',VE:'VEN',VN:'VNM',VI:'VIR',WF:'WLF',EH:'ESH',YE:'YEM',ZM:'ZMB',ZW:'ZWE'
            };
            return table[country] ? table[country] : 'FRA';
        };

        /**
         * Renvoie le pays sélectionné ou le pays par défaut spécifié dans les options
         * @returns {string}
         */
        myDQE.selected_country  = function() {
            var country = myDQE.countryField ? myDQE.countryField.val() : myDQE.country;
            if (country.length == 2) return myDQE.convert_iso2(country.toUpperCase());
            return country;
        };

        myDQE.clear = function() {
            myDQE.clearSection('zip');
            if (myDQE.zip) myDQE.zip.off("input");
            if (myDQE.zipcity) myDQE.removeAutocomplete(myDQE.zipcity);
            if (myDQE.single) myDQE.removeAutocomplete(myDQE.single);
        };

        /**
         * Vérifie l'existence d'un foyer au nom demandé à l'adresse indiquée
         * @param street
         * @param zip
         * @param city
         * @param lastname
         * @param firstname
         * @param callback_function_name
         */
        myDQE.idcheck = function(street, zip, city, lastname, firstname, callback_function_name) {
            var params = {fn: "SEARCH", Address: myDQE.remove_accents(street), PostalCode: zip, City: myDQE.remove_accents(city), LastName: myDQE.remove_accents(lastname), FirstName: myDQE.remove_accents(firstname), Version: 2};
            var url = myDQE.url(params);
            myDQE.ajax(url, function(data) {
                window[callback_function_name](data);
            });
        };

        /**
         * Recherche la typologie d'un foyer situé à l'adresse indiquée
         * @param street
         * @param zip
         * @param city (facultatif)
         * @param callback_function_name
         */
        myDQE.lifestyle = function(street, zip, city, callback_function_name) {
            var ko = {status: 0};
            var url = myDQE.url({server: "es", fn: "GETINFOLIFESTYLE", Address: street, PostalCode: zip});
            myDQE.ajax(url, function(result) {
                var data = {status: 1};
                if (!result || !result['DATA1']) {
                    window[callback_function_name](ko);
                    return;
                }
                result = result['DATA1'];
                data['code'] = myDQE.house_typo(result, 1);
                data['typo'] = myDQE.house_typo(result);
                for (var key in result) {
                    if (!result.hasOwnProperty(key)) continue;
                    if (key.substr(0, 5) == 'TYPO_') continue;
                    data[key.toLowerCase()] = result[key];
                }
                window[callback_function_name](data);
            });
        };

        /**
         * Renvoie les coordonnées GPS sous réserve que l'on dispose du street_id et du num
         * Dès que les coordonnées sont obtenues (ou pas), la fonction callback_function_name est appelée
         * @param callback_function_name
         */
        myDQE.latlng = function(callback_function_name) {
            var num = myDQE.current_number ? myDQE.current_number : "";
            var street_id = myDQE.current_street_id;
            var ko = {status: 0, msg: 'Coordonnées non trouvées'};
            if (!street_id) {
                window[callback_function_name](ko);
                return;
            }

            var url = myDQE.url({fn: "LATLG", IDVoie: street_id, Num: num, Pays: myDQE.selected_country()});
            myDQE.ajax(url, function(data) {
                if (!data || !data[1]) {
                    window[callback_function_name](ko);
                    return;
                }
                data = data[1];
                if (data['Latitude'] == 0 && data['Longitude'] == 0) window[callback_function_name](ko);
                else {
                    data['status'] = 1;
                    window[callback_function_name](data);
                }
            });
        };

        /**
         * Renvoie true si le code postal est correct
         * @returns {boolean}
         */
        myDQE.valid_zip = function(zip) {
            var country = myDQE.selected_country();
            if (!myDQE.zip_pattern[country]) return true;
            return zip.match(myDQE.zip_pattern[country]);
        };

        myDQE.num_is_after = function() {
            var country = myDQE.selected_country();
            return !!myDQE.reversed_countries[country];
        };

        myDQE.recombine_street = function(num, street_type, street_name, nia) {
            var parts = [];
            if (!nia) nia = myDQE.num_is_after();
            if (nia) {
                //Le n° est placé après la rue
                if (street_type) parts.push(street_type);
                if (street_name) parts.push(street_name);
                if (num) parts.push(num);
            }
            else {
                //Le n° est placé avant la rue
                if (num) {
                    if(myDQE.hasBisOrTer(num)) {
                        var new_num = num.slice(0, -1) + ' ' + num.substr(num.length - 1);
                        parts.push(new_num);
                    } else {
                        parts.push(num);
                    }
                }
                if (street_type) parts.push(street_type);
                if (street_name) parts.push(street_name);
            }
            return parts.join(" ");
        };

        myDQE.hasBisOrTer = function (str) {
            var  lastChar = str.substr(str.length - 1);
            var bmpDigits = /[0-9\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0AE6\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F29\u1040-\u1049\u1090-\u1099\u17E0-\u17E9\u1810-\u1819\u1946-\u194F\u19D0-\u19D9\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\uA620-\uA629\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19]/;
            var hasNumber = RegExp.prototype.test.bind(bmpDigits);
            return !hasNumber(lastChar);
        };

        /**
         * Vérifie si le code postal a changé suite au changement de numéro dans la voie
         */
        myDQE.num_final_check = function() {
            var country = myDQE.selected_country();
            if ((country === 'BEL' || country === 'PRT') && myDQE.current_street_id && myDQE.current_city_id && myDQE.current_zip) {
                var url = myDQE.url({fn: "NUM", Numero: myDQE.current_number, IDVoie: myDQE.current_street_id, IDLocalite: myDQE.current_city_id, CodePostal: myDQE.current_zip, Pays: country});
                myDQE.ajax(url, function(data) {
                    if (data && data['1'] && data['1']['IDLocalite']) {
                        var zip = data['1']['CodePostal'];
                        var city_id = data['1']['IDLocalite'];
                        var city = data['1']['Localite'];
                        if (myDQE.zip && myDQE.current_zip !== zip) myDQE.fill_zip(zip);
                        if (myDQE.current_city_id !== city_id) {
                            myDQE.current_city_id = city_id;
                            if (myDQE.city) myDQE.city.val(city);
                        }

                        if (myDQE.zipcity && (myDQE.current_zip !== zip || myDQE.current_city_id !== city_id)) {
                            myDQE.zipcity.val(zip + ' ' + city);
                            myDQE.selected_zipcity_value = myDQE.zipcity.val();
                        }
                    }
                });

            }
        };

        /**
         * Affiche un menu déroulant de la liste des numéros disponibles pour la rue sélectionnée
         * (uniquement si le champ numéro est séparé de l'adresse)
         */
        myDQE.show_numbers = function() {
            myDQE.force_num_in_street = false;
            var street_id = myDQE.current_street_id;
            var city_id = myDQE.current_city_id;
            var zip = myDQE.current_zip;
            if (!myDQE.number) return;
            myDQE.number.focus();
            var fast = myDQE.fast_country();

            myDQE.removeAutocomplete(myDQE.number);
            myDQE.number.autocomplete({
                open: function(event, ui) {
                    if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                        $('.ui-autocomplete').off('menufocus hover mouseover');
                    }
                },
                delay: fast ? 0 : 300,
                source: function(request, response) {
                    if (myDQE.single && myDQE.current_numbers_source) {
                        response(myDQE.current_numbers_source);
                    }
                    else {
                        var url = myDQE.url({fn: "NUM", IDVoie: street_id, IDLocalite: city_id, CodePostal: zip, Pays: myDQE.selected_country()});
                        myDQE.ajax(url, function(data) {
                            response(myDQE.filter_num(data));
                        });
                    }
                },
                minLength: 0,
                select: function(event, ui) {
                    myDQE.clearSection("compl");
                    myDQE.current_number = ui.item.value;
                    myDQE.number.val(ui.item.value);
                    myDQE.show_complements();
                    myDQE.execute_trigger('number', [ui.item.value]);

                    //On appelle une dernière fois NUM pour savoir si le code postal change en fonction du numéro dans la voie
                    myDQE.num_final_check();
                    return false;
                },
                response: function( event, ui ) {
                    var numbers = ui.content.length;
                }
            }).focus(function() {
                if ($(this).data('ui-autocomplete')) $(this).autocomplete("search", $(this).val());
            });
            myDQE.number.focus();
        };

        /**
         * Affiche la liste des numéros disponibles pour l'adresse indiquée dans le champ adresse afin de le compléter
         */
        myDQE.load_addresses_with_numbers = function() {
            myDQE.force_num_in_street = false;
            var city_id   = myDQE.current_city_id;
            var zip       = myDQE.current_zip;
            var street_id = myDQE.current_street_id;
            var street    = myDQE.street.val();
            var num_is_after = myDQE.num_is_after();
            var replace_in_street = street.indexOf("%d") > -1;
            myDQE.num_search = true;

            var num, lbl;
            var streets = [];
            var line;

            //Fabio: correction de bug sur l'entonoir:
            // ça plantait pour les routes sans n° (Ex: 20 ROUTE DE BASTIA 20144)
            if (myDQE.list_numbers === undefined) myDQE.list_numbers = [];

            if(myDQE.list_numbers === 0){
                var url = myDQE.url({fn: "NUM", IDVoie: street_id, IDLocalite: city_id, CodePostal: zip, Pays: myDQE.selected_country()});
                myDQE.ajax(url, function(data) {
                    data = myDQE.filter_num(data);
                    var len = data.length;
                    for (var i = 0; i < len; i++) {
                        num = data[i].value;
                        if (replace_in_street) lbl = myDQE.string_replace(street, '%d', num);
                        else lbl = num_is_after ? street + " " + num : num + " " + street;
                        line = {id: street_id, number: num, label: lbl, simple_label: lbl};
                        if (data[i].street_id) line['street_id'] = data[i].street_id;
                        if (data[i].street) line['street'] = data[i].street;
                        streets.push(line);
                    }
                    if (myDQE.street.data('ui-autocomplete') && streets.length > 0) {
                        myDQE.street.autocomplete("option", "source", streets);
                        myDQE.street.autocomplete("option", "minLength", 0);
                        myDQE.street.autocomplete("search", myDQE.street.val());
                    }
                });
            }
            else {
                for (var i = 0; i < myDQE.list_numbers.length; i++){
                    num = myDQE.list_numbers[i];
                    if (replace_in_street) lbl = myDQE.string_replace(street, '%d', num);
                    else lbl = num_is_after ? street + " " + num : num + " " + street;
                    line = {id: street_id, number: num, label: lbl, simple_label: lbl};
                    if (myDQE.current_street_id != "") line['street_id'] = myDQE.current_street_id;
                    if (street != "") line['street'] = street;
                    streets.push(line);
                }
                if (myDQE.street.data('ui-autocomplete') && streets.length > 0) {
                    setTimeout(function() {
                        myDQE.street.autocomplete("option", "source", streets);
                        myDQE.street.autocomplete("option", "minLength", 0);
                        myDQE.street.autocomplete("search", myDQE.street.val());
                    }, 0);
                }
            }
        };

        myDQE.load_addresses_with_bp = function(prefix, numbers) {
            myDQE.force_num_in_street = true;
            var street_id = myDQE.current_street_id;
            prefix = prefix.replace('_BP_:', '');
            prefix = prefix.replace('_BP_', '');

            var len = numbers.length;
            var num, lbl;
            var streets = [];
            for (var i = 0; i < len; i++) {
                num = numbers[i];
                lbl = prefix.replace('BP_', num);
                streets.push({value: street_id, number: num, label: lbl, simple_label: lbl});
            }

            if (!myDQE.street.data('ui-autocomplete')) myDQE.show_streets();
            myDQE.street.autocomplete("option", "source", streets);
            myDQE.street.autocomplete("option", "minLength", 0);
            myDQE.street.autocomplete("search", myDQE.street.val());
        };

        myDQE.set_number = function(result) {
            myDQE.execute_trigger('number', [result.number]);
            myDQE.current_number = result.number;
            myDQE.num_final_check();
            if (myDQE.number) myDQE.number.val(result.number);
            myDQE.show_complements();
        };

        myDQE.show_arrondissements = function(city, id){
            myDQE.zipcity.autocomplete({
                open: function(event, ui) {
                    if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                        $('.ui-autocomplete').off('menufocus hover mouseover');
                    }
                },
                create: function() {
                    $(this).data('ui-autocomplete')._renderItem = myDQE.render_item;
                },
                delay: 0,
                source: function(request, response) {
                    var country = myDQE.selected_country();
                    var url = myDQE.url({fn: 'CP', CodePostal: "", IDLocalite: city.city_id, Instance: 0, Pays: myDQE.selected_country()});
                    myDQE.ajax(url, function(data) {
                        response(myDQE.filter_arrondissements(data));
                    });
                },
                minLength: 2,
                select: function(event, ui) {
                    myDQE.current_zipcity = ui.item.label;
                    myDQE.zipcity.val(ui.item.label);
                    myDQE.removeAutocomplete(myDQE.zipcity);
                    myDQE.activate_zipcity_autocomplete();
                    myDQE.zipcity.blur();

                    if (myDQE.insee) myDQE.insee.val(ui.item.IDLocalite);

                    myDQE.current_city_id = id[0];
                    myDQE.current_zip = ui.item.zip;
                    myDQE.current_city = ui.item.city;

                    myDQE.show_streets();
                    myDQE.execute_trigger('zip', [ui.item.value, ui.item.zip]);
                    myDQE.execute_trigger('city', [ui.item.value, ui.item.city]);

                    return false;
                }
            }).on('focus', function () {
                var value = myDQE.zipcity.val();
                $(this).autocomplete("search", value);
            });
        };

        myDQE.filter_arrondissements = function(result){
            var i = 1;
            var arrondissements = [];
            var line;

            while (result[i]) {
                line = { label : result[i].CodePostal + " " + myDQE.trim(result[i].Localite),
                         city_id : result[i].IDLocalite,
                         lat : result[i].Latitude,
                         lon : result[i].Longitude
                };
                arrondissements.push(line);
                i++;
            }
            return arrondissements;
        };

        myDQE.show_streets = function(reloading) {
            myDQE.clearSection("number");
            var single = myDQE.direct_numbers || myDQE.single;
            var fast = myDQE.fast_country();

            if (myDQE.street) {
                if (!single) myDQE.current_street_id = '';
                if (!reloading && !single) myDQE.street.val('');
                myDQE.street.focus();
                myDQE.removeAutocomplete(myDQE.street);
                myDQE.street.autocomplete({
                    open: function(event, ui) {
                        if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                            $('.ui-autocomplete').off('menufocus hover mouseover');
                        }
                    },
                    create: function() {
                        $(this).data('ui-autocomplete')._renderItem = myDQE.render_item;
                    },
                    delay: fast ? 0 : 300,
                    source: function(request, response) {
                        if (single) {
                            response(myDQE.current_numbers_source);
                        }
                        else {
                            var country = myDQE.selected_country();
                            myDQE.num_search = false;
                            var params = {fn: 'ADR', IDLocalite: myDQE.current_city_id, Adresse: request.term, Instance: 0, Pays: country};
                            if (country === 'FRA') params["Etendue"] = "O";
                            var url = myDQE.url(params);
                            myDQE.ajax(url, function(data) {
                                response(myDQE.filter_adr(data));
                            });
                        }
                    },
                    minLength: 1,
                    select: function(event, ui) {
                        myDQE.list_numbers = ui['item']['list_numbers'];
                        myDQE.adr_autocomplete_used = true;
                        myDQE.clearSection("number");
                        if (!myDQE.num_search) myDQE.current_street_id = ui.item.id;
                        myDQE.street.autocomplete("option", "minLength", 2);

                        //Si le code postal n'a pas encore été attribué,
                        //on l'affecte maintenant que la rue a été choisie
                        if (ui.item.zip && ui.item.city) {
                            if (myDQE.zipcity) {
                                //zipcity
                                var city = ui.item.zip + ' ' + ui.item.city;
                                //S'il y a un lieu-dit mais qu'on n'a pas de champ dédié, on ajoute le lieu-dit à la ville
                                if (!myDQE.local && ui.item.local) {
                                    city += ', ' + ui.item.local;
                                }
                                myDQE.zipcity.val(city);
                                myDQE.selected_zipcity_value = myDQE.zipcity.val();
                            }
                            //zip et city séparés
                            if (myDQE.zip) {
                                var zip = myDQE.zip.val();
                                if (ui.item.zip && zip != ui.item.zip && myDQE.city.val().indexOf("CEDEX") === -1)
                                    myDQE.fill_zip(ui.item.zip);
                            }

                            if (myDQE.city && ui.item.city_id && ui.item.city_id != myDQE.current_city_id) {
                                //Si la ville change, on la met à jour (cela arrive pour certaines rues belges qui s'étendent sur plusieurs villes) 
                                myDQE.city.val(ui.item.city);
                                myDQE.execute_trigger("city", ui.item.city);
                            }

                            myDQE.current_zip = ui.item.zip;
                            myDQE.current_city_id = ui.item.city_id;
                        }

                        if (ui.item.company && myDQE.company) {
                            myDQE.company.val(ui.item.company);
                            myDQE.execute_trigger('company', [ui.item.company]);
                        }

                        if (myDQE.local && ui.item.hasOwnProperty("local")) {
                            myDQE.local.val(ui.item.local);
                            myDQE.execute_trigger('local', [ui.item.local]);
                        }

                        if (ui.item.prov && myDQE.prov) {
                            myDQE.prov.val(ui.item.prov);
                            myDQE.execute_trigger('prov', [ui.item.prov]);
                        }

                        if (!ui.item.street) ui.item.street = '';
                        
                        if (myDQE.number && !myDQE.force_num_in_street) {
                            //Champ séparé pour le numéro
                            myDQE.street.val(ui.item.street);
                            myDQE.execute_trigger('street', [ui.item.street]);
                            if (ui.item.number) {
                                myDQE.set_number(ui.item);
                            }
                            else {
                                //Autocomplete pour la liste des numéros
                                myDQE.show_numbers();
                            }
                        }
                        else {
                            //On inclue le numéro avec la rue
                            myDQE.street.val(ui.item.simple_label);
                            myDQE.execute_trigger('street', [ui.item.street]);
                            if (ui.item.number) {
                                myDQE.set_number(ui.item);
                            }
                            else {
                                myDQE.load_addresses_with_numbers();
                                myDQE.show_complements();
                                return false;
                            }
                        }

                        if (myDQE.num_search) {
                            myDQE.show_complements();
                        }
                        return false;
                    }
                }).off("focus").on("focus", function() {
                    if ($(this).data('ui-autocomplete')) $(this).autocomplete("search", $(this).val());
                }).on("keypress", function() {
                    myDQE.clearSection("number");
                    if (myDQE.selected_country() == 'FRA') myDQE.clearSection("compl");

                    //Si une adresse a déjà été choisie, l'autocomplete est fixé sur certaines adresses
                    //Tout changement du champ doit donc entrainer une réinitialisation de l'autocomplete
                    if (myDQE.adr_autocomplete_used) {
                        myDQE.adr_autocomplete_used = false;
                        myDQE.removeAutocomplete(myDQE.street);
                        myDQE.street.off("focus").off("keypress");
                        myDQE.current_street_id = "";
                        if (myDQE.single) {
                            myDQE.removeAutocomplete(myDQE.single);
                            myDQE.current_numbers_source = false;
                            myDQE.activate_single_autocomplete();
                        }
                        else myDQE.show_streets(true);
                    }
                });
            }
        };

        myDQE.removeAutocomplete = function(element) {
            if (element.data('ui-autocomplete')) {
                element.autocomplete("destroy");
                element.removeData("ui-autocomplete");
            }
        };

        myDQE.clearSection = function(section) {
            if (section == 'zip' && myDQE.zip) {
                myDQE.override_reset();
                myDQE.zip.val("");
                myDQE.clearSection("city");
                myDQE.current_zip = "";
            }
            if (section == 'city' && myDQE.city) {
                myDQE.override_reset();
                myDQE.city.val("");
                myDQE.removeAutocomplete(myDQE.city);
                myDQE.clearSection("local");
                myDQE.clearSection("street");
                myDQE.clearSection("prov");
                myDQE.clearSection("compl");
                myDQE.current_city_id = "";
            }
            if (section == 'local' && myDQE.local) {
                myDQE.local.val("");
                myDQE.removeAutocomplete(myDQE.local);
                myDQE.clearSection("street");
                myDQE.clearSection("compl");
                myDQE.current_local_id = "";
            }
            if (section == 'street' && myDQE.street) {
                myDQE.street.val("");
                myDQE.removeAutocomplete(myDQE.street);
                myDQE.clearSection("number");
                myDQE.current_street_id = "";
                myDQE.execute_trigger("override");
                //myDQE.current_numbers_source = [];
                myDQE.direct_numbers = false;
            }
            if (section == 'number') {
                if (myDQE.number) {
                    myDQE.number.val("");
                    myDQE.removeAutocomplete(myDQE.number);
                    myDQE.current_number = "";
                    myDQE.current_numbers_source = [];
                }
            }
            if (section == 'compl' && myDQE.compl) {
                myDQE.compl.val("");
                myDQE.removeAutocomplete(myDQE.compl);
                myDQE.current_compl = "";
                myDQE.current_compl_source = [];
            }
            if (section == 'prov' && myDQE.prov) {
                myDQE.prov.val("");
                myDQE.current_prov = "";
            }
            if (section == 'zipcity' && myDQE.zipcity) {
                myDQE.override_reset();
                myDQE.zipcity.val("");
                myDQE.removeAutocomplete(myDQE.zipcity);
                myDQE.clearSection("street");
                myDQE.current_zipcity = "";
            }
            if (section == 'single' && myDQE.single) {
                myDQE.single.val("");
                myDQE.removeAutocomplete(myDQE.single);
            }
        };

        myDQE.no_bp = function(text) {
            text = myDQE.replace(text, '_BP_:', '');
            text = myDQE.replace(text, '_BP_', '');
            text = myDQE.replace(text, ' BP_', '');
            text = myDQE.replace(text, 'BP_', '');
            return myDQE.trim(text);
        };

        /**
         * Remplit tous les champs disponibles lorsqu'une ville est choisie
         * @param city
         */
        myDQE.set_city = function(city) {
            myDQE.clearSection("street");
            if (myDQE.settings.append_locality && city.local) city.city += ", " + city.local;
            if (myDQE.city) myDQE.city.val(city.city);
            if (myDQE.compl && city.compl) {
                myDQE.compl.val(city.compl);
                myDQE.execute_trigger('compl', [city.compl]);
            }
            else myDQE.clearSection("compl");
            if (myDQE.local && city.local) {
                myDQE.local.val(city.local);
                myDQE.execute_trigger('local', [city.local]);
            }
            if (myDQE.prov && city.prov) {
                myDQE.prov.val(city.prov);
                myDQE.current_prov = city.prov;
                myDQE.execute_trigger('prov', [city.prov]);
            }

            if (myDQE.insee) myDQE.insee.val(city.city_id);

            myDQE.current_city_id = city.city_id;
            myDQE.execute_trigger('city', [city.city_id, city.city]);
            myDQE.show_streets();

            if (city.zip) {
                if (myDQE.zip && myDQE.zip.val() !== city.zip) myDQE.zip.val(city.zip);
                myDQE.current_zip = city.zip;
                myDQE.execute_trigger("zip", city.zip)
            }

            if (city.street && myDQE.street) {
                if (city.street.indexOf('BP_') > -1) {
                    if (city.numbers) myDQE.load_addresses_with_bp(city.street, city.numbers);
                    else {
                        myDQE.street.val(myDQE.no_bp(city.street));
                        myDQE.execute_trigger("street", city.street);
                    }
                }
                else {
                    myDQE.street.val(city.street);
                    myDQE.execute_trigger("street", city.street);
                }
            }
            if (city.street_id) {
                myDQE.current_street_id = city.street_id;
                myDQE.street.autocomplete("search", myDQE.street.val());
            }

            //Gestion des noms de société dans le cas des Cedex
            if (city.company && myDQE.company) {
                myDQE.company.val(city.company);
                myDQE.execute_trigger('company', [city.company]);
            }

            if (city.street && myDQE.street && city.numbers) {
                myDQE.show_numbers_directly(city.numbers, city.street, "", city.street_id);
            }
        };

        myDQE.extract_city_name = function(city_name) {
            var p = city_name.lastIndexOf("(");
            if (p === -1) return city_name;
            return myDQE.trim(city_name.substr(0, p));
        };

        myDQE.calculate_zip = function(city_id, city_name) {
            //On peut trouver le code postal en appelant CP avec :
            //le code INSEE dans le champ IDLocalite et en laissant le champ CodePostal vide
            var url = myDQE.url({fn: 'CP', CodePostal: "", IDLocalite: city_id, Instance: 0, Pays: myDQE.selected_country()});
            myDQE.ajax(url, function(data) {
                var len = myDQE.count(data);
                var i = 1;
                while (data[i]) {
                    if (len === 1 || data[i]['Localite'] === city_name) {
                        myDQE.fill_zip(data[i]['CodePostal']);
                        myDQE.set_city({city: data[i]['Localite'], value: city_id, zip: data[i]['CodePostal']});
                        break;
                    }
                    i++;
                }
            });
        };

        myDQE.search_cities = function() {
            var fast = myDQE.fast_country();

            myDQE.city_search_enabled = 1;
            myDQE.removeAutocomplete(myDQE.city);
            myDQE.city.autocomplete({
                open: function(event, ui) {
                    if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                        $('.ui-autocomplete').off('menufocus hover mouseover');
                    }
                },
                create: function() {
                    $(this).data('ui-autocomplete')._renderItem = myDQE.render_item;
                },
                delay: fast ? 0 : 300,
                source: function(request, response) {
                    var url = myDQE.url({fn: 'CP', CodePostal: request.term, Alpha: 'True', Instance: 0, Pays: myDQE.selected_country()});
                    myDQE.ajax(url, function(data) {
                        data = myDQE.filter_cities(data, true);
                        var lines = [];
                        for (var i = 0; i < data.length; i++) {
                            if (data[i].city.indexOf(" CEDEX") === -1) lines.push(data[i]);
                        }
                        response(lines);
                    });
                },
                minLength: 3,
                select: function(event, ui) {
                    var city_name = myDQE.extract_city_name(ui.item.city);
                    if (myDQE.insee) myDQE.insee.val(city_id);
                    myDQE.calculate_zip(ui.item.city_id, city_name);
                    return false;
                },
                focus: function(event, ui) {
                    event.preventDefault();
                }
            });
        };

        //mode entonnoir
        myDQE.show_cities = function(e) {
            myDQE.clearSection("city");
            myDQE.override(true, "zip"); //Evènement lancé au onInput du champ zip
            var zip = myDQE.zip.val();
            if (!myDQE.valid_zip(zip)) return;
            if (myDQE.local) myDQE.local.val("");

            var url = myDQE.url({fn: 'CP', CodePostal: zip, Alpha: 'True', Instance: 0, Pays: myDQE.selected_country()});
            myDQE.ajax(url, function(data) {
                data = myDQE.filter_cities(data);
                var one_city = data.length == 1 && !myDQE.city.val();
                if (data && data.length > 0) {
                    myDQE.zip.val(zip);
                    myDQE.execute_trigger('zip', [zip]);

                    myDQE.city.autocomplete({
                        open: function(event, ui) {
                            if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                                $('.ui-autocomplete').off('menufocus hover mouseover');
                            }
                        },
                        create: function() {
                            $(this).data('ui-autocomplete')._renderItem = myDQE.render_item;
                        },
                        source: data,
                        minLength: 0,
                        select: function(event, ui) {
                            myDQE.set_city(ui.item);
                            return false;
                        }
                    }).off("focus").on("focus", function () {
                        if (!one_city && $(this).data('ui-autocomplete')) $(this).autocomplete("search", $(this).val());
                    });
                    if (one_city) {
                        myDQE.set_city(data[0]);
                    }
                    else myDQE.city.focus();
                }
            });
        };

        myDQE.activate_zipcity_autocomplete = function() {
            var country = myDQE.selected_country();
            var fast = myDQE.fast_country();
            //Présence d'un champ groupé Code postal/Ville ?
            if (myDQE.zipcity && !myDQE.single) {
                myDQE.removeAutocomplete(myDQE.zipcity);
                myDQE.zipcity.autocomplete({
                    open: function(event, ui) {
                        if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                            $('.ui-autocomplete').off('menufocus hover mouseover');
                        }
                    },
                    create: function() {
                        $(this).data('ui-autocomplete')._renderItem = myDQE.render_item;
                    },
                    delay: fast ? 0 : 300,
                    source: function(request, response) {
                        var url;
                        if(myDQE.selected_country() == 'FRA') url = myDQE.url({fn: 'CP', CodePostal: request.term, Alpha: 'True', Instance: 0, Pays: country, Etendue:'Y'});
                        else url = myDQE.url({fn: 'CP', CodePostal: request.term, Alpha: 'True', Instance: 0, Pays: country});
                        myDQE.ajax(url, function(data) {
                            data = myDQE.filter_cities(data);

                            if( data[0].city.indexOf('(') > -1) {
                                myDQE.search_arrondissements(data[0], data[0].city_id.split('-'));
                                var res = myDQE.arrondissements.concat(data);
                                response(res);

                                if (res[0].label === "PARIS (75)" || res[0].label === "MARSEILLE (13)" || res[0].label === "LYON (69)"){
                                    myDQE.zipcity.trigger("click");
                                }
                            }
                            else {
                                myDQE.arrondissements = [];
                                response(data);
                            }
                        });
                    },
                    minLength: 3,
                    select: function(event, ui) {
                        if (myDQE.only_zipcity) {
                            if (ui.item.city) {
                                myDQE.zipcity.val(ui.item.city + " - " + ui.item.zip);
                                myDQE.selected_zipcity_value = myDQE.zipcity.val();
                            } else {
                                var items = ui.item.value.split(" ")
                                myDQE.zipcity.val(items[1] + " - " + items[0]);
                                myDQE.selected_zipcity_value = myDQE.zipcity.val();
                            }

                            return false;
                        } else {
                            if (myDQE.zipcity && ui.item.city_id.split('-').length > 1) {
                                myDQE.zipcity.val(ui.item.zipcity);
                                myDQE.removeAutocomplete(myDQE.zipcity);
                                myDQE.show_arrondissements(ui.item, ui.item.city_id.split('-'));
                                myDQE.zipcity.focus();
                                return false;
                            }

                            if (myDQE.insee) myDQE.insee.val(ui.item.city_id);

                            if (myDQE.zip && myDQE.city) {
                                myDQE.zip.val(ui.item.zip);
                                myDQE.city.val(ui.item.city);
                            } else {
                                myDQE.zipcity.val(ui.item.label);
                            }
                            myDQE.selected_zipcity_value = myDQE.zipcity.val();
                            if (myDQE.local && ui.item.local) {
                                myDQE.local.val(ui.item.local);
                                myDQE.execute_trigger('local', [ui.item.local]);
                            }
                            if (myDQE.prov && ui.item.prov) {
                                myDQE.prov.val(ui.item.prov);
                                myDQE.execute_trigger('prov', [ui.item.prov]);
                            }

                            myDQE.current_city_id = ui.item.city_id;
                            myDQE.current_zip = ui.item.zip;
                            myDQE.current_city = ui.item.city;

                            myDQE.show_streets();
                            myDQE.execute_trigger('zip', [ui.item.value, ui.item.zip]);
                            myDQE.execute_trigger('city', [ui.item.value, ui.item.city]);

                            if (ui.item.company && myDQE.company) {
                                myDQE.company.val(ui.item.company);
                                myDQE.execute_trigger('company', [ui.item.company]);
                            }

                            if (ui.item.street && myDQE.street) {
                                if (ui.item.street.indexOf('BP_') > -1) {
                                    myDQE.load_addresses_with_bp(ui.item.street, ui.item.numbers);
                                } else {
                                    myDQE.street.val(ui.item.street);
                                    myDQE.execute_trigger("street", ui.item.street)
                                }
                            }

                            if (ui.item.street_id) {
                                myDQE.current_street_id = ui.item.street_id;
                                myDQE.street.autocomplete("search", myDQE.street.val());
                            }
                            return false;
                        }
                    },
                    focus: function (event, ui) {
                        event.preventDefault();
                    }
                }).on("click", function () {
                    var value = myDQE.zipcity.val();
                    if ($(this).data('ui-autocomplete') && value.length > 2) $(this).autocomplete("search", value);
                });
            }
        };

        myDQE.search_arrondissements = function (city, id) {
            var url = myDQE.url({fn: 'CP', CodePostal: "", IDLocalite: city.city_id, Instance: 0, Pays: myDQE.selected_country()});
            myDQE.ajax(url, function(data) {
                myDQE.arrondissements = myDQE.filter_arrondissements(data);
            });
        };

        myDQE.reset_single_autocomplete = function() {
            if (myDQE.zip) myDQE.zip.val("");
            if (myDQE.city) myDQE.city.val("");
            if (myDQE.compl) myDQE.compl.val("");
            if (myDQE.prov) myDQE.prov.val("");
            if (myDQE.local) myDQE.local.val("");
            if (myDQE.company) myDQE.company.val("");
            myDQE.street.off("input", myDQE.reset_single_autocomplete);
            myDQE.single.off("click", myDQE.reset_single_autocomplete);
            myDQE.removeAutocomplete(myDQE.single);
            myDQE.activate_single_autocomplete();
        };

        myDQE.geolocErrorCallback = function(error){
            var errorMessage = 'Unknown error';
            switch(error.code) {
                case 1:
                    errorMessage = 'Permission denied';
                    break;
                case 2:
                    errorMessage = 'Position unavailable';
                    break;
                case 3:
                    errorMessage = 'Timeout';
                    break;
            }
            console.log(errorMessage);
        };

        myDQE.setGeolocCity = function(pos) {
            myDQE.lat = pos.coords.latitude;
            myDQE.lon = pos.coords.longitude;

            var params = {fn: "SINGLE", Adresse: "", Pays: myDQE.selected_country(), Lon: myDQE.lon, Lat: myDQE.lat};
            var url = myDQE. url(params);
            myDQE.ajax(url, function(data) {
                if (!data['1']) return;
                data = data['1'];
                if (myDQE.zipcity) {
                    myDQE.selected_zipcity_value = data.CodePostal + " " + data.Localite;
                    myDQE.zipcity.val(data.CodePostal + " " + data.Localite).trigger("input");
                }
                
                var nia = myDQE.num_is_after();
                var street = myDQE.recombine_street(data.Numero, "", data.Voie, nia);
                if (myDQE.zip) myDQE.zip.val(data.CodePostal);
                if (myDQE.city) myDQE.city.val(data.Localite);
                if (myDQE.street && street) myDQE.street.val(street);
                myDQE.current_city_id = data.IDLocalite;
                myDQE.current_street_id = data.IDVoie;
                myDQE.current_zip = data.CodePostal;
            });
        };

        myDQE.getGeolocCity = function() {
            if (myDQE.lat > 0 || myDQE.lon > 0) {
                myDQE.setGeolocCity({coords: {latitude: myDQE.lat, longitude: myDQE.lon}});
            }
            else {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(myDQE.setGeolocCity, myDQE.geolocErrorCallback, {enableHighAccuracy: true, timeout: 10000, maximumAge: 0});
                }
            }
        };

        myDQE.show_numbers_directly = function (numbers, street_name, street_type, street_id) {
            myDQE.direct_numbers = true;
            var replace_in_street = street_name.indexOf("%d") > -1;

            if (myDQE.number) {
                myDQE.current_numbers_source = numbers;
                myDQE.show_numbers();
            }
            else {
                var nia = myDQE.num_is_after();
                var source = [];
                var adr;
                var len = numbers.length;
                for (var i = 0; i < len; i++) {
                    if (replace_in_street) adr = street_name.replace('%d', numbers[i]);
                    else adr = myDQE.recombine_street(numbers[i], street_type, street_name, nia);
                    source.push({
                        id: street_id,
                        'label': adr,
                        simple_label: adr,
                        street: street_name,
                        number: numbers[i]
                    });
                }
                myDQE.current_numbers_source = source;

                myDQE.show_streets();
                myDQE.street.autocomplete("option", "minLength", 0);
                myDQE.street.autocomplete("search", myDQE.street.val());
            }
        };

        myDQE.fill_nums = function(min, max) {
            var result = [];
            for (var i = 1; i <= max; i++) {
                result.push(i);
            }
            return result;
        };

        myDQE.activate_single_autocomplete = function() {
            //Présence d'un champ de recherche rapide d'adresse ?
            var fast = myDQE.fast_country();
            if (myDQE.single) {
                myDQE.removeAutocomplete(myDQE.single);
                myDQE.single.autocomplete({
                    height: 150,
                    delay: fast ? 0 : 300,
                    open: function(event, ui) {
                        if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                            $('.ui-autocomplete').off('menufocus hover mouseover');
                        }
                    },
                    create: function() {
                        $(this).data('ui-autocomplete')._renderItem = myDQE.render_item;
                    },
                    source: function(request, response) {
                        var country = myDQE.selected_country();
                        var url = myDQE.url({fn: "SINGLEV2", Pays: country, Adresse: request.term});
                        var lastCaracter = request.term[request.term.length - 1];
                        if (request.term.length >= 3 && lastCaracter !== " ") {
                            myDQE.ajax(url, function(data) {
                                response(myDQE.filter_single(data)); //Format compatible précédentes versions
                            });
                        }
                    },
                    minLength: fast ? 1 : 2,
                    select: function(event, ui) {
                        if (myDQE.street || myDQE.city ||myDQE.zip|| myDQE.prov || myDQE.local) {
                            //On remplit les champs CP, ville et lieu-dit
                            if(myDQE.prov){
                                if(myDQE.prov.is(myDQE.city) && ui.item.prov){
                                    var city_with_prov = ui.item.city +', '+ ui.item.prov;
                                    if (ui.item.region1) city_with_prov += ', ' + ui.item.region1;
                                    myDQE.city.val(city_with_prov);
                                    myDQE.execute_trigger('prov', [ui.item.prov]);
                                }
                                else{
                                    if (myDQE.city && myDQE.selected_country() == "GBR") {
                                        myDQE.city.val(ui.item.city + ', ' + ui.item.region1);
                                    }
                                    else {
                                        if (myDQE.city) myDQE.city.val(ui.item.city);
                                    }
                                    if (myDQE.prov && ui.item.prov) {
                                        myDQE.prov.val(ui.item.prov);
                                        myDQE.execute_trigger('prov', [ui.item.prov]);
                                    }
                                }
                            }
                            else{
                                if (myDQE.city && myDQE.selected_country() == "GBR") {
                                    myDQE.city.val(ui.item.city + ', ' + ui.item.region1);
                                }
                                else if (myDQE.city) myDQE.city.val(ui.item.city);}


                            if (myDQE.company) {
                                var company_name = ui.item.company ? ui.item.company : "";
                                myDQE.company.val(company_name);
                                myDQE.execute_trigger('company', [company_name]);
                            }

                            if (myDQE.compl) myDQE.compl.val(ui.item.compl);
                            if (myDQE.zip) myDQE.fill_zip(ui.item.zip);

                            if (myDQE.zipcity) {
                                myDQE.zipcity.val(ui.item.city + " - " + ui.item.zip);
                                myDQE.selected_zipcity_value = myDQE.zipcity.val();
                            }

                            if (myDQE.insee) myDQE.insee.val(ui.item.city_id);
                            // pas besoin
                            if (myDQE.local && ui.item.local) {
                                myDQE.local.val(ui.item.local);
                                myDQE.current_local = ui.item.local;
                                myDQE.execute_trigger('local', [ui.item.local]);
                            }

                            myDQE.current_city_id = ui.item.city_id;
                            myDQE.current_zip = ui.item.zip;
                            myDQE.current_street_id = ui.item.id;
                            if (ui.item.num) myDQE.current_number = ui.item.num;

                            //On remplit les champs n° et rue
                            var street;
                            if (myDQE.number) {
                                //Champ numéro séparé
                                myDQE.number.val(ui.item.num);

                                if (myDQE.street_type) {
                                    myDQE.street_type.val(ui.item.type);
                                    street = street = myDQE.recombine_street('', '', ui.item.street);
                                    myDQE.execute_trigger('street_type', []);
                                }
                                else {
                                    street = myDQE.recombine_street('', ui.item.type, ui.item.street);
                                }

                                myDQE.execute_trigger('number', [ui.item.num]);
                            }
                            else street = myDQE.recombine_street(ui.item.num, ui.item.type, ui.item.street);
                            if (myDQE.street) myDQE.street.val(street);

                            var c = myDQE.selected_country();

                            if (!ui.item.nums && myDQE.force_nums && myDQE.force_nums[c] && myDQE.min_bound && myDQE.max_bound && !myDQE.has_number(street)) {
                                ui.item.nums = myDQE.fill_nums(myDQE.min_bound, myDQE.max_bound);
                            }

                            //Si le numéro n'a pas été saisi ou a été saisi hors bornes,
                            //on l'affiche en autocomplete du champ rue ou du champ numéro
                            if (ui.item.nums) {
                                if (!myDQE.number && myDQE.settings.single === myDQE.settings.street) {
                                    myDQE.removeAutocomplete(myDQE.single);
                                }
                                myDQE.show_numbers_directly(ui.item.nums, ui.item.street, ui.item.type, ui.item.id);
                            }
                            else {
                                myDQE.show_complements();
                            }

                            if (myDQE.settings.single === myDQE.settings.street) {
                                myDQE.street.on("input", myDQE.reset_single_autocomplete);
                            }

                            myDQE.execute_trigger('single', ui.item);
                            return false;
                        }
                        else{
                            var single_field = "";

                            //Ajout des champs n° et rue
                            single_field += myDQE.recombine_street(ui.item.num, ui.item.type, ui.item.street);

                            //ajout du complément d'adresse
                            if(ui.item.compl) single_field += ", " + ui.item.compl;

                            //Ajout du CP
                            single_field += ", " + ui.item.zip;
                            myDQE.execute_trigger('zip', [ui.item.zip]);

                            //On remplit le champ Ville
                            myDQE.current_city_id = ui.item.city_id;
                            myDQE.current_zip = ui.item.zip;
                            myDQE.current_street_id = ui.item.id;
                            if (ui.item.num) myDQE.current_number = ui.item.num;
                            single_field += " " + ui.item.city;

                            //On ajoute la province
                            if (ui.item.prov) {
                                //On remplit le lieudit
                                single_field += ", " + ui.item.prov;
                                myDQE.execute_trigger('prov', [ui.item.prov]);
                            }

                            if (ui.item.local) {
                                myDQE.current_local = ui.item.local;
                                single_field += ", " + ui.item.local;
                                myDQE.execute_trigger('local', [ui.item.local]);
                            }

                            if (myDQE.company) {
                                var company_name = ui.item.company ? ui.item.company : "";
                                myDQE.company.val(company_name);
                                myDQE.execute_trigger('company', [company_name]);
                            }

                            if (!ui.item.nums && myDQE.force_nums && myDQE.force_nums[myDQE.selected_country()] && myDQE.min_bound && myDQE.max_bound && !myDQE.has_number(street)) {
                                ui.item.nums = myDQE.fill_nums(myDQE.min_bound, myDQE.max_bound);
                            }

                            //Si le numéro n'a pas été saisi ou a été saisi hors bornes,
                            //on l'affiche en autocomplete du champ rue ou du champ numéro
                            if (ui.item.nums) {
                                if (!myDQE.number && myDQE.settings.single === myDQE.settings.street) {
                                    myDQE.removeAutocomplete(myDQE.single);
                                }
                                myDQE.show_numbers_directly(ui.item.nums, ui.item.street, ui.item.type, ui.item.id);
                            }
                            else {
                                myDQE.show_complements();
                            }


                            if (myDQE.settings.single === myDQE.settings.street) {
                                myDQE.street.on("input", myDQE.reset_single_autocomplete);
                            }
                            myDQE.execute_trigger('single', ui.item);
                            return false;
                        }
                    },
                    focus: function(event, ui) {
                        event.preventDefault();
                    }
                }).off("click").on("click", function () {
                    var value = myDQE.single.val();
                    if ($(this).data('ui-autocomplete') && value.length > 2) $(this).autocomplete("search", value);
                });
            }
        };

        myDQE.activate_zipcity_autocomplete();
        myDQE.activate_single_autocomplete();


        //Présence d'un champ complément d'adresse ?
        myDQE.show_complements = function() {
            if (!myDQE.compl) return;

            var street_id = myDQE.current_street_id;
            var number    = myDQE.current_number ? myDQE.current_number : '';

            myDQE.removeAutocomplete(myDQE.compl);
            myDQE.compl.off("focus");
            myDQE.compl.autocomplete({
                open: function(event, ui) {
                    if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                        $('.ui-autocomplete').off('menufocus hover mouseover');
                    }
                },
                create: function() {
                    $(this).data('ui-autocomplete')._renderItem = myDQE.render_item;
                },
                delay: 150,
                source: function(request, response) {
                    if (myDQE.single && myDQE.current_compl_source && myDQE.current_compl_source.length) {
                        response(myDQE.current_compl_source);
                    }
                    else {
                        var url = myDQE.url({fn: myDQE.single ? "COMPLV2" : "COMPL", IDVoie: street_id, IDNum: number, Taille: 38, Pays: myDQE.selected_country()});
                        myDQE.ajax(url, function(data) {
                            //Le single renvoie les coordonnées depuis l'appel COMPLV2, pas l'entonnoir qui nécessite un appel séparé
                            if (!myDQE.single && myDQE.geoloc) myDQE.latlng(myDQE.geoloc);
                            if (!data) return [];
                            if (myDQE.geoloc && data["Latitude"] && data["Longitude"]) {
                                var geoloc_data = {status: 1, Latitude:  data["Latitude"], Longitude: data["Longitude"]};
                                window[myDQE.geoloc](geoloc_data);
                            }
                            var i = 1;
                            var complements = [];
                            while (data[i]) {
                                complements.push(data[i]['Batiment']);
                                i++;
                            }
                            response(complements);
                        });
                    }
                },
                minLength: 0,
                select: function(event, ui) {
                    myDQE.compl.val(ui.item.value);
                    myDQE.execute_trigger('compl', [ui.item.value]);
                }
            }).focus(function() {
                //Au focus, on affiche la liste des compléments disponibles
                if ($(this).data('ui-autocomplete')) $(this).autocomplete("search", $(this).val());
            });
            myDQE.compl.focus();
        };

        /**
         * Lance un appel RNVP sur l'addresse pour en extraire les composantes
         * @param {string} callback_function_name Fonction à appeler avec les résultats de l'analyse
         * @param {string} address Adresse
         */
        myDQE.parse = function(callback_function_name, address) {
            if (!address) {
                window[callback_function_name]({});
                return;
            }
            var url = myDQE.url({fn: "RNVP", Adresse: address, Instance: 0, Taille: myDQE.taille ? myDQE.taille : 38, Pays: 'FRA'});
            myDQE.ajax(url, function(data) {
                data = data[1];
                var response = {};
                for (var key in data) {
                    if (!data.hasOwnProperty(key)) continue;
                    if (key.substr(0, 3) === 'DQE' || key === 'Instance') continue;
                    response[key] = data[key];
                }
                window[callback_function_name](response);
            });
        };

        /**
         * Lance un contrôle RNVP sur l'addresse.
         * @param {string} callback_function_name Fonction à appeler avec les résultats de l'analyse
         * @param {object} address [facultatif] Si address n'est pas fourni, on utilisera les champs déclarés lors de l'appel à DQE address peut contenir les clés suivantes : compl (complément d'adresse), street (numéro et voie), local (lieu-dit), prov (province), zip (code postal), city (ville), country (pays)
         */
        myDQE.check = function(callback_function_name, address) {
            //On recompose l'adresse
            var compl, street, local, prov, zip, city;
            if (address) {
                compl   = address.compl   ? address.compl   : "";
                street  = address.street  ? address.street  : "";
                local   = address.local   ? address.local   : "";
                prov    = address.prov    ? address.prov    : "";
                zip     = address.zip     ? address.zip     : "";
                city    = address.city    ? address.city    : "";
                country = address.country ? address.country : myDQE.selected_country();
            }
            else {
                compl  = myDQE.compl  ? myDQE.compl.val()  : "";
                street = myDQE.street ? myDQE.street.val() : "";
                local  = myDQE.local  ? myDQE.local.val()  : "";
                prov   = myDQE.prov   ? myDQE.prov.val()   : local;
                if (myDQE.number) {
                    var num = myDQE.number.val();
                    if (num) street = myDQE.num_is_after() ? street + " " + num : num + " " + street;
                }

                zip = "";
                city = "";
                if (myDQE.zipcity) {
                    var zipcity = myDQE.zipcity.val();
                    if (myDQE.current_zip && zipcity.indexOf(myDQE.current_zip) === 0) {
                        var len = myDQE.current_zip.length;
                        zip = myDQE.current_zip;
                        city = zipcity.substr(len + 1);
                    }
                    else {
                        var p = zipcity.indexOf(" ");
                        if (p > -1) {
                            zip = zipcity.substr(0, p);
                            city = zipcity.substr(p + 1);
                        }
                    }
                }
                else {
                    zip = myDQE.zip.val();
                    city = myDQE.city.val();
                }

                var country = myDQE.selected_country();
            }

            address = compl + "|" + street + "|" + prov + "|" + zip + "|" + city;
            var url = myDQE.url({fn: "RNVP", Adresse: address, Instance: 0, Taille: myDQE.taille ? myDQE.taille : 38, Pays: country});
            myDQE.ajax(url, function(data) {
                var responses = [];
                for(var key in data){
                    if (data.hasOwnProperty(key)) {
                        var element = data[key];
                        var messages = {
                            10: "Adresse correcte",
                            20: "Adresse correcte (voie non reconnue, mais il s'agit d'un cedex ou d'une BP)",
                            21: "Petite ville, numéro de facade hors bornes",
                            22: "Petite ville, numéro de facade absent (le reste de l'adresse est correcte)",
                            23: "Grande ville, numéro de facade hors bornes",
                            24: "Grande ville, numéro de facade absent (le reste de l'adresse est correcte)",
                            25: "Si CEDEXA activé, adresse CEDEX inconnue de CEDEXA",
                            30: "Petite ville, voie non reconnue",
                            31: "Petite ville, voie non reconnue (quartier reconnu ne permettant pas de déduire la voie)",
                            40: "Petite ville, voie absente (quartier reconnu ne permettant pas de déduire la voie)",
                            41: "Petite ville, voie absente",
                            50: "Grande ville, voie non reconnue",
                            51: "Grande ville, voie non reconnue (quartier reconnu ne permettant pas de déduire la voie)",
                            60: "Grande ville, voie absente (quartier reconnu ne permettant pas de déduire la voie)",
                            61: "Grande ville, voie absente",
                            70: "CP/Ville non corrigeable (voie présente)",
                            80: "CP/Ville non corrigeable (voie absente)",
                            90: "Adresse internationale détectée"
                        };

                        var code = parseInt(element['DQECodeDetail'], 10);
                        if (isNaN(code)) code = 0;
                        var error = parseInt(element['DQECodeErreur'], 10);
                        if (isNaN(error)) error = 0;
                        var msg = code === 0 ? element['DQELibErreur'] : messages[code];

                        if (!code && !error && element['DQECodeErreur'] === 'KO') {
                            code = 90;
                            error = 1;
                        }

                        var response = {
                            'element': code,
                            'error': error,
                            'label': msg,
                            'status_iris_ilot': element['Status_IrisIlot'],
                            'iris': element['iris'],
                            'ilot': element['ilot'],
                            'lat': element['Latitude'],
                            'lng': element['Longitude']
                        };

                        if(key == 1 && myDQE.geoloc) {
                            var geoloc_data = {status: 1, Latitude:  response["lat"], Longitude: response["lng"]};
                            window[myDQE.geoloc](geoloc_data);
                        }

                        if (element['ListeNumero']) response['known_numbers'] = element['ListeNumero'];

                        //Adresse normalisée
                        var normalized = {};
                        normalized['compl']       = element['Complement'] ? element['Complement'] : '';
                        normalized['street']      = element['Adresse']    ? element['Adresse'] : '';
                        normalized['street_name'] = element['Voie']       ? element['Voie'] : '';
                        normalized['street_type'] = element['TypeVoie']   ? element['TypeVoie'] : '';
                        normalized['number']      = element['Numero']     ? element['Numero'] : '';
                        normalized['num_short']   = element['NumSeul']    ? element['NumSeul'] : '';
                        normalized['local']       = element['LieuDit']    ? element['LieuDit'] : '';
                        normalized['zip']         = element['CodePostal'] ? element['CodePostal'] : '';
                        normalized['city']        = element['Localite']   ? element['Localite'] : '';
                        response['normalized'] = normalized;

                        //Corrections apportées à l'adresse
                        if (!error) {
                            var corrections = {};
                            if (compl  !== element['Complement']) corrections['compl']  = element['Complement'];
                            if (street !== element['Adresse'])    {
                                corrections['street'] = element['Adresse'];
                                corrections['street_name'] = element['Voie'];
                                corrections['street_type'] = element['TypeVoie'];
                                corrections['number'] = element['NumSeul'];
                            }
                            if (local  !== element['LieuDit'])    corrections['local']  = element['LieuDit'];
                            if (zip    !== element['CodePostal']) corrections['zip']    = element['CodePostal'];
                            if (city   !== element['Localite'])   corrections['city']   = element['Localite'];
                            if (myDQE.count(corrections)  > 0) response['corrections'] = corrections;
                        }
                        responses.push(response);
                    }
                }
                window[callback_function_name](responses);
            });
        };

        myDQE.iptracker = function(ip, callback_function_name) {
            var ko = {status: 0, msg: 'Adresse IP non identifiée'};
            if (!ip) {
                window[callback_function_name](data);
                return;
            }
            var url = myDQE.url({fn: "CP", CodePostal: ip, Pays: 'FRA'});
            myDQE.ajax(url, function(data) {
                if (!data || !data[1]) window[callback_function_name](ko);
                data = data[1];
                if (data['Latitude'] === 0 && data['Longitude'] === 0) window[callback_function_name](ko);
                data['status'] = 1;
                window[callback_function_name](data);
            });
        };

        myDQE.url = function(data) {
            var host = myDQE.host;
            var parameters = [];
            for (var key in data) {
                if (!data.hasOwnProperty(key) || key === "fn" || key === "server") continue;
                parameters.push(key + "=" + encodeURIComponent(data[key]));
            }


            if(data.fn === 'SINGLEV2'){
                if (myDQE.lat || myDQE.lon) parameters.push("lat" + "=" + myDQE.lat + "&lon=" + myDQE.lon);
                if (myDQE.street_type && myDQE.country == 'FRA') parameters.push('Version' + '=' + '1');
            }

            if (data.fn == "RNVP") {
                parameters.push("Proposition" + "=" + encodeURIComponent("O"));
            }

            var licence = '';
            if(myDQE.oauth === 1){
                licence = myDQE.token;
            } else {
                licence = myDQE.license;
            }

            return host + data["fn"] + "/?" + parameters.join("&") + "&Licence=" + encodeURIComponent(licence);
        };


        myDQE.auth = function (client_secret) {
            var licence = myDQE.license ? myDQE.license : '';
            var token_url = "https://prod2.dqe-software.com/oauth/access_token/?client_secret=" + client_secret + "&grant_type=" + myDQE.grant_type + "&client_id=" + licence;
            myDQE.ajax(token_url, function(data) {
                myDQE.token = data.access_token;
                myDQE.refreshToken = data.refresh_token;
                myDQE.tokenTimeout = data.expires_in;
            });
        };

        if(myDQE.oauth === 1){
            myDQE.auth(myDQE.client_secret);
            setInterval(function() {
                myDQE.auth(myDQE.client_secret);
            }, myDQE.tokenTimeout);
        }

        if (myDQE.zip && !myDQE.single) {
            myDQE.zip.on("input", function() {
                if (myDQE.zip_pattern.hasOwnProperty(myDQE.selected_country())) {
                    myDQE.show_cities();
                }
            });
        }

        if (myDQE.city && myDQE.city_search && !myDQE.single) {
            //La recherche de CP depuis le champ ville s'active uniquement lorsqu'on commence à modifier le champ ville
            myDQE.city.on("input", function() {
                if (!myDQE.city_search_enabled) myDQE.search_cities();
            }).on("blur", function() {
                if (myDQE.city_search_enabled) {
                    myDQE.city_search_enabled = 0;
                    myDQE.removeAutocomplete(myDQE.city);
                }
            });
        }

        myDQE.override_events();
        return myDQE;
    };

}( jQuery ));
