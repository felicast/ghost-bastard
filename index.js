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
        waitTimeout: 30000,
        checkLoadInterval: 50
    });
};

GhostBastard.prototype.open = function (url) {
    debug('open ' + url);
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
            debug('click to ' + xOrSelector + ' ' + x + ', ' + y);
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
        debug('clickElement to ' + selector + ' ' + x + ', ' + y);
        self.page.sendEvent('click', x, y);

        resolve(self);
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

GhostBastard.prototype.selectOption = function (selector, value) {
    debug('selectOption on ' + selector + ' ' + value);
    var self = this;
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
    debug('fillElement on ' + selector + ' ' + value);
    var self = this;
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
    debug('wait ' + milliseconds + ' ms');
    return new RSVP.Promise(function (resolve) {
        setTimeout(function () {
            resolve(self);
        }, milliseconds);
    });
};

GhostBastard.prototype.waitForLoad = function (timeout) {
    debug('waitForLoad');
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
    debug('waitElement');
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
    debug('waitNotElement');
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
                    return true;
                }
                return false;
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