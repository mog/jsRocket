var JSRocket = {};
/*
 * from noVNC: HTML5 VNC client
 * Copyright (C) 2012 Joel Martin
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 */
(function () {

    "use strict";

    JSRocket.Util = {};

    /*
     * Make arrays quack
     */

    Array.prototype.push8 = function (num) {
        this.push(num & 0xFF);
    };

    Array.prototype.push16 = function (num) {
        this.push((num >> 8) & 0xFF,
            (num     ) & 0xFF);
    };
    Array.prototype.push32 = function (num) {
        this.push((num >> 24) & 0xFF,
            (num >> 16) & 0xFF,
            (num >> 8) & 0xFF,
            (num      ) & 0xFF);
    };

    // IE does not support map (even in IE9)
    //This prototype is provided by the Mozilla foundation and
    //is distributed under the MIT license.
    //http://www.ibiblio.org/pub/Linux/LICENSES/mit.license
    if (!Array.prototype.map) {
        Array.prototype.map = function (fun /*, thisp*/) {
            var len = this.length;
            if (typeof fun !== "function") {
                throw new TypeError();
            }

            var res = new Array(len);
            var thisp = arguments[1];
            for (var i = 0; i < len; i++) {
                if (i in this) {
                    res[i] = fun.call(thisp, this[i], i, this);
                }
            }

            return res;
        };
    }

    //
    // requestAnimationFrame shim with setTimeout fallback
    //

    window.requestAnimFrame = (function () {
        return  window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();

    /*
     * ------------------------------------------------------
     * Namespaced in JSRocket.Util
     * ------------------------------------------------------
     */

    /*
     * Logging/debug routines
     */

    JSRocket.Util._log_level = 'warn';
    JSRocket.Util.init_logging = function (level) {
        if (typeof level === 'undefined') {
            level = JSRocket.Util._log_level;
        } else {
            JSRocket.Util._log_level = level;
        }
        if (typeof window.console === "undefined") {
            if (typeof window.opera !== "undefined") {
                window.console = {
                    'log'  :window.opera.postError,
                    'warn' :window.opera.postError,
                    'error':window.opera.postError };
            } else {
                window.console = {
                    'log'  :function (m) {
                    },
                    'warn' :function (m) {
                    },
                    'error':function (m) {
                    }};
            }
        }

        JSRocket.Util.Debug = JSRocket.Util.Info = JSRocket.Util.Warn = JSRocket.Util.Error = function (msg) {
        };
        switch (level) {
            case 'debug':
                JSRocket.Util.Debug = function (msg) {
                    console.log(msg);
                };
                break;
            case 'info':
                JSRocket.Util.Info = function (msg) {
                    console.log(msg);
                };
                break;
            case 'warn':
                JSRocket.Util.Warn = function (msg) {
                    console.warn(msg);
                };
                break;
            case 'error':
                JSRocket.Util.Error = function (msg) {
                    console.error(msg);
                };
                break;
            case 'none':
                break;
            default:
                throw("invalid logging type '" + level + "'");
        }
    };
    JSRocket.Util.get_logging = function () {
        return JSRocket.Util._log_level;
    };
    // Initialize logging level
    JSRocket.Util.init_logging();

    // Set configuration default for Crockford style function namespaces
    JSRocket.Util.conf_default = function (cfg, api, defaults, v, mode, type, defval, desc) {
        var getter, setter;

        // Default getter function
        getter = function (idx) {
            if ((type in {'arr':1, 'array':1}) &&
                (typeof idx !== 'undefined')) {
                return cfg[v][idx];
            } else {
                return cfg[v];
            }
        };

        // Default setter function
        setter = function (val, idx) {
            if (type in {'boolean':1, 'bool':1}) {
                if ((!val) || (val in {'0':1, 'no':1, 'false':1})) {
                    val = false;
                } else {
                    val = true;
                }
            } else if (type in {'integer':1, 'int':1}) {
                val = parseInt(val, 10);
            } else if (type === 'str') {
                val = String(val);
            } else if (type === 'func') {
                if (!val) {
                    val = function () {
                    };
                }
            }
            if (typeof idx !== 'undefined') {
                cfg[v][idx] = val;
            } else {
                cfg[v] = val;
            }
        };

        // Set the description
        api[v + '_description'] = desc;

        // Set the getter function
        if (typeof api['get_' + v] === 'undefined') {
            api['get_' + v] = getter;
        }

        // Set the setter function with extra sanity checks
        if (typeof api['set_' + v] === 'undefined') {
            api['set_' + v] = function (val, idx) {
                if (mode in {'RO':1, 'ro':1}) {
                    throw(v + " is read-only");
                } else if ((mode in {'WO':1, 'wo':1}) &&
                    (typeof cfg[v] !== 'undefined')) {
                    throw(v + " can only be set once");
                }
                setter(val, idx);
            };
        }

        // Set the default value
        if (typeof defaults[v] !== 'undefined') {
            defval = defaults[v];
        } else if ((type in {'arr':1, 'array':1}) &&
            (!(defval instanceof Array))) {
            defval = [];
        }
        // Coerce existing setting to the right type
        //JSRocket.Util.Debug("v: " + v + ", defval: " + defval + ", defaults[v]: " + defaults[v]);
        setter(defval);
    };

    // Set group of configuration defaults
    JSRocket.Util.conf_defaults = function (cfg, api, defaults, arr) {
        var i;
        for (i = 0; i < arr.length; i++) {
            JSRocket.Util.conf_default(cfg, api, defaults, arr[i][0], arr[i][1],
                arr[i][2], arr[i][3], arr[i][4]);
        }
    };

    /*
     * Cross-browser routines
     */

    // Get DOM element position on page
    JSRocket.Util.getPosition = function (obj) {
        var x = 0, y = 0;
        if (obj.offsetParent) {
            do {
                x += obj.offsetLeft;
                y += obj.offsetTop;
                obj = obj.offsetParent;
            } while (obj);
        }
        return {'x':x, 'y':y};
    };

    // Get mouse event position in DOM element
    JSRocket.Util.getEventPosition = function (e, obj, scale) {
        var evt, docX, docY, pos;
        //if (!e) evt = window.event;
        evt = (e ? e : window.event);
        evt = (evt.changedTouches ? evt.changedTouches[0] : evt.touches ? evt.touches[0] : evt);
        if (evt.pageX || evt.pageY) {
            docX = evt.pageX;
            docY = evt.pageY;
        } else if (evt.clientX || evt.clientY) {
            docX = evt.clientX + document.body.scrollLeft +
                document.documentElement.scrollLeft;
            docY = evt.clientY + document.body.scrollTop +
                document.documentElement.scrollTop;
        }
        pos = JSRocket.Util.getPosition(obj);
        if (typeof scale === "undefined") {
            scale = 1;
        }
        return {'x':(docX - pos.x) / scale, 'y':(docY - pos.y) / scale};
    };

    // Event registration. Based on: http://www.scottandrew.com/weblog/articles/cbs-events
    JSRocket.Util.addEvent = function (obj, evType, fn) {
        if (obj.attachEvent) {
            var r = obj.attachEvent("on" + evType, fn);
            return r;
        } else if (obj.addEventListener) {
            obj.addEventListener(evType, fn, false);
            return true;
        } else {
            throw("Handler could not be attached");
        }
    };

    JSRocket.Util.removeEvent = function (obj, evType, fn) {
        if (obj.detachEvent) {
            var r = obj.detachEvent("on" + evType, fn);
            return r;
        } else if (obj.removeEventListener) {
            obj.removeEventListener(evType, fn, false);
            return true;
        } else {
            throw("Handler could not be removed");
        }
    };

    JSRocket.Util.stopEvent = function (e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        else {
            e.cancelBubble = true;
        }

        if (e.preventDefault) {
            e.preventDefault();
        }
        else {
            e.returnValue = false;
        }
    };

    // Set browser engine versions. Based on mootools.
    JSRocket.Util.Features = {xpath:!!(document.evaluate), air:!!(window.runtime), query:!!(document.querySelector)};

    JSRocket.Util.Engine = {
        // Version detection break in Opera 11.60 (errors on arguments.callee.caller reference)
        //'presto': (function() {
        //         return (!window.opera) ? false : ((arguments.callee.caller) ? 960 : ((document.getElementsByClassName) ? 950 : 925)); }()),
        'presto':(function () {
            return (!window.opera) ? false : true;
        }()),

        'trident':(function () {
            return (!window.ActiveXObject) ? false : ((window.XMLHttpRequest) ? ((document.querySelectorAll) ? 6 : 5) : 4);
        }()),
        'webkit' :(function () {
            try {
                return (navigator.taintEnabled) ? false : ((JSRocket.Util.Features.xpath) ? ((JSRocket.Util.Features.query) ? 525 : 420) : 419);
            } catch (e) {
                return false;
            }
        }()),
        //'webkit': (function() {
        //        return ((typeof navigator.taintEnabled !== "unknown") && navigator.taintEnabled) ? false : ((JSRocket.Util.Features.xpath) ? ((JSRocket.Util.Features.query) ? 525 : 420) : 419); }()),
        'gecko'  :(function () {
            return (!document.getBoxObjectFor &&
                window.mozInnerScreenX == null) ? false : ((document.getElementsByClassName) ? 19 : 18);
        }())
    };
    if (JSRocket.Util.Engine.webkit) {
        // Extract actual webkit version if available
        JSRocket.Util.Engine.webkit = (function (v) {
            var re = new RegExp('WebKit/([0-9\\.]*) ');
            v = (navigator.userAgent.match(re) || ['', v])[1];
            return parseFloat(v, 10);
        })(JSRocket.Util.Engine.webkit);
    }

    JSRocket.Util.Flash = (function () {
        var v, version;
        try {
            v = navigator.plugins['Shockwave Flash'].description;
        } catch (err1) {
            try {
                v = new ActiveXObject('ShockwaveFlash.ShockwaveFlash').GetVariable('$version');
            } catch (err2) {
                v = '0 r0';
            }
        }
        version = v.match(/\d+/g);
        return {version:parseInt(version[0] || 0 + '.' + version[1], 10) || 0, build:parseInt(version[2], 10) || 0};
    }());
}());
/*
 * Websock: high-performance binary WebSockets
 * Copyright (C) 2012 Joel Martin
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * Websock is similar to the standard WebSocket object but Websock
 * enables communication with raw TCP sockets (i.e. the binary stream)
 * via websockify. This is accomplished by base64 encoding the data
 * stream between Websock and websockify.
 *
 * Websock has built-in receive queue buffering; the message event
 * does not contain actual data but is simply a notification that
 * there is new data available. Several rQ* methods are available to
 * read binary data off of the receive queue.
 */

// Load Flash WebSocket emulator if needed

// To force WebSocket emulator even when native WebSocket available
//window.WEB_SOCKET_FORCE_FLASH = true;
// To enable WebSocket emulator debug:
//window.WEB_SOCKET_DEBUG=1;

if (window.WebSocket && !window.WEB_SOCKET_FORCE_FLASH) {
    Websock_native = true;
} else if (window.MozWebSocket && !window.WEB_SOCKET_FORCE_FLASH) {
    Websock_native = true;
    window.WebSocket = window.MozWebSocket;
}

function Websock() {
"use strict";

var api = {},         // Public API
    websocket = null, // WebSocket object
    mode = 'base64',  // Current WebSocket mode: 'binary', 'base64'
    rQ = [],          // Receive queue
    rQi = 0,          // Receive queue index
    rQmax = 10000,    // Max receive queue size before compacting
    sQ = [],          // Send queue

    eventHandlers = {
        'message' : function() {},
        'open'    : function() {},
        'close'   : function() {},
        'error'   : function() {}
    },
	Util = JSRocket.Util,
    test_mode = false;


//
// Queue public functions
//

function get_sQ() {
    return sQ;
}

function get_rQ() {
    return rQ;
}
function get_rQi() {
    return rQi;
}
function set_rQi(val) {
    rQi = val;
}

function rQlen() {
    return rQ.length - rQi;
}

function rQpeek8() {
    return (rQ[rQi]      );
}
function rQshift8() {
    return (rQ[rQi++]      );
}
function rQunshift8(num) {
    if (rQi === 0) {
        rQ.unshift(num);
    } else {
        rQi -= 1;
        rQ[rQi] = num;
    }

}
function rQshift16() {
    return (rQ[rQi++] <<  8) +
           (rQ[rQi++]      );
}
function rQshift32() {
    return (rQ[rQi++] << 24) +
           (rQ[rQi++] << 16) +
           (rQ[rQi++] <<  8) +
           (rQ[rQi++]      );
}
function rQshiftStr(len) {
    if (typeof(len) === 'undefined') { len = rQlen(); }
    var arr = rQ.slice(rQi, rQi + len);
    rQi += len;
    return String.fromCharCode.apply(null, arr);
}
function rQshiftBytes(len) {
    if (typeof(len) === 'undefined') { len = rQlen(); }
    rQi += len;
    return rQ.slice(rQi-len, rQi);
}

function rQslice(start, end) {
    if (end) {
        return rQ.slice(rQi + start, rQi + end);
    } else {
        return rQ.slice(rQi + start);
    }
}

// Check to see if we must wait for 'num' bytes (default to FBU.bytes)
// to be available in the receive queue. Return true if we need to
// wait (and possibly print a debug message), otherwise false.
function rQwait(msg, num, goback) {
    var rQlen = rQ.length - rQi; // Skip rQlen() function call
    if (rQlen < num) {
        if (goback) {
            if (rQi < goback) {
                throw("rQwait cannot backup " + goback + " bytes");
            }
            rQi -= goback;
        }
        //Util.Debug("   waiting for " + (num-rQlen) +
        //           " " + msg + " byte(s)");
        return true;  // true means need more data
    }
    return false;
}

//
// Private utility routines
//

function encode_message() {
    if (mode === 'binary') {
        // Put in a binary arraybuffer
        return (new Uint8Array(sQ)).buffer;
    } else {
        // base64 encode
        return Base64.encode(sQ);
    }
}

function decode_message(data) {
    //Util.Debug(">> decode_message: " + data);
    if (mode === 'binary') {
        // push arraybuffer values onto the end
        rQ.push.apply(rQ, (new Uint8Array(data)));
    } else {
        // base64 decode and concat to the end
        rQ = rQ.concat(Base64.decode(data, 0));
    }
    //Util.Debug(">> decode_message, rQ: " + rQ);
}


//
// Public Send functions
//

function flush() {
    if (websocket.bufferedAmount !== 0) {
        Util.Debug("bufferedAmount: " + websocket.bufferedAmount);
    }
    if (websocket.bufferedAmount < api.maxBufferedAmount) {
        //Util.Debug("arr: " + arr);
        //Util.Debug("sQ: " + sQ);
        if (sQ.length > 0) {
            websocket.send(encode_message(sQ));
            sQ = [];
        }
        return true;
    } else {
        Util.Info("Delaying send, bufferedAmount: " +
                websocket.bufferedAmount);
        return false;
    }
}

// overridable for testing
function send(arr) {
    //Util.Debug(">> send_array: " + arr);
    sQ = sQ.concat(arr);
    return flush();
}

function send_string(str) {
    //Util.Debug(">> send_string: " + str);
    api.send(str.split('').map(
        function (chr) { return chr.charCodeAt(0); } ) );
}

//
// Other public functions

function recv_message(e) {
    //Util.Debug(">> recv_message: " + e.data.length);

    try {
        decode_message(e.data);
        if (rQlen() > 0) {
            eventHandlers.message();
            // Compact the receive queue
            if (rQ.length > rQmax) {
                //Util.Debug("Compacting receive queue");
                rQ = rQ.slice(rQi);
                rQi = 0;
            }
        } else {
            Util.Debug("Ignoring empty message");
        }
    } catch (exc) {
        if (typeof exc.stack !== 'undefined') {
            Util.Warn("recv_message, caught exception: " + exc.stack);
        } else if (typeof exc.description !== 'undefined') {
            Util.Warn("recv_message, caught exception: " + exc.description);
        } else {
            Util.Warn("recv_message, caught exception:" + exc);
        }
        if (typeof exc.name !== 'undefined') {
            eventHandlers.error(exc.name + ": " + exc.message);
        } else {
            eventHandlers.error(exc);
        }
    }
    //Util.Debug("<< recv_message");
}


// Set event handlers
function on(evt, handler) { 
    eventHandlers[evt] = handler;
}

function init(protocols) {
    rQ         = [];
    rQi        = 0;
    sQ         = [];
    websocket  = null;

    var bt = false,
        wsbt = false,
        try_binary = false;

    // Check for full typed array support
    if (('Uint8Array' in window) &&
        ('set' in Uint8Array.prototype)) {
        bt = true;
    }

    // Check for full binary type support in WebSockets
    // TODO: this sucks, the property should exist on the prototype
    // but it does not.
    try {
        if (bt && ('binaryType' in (new WebSocket("ws://localhost:17523")))) {
            Util.Info("Detected binaryType support in WebSockets");
            wsbt = true;
        }
    } catch (exc) {
        // Just ignore failed test localhost connections
    }

    // Default protocols if not specified
    if (typeof(protocols) === "undefined") {
        if (wsbt) {
            protocols = ['binary', 'base64'];
        } else {
            protocols = 'base64';
        }
    }

    // If no binary support, make sure it was not requested
    if (!wsbt) {
        if (protocols === 'binary') {
            throw("WebSocket binary sub-protocol requested but not supported");
        }
        if (typeof(protocols) === "object") {
            var new_protocols = [];
            for (var i = 0; i < protocols.length; i++) {
                if (protocols[i] === 'binary') {
                    Util.Error("Skipping unsupported WebSocket binary sub-protocol");
                } else {
                    new_protocols.push(protocols[i]);
                }
            }
            if (new_protocols.length > 0) {
                protocols = new_protocols;
            } else {
                throw("Only WebSocket binary sub-protocol was requested and not supported.");
            }
        }
    }

    return protocols;
}

function open(uri, protocols) {
    protocols = init(protocols);

    if (test_mode) {
        websocket = {};
    } else {
        websocket = new WebSocket(uri, protocols);
    }

    websocket.onmessage = recv_message;
    websocket.onopen = function() {
        Util.Debug(">> WebSock.onopen");
        if (websocket.protocol) {
            mode = websocket.protocol;
            Util.Info("Server chose sub-protocol: " + websocket.protocol);
        } else {
            mode = 'base64';
            Util.Error("Server select no sub-protocol!: " + websocket.protocol);
        }
        if (mode === 'binary') {
            websocket.binaryType = 'arraybuffer';
        }
        eventHandlers.open();
        Util.Debug("<< WebSock.onopen");
    };
    websocket.onclose = function(e) {
        Util.Debug(">> WebSock.onclose");
        eventHandlers.close(e);
        Util.Debug("<< WebSock.onclose");
    };
    websocket.onerror = function(e) {
        Util.Debug(">> WebSock.onerror: " + e);
        eventHandlers.error(e);
        Util.Debug("<< WebSock.onerror");
    };
}

function close() {
    if (websocket) {
        if ((websocket.readyState === WebSocket.OPEN) ||
            (websocket.readyState === WebSocket.CONNECTING)) {
            Util.Info("Closing WebSocket connection");
            websocket.close();
        }
        websocket.onmessage = function (e) { return; };
    }
}

// Override internal functions for testing
// Takes a send function, returns reference to recv function
function testMode(override_send) {
    test_mode = true;
    api.send = override_send;
    api.close = function () {};
    return recv_message;
}

function constructor() {
    // Configuration settings
    api.maxBufferedAmount = 200;

    // Direct access to send and receive queues
    api.get_sQ       = get_sQ;
    api.get_rQ       = get_rQ;
    api.get_rQi      = get_rQi;
    api.set_rQi      = set_rQi;

    // Routines to read from the receive queue
    api.rQlen        = rQlen;
    api.rQpeek8      = rQpeek8;
    api.rQshift8     = rQshift8;
    api.rQunshift8   = rQunshift8;
    api.rQshift16    = rQshift16;
    api.rQshift32    = rQshift32;
    api.rQshiftStr   = rQshiftStr;
    api.rQshiftBytes = rQshiftBytes;
    api.rQslice      = rQslice;
    api.rQwait       = rQwait;

    api.flush        = flush;
    api.send         = send;
    api.send_string  = send_string;

    api.on           = on;
    api.init         = init;
    api.open         = open;
    api.close        = close;
    api.testMode     = testMode;

    return api;
}

return constructor();

}
JSRocket.SyncData = function () {

    "use strict";

    var _track = [];

    function getTrack(index) {
        return _track[index];
    }

    function getIndexForName(name) {
        for (var i = 0; i < _track.length; i++) {

            if (_track[i].name === name) {
                return i;
            }
        }

        return -1;
    }

    function getTrackLength() {
        return _track.length;
    }

    function createIndex(varName) {
        var track = new JSRocket.Track();
        track.name = varName;

        _track.push(track);
    }

    return {
        getTrack       :getTrack,
        getIndexForName:getIndexForName,
        getTrackLength :getTrackLength,
        createIndex    :createIndex
    };
};
JSRocket.Track = function () {

    "use strict";

    var STEP = 0,
        LINEAR = 1,
        SMOOTH = 2,
        RAMP = 3;

    var _track = [],
        _index = [];

    function getValue(row) {
        var intRow = Math.floor(row),
            bound = getBound(intRow),
            lower = bound.low,
            upper = bound.high,
            v;

        //console.log("lower:", lower, " upper:", upper, _track, _track[lower]);

        if (isNaN(lower)) {

            return NaN;

        } else if ((isNaN(upper)) || (_track[lower].interpolation === STEP)) {

            return _track[lower].value;

        } else {

            switch (_track[lower].interpolation) {

                case LINEAR:
                    v = (row - lower) / (upper - lower);
                    return _track[lower].value + (_track[upper].value - _track[lower].value) * v;

                case SMOOTH:
                    v = (row - lower) / (upper - lower);
                    v = v * v * (3 - 2 * v);
                    return (_track[upper].value * v) + (_track[lower].value * (1 - v));

                case RAMP:
                    v = Math.pow((row - lower) / (upper - lower), 2);
                    return _track[lower].value + (_track[upper].value - _track[lower].value) * v;
            }
        }

        return NaN;
    }

    function getBound(rowIndex) {
        var lower = NaN,
            upper = NaN;

        for (var i = 0; i < _index.length; i++) {

            if (_index[i] <= rowIndex) {

                lower = _index[i];

            } else if (_index[i] >= rowIndex) {

                upper = _index[i];
                break;
            }
        }

        return {"low":lower, "high":upper};
    }

    function add(row, value, interpolation) {
        remove(row);

        //index lookup table
        _index.push(row);
        _track[row] = { "value"         :value,
                        "interpolation" :interpolation};

        //lowest first
        _index = _index.sort(function (a, b) {
            return a - b;
        });
    }

    function remove(row) {
        if (_index.indexOf(row) > -1) {
            _index.splice(_index.indexOf(row), 1);
            delete _track[row];
        }
    }

    return {
        getValue:getValue,
        add     :add,
        remove  :remove
    };
};
JSRocket.SyncDevicePlayer = function (cfg) {

    "use strict";

    var _urlRequest,
        _syncData = new JSRocket.SyncData(),
        _eventHandler = {
            'ready':function () {
            },
            'error':function () {
            }
        };

    function load(url) {

        _urlRequest = new XMLHttpRequest();

        if (_urlRequest === null) {
            _eventHandler.error();
            return;
        }

        _urlRequest.open('GET', url, true);
        _urlRequest.onreadystatechange = urlRequestHandler;

        _urlRequest.send();
    }

    function urlRequestHandler() {

        if (_urlRequest.readyState === 4) {
            if (_urlRequest.status < 300) {
                readXML(_urlRequest.responseText);
            } else {
                _eventHandler.error();
            }
        }
    }

    function readXML(xmlString) {
        var xml = (new DOMParser()).parseFromString(xmlString, 'text/xml'),
            tracks = xml.getElementsByTagName("tracks");

        //<tracks>
        for (var i = 0; i < tracks.length; i++) {
            //<tracks><track>
            var trackList = tracks[i].getElementsByTagName("track");

            for (var c = 0; c < trackList.length; c++) {

                var track = getTrack(trackList[c].getAttribute("name")),
                    keyList = trackList[c].getElementsByTagName("key");

                for (var u = 0; u < keyList.length; u++) {

                    track.add(parseInt(keyList[u].getAttribute("row"), 10),
                        parseFloat(keyList[u].getAttribute("value")),
                        parseInt(keyList[u].getAttribute("interpolation"), 10));
                }
            }
        }

        _eventHandler.ready();
    }

    function getTrack(name) {

        var index = _syncData.getIndexForName(name);

        if (index > -1) {
            return _syncData.getTrack(index);
        }

        _syncData.createIndex(name);
        return _syncData.getTrack(_syncData.getTrackLength() - 1);
    }

    function setEvent(evt, handler) {
        _eventHandler[evt] = handler;
    }

    function nop() {

    }

    if (cfg.rocketXML === "" || cfg.rocketXML === undefined || cfg.rocketXML === undefined) {
        throw("[jsRocket] rocketXML is not set, try _syncDevice.setConfig({'rocketXML':'url/To/RocketXML.rocket'})");
    } else {
        load(cfg.rocketXML);
    }

    return {
        load    :load,
        getTrack:getTrack,
        update  :nop,
        on      :setEvent
    };
};
JSRocket.SyncDeviceClient = function (cfg) {

    "use strict";

    var CMD_SET_KEY = 0,
        CMD_DELETE_KEY = 1,
        CMD_GET_TRACK = 2,
        CMD_SET_ROW = 3,
        CMD_PAUSE = 4,
        CMD_SAVE_TRACKS = 5;

    var _queueClearTimer,
        _currentCommand = -1,
        _queue = [],
        _ws = new Websock(),
        _syncData = new JSRocket.SyncData(),
        _eventHandler = {
            'ready' :function () {
            },
            'update':function () {
            },
            'play'  :function () {
            },
            'pause' :function () {
            }
        };

    _ws.open(cfg.socketURL);

    function onOpen() {
        _ws.send_string('hello, synctracker!');
    }

    function onMessage() {

        var msg = _ws.rQshiftBytes();

        _queue = (_queue).concat(msg);

        readStream();
    }

    function readStream() {

        var len = _queue.length,
            track, row, value, interpolation;

        if (_currentCommand === -1) {
            _currentCommand = _queue[0];
        }

        //Handshake
        if ((_currentCommand === 104) && (len >= 12)) {

            _queue = [];
            _currentCommand = -1;

            _eventHandler.ready();

            //PAUSE
        } else if ((CMD_PAUSE === _currentCommand) && (len >= 2)) {

            value = parseInt(_queue[1], 10);

            _queue = _queue.slice(2);
            _currentCommand = -1;

            if (value === 1) {
                _eventHandler.pause();
            } else {
                _eventHandler.play();
            }

            //SET_ROW
        } else if ((CMD_SET_ROW === _currentCommand) && (len >= 5)) {

            row = toInt(_queue.slice(1, 5));

            _queue = _queue.slice(5);
            _currentCommand = -1;

            _eventHandler.update(row);

            //SET_KEY
        } else if ((CMD_SET_KEY === _currentCommand) && (len >= 14)) {

            track = toInt(_queue.slice(1, 5));
            row = toInt(_queue.slice(5, 9));
            value = parseInt(Math.round(toFloat(_queue.slice(9, 13)) * 1000) / 1000, 10);
            interpolation = parseInt(_queue.slice(13, 14).join(''), 10);

            _syncData.getTrack(track).add(row, value, interpolation);

            _queue = _queue.slice(14);
            _currentCommand = -1;

            //don't set row, as this could also be a interpolation change
            _eventHandler.update();

            //DELETE
        } else if ((CMD_DELETE_KEY === _currentCommand) && (len >= 9)) {

            track = toInt(_queue.slice(1, 5));
            row = toInt(_queue.slice(5, 9));

            _syncData.getTrack(track).remove(row);

            _queue = _queue.slice(9);
            _currentCommand = -1;

            _eventHandler.update(row);

            //SAVE
        } else if (CMD_SAVE_TRACKS === _currentCommand) {

            //console.log(">> TRACKS WERE SAVED");

            _queue = _queue.slice(1);
            _currentCommand = -1;
        }

        //clearing what's left in the queue
        clearInterval(_queueClearTimer);

        if (_queue.length >= 2) {
            _queueClearTimer = setInterval(readStream, 1);
        }
    }

    function onClose() {
        //console.log(">> connection closed");
    }

    function onError() {
        //console.error(">> connection error'd");
    }

    _ws.on('open', onOpen);
    _ws.on('message', onMessage);
    _ws.on('close', onClose);
    _ws.on('error', onError);

    function getTrack(name) {

        var index = _syncData.getIndexForName(name);

        if (index > -1) {
            return _syncData.getTrack(index);
        }

        _ws.send([CMD_GET_TRACK, 0, 0, 0, _syncData.getTrackLength(), 0, 0, 0, (name.length)]);
        _ws.send_string(name);
        _ws.flush();
        _syncData.createIndex(name);
        return _syncData.getTrack(_syncData.getTrackLength() - 1);
    }

    function setRow(row) {

        var streamInt = [(row >> 24) & 0xFF,
                        (row >> 16) & 0xFF,
                        (row >> 8) & 0xFF,
                        (row      ) & 0xFF];

        _ws.send([CMD_SET_ROW, streamInt[0], streamInt[1], streamInt[2], streamInt[3]]);
        _ws.flush();
    }

    function toInt(arr){
        var res = 0,
            i = arr.length - 1;

        for(; i > 0; i--) {
            res += parseInt(arr[i], 10) * Math.pow(256, (arr.length - 1) - i);
        }

        return res;
    }

    function toFloat(arr) {
        //identical to ws.rQshift32(), but no need to read the queue again
        var i = 0,
            n = (arr[i++] << 24) +
                (arr[i++] << 16) +
                (arr[i++] << 8) +
                (arr[i++]      ),
        //https://groups.google.com/forum/?fromgroups=#!topic/comp.lang.javascript/YzqYOCyWlNA
            sign = (n >> 31) * 2 + 1, // +1 or -1.
            exp = (n >>> 23) & 0xff,
            mantissa = n & 0x007fffff;

        if (exp === 0xff) {
            // NaN or Infinity
            return mantissa ? NaN : sign * Infinity;
        } else if (exp) {
            // Normalized value
            exp -= 127;

            // Add implicit bit in normal mode.
            mantissa |= 0x00800000;
        } else {
            // Subnormal number
            exp = -126;
        }
        return sign * mantissa * Math.pow(2, exp - 23);
    }

    function setEvent(evt, handler) {
        _eventHandler[evt] = handler;
    }

    return {
        getTrack:getTrack,
        update  :setRow,
        on      :setEvent
    };
};

JSRocket.SyncDevice = function () {

    "use strict";

    var _connected = false,
        _device,
        _previousIntRow,
        _config = {
            "socketURL":"ws://localhost:8080",
            "rocketXML":""
        },
        _eventHandler = {
            'ready' :function () {
            },
            'update':function () {
            },
            'play'  :function () {
            },
            'pause' :function () {
            }
        };

    function init(mode) {
        if (mode === "demo") {
            _device = new JSRocket.SyncDevicePlayer(_config);
        } else {
            _device = new JSRocket.SyncDeviceClient(_config);
        }

        _device.on('ready', deviceReady);
        _device.on('update', deviceUpdate);
        _device.on('play', devicePlay);
        _device.on('pause', devicePause);
    }

    function getConfig() {
        return _config;
    }

    function setConfig(cfg) {
        for (var option in cfg) {
            if (cfg.hasOwnProperty(option)) {
                _config[option] = cfg[option];
            }
        }

        return _config;
    }

    function deviceReady() {
        _connected = true;
        _eventHandler.ready();
    }

    function deviceUpdate(row) {
        _eventHandler.update(row);
    }

    function devicePlay() {
        _eventHandler.play();
    }

    function devicePause() {
        _eventHandler.pause();
    }

    function getTrack(name) {
        if (_connected) {
            return _device.getTrack(name);
        } else {
            return null;
        }
    }

    function update(row) {
        //no need to update rocket on float rows
        if (Math.floor(row) !== _previousIntRow) {
            _previousIntRow = Math.floor(row);
            _device.update(_previousIntRow);
        }
    }

    function setEvent(evt, handler) {
        _eventHandler[evt] = handler;
    }

    return {
        init     :init,
        setConfig:setConfig,
        getConfig:getConfig,
        getTrack :getTrack,
        update   :update,
        on       :setEvent
    };
};