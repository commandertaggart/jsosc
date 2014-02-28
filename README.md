jsosc
=====

A javascript OSC client and server implementation for Node.js and WebSocket-capable browsers.

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


MORE COMING SOON 


