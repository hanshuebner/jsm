// -*- C++ -*-

#include <iostream>
#include <iomanip>
#include <sstream>
#include <set>
#include <queue>
#include <vector>

#include <stdlib.h>

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
  virtual const string message() const { return _message; }
  virtual Handle<Value> asV8Exception() const { return ThrowException(String::New(message().c_str())); }

protected:
  string _message;
};

class PortMidiJSException
  : public JSException
{
public:
  PortMidiJSException(const string& text, PmError pmError);

  virtual const string message() const;

private:
  PmError _pmError;
  string _hostError;
};

PortMidiJSException::PortMidiJSException(const string& text, PmError pmError)
  : JSException(text),
    _pmError(pmError)
{
  if (pmError == pmHostError) {
    char buf[PM_HOST_ERROR_MSG_LEN];
    Pm_GetHostErrorText(buf, sizeof buf);
    _hostError = buf;
  }
}

const string
PortMidiJSException::message() const
{
  if (_pmError == pmHostError) {
    return _message + ": (host error) " + _hostError;
  } else {
    return _message + ": " + Pm_GetErrorText(_pmError);
  }
}

class MIDI
{
public:
  static void Initialize(Handle<Object> target);

  enum PortDirection { INPUT, OUTPUT };

  // Get id of MIDI port with the given name.  Returns the ID or -1 if
  // no MIDI device with the given name is found
  static int getPortIndex(PortDirection direction, Handle<Value> name);

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

  PortMidiJSException* _error;
  queue<PmEvent> _readQueue;
  struct SysexMessageBuffer {
    vector<unsigned char> data;
    PmTimestamp timestamp;
  };
  queue<SysexMessageBuffer> _sysexQueue;
  SysexMessageBuffer _currentSysexMessage;

  bool inSysexMessage() { return _currentSysexMessage.data.size(); }

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
MIDI::getPortIndex(PortDirection direction, Handle<Value> nameArg)
{
  string portName;

  const char* environmentVariableName = (direction == INPUT) ? "MIDI_INPUT" : "MIDI_OUTPUT";
  const char* portNameFromEnvironment = getenv(environmentVariableName);
  Handle<Value> ports = getPorts(direction);
  bool useFirst = false;

  if (nameArg != Undefined()) {
    portName = *String::Utf8Value(nameArg);
  } else if (portNameFromEnvironment) {
    portName = portNameFromEnvironment;
  } else {
    useFirst = true;
  }

  for (int id = 0; id < Pm_CountDevices(); id++) {
    const PmDeviceInfo* deviceInfo = Pm_GetDeviceInfo(id);
    if (((direction == INPUT) ^ deviceInfo->output)
        && (useFirst || (portName == deviceInfo->name))) {
      return id;
    }
  }

  const char* directionName = (direction == INPUT) ? "input" : "output";;
  if (useFirst) {
    throw JSException((string) "no MIDI " + directionName + " ports");
  } else {
    if (nameArg == Undefined()) {
      throw JSException((string) "invalid MIDI " + directionName + " port name \"" + portName + "\" in " + environmentVariableName + " environment variable");
    } else {
      throw JSException((string) "invalid MIDI " + directionName + " port name \"" + portName + "\"");
    }
  }
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
    throw PortMidiJSException("could not open MIDI input port", e);
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
    throw PortMidiJSException("could not set MIDI channels", e);
  }

  e = Pm_SetFilter(_pmMidiStream, filters);
  if (e < 0) {
    throw PortMidiJSException("could not set MIDI filter", e);
  }
}

// v8 interface

