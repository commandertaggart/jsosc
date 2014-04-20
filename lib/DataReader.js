function define_DataReader()
{
	function DataReader(buffer, boundary)
	{
		if (buffer.toArrayBuffer)
			{ buffer = buffer.toArrayBuffer(); }

		boundary = boundary || 4;
		
		//console.log("buffer: ", buffer.byteLength, buffer.byteOffset);

		this._buffer = buffer;
		this._view = new DataView(buffer);
		this._index = 0;
		this._boundary = boundary;
	}

	DataReader.prototype.readInt8 = function readInt8()
	{
		var v = this._view.getInt8(this._index);
		this._index += this._boundary;
		return v;
	};

	DataReader.prototype.readUint8 = function readUint8()
	{
		var v = this._view.getUint8(this._index);
		this._index += this._boundary;
		return v;
	};

	DataReader.prototype.readInt16 = function readInt16()
	{
		var v = this._view.getInt16(this._index);
		this._index += Math.max(2, this._boundary);
		return v;
	};

	DataReader.prototype.readUint16 = function readUint16()
	{
		var v = this._view.getUint16(this._index);
		this._index += Math.max(2, this._boundary);
		return v;
	};

	DataReader.prototype.readInt32 = function readInt32()
	{
		var v = this._view.getInt32(this._index);
		this._index += Math.max(4, this._boundary);
		return v;
	};

	DataReader.prototype.readUint32 = function readUint32()
	{
		var v = this._view.getUint32(this._index);
		this._index += Math.max(4, this._boundary);
		return v;
	};

	DataReader.prototype.readFloat32 = function readFloat32()
	{
		var v = this._view.getFloat32(this._index);
		this._index += Math.max(4, this._boundary);
		return v;
	};

	DataReader.prototype.readFloat64 = function readFloat64()
	{
		var v = this._view.getFloat64(this._index);
		this._index += Math.max(8, this._boundary);
		return v;
	};

	DataReader.prototype.readString = function readString()
	{
		var codes = "";
		var c = this._view.getUint8(this._index++);
		while (c !== 0)
		{
			codes += String.fromCharCode(c);
			c = this._view.getUint8(this._index++);
		}

		//console.log("String found of length " + codes.length + ": ", codes);

		if (this._index % this._boundary !== 0)
			{ this._index += this._boundary - (this._index % this._boundary); }

		return codes;
	};

	DataReader.prototype.readChunk = function readChunk(length)
	{
		var buf = this._buffer.slice(this._index, this._index + length);
		this._index += length;
		return buf;
	};

	DataReader.prototype.__defineGetter__('length', function length()
		{ return this._buffer.byteLength; });
	DataReader.prototype.__defineGetter__('index', function index()
		{ return this._index; });
	DataReader.prototype.__defineGetter__('rest', function rest()
		{ return this.length - this.index; });

	return DataReader;
}

if (typeof(define) === 'function')
{
	define([], define_DataReader);
}
else if (typeof(module) !== 'undefined')
{
	module.exports = define_DataReader();
}
else if (typeof(window) !== 'undefined')
{
	window.DataReader = define_DataReader();
}
