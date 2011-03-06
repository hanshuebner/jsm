// -*- C++ -*-

#include <iostream>
#include <iomanip>
#include <sstream>

#include <v8.h>
#include <node.h>
#include <node_events.h>

#include <portmidi.h>

using namespace v8;
using namespace node;
using namespace std;

class JSException
{
public:
  JSException(const string& text) : _message(text) {};
  const string& message() const { return _message; }
  Handle<Value> asV8Exception() const { return ThrowException(String::New(message().c_str())); }

private:
  string _message;
};

class MIDI
{
public:
  static void Initialize(Handle<Object> target);

  enum PortDirection { INPUT, OUTPUT };

  // Get id of MIDI port with the given name.  Returns the ID or -1 if
  // no MIDI device with the given name is found
  static int getPortIndex(PortDirection direction, string name);

private:
  static Handle<Value> getPorts(PortDirection direction);
  static Handle<Value> inputPorts(const Arguments& args);
  static Handle<Value> outputPorts(const Arguments& args);

};

class MIDIStream
{
public:
  virtual ~MIDIStream();
  virtual void close();

  static Handle<Value> close(const Arguments& args);
protected:
  PmStream* _pmMidiStream;

  enum { MIDISTREAM_BUFSIZE = 16384 };
};

class MIDIInput
  : public EventEmitter,
    public MIDIStream
{
public:
  MIDIInput(int portId) throw(JSException);

  // v8 interface
public:
  static void Initialize(Handle<Object> target);

private:
  // Symbols emitted for events
  static Persistent<String> _messageSymbol;
  static Persistent<String> _clockSymbol;
};

class MIDIOutput
  : public ObjectWrap,
    public MIDIStream
{
public:
  MIDIOutput(int portId, int32_t latency) throw(JSException);

  void send(const string& messageString,
            PmTimestamp when = 0)
    throw(JSException);

  int32_t latency() const { return _latency; }

private:
  int32_t _latency;

  // v8 interface
public:
  static void Initialize(Handle<Object> target);
  virtual void Dispose() { cout << "MIDIOutput::Dispose()" << endl; }

  static Handle<Value> New(const Arguments& args);
  static Handle<Value> send(const Arguments& args);
};

// //////////////////////////////////////////////////////////////////
// MIDI methods
// //////////////////////////////////////////////////////////////////

int
MIDI::getPortIndex(PortDirection direction, string name)
{
  for (int id = 0; id < Pm_CountDevices(); id++) {
    const PmDeviceInfo* deviceInfo = Pm_GetDeviceInfo(id);
    if (((direction == INPUT) ^ deviceInfo->output)
        && (name == deviceInfo->name)) {
      return id;
    }
  }
  return -1;
}

Handle<Value>
MIDI::getPorts(PortDirection direction)
{
  Local<Array> retval = Array::New();
  unsigned count = 0;
  for (int id = 0; id < Pm_CountDevices(); id++) {
    const PmDeviceInfo* deviceInfo = Pm_GetDeviceInfo(id);
    if ((direction == INPUT) ^ deviceInfo->output) {
      retval->Set(count++, String::New(deviceInfo->name));
    }
  }
  return retval;
}

Handle<Value>
MIDI::inputPorts(const Arguments& args)
{
  return getPorts(INPUT);
}

Handle<Value>
MIDI::outputPorts(const Arguments& args)
{
  return getPorts(OUTPUT);
}

void
MIDI::Initialize(Handle<Object> target) {
  HandleScope scope;

  target->Set(String::NewSymbol("inputPorts"), FunctionTemplate::New(inputPorts)->GetFunction());
  target->Set(String::NewSymbol("outputPorts"), FunctionTemplate::New(outputPorts)->GetFunction());

  MIDIOutput::Initialize(target);
  
  /*
  _messageSymbol = NODE_PSYMBOL("message");
  _clockSymbol = NODE_PSYMBOL("clock");
  */
}

// //////////////////////////////////////////////////////////////////
// MIDIStream methods
// //////////////////////////////////////////////////////////////////


MIDIStream::~MIDIStream()
{
  close();
}

void
MIDIStream::close()
{
  if (_pmMidiStream) {
    Pm_Close(_pmMidiStream);
    _pmMidiStream = 0;
  }
}

Handle<Value>
MIDIStream::close(const Arguments& args)
{
  HandleScope scope;
  MIDIStream* midiStream = ObjectWrap::Unwrap<MIDIStream>(args.This());
  midiStream->close();
  return Handle<Value>();
}

// //////////////////////////////////////////////////////////////////
// MIDIInput methods
// //////////////////////////////////////////////////////////////////

