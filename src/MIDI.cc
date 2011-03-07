// -*- C++ -*-

#include <iostream>
#include <iomanip>
#include <sstream>
#include <set>

#include <v8.h>
#include <node.h>
#include <node_events.h>

#include <boost/thread.hpp>

#include <portmidi.h>
#include <pmutil.h>
#include <porttime.h>

using namespace std;
using namespace boost;
using namespace v8;
using namespace node;

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
  // v8 interface
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
  virtual ~MIDIInput();

  void listen(int32_t channels, int32_t filters) throw(JSException);
  static void pollAll(PtTimestamp timestamp, void* userData);

  // v8 interface
public:
  static void Initialize(Handle<Object> target);

  static Handle<Value> New(const Arguments& args);
  static Handle<Value> listen(const Arguments& args);
  static Handle<Value> recv(const Arguments& args);

private:
  // Symbols emitted for events
  static Persistent<String> _messageSymbol;
  static Persistent<String> _clockSymbol;

  condition_variable _dataReceivedCondition;
  mutex _midiStreamMutex;

  void pollData();

  // receivers that are being polled
  static set<MIDIInput*> _receivers;
  static mutex _receiversMutex;

  static int EIO_recv(eio_req* req);
  static int EIO_recvDone(eio_req* req);

  class ReceiveContext {

    friend int MIDIInput::EIO_recv(eio_req* req);
    friend int MIDIInput::EIO_recvDone(eio_req* req);

  public:
    ReceiveContext(MIDIInput* midiInput, Persistent<Function> callback)
      : _midiInput(midiInput), _callback(callback) {}

    enum { RECV_EVENTS = 16 };

    PmEvent* eventsBuffer() { return _events; }
    void readCompleted(int readReturnCode) { _readReturnCode = readReturnCode; }

  private:
    MIDIInput* _midiInput;
    Persistent<Function> _callback;
    int _readReturnCode;
    PmEvent _events[RECV_EVENTS];
  };

  void waitForData(ReceiveContext* context);
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

// v8 interface

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

  MIDIInput::Initialize(target);
  MIDIOutput::Initialize(target);
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
  return Undefined();
}

// //////////////////////////////////////////////////////////////////
// MIDIInput methods
// //////////////////////////////////////////////////////////////////

Persistent<String> MIDIInput::_messageSymbol;
Persistent<String> MIDIInput::_clockSymbol;

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

  unique_lock<mutex> lock(_receiversMutex);
  _receivers.insert(this);
}

MIDIInput::~MIDIInput()
{
  unique_lock<mutex> lock(_receiversMutex);
  _receivers.erase(this);
}

void
MIDIInput::listen(int32_t channels,
                  int32_t filters)
  throw(JSException)
{
  PmError e = Pm_SetChannelMask(_pmMidiStream, channels);
  if (e < 0) {
    throw JSException("cannot set MIDI channels");
  }

  e = Pm_SetFilter(_pmMidiStream, filters);
  if (e < 0) {
    throw JSException("cannot set MIDI filter");
  }
}

// v8 interface

Handle<Value>
MIDIInput::New(const Arguments& args)
{
  HandleScope scope;

  string portName = *String::Utf8Value(args[0]);
  int portId = MIDI::getPortIndex(MIDI::INPUT, portName);
  if (portId < 0) {
    string errorMessage = (string) "Invalid MIDI input port name: " + portName;
    return ThrowException(String::New(errorMessage.c_str()));
  }

  try {
    MIDIInput* midiInput = new MIDIInput(portId);
    midiInput->Wrap(args.This());
    return args.This();
  }
  catch (JSException& e) {
    return e.asV8Exception();
  }
}

Handle<Value>
MIDIInput::listen(const Arguments& args)
{
  HandleScope scope;

  int32_t channels = 0xffff;
  int32_t filters = PM_FILT_ACTIVE | PM_FILT_CLOCK | PM_FILT_PLAY | PM_FILT_UNDEFINED | PM_FILT_RESET | PM_FILT_TICK;

  switch (args.Length()) {
  case 2:
    filters = args[1]->Int32Value();
  case 1:
    channels = args[0]->Int32Value();
  case 0:
    break;
  default:
      return ThrowException(String::New("too many arguments to MIDIInput listen"));
  }

  try {
    MIDIInput* midiInput = ObjectWrap::Unwrap<MIDIInput>(args.This());
    midiInput->listen(channels, filters);
    return Undefined();
  }
  catch (JSException& e) {
    return e.asV8Exception();
  }
}

