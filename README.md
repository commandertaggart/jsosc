jsosc
=====

A javascript OSC client and server implementation for Node.js and WebSocket-capable browsers.

Installation
------------
jsosc is not yet available in the npm registry.  You can clone it directly from github into your node_modules directory (or wherever you want it to be for a browser-based project), or add it as a dependency in your package.json file, followed by `npm install`:
```
{
    ...
    "dependencies": {
        ...
        "jsosc": "glikker/jsosc",
        ...
    },
    ...
}
```

NodeJS
------
Use jsosc in NodeJS by calling `require('jsosc')`.  The resulting jsosc object includes the three core classes:

```javascript
jsosc.OSCClient;
jsosc.OSCServer;
jsosc.OSCMessage;
```

Browser
-------
To use jsosc in a browser, we recommend using RequireJS.  Configure require with a path to the jsosc /lib path, and require the classes you need from there.

```javascript
require.config({
    ...
    paths: {
        ...
        'jsosc': 'path/to/jsosc/lib'
        ...
    },
    ...
});

require([
    'jsosc/OSCMessage',
    'jsosc/OSCClient'
    ], function (OSCMessage, OSCClient)
    {
        ...
    });
```

##Class Reference

### OSCMessage
OSCMessage represents a message or message bundle as specified in the OSC specification [found here](http://opensoundcontrol.org/spec-1_0).
#### Constructor:
`OSCMessage(address_array_or_buffer)`

The constructor accepts a single parameter that is one of the following:
1. A string, beginning with '/', representing an OSC address path.  This will create a basic message object, to which parameters may be added.
1. An array of OSCMessage objects.  This will create a bundle message, containing the provided messages.  If an array is provide, a second parameter may also optionally be provided.  This parameter is a timestamp (as retrieved by Date.getTime()), or 0, representing the OSC Time Tag.
1. An object of type `ArrayBuffer`, containing a serialized message from the network stream.  This is used internally and should not be used by integrating applications.

####Properties:
If an OSCMessage object is a message bundle, then it will have a property `bundle` defined.  This property is an array containing the bundled messages, which may also be bundles.  Bundles also have a `timestamp` property defined which, according to the spec, indicates the time that this bundle should be executed.  If `timestamp` occurs in the past or is 0, then the bundle should be executed immediately.  This value can be passed to the constructor for a `Date` object.

For other messages, the OSC Address is available in the `address` property.
####Methods:
Parameters can be added to a message using: `addParameter(type, value)`.

This method adds a parameter to the message of a given type and with the given value.  The type parameter must be one of the following:
```javascript
OSCMessage.TYPE_INT32    
OSCMessage.TYPE_FLOAT32  
OSCMessage.TYPE_STRING   
OSCMessage.TYPE_BLOB     
OSCMessage.TYPE_INT64*    
OSCMessage.TYPE_TIME*     
OSCMessage.TYPE_FLOAT64*  
OSCMessage.TYPE_SYMBOL*   
OSCMessage.TYPE_CHAR*     
OSCMessage.TYPE_TRUE*     
OSCMessage.TYPE_FALSE*    
OSCMessage.TYPE_NIL*
OSCMessage.TYPE_INFINITUM*
```
\* These are not OSC-standard types, but are referred to by the spec as "commonly used".  The additional non-standard types 'color' and 'midi message' are not yet supported.

For convenience, the following methods are also provided:

`addAuto(value)` will auto-detect the type of the value, defaulting numbers to 32-bit values.

And these methods will insert a parameter of the specified type:
```javascript
addInt32(value)
addFloat32(value)  
addString(value)   
addBlob(array_buffer)     
addInt64(value)    
addTimeTag(value)  
addFloat64(value)  
addSymbol(value)   
addChar(value)     
addTrue()     
addFalse()    
addNil()      
addInfinitum()
```
Adding parameters in array values (using OSC non-standard type tags '[' and ']') is also supported using `openArray()` and `closeArray()`.  Between these calls, all parameters are added sequentially to the array.

All parameter-adding functions can be chained for ease of use:
```javascript
client.sendMessage(new OSCMessage('/data/path')
    .addInt32(42).addNil().addString("parameter"));
```

Parameters may be retrieved from a message using these methods:
* `getParameterCount()` returns the number of parameters in the message.  Arrays count as a single parameter.
* `getParameterValue(index)` returns the value of the parameter at the specified index.  Multiple indices may be provided to further index array parameters, or an array parameter will be returned as an array object.
* `getParameterType(index)` returns the type value (from the list above) for the parameter at the specified index.  Multiple indices is not yet supported.
* `getParameterValues()` returns an array of all values in the message (including sub-arrays as specified).

A human-readable string representing the OSC message can be retrieved using `.toString()`.

A message can be serialized to an `ArrayBuffer` object using the `serialize(prepend_size)`method.  The parameter indicates whether the buffer will include the size of the rest of the message in the first 4 bytes, and is `false` by default.

### OSCClient
OSCClient represents a single connection to a single server endpoint.
#### Constructor
`OSCClient(config)`

The configuration object provided to the OSCClient object includes these members:
* `type` - Specifies the type of connection to create.  Currently only `'websocket'` is supported. REQUIRED.
* `url` - For a `'websocket'` type connection, the url must be specified.  This is a full, WebSocket-compliant URL that starts with 'ws://' or 'wss://'.
* `keepalive` - An optional number specifying how often (in milliseconds) to send a '/ping' message.
* `namespaces` - An array of OSC address prefixes to connect to (see `sendConnectMessage`).
* `sendConnectMessage` - an optional boolean value, defaulting to `false`.  As an extension to the basic OSC specification, this library allows sharing of a single connection pipe between users of multiple OSC message streams by differentiating those streams based on the first part of the OSC address, and those interested in these address spaces.  If set to `true`, the client will automatically send an `'/@connect'` message to each address prefix specified in `namespaces`.  For example, if `namespaces` is `['/a','/b/0']`, then the client will automatically send these messages upon connecting to the server: `'/a/@connect', '/b/0/@connect'`.  These messages are most likely meaningless to a server, except in the case of an OSCServer object that has been configured with `'waitForConnectMessage'` (see below).

#### Methods
`sendMessage(message)` sends the provided OSCMessage object across the connection.

OSCClient implements the EventTarget interface.  Register and unregister listeners using `addEventListener(event_type, listener)` and `removeEventListener(event_type, listener)`.

#### Events
* `open` - triggered when the client connects with the server.
* `close` - triggered when the client connection is closed on either end.
* `message` - triggered when a message is received on the connection.  The event object includes a `message` property containing an OSCMessage object.
* `error` - triggered when an error in the system occurs.  The event object includes an `error` property containing the error that occured.

### OSCServer
OSCServer is only available in a NodeJS environment.  A server object represents a single point-of-contact for multiple clients over multiple connections.

#### Constructor
`OSCServer(config)`

The configuration object provided to the OSCServer object includes these members:
* `connections` - an array of objects, one for each connection type.  These objects contain:
    * `type` - the connection type.  Currently only supports `'websocket'`.
    * `server` - for `'websocket'` type connections, a NodeJS http server object through which the client may reach this OSCServer.
    * `path` - for `'websocket'` type connections, the URI resource path at which this server is reached.  Multiple OSC servers may exist on one web server.  If they use the same `path`, then they will share the same WebSocket connection.  Different `path` values will result in multiple socket connections.
* `waitForConnectMessage` - a boolean value, by default `false`.  If true, this server will not be notified of client connections until a `'/@connect'` message is received that matches the `namespace` property.  See the `sendConnectMessage` property of the OSCClient config object.
* `namespace` - An OSC address path prefix that this server cares about.  If specified, no message will be received by this server unless the message `address` property begins with the `namespace` value.  This allows multiple OSCServer objects to use the same connection, but handle different sets of messages based on address namespace.  This value defaults to '/', which matches all well-formed messages.

#### Methods
`close()` may be called to close all client connections.  The OSCServer may not be used after `close() ` has been called.

`sendMessage(message, to)` sends the provided OSCMessage object to the list of clients provided.  The `to` parameter is an array of client references as provided by the `connection` or `message` events (below), or may be excluded, to send the message to all connected clients.

OSCServer is an object of type `EventEmitter`, for handling events.

#### Events
* `connection` - triggered when a client connects to this server. Parameters: a client reference to the new client.
* `disconnect` - triggered when a client connection is closed by either side. Parameters: a reference to the closed client.
* `message` - triggered when a message is received from a client. Parameters: the message recieved, and a client reference to the sender.
* `error` - triggered when an error occurs. Parameters: the error that occured, and a client reference to the client involved (if applicable).

### Testing
jsosc includes some unit tests written for use with [BusterJS](http://busterjs.org), and files for running some interactive tests in a [node-webkit](https://github.com/rogerwang/node-webkit) environment.  These setups are in no way complete, comprehensive or well-built.  Testing is one of my weak points.  I accept pointers, suggestions, criticism and well-thought-out complaints.  Thank you for your time and I hope this library is of use.
### Future features (no promises, just notes to myself)
* OSCClient should handle delay of post-dated bundles and dispatch an event for each message individually.
* Client and server support UDP and TCP connections.
