

var buster = require('buster');
buster.spec.expose();
var expect = buster.referee.expect;

var OSCMessage = require('../lib/OSCMessage');
var OSCConnection = require('../lib/OSCConnection');
var OSCServer = require('../lib/OSCServer');

var log = function ()
{
	buster.log.apply(buster, ["TEST(OSCServer): "].concat(Array.prototype.slice.call(arguments)));
};
log = console.log.bind(console, "TEST(OSCServer): ");

OSCServer.setLog(log);
OSCConnection.setLog(log);

describe("OSCServer", function ()
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

	it("creates a server", function ()
	{
		var server = new OSCServer({
			connections: [
				{ type: 'websocket'
				, server: this.webServer
				}
			]
		});

		expect(server).not.toBeNull();

		try
		{
			server.close();
		}
		catch (error)
		{
			expect(error).toBeNull();
		}
	});

	describe("communication", function ()
	{
		beforeAll(function ()
		{
			this.server = new OSCServer({
				connections: [
					{ type: 'websocket'
					, server: this.webServer
					, path: '/oscServer'
					}
				]
			});
			this.client = OSCConnection.createConnection({
				type: 'websocket',
				url: 'ws://localhost:' + this.webServer.port + '/oscServer'
			});

			this.clientHandler = {
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
			this.client.addHandler(this.clientHandler);
		});

		afterAll(function ()
		{
			this.server.close();
		});

		it("accepts a client connection", function (done)
		{
			this.timeout = 2000;
			this.spy(this.server, 'osc_connection');

			expect(this.client).not.toBeNull();

			setTimeout((function ()
			{
				expect(this.server.osc_connection).toHaveBeenCalledOnce();
				done();
			}).bind(this));
		});

		it("accepts a message from client", function (done)
		{
			this.timeout = 2000;

			var received = null;
			var client = null;
			var testMessage = new OSCMessage('/test');

			var spy = this.spy();

			this.server.on('message', spy);

			setTimeout((function()
			{
				expect(spy).toHaveBeenCalledOnceWith(testMessage);
				done();
			}).bind(this), 1500)

			this.client.sendMessage(testMessage);
		});

		it("sends a message to client", function (done)
		{
			this.timeout = 2000;

			var received = null;
			var client = null;
			var testMessage = new OSCMessage('/test');

			this.spy(this.clientHandler, 'osc_message');

			setTimeout((function()
			{
				expect(this.clientHandler.osc_message).toHaveBeenCalledOnce();
				done();
			}).bind(this), 1500)

			this.server.sendMessage(testMessage);
		});
	});
});
