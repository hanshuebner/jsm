
var MIDI = require('MIDI');

var port = process.env.MIDI_INPUT || MIDI.inputPorts()[0];

console.log('opening port "' + port + '"');

var midiInput = new MIDI.MIDIInput(port);

midiInput.on('nrpn14', function (nrpn, value, channel) {
    console.log('nrpn14', nrpn, 'value', value, 'channel', channel);
});
try {
    midiInput.on('nrpn7', function (nrpn, value, channel) {
        console.log('nrpn7', nrpn, 'value', value, 'channel', channel);
    });
}
catch (e) {
    console.log("caught expected error:", e);
}