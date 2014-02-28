

var buster = require('buster');
buster.spec.expose();
var expect = buster.referee.expect;

var OSCMessage = require('../lib/OSCMessage');
var OSCConnection = require('../lib/OSCConnection');

var log = function ()
{
	buster.log.apply(buster, ["TEST(OSCConnection): "].concat(Array.prototype.slice.call(arguments)));
};
//log = console.log.bind(console, "TEST(OSCConnection): ");

OSCConnection.setLog(log);

describe("OSCConnection", function ()
{
	beforeAll(function(done)
	{
		var webServer = require('http').createServer(0);
		webServer.hostname = "localhost";
		webServer.listen(0, function onListening()
		{
			webServer.port = webServer.address().port;
			log("Web server running on port " + webServer.port);
			done();
		})
		this.webServer = webServer;
	});

	afterAll(function (done)
	{
		this.webServer.close();
		done();
	});

	it("creates a valid base object", function ()
	{
		var obj = new OSCConnection({
			type: 'websocket',
			server: this.webServer,
			path: "/oscServer",
			namespace: "/"
		});

		expect(obj).not.toBeNull();
		expect(obj.connectionDetails).not.toBeNull();
	});

	it("creates a server", function ()
	{
		var server = new OSCConnection.createConnection({
			type: 'websocket',
			server: this.webServer,
			path: "/oscServer",
			namespace: "/"
		});
		expect(server).not.toBeNull();
	});

	it("creates a client", function ()
	{
		var client = new OSCConnection.createConnection({
			type: 'websocket',
			url: 'ws://localhost:' + this.webServer.port
		});
		expect(client).not.toBeNull();
	});

	describe("interactions", function()
	{
		beforeAll(function (done)
		{
			this.timeout = 3500;

			var server = new OSCConnection.createConnection({
				type: 'websocket',
				server: this.webServer,
				path: "/oscServer"
			});
			var serverHandler = {
				osc_connection: function onServerConnect()
				{
					log("server connect");
					setTimeout(done, 0);
				},
				osc_message: function onServerMessage(from, message)
				{
					log("server received: " + message.toString());
				},
				osc_error: function onError(from, error)
				{ log(error.stack || error); }
			};
			server.addHandler(serverHandler);

			var url = 'ws://localhost:' + this.webServer.port + "/oscServer";
			log(url);
			var client = new OSCConnection.createConnection({
				type: 'websocket',
				url: url
			});
			var clientHandler = {
				osc_connection: function onClientConnect()
				{
					log("client connect");
				},
				osc_message: function onClientMessage(from, message)
				{
					log("client received: " + message.toString());
				},
				osc_error: function onError(from, error)
				{ log(error.stack || error); }
			}
			client.addHandler(clientHandler);

			this.server = server;
			this.client = client;
			this.serverHandler = serverHandler;
			this.clientHandler = clientHandler;
		});

		afterAll(function ()
		{
			this.server.removeHandler(this.serverHandler);
			this.client.removeHandler(this.clientHandler);

			this.client.close();
			this.server.close();
		});

		it("sends a message from client to server", function (done)
		{
			var testMessage = new OSCMessage('/test/message')
				.addInt32(4);

			this.spy(this.serverHandler, 'osc_message');

			this.client.sendMessage(testMessage);

			setTimeout((function ()
			{
				log("C->S done");
				expect(this.serverHandler.osc_message).toHaveBeenCalledOnce();

				done();
			}).bind(this), 3000);
		});

		it("sends a message from server to client", function (done)
		{
			var testMessage = new OSCMessage('/test/message')
				.addInt32(4);

			this.spy(this.clientHandler, 'osc_message');

			this.server.sendMessage(testMessage);

			setTimeout((function ()
			{
				log("S->C done");
				expect(this.clientHandler.osc_message).toHaveBeenCalledOnce();

				done();
			}).bind(this), 3000);
		});
	});
})