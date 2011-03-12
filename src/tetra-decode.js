

function unpackHexMessage(string)
{
    return string
        .split(' ')
        .map(function(string) { return parseInt(string, 16); });
}

var programEditBufferDataDump
    = decodePackedMS(unpackHexMessage("f0 1 26 3 0 11 32 0 0 1 2a 18 0 33 0 0 1 0 0 0 0 0 0 40 0 0 0 37 0 7f 0 0 1 7f 0 0 0 0 0 0 0 0 7f 0 0 0 14 1e 19 35 0 7f 0 50 0 0 0 0 50 0 0 0 0 0 50 0 0 0 0 0 50 0 0 0 0 9 1 c 0 0 10 0 2 29 0 0 0 7f 0 0 7f 0 0 0 7f 0 0 7f 0 7f 20 0 7f 0 7f 0 7e 0 0 7f 0 0 0 1 3c 64 0 1 3c 0 7d 2 0 0 0 0 1 1 2 9 0 29 0 29 29 29 0 0 0 0 0 0 0 7f 7e 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 4c 6f 63 71 75 0 69 72 65 63 20 44 72 0 79 4a 61 6d 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 11 32 2 0 72 1 2a 18 33 1 0 0 1 0 0 0 1 0 30 8 0 57 25 1 1e 0 0 0 1 7f 0 0 0 0 0 0 0 0 7f 0 0 0 2e 10 24 35 0 25 17 0 12 0 9 0 50 0 0 0 0 0 50 0 0 0 0 50 0 0 0 0 0 0 7f 0 0 0 0 0 0 0 0 0 7f 0 0 0 7f 0 0 7f 0 0 0 7f 0 7f 0 7f 0 4 7f 0 7e 0 7f 0 0 0 0 0 30 64 1 3c 0 0 7d 7 0 0 0 1 3 0 2 9 0 29 29 29 29 0 0 0 0 0 0 18 14 0 18 14 4 7f 22 7f f7").slice(4, 4 + 439));

var comboEditBufferDataDump
    = decodePackedMS(unpackHexMessage("f0 1 26 37 0 11 32 0 0 1 2a 18 0 33 0 0 1 0 0 0 0 0 0 40 0 0 0 37 0 7f 0 0 1 7f 0 0 0 0 0 0 0 0 7f 0 0 0 14 1e 19 35 0 7f 0 50 0 0 0 0 50 0 0 0 0 0 50 0 0 0 0 0 50 0 0 0 0 9 1 c 0 0 10 0 2 29 0 0 0 7f 0 0 7f 0 0 0 7f 0 0 7f 0 7f 20 0 7f 0 7f 0 7e 0 0 7f 0 0 0 1 3c 64 0 1 3c 0 7d 2 0 0 0 0 1 1 2 9 0 29 0 29 29 29 0 0 0 0 0 0 0 7f 7e 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 4c 6f 63 71 75 0 69 72 65 63 20 44 72 0 79 4a 61 6d 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 11 32 2 0 72 1 2a 18 33 1 0 0 1 0 0 0 1 0 30 8 0 57 25 1 1e 0 0 0 1 7f 0 0 0 0 0 0 0 0 7f 0 0 0 2e 10 24 35 0 25 17 0 12 0 9 0 50 0 0 0 0 0 50 0 0 0 0 50 0 0 0 0 0 0 7f 0 0 0 0 0 0 0 0 0 7f 0 0 0 7f 0 0 7f 0 0 0 7f 0 7f 0 7f 0 4 7f 0 7e 0 7f 0 0 0 0 0 30 64 1 3c 0 0 7d 7 0 0 0 1 3 0 2 9 0 29 29 29 29 0 0 0 0 0 0 18 14 0 18 14 4 7f 22 7f 7e 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 41 0 63 69 64 20 42 61 73 0 73 20 4c 69 6e 65 20 0 20 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 11 32 2 0 1 2a 0 18 33 0 0 1 0 0 0 0 0 0 40 62 0 0 1 24 32 0 0 1 7f 0 0 0 0 0 0 0 0 7f 0 0 1 0 19 0 0 0 0 61 50 0 0 0 0 50 0 0 0 0 0 50 0 0 0 0 0 50 0 0 0 0 0 0 7f 0 0 0 0 0 0 0 0 0 7f 0 0 7f 0 0 0 7f 0 0 7f 0 40 7f 0 7f 0 7f 0 7e 0 0 7f 0 0 0 0 3c 0 64 1 3c 0 7d 2 0 0 0 0 1 1 0 0 0 0 29 29 29 29 0 0 0 0 0 0 7f 0 7e 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 41 63 69 64 0 20 48 48 20 20 20 20 0 20 20 20 20 20 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 5 32 0 2 0 1 2a 4 33 0 0 0 1 7f 0 0 0 0 10 40 62 64 4b 24 32 0 0 0 1 7f 0 0 0 0 0 0 0 0 7f 0 0 0 0 2e 0 22 0 7f 50 0 0 0 0 0 50 0 0 0 0 0 50 0 0 0 0 50 0 0 0 0 0 0 7f 0 0 0 0 0 0 0 0 0 0 7f 0 0 7f 0 0 7f 0 0 0 7f 0 7f 0 7f 8 0 7f 0 7e 0 7f 0 0 0 0 0 3c 64 1 3c 0 0 7d 2 0 0 0 1 0 1 0 0 0 29 29 29 0 29 0 0 0 0 0 7f 0 7f 0 7f 7e 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 41 63 69 64 20 48 48 0 20 20 20 20 20 20 20 0 20 20 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 f7").slice(4, 4 + 1171));

