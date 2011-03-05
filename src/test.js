
var MIDI = require('./build/default/MIDI.node');

console.log('inputs: ', MIDI.inputPorts());
console.log('outputs: ', MIDI.outputPorts());

var port = MIDI.outputPorts()[0];

console.log('opening port "' + port + '"');

var output = new MIDI.MIDIOutput(port);
console.log('prototype:', output.prototype);

output.sendNote = function (note, velocity, time) {
    this.send('9' + (this.channel || 0).toString(16) + ' ' + note.toString(16) + ' ' + (velocity || 0).toString(16),
             time);
}

function sendSomeNotes(channel, velocity) {
    output.channel = channel || 0;
    for (var i = 0; i < 3; i++) {
        var pitch = 64 + i * 12;
        output.sendNote(pitch, velocity, i * 1000);
        output.sendNote(pitch, 0, i * 1000 + 100);
        console.log('sent ' + i);
    }
}

sendSomeNotes(0, 45);

output.close();

function loopTest () {
    var x = 0;
    while (++x) {
        var output = new MIDI.MIDIOutput(port);
        output.close();
        console.log(x);
    }
}
