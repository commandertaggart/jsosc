
(function () {

	module_name = "OSCWebSocketConnection";
	module_dependencies =
		[ "./OSCMessage"
		];

	function define_module(OSCMessage)
	{
		var log = function () {}
		log = console.log.bind(console, '| OSCWebSocketConnection | ');

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

				function _handleProtocols(list, cb)
				{
					log("protocol check: 'osc' in ", list);
					var idx = list.indexOf('osc');
					cb(idx >= 0, 'osc');
				}

				if (config.path instanceof RegExp)
				{
					var srv = this._server = new ws.Server({
						noServer: true,
						handleProtocols: _handleProtocols
					});
					var self = this;

					config.server.on('upgrade', function _handleUpgrade(req, socket, upgradeHead)
					{
						//copy upgradeHead to avoid retention of large slab buffers used in node core
						var head = new Buffer(upgradeHead.length);
						upgradeHead.copy(head);

						var path = req.url.indexOf('/', 6); // skip 'wss://'
						path = req.url.substr(path);
						var matches = req.url.match(config.path);
						if (matches && matches.length > 0)
						{
							srv.handleUpgrade(req, socket, head, function(client) {
								client.__matches = matches;
								self._onIncomingConnection(client);
							});
						}
      				});
				}
				else
				{
					this._server = new ws.Server({
						server: config.server,
						path: config.path,
						handleProtocols: _handleProtocols
					});
				}

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
					{ WebSocket = window.WebSocket; }
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

		OSCWebSocketConnection.setLog = function setLog(fn)
		{
			log = function ()
			{
				fn.apply(undefined, ["| OSCWebSocketConnection | "].concat(arguments));
			}
		}

		return OSCWebSocketConnection;
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