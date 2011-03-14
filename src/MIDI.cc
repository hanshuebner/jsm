// -*- C++ -*-

#include <iostream>
#include <iomanip>
#include <sstream>
#include <set>
#include <queue>
#include <vector>

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

  enum {
    SYSEX_START = 0xf0,
    SYSEX_END = 0xf7
  };

  static bool IS_REALTIME(unsigned char status) { return (status & 0xf8) == 0xf8; }

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

  void setFilters(int32_t channels, int32_t filters) throw(JSException);
  static void pollAll(PtTimestamp timestamp, void* userData);

  // v8 interface
public:
  static void Initialize(Handle<Object> target);

  static Handle<Value> New(const Arguments& args);
  static Handle<Value> setFilters(const Arguments& args);
  static Handle<Value> recv(const Arguments& args);

private:

  condition_variable _dataReceivedCondition;
  mutex _mutex;

  void pollData();

  // receivers that are being polled
  static set<MIDIInput*> _receivers;
  static mutex _receiversMutex;

  static int EIO_recv(eio_req* req);
  static int EIO_recvDone(eio_req* req);
  void readResultsToJSCallbackArguments(Local<Value> argv[]);

  class ReceiveIOCB {

    friend int MIDIInput::EIO_recv(eio_req* req);
    friend int MIDIInput::EIO_recvDone(eio_req* req);

  public:
    ReceiveIOCB(MIDIInput* midiInput, Persistent<Object> this_, Persistent<Function> callback)
      : _midiInput(midiInput), _this(this_), _callback(callback) {}

    enum { RECV_EVENTS = 16 };

  private:
    MIDIInput* _midiInput;
    Persistent<Object> _this;
    Persistent<Function> _callback;
  };

  void waitForData(ReceiveIOCB* iocb);
  bool dataAvailable() const { return _sysexQueue.size() || _readQueue.size(); }

  PmError _error;
  queue<PmEvent> _readQueue;
  typedef vector<unsigned char> SysexMessageBuffer;
  queue<SysexMessageBuffer> _sysexQueue;
  SysexMessageBuffer _currentSysexMessage;

  bool inSysexMessage() { return _currentSysexMessage.size(); }

  void unpackSysexMessage(PmEvent message);
};

