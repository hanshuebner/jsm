
var MIDI = require('./build/default/MIDI.node');

console.log('inputs: ', MIDI.inputPorts());
console.log('outputs: ', MIDI.outputPorts());

var port = MIDI.outputPorts()[0];

console.log('opening port "' + port + '"');

var output = new MIDI.MIDIOutput(port, 1);
console.log('prototype:', output.prototype);

output.sendNote = function (note, velocity, time) {
    this.send('9' + (this.channel || 0).toString(16) + ' ' + note.toString(16) + ' ' + (velocity || 0).toString(16),
             time);
}

output.send('f0 00 01 02 f7');

function sendSomeNotes(channel, basePitch, velocity) {
    output.channel = channel || 0;
    for (var i = 0; i < 3; i++) {
        var pitch = basePitch + i * 12;
        var period = 400;

        output.sendNote(pitch, velocity, i * period);
        output.sendNote(pitch+3, velocity, i * period);
        output.sendNote(pitch+7, velocity, i * period);
        output.sendNote(pitch+10, velocity, i * period);

        output.sendNote(pitch, 0, i * period + 100);
        output.sendNote(pitch+3, 0, i * period + 100);
        output.sendNote(pitch+7, 0, i * period + 100);
        output.sendNote(pitch+10, 0, i * period + 100);

        console.log('sent ' + i);
    }
}

sendSomeNotes(0, 64, 45);

output.close();

function loopTest () {
    var x = 0;
    while (++x) {
        var output = new MIDI.MIDIOutput(port);
        output.close();
        console.log(x);
    }
}

var stop;

setTimeout(function () { stop = 1; }, 1000);
function isStopped() {
    if (!stop) {
        process.nextTick(isStopped);
    }
}

isStopped();