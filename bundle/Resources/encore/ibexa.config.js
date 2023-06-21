const path = require('path');

module.exports = (Encore) => {
    Encore.addEntry('formio-style', [path.resolve(__dirname, '../public/css/formio_dqe.css')])
    .addEntry('formio-dqe', [path.resolve(__dirname, `../public/js/dqe.js`)])
    .addEntry('formio', [path.resolve(__dirname, `../public/js/formio.js`)]);
};


