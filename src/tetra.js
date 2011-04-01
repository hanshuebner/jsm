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

var MIDI = require('MIDI');
var BCR2000 = require('bcr2000');

// Open the MIDI ports that we are using to talk to both the synth and
// the BCR2000

var tetraInput = new MIDI.MIDIInput('DSI Tetra');
var tetraOutput = new MIDI.MIDIOutput('DSI Tetra');
var bcrInput = new MIDI.MIDIInput('BCR2000');
var bcrOutput = new MIDI.MIDIOutput('BCR2000');

// Definition of required Tetra sysex messages
var tetraSysexRequest = {
    requestEditBufferDump: 'f0 01 26 06 f7'
};

var tetraSysexResponse = {
    editBufferDataDump: 'f0 1 26 3'
};

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
    requestData: 'f0 0 20 32 0 15 40'
};

// Sysex replies from the BCR start with this string.
var bcrBehringerSysex = 'f0 0 20 32';

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
Array.prototype.toHexString = function (length) {
    return this.slice(0, length).map(function (x) { return x.toString(16) }).join(' ');
}

// currentTetraPreset represents the unpacked parameter set of the
// Tetra edit buffer as an array of integers indexed by NRPN number.
// It is being updated whenever by NRPN parameter changes received
// both from the Tetra and from the BCR2000.  As such, it contains a
// mirror of the parameters in the Tetra.
var currentTetraPreset;

// Handle sysex message received from the Tetra
function handleTetraSysex(message) {
    switch (message.asHexString(4)) {
    case tetraSysexResponse.editBufferDataDump:
        currentTetraPreset = decodePackedMSB(message.slice(4));
        console.log('requesting BCR2000 presets');
        bcrOutput.sysex(bcrSysex.requestData + ' 7f f7');
        break;
    }        
}

// Handle NRPN message received from either the Tetra or the BCR2000
function handleNrpn(parameter, value) {
    currentTetraPreset[parameter] = value;
    ((this == tetraInput) ? bcrOutput : tetraOutput).nrpn(parameter, value);
}

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
    bcrOutput.sysex(bcrSysex.selectPreset + ' ' + currentBcrPreset.toString(16) + ' f7');
    _.each(parsedBCL.presets[currentBcrPreset].controls,
           function (control) {
               if (control.nrpn != undefined) {
                   bcrOutput.nrpn14(control.nrpn, currentTetraPreset[control.nrpn]);
               }
           });
}

// Handle a standard Behringer sysex message that has been received.
function handleBehringerSysex(message) {
    switch (message[6]) {
    case 0x20:
        // Received BCL line.  Verify line number, store received BCL
        // line, handle $end BCL command by parsing the BCR2000
        // presets and select the initial page displayed.
        var receivedLineNumber = (message[7] << 7) | message[8];
        if (receivedLineNumber == 0) {
            bclText = '';
            expectedBclLine = 0;
        }
        if (receivedLineNumber != expectedBclLineNumber) {
            console.log('unexpected BCL line received from BCR2000');
        }
        expectedBclLineNumber++;
        var line = new Buffer(message.slice(9, message.length - 1)).toString() + '\n';
        bclText += line;
        if (line.match(/ *\$end/)) {
            console.log('received preset info from BCR2000, parsing');
            parsedBCL = BCR2000.parseBCL(bclText);
            selectBcrPreset();
            console.log('ready');
        }
        break;
    default:
        console.log('unknown Behringer sysex message received, command:', message[6]);
    }
}

// Handle a sysex message received from the BCR2000.  This can be
// either one of our private messages controlling the operation of
// this program or a Behringer standard message which will then be
// processed by handleBehringerSysex()
function handleBcrSysex(message) {
    switch (message.asHexString(4)) {
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

// Set up event handlers for NRPN and sysex messages for both MIDI inputs.
tetraInput.on('sysex', handleTetraSysex);
tetraInput.on('nrpn14', handleNrpn);
bcrInput.on('sysex', handleBcrSysex);
bcrInput.on('nrpn14', handleNrpn);

console.log('requesting Tetra edit buffer');
tetraOutput.sysex(tetraSysexRequest.requestEditBufferDump);
// Once the edit buffer has been received from the Tetra, the BCR2000
// presets will be read and normal processing will start.