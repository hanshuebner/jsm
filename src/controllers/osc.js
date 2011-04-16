var OSC = require('osc');
var mdns = require('mdns');
var _ = require('underscore');
var tetraDefs = require('tetra-defs');

// OSC
exports.make = function(hub)
{
    var server = new OSC.Server(hub.options.oscPort);
    var browser = mdns.createBrowser(mdns.udp('osc'));
    var clients = {};

    var sequencerStartNrpns = [ tetraDefs.parameterNameMap["SEQ TRACK 1 STEP 1"],
                                tetraDefs.parameterNameMap["SEQ TRACK 2 STEP 1"],
                                tetraDefs.parameterNameMap["SEQ TRACK 3 STEP 1"],
                                tetraDefs.parameterNameMap["SEQ TRACK 4 STEP 1"] ];

    function findAddress(info) {
        var address = _.detect(info.addresses, function (address) { return address.match(/^[0-9.]+$/) });
        if (!address) {
            throw({ message: 'none of the addresses reported by the OSC seem to be a IPv4 address' });
        }
        return address;
    }
    
    function parameterChange (parameter, value) {
        if (parameter >= sequencerStartNrpns[0] && parameter < (sequencerStartNrpns[0] + 64)) {
            var index = parameter - sequencerStartNrpns[0];
            var sequencer = Math.floor(index / 16);
            var step = index % 16;
            var address = '/sequencer/seq-' + sequencer + '-' + step;
            this.send(address, (value > 125) ? 0 : (value * (1 / 125)));
            if (sequencer == 0) {
                this.send(address + '-rest', (value == 127) ? 1 : 0);
            }
            this.send(address + '-reset', (value == 126) ? 1 : 0);
        }
    }

    function presetChange (preset) {
        console.log('sending info to TouchOSC');
        for (var i = sequencerStartNrpns[0]; i < sequencerStartNrpns[0] + 64; i++) {
            this.parameterChange(i, preset[i]);
        }
    }
    browser.on('serviceUp', function (info) {
        console.log('detected osc server in network', info.serviceName);
        if (info.serviceName.match(/ \(TouchOSC\)$/)) {
            console.log('connecting new TouchOSC client');
            try {
                address = findAddress(info);
                client = new OSC.Client(address, info.port);
                clients[info.serviceName] = client;
                client.parameterChange = parameterChange;
                client.presetChange = presetChange;
                hub.on('parameterChange', _.bind(parameterChange, client));
                hub.on('presetChange', _.bind(presetChange, client));
            }
            catch (e) {
                console.log(e.type, ':', e.message);
            }
        } else {
            console.log('not a TouchOSC service, ignoring');
        }
    });
    browser.on('serviceDown', function (info) {
        console.log('osc server left', info.serviceName);
        delete clients[info.serviceName];
    });
    browser.start();

    server.on('message', function (message, sender) {
        if (!_.detect(clients, function (client) { return sender.address == client.host })) {
            console.log('WARNING, received message from yet-unknown client', sender.address);
        }
        sender.name = 'OSC-' + sender.address + ':' + sender.port;
        var address = message.shift();
        var value = message.shift();
//        console.log('received', address, 'value', value);
        address.replace(/\/sequencer\/seq-(\d+)-(\d+)(.*)/, function (match, sequencerNumber, stepNumber, suffix) {
            var nrpn = sequencerStartNrpns[sequencerNumber] + parseInt(stepNumber);
            if (suffix == "-reset") {
                value = 126;
            } else if (suffix == "-rest") {
                value = 127;
            } else {
                value = Math.floor(value * 125);
            }
            hub.emit('parameterChange', nrpn, value, sender);
        });
    });
}
