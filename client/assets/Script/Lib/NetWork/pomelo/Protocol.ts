const PKG_HEAD_BYTES = 4;
const MSG_FLAG_BYTES = 1;
const MSG_ROUTE_CODE_BYTES = 2;
const MSG_ID_MAX_BYTES = 5;
const MSG_ROUTE_LEN_BYTES = 1;

const MSG_ROUTE_CODE_MAX = 0xffff;

const MSG_COMPRESS_ROUTE_MASK = 0x1;
const MSG_COMPRESS_GZIP_MASK = 0x1;
const MSG_COMPRESS_GZIP_ENCODE_MASK = 1 << 4;
const MSG_TYPE_MASK = 0x7;

function copyArray(dest: Uint8Array, doffset: number, src: Uint8Array, soffset: number, length: number) {
    // Uint8Array
    for (var index = 0; index < length; index++) {
        dest[doffset++] = src[soffset++];
    }
}

function msgHasId(type: any) {
    return type === Message.TYPE_REQUEST || type === Message.TYPE_RESPONSE;
}

function msgHasRoute(type: any) {
    return type === Message.TYPE_REQUEST || type === Message.TYPE_NOTIFY ||
        type === Message.TYPE_PUSH;
}

function caculateMsgIdBytes(id: number) {
    var len = 0;
    do {
        len += 1;
        id >>= 7;
    } while (id > 0);
    return len;
}

function encodeMsgFlag(type: any, compressRoute: boolean, buffer: any, offset: number, compressGzip: boolean) {
    if (type !== Message.TYPE_REQUEST && type !== Message.TYPE_NOTIFY &&
        type !== Message.TYPE_RESPONSE && type !== Message.TYPE_PUSH) {
        throw new Error('unkonw message type: ' + type);
    }

    buffer[offset] = (type << 1) | (compressRoute ? 1 : 0);

    if (compressGzip) {
        buffer[offset] = buffer[offset] | MSG_COMPRESS_GZIP_ENCODE_MASK;
    }

    return offset + MSG_FLAG_BYTES;
}

function encodeMsgId(id: number, buffer: any, offset: number) {
    do {
        var tmp = id % 128;
        var next = Math.floor(id / 128);

        if (next !== 0) {
            tmp = tmp + 128;
        }
        buffer[offset++] = tmp;

        id = next;
    } while (id !== 0);

    return offset;
}

function encodeMsgRoute(compressRoute: boolean, route: any, buffer: Uint8Array, offset: number) {
    if (compressRoute) {
        if (route > MSG_ROUTE_CODE_MAX) {
            throw new Error('route number is overflow');
        }

        buffer[offset++] = (route >> 8) & 0xff;
        buffer[offset++] = route & 0xff;
    } else {
        if (route) {
            buffer[offset++] = route.length & 0xff;
            copyArray(buffer, offset, route, 0, route.length);
            offset += route.length;
        } else {
            buffer[offset++] = 0;
        }
    }

    return offset;
}

function encodeMsgBody(msg: Uint8Array, buffer: Uint8Array, offset: number) {
    copyArray(buffer, offset, msg, 0, msg.length);
    return offset + msg.length;
}

var Package = {
    TYPE_HANDSHAKE: 1,
    TYPE_HANDSHAKE_ACK: 2,
    TYPE_HEARTBEAT: 3,
    TYPE_DATA: 4,
    TYPE_KICK: 5,
    /**
     * Package protocol encode.
     *
     * Pomelo package format:
     * +------+-------------+------------------+
     * | type | body length |       body       |
     * +------+-------------+------------------+
     *
     * Head: 4bytes
     *   0: package type,
     *      1 - handshake,
     *      2 - handshake ack,
     *      3 - heartbeat,
     *      4 - data
     *      5 - kick
     *   1 - 3: big-endian body length
     * Body: body length bytes
     *
     * @param  {Number}    type   package type
     * @param  {any} body   body content in bytes
     * @return {any}        new byte array that contains encode result
     */
    encode: function (type: number, body: any) {
        var length = body ? body.length : 0;
        var buffer = new Uint8Array(PKG_HEAD_BYTES + length);
        var index = 0;
        buffer[index++] = type & 0xff;
        buffer[index++] = (length >> 16) & 0xff;
        buffer[index++] = (length >> 8) & 0xff;
        buffer[index++] = length & 0xff;
        if (body) {
            copyArray(buffer, index, body, 0, length);
        }
        return buffer;
    },

    /**
     * Package protocol decode.
     * See encode for package format.
     *
     * @param  {any} buffer byte array containing package content
     * @return {Object}           {type: package type, buffer: body byte array}
     */
    decode: function (buffer: any) {
        var offset = 0;
        var bytes = new Uint8Array(buffer);
        var length = 0;
        var rs = [];
        while (offset < bytes.length) {
            var type = bytes[offset++];
            length = ((bytes[offset++]) << 16 | (bytes[offset++]) << 8 | bytes[offset++]) >>> 0;
            var body = length ? new Uint8Array(length) : null;
            if (body) {
                copyArray(body, 0, bytes, offset, length);
            }
            offset += length;
            rs.push({'type': type, 'body': body});
        }
        return rs.length === 1 ? rs[0] : rs;
    },
};


