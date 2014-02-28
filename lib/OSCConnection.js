
(function () {

	module_name = "OSCConnection";
	module_dependencies =
		[ "./OSCMessage"
		];

	function define_module(OSCMessage)
	{
		var log = function () {}
		log = console.log.bind(console, '| OSCConnection | ');

		function OSCClientRef(connection, client)
		{
			this._connection = connection;
			this._client = client;
		}
		OSCClientRef.prototype.close = 
		function close()
		{ this._connection.close(client); }
		OSCClientRef.prototype.sendMessage =
		function sendMessage(message)
		{ this._connection.sendMessage(message, this); }



		var __connections = {};

		function OSCConnection(config)
		{
			this._handlers = [];
			this._clients = [];
			this._waitForConnectMessage = false;
			this._sendConnectMessage = false;
			this._connectionDetails = { type: null, format: 'osc' };
			this.__defineGetter__('connectionDetails', function () 
				{ return this._connectionDetails; });

			if (config)
			{
				this._waitForConnectMessage = config.waitForConnectMessage === true;
				this._sendConnectMessage = config.sendConnectMessage === true;
			}
		}

		OSCConnection.createConnection = function createConnection(config)
		{
			if (config.type === 'websocket')
				{ return new OSCWebSocketConnection(config); }
			else
				{ throw new Error("OSCConnection type '" + config.type + "' not supported."); }
		}

		OSCConnection.prototype.addHandler = 
		function addHandler(handler)
		{
			if (typeof(handler.osc_interested) === 'undefined')
				{ handler.osc_interested = function _yes() { return true; }; }
			if (typeof(handler.osc_connection) === 'undefined')
				{ handler.osc_connection = function _ignore() { return; }; }
			if (typeof(handler.osc_disconnect) === 'undefined')
				{ handler.osc_disconnect = function _ignore() { return; }; }
			if (typeof(handler.osc_message) === 'undefined')
				{ handler.osc_message = function _ignore() { return; }; }
			if (typeof(handler.osc_error) === 'undefined')
				{ handler.osc_error = function _ignore() { return; }; }

			if (this._handlers.indexOf(handler) === -1)
				{ this._handlers.push(handler); }

			log("handler count: " + this._handlers.length);

			for (var c = 0; c < this._clients.length; ++c)
			{
				handler.osc_connection(new OSCClientRef(this, this._clients[c]));
			}
		}

		OSCConnection.prototype.removeHandler = 
		function removeHandler(handler)
		{
			var idx = this._handlers.indexOf(handler);
			if (idx >= 0)
				{ this._handlers.splice(idx, 1); }
		}

		OSCConnection.prototype.onMessage = 
		function onMessage(client, message)
		{
			log("received: " + message.toString());
			var method = message.address.substr(message.address.lastIndexOf("/"));
			if (this._waitForConnectMessage && method === "/@connect")
			{
				if (this._clients.indexOf(client) === -1)
				{
					this._clients.push(client);
					this.onClientConnection(
						message.address.slice(0, message.address.length - 9), client);
				}
			}
			else if (this._waitForConnectMessage &&
				(method === "/@disconnect" || method === "/@delete" || method === "/@close"))
			{
				var idx = this._clients.indexOf(client);
				if (idx >= 0)
				{
					this._clients.splice(idx, 1);
					this.onClientDisconnect(
						message.address.slice(0, message.address.length - 9), client);
				}
			}
			else
			{
				var from = new OSCClientRef(this, client);
				this._eachHandler(function checkAndSendMessage(handler)
				{
					if (handler.osc_interested(message.address))
					{
						handler.osc_message(from, message);
					}
				})
			}
		}

		OSCConnection.prototype.sendMessage = 
		function sendMessage(message, to)
		{
			var conn = this;
			if (to)
			{
				if (!(to instanceof Array))
					{ to = [to]; }

				to = to.filter(
					function _f(item) { return item._connection === conn; }
				).map(
					function _m(item) { return item._client; }
				);
			}
			else
				{ to = this._clients; }

			this._sendMessageToClients(message, to);
		}
		OSCConnection.prototype._sendMessageToClients = 
		function _sendMessageToClients(message, clients)
		{ throw new Error("_sendMessageToClients must be implemented by subclass."); }

		OSCConnection.prototype.onClientConnection = 
		function onClientConnection(path, client)
		{
			if (this._clients.indexOf(client) === -1)
				{ this._clients.push(client); }

			var from = new OSCClientRef(this, client);
			this._eachHandler(function checkAndNotifyOfClient(handler)
			{
				if (handler.osc_interested(path))
				{
					handler.osc_connection(from);
				}
			});
		}

		OSCConnection.prototype.onClientDisconnect = 
		function onClientDisconnect(path, client)
		{
			var from = new OSCClientRef(this, client);
			this._eachHandler(function checkAndNotifyOfClientClose(handler)
			{
				if (path === null || handler.osc_interested(path))
				{
					handler.osc_disconnect(from);
				}
			});
		}

		OSCConnection.prototype.onError =
		function onError(client, error)
		{
			var from = new OSCClientRef(this, client);
			this._eachHandler(function onError(handler)
			{
				handler.osc_error(from, error);
			})
		}

		OSCConnection.prototype._eachHandler = 
		function _eachHandler(fn)
		{
			fn = fn.bind(this);
			for (var h = 0; h < this._handlers.length; ++h)
			{
				fn(this._handlers[h]);
			}
		}

		OSCConnection.prototype.close = 
		function close()
		{ throw new Error("close must be implemented by subclass."); }


		function OSCWebSocketConnection(config)
		{
			if (config == null)
				{ throw new Error("OSCWebSocketConnection: no config provided."); }
			if (config.server == null && config.url == null)
				{ throw new Error("OSCWebSocketConnection: either 'server' " + 
					"or 'url' must be provided."); }

			var tag = "websocket:" + (config.server?("server" + config.path):config.url);
			if (__connections[tag])
			{
				log("REUSING tag: " + tag);
				return __connections[tag];
			}
			else
			{
				log("NEW CONNECTION for tag: " + tag);
				__connections[tag] = this;
			}
			this._tag = tag;

			OSCConnection.call(this, config);

			this.connectionDetails.type = 'websocket';

			if (config.server)
			{
				if (typeof(module) === 'undefined')
					{ throw new Error("OSCWebSocketConnection: server " + 
						"not supported outside node.js environment."); }
				var ws = require('ws');

				config.path = config.path || "/";
				this._server = new ws.Server({
					server: config.server,
					path: config.path,
					handleProtocols: function _handleProtocols(list, cb)
					{
						log("protocol check: 'osc' in ", list);
						var idx = list.indexOf('osc');
						cb(idx >= 0, 'osc');
					}
				});

				this._incoming = [];
				this._server.on('connection', this._onIncomingConnection.bind(this));

				var port = config.server.port;
				this.connectionDetails.url = "ws://" + config.server.hostname +
					(port===80?"":":"+port) + config.path;
			}
			else if (config.url)
			{
				var WebSocket = null;
				if (typeof(window) !== 'undefined')
					{ webSocket = window.WebSocket; }
				if (WebSocket == null && typeof(require) === 'function')
					{ WebSocket = require('ws'); }
				if (WebSocket == null)
					{ throw new Error("OSCWebSocketConnection: WebSocket " +
						"implementation not found."); }

				if (typeof(config.namespaces) === 'string')
					{ config.namespaces = [config.namespaces]; }
				else if (!(config.namespaces instanceof Array))
					{ config.namespaces = []; }

				this._socket = new WebSocket(config.url, 'osc');
				this._socket.binaryType = 'arraybuffer';
				this._socket.onopen = this._onClientConnected.bind(this, config.namespaces);
				this._socket.onmessage = this._onMessageReceived.bind(this, this._socket);
				this._socket.onclose = this._onConnectionClosed.bind(this, this._socket);
				this._socket.onerror = this.onError.bind(this, this._socket);
			}
		}
		OSCWebSocketConnection.prototype = new OSCConnection();

		OSCWebSocketConnection.prototype._onIncomingConnection = 
		function _onIncomingConnection(socket)
		{
			this._incoming.push(socket);
			socket.onmessage = this._onMessageReceived.bind(this, socket);
			socket.onclose = this._onConnectionClosed.bind(this, socket);
			socket.onerror = this.onError.bind(this, socket);

			if (this._waitForConnectMessage === false)
			{
				this.onClientConnection("/", socket);
			}
		}

		OSCWebSocketConnection.prototype._onConnectionClosed = 
		function _onConnectionClosed(socket)
		{
			if (socket.removeAllListeners)
				{ socket.removeAllListeners(); }
			if (this._socket === socket)
				{ this._socket = null; }
			else
			{
				var idx = this._incoming.indexOf(socket);
				if (idx >= 0)
					{ this._incoming.splice(idx, 1); }
				idx = this._clients.indexOf(socket);
				if (idx >= 0)
				{
					this.onClientDisconnect(null, socket);
					this._clients.splice(idx, 1);
				}
			}
		}

		OSCWebSocketConnection.prototype._onClientConnected = 
		function _onClientConnected(namespaces)
		{
			this.onClientConnection("/", this._socket);
			for (var n = 0; n < namespaces.length; ++n)
			{
				if (this._sendConnectMessage)
					{ this.sendMessage(new OSCMessage(namespaces[n] + "/@connect")); }
				this.onClientConnection(namespaces[n], this._socket);
			}
		}

		OSCWebSocketConnection.prototype._onMessageReceived = 
		function _onMessageReceived(socket, event)
		{
			log("_onMessageReceived: ", event.data);
			try
			{
				var message = new OSCMessage((new Uint8Array(event.data)).buffer);
				log("_onMessageReceived: parsed: ", message);
				this.onMessage(socket, message);
			}
			catch (error)
			{
				log(error.stack || error);
			}
		}

		OSCWebSocketConnection.prototype._sendMessageToClients = 
		function _sendMessageToClients(message, clients)
		{
			var buffer = message.serialize(false);
			log("sending: ", buffer);
			for (var c = 0; c < clients.length; ++c)
			{
				clients[c].send(buffer);
			}
		}

		OSCWebSocketConnection.prototype.close = 
		function close()
		{
			if (this._socket)
			{
				this._onConnectionClosed(this._socket);
			}
			else if (this._incoming)
			{
				while (this._incoming.length > 0)
				{
					this._incoming[0].close();
					this._onConnectionClosed(this._incoming[0]);
				}

				this._server.close();
			}
			delete __connections[this._tag];
		}

		OSCConnection.setLog = function setLog(fn)
		{
			log = function ()
			{
				fn.apply(undefined, ["| OSCConnection | "].concat(Array.prototype.slice.call(arguments)));
			}
		}

		return OSCConnection;
	}

	if (typeof(define) === 'function')
	{
		define(module_dependencies, define_module);
	}
	else if (typeof(module) !== 'undefined')
	{
		module.exports = exports = 
			define_module.apply(undefined, module_dependencies.map(require));
	}
	else if (typeof(window) !== 'undefined')
	{
		window[module_name] = define_module.apply(undefined, 
			module_dependencies.map(function _map(item)
			{
				item = item.substr(item.lastIndexOf("/") + 1);
				return window[item];
			})
		);
	}

})();