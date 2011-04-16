var MIDI = require('MIDI');
var tetraDefs = require('tetra-defs');

// Definition of required Tetra sysex messages
var tetraSysexRequest = {
    requestEditBufferDump: 'f0 01 26 06 f7'
};

var tetraSysexResponse = {
    editBufferDataDump: 'f0 1 26 3',
    programDataDump: 'f0 1 26 2'
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

exports.make = function(_hub) {
    hub = _hub;

    var tetraInput = new MIDI.MIDIInput('DSI Tetra');
    var tetraOutput = new MIDI.MIDIOutput('DSI Tetra');
    tetraInput.name = 'MIDI-Tetra';

    // Handle sysex message received from the Tetra
    function handleTetraSysex(message) {
        switch (toHexString(message, 4)) {
        case tetraSysexResponse.editBufferDataDump:
            currentTetraPreset = decodePackedMSB(message.slice(4));
            console.log('Received edit buffer information from Tetra');
            hub.emit('presetChange', currentTetraPreset);
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
