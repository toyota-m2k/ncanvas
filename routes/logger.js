'use strict';

// 使い方
//
//  var logger = require('../util/logger')(category);
// のように logger を取得して
//  logger.warn(message);
// のようにログを出力する。
//
// category はそれぞれで適当に決める。
// フィルタするときに category ごとにまとめて設定する。

var COLOR_BLACK     = '\x1b[30m';
var COLOR_RED       = '\x1b[31m';
var COLOR_GREEN     = '\x1b[32m';
var COLOR_YELLOW    = '\x1b[33m';
var COLOR_BLUE      = '\x1b[34m';
var COLOR_MAGENTA   = '\x1b[35m';
var COLOR_CYAN      = '\x1b[36m';
var COLOR_WHITE     = '\x1b[37m';
var COLOR_DEFAULT   = '\x1b[39m';

var warnColor = COLOR_YELLOW;
var errColor = COLOR_RED;

var loggerMap = {};
var nullLogger = new NullLogger();

// ここでいらないものに nullLogger を指定すればフィルタアウトできる
//loggerMap[name] = nullLogger;

module.exports = function(name) {
    name = name || 'default';
    var logger = loggerMap[name];
    if (!logger) {
        logger = new Logger(name);
        loggerMap[name] = logger;
    }
    return logger;
};

module.exports.filter = function(name) {
    loggerMap[name] = nullLogger;
};

// Logger

function Logger(name)
{
    this.name = name;
}

Logger.prototype.info = function() {
    console.log.apply(console, arguments);
};

Logger.prototype.warn = function() {
    arguments[0] = warnColor + arguments[0] + COLOR_DEFAULT;
    console.log.apply(console, arguments);
};

Logger.prototype.err = function() {
    arguments[0] = errColor + arguments[0] + COLOR_DEFAULT;
    console.log.apply(console, arguments);
};

Logger.prototype.stack = function(e, msg) {
    if (msg) {
        this.err(msg);
    }
    if (e.stack) {
        this.err(e.stack);   // e.stack は e.message も出力する
    } else if(e.message) {
        this.err(e.message);
    } else {
        this.err(e);
    }
};

// NullLogger

function NullLogger() {}
NullLogger.prototype.info = function() {};
NullLogger.prototype.warn = function() {};
NullLogger.prototype.err = function() {};
NullLogger.prototype.stack = function() {};
