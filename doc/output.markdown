## MIDIOutput

The `MIDIOutput` object represents a handle to a MIDI output port.
Its constructor function accepts a port name as argument.  It has a
`send()` function for sending arbitary MIDI messages as well as
convenience functions for each defined MIDI message.

### MIDIOutput(portName[, latency])

Return a `MIDIOutput` object opened to the port with the given
`portName`.  If a `latency` is supplied, it determines the portmidi
latency of the port and enables deferred sending of messages.  The
`time` argument that can be supplied to all the message sending
functions below specifies the absolute time at which the message will
be sent.

### MIDIOutput.channel(channelNumber)

The channel number to use for sending messages (1 to 16).  When using
the `send()` function directly, the channel number is not used.  By
default, the MIDIOutput object sends on MIDI channel 1.

### MIDIOutput.send(message[, time])

Send a raw MIDI message.  `message` is either a string with space
separated hexadecimal values or an array of numbers.

### MIDIOutput.noteOn(pitch, velocity[, time])
### MIDIOutput.noteOff(pitch, velocity[, time])

Send a MIDI `Note On` or `Note Off` event on the current channel.
`pitch` is the pitch of the note, which may be specified either as
integer MIDI note number or as note name string (e.g. 'C0', 'F#4' or
'B-2').

### MIDIOutput.pitchWheelChange(value[, time])

Send a MIDI pitchWheelChange message with the given `value` as
argument.  `value` must be passed as a number between -8192 and 8191.

## MIDIOutput.sysex(message[, time])

Send the given MIDI sysex message.  The message must be either a
string with space separated hexadecimal values or an array of
numbers.  The start sysex (0xf0) and end sysex (0xf7) bytes must be
included in the message.  Nested messages are not allowed.

## MIDIOutput.nrpn7(parameter, value)
## MIDIOutput.nrpn14(parameter, value)

Send a NRPN message consisting of a 14 bit NRPN `parameter` and a 7
(`nrpn7`) or 14 (`nrpn14`) bit `value`.  No previous selection of the
NRPN controller number in the target device is assumed, i.e. `nrpn7`
results in three controlChange messages and `nrpn14` results in four
controlChange message to be sent to the target device.

## MIDIOutput.polyphonicKeyPressure(pitch, velocity)
## MIDIOutput.controlChange(controllerNumber, controllerValue)
## MIDIOutput.programChange(programNumber)
## MIDIOutput.channelPressure(pressureValue)
## MIDIOutput.midiTimeCode(argument)
## MIDIOutput.songPositionPointer(positionLsb, positionMsb)
## MIDIOutput.songSelect(songNumber)
## MIDIOutput.tuneRequest()
## MIDIOutput.timingClock()
## MIDIOutput.tick()
## MIDIOutput.start()
## MIDIOutput.stop()
## MIDIOutput.continue()
## MIDIOutput.activeSensing()
## MIDIOutput.reset()

Send the respective standard MIDI message with the arguments supplied
on the current channel.  No further translation of the arguments is
performed for these messages.
