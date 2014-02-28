
var buster = require('buster');
buster.spec.expose();


var OSCMessage = require('../lib/OSCMessage');

function serialize(a)
{
	var values = [];
	for (var i = 0; i < a.length; ++i)
	{
		if (typeof(a[i]) === 'string')
		{
			for (var c = 0; c < a[i].length; ++c)
			{
				values.push(0xFF & a[i].charCodeAt(c));
			}
		}
		else if (typeof(a[i]) === 'number')
		{
			values.push(0xFF & a[i]);
		}
	}

	//values.unshift(0,0,0,0);

	var buf = new Uint8Array(values);

	//var szbuf = new DataView(buf.buffer);
	//szbuf.setUint32(0, szbuf.byteLength - 4);

	return buf.buffer;
}

function _b(b,i)
{
	if (i >= b.length) return "  ";
	return ("00" + b[i].toString(16)).substr(-2);
}

var log = function () {}
log = console.log.bind(console, "TEST(OSCMessage): ");

function viscompare(a1, a2)
{
	len = Math.max(a1.byteLength, a2.byteLength);

	log("/-----------------------\\")
	for (var b = 0; b < len; b += 4)
	{
		log(
			_b(a1,b+0) + " " +
			_b(a1,b+1) + " " +
			_b(a1,b+2) + " " +
			_b(a1,b+3) + " | " +
			_b(a2,b+0) + " " +
			_b(a2,b+1) + " " +
			_b(a2,b+2) + " " +
			_b(a2,b+3)
		);
	}
	log("\\-----------------------/")
}

function compare(a1, a2)
{
	a1 = new Uint8Array(a1);
	a2 = new Uint8Array(a2);

	if (a1.byteLength == a2.byteLength)
	{
		for (var b = 0; b < a1.byteLength; ++b)
		{
			if (a1[b] != a2[b])
			{
				viscompare(a1, a2);
				log("Buffers don't match at byte " + b);
				return false;
			}
		}
	}
	else
	{
		viscompare(a1, a2);
		log("Buffer lengths don't match (" + a1.byteLength + " v. " + a2.byteLength + ")");
		return false;
	}
	return true;
}

function createMessage(address, types, values)
{
	var msg = new OSCMessage(address);
	if (types)
	{
		for (var p = 0; p < types.length; ++p)
		{
			msg.addParameter(types[p], values[p]);
		}
	}
	return msg;
}


describe("OSCMessage", function ()
{
	it("converts to string correctly", function ()
	{
		var testValue = createMessage('/test', [OSCMessage.TYPE_INT32], [1]).toString();
		buster.assert.equals(testValue, '/test,i 1');
	});
	it("serialized simple message matches expected results", function ()
	{
		var testValue = createMessage('/test', [OSCMessage.TYPE_INT32], [1]).serialize();
		var referenceValue = serialize([ '/test',0,0,0, ',i',0,0, 0,0,0,1 ]);
		buster.assert(compare(testValue, referenceValue));
	});
	it("deserialized simple message matches expected results", function ()
	{
		var testValue = createMessage(serialize([ '/test',0,0,0, ',i',0,0, 0,0,0,1 ]));
		buster.assert.equals(testValue.address, '/test');
		buster.assert.equals(testValue.getParameterCount(), 1);
		buster.assert.equals(testValue.getParameterType(0), OSCMessage.TYPE_INT32);
		buster.assert.equals(testValue.getParameterValue(0), 1);
	});

	it("serialized complex message matches expected results", function ()
	{
		var testValue = createMessage('/test/complex/message', 
			[
				OSCMessage.TYPE_NIL,
				OSCMessage.TYPE_INT32,
				OSCMessage.TYPE_STRING,
				OSCMessage.TYPE_STRING,
				OSCMessage.TYPE_FLOAT32,
				OSCMessage.TYPE_FLOAT32,
				OSCMessage.TYPE_TRUE
			], 
			[
				null,
				1,
				"",
				"An embedded string",
				42,
				-2.77E26,
				true
			]
		).serialize();
		var referenceValue = serialize([ '/test/complex/message',0,0,0, ',NissffT',0,0,0,0, 0,0,0,1, 0,0,0,0, 
			'An embedded string',0,0, 0x42,0x28,0x00,0x00, 0xeb,0x65,0x21,0x08 ]);
		buster.assert(compare(testValue, referenceValue));
	});
	it("deserialized complex message matches expected results", function ()
	{
		var testValue = createMessage(serialize([ '/test/complex/message',0,0,0, ',NissffT',0,0,0,0, 0,0,0,1, 0,0,0,0, 
			'An embedded string',0,0, 0x42,0x28,0x00,0x00, 0xeb,0x65,0x21,0x08 ]));
		buster.assert.equals(testValue.address, '/test/complex/message');
		buster.assert.equals(testValue.getParameterCount(), 7);
		buster.assert.equals(testValue.getParameterType(0), OSCMessage.TYPE_NIL);
		buster.assert.equals(testValue.getParameterValue(0), null);
		buster.assert.equals(testValue.getParameterType(1), OSCMessage.TYPE_INT32);
		buster.assert.equals(testValue.getParameterValue(1), 1);
		buster.assert.equals(testValue.getParameterType(2), OSCMessage.TYPE_STRING);
		buster.assert.equals(testValue.getParameterValue(2), "");
		buster.assert.equals(testValue.getParameterType(3), OSCMessage.TYPE_STRING);
		buster.assert.equals(testValue.getParameterValue(3), "An embedded string");
		buster.assert.equals(testValue.getParameterType(4), OSCMessage.TYPE_FLOAT32);
		buster.assert.near(testValue.getParameterValue(4), 42, 0.1);
		buster.assert.equals(testValue.getParameterType(5), OSCMessage.TYPE_FLOAT32);
		buster.assert.near(testValue.getParameterValue(5), -2.77E26, 2e23);
		buster.assert.equals(testValue.getParameterType(6), OSCMessage.TYPE_TRUE);
		buster.assert.equals(testValue.getParameterValue(6), true);
	});
	it("serialized message is deserialized as expected", function ()
	{
		var testMessage = new OSCMessage('/test/both/ways')
			.addInt32(12)
			.addFloat64(9.323E-12)
			.addString("text to send")
			.addNil()
			.addTrue()
			.addInt32(0)

		var result = new OSCMessage(testMessage.serialize());
		buster.assert.equals(testMessage.toString(), result.toString());
	})
});




