
var MIDI = require('MIDI');

console.log('outputs: ', MIDI.outputPorts());

var port = process.env.MIDI_OUTPUT || MIDI.outputPorts()[0];

console.log('opening port "' + port + '"');

var output = new MIDI.MIDIOutput(port, 1);

output.send('f0 00 01 02 f7');

try {
    output.send([]);
}
catch (e) {
    console.log('expectedly caught error:', e);
}

output.send([0xb0, 90]);

try {
    output.send([0xb0, 90, 1, 2, 3]);
}
catch (e) {
    console.log('expectedly caught error:', e);
}

try {
    output.send({foo: 1});
}
catch (e) {
    console.log('expectedly caught error:', e);
}

try {
    output.sysex([]);
}
catch (e) {
    console.log('expectedly caught error:', e);
}

try {
    output.sysex([0xf0]);
}
catch (e) {
    console.log('expectedly caught error:', e);
}

try {
    output.sysex([0xf0, 1, 2, 3, 0xf7]);
}
catch (e) {
    console.log('expectedly caught error:', e);
}

output.send([0xb0, 1.0, 3.0]);

function sendSomeNotes(channel, basePitch, velocity) {
    output.channel(channel);
    for (var i = 0; i < 3; i++) {
        var pitch = basePitch + i * 12;
        var period = 400;

        output.noteOn(pitch, velocity, i * period);
        output.noteOn(pitch+3, velocity, i * period);
        output.noteOn(pitch+7, velocity, i * period);
        output.noteOn(pitch+10, velocity, i * period);

        output.noteOn(pitch, 0, i * period + 100);
        output.noteOn(pitch+3, 0, i * period + 100);
        output.noteOn(pitch+7, 0, i * period + 100);
        output.noteOn(pitch+10, 0, i * period + 100);

        console.log('sent ' + i);
    }
}

sendSomeNotes(1, 64, 45);

setTimeout(function () {
    output.noteOn('C3', 127, 100);
    output.noteOn('C3', 0, 1100);
    output.noteOn('C4', 127, 1250);
    output.noteOn('C4', 0, 1350);
    output.noteOn('c3', 127, 1500);
    output.noteOn('c3', 0, 1600);
    output.noteOn('C5', 127, 1750);
    output.noteOn('C5', 0, 1850);
}, 1000);

MIDI.at(1850, function () { console.log("should be all done"); });

output.controlChange(20, 30);
output.channel(2);
output.controlChange(20, 30);

output.nrpn14(1024, 1024);
output.nrpn7(1024, 127);
try {
    output.nrpn7(1024, 1024);
}
catch (e) {
    console.log('caught expected error:', e);
}
output.noteOn('C3', 127, 2500);
output.noteOn('C3', 0, 3000);