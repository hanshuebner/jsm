
var MIDI = require('./build/default/MIDI.node');

console.log('inputs: ', MIDI.inputPorts());
console.log('outputs: ', MIDI.outputPorts());

var port = MIDI.outputPorts()[0];

console.log('opening port "' + port + '"');
var output = new MIDI.MIDIOutput(port);
for (var i = 0; i < 128; i++) {
    output.send('90 64 ' + i);
    console.log('sent ' + i);
}
output.close();