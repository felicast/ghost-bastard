var GhostBastard = require('./index.js');

var ghostBastard = new GhostBastard();

ghostBastard.open('http://felicast.github.io/ghost-bastard/test.html')
    .then(function () {
        ghostBastard.debug(ghostBastard.exists('[name="text_input"]'));
    })
    .then(function () {
        return ghostBastard.click('[name="text_input"]');
    })
    .then(function () {
        return ghostBastard.type('hello');
    })
    .then(function () {
        return ghostBastard.waitElement('#invisibleElement', false);
    })
    .then(function () {
        return ghostBastard.click('#alertBtn');
    })
    .then(function () {
        return ghostBastard.click('#select');
    })
    .then(function () {
        return ghostBastard.selectOption('select', 'o2');
    })
    .then(function () {
        return ghostBastard.wait(1000);
    })
    .finally(function () {
        ghostBastard.screenshot('test.png')
        ghostBastard.close();
        phantom.exit();
    });