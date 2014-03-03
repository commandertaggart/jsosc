
requirejs.config({
	paths: {
		'jsosc':'../lib'
	}
});

requirejs(
	[ 'jsosc/OSCClient'
	, 'jsosc/OSCMessage'
	],
	function (OSCClient, OSCMessage)
	{
		var client = new OSCClient({
			type: 'websocket',
			url: 'ws://localhost:27614/oscServer/browser'
		});

		var output = document.getElementById('output');
		function postLine(s)
		{
			output.innerText += s + "\n";
		}

		var submit = document.getElementById('send');
		var message = document.getElementById('message');
		submit.onclick = function sendMessage()
		{
			var msg = OSCMessage.fromString(message.value);
			if (msg)
			{
				postLine("sent: " + msg.toString());
				client.sendMessage(msg);
			}
		}

		client.addEventListener('open', function onOpen(event)
		{
			postLine("!! connected !!");
		});

		client.addEventListener('message', function onMessage(event)
		{
			postLine("received: " + event.message.toString());
		});

		client.addEventListener('error', function onError(event)
		{
			postLine("error: " + (event.error.stack || event.error));
		});
	}
);

