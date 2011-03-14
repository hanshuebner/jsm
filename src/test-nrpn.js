
var MIDI = require('MIDI');

console.log(MIDI);

var port = MIDI.inputPorts()[0];

console.log('opening port "' + port + '"');

var midiInput = new MIDI.MIDIInput(port);

midiInput.listen();

midiInput.on('nrpn', function (nrpn, value) {
    console.log('nrpn', nrpn, 'value', value);
});
midiInput.on('nrpnMsb', function (nrpn, value) {
    console.log('nrpnMsb', nrpn, 'value', value);
});

process.stdin.resume();