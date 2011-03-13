
var MIDI = require('MIDI');

console.log('inputs: ', MIDI.inputPorts());
console.log('outputs: ', MIDI.outputPorts());

var port = MIDI.inputPorts()[0];

console.log('opening port "' + port + '"');

var midiInput = new MIDI.MIDIInput(port);

midiInput.on('sysex', function (message) {
    console.log('sysex:', MIDI.messageToString(message));
});
midiInput.on('controlChange', function (controller, value) {
    console.log('controlChange: controller', controller, 'value', value);
});

midiInput.listen();

