var fs = require('fs');
var _ = require('underscore');
var tetra = require('./controllers/tetra.js');

var sysexFilename = process.argv[2];
if (!sysexFilename.match(/\.syx$/)) {
    throw Error('sysex filename must end with .syx');
}
var jsonFilename = sysexFilename.replace(/\.syx$/, '.json');

console.log('reading presets from', sysexFilename);
var presets = tetra.readSysexDump(sysexFilename, function (err, presets) {
    if (err) throw err;
    _.each(presets, function (preset) {
        preset.labels = [];
        if (preset.parameters[100]) {
            console.log('arp preset', preset.name, 'arp', preset.parameters[100], 'arp b', preset.parameters[201]);
            preset.labels.push('arp');
        }
        if (preset.parameters[101]) {
            console.log('seq preset', preset.name, 'seq a', preset.parameters[100], 'seq b', preset.parameters[201]);
            preset.labels.push('seq');
        }
    });
    fs.writeFileSync(jsonFilename, JSON.stringify(presets));
    console.log('done,', presets.length, 'presets');
});