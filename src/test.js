
var MIDI = require('./build/default/MIDI.node');

console.log('inputs: ', MIDI.inputPorts());
console.log('outputs: ', MIDI.outputPorts());

var port = MIDI.outputPorts()[0];

console.log('opening port "' + port + '"');
var output = MIDI.openOutput(port);

