var JSRocket = {};
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

    function add(row, value, interpolation, delaySort) {

        remove(row);

        //index lookup table
        _index.push(row);
        _track[row] = { "value"         :value,
                        "interpolation" :interpolation};

        //parser calls this quite often, so we sort later
        if(delaySort !== true) {
            sortIndex();
        }
    }

    function sortIndex() {

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
        sortIndex:sortIndex,
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
        var key,
            t = 0, tLen, k = 0, kLen,
            xml = (new DOMParser()).parseFromString(xmlString, 'text/xml'),
            tracks = xml.getElementsByTagName('tracks');

        //<tracks>
        var trackList = tracks[0].getElementsByTagName('track');

        for (t, tLen = trackList.length; t < tLen; t++) {

            var track = getTrack(trackList[t].getAttribute('name')),
                keyList = trackList[t].getElementsByTagName('key');

            for (k = 0, kLen = keyList.length; k < kLen; k++) {
                key = keyList[k];
                track.add(parseInt(key.getAttribute('row'), 10),
                    parseFloat(key.getAttribute('value')),
                    parseInt(key.getAttribute('interpolation'), 10),
                    true);

            }
            track.sortIndex();
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
JSRocket.SyncDevice = function () {

    "use strict";

    var _connected = false,
        _device,
        _previousIntRow,
        _config = {
            "socketURL":"ws://localhost:1338",
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