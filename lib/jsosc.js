
if (typeof(module) !== 'undefined')
{
	exports.OSCServer = require('./OSCServer');
	exports.OSCClient = require('./OSCClient');
	exports.OSCMessage = require('./OSCMessage');
}
else if (typeof(window) !== 'undefined')
{
	var scripts = document.getElementsByTagName('SCRIPT');
	for (var s = 0; s < scripts.length; ++s)
	{
		var idx = scripts[s].src.indexOf("jsosc.js");
		if (idx >= 0)
		{
			var url = scripts[s].src.substr(0, idx);
			var head = document.getElementsByTagName('HEAD')[0];
			if (head)
			{
				function addScript(file)
				{
					var scr = document.createElement('SCRIPT');
					src.setAttribute('type', 'text/javascript');
					src.setAttribute('src', url + file);
					head.appendChild(scr);
				}

				var files =
					[ 'DataReader.js'
					, 'DataWriter.js'
					, 'OSCMessage.js'
					, 'OSCConnection.js'
					, 'OSCClient.js'
					];

				for (var f = 0; f < files.length; ++f)
					{ addScript(files[f]); }

			}
			break;
		}
	}
}
