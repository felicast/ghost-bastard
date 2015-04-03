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

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

var Logger = function (gb) {
    this.gb = gb;
    this.debugColor = colors[_.random(colors.length - 1)];
    this.prevTime = null;
};

Logger.prototype.log = function (message) {
    var curr = +new Date();
    var ms = curr - (this.prevTime || curr);
    this.prevTime = curr;

    console.log('\x1b[' + this.debugColor + 'm', this.gb.name + ':', '\x1b[0m', message, '(+' + ms + ' ms)');
};
Logger.prototype.error = function (message) {
    this.log(message);
};
Logger.prototype.debug = function (message) {
    console.log('\x1b[' + this.debugColor + 'm', this.gb.name + ':', '\x1b[0m', message);
};

var getPromisesCount = function (promise) {
    var result = 0;
    if (promise instanceof RSVP.Promise) {
        result += 1;
        promise._subscribers.forEach(function (subscriber) {
            result += getPromisesCount(subscriber);
        });
    }
    return result;
};

var GhostBastard = function (options) {
    this.page = new WebPage();
    this.options = _.defaults(options, {
        waitStartLoadTimeout: 500,
        waitTimeout: 60000,
        checkLoadInterval: 50,
        debug: false
    });
    this.logger = new Logger(this);

    if (this.initialize) {
        this.initialize.apply(this, Array.prototype.slice.call(arguments));
    }
    this.startedCount = 0;
    this.endedCount = 0;
    this.debugScreenshotCounter = 0;
    this.isDebug = this.options.debug;
    this.name = this.name || 'Ghost Bastard';
    //this.debug = createDebug(this.name);

    this.page.onError = function(msg, trace) {
        var msgStack = ['ERROR: ' + msg];
        if (trace && trace.length) {
            msgStack.push('TRACE:');
            trace.forEach(function(t) {
                msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
            });
        }
        console.error(msgStack.join('\n'));
    };
};

GhostBastard.prototype.getProgress = function () {
    if (this.startedCount === 0) {
        return 0;
    }
    return 1.0 - (this.startedCount - this.endedCount) / this.startedCount;
};

GhostBastard.prototype.promise = function (message, cb) {
    var self = this;
    this.logger.log('start ' + message);
    this.startedCount++;
    return (new RSVP.Promise(cb)).then(function (result) {
        self.logger.log('end ' + message);
        self.debugRender();
        self.endedCount++;
        return result;
    });
};

GhostBastard.prototype.open = function (url) {
    var self = this;
    var args = Array.prototype.slice.call(arguments);

    return this.promise('open ' + url, function (resolve, reject) {
        //push callback to arguments
        args.push(function (status) {
            if (status === 'success') {
                resolve(self);
            } else {
                resolve(reject);
            }
        });
        return self.page.open.apply(self.page, args);
    });
};

GhostBastard.prototype.type = function (text) {
    var self = this;
    return this.promise('type "'+ text + '"', function (resolve) {
        self.page.sendEvent('keypress', text);
        resolve(self);
    });
};

/**
 * @deprecated use GhostBastard.clickTo or GhostBastard.clickElement
 * @param xOrSelector
 * @param y
 * @returns {*}
 */
GhostBastard.prototype.click = function (xOrSelector, y) {
    if (_.isString(xOrSelector)) {
        return this.clickElement(xOrSelector);
    } else if (_.isObject(xOrSelector)) {
        return this.clickTo(xOrSelector.x, xOrSelector.y);
    } else {
        return this.clickTo(xOrSelector,y);
    }
};

GhostBastard.prototype.clickTo = function (x, y) {
    var self = this;
    return this.promise('clickTo ' + x + ', ' + y, function (resolve) {
        self.page.sendEvent('click', x, y);
        resolve(self);
    });
};

GhostBastard.prototype.clickElement = function (selector) {
    var self = this;
    return this.promise('clickElement to ' + selector, function (resolve) {
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
        assert(elementPosition, 'element ' + selector + ' not found');
        var x = Math.round(elementPosition.x);
        var y = Math.round(elementPosition.y);
        self.logger.log(x + ' ' + y);
        self.page.sendEvent('click', x, y);

        resolve(self);
    });
};

