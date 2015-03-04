var _ = require('underscore');
var RSVP = require('rsvp');
var moment = require('moment');


var debug = (function (namespace) {
    var prevTime;
    return function (message) {
        var curr = +new Date();
        var ms = curr - (prevTime || curr);
        prevTime = curr;

        console.log(namespace + ':', message, '(+' + ms + ' ms)');
    }
})('Ghost Bastard');


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
        waitEndLoadTimeout: 30000,
        checkLoadInterval: 50
    });
};

GhostBastard.prototype.open = function (url) {
    //todo: realize full api (method, data, settings)
    debug('open ' + url);
    var self = this;
    return new RSVP.Promise(function (resolve, reject) {
        self.page.open(url, function (status) {
            if (status === 'success') {
                resolve(self);
            } else {
                resolve(reject);
            }
        });
    });
};

GhostBastard.prototype.screenshot = function (path) {
    debug('screenshot ' + path);
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
            debug('click to ' + xOrSelector);
            var elementPosition = self.page.evaluate(function (selector) {
                var element = document.querySelector(selector);
                if (element) {
                    var boundingClientRect = element.getBoundingClientRect();
                    return {
                        x: (boundingClientRect.left * 2 + boundingClientRect.width) / 2,
                        y: (boundingClientRect.top * 2 + boundingClientRect.height) / 2
                    };
                }
                return null;
            }, xOrSelector);
            if (elementPosition === null) {
                throw new Error('element ' + xOrSelector + ' not found');
            }
            x = elementPosition.x;
            y = elementPosition.y;
        } else if (_.isObject(xOrSelector)) {
            x = xOrSelector.x;
            y = xOrSelector.y;
            debug('click to ' + x + ', ' + y);
        } else {
            x = xOrSelector;
            debug('click to ' + x + ', ' + y);
        }
        self.page.sendEvent('click', x, y);

        setTimeout(function () {
            resolve(self);
        }, 0);
    });
};

GhostBastard.prototype.evaluate = function () {
    debug('evaluate');
    var self = this;
    var args = Array.prototype.slice.call(arguments);
    return new RSVP.Promise(function (resolve) {
        var result = self.page.evaluate.apply(self.page, args);
        setTimeout(function () {
            resolve(result);
        }, 0);
    });
};

GhostBastard.prototype.injectJs = function (fileName) {
    debug('injectJs');
    var self = this;
    var args = Array.prototype.slice.call(arguments);
    return new RSVP.Promise(function (resolve) {
        var result = self.page.includeJs.apply(self.page, fileName, function () {
            resolve(result);
        });
    });
};

GhostBastard.prototype.setJQDatepicker = function (selector, date) {
    debug('.setJQDatepicker() on ' + selector + ' ' + date);
    if (!_.isDate(date)) {
        date = moment(date, 'YYYY-MM-DD').toDate();;
    }
    var self = this;
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

GhostBastard.prototype.wait = function (milliseconds) {
    debug('wait ' + milliseconds + ' ms');
    return new RSVP.Promise(function (resolve) {
        setTimeout(function () {
            resolve(self);
        }, milliseconds);
    });
};

GhostBastard.prototype.waitForLoad = function (timeout) {
    //debug('waitForLoad');
    //var self = this;
    //timeout = timeout || self.options.waitEndLoadTimeout;
    //return new RSVP.Promise(function (resolve, reject) {
    //    setTimeout(function () {
    //        until(function () {
    //            return self.page.evaluate(function () {
    //                return document.readyState === "complete";
    //            });
    //        }, timeout, self.options.checkLoadInterval, resolve, reject);
    //    }, self.options.waitStartLoadTimeout);
    //});
    debug('waitForLoad');
    var self = this;
    timeout = timeout || self.options.waitEndLoadTimeout;
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

GhostBastard.prototype._waitUntil = function (check, timeout, interval) {
    var self = this;
    timeout = timeout || self.options.waitEndLoadTimeout;
    return new RSVP.Promise(function (resolve, reject) {
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
    });
};

GhostBastard.prototype.waitUntil = function (check, timeout, interval) {
    debug('waitUntil');
    return this._waitUntil(check, timeout, interval);
};

GhostBastard.prototype.close = function () {
    debug('close');
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

GhostBastard.prototype.exists = function (selector) {
    debug(selector);
    return this.page.evaluate(function (selector) {
        return document.querySelector(selector) !== null;
    }, selector);
};

GhostBastard.prototype.debug = debug;


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