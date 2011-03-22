
var MIDI = require('MIDI');

console.log('inputs: ', MIDI.inputPorts());

var port = process.env.MIDI_INPUT || MIDI.inputPorts()[0];

console.log('opening port "' + port + '"');

var midiInput = new MIDI.MIDIInput(port);

midiInput.on('sysex', function (message) {
    console.log('sysex:', MIDI.messageToString(message));
});
midiInput.on('timingClock', function () {
    console.log('timingClock');
});
midiInput.on('controlChange', function (controller, value, channel) {
    console.log('controlChange: controller', controller, 'value', value, 'channel', channel);
});


