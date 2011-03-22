## MIDI utility functions

### MIDI.inputPorts()
### MIDI.outputPorts()

Return the available MIDI input port and output port names, as arrays
of strings.

### MIDI.pitchToNote(pitch)

Convert the given integer MIDI `pitch` to a note name string.

### MIDI.noteToPitch(noteName)

Convert the given `noteName` string to a MIDI integer pitch.

### MIDI.messageToString(message)

Convert the given binary `message`, an array containing integer
values, to a string of hex bytes separated by spaces.
