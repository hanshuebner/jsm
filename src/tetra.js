// tetra.js

// This program implements BCR2000 based control surface for the DSI
// Tetra desktop synthesizer.  It makes sure that the parameter value
// displayed on the BCR2000 match the parameters in the Tetra.  This
// is done by reading out the Tetra parameters using a sysex MIDI
// message and sending all those parameters that are currently
// assigned to controls on the BCR2000 to that device so that the
// displayed and the actual values match.

// In order for the process to work, the BCR2000 must be set up so
// that it sends all parameters as NRPN control changes using the BCL
// .easypar statement.  The accompanying bcr2000-editor.html
// application makes it easy to assign BCR2000 controls to Tetra
// parameters in a suitable manner.

// Copyright 2011 Hans Huebner, All Rights Reserved

var fs = require('fs');
var events = require('events');
var _ = require('underscore');
var OSC = require('osc');
var MIDI = require('MIDI');
var BCR2000 = require('bcr2000');
var antinode = require('antinode');
var io = require('socket.io');
var tetraDefs = require('tetra-defs');
var bcr2000web = require('./bcr2000-web.js');

function makeTetraController(hub) {

    var tetraInput = new MIDI.MIDIInput('DSI Tetra');
    var tetraOutput = new MIDI.MIDIOutput('DSI Tetra');
    tetraInput.name = 'MIDI-Tetra';

    // Definition of required Tetra sysex messages
    var tetraSysexRequest = {
        requestEditBufferDump: 'f0 01 26 06 f7'
    };

    var tetraSysexResponse = {
        editBufferDataDump: 'f0 1 26 3'
    };

    // The Tetra sends binary data as packed MSB first encoded data
    // blocks.  The most significant bit of seven transferred bytes is
    // grouped into one 7bit-value and sent before the actual data bytes
    // (MIDI data in sysex message cannot contain values with the most
    // significant bit set).  The following function unpacks data packed
    // in this manner into an array of integer values.
    function decodePackedMSB(packed)
    {
        var retval = [];
        var highBits;
        for (var i in packed) {
            if ((i % 8) == 0) {
                highBits = packed[i];
            } else {
                retval.push(((highBits & 1) << 7) | packed[i]);
                highBits >>= 1;
            }
        }
        return retval;
    }

    // Utility function to transform arrays into strings for easy
    // comparison.
    function toHexString (array, length) {
        return array.slice(0, length).map(function (x) { return x.toString(16) }).join(' ');
    }

    // currentTetraPreset represents the unpacked parameter set of the
    // Tetra edit buffer as an array of integers indexed by NRPN number.
    // It is being updated whenever by NRPN parameter changes received
    // both from the Tetra and from the BCR2000.  As such, it contains a
    // mirror of the parameters in the Tetra.
    var currentTetraPreset;

    // Handle sysex message received from the Tetra
    function handleTetraSysex(message) {
        switch (toHexString(message, 4)) {
        case tetraSysexResponse.editBufferDataDump:
            currentTetraPreset = decodePackedMSB(message.slice(4));
            console.log('Received edit buffer information from Tetra');
            break;
        }        
    }

    function handleTetraProgramChange(program) {
        console.log('Tetra program change', program);
        tetraOutput.sysex(tetraSysexRequest.requestEditBufferDump);
    }
    tetraInput.on('sysex', handleTetraSysex);
    tetraInput.on('nrpn14', function (parameter, value) {
        hub.emit('parameterChange', parameter, value, tetraInput);
    });
    tetraInput.on('programChange', handleTetraProgramChange);

    console.log('requesting Tetra edit buffer');
    tetraOutput.sysex(tetraSysexRequest.requestEditBufferDump);

    hub.on('parameterChange', function (parameter, value, from) {
        if (from != tetraInput) {
            tetraOutput.nrpn14(parameter, value);
        }
    });
}

