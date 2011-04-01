
var MIDI = require('MIDI');

var tetraSysexRequest = {
    requestEditBufferDump: 'f0 01 26 06 f7'
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

function handleTetraSysex(message) {
    switch (message.asHexString(4)) {
    case 'f0 1 26 3':
        console.log('received current preset from Tetra');
        currentPreset = decodePackedMSB(message.slice(4));
        break;
    }        
}

function handleNrpn(parameter, value) {
    currentPreset[parameter] = value;
    ((this == tetraInput) ? bcrOutput : tetraOutput).nrpn(parameter, value);
}

tetraInput.on('sysex', handleTetraSysex);
tetraInput.on('nrpn14', handleNrpn);
bcrInput.on('nrpn14', handleNrpn);

tetraOutput.sysex(tetraSysexRequest.requestEditBufferDump);

