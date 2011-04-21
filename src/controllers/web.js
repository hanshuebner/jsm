var io = require('socket.io');
var _ = require('underscore');
var tetraDefs = require('tetra-defs');
var hub;

function newSocketClient(client) {
    client.name = 'Web-' + client.connection.remoteAddress + ':' + client.connection.remotePort;
    function webNameToNrpn(webName) {
        return tetraDefs.parameterNameMap[webName.toUpperCase().replace(/-/g, ' ')];
    }

    function nrpnToWebName(nrpn) {
        return tetraDefs.parameterDefinitions[nrpn] && tetraDefs.parameterDefinitions[nrpn].name.toLowerCase().replace(/ /g, '-');
    }

    function parameterChange (parameter, value, from) {
        if (from != client) {
            client.send(JSON.stringify(['set', nrpnToWebName(parameter), value]));
        }
    }
    hub.on('parameterChange', parameterChange);
    function presetChange (preset) {
        for (var i = 0; i < preset.parameters.length; i++) {
            var parameterName = nrpnToWebName(i);
            if (parameterName) {
                client.send(JSON.stringify(['set', parameterName, preset.parameters[i]]));
            }
        }
    }
    hub.on('presetChange', presetChange);
    client.on('message', function (message) {
        var args = JSON.parse(message);
        var command = args.shift();
        switch (command) {
        case 'set':
            var parameter = webNameToNrpn(args.shift());
            if (parameter) {
                var value = args.shift();
                hub.emit('parameterChange', parameter, value, client);
            }
            break;
        case 'preset':
            hub.emit('presetChange', args[0]);
            break;
        default:
            console.log("can't parse message '" + message + "' from web client");
        }
    });
    client.on('disconnect', function () {
        console.log('client disconnect');
        hub.removeListener('parameterChange', parameterChange);
        hub.removeListener('presetChange', presetChange);
    });
}

exports.make = function(_hub) {
    hub = _hub;
    var socket = io.listen(hub.webServer);
    socket.on('connection', newSocketClient);
}
