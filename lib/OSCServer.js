
var log = function () {}
log = console.log.bind(console, "| OSCServer | ");

var events = require('events');
var OSCConnection = require('./OSCConnection');

function OSCServer(config)
{
	var config = config || {};
	config.connections = config.connections || [];

	events.EventEmitter.apply(this);

	this._osc_namespace = config.namespace || "/";
	this._connections = [];

	for (var c = 0; c < config.connections.length; ++c)
	{
		var conn = OSCConnection.createConnection(config.connections[c]);

		if (conn)
		{
			conn.addHandler(this);
			this._connections.push(conn);
			log("created connection of type: " + config.connections[c].type);
		}
	}
}
OSCServer.prototype = Object.create(events.EventEmitter.prototype);

OSCServer.prototype.__defineGetter__('namespace', function namespace()
	{ return this._osc_namespace; });

OSCServer.prototype.addEventListener =
function addEventListener(event, listener)
{
	event = event.toLowerCase();
	if (['open','close','message','error'].indexOf(event) >= 0)
	{ this.on(event, listener); }
}

OSCServer.prototype.removeEventListener = 
function removeEventListener(event, listener)
{ this.removeListener(event, listener); }

OSCServer.prototype.dispatchEvent = 
function dispatchEvent(event)
{ throw new Error("OSCServer does not implement dispatchEvent.  Use NodeJS EventEmitter.emit() instead."); }

// OSCConnection handler interface
OSCServer.prototype.osc_connection = function osc_connection(from)
{
	log("open");
	this.emit('open', from);
}

OSCServer.prototype.osc_disconnect = function osc_disconnect(from)
{
	log("close");
	this.emit('close', from);
}

OSCServer.prototype.osc_interested = function osc_interested(address)
{
	if (this._osc_namespace == null || address.indexOf(this._osc_namespace) == 0)
	{
		return true;
	}
	return false;
}

OSCServer.prototype.osc_message = function osc_message(from, message)
{
	log("received: " + message.toString());

	if (message.address == '/ping')
	{
		from.sendMessage(new OSCMessage('/pong').addTimeTag(new Date()));
	}
	else
	{
		this.emit('message', message, from);
	}
}

OSCServer.prototype.osc_error = function osc_message(from, error)
{
	log(error.stack || error);
	this.emit('error', error, from);
}

OSCServer.prototype.close = function close()
{
	this._connections.map(function (c) { c.close(); });
	this._connections = [];
}

OSCServer.prototype.sendMessage = function sendMessage(message, to)
{
	log("sending: " + message.toString());
	if (!(to instanceof Array))
	{
		to = to?[to]:this._connections;
	}

	for (var i = 0; i < to.length; ++i)
		{ to[i].sendMessage(message); }
}

OSCServer.setLog = function (fn)
{
	log = function ()
	{
		fn.apply(undefined, ["| OSCServer | "].concat(Array.prototype.slice.call(arguments)));
	}
}
module.exports = exports = OSCServer;

