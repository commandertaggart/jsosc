
(function () {

	module_name = "OSCConnection";
	module_dependencies =
		[ "./OSCMessage"
		, "./OSCWebSocketConnection"
		];

	function define_module(OSCMessage, OSCWebSocketConnection)
	{
		var log = function () {}
		log = console.log.bind(console, '| OSCConnection | ');

		function OSCClientRef(connection, client, handler)
		{
			this._connection = connection;
			this._client = client;
			this._handler = handler;
		}

		OSCClientRef.prototype.close = 
		function close()
		{ this._connection.close(client); }

		OSCClientRef.prototype.sendMessage =
		function sendMessage(message)
		{ this._connection.sendMessage(message, this); }

		OSCClientRef.prototype.addMessageListener =
		function addMessageListener(listener)
		{ this._connection.addMessageListener(this._client, listener, this._handler); }

		OSCClientRef.prototype.removeMessageListener =
		function removeMessageListener(listener)
		{ this._connection.removeMessageListener(this._client, listener, this._handler); }

		OSCClientRef.prototype.equals = 
		function equals(other)
		{
			return (other instanceof OSCClientRef &&
					other._connection === this._connection &&
					other._client === this._client &&
					other._handler === this._handler);
		}


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
				handler.osc_connection(new OSCClientRef(this, this._clients[c], handler), this._clients[c].__matches);
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
				var self = this;
				this._eachHandler(function checkAndSendMessage(handler)
				{
					if (handler.osc_interested(message.address))
					{
						handler.osc_message(new OSCClientRef(self, client, handler), message);
					}
				})

				if (client.__messageListeners)
				{
					client.__messageListeners.map(function (listener)
					{
						if (listener.h && listener.h.osc_interested(message.address))
						{
							listener.l(message, new OSCClientRef(self, client, listener.h));
						}
					});
				}
			}
		}

		OSCConnection.prototype.addMessageListener =
		function addMessageListener(client, listener, handler)
		{
			if (client.__messageListeners == null)
				{ client.__messageListeners = []; }

			if (typeof(listener) === 'function' &&
				client.__messageListeners.indexOf(listener) === -1)
			{
				client.__messageListeners.push({ l: listener, h: handler });
			}
		}

		OSCConnection.prototype.removeMessageListener =
		function removeMessageListener(client, listener, handler)
		{
			if (client && client.__messageListeners)
			{
				client.__messageListeners = client.__messageListeners.filter(function (l)
				{
					return (l.l !== listener) && (l.h !== handler);
				});
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

			var self = this;
			this._eachHandler(function checkAndNotifyOfClient(handler)
			{
				if (handler.osc_interested(path))
				{
					handler.osc_connection(new OSCClientRef(self, client, handler), client.__matches);
				}
			});
		}

		OSCConnection.prototype.onClientDisconnect = 
		function onClientDisconnect(path, client)
		{
			var self = this;
			this._eachHandler(function checkAndNotifyOfClientClose(handler)
			{
				if (path === null || handler.osc_interested(path))
				{
					handler.osc_disconnect(new OSCClientRef(self, client, handler));
				}
			});
		}

		OSCConnection.prototype.onError =
		function onError(client, error)
		{
			var self = this;
			this._eachHandler(function onError(handler)
			{
				from._handler = from;
				handler.osc_error(new OSCClientRef(self, client, handler), error);
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