set<MIDIInput*> MIDIInput::_receivers;
mutex MIDIInput::_receiversMutex;

void
MIDIInput::pollAll(PtTimestamp timestamp, void* userData)
{
  unique_lock<mutex> lock(_receiversMutex);
  for (set<MIDIInput*>::iterator i = _receivers.begin(); i != _receivers.end(); i++) {
    (*i)->pollData();
  }
}

void
MIDIInput::pollData()
{
  unique_lock<mutex> lock(_midiStreamMutex);
  if (Pm_Poll(_pmMidiStream)) {
    _dataReceivedCondition.notify_one();
  }
}

void
MIDIInput::waitForData(ReceiveContext* context)
{
  unique_lock<mutex> lock(_midiStreamMutex);
  while (!Pm_Poll(_pmMidiStream)) {
    _dataReceivedCondition.wait(lock);
  }

  context->readCompleted(Pm_Read(_pmMidiStream, context->eventsBuffer(), ReceiveContext::RECV_EVENTS));
}

int
MIDIInput::EIO_recv(eio_req* req)
{
  ReceiveContext* context = static_cast<ReceiveContext*>(req->data);
  MIDIInput* midiInput = context->_midiInput;

  midiInput->waitForData(context);

  return 0;
}

int
MIDIInput::EIO_recvDone(eio_req* req)
{
  HandleScope scope;
  ReceiveContext* context = static_cast<ReceiveContext*>(req->data);
  ev_unref(EV_DEFAULT_UC);
  context->_midiInput->Unref();

  Local<Value> argv[2];
  argv[0] = *Undefined();
  argv[1] = *Undefined();

  if (context->_readReturnCode < 0) {
    argv[1] = Exception::Error(String::New("error receiving"));
  } else if (context->_readReturnCode > 0) {
    Local<Array> events = Array::New(context->_readReturnCode);
    for (int i = 0; i < context->_readReturnCode; i++) {
      PmMessage message = context->_events[i].message;
      ostringstream os;
      os << hex
         << Pm_MessageStatus(message)
         << " " << Pm_MessageData1(message)
         << " " << Pm_MessageData2(message);
      string s = os.str();
      events->Set(i, String::New(s.c_str()));
    }
    argv[0] = events;
  }

  TryCatch tryCatch;
  context->_callback->Call(Context::GetCurrent()->Global(), 2, argv);

  if (tryCatch.HasCaught()) {
    FatalException(tryCatch);
  }

  context->_callback.Dispose();

  delete context;

  return 0;
}

Handle<Value>
MIDIInput::recv(const Arguments& args)
{
  HandleScope scope;

  if (args.Length() != 1
      || !args[0]->IsFunction()) {
    return ThrowException(String::New("need one callback function argument in recv"));
  }

  MIDIInput* midiInput = ObjectWrap::Unwrap<MIDIInput>(args.This());
  midiInput->Ref();

  eio_custom(EIO_recv,
             EIO_PRI_DEFAULT,
             EIO_recvDone,
             new ReceiveContext(midiInput,
                                Persistent<Function>::New(Local<Function>::Cast(args[0]))));
  ev_ref(EV_DEFAULT_UC);

  return Undefined();
}

void
MIDIInput::Initialize(Handle<Object> target)
{
  HandleScope scope;

  Handle<FunctionTemplate> midiInputTemplate = FunctionTemplate::New(New);
  midiInputTemplate->InstanceTemplate()->SetInternalFieldCount(1);

  NODE_SET_PROTOTYPE_METHOD(midiInputTemplate, "close", MIDIStream::close);
  NODE_SET_PROTOTYPE_METHOD(midiInputTemplate, "listen", listen);
  NODE_SET_PROTOTYPE_METHOD(midiInputTemplate, "recv", recv);

  _messageSymbol = NODE_PSYMBOL("message");
  _clockSymbol = NODE_PSYMBOL("clock");

  target->Set(String::NewSymbol("MIDIInput"), midiInputTemplate->GetFunction());
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
    return Undefined();
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
    Pt_Start(1, &MIDIInput::pollAll, 0);
    Pm_Initialize();
    HandleScope handleScope;
    
    MIDI::Initialize(target);
  }

  NODE_MODULE(MIDI, init);
}

