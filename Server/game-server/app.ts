import {RESERVED, pinus} from 'pinus';
import {preload} from './preload';
import {DefaultErrorHandler} from "./app/exception/AppErrorHandler";

/**
 *  替换全局Promise
 *  自动解析sourcemap
 *  捕获全局错误
 */
preload();

/**
 * Init app for client.
 */
let app = pinus.createApp();
app.set('name', 'Server');

// app configuration
app.configure('production|development', 'connector', function () {
    app.set('connectorConfig',
        {
            connector: pinus.connectors.hybridconnector,
            heartbeat: 3,
            useDict: true,
            useProtobuf: true
        });

    app.set(RESERVED.ERROR_HANDLER, DefaultErrorHandler)
});

// start app
app.start();

