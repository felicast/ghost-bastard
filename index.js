var _ = require('underscore');
var RSVP = require('rsvp');
var moment = require('moment');

var colors = [
    '0;30',
    '0;31',
    '0;32',
    '0;33',
    '0;34',
    '0;35',
    '0;36',
    '0;37',
    '1;30',
    '1;31',
    '1;32',
    '1;33',
    '1;34',
    '1;35',
    '1;36',
    '1;37',
    '4;30',
    '4;31',
    '4;32',
    '4;33',
    '4;34',
    '4;35',
    '4;36',
    '4;37'
];

var createDebug = (function (namespace) {
    var prevTime;
    var color = colors.pop();
    return function (message) {
        var curr = +new Date();
        var ms = curr - (prevTime || curr);
        prevTime = curr;

        console.log('\x1b[' + color + 'm', namespace + ':', '\x1b[0m', message, '(+' + ms + ' ms)');
    }
});


function until(check, timeout, interval, resolve, reject) {
    var start = Date.now();
    var checker = setInterval(function() {
        var diff = Date.now() - start;
        var res = check();
        //debug('checkReslut: ' + res);
        if (res) {
            clearInterval(checker);
            resolve(res);
        }
        if (diff > timeout) {
            clearInterval(checker);
            reject(res);
        }
    }, interval);
}


var GhostBastard = function (options) {
    options = options || {};
    this.page = new WebPage();
    this.options = _.defaults(options, {
        waitStartLoadTimeout: 500,
        waitTimeout: 30000,
        checkLoadInterval: 50
    });
    this.debug = createDebug(options.name || 'Ghost Bastard');
};

GhostBastard.prototype.open = function (url) {
    this.debug('open ' + url);
    var self = this;
    var args = Array.prototype.slice.call(arguments);
    return new RSVP.Promise(function (resolve, reject) {
        //push callback to arguments
        args.push(function (status) {
            if (status === 'success') {
                resolve(self);
            } else {
                resolve(reject);
            }
        });
        self.page.open.apply(self.page, args);
    });
};

GhostBastard.prototype.screenshot = function (path) {
    this.debug('screenshot ' + path);
    return this.page.render.apply(this.page, Array.prototype.slice.call(arguments));
};

GhostBastard.prototype.type = function () {
    var selector = null;
    var text = null;
    var self = this;
    if (arguments.length === 1) {
        text = arguments[0];
    } else if (arguments.length === 2) {
        selector = arguments[0];
        text = arguments[1];
    }
    return new RSVP.Promise(function (resolve) {
        var keypress = function (text) {
            self.page.sendEvent('keypress', text);
            setTimeout(function () {
                resolve(self);
            }, 0);
        };
        //don't work fix it
        if (selector) {
            self.click(selector)
                .then(function () {
                    keypress(text);
                });
        } else {
            keypress(text);
        }
    });
};

GhostBastard.prototype.click = function (xOrSelector, y) {
    var self = this;
    return new RSVP.Promise(function (resolve) {
        var x = 0;
        if (_.isString(xOrSelector)) {
            var elementPosition = self.page.evaluate(function (selector) {
                var element = document.querySelector(selector);
                if (element) {
                    var boundingClientRect = element.getBoundingClientRect();
                    return {
                        x: (boundingClientRect.left * 2 + boundingClientRect.width) / 2,
                        y: (boundingClientRect.top * 2 + boundingClientRect.height) / 2
                    };
                }
                return false;
            }, xOrSelector);
            if (elementPosition === false) {
                throw new Error('element ' + xOrSelector + ' not found');
            }
            x = Math.round(elementPosition.x);
            y = Math.round(elementPosition.y);
            self.debug('click to ' + xOrSelector + ' ' + x + ', ' + y);
        } else if (_.isObject(xOrSelector)) {
            x = xOrSelector.x;
            y = xOrSelector.y;
            self.debug('click to ' + x + ', ' + y);
        } else {
            x = xOrSelector;
            self.debug('click to ' + x + ', ' + y);
        }
        self.page.sendEvent('click', x, y);

        setTimeout(function () {
            resolve(self);
        }, 0);
    });
};

GhostBastard.prototype.clickElement = function (selector, y) {
    var self = this;
    return new RSVP.Promise(function (resolve) {
        var elementPosition = self.page.evaluate(function (selector) {
            var element = document.querySelector(selector);
            if (element) {
                var boundingClientRect = element.getBoundingClientRect();
                return {
                    x: (boundingClientRect.left * 2 + boundingClientRect.width) / 2,
                    y: (boundingClientRect.top * 2 + boundingClientRect.height) / 2
                };
            }
            return false;
        }, selector);
        if (elementPosition === false) {
            throw new Error('element ' + selector + ' not found');
        }
        x = Math.round(elementPosition.x);
        y = Math.round(elementPosition.y);
        self.debug('clickElement to ' + selector + ' ' + x + ', ' + y);
        self.page.sendEvent('click', x, y);

        resolve(self);
    });
};

GhostBastard.prototype.evaluate = function () {
    var self = this;
    self.debug('evaluate');
    var args = Array.prototype.slice.call(arguments);
    return new RSVP.Promise(function (resolve) {
        var result = self.page.evaluate.apply(self.page, args);
        setTimeout(function () {
            resolve(result);
        }, 0);
    });
};

GhostBastard.prototype.injectJs = function (fileName) {
    var self = this;
    self.debug('injectJs');
    var args = Array.prototype.slice.call(arguments);
    return new RSVP.Promise(function (resolve) {
        var result = self.page.includeJs.apply(self.page, fileName, function () {
            resolve(result);
        });
    });
};

