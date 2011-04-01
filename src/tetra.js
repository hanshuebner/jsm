
var MIDI = require('MIDI');

var tetraSysexRequest = {
    requestEditBufferDump: 'f0 01 26 06 f7'
};

var tetraSysexResponse = {
    editBufferDataDump: 'f0 1 26 3'
};

// Private sysex messages sent by the BCR2000 preset to interact with
// this program
var bcrPrivateSysex = {
    previousPreset: 'f0 7f 23 0',
    nextPreset: 'f0 7f 23 1'
};

var bcrSysex = {
    selectPreset: 'f0 0 20 32 0 15 22'
};

var tetraInput = new MIDI.MIDIInput('DSI Tetra');
var tetraOutput = new MIDI.MIDIOutput('DSI Tetra');
var bcrInput = new MIDI.MIDIInput('BCR2000');
var bcrOutput = new MIDI.MIDIOutput('BCR2000');
var currentPreset = [];

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

Array.prototype.toHexString = function (length) {
    return this.slice(0, length).map(function (x) { return x.toString(16) }).join(' ');
}

function handleNrpn(parameter, value) {
    currentPreset[parameter] = value;
    ((this == tetraInput) ? bcrOutput : tetraOutput).nrpn(parameter, value);
}

function handleTetraSysex(message) {
    switch (message.asHexString(4)) {
    case tetraSysexResponse.editBufferDataDump:
        console.log('received edit buffer data dump from Tetra');
        currentPreset = decodePackedMSB(message.slice(4));
        break;
    }        
}

bcrOutput.currentPreset = 0;

bcrOutput.selectPreset = function () {
    this.sysex(bcrSysex.selectPreset + ' ' + this.currentPreset.toString(16) + ' f7');
}

function handleBcrSysex(message) {
    switch (message.asHexString(4)) {
    case bcrPrivateSysex.previousPreset:
        if (bcrOutput.currentPreset > 0) {
            bcrOutput.currentPreset--;
            bcrOutput.selectPreset();
        }
        break;
    case bcrPrivateSysex.nextPreset:
        if (bcrOutput.currentPreset < 31) {
            bcrOutput.currentPreset++;
            bcrOutput.selectPreset();
        }
        break;
    }
}

bcrOutput.selectPreset();

tetraInput.on('sysex', handleTetraSysex);
tetraInput.on('nrpn14', handleNrpn);
bcrInput.on('sysex', handleBcrSysex);
bcrInput.on('nrpn14', handleNrpn);

tetraOutput.sysex(tetraSysexRequest.requestEditBufferDump);
