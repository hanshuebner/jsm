
var MIDI = require('MIDI');

console.log(MIDI);

console.log('inputs: ', MIDI.inputPorts());
console.log('outputs: ', MIDI.outputPorts());

var port = MIDI.inputPorts()[0];

console.log('opening port "' + port + '"');

var midiInput = new MIDI.MIDIInput(port);

midiInput.setFilters(0xffff, 0);

function dumpReceivedMessage (midiInput, messages, error) {
    if (error) {
        console.log('error:', error);
    } else {
        console.log('messages:', messages);
        midiInput.recvText(arguments.callee);
    }
}

midiInput.recvText(dumpReceivedMessage);

midiInput.on('foo', function () {
    console.log('foo event');
});

midiInput.emit('foo');