
(function () {
	var module_name = "OSCMessage";
	var module_dependencies =
	[ './DataWriter'
	, './DataReader'
	];

	function define_module(DataWriter, DataReader)
	{
		var log = function () {};
		//log = console.log.bind(console, "| OSCMessage | ");

		function string_size(s)
		{
			var len = s.toString().length + 1;
			var mod = len % 4;

			return mod?(len + (4 - mod)):len;
		}

		function constant_size(c)
		{ return function get_const_size() { return c; }; }

		function blob_size(b)
		{
			var len = b.byteLength + 4;
			var mod = len % 4;

			return mod?(len + (4 - mod)):len;
		}

		function serializeInt32(v, w)
		{ w.writeInt32(v); }
		function deserializeInt32(r)
		{ return r.readInt32(); }
		function serializeInt64(v, w)
		{ throw new Error('Int64 not supported in JavaScript'); }
		function deserializeInt64(r)
		{ throw new Error('Int64 not supported in JavaScript'); }

		function serializeFloat32(v, w)
		{ w.writeFloat32(v); }
		function deserializeFloat32(r)
		{ return r.readFloat32(); }
		function serializeFloat64(v, w)
		{ w.writeFloat64(v); }
		function deserializeFloat64(r)
		{ return r.readFloat64(); }

		function serializeString(v, w)
		{ w.writeString(v); }
		function deserializeString(r)
		{ return r.readString(); }

		function serializeTimeCode(t, w)
		{
			if (t == null || t == 0)
			{
				w.writeUint32(0);
				w.writeUint32(1);
			}
			else
			{
				if (t instanceof Date)
					{ t = t.getTime(); }
				var time = t/1000;
				var seconds = Math.floor(time);
				var fraction = Math.floor((time - seconds) * 0xffffffff);
				log("timestamp serialized: " + seconds + " " + fraction + " <= " + t);
				w.writeUint32(seconds);
				w.writeUint32(fraction);
			}
		}

		function deserializeTimeCode(r)
		{
			var seconds = r.readUint32();
			var fraction = r.readUint32();

			if (seconds === 0 && fraction === 1)
			{
				return 0;
			}
			else
			{
				var t = Math.floor((seconds + (fraction / 0xffffffff)) * 1000);
				log("timestamp deserialized: " + seconds + " " + fraction + " " + t);
				return t;
			}
		}

		function serializeBlob(v, w)
		{
			if (v instanceof ArrayBuffer)
			{
				w.writeInt32(v.byteLength);
				w.writeChunk(v);
			}
			else
				{ throw new Error("Can only serialize ArrayBuffer."); }
		}
		function deserializeBlob(r)
		{
			var len = r.readInt32();
			return r.readChunk(len);
		}

		function serializeNil(v, w) {}
		function deserializeNil(r) { return null; }
		function deserializeTrue(r) { return true; }
		function deserializeFalse(r) { return false; }
		function deserializeInfinitum(r) { return Infinity; }

		function OSCType(code, serialize_fn, deserialize_fn)
		{
			this.code = code;
			this.serialize = serialize_fn;
			this.deserialize = deserialize_fn;
		}

		function OSCMessage(address, timestamp)
		{
			this.routingState = OSCMessage.STATE_UNHANDLED;
			this._parameters = [];

			if (typeof(address) === 'string')
				{ this.address = address; }
			else if (address instanceof Array)
			{
				log("Creating bundle of " + address.length + " messages: ", address);
				this.address = "#bundle";
				this.timestamp = timestamp;
				this.bundle = address.slice();
			}
			else if (typeof(address.byteLength) !== 'undefined')
				{ this.deserialize(address); }
		}

		OSCMessage.STATE_UNHANDLED = 0;
		OSCMessage.STATE_HANDLED = 1;
		OSCMessage.STATE_IGNORED = 2;
		OSCMessage.STATE_STOPPED = 3;
		OSCMessage.STATE_REPLACED = 4;

		OSCMessage._types = [
			OSCMessage.TYPE_INT32     = new OSCType('i'.charCodeAt(0), serializeInt32,   deserializeInt32),
			OSCMessage.TYPE_FLOAT32   = new OSCType('f'.charCodeAt(0), serializeFloat32, deserializeFloat32),
			OSCMessage.TYPE_STRING    = new OSCType('s'.charCodeAt(0), serializeString,  deserializeString),
			OSCMessage.TYPE_BLOB      = new OSCType('b'.charCodeAt(0), serializeBlob,    deserializeBlob),
			OSCMessage.TYPE_INT64     = new OSCType('h'.charCodeAt(0), serializeInt64,   deserializeInt64),
			OSCMessage.TYPE_TIME      = new OSCType('t'.charCodeAt(0), serializeTimeCode,deserializeTimeCode),
			OSCMessage.TYPE_FLOAT64   = new OSCType('d'.charCodeAt(0), serializeFloat64, deserializeFloat64),
			OSCMessage.TYPE_SYMBOL    = new OSCType('S'.charCodeAt(0), serializeString,  deserializeString),
			OSCMessage.TYPE_CHAR      = new OSCType('c'.charCodeAt(0), serializeInt32,   deserializeInt32),
			OSCMessage.TYPE_COLOR     = new OSCType('r'.charCodeAt(0), serializeInt32,   deserializeInt32),
			OSCMessage.TYPE_MIDI      = new OSCType('m'.charCodeAt(0)),
			OSCMessage.TYPE_TRUE      = new OSCType('T'.charCodeAt(0), serializeNil,     deserializeTrue),
			OSCMessage.TYPE_FALSE     = new OSCType('F'.charCodeAt(0), serializeNil,     deserializeFalse),
			OSCMessage.TYPE_NIL       = new OSCType('N'.charCodeAt(0), serializeNil,     deserializeNil),
			OSCMessage.TYPE_INFINITUM = new OSCType('I'.charCodeAt(0), serializeNil,     deserializeInfinitum),
			OSCMessage.TYPE_ARRAY     = new OSCType('['.charCodeAt(0))
		];

		OSCMessage.typeForChar = function typeForChar(c)
		{
			c = c.charCodeAt(0);
			for (var t = 0; t < OSCMessage._types.length; ++t)
			{
				if (OSCMessage._types[t].code === c)
					{ return OSCMessage._types[t]; }
			}
			debugger;
			return null;
		}

		OSCMessage.typeForValue = function typeForValue(v)
		{
			var t = typeof(v);

			if (t === 'boolean')
				{ return t?OSCMessage.TYPE_TRUE:OSCMessage.TYPE_FALSE; }
			else if (t === 'object')
			{
				if (v instanceof Array)
					{ return OSCMessage.TYPE_ARRAY; }
				else if (v == null)
					{ return OSCMessage.TYPE_NIL; }
			}
			else if (t === 'undefined')
				{ return OSCMessage.TYPE_NIL; }
			else
			{
				if (isNaN(v))
					{ return OSCMessage.TYPE_STRING; }
				else if (v === Infinity)
					{ return OSCMessage.TYPE_INFINITUM; }
				else if (Math.floor(v) == v)
					{ return OSCMessage.TYPE_INT32; }
				else
					{ return OSCMessage.TYPE_FLOAT32; }
			}
		}

		OSCMessage.prototype.addParameter = function addParameter(type, value)
		{
			if (this.__curArray)
				{ this.__curArray.push({ t: type, v: value }); }
			else
				{ this._parameters.push({ t: type, v: value }); }

			//log("Parameter Added ", this);
			return this;
		}

		OSCMessage.prototype.getParameterCount = function getParameterCount()
		{ return this._parameters.length; }

		OSCMessage.prototype.getParameterType = function getParameterType(index)
		{
			if (index >= 0 && index < this._parameters.length)
				{ return this._parameters[index].t }
		}

		OSCMessage.prototype.getParameterValue = function getParameterValue()
		{
			function getValueAtIndex(array)
			{
				var index = arguments[1];
				if (index >= 0 && index < array.length)
				{
					if (array[index].t === OSCMessage.TYPE_ARRAY)
					{
						if (arguments.length == 2)
						{
							return _getArrayValues(array[index].v);
						}
						else
						{
							return getValueAtIndex.apply(undefined, 
								[array].concat(Array.prototype.slice.call(arguments, 2)));
						}
					}
					return array[index].v;
				}
				return null;
			}
			return getValueAtIndex.apply(undefined,
				[this._parameters].concat(Array.prototype.slice.call(arguments)));
		}

		function _getArrayValues(array)
		{
			return array.map(function (o) 
				{
					if (o.t === OSCMessage.TYPE_ARRAY)
						{ return _getArrayValues(o.v); }
					else
						{ return o.v; }
				});
		}

		OSCMessage.prototype.getParameterValues = function getParameterValues()
		{
			return _getArrayValues(this._parameters);
		}

		// official type tags
		OSCMessage.prototype.addInt32     = function (v) { return this.addParameter(OSCMessage.TYPE_INT32, v); }
		OSCMessage.prototype.addFloat32   = function (v) { return this.addParameter(OSCMessage.TYPE_FLOAT32, v); }
		OSCMessage.prototype.addString    = function (v) { return this.addParameter(OSCMessage.TYPE_STRING, v); }
		OSCMessage.prototype.addBlob      = function (v) { return this.addParameter(OSCMessage.TYPE_BLOB, v); }

		// unofficial type tags
		OSCMessage.prototype.addInt64     = function (v) { return this.addParameter(OSCMessage.TYPE_INT64, v); }
		OSCMessage.prototype.addTimeTag   = function (v) { return this.addParameter(OSCMessage.TYPE_TIME, v); }
		OSCMessage.prototype.addFloat64   = function (v) { return this.addParameter(OSCMessage.TYPE_FLOAT64, v); }
		OSCMessage.prototype.addSymbol    = function (v) { return this.addParameter(OSCMessage.TYPE_SYMBOL, v); }
		OSCMessage.prototype.addChar      = function (v) { return this.addParameter(OSCMessage.TYPE_CHAR, v); }
		OSCMessage.prototype.addColor     = function (v) { return this.addParameter(OSCMessage.TYPE_COLOR, v); }
		OSCMessage.prototype.addMidi      = function (v) { return this.addParameter(OSCMessage.TYPE_MIDI, v); }
		OSCMessage.prototype.addTrue      = function (v) { return this.addParameter(OSCMessage.TYPE_TRUE, v); }
		OSCMessage.prototype.addFalse     = function (v) { return this.addParameter(OSCMessage.TYPE_FALSE, v); }
		OSCMessage.prototype.addNil       = function (v) { return this.addParameter(OSCMessage.TYPE_NIL, v); }
		OSCMessage.prototype.addInfinitum = function (v) { return this.addParameter(OSCMessage.TYPE_INFINITUM, v); }

		OSCMessage.prototype.addAuto = function (v)
		{
			var t = OSCMessage.typeForValue(v);
			if (t)
				{ this.addParameter(t, v); }
		}

		OSCMessage.prototype.openArray = function openArray()
		{
			var array = [];
			this.addParameter(OSCMessage.TYPE_ARRAY, array);
			var lastArray = this.__curArray;
			this.__curArray = array;
			this.__curArray.lastArray = lastArray;

			return this;
		}

		OSCMessage.prototype.closeArray = function closeArray()
		{
			this.__curArray = this.__curArray.lastArray;
			return this;
		}

		OSCMessage.prototype._typeTag = function typeTag()
		{
			function getTypes(array)
			{
				var typeTag = "";
				for (var p = 0; p < array.length; ++p)
				{
					var type = array[p].t;
					if (type == null)
						{ debugger; }

					if (type === OSCMessage.TYPE_ARRAY)
					{
						typeTag += "[" + getTypes(array[p].v) + "]";
					}
					else
					{
						typeTag += String.fromCharCode(type.code);
					}
				}
				return typeTag;
			}

			return "," + getTypes(this._parameters);
		}

		OSCMessage.prototype.serialize = function serialize(prependSize)
		{
			var typeTag = this._typeTag();
			var writer = new DataWriter(4);

			serializeString(this.address, writer);
			if (this.address === "#bundle")
			{
				serializeTimeCode(this.timestamp, writer);

				//log("serializing bundle with " + this.bundle.length + " messages.");
				for (var s = 0; s < this.bundle.length; ++s)
				{
					writer.writeChunk(this.bundle[s].serialize(true));
				}
			}
			else
			{
				serializeString(typeTag, writer);

				// parameter values
				function serializeValues(array)
				{
					for (var p = 0; p < array.length; ++p)
					{
						var type = array[p].t;
						var value = array[p].v;

						if (type === OSCMessage.TYPE_ARRAY)
						{
							serializeValues(value);
						}
						else
						{
							if (typeof(type.serialize) !== 'function')
								{ throw new Error("Unsupported OSC Type."); }

							type.serialize(value, writer);
						}
					}
				}

				serializeValues(this._parameters);
			}

			return writer.serialize(prependSize);
		}

		OSCMessage.prototype.deserialize = function deserialize(buffer)
		{
			log("deserialize:", buffer);

			if (buffer.buffer)
				{ buffer = buffer.buffer; }

			var reader = new DataReader(buffer, 4);

			this.address = reader.readString();
			log("address: " + this.address);

			if (this.address === "#bundle")
			{
				log("deserializing bundle");

				this.timestamp = deserializeTimeCode(reader);

				this.bundle = [];
				while (reader.rest > 0)
				{
					var len = reader.readUint32();
					log(len + " byte message");
					if (reader.rest >= len)
					{
						var sub = reader.readChunk(len);
						this.bundle.push(new OSCMessage(sub));
					}
				}
			}
			else
			{
				var typeTag = reader.readString();
				log("types: " + typeTag);

				if (typeTag.charAt() === ',')
				{
					for (var i = 1; i < typeTag.length; ++i)
					{
						var type = typeTag.charCodeAt(i);
						if (type === OSCMessage.TYPE_ARRAY.code)
						{
							this.openArray();
						}
						else if (type === ']'.charCodeAt())
						{
							this.closeArray();
						}
						else
						{
							for (var t = 0; t < OSCMessage._types.length; ++t)
							{
								var typeObj = OSCMessage._types[t];
								if (typeObj.code == type)
								{
									if (typeObj.deserialize)
										{ this.addParameter(typeObj, typeObj.deserialize(reader)); }
									else
										{ throw new Error("Unsupported type in buffer"); }
									break;
								}
							}
						}
					}
				}
				else
					{ throw new Error("Bad OSC type tag string: " + typeTag); }
			}
		}

		OSCMessage.prototype.toString = function toString()
		{
			if (this.address === "#bundle")
			{
				var str = "BUNDLE [\n";
				for (var i = 0; i < this.bundle.length; ++i)
				{
					str += "    " + this.bundle[i].toString() + "\n";
				}
				str += "]";
				if (this.timestamp)
					{ str += " @ " + this.timestamp; }
			}
			else
			{
				var str = this.address + this._typeTag();
				//log("MSG.toString(): ", str);

				function build(array)
				{
					for (var i = 0; i < array.length; ++i)
					{
						//log("  p1: " + String.fromCharCode(this._parameters[i].t.code) + ", " +
						//	this._parameters[i].v.toString());

						if (array[i].t === OSCMessage.TYPE_ARRAY)
						{
							str += " [";
							build(array[i].v);
							str += " ]";
						}
						else if (array[i].t === OSCMessage.TYPE_STRING)
							{ str += " \"" + array[i].v.toString() + "\""; }
						else if (array[i].t.serialize != serializeNil)
							{ str += " " + array[i].v.toString(); }
					}
				}

				build(this._parameters);
			}
			return str;
		}

		OSCMessage.fromString = function fromString(s)
		{
			try
			{
				log("parsing string: " + s);
				var i = s.indexOf(',');
				var address;
				if (i >= 0)
					{ address = s.substr(0, i); }
				else
					{ log("address: " + s); return new OSCMessage(s.trim()); }

				log("address: " + address);
				var message = new OSCMessage(address.trim());

				s = s.substr(i+1);
				i = s.search(/\s/);

				var types;
				if (i >= 0)
				{
					types = s.substr(0, i);
					s = s.substr(i).trim();
				}
				else
				{
					types = s;
					s = "";
				}

				log("type tag: " + types);

				var vals = [];

				while (s.length > 0)
				{
					log("values string is: " + s);
					if (s.charAt(0) == '"')
					{
						i = s.indexOf('"', 1);
						if (i === -1)
							{ return null; }
						while (s.charAt(i) === '\\')
							{ i = s.indexOf('"', i+1); }

						++i;
					}
					else
					{
						i = s.search(/\s/);
						if (i === -1)
							{ i = s.length; }
					}

					var v = s.substr(0, i).trim();
					log("parsing value: '" + v + "'");
					vals.push(JSON.parse(v));
					s = s.substr(i).trim();
				}

				log("values: ", vals);

				var v = 0;
				for (i = 0; i < types.length; ++i)
				{
					var type = OSCMessage.typeForChar(types.charAt(i));
					if (type.serialize === serializeNil)
					{
						message.addParameter(type);
					}
					else
					{
						message.addParameter(type, vals[v++]);
					}
				}

				return message;
			}
			catch (error)
			{
				log("parsing string failed: " + (error.stack || error));
			}
			return null;
		}

		return OSCMessage;
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
		window[module_name] = define_DataReader.apply(undefined, 
			module_dependencies.map(function _map(item)
			{
				item = item.substr(item.lastIndexOf("/") + 1);
				return window[item];
			})
		);
	}
})();