Handle<Value>
MIDIInput::New(const Arguments& args)
{
  if (!args.IsConstructCall()) {
    return ThrowException(String::New("MIDIInput function can only be used as a constructor"));
  }

  HandleScope scope;

  try {
    int portId = MIDI::getPortIndex(MIDI::INPUT, args[0]);

    MIDIInput* midiInput = new MIDIInput(portId);
    midiInput->Wrap(args.This());

    static Persistent<String> init_psymbol = NODE_PSYMBOL("init");

    Local<Value> init = args.This()->Get(init_psymbol);

    if (!init->IsFunction()) {
      return ThrowException(String::New("MIDIInput.init function not found"));
    }
    Local<Function>::Cast(init)->Call(args.This(), 0, 0);
    
    return args.This();
  }
  catch (const JSException& e) {
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
  catch (const JSException& e) {
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
      _currentSysexMessage.data.push_back(b);
      _currentSysexMessage.timestamp = event.timestamp;
      _sysexQueue.push(_currentSysexMessage);
      _currentSysexMessage.data.clear();
      break;
    } else if (MIDI::IS_REALTIME(b)) {
      PmEvent rtEvent;
      rtEvent.message = b;
      rtEvent.timestamp = event.timestamp;
      _readQueue.push(rtEvent);
    } else if ((b & 0x80)
               && (_currentSysexMessage.data.size() > 1
                   || (b != MIDI::SYSEX_START))) {
      // We're receiving some non-realtime status while receiving a
      // sysex message.  Assume that this is not an error, but flush
      // the current sysex message (i.e. the user may have unplugged
      // the cable while a sysex message was being transferred)
      _currentSysexMessage.data.clear();
      // Unfortunately, portmidi does not resync itself when it
      // receives a new message inside a sysex message.  We can cope
      // with another sysex message, but fail for others.
      if (b == MIDI::SYSEX_START) {
        _currentSysexMessage.data.push_back(b);
      } else {
        break;
      }
    } else {
      _currentSysexMessage.data.push_back(b);
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
    _error = new PortMidiJSException("error receiving MIDI data", (PmError) rc);
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
    argv[2] = Exception::Error(String::New(_error->message().c_str()));
    delete _error;
    _error = 0;
  } else {
    Local<Array> events = Array::New(_sysexQueue.size() + _readQueue.size());
    int i = 0;
    // xxx order?
    while (_sysexQueue.size()) {
      const SysexMessageBuffer& message = _sysexQueue.front();
      Local<Array> jsMessage = Array::New(message.data.size() + 1);
      jsMessage->Set(0, v8::Integer::New(message.timestamp));
      for (size_t j = 0; j < message.data.size(); j++) {
        jsMessage->Set(j + 1, v8::Integer::New(message.data[j]));
      }
      events->Set(i++, jsMessage);
      _sysexQueue.pop();
    }
    while (_readQueue.size()) {
      PmMessage message = _readQueue.front().message;
      Local<Array> jsMessage = Array::New(4);
      jsMessage->Set(0, v8::Integer::New(_readQueue.front().timestamp));
      jsMessage->Set(1, v8::Integer::New(Pm_MessageStatus(message)));
      jsMessage->Set(2, v8::Integer::New(Pm_MessageData1(message)));
      jsMessage->Set(3, v8::Integer::New(Pm_MessageData2(message)));
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
  midiInput->_error = 0;

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
    throw PortMidiJSException("could not open MIDI output port", e);
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
      throw PortMidiJSException("could not send MIDI sysex message", e);
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
      throw PortMidiJSException("could not send MIDI message", e);
    }
  }
}

// v8 interface

Handle<Value>
MIDIOutput::New(const Arguments& args)
{
  if (!args.IsConstructCall()) {
    return ThrowException(String::New("MIDIOutput function can only be used as a constructor"));
  }
  HandleScope scope;

  try {
    int portId = MIDI::getPortIndex(MIDI::OUTPUT, args[0]);

    int32_t latency = 0;
    if (args.Length() > 1) {
      latency = args[1]->Int32Value();
    }

    MIDIOutput* midiOutput = new MIDIOutput(portId, latency);
    midiOutput->Wrap(args.This());
    return args.This();
  }
  catch (const JSException& e) {
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
      if (!midiOutput->latency() && (args[1] != Undefined())) {
        throw JSException("can't delay message sending on MIDI output stream opened with zero latency");
      }

      if (args[1] != Undefined()) {
        when = args[1]->Int32Value();
      }
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
  catch (const JSException& e) {
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