MIDIInput::MIDIInput(int portId)
  throw(JSException)
{
  PmError e = Pm_OpenInput(&_pmMidiStream, 
                           portId, 
                           0,                  // driver info
                           MIDISTREAM_BUFSIZE, // buffer size
                           0,                  // time proc
                           0);                 // time info

  if (e < 0) {
    throw JSException("could not open MIDI input port");
  }
}

// //////////////////////////////////////////////////////////////////
// MIDIOutput methods
// //////////////////////////////////////////////////////////////////

MIDIOutput::MIDIOutput(int portId, int32_t latency)
  throw(JSException)
  : _latency(latency)
{
  PmError e = Pm_OpenOutput(&_pmMidiStream, 
                            portId, 
                            0,                  // driver info
                            MIDISTREAM_BUFSIZE, // queue size
                            0,                  // time proc
                            0,                  // time info
                            latency);           // latency

  if (e < 0) {
    throw JSException("could not open MIDI output port");
  }
}

void
MIDIOutput::send(const string& messageString, PmTimestamp when)
  throw(JSException)
{
  cout << "send \"" << messageString << "\" at " << when << endl;
  istringstream is(messageString);

  unsigned int statusByte;
  is >> hex >> statusByte;

  if (statusByte == 0xf0) {
    // send sysex message
    unsigned char buf[messageString.size()];    // allocate plenty of buffer
    buf[0] = 0xf0;
    int count = 1;
    while (!is.eof()) {
      unsigned byte;
      is >> hex >> byte;
      if (is.fail()) {
        throw JSException("error decoding hex byte in sysex message");
      }
      buf[count++] = byte;
    }
    if (buf[count - 1] != 0xf7) {
      throw JSException("sysex message must be terminated by 0xf7");
    }
    PmError e = Pm_WriteSysEx(_pmMidiStream, when, buf);

    if (e < 0) {
      throw JSException("could not send MIDI sysex message");
    }
  } else {

    unsigned int data1;
    is >> hex >> data1;
    unsigned int data2;
    is >> hex >> data2;

    PmError e = Pm_WriteShort(_pmMidiStream, when, Pm_Message(statusByte, data1, data2));

    if (e < 0) {
      throw JSException("could not send MIDI message");
    }
  }
}

// v8 interface

Handle<Value>
MIDIOutput::New(const Arguments& args)
{
  HandleScope scope;

  string portName = *String::Utf8Value(args[0]);
  int portId = MIDI::getPortIndex(MIDI::OUTPUT, portName);
  if (portId < 0) {
    string errorMessage = (string) "Invalid MIDI output port name: " + portName;
    return ThrowException(String::New(errorMessage.c_str()));
  }

  int32_t latency = 0;
  if (args.Length() > 1) {
    latency = args[1]->Int32Value();
  }

  try {
    MIDIOutput* midiOutput = new MIDIOutput(portId, latency);
    midiOutput->Wrap(args.This());
    return args.This();
  }
  catch (JSException& e) {
    return e.asV8Exception();
  }
}

Handle<Value>
MIDIOutput::send(const Arguments& args)
{
  HandleScope scope;
  MIDIOutput* midiOutput = ObjectWrap::Unwrap<MIDIOutput>(args.This());
  string messageString = *String::Utf8Value(args[0]);
  PmTimestamp when = 0;

  if (args.Length() > 1) {
    if (!midiOutput->latency()) {
      return ThrowException(String::New("can't delay message sending on MIDI output stream opened with zero latency"));
    }

    when = args[1]->Int32Value();
  }

  try {
    midiOutput->send(messageString, when);
    return Handle<Value>();
  }
  catch (JSException& e) {
    return e.asV8Exception();
  }
}

void
MIDIOutput::Initialize(Handle<Object> target)
{
  HandleScope scope;

  Handle<FunctionTemplate> midiOutputTemplate = FunctionTemplate::New(New);
  midiOutputTemplate->InstanceTemplate()->SetInternalFieldCount(1);

  NODE_SET_PROTOTYPE_METHOD(midiOutputTemplate, "send", send);
  NODE_SET_PROTOTYPE_METHOD(midiOutputTemplate, "close", MIDIStream::close);

  target->Set(String::NewSymbol("MIDIOutput"), midiOutputTemplate->GetFunction());
}

// //////////////////////////////////////////////////////////////////
// Initialization interface
// //////////////////////////////////////////////////////////////////

extern "C" {
  static void init (Handle<Object> target)
  {
    Pm_Initialize();
    HandleScope handleScope;
    
    MIDI::Initialize(target);
  }

  NODE_MODULE(MIDI, init);
}

