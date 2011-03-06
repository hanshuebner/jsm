
var MIDI = require('./build/default/MIDI.node');

console.log('inputs: ', MIDI.inputPorts());
console.log('outputs: ', MIDI.outputPorts());

var port = MIDI.inputPorts()[0];

console.log('opening port "' + port + '"');

var midiInput = new MIDI.MIDIInput(port);

midiInput.listen(0xffff, 0);

function pollMIDI() {
    midiInput.recv(function (error, messages) {
        if (error) {
            console.log('error:', error);
        }
        if (messages) {
            console.log('messages:', messages);
        }
    });
    process.nextTick(pollMIDI);
}

pollMIDI();


