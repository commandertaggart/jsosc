(function () {

	var module_name = 'OSCMessage';
	var module_dependencies =
		[ './OSCMessage'
		, './OSCConnection'
		];

	function define_module(OSCMessage, OSCConnection)
	{
		var log = function(){};
		log = console.log.bind(console, '| OSCClient | ');

		function OSCClient(config)
		{
			this._connection = OSCConnection.createConnection(config);
			this._connection.addHandler(this);

			this._timeFix = 0;
			this._lastRTT = 0;
			this._pings = [];

			if (config.keepalive > 0)
			{
				this._keepaliveInterval = setInterval((function ()
				{
					this._connection.sendMessage(new OSCMessage("/ping"));
					this._pings.push(new Date().getTime());
				}).bind(this), config.keepalive);
			}

			this._listeners = 
			{
				'open': [],
				'close': [],
				'message': [],
				'error': []
			}
		}

		OSCClient.__defineGetter__('lastRTT', function lastRTT()
			{ return this._lastRTT; });
		OSCClient.__defineGetter__('timeFix', function timeFix()
			{ return this._timeFix; });

		OSCClient.prototype.addEventListener = 
		function addEventListener(event, listener)
		{
			if (event in this._listeners)
			{
				if (listener)
				{
					if (typeof(listener.handleEvent) === 'function' || 
						typeof(listener) === 'function')
					{
						if (this._listeners[event].indexOf(listener) === -1)
							{ this._listeners[event].push(listener); }
					}
					else
						{ throw new Error("addEventListener accepts only functions and EventHandlers"); }
				}
				else
					{ throw new Error("addEventListener requires an event handler"); }
			}
			else
				{ throw new Error("unrecognized event: " + event); }
		}

		OSCClient.prototype.removeEventListener = 
		function removeEventListener(event, listener)
		{
			if (event in this._listeners)
			{
				if (listener)
				{
					var idx = this._listeners[event].indexOf(listener);
					if (idx >= 0)
						{ this._listeners[event].splice(idx, 1); }
				}				
			}
			else
				{ throw new Error("unrecognized event: " + event); }
		}

		OSCClient.prototype.dispatchEvent =
		function dispatchEvent(event)
		{
			event.target = this;
			var type = event.type.toLowerCase();
			if (type in this._listeners)
			{
				for (var l = 0; l < this._listeners[type].length; ++l)
				{
					var listener = this._listeners[type][l];
					listener = listener.handleEvent || listener;

					listener(event);
				}
			}
			else
				{ throw new Error("unacceptable event: " + event.type); }
		}

		function _Event(type)
		{
			this.type = type?type.toLowerCase():null;
		}

		function _ConnectionEvent(type, client)
		{
			_Event.call(this, type);
			
			if (this.type !== 'open' && this.type !== 'close')
				{ throw new Error("ConnectionEvent only supports event types 'open' and 'close'"); }
			this.client = client;
		}
		_ConnectionEvent.prototype = new _Event();

		function _OSCMessageEvent(message, from)
		{
			_Event.call(this, 'message');

			this.message = message;
			this.from = from;
		}
		_OSCMessageEvent.prototype = new _Event();

		function _ErrorEvent(error)
		{
			_Event.call(this, 'error');

			this.error = error;
		}
		_ErrorEvent.prototype = new _Event();

		// clients not picky
		OSCClient.prototype.osc_interested = 
		function osc_interested(path)
		{ return true; }

		OSCClient.prototype.osc_connection =
		function osc_connection(from)
		{ 
			log("connected");
			this.dispatchEvent(new _ConnectionEvent('open', from)); 
		}

		OSCClient.prototype.osc_disconnect = 
		function osc_disconnect(from)
		{ 
			log("disconnected");
			this.dispatchEvent(new _ConnectionEvent('close', from)); 
		}

		OSCClient.prototype.osc_message = 
		function osc_message(from, message)
		{ 
			log("received: " + message.toString());

			if (message.address === '/pong')
			{
				if (message.getParameterCount() > 0)
				{
					var now = (new Date()).getTime();
					var serverTime = message.getParameterValue(0);
					var startTime = this._pings.shift();
					this._lastRTT = now - startTime;
					this._timeFix = Math.floor((serverTime - (this._lastRTT/2)) - now);
				}
			}
			else
			{
				this.dispatchEvent(new _OSCMessageEvent(message, from));
			}
		}

		OSCClient.prototype.osc_error = 
		function osc_error(from, error)
		{
			log(error.stack || error);
			this.dispatchEvent(new _ErrorEvent(error));
		}

		OSCClient.prototype.sendMessage = 
		function sendMessage(message)
		{
			log("sending: " + message.toString());
			this._connection.sendMessage(message);
		}

		return OSCClient;
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