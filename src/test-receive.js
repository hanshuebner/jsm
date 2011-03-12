
var MIDI = require('MIDI');

console.log('inputs: ', MIDI.inputPorts());
console.log('outputs: ', MIDI.outputPorts());

var port = MIDI.inputPorts()[0];

console.log('opening port "' + port + '"');

var midiInput = new MIDI.MIDIInput(port);

midiInput.listen(0xffff, 0);

function dumpReceivedMessage (messages, error) {
    if (error) {
        console.log('error:', error);
    } else {
        console.log('messages:', messages);
        midiInput.recvText(dumpReceivedMessage);
    }
}

midiInput.recvText(dumpReceivedMessage);


