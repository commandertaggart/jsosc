
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

	var wait = config.waitForConnectMessage || false;
	for (var c = 0; c < config.connections.length; ++c)
	{
		config.connections[c].waitForConnectMessage = config.connections[c].waitForConnectMessage || wait;
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
OSCServer.prototype.__defineGetter__('connectionDetails', function connectionDetails()
{
	return this._connections.map(function cd(conn)
		{ return conn.connectionDetails; });
})

// OSCConnection handler interface
OSCServer.prototype.osc_connection = function osc_connection(from, matches)
{
	log("open", this.namespace);
	this.emit('open', from, matches);
}

OSCServer.prototype.osc_disconnect = function osc_disconnect(from)
{
	log("close", this.namespace);
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

