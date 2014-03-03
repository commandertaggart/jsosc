
var OSCServer = require('../lib/OSCServer');
var OSCClient = require('../lib/OSCClient');
var OSCMessage = require('../lib/OSCMessage');

var log = console.log.bind(console, "DEBUG: ");
var http = require('http');

debugger;

var webServer = http.createServer();
webServer.listen(27614, function ()
{
	webServer.hostName = 'localhost';
	webServer.port = webServer.address().port;
	serverReady();
});

function serverReady()
{
	var server = new OSCServer({
		connections: [
			{ type: 'websocket'
			, server: webServer
			, path: /^\/oscServer\/(.*)$/
			}
		]
	});

	var url = 'ws://localhost:' + webServer.port + "/oscServer/" + Math.floor(Math.random() * 0xffff).toString();
	log(url);
	var client = new OSCClient({
		type: 'websocket',
		url: url
	});


	server.on('open', function onServerConnect(from, matches)
	{
		log("server connect");
		if (matches)
			{ log(matches); }
	});

	server.on('message', function onServerMessage(message, from)
	{
		log("server received: " + message.toString());
	});

	server.on('error', function onError(error, from)
	{ log(error.stack || error); });

	client.addEventListener('open', function onClientConnect(event)
	{
		log("client connect");
	});
	client.addEventListener('message', function onClientMessage(event)
	{
		log("client received: " + event.message.toString());
	});
	client.addEventListener('error', function onError(event)
		{ log(event.error.stack || event.error); });

	function sendMessage()
	{
		var msg = new OSCMessage(arguments[1]);

		for (var a = 2; a < arguments.length; ++a)
		{
			if (arguments[a] == null)
			{
				msg.addNil();
			}
			else if (arguments[a] === true || arguments[a] === 'true')
			{
				msg.addTrue();
			}
			else if (arguments[a] === false || arguments[a] === 'false')
			{
				msg.addFalse();
			}
			else if (isNaN(arguments[a]))
			{
				msg.addString(arguments[a]);
			}
			else if (Math.floor(arguments[a]) == arguments[a])
			{
				msg.addInt32(arguments[a]);
			}
			else
			{
				msg.addFloat64(arguments[a]);
			}
		}

		if (arguments[0] == 'c')
			{ client.sendMessage(msg); }
		else
			{ server.sendMessage(msg); }
	}

	if (typeof(window) !== 'undefined')
	{
		window.sendMessage = sendMessage;
	}
	else
	{
		process.stdin.on('data', function (data)
		{
			data = data.toString();
			console.log(data);
			try
			{
				eval(data);
			}
			catch (error)
			{
				console.log(error.stack || error);
			}
		});
		process.stdin.resume();
	}

	var messages = 
	[ ['s','/server/0',4]
	, ['c','/client/0',3,null,Math.PI]
	, ['s','/server/1']
	, ['c','/client/1',19]
	, ['s','/server/2',"string",false]
	, ['c','/client/2']
	];

	var idx = 0;
	function nextMessage()
	{
		if (idx < messages.length)
		{
			sendMessage.apply(undefined, messages[idx++]);
			setTimeout(nextMessage, 1000);
		}
	}
	setTimeout(nextMessage, 1000);
}