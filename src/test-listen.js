
var MIDI = require('MIDI');

console.log('inputs: ', MIDI.inputPorts());

var port = process.env.MIDI_INPUT || MIDI.inputPorts()[0];

console.log('opening port "' + port + '"');

var midiInput = new MIDI.MIDIInput(port);

midiInput.on('sysex', function (message, time) {
    console.log('sysex:', MIDI.messageToString(message), 'time', time);
});
midiInput.on('timingClock', function (time) {
    console.log('timingClock', 'time', time);
});
midiInput.on('controlChange', function (controller, value, channel, time) {
    console.log('controlChange: controller', controller, 'value', value, 'channel', channel, 'time', time);
});


