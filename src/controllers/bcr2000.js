var MIDI = require('MIDI');
var bcr2000web = require('bcr2000-web.js');
var BCR2000 = require('bcr2000');

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
function selectBcrPreset (tetraPreset) {
    console.log('select BCR preset', currentBcrPreset);
    bcrOutput.sysex(bcrSysexRequest.selectPreset + ' ' + currentBcrPreset.toString(16) + ' f7');
    if (!parsedBCL.presets[currentBcrPreset]) {
        console.log('no preset', currentBcrPreset, 'in BCR2000');
    } else {
        _.each(parsedBCL.presets[currentBcrPreset].controls,
               function (control) {
                   if (control.nrpn != undefined) {
                       bcrOutput.nrpn14(control.nrpn, tetraPreset[control.nrpn]);
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
        selectBcrPreset(hub.currentPreset);
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
            selectBcrPreset(hub.currentPreset);
        }
        break;
    case bcrPrivateSysex.nextPreset:
        if (currentBcrPreset < 31) {
            currentBcrPreset++;
            selectBcrPreset(hub.currentPreset);
        }
        break;
    case bcrBehringerSysex:
        handleBehringerSysex(message);
        break;
    }
}

exports.make = function (hub) {

    hub.addWebHandler(bcr2000web.handleRequest);

    var bcrPresetFilename = process.argv[2];

    console.log('reading BCR2000 presets from file', bcrPresetFilename);
    parsedBCL = BCR2000.parseBCL(BCR2000.readSysexFile(bcrPresetFilename));

    bcrInput = new MIDI.MIDIInput('BCR2000');
    bcrOutput = new MIDI.MIDIOutput('BCR2000');

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

    hub.on('presetChange', selectBcrPreset);
}
