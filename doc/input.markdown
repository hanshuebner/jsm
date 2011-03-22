## MIDIInput

The `MIDIInput` objects represents a handle to a MIDI input port.
Its constructor function accepts a port name as argument.

Applications are notified by incoming messages by the way of events
that are delivered to callbacks, using the standard node event
handling idiom.

### MIDIInput(portName)

Return a `MIDIInput` object opened to the port with the given
`portName`.

## Higher-level events

### Event: 'nrpn7'
### Event: 'nrpn14'

`function (parameterNumber, value, channel) { }`

Emitted when an NRPN control change has been received.  NRPNs are a
sort of extended parameters that allow for a larger number of
parameters with a wider value range to be submitted.  The parameter
number is represented by 14 bits sent in two controlChange message for
controller 0x63 (MSB) and 0x62 (LSB), the value is either 7 bits sent
as controlChange for controller 0x06, or 14 bits sent in two
controlChange messages for controller 0x06 (MSB) and 0x26 (LSB).  To
change the value of an NRPN controller, the sender first sends the
parameter number as two controlChange messages for controller 0x63
(MSB) and 0x62 (LSB) followed by the value, either as one message for
controller 0x06 or as two messages for controller 0x06 (MSB) and
controller 0x26.

When the NRPN controller number has been selected, the sender can also
send incremental changes using the controller number 0x60 (increment)
or 0x61 (decrement).

The sender does not need to re-select the NRPN controller for each
value change.  Rather, the NRPN controller is kept selected until
overwritten.  For NRPN controllers in 14 bit mode, it is possible to
send only the LSB after the controller number and the MSB have been
sent.

The 'nrpn7' and 'nrpn14' events are emitted to the application
whenever a new value has been completely received, either through an
incremental or an absolute change message.

## Standard MIDI message events

Applications can listen for any of the standard MIDI messages as
listed below.  Event handlers are called with the message argument(s)
parsed as integer values.

### Event: 'noteOn'

`function (pitch, velocity, channel) { }`

### Event: 'noteOff'

`function (pitch, velocity, channel) { }`

### Event: 'polyphonicKeyPressure'

`function (pitch, velocity, channel) { }`

### Event: 'controlChange'

`function (controllerNumber, controllerValue, channel) { }`

### Event: 'programChange'

`function (programNumber, channel) { }`

### Event: 'channelPressure'

`function (pressureValue, channel) { }`

### Event: 'pitchWheelChange'

`function (valueLsb, valueMsb, channel) { }`

## System Common Messages

### Event: 'sysex'

`function (argument) { }`

Emitted when a system exclusive message has been received.  The
message is passed as an array of numbers, including the 0xf0 and 0xf7
message delimiters.

### Event: 'midiTimeCode'

`function (argument) { }`

### Event: 'songPositionPointer'

`function (positionLsb, positionMsb) { }`

### Event: 'songSelect'

`function (songNumber) { }`

### Event: 'tuneRequest'

`function () { }`

## System Real-Time Messages

### Event: 'timingClock'

`function () { }`

### Event: 'tick'

`function () { }`

### Event: 'start'

`function () { }`

### Event: 'stop'

`function () { }`

### Event: 'continue'

`function () { }`

### Event: 'activeSensing'

`function () { }`

### Event: 'reset'

`function () { }`

### MIDIOutput.channels(argument)

Establish the channel mask for received messages.  By default,
messages for all channels are received.

The `argument` may be either the string 'all' to listen to all
channels, a single channel number or an array of channel numbers to
listen to.  Channel numbers are one-based.