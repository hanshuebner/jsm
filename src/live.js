// live.js - Node.js API for remote controlling Ableton Live through OSC

var OSC = require('osc');
var _ = require('underscore');
var util = require('util');
var events = require('events');

function Live(host, remotePort, localPort)
{
    if (!host) host = 'localhost';
    if (!remotePort) remotePort = 9000;
    if (!localPort) localPort = 9001;

    events.EventEmitter.call(this);

    this.server = new OSC.Server(localPort);
    var live = this;
    this.server.on('message', function (message) {
        console.log('message', message);
        live.emit.apply(live, message);
    });
    this.client = new OSC.Client(host, remotePort);
}

util.inherits(Live, events.EventEmitter);

Live.prototype.send = function () {
    this.client.send.apply(this.client, arguments);
}

exports.Live = Live;