GhostBastard.prototype.setJQDatepicker = function (selector, date) {
    var self = this;
    self.debug('.setJQDatepicker() on ' + selector + ' ' + date);
    if (!_.isDate(date)) {
        date = moment(date, 'YYYY-MM-DD').toDate();;
    }
    return new RSVP.Promise(function (resolve) {
        var result = self.page.evaluate(function (selector, fromDateTimestamp) {
            var fromDate = new Date(fromDateTimestamp);
            $(selector).datepicker("setDate", fromDate);
        }, selector, date.getTime());

        setTimeout(function () {
            resolve(result);
        }, 0);
    });
};

GhostBastard.prototype.selectOption = function (selector, value) {
    var self = this;
    self.debug('selectOption on ' + selector + ' ' + value);
    return new RSVP.Promise(function (resolve, reject) {
        var result = self.page.evaluate(function (selector, value) {
            var select = document.querySelector(selector);
            if (select) {
                select.value = value;
                var e = document.createEvent('HTMLEvents');
                e.initEvent('change', true, true);
                select.dispatchEvent(e);
                return true;
            }
            return false;
        }, selector, value);
        setTimeout(function () {
            if (result) {
                resolve(result);
            } else {
                reject(result);
            }
        }, 0);
    });
};



GhostBastard.prototype.fillInput = function (selector, value) {
    var self = this;
    self.debug('fillElement on ' + selector + ' ' + value);
    return new RSVP.Promise(function (resolve, reject) {
        var result = self.page.evaluate(function (selector, value) {
            var input = document.querySelector(selector);
            if (input) {
                input.value = value;
                var e = document.createEvent('HTMLEvents');
                e.initEvent('change', true, true);
                input.dispatchEvent(e);
                return true;
            }
            return false;
        }, selector, value);
        if (result) {
            resolve(result);
        } else {
            reject(result);
        }
    });
};

GhostBastard.prototype.wait = function (milliseconds) {
    this.debug('wait ' + milliseconds + ' ms');
    return new RSVP.Promise(function (resolve) {
        setTimeout(function () {
            resolve(self);
        }, milliseconds);
    });
};

GhostBastard.prototype.waitForLoad = function (timeout) {
    this.debug('waitForLoad');
    var self = this;
    timeout = timeout || self.options.waitTimeout;
    return new RSVP.Promise(function (resolve) {
        setTimeout(function () {
            resolve(self._waitUntil(function () {
                return self.page.evaluate(function () {
                    return document.readyState === "complete";
                });
            }, timeout, self.options.checkLoadInterval));
        }, self.options.waitStartLoadTimeout);
    });
};

GhostBastard.prototype.waitElement = function (selector, needCheckVisible, timeout) {
    this.debug('waitElement');
    var self = this;
    timeout = timeout || self.options.waitTimeout;
    needCheckVisible = !!needCheckVisible;
    return new RSVP.Promise(function (resolve) {
        resolve(self._waitUntil(function () {
            return self.page.evaluate(function (selector, needCheckVisible) {
                var element = document.querySelector(selector);
                if (element) {
                    if (needCheckVisible) {
                        return element.offsetParent !== null;
                    }
                    return true;
                }
                return false;
            }, selector, needCheckVisible);
        }, timeout, self.options.checkLoadInterval));
    });
};

GhostBastard.prototype.waitNotElement = function (selector, needCheckVisible, timeout) {
    this.debug('waitNotElement');
    var self = this;
    timeout = timeout || self.options.waitTimeout;
    needCheckVisible = !!needCheckVisible;
    return new RSVP.Promise(function (resolve) {
        resolve(self._waitUntil(function () {
            return self.page.evaluate(function (selector, needCheckVisible) {
                var element = document.querySelector(selector);
                if (element) {
                    if (needCheckVisible) {
                        return element.offsetParent === null;
                    }
                    return false;
                }
                return true;
            }, selector, needCheckVisible);
        }, timeout, self.options.checkLoadInterval));
    });
};

GhostBastard.prototype._waitUntil = function (check, timeout, interval) {
    var self = this;
    timeout = timeout || self.options.waitTimeout;
    return new RSVP.Promise(function (resolve, reject) {
        var start = Date.now();
        var checker = setInterval(function() {
            var diff = Date.now() - start;
            var res = check();
            //self.debug('checkReslut: ' + res);
            if (res) {
                clearInterval(checker);
                resolve(res);
            }
            if (diff > timeout) {
                clearInterval(checker);
                reject(res);
            }
        }, interval);
    });
};

GhostBastard.prototype.waitUntil = function (check, timeout, interval) {
    this.debug('waitUntil');
    return this._waitUntil(check, timeout, interval);
};

GhostBastard.prototype.close = function () {
    this.debug('close');
    var self = this;
    return new RSVP.Promise(function (resolve) {
        self.page.close.apply(self.page, Array.prototype.slice.call(arguments));
        setTimeout(function () {
            resolve(self);
        }, 0);
    });
};

GhostBastard.prototype.setViewport = function (w, h) {
    this.page.viewportSize = {
        width: w,
        height: h
    };
    return this;
};

GhostBastard.prototype.getContent = function () {
    return this.page.content;
};

GhostBastard.prototype.getPlainText = function () {
    return this.page.plainText;
};

GhostBastard.prototype.exists = function (selector) {
    this.debug(selector);
    return this.page.evaluate(function (selector) {
        return document.querySelector(selector) !== null;
    }, selector);
};

//GhostBastard.prototype.debug = debug;


GhostBastard.extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    if (protoProps && _.has(protoProps, 'constructor')) {
        child = protoProps.constructor;
    } else {
        child = function(){ return parent.apply(this, arguments); };
    }

    _.extend(child, parent, staticProps);

    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    if (protoProps) _.extend(child.prototype, protoProps);

    child.__super__ = parent.prototype;
    return child;
};


module.exports = GhostBastard;