GhostBastard.prototype.evaluate = function () {
    var self = this;
    var args = Array.prototype.slice.call(arguments);
    return this.promise('evaluate ' + arguments[0].name, function (resolve) {
        var result = self.page.evaluate.apply(self.page, args);
        resolve(result);
    });
};

GhostBastard.prototype.injectJs = function (fileName) {
    var self = this;
    return this.promise('injectJs ' + fileName, function (resolve) {
        var result = self.page.includeJs.apply(self.page, fileName, function () {
            resolve(result);
        });
    });
};

GhostBastard.prototype.setJQDatepicker = function (selector, date) {
    var self = this;
    if (!_.isDate(date)) {
        date = moment(date, 'YYYY-MM-DD').toDate();
    }
    return this.promise('setJQDatepicker on ' + selector + ' ' + date, function (resolve) {
        var result = self.page.evaluate(function (selector, fromDateTimestamp) {
            var fromDate = new Date(fromDateTimestamp);
            if ($(selector).length === 0) {
                return false;
            }
            $(selector).datepicker("setDate", fromDate);
            return true;
        }, selector, date.getTime());
        assert(result, 'Can not find element ' + selector);
        resolve(result);
    });
};

/**
 * @deprecated use GhostBastard.fillInput
 * @param selector
 * @param value
 * @returns {RSVP.Promise}
 */
GhostBastard.prototype.selectOption = function (selector, value) {
    var self = this;

    return this.promise('selectOption on ' + selector + ' ' + value, function (resolve, reject) {
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
        if (result) {
            resolve(result);
        } else {
            reject(result);
        }
    });
};


GhostBastard.prototype.fillInput = function (selector, value) {
    var self = this;

    return this.promise('fillElement on ' + selector + ' ' + value, function (resolve, reject) {
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
    var self = this;
    return this.promise('wait ' + milliseconds + ' ms', function (resolve) {
        setTimeout(function () {
            resolve(self);
        }, milliseconds);
    });
};

GhostBastard.prototype.waitForLoad = function (timeout) {
    var self = this;
    timeout = timeout || self.options.waitTimeout;
    return self._waitUntil('waitForLoad', function () {
        return self.page.evaluate(function () {
            return document.readyState === "complete";
        });
    }, timeout, self.options.checkLoadInterval);
};

GhostBastard.prototype.waitElement = function (selector, needCheckVisible, timeout) {
    var self = this;
    timeout = timeout || self.options.waitTimeout;
    needCheckVisible = !!needCheckVisible;
    return self._waitUntil('waitElement ' + selector, function () {
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
    }, timeout, self.options.checkLoadInterval);
};

GhostBastard.prototype.waitNotElement = function (selector, needCheckVisible, timeout) {
    var self = this;
    timeout = timeout || self.options.waitTimeout;
    needCheckVisible = !!needCheckVisible;
    return self._waitUntil('waitNotElement ' + selector, function () {
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
    }, timeout, self.options.checkLoadInterval);
};

GhostBastard.prototype.waitUntil = function (check, timeout, interval) {
    return this._waitUntil('waitUntil ' + check.name, check, timeout, interval);
};

GhostBastard.prototype._waitUntil = function (message, check, timeout, interval) {
    var self = this;
    timeout = timeout || self.options.waitTimeout;
    return this.promise(message, function (resolve, reject) {
        var start = Date.now();
        var checker = setInterval(function() {
            var diff = Date.now() - start;
            var res = check();
            //self.logger.log('checkReslut: ' + res);
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

GhostBastard.prototype.close = function () {
    var self = this;
    return this.promise('close', function (resolve) {
        self.page.close.apply(self.page, Array.prototype.slice.call(arguments));
        resolve(self);
    });
};

GhostBastard.prototype.debug = function () {
    this.logger.log.apply(this.logger, Array.prototype.slice.call(arguments));
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
    this.logger.log(selector);
    return this.page.evaluate(function (selector) {
        return document.querySelector(selector) !== null;
    }, selector);
};

GhostBastard.prototype.screenshot = function (path) {
    this.logger.log('screenshot ' + path);
    return this.page.render.apply(this.page, Array.prototype.slice.call(arguments));
};

GhostBastard.prototype.debugRender = function () {
    if (this.isDebug) {
        this.page.render('tmp/' + this.name + '-' + this.debugScreenshotCounter + '.png');
        ++this.debugScreenshotCounter;
    }
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
