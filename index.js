
const express = require('express');
const expressApp = express();

const port = grabProcessArgumentValue(process.argv, '--port') || process.env.PORT || 5000;
const httpServer = expressApp.listen(port, () => {
    console.log(__dirname); // eslint-disable-line no-console
    console.log('Listening Port ' + port); // eslint-disable-line no-console
});

expressApp.use(function(req, res, next) {
    if (req.header('x-forwarded-proto') === 'http') {
        res.redirect(301, 'https://' + req.headers.host + req.url);
        return;
    }
    next();
});

mainApp.start();

expressApp.use(express.static(__dirname + '/build'));

expressApp.get('/*', (req, res) => {
    res.sendFile('index.html', { root: __dirname + '/build' });
});
