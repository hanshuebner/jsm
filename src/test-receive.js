
var MIDI = require('MIDI');

var midiInput = new MIDI.MIDIInput();
console.log("opened MIDI input port", midiInput.portName);

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