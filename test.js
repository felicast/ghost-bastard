var GhostBastard = require('./index.js');

var ghostBastard = new GhostBastard();

ghostBastard.open('http://felicast.github.io/ghost-bastard/test.html')
    .then(function () {
        ghostBastard.debug(ghostBastard.exists('[name="text_input"]'));
    })
    .then(function () {
        return ghostBastard.waitElement('#invisibledElement', false);
    })
    .finally(function () {
        ghostBastard.close();
        phantom.exit();
    });