let Message = {
    TYPE_REQUEST: 0,
    TYPE_NOTIFY: 1,
    TYPE_RESPONSE: 2,
    TYPE_PUSH: 3,
    /**
     * Message protocol encode.
     *
     * @param  {Number} id            message id
     * @param  {Number} type          message type
     * @param  {Number} compressRoute whether compress route
     * @param  {Number|String} route  route code or route string
     * @param  {any} msg              message body bytes
     * @param  {any} compressGzip     Gzip
     * @return {any}               encode result
     */
    encode: function (id: number, type: number | String, compressRoute: boolean, route: any, msg: any, compressGzip: boolean = false) {
        // caculate message max length
        var idBytes = msgHasId(type) ? caculateMsgIdBytes(id) : 0;
        var msgLen = MSG_FLAG_BYTES + idBytes;

        if (msgHasRoute(type)) {
            if (compressRoute) {
                if (typeof route !== 'number') {
                    throw new Error('error flag for number route!');
                }
                msgLen += MSG_ROUTE_CODE_BYTES;
            } else {
                msgLen += MSG_ROUTE_LEN_BYTES;
                if (route) {
                    route = Protocol.strencode(route);
                    if (route.length > 255) {
                        throw new Error('route maxlength is overflow');
                    }
                    msgLen += route.length;
                }
            }
        }

        if (msg) {
            msgLen += msg.length;
        }

        var buffer = new Uint8Array(msgLen);
        var offset = 0;

        // add flag
        offset = encodeMsgFlag(type, compressRoute, buffer, offset, compressGzip);

        // add message id
        if (msgHasId(type)) {
            offset = encodeMsgId(id, buffer, offset);
        }

        // add route
        if (msgHasRoute(type)) {
            offset = encodeMsgRoute(compressRoute, route, buffer, offset);
        }

        // add body
        if (msg) {
            offset = encodeMsgBody(msg, buffer, offset);
        }

        return buffer;
    },

    /**
     * Message protocol decode.
     *
     * @param  {any|Uint8Array} buffer message bytes
     * @return {Object}            message object
     */
    decode: function (buffer: any) {
        var bytes = new Uint8Array(buffer);
        var bytesLen = bytes.byteLength;
        var offset = 0;
        var id = 0;
        var route = null;

        // parse flag
        var flag = bytes[offset++];
        var compressRoute = flag & MSG_COMPRESS_ROUTE_MASK;
        var type = (flag >> 1) & MSG_TYPE_MASK;
        var compressGzip = (flag >> 4) & MSG_COMPRESS_GZIP_MASK;

        // parse id
        if (msgHasId(type)) {
            var m = 0;
            var i = 0;
            do {
                //m = parseInt(bytes[offset]);
                //TODO: 感觉类型有点不一致啊
                m = bytes[offset];
                id += (m & 0x7f) << (7 * i);
                offset++;
                i++;
            } while (m >= 128);
        }

        // parse route
        if (msgHasRoute(type)) {
            if (compressRoute) {
                route = (bytes[offset++]) << 8 | bytes[offset++];
            } else {
                var routeLen = bytes[offset++];
                if (routeLen) {
                    route = new Uint8Array(routeLen);
                    copyArray(route, 0, bytes, offset, routeLen);
                    route = Protocol.strdecode(route);
                } else {
                    route = '';
                }
                offset += routeLen;
            }
        }

        // parse body
        var bodyLen = bytesLen - offset;
        var body = new Uint8Array(bodyLen);

        copyArray(body, 0, bytes, offset, bodyLen);

        return {
            'id': id, 'type': type, 'compressRoute': compressRoute,
            'route': route, 'body': body, 'compressGzip': compressGzip
        };
    },
};

export let Protocol = {
    "Package": Package,
    "Message": Message,
    /**
     * pomele client encode
     * id message id;
     * route message route
     * msg message body
     * socketio current support string
     */
    strencode: function (str: string) {
        var byteArray = new Uint8Array(str.length * 3);
        var offset = 0;
        for (var i = 0; i < str.length; i++) {
            var charCode = str.charCodeAt(i);
            var codes = null;
            if (charCode <= 0x7f) {
                codes = [charCode];
            } else if (charCode <= 0x7ff) {
                codes = [0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f)];
            } else {
                codes = [0xe0 | (charCode >> 12), 0x80 | ((charCode & 0xfc0) >> 6), 0x80 | (charCode & 0x3f)];
            }
            for (var j = 0; j < codes.length; j++) {
                byteArray[offset] = codes[j];
                ++offset;
            }
        }
        var _buffer = new Uint8Array(offset);
        copyArray(_buffer, 0, byteArray, 0, offset);
        return _buffer;
    },

    /**
     * client decode
     * msg String data
     * return Message Object
     */
    strdecode: function (buffer: any) {
        var bytes = new Uint8Array(buffer);
        var array = [];
        var offset = 0;
        var charCode = 0;
        var end = bytes.length;
        while (offset < end) {
            if (bytes[offset] < 128) {
                charCode = bytes[offset];
                offset += 1;
            } else if (bytes[offset] < 224) {
                charCode = ((bytes[offset] & 0x1f) << 6) + (bytes[offset + 1] & 0x3f);
                offset += 2;
            } else {
                charCode = ((bytes[offset] & 0x0f) << 12) + ((bytes[offset + 1] & 0x3f) << 6) + (bytes[offset + 2] & 0x3f);
                offset += 3;
            }
            array.push(charCode);
        }
        var res = '';
        var chunk = 8 * 1024;
        var i;
        for (i = 0; i < array.length / chunk; i++) {
            res += String.fromCharCode.apply(null, array.slice(i * chunk, (i + 1) * chunk));
        }
        res += String.fromCharCode.apply(null, array.slice(i * chunk));
        return res;

    },
};