function makeBCR2000Controller (hub) {

    // Private sysex messages sent by the BCR2000 preset to interact with
    // this program.  These strings need to be assigned to the "<" and ">"
    // buttons on the BCR2000 so that preset changes are actually carried
    // out through this program rather than by the BCR2000 itself.  If one
    // of these sysex messages is received, the preset on the BCR2000 is
    // changed using a sysex message.

    var bcrPrivateSysex = {
        previousPreset: 'f0 7f 23 0',
        nextPreset: 'f0 7f 23 1'
    };

    // Definition of required BCR2000 sysex messages

    var bcrSysexRequest = {
        selectPreset: 'f0 0 20 32 0 15 22',
        requestData: 'f0 0 20 32 0 15 40',
        sendBclMessage: 'f0 0 20 32 0 15 20'
    };

    // Sysex replies from the BCR start with this string.
    var bcrBehringerSysex = 'f0 0 20 32';

    // Current BCR2000 presets in text form during reception
    var bclText;
    var expectedBclLineNumber;
    // Current parsed BCR2000 presets
    var parsedBCL;

    // Currently selected BCR2000 preset number
    var currentBcrPreset = 0;

    // Send a preset selection message for the current preset to the
    // BCR2000, then transmit all NRPN parameter values that are assigned
    // to any of the controls on the BCR2000 in the current preset.
    function selectBcrPreset () {
        console.log('select BCR preset', currentBcrPreset);
        bcrOutput.sysex(bcrSysexRequest.selectPreset + ' ' + currentBcrPreset.toString(16) + ' f7');
        if (!parsedBCL.presets[currentBcrPreset]) {
            console.log('no preset', currentBcrPreset, 'in BCR2000');
        } else {
            _.each(parsedBCL.presets[currentBcrPreset].controls,
                   function (control) {
                       if (control.nrpn != undefined) {
                           bcrOutput.nrpn14(control.nrpn, currentTetraPreset[control.nrpn]);
                       }
                   });
        }
    }

    function handleReceivedBclLine(message)
    {
        // Received BCL line.  Verify line number, store received BCL
        // line, handle $end BCL command by parsing the BCR2000
        // presets and select the initial page displayed.
        var receivedLineNumber = (message[7] << 7) | message[8];
        if (receivedLineNumber == 0) {
            bclText = '';
            expectedBclLineNumber = 0;
        }
        if (receivedLineNumber != expectedBclLineNumber) {
            console.log('unexpected BCL line received from BCR2000 - expected', expectedBclLineNumber, 'got', receivedLineNumber);
        }
        expectedBclLineNumber++;
        var line = new Buffer(message.slice(9, message.length - 1)).toString() + '\n';
        bclText += line;
        if (line.match(/ *\$end/)) {
            console.log('received preset info from BCR2000, parsing');
            parsedBCL = BCR2000.parseBCL(bclText);
            selectBcrPreset();
        }
    }

    // Handle a standard Behringer sysex message that has been received.
    function handleBehringerSysex(message) {
        switch (message[6]) {
        case 0x21:
            switch (message.length) {
            case 11:
                // BCL Reply
                break;
            case 33:
                // Send Preset Name
                break;
            default:
                console.log('received $21 message with unexpected length', message.length, message);
                break;
            }
        default:
            console.log('unexpected Behringer sysex message received, command:', message[6]);
        }
    }

    // Handle a sysex message received from the BCR2000.  This can be
    // either one of our private messages controlling the operation of
    // this program or a Behringer standard message which will then be
    // processed by handleBehringerSysex()
    function handleBcrSysex(message) {
        switch (toHexString(message, 4)) {
        case bcrPrivateSysex.previousPreset:
            if (currentBcrPreset > 0) {
                currentBcrPreset--;
                selectBcrPreset();
            }
            break;
        case bcrPrivateSysex.nextPreset:
            if (currentBcrPreset < 31) {
                currentBcrPreset++;
                selectBcrPreset();
            }
            break;
        case bcrBehringerSysex:
            handleBehringerSysex(message);
            break;
        }
    }

    var bcrPresetFilename = process.argv[2];

    console.log('reading BCR2000 presets from file', bcrPresetFilename);
    parsedBCL = BCR2000.parseBCL(BCR2000.readSysexFile(bcrPresetFilename));

    var bcrInput = new MIDI.MIDIInput('BCR2000');
    var bcrOutput = new MIDI.MIDIOutput('BCR2000');

    bcrInput.name = 'MIDI-BCR2000';
    bcrInput.on('sysex', handleBcrSysex);
    bcrInput.on('nrpn14', function (parameter, value) {
        hub.emit('parameterChange', parameter, value, bcrInput)
    });

    hub.on('parameterChange', function (parameter, value, from) {
        if (from != bcrInput) {
            bcrOutput.nrpn14(parameter, value);
        }
    });
}

function makeWebClientController(hub, port) {

    var server = antinode.start({ port: port,
                                  request_preprocessor: bcr2000web.handleRequest,
                                  default_host: {
                                      root: "../web/"
                                  }
                                });
    var socket = io.listen(server);

    function newSocketClient(client) {
        client.name = 'Web-' + client.connection.remoteAddress;
        function webNameToNrpn(webName) {
            return tetraDefs.parameterNameMap[webName.toUpperCase().replace(/-/g, ' ')];
        }

        function nrpnToWebName(nrpn) {
            return tetraDefs.parameterDefinitions[nrpn].name.toLowerCase().replace(/ /g, '-');
        }

        function parameterChange (parameter, value, from) {
            if (from != client) {
                client.send('set ' + nrpnToWebName(parameter) + ' ' + value);
            }
        }
        hub.on('parameterChange', parameterChange);
        client.on('message', function (message) {
            var args = message.split(/ +/);
            var command = args.shift();
            switch (command) {
            case 'set':
                var parameter = webNameToNrpn(args.shift());
                var value = args.shift();
                hub.emit('parameterChange', parameter, value, client);
                break;
            default:
                console.log("can't parse message '" + message + "' from web client");
            }
        });
        client.on('disconnect', function () {
            console.log('client disconnect');
            hub.removeListener('parameterChange', parameterChange);
        });
    }

    socket.on('connection', newSocketClient);
}

// OSC

function makeOscController(hub, host, portIn, portOut)
{
    var server = new OSC.Server(4343);
    var client = new OSC.Client(4344, '192.168.5.153');

    var sequencerStartNrpns = [ tetraDefs.parameterNameMap["SEQ TRACK 1 STEP 1"],
                                tetraDefs.parameterNameMap["SEQ TRACK 2 STEP 1"],
                                tetraDefs.parameterNameMap["SEQ TRACK 3 STEP 1"],
                                tetraDefs.parameterNameMap["SEQ TRACK 4 STEP 1"] ];

    server.on('message', function (message, sender) {
        sender.name = 'OSC-' + sender.address + ':' + sender.port;
        var address = message.shift();
        var value = message.shift();
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

    hub.on('parameterChange', function (parameter, value) {
        client.send(new OSC.Message('/foo/parameter', value));
    });
}

var hub = new events.EventEmitter();

makeOscController(hub, 4343, '192.168.5.153', 4344);
makeWebClientController(hub, 8100);
makeTetraController(hub);
makeBCR2000Controller(hub);

hub.on('parameterChange', function (parameter, value, from) {
    console.log('from', from.name, 'parameter', parameter, 'value', value);
});
