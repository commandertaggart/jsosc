(function () {
	function define_DataWriter()
	{
		function DataWriter(boundary)
		{
			if (isNaN(boundary) || boundary <= 0)
				{ boundary = 4; }

			this._boundary = boundary;

			this._data = [];

			this._conversionBuffer = new ArrayBuffer(8);
			this._convert = new DataView(this._conversionBuffer);
		}

		DataWriter.prototype._pad = function pad(l)
		{
			//console.log("added " + l + " bytes to " + this._boundary + "-byte alignment");
			l = l % this._boundary;
			if (l > 0)
				{ l = this._boundary - l; }

			//console.log("padding out " + l + " bytes");
			while(l > 0)
			{
				this._data.push(0);
				--l
			}
		}

		DataWriter.prototype.writeInt8 = function writeInt8(v)
		{
			this._convert.setInt8(0, v);
			this._data.push(this._convert.getUint8(0));
			this._pad(1);
		}

		DataWriter.prototype.writeUint8 = function writeUint8(v)
		{
			this._convert.setUint8(0, v);
			this._data.push(this._convert.getUint8(0));
			this._pad(1);
		}

		DataWriter.prototype.writeInt16 = function writeInt16(v)
		{
			this._convert.setInt16(0, v, false)
			this._data.push(this._convert.getUint8(0), this._convert.getUint8(1));
			this._pad(2);
		}

		DataWriter.prototype.writeUint16 = function writeUint16(v)
		{
			this._convert.setUint16(0, v, false)
			this._data.push(this._convert.getUint8(0), this._convert.getUint8(1));
			this._pad(2);
		}

		DataWriter.prototype.writeInt32 = function writeInt32(v)
		{
			this._convert.setInt32(0, v, false)
			this._data.push(this._convert.getUint8(0), this._convert.getUint8(1), 
				this._convert.getUint8(2), this._convert.getUint8(3));
			this._pad(4);
		}

		DataWriter.prototype.writeUint32 = function writeUint32(v)
		{
			this._convert.setUint32(0, v, false)
			this._data.push(this._convert.getUint8(0), this._convert.getUint8(1), 
				this._convert.getUint8(2), this._convert.getUint8(3));
			this._pad(4);
		}

		DataWriter.prototype.writeFloat32 = function writeFloat32(v)
		{
			this._convert.setFloat32(0, v, false)
			this._data.push(this._convert.getUint8(0), this._convert.getUint8(1), 
				this._convert.getUint8(2), this._convert.getUint8(3));
			this._pad(4);
		}

		DataWriter.prototype.writeFloat64 = function writeFloat64(v)
		{
			this._convert.setFloat64(0, v, false)
			this._data.push(this._convert.getUint8(0), this._convert.getUint8(1), 
				this._convert.getUint8(2), this._convert.getUint8(3),
				this._convert.getUint8(4), this._convert.getUint8(5),
				this._convert.getUint8(6), this._convert.getUint8(7));
			this._pad(8);
		}

		DataWriter.prototype.writeString = function writeString(s)
		{
			for (var c = 0; c < s.length; ++c)
			{
				this._data.push(s.charCodeAt(c));
			}
			this._data.push(0);
			this._pad(s.length + 1);
		}

		DataWriter.prototype.writeChunk = function writeChunk(buffer)
		{
			var view = new Uint8Array(buffer);
			for (var b = 0; b < view.length; ++b)
			{
				this._data.push(view[b]);
			}
		}

		DataWriter.prototype.length = function length()
		{ return this._data.length; }

		DataWriter.prototype.serialize = function serialize(prependLength)
		{
			//console.log("serializing " + this._data.length + " bytes.");
			var len = this._data.length;

			if (prependLength)
				{ len += 4; }

			var buffer = new ArrayBuffer(len);
			var view = new Uint8Array(buffer);

			len = 0;
			if (prependLength)
			{
				len = 4;
				//console.log("prepending length of " + this._data.length);
				this._convert.setUint32(0, this._data.length, false);
				view[0] = this._convert.getUint8(0);
				view[1] = this._convert.getUint8(1);
				view[2] = this._convert.getUint8(2);
				view[3] = this._convert.getUint8(3);
			}
			view.set(this._data, len);

			return buffer;
		}

		return DataWriter;
	}

	if (typeof(define) === 'function')
	{
		define([], define_DataWriter);
	}
	else if (typeof(module) !== 'undefined')
	{
		module.exports = exports = define_DataWriter();
	}
	else if (typeof(window) !== 'undefined')
	{
		window.DataWriter = define_DataWriter();
	}
})();

