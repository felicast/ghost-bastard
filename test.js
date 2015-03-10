var GhostBastard = require('./index.js');

var ghostBastard = new GhostBastard({name: 'hello'});

ghostBastard.open('http://felicast.github.io/ghost-bastard/test.html')
    .then(function () {
        ghostBastard.debug(ghostBastard.exists('[name="text_input"]'));
    })
    .then(function () {
        return ghostBastard.clickElement('[name="text_input"]');
    })
    .then(function () {
        return ghostBastard.type('hello');
    })
    .then(function () {
        return ghostBastard.waitElement('#invisibleElement', false);
    })
    .then(function () {
        return ghostBastard.clickElement('#alertBtn');
    })
    .then(function () {
        return ghostBastard.clickElement('#select');
    })
    .then(function () {
        return ghostBastard.fillInput('select', 'o2');
    })
    .then(function () {
        return ghostBastard.wait(1000);
    })
    .catch(function () {
        console.log('error');
    })
    .finally(function () {
        console.log('end');
        ghostBastard.screenshot('tmp/test.png');
        ghostBastard.close();
        phantom.exit();
    });