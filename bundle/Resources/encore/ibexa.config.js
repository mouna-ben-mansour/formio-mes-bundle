const path = require('path');

module.exports = (Encore) => {
    Encore
    .addEntry('formio-style', [
        path.resolve(__dirname, './public/bundles/formio/css/formio_dqe.css'),
    ])
    .addEntry('formio-dqe', [
        path.resolve(__dirname, `./public/bundles/formio/js/dqe.js`)
    ])
    .addEntry('formio', [
        path.resolve(__dirname, `./public/bundles/formio/js/formio.js`)
    ])
    /**
     * Options
     */
    .configureCssLoader(options => { options.url = false })
};


