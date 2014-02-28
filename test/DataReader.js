
var buster = require('buster');
buster.spec.expose();

var DataReader = require('../lib/DataReader');

var s8 = 'Int8';
var u8 = 'Uint8';
var s16 = 'Int16';
var u16 = 'Uint16';
var s32 = 'Int32';
var u32 = 'Uint32';
var f32 = 'Float32';
var f64 = 'Float64';
var ch = 'char';

var sizes = {
	'Int8': 1,
	'Uint8': 1,
	'Int16': 2,
	'Uint16': 2,
	'Int32': 4,
	'Uint32': 4,
	'Float32': 4,
	'Float64': 8,
	'char': 1
};

function serialize(a)
{
	var length = 0;
	for (var i = 0; i < a.length; i += 2)
	{
		length += sizes[a[i]];
	}

	var buf = new ArrayBuffer(length);
	var view = new DataView(buf);

	var offset = 0;
	for (var i = 0; i < a.length; i += 2)
	{
		if (a[i] == ch)
		{
			view.setUint8(offset, a[i+1].charCodeAt());
		}
		else
		{
			view['set' + a[i]](offset, a[i+1], false);
		}
		offset += sizes[a[i]];
	}
	return buf;
}

describe ("DataReader", function ()
{
	// INT 8
	it ("serializes a positive byte correctly", function ()
	{
		var r = new DataReader(serialize([u32, 4, s8, 24, u8, 0, u8, 0, u8, 0]), 4);
		buster.assert.equals(r.readUint32(), 4);
		var v = r.readInt8();
		buster.assert.equals(v,24);
	});
	it ("serializes a negative byte correctly", function ()
	{
		var r = new DataReader(serialize([u32, 4, s8, -24, u8, 0, u8, 0, u8, 0]), 4);
		buster.assert.equals(r.readUint32(), 4);
		var v = r.readInt8();
		buster.assert.equals(v,-24);
	});
	it ("serializes an unsigned byte correctly", function ()
	{
		var r = new DataReader(serialize([u32, 4, u8, 224, u8, 0, u8, 0, u8, 0]), 4);
		buster.assert.equals(r.readUint32(), 4);
		var v = r.readUint8();
		buster.assert.equals(v,224);
	});

	// INT 16
	it ("serializes a positive short correctly", function ()
	{
		var r = new DataReader(serialize([u32, 4, s16, 1337, u8, 0, u8, 0]), 4);
		buster.assert.equals(r.readUint32(), 4);
		var v = r.readInt16();
		buster.assert.equals(v,1337);
	});
	it ("serializes a negative short correctly", function ()
	{
		var r = new DataReader(serialize([u32, 4, s16, -1337, u8, 0, u8, 0]), 4);
		buster.assert.equals(r.readUint32(), 4);
		var v = r.readInt16();
		buster.assert.equals(v,-1337);
	});
	it ("serializes an unsigned short correctly", function ()
	{
		var r = new DataReader(serialize([u32, 4, u16, 65500, u8, 0, u8, 0]), 4);
		buster.assert.equals(r.readUint32(), 4);
		var v = r.readUint16();
		buster.assert.equals(v,65500);
	});	

	// INT 32
	it ("serializes a positive int correctly", function ()
	{
		var r = new DataReader(serialize([u32, 4, s32, 123456]), 4);
		buster.assert.equals(r.readUint32(), 4);
		var v = r.readInt32();
		buster.assert.equals(v,123456);
	});
	it ("serializes a negative int correctly", function ()
	{
		var r = new DataReader(serialize([u32, 4, s32, -123456]), 4);
		buster.assert.equals(r.readUint32(), 4);
		var v = r.readInt32();
		buster.assert.equals(v,-123456);
	});
	it ("serializes an unsigned int correctly", function ()
	{
		var r = new DataReader(serialize([u32, 4, u32, 3000000000]), 4);
		buster.assert.equals(r.readUint32(), 4);
		var v = r.readUint32();
		buster.assert.equals(v,3000000000);
	});	

	// FLOAT
	it ("serializes a float correctly", function ()
	{
		var r = new DataReader(serialize([u32, 4, f32, 9223.83]), 4);
		buster.assert.equals(r.readUint32(), 4);
		var v = r.readFloat32();
		buster.assert.near(v,9223.83,0.001);
	});
	it ("serializes a double correctly", function ()
	{
		var r = new DataReader(serialize([u32, 8, f64, 92233771293.83]), 4);
		buster.assert.equals(r.readUint32(), 8);
		var v = r.readFloat64();
		buster.assert.near(v,92233771293.83,0.001);
	});

	// STRING
	it ("serializes a string correctly", function ()
	{
		var r = new DataReader(serialize([u32, 8, ch, 'a', ch, 'b', ch, 'c', ch, 'd', ch, 'e', u8, 0, u8, 0, u8, 0]), 4);
		buster.assert.equals(r.readUint32(), 8);
		var v = r.readString();
		buster.assert.equals(v,"abcde");
	});

});