class MIDIOutput
  : public ObjectWrap,
    public MIDIStream
{
public:
  MIDIOutput(int portId, int32_t latency) throw(JSException);

  void send(const vector<unsigned char>& message,
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
MIDIInput::setFilters(int32_t channels,
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
MIDIInput::setFilters(const Arguments& args)
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
      return ThrowException(String::New("too many arguments to MIDIInput setFilters"));
  }

  try {
    MIDIInput* midiInput = ObjectWrap::Unwrap<MIDIInput>(args.This());
    midiInput->setFilters(channels, filters);
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
  unique_lock<mutex> lock(_mutex);
  if (Pm_Poll(_pmMidiStream)) {
    _dataReceivedCondition.notify_one();
  }
}

void
MIDIInput::unpackSysexMessage(PmEvent event)
{
  PmMessage message =  event.message;
  unsigned long buf = static_cast<unsigned long>(message);

  for (int i = 0; i < 4; i++) {
    unsigned char b = buf & 0xff;
    buf >>= 8;
    if (b == MIDI::SYSEX_END) {
      _currentSysexMessage.push_back(b);
      _sysexQueue.push(_currentSysexMessage);
      _currentSysexMessage.clear();
      break;
    } else if (MIDI::IS_REALTIME(b)) {
      PmEvent rtEvent;
      rtEvent.message = b;
      rtEvent.timestamp = event.timestamp;
      _readQueue.push(rtEvent);
    } else if ((b & 0x80)
               && (_currentSysexMessage.size() > 1
                   || (b != MIDI::SYSEX_START))) {
      // We're receiving some non-realtime status while receiving a
      // sysex message.  Assume that this is not an error, but flush
      // the current sysex message (i.e. the user may have unplugged
      // the cable while a sysex message was being transferred)
      _currentSysexMessage.clear();
      // Unfortunately, portmidi does not resync itself when it
      // receives a new message inside a sysex message.  We can cope
      // with another sysex message, but fail for others.
      if (b == MIDI::SYSEX_START) {
        _currentSysexMessage.push_back(b);
      } else {
        break;
      }
    } else {
      _currentSysexMessage.push_back(b);
    }
  }
}

void
MIDIInput::waitForData(ReceiveIOCB* iocb)
{
  unique_lock<mutex> lock(_mutex);
  while (!Pm_Poll(_pmMidiStream)) {
    _dataReceivedCondition.wait(lock);
  }

  const int RECV_EVENTS = 32;                   // xxx fixme move constant
  PmEvent events[RECV_EVENTS];
  int rc = Pm_Read(_pmMidiStream, events, RECV_EVENTS);
  if (rc < 0) {
    _error = (PmError) rc;
    while (!_readQueue.empty()) {
      _readQueue.pop();
    }
    while (!_sysexQueue.empty()) {
      _sysexQueue.pop();
    }
  } else {
    for (int i = 0; i < rc; i++) {
      const PmMessage& message = events[i].message;
      const unsigned status = Pm_MessageStatus(message);

      if (inSysexMessage()) {
        if (MIDI::IS_REALTIME(status)) {
          _readQueue.push(events[i]);
        } else {
          unpackSysexMessage(events[i]);
        }
      } else {
        if (status == MIDI::SYSEX_START) {
          unpackSysexMessage(events[i]);
        } else {
          _readQueue.push(events[i]);
        }
      }
    }
  }
}

void
MIDIInput::readResultsToJSCallbackArguments(Local<Value> argv[])
{
  unique_lock<mutex> lock(_mutex);

  if (_error) {
    argv[2] = Exception::Error(String::New("error receiving"));
  } else {
    Local<Array> events = Array::New(_sysexQueue.size() + _readQueue.size());
    int i = 0;
    // xxx order?
    while (_sysexQueue.size()) {
      const SysexMessageBuffer& message = _sysexQueue.front();
      Local<Array> jsMessage = Array::New(message.size());
      for (size_t j = 0; j < message.size(); j++) {
        jsMessage->Set(j, v8::Integer::New(message[j]));
      }
      events->Set(i++, jsMessage);
      _sysexQueue.pop();
    }
    while (_readQueue.size()) {
      PmMessage message = _readQueue.front().message;
      Local<Array> jsMessage = Array::New(3);
      jsMessage->Set(0, v8::Integer::New(Pm_MessageStatus(message)));
      jsMessage->Set(1, v8::Integer::New(Pm_MessageData1(message)));
      jsMessage->Set(2, v8::Integer::New(Pm_MessageData2(message)));
      events->Set(i++, jsMessage);
      _readQueue.pop();
    }
    argv[1] = events;
  }
}

int
MIDIInput::EIO_recv(eio_req* req)
{
  ReceiveIOCB* iocb = static_cast<ReceiveIOCB*>(req->data);
  MIDIInput* midiInput = iocb->_midiInput;

  while (!midiInput->dataAvailable()) {
    midiInput->waitForData(iocb);
  }

  return 0;
}

int
MIDIInput::EIO_recvDone(eio_req* req)
{
  HandleScope scope;
  ReceiveIOCB* iocb = static_cast<ReceiveIOCB*>(req->data);
  ev_unref(EV_DEFAULT_UC);

  Local<Value> argv[3];
  argv[0] = *iocb->_this;
  argv[1] = *Undefined();
  argv[2] = *Undefined();

  iocb->_midiInput->readResultsToJSCallbackArguments(argv);
  iocb->_midiInput->Unref();

  TryCatch tryCatch;
  iocb->_callback->Call(Context::GetCurrent()->Global(), 2, argv);

  if (tryCatch.HasCaught()) {
    FatalException(tryCatch);
  }

  iocb->_this.Dispose();
  iocb->_callback.Dispose();

  delete iocb;

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
  midiInput->_error = pmNoError;

  eio_custom(EIO_recv,
             EIO_PRI_DEFAULT,
             EIO_recvDone,
             new ReceiveIOCB(midiInput,
                             Persistent<Object>::New(Local<Object>::Cast(args.This())),
                             Persistent<Function>::New(Local<Function>::Cast(args[0]))));
  ev_ref(EV_DEFAULT_UC);

  return Undefined();
}

void
MIDIInput::Initialize(Handle<Object> target)
{
  HandleScope scope;

  Handle<FunctionTemplate> midiInputTemplate = FunctionTemplate::New(New);
  midiInputTemplate->Inherit(EventEmitter::constructor_template);
  midiInputTemplate->InstanceTemplate()->SetInternalFieldCount(1);

  NODE_SET_PROTOTYPE_METHOD(midiInputTemplate, "close", MIDIStream::close);
  NODE_SET_PROTOTYPE_METHOD(midiInputTemplate, "setFilters", setFilters);
  NODE_SET_PROTOTYPE_METHOD(midiInputTemplate, "recv", recv);

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
MIDIOutput::send(const vector<unsigned char>& message, PmTimestamp when)
  throw(JSException)
{
  if (message.size() < 1) {
    throw JSException("cannot send message without content");
  }

  unsigned int statusByte = message[0];

  if (statusByte == 0xf0) {

    // send sysex message
    int count = message.size();
    if (message[count - 1] != 0xf7) {
      throw JSException("sysex message must be terminated by 0xf7");
    }
    unsigned char buf[count];
    for (int i = 0; i < count; i++) {
      buf[i] = message[i];
    }
    PmError e = Pm_WriteSysEx(_pmMidiStream, when, buf);
    if (e < 0) {
      throw JSException("could not send MIDI sysex message");
    }

  } else {
    unsigned char arg1 = 0;
    unsigned char arg2 = 0;
    switch (message.size()) {
    case 3:
      arg2 = message[2];
    case 2:
      arg1 = message[1];
    case 1:
      break;
    default:
      throw JSException("unexpected message length");
    }
    PmError e = Pm_WriteShort(_pmMidiStream, when, Pm_Message(statusByte, message[1], message[2]));

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
  PmTimestamp when = 0;

  try {
    if (args.Length() < 1) {
      throw JSException("missing argument to MIDIOut::send");
    }

    if (args.Length() > 1) {
      if (!midiOutput->latency()) {
        throw JSException("can't delay message sending on MIDI output stream opened with zero latency");
      }

      when = args[1]->Int32Value();
    }

    vector<unsigned char> message;
    if (args[0]->IsString()) {
      string messageString = *String::Utf8Value(args[0]);
      istringstream is(messageString);
      while (!is.eof()) {
        unsigned byte;
        is >> hex >> byte;
        if (is.fail()) {
          throw JSException("error decoding hex byte in sysex message");
        }
        message.push_back(byte);
      }
    } else if (args[0]->IsArray()) {
      Local<Array> messageArray = Local<Array>::Cast(args[0]);
      for (unsigned i = 0; i < messageArray->Length(); i++) {
        if (!messageArray->Get(i)->IsNumber()) {
          throw JSException("unexpected array element in array to send, expecting only integers");
        }
        message.push_back(messageArray->Get(i)->Int32Value());
      }
    } else {
      throw JSException("unexpected type for MIDI message argument");
    }

    midiOutput->send(message, when);
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

