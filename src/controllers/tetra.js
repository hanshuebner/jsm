
var fs = require('fs');
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
    for (var i = 0; i < packed.length; i++) {
        if ((i % 8) == 0) {
            highBits = packed[i];
        } else {
            retval.push(((highBits & 1) << 7) | packed[i]);
            highBits >>= 1;
        }
    }
    return retval;
}

function encodePackedMSB(unpacked)
{
    var retval = [];
    for (var i = 0; i < unpacked.length; i += 7) {
        var msbPointer = retval.length;
        retval.push(0);
        var msbMask = 1;
        for (var j = i; j < Math.min(unpacked.length, i + 7); j++) {
            retval[msbPointer] |= (unpacked[j] & 0x80) ? msbMask : 0;
            retval.push(unpacked[j] & 0x7f);
            msbMask <<= 1;
        }
    }
    return retval;
}

// Utility function to transform arrays into strings for easy
// comparison.
function toHexString (array, length) {
    return array.slice(0, length).map(function (x) { return x.toString(16) }).join(' ');
}

Buffer.prototype.toHexString = function (start, end) {
    start = start || 0;
    end = (end == undefined) ? this.length : end;
    if (end > this.length) {
        throw Error('end beyond buffer length');
    }
    var retval = '';
    for (var i = start; i < end; i++) {
        if (retval) {
            retval += ' ';
        }
        retval += this[i].toString(16);
    }
    return retval;
}

var paramToNrpn = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  12: 10,
  13: 11,
  14: 12,
  16: 13,
  17: 14,
  20: 15,
  21: 16,
  22: 17,
  23: 18,
  24: 19,
  25: 20,
  26: 21,
  27: 22,
  28: 23,
  29: 24,
  30: 25,
  31: 26,
  32: 27,
  40: 28,
  41: 29,
  33: 30,
  34: 31,
  35: 32,
  36: 33,
  37: 34,
  38: 35,
  39: 36,
  42: 37,
  43: 38,
  44: 39,
  45: 40,
  46: 41,
  47: 42,
  48: 43,
  49: 44,
  50: 45,
  51: 46,
  52: 47,
  53: 48,
  54: 49,
  55: 50,
  56: 51,
  57: 52,
  58: 53,
  59: 54,
  60: 55,
  61: 56,
  62: 57,
  63: 58,
  64: 59,
  65: 60,
  66: 61,
  67: 62,
  68: 63,
  69: 64,
  71: 65,
  72: 66,
  73: 67,
  74: 68,
  75: 69,
  76: 70,
  77: 71,
  78: 72,
  79: 73,
  80: 74,
  81: 75,
  82: 76,
  107: 77,
  108: 78,
  109: 79,
  110: 80,
  83: 81,
  84: 82,
  85: 83,
  86: 84,
  87: 85,
  88: 86,
  89: 87,
  90: 88,
  91: 89,
  92: 90,
  101: 91,
  102: 92,
  15: 93,
  105: 94,
  94: 95,
  93: 96,
  103: 97,
  70: 98,
  95: 99,
  104: 100,
  106: 101,
  111: 105,
  112: 106,
  113: 107,
  114: 108,
  19: 110,
  96: 111,
  97: 112,
  98: 113,
  5: 114,
  11: 115,
  18: 116,
  117: 117,
  99: 118,
  100: 119,
  120: 120,
  121: 121,
  122: 122,
  123: 123,
  124: 124,
  125: 125,
  126: 126,
  127: 127,
  128: 128,
  129: 129,
  130: 130,
  131: 131,
  132: 132,
  133: 133,
  134: 134,
  135: 135,
  136: 136,
  137: 137,
  138: 138,
  139: 139,
  140: 140,
  141: 141,
  142: 142,
  143: 143,
  144: 144,
  145: 145,
  146: 146,
  147: 147,
  148: 148,
  149: 149,
  150: 150,
  151: 151,
  152: 152,
  153: 153,
  154: 154,
  155: 155,
  156: 156,
  157: 157,
  158: 158,
  159: 159,
  160: 160,
  161: 161,
  162: 162,
  163: 163,
  164: 164,
  165: 165,
  166: 166,
  167: 167,
  168: 168,
  169: 169,
  170: 170,
  171: 171,
  172: 172,
  173: 173,
  174: 174,
  175: 175,
  176: 176,
  177: 177,
  178: 178,
  179: 179,
  180: 180,
  181: 181,
  182: 182,
  183: 183
}

var nrpnToParam = {};

for (var key in paramToNrpn) {
    nrpnToParam[paramToNrpn[key]] = key;
}

function reorderParams(input, translateIndex)
{
    var output = [];
    for (var i = 0; i < 200; i++) {
        output[translateIndex[i]] = input[i];
    }
    for (var i = 200; i < 384; i++) {
        output[translateIndex[i - 200] + 200] = input[i];
    }
    return output;
}

function reorderParamsByNrpn(byParam)
{
    return reorderParams(byParam, paramToNrpn);
}

function reorderNrpnsByParam(byNrpn)
{
    return reorderParams(byNrpn, nrpnToParam);
}

function readSysexDump(filename, callback)
{
    var presets = [];
    function processSysexMessage(buf) {
        switch (buf.toHexString(0, 4)) {
        case tetraSysexResponse.programDataDump:
            var parameters = decodePackedMSB(buf.slice(6, buf.length - 1));
            var programName = (new Buffer(parameters.slice(184, 200), 'binary')).toString().replace(/ *$/, "");
            presets.push({ name: programName,
                           bank: buf[4],
                           program: buf[5],
                           parameters: reorderParamsByNrpn(parameters) });
        }
    }

    fs.readFile(filename, function (err, data) {
        if (err) {
            callback(err);
        }
        var messageStart = 0;
        for (var i = 0; i < data.length; i++) {
            if (data[i] == 0xf7) {
                processSysexMessage(data.slice(messageStart, i + 1));
                messageStart = i + 1;
            }
        }
        callback(null, presets);
    });
}

exports.readSysexDump = readSysexDump;

exports.make = function(_hub) {
    hub = _hub;

    var tetraInput = new MIDI.MIDIInput('DSI Tetra');
    var tetraOutput = new MIDI.MIDIOutput('DSI Tetra');
    tetraInput.name = 'MIDI-Tetra';

    // Handle sysex message received from the Tetra
    function handleTetraSysex(message) {
        switch (toHexString(message, 4)) {
        case tetraSysexResponse.editBufferDataDump:
            currentTetraPreset = { name: 'downloaded',
                                   labels: [],
                                   parameters: reorderParamsByNrpn(decodePackedMSB(message.slice(4))) };
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
    hub.on('presetChange', function (preset) {
        var params = reorderNrpnsByParam(preset.parameters);
        var sysexBuffer = [0xf0, 0x01, 0x26, 0x03].concat(encodePackedMSB(params)).concat([0xf7]);
        console.log('sending preset to tetra');
        tetraOutput.sysex(sysexBuffer);
        console.log('done');
    });
}