function decodePackedMS(packed)
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

var tetraParameterNames = ["OSC 1 FREQ",
                           "OSC 1 FREQ FINE",
                           "OSC 1 SHAPE",
                           "GLIDE 1",
                           "OSC 1 KEY",
                           "OSC 2 FREQ",
                           "OSC 2 FREQ FINE",
                           "OSC 2 SHAPE",
                           "GLIDE 2",
                           "OSC 2 KEY",
                           "SYNC",
                           "GLIDE MODE",
                           "OSC SLOP",
                           "OSC MIX",
                           "NOISE LEVEL",
                           "FILTER FREQ",
                           "RESONANCE",
                           "FIL KEY AMT",
                           "FIL AUDIO MOD",
                           "FILTER POLES",
                           "FILTER ENV AMT",
                           "FIL ENV VEL AMT",
                           "FIL DEL",
                           "FIL ATT",
                           "FIL DEC",
                           "FIL SUS",
                           "FIL REL",
                           "VCA LEVEL",
                           "OUTPUT PAN",
                           "PRESET VOLUME",
                           "VCA ENV AMOUNT",
                           "VCA ENV VEL AMT",
                           "VCA DEL",
                           "VCA ATT",
                           "VCA DEC",
                           "VCA SUS",
                           "VCA REL",
                           "LFO 1 FREQ",
                           "LFO 1 SHAPE",
                           "LFO 1 AMT",
                           "LFO 1 DEST",
                           "LFO 1 SYNC",
                           "LFO 2 FREQ",
                           "LFO 2 SHAPE",
                           "LFO 2 AMT",
                           "LFO 2 DEST",
                           "LFO 2 SYNC",
                           "LFO 3 FREQ",
                           "LFO 3 SHAPE",
                           "LFO 3 AMT",
                           "LFO 3 DEST",
                           "LFO 3 SYNC",
                           "LFO 4 FREQ",
                           "LFO 4 SHAPE",
                           "LFO 4 AMT",
                           "LFO 4 DEST",
                           "LFO 4 SYNC",
                           "ENV3 DEST",
                           "ENV3 AMT",
                           "ENV 3 VEL AMT",
                           "ENV 3 DELAY",
                           "ENV3 ATT",
                           "ENV3 DEC",
                           "ENV3 SUS",
                           "ENV3 REL",
                           "MOD SOURCE 1",
                           "MOD AMT 1",
                           "MOD DEST 1",
                           "MOD SOURCE 2",
                           "MOD AMT 2",
                           "MOD DEST 2",
                           "MOD SOURCE 3",
                           "MOD AMT 3",
                           "MOD DEST 3",
                           "MOD SOURCE 4",
                           "MOD AMT 4",
                           "MOD DEST 4",
                           "SEQ 1 DEST",
                           "SEQ 2 DEST",
                           "SEQ 3 DEST",
                           "SEQ 4 DEST",
                           "MOD WHEEL AMT",
                           "MOD WHEEL DEST",
                           "PRESSURE AMT",
                           "PRESSURE DEST",
                           "BREATH AMT",
                           "BREATH DEST",
                           "VELOCITY AMT",
                           "VELOCITY DEST",
                           "FOOT AMT",
                           "FOOT DEST",
                           "TEMPO",
                           "TIME SIG",
                           "PBEND RANGE",
                           "SEQ TRIGGER",
                           "UNISON ASSIGN",
                           "UNISON MODE",
                           "ARP MODE",
                           "ENV3 REPEAT",
                           "UNISON ON OFF",
                           "ARP ON OFF",
                           "SEQ ON OFF",
                           undefined,
                           undefined,
                           undefined,
                           "PARAM ENC SEL V1",
                           "PARAM ENC SEL V2",
                           "PARAM ENC SEL V3",
                           "PARAM ENC SEL V4",
                           undefined,
                           "FEEDBACK GAIN",
                           "PUSH IT NOTE",
                           "PUSH IT VEL",
                           "PUSH IT MODE",
                           "SUB OSC 1 LVL",
                           "SUB OSC 2 LVL",
                           "FEEDBACK VOL",
                           "EDITOR BYTE",
                           "KBD SPLIT POINT",
                           "KBD MODE"];

function dumpProgramParameters(data)
{
    for (var i = 0; i < 120; i++) {
        var name = tetraParameterNames[i];
        if (name) {
            console.log(name + ": " + data[i] + "  " + data[i + 200]);
        }
    }
    console.log(String.fromCharCode.apply(null, data.slice(184, 200)));
}

dumpProgramParameters(programEditBufferDataDump);
