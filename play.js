import http from 'http';
import https from 'https';
import tls from 'tls';
import net from 'net';
import { SocksClient } from 'socks';
import { URL } from 'url';
import got from 'got'

class TrafficStatsAgent extends http.Agent {
    /**
     * 
     * @param {http.AgentOptions} options  Agent options
     * @param {string} proxy  proxy url (http/socks)
     */
    constructor(options = {}, proxy = null) {
        super(options);
        this.trafficStats = {
            sentBytes: 0,
            receivedBytes: 0
        };
        this.proxy = proxy;
    }

    createConnection(options, callback) {
        // 处理代理连接
        if (this.proxy) {
            this.createProxyConnection(options, (err, socket) => {
                if (err) return callback(err);
                this.setupSocketTracking(socket);
                callback(null, socket);
            });
            return; // 返回 undefined，连接将通过回调处理
        }

        // 无代理的直接连接
        const socket = super.createConnection(options, callback);
        this.setupSocketTracking(socket);
        return socket;
    }

    createProxyConnection(options, callback) {
        const proxyUrl = new URL(this.proxy);
        const target = {
            host: options.host,
            port: options.port || 80
        };

        // SOCKS 代理
        if (proxyUrl.protocol.startsWith('socks')) {
            this.createSocksConnection(proxyUrl, target, callback);
            return;
        }

        // HTTP 代理
        this.createHttpProxyConnection(proxyUrl, target, callback);
    }

    createSocksConnection(proxyUrl, target, callback) {
        SocksClient.createConnection({
            proxy: {
                host: proxyUrl.hostname,
                port: parseInt(proxyUrl.port),
                type: proxyUrl.protocol === 'socks:' ? 4 : 5
            },
            destination: {
                host: target.host,
                port: target.port
            },
            command: 'connect'
        }, (err, info) => {
            if (err) return callback(err);
            callback(null, info.socket);
        });
    }

    createHttpProxyConnection(proxyUrl, target, callback) {
        // 连接到代理服务器
        const proxySocket = net.connect({
            host: proxyUrl.hostname,
            port: parseInt(proxyUrl.port) || (proxyUrl.protocol === 'https:' ? 443 : 80)
        });

        let receivedData = Buffer.alloc(0);
        let connected = false;

        const onData = (data) => {
            if (connected) return;
            
            receivedData = Buffer.concat([receivedData, data]);
            if (receivedData.includes('\r\n\r\n')) {
                proxySocket.removeListener('data', onData);
                
                const statusCode = receivedData.toString().split(' ')[1];
                if (statusCode === '200') {
                    connected = true;
                    callback(null, proxySocket);
                } else {
                    proxySocket.destroy();
                    callback(new Error(`Proxy connection failed: ${receivedData.toString()}`));
                }
            }
        };

        const onError = (err) => {
            cleanup();
            callback(err);
        };

        const onClose = () => {
            if (!connected) {
                cleanup();
                callback(new Error('Proxy connection closed before complete'));
            }
        };

        const cleanup = () => {
            proxySocket.removeListener('data', onData);
            proxySocket.removeListener('error', onError);
            proxySocket.removeListener('close', onClose);
        };

        proxySocket.on('data', onData);
        proxySocket.on('error', onError);
        proxySocket.on('close', onClose);

        // 发送CONNECT请求建立隧道
        proxySocket.write(`CONNECT ${target.host}:${target.port} HTTP/1.1\r\nHost: ${target.host}:${target.port}\r\n\r\n`);
    }

    setupSocketTracking(socket) {
        const originalWrite = socket.write;
        const agent = this;

        // 跟踪发送数据量
        socket.write = function(chunk, encoding, callback) {
            if (chunk) {
                const size = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
                agent.trafficStats.sentBytes += size;
            }
            return originalWrite.call(this, chunk, encoding, callback);
        };

        // 跟踪接收数据量
        socket.on('data', (chunk) => {
            this.trafficStats.receivedBytes += chunk.length;
        });
    }

    getTrafficStats() {
        return { ...this.trafficStats };
    }
}

class HttpsTrafficStatsAgent extends https.Agent {
    /**
     * 
     * @param {https.AgentOptions} options 
     * @param {string} proxy  proxy url (http/socks)
     */
    constructor(options = {}, proxy = null) {
        super(options);
        this.trafficStats = {
            sentBytes: 0,
            receivedBytes: 0,
        };
        this.proxy = proxy;
    }

    createConnection(options, callback) {
        // 创建基础连接（代理或直接）
        this.createBaseConnection(options, (err, rawSocket) => {
            if (err) return callback(err);
            
            // 设置TLS连接
            const tlsSocket = tls.connect({
                socket: rawSocket,
                host: options.host,
                servername: options.servername || options.host,
                rejectUnauthorized: false
            });

            // 流量统计
            tlsSocket.on('close', () => {
                this.trafficStats.sentBytes += rawSocket.bytesWritten;
                this.trafficStats.receivedBytes += rawSocket.bytesRead;
            });

            tlsSocket.on('secureConnect', () => {
                callback(null, tlsSocket);
            });

            tlsSocket.on('error', (err) => {
                callback(err);
            });
        });
        
        // 返回 undefined，连接将通过回调处理
        return;
    }

    createBaseConnection(options, callback) {
        if (this.proxy) {
            this.createProxyConnection(options, callback);
        } else {
            this.createDirectConnection(options, callback);
        }
    }

    createProxyConnection(options, callback) {
        const proxyUrl = new URL(this.proxy);
        const target = {
            host: options.host,
            port: options.port || 443
        };

        // SOCKS代理
        if (proxyUrl.protocol.startsWith('socks')) {
            this.createSocksConnection(proxyUrl, target, callback);
            return;
        }

        // HTTP代理
        this.createHttpProxyConnection(proxyUrl, target, callback);
    }

    createSocksConnection(proxyUrl, target, callback) {
        SocksClient.createConnection({
            proxy: {
                host: proxyUrl.hostname,
                port: parseInt(proxyUrl.port),
                type: proxyUrl.protocol === 'socks:' ? 4 : 5
            },
            destination: {
                host: target.host,
                port: target.port
            },
            command: 'connect'
        }, (err, info) => {
            if (err) return callback(err);
            callback(null, info.socket);
        });
    }

    createHttpProxyConnection(proxyUrl, target, callback) {
        // 连接到代理服务器
        const proxySocket = net.connect({
            host: proxyUrl.hostname,
            port: parseInt(proxyUrl.port) || (proxyUrl.protocol === 'https:' ? 443 : 80)
        });

        let receivedData = Buffer.alloc(0);
        let connected = false;

        const onData = (data) => {
            if (connected) return;
            
            receivedData = Buffer.concat([receivedData, data]);
            if (receivedData.includes('\r\n\r\n')) {
                proxySocket.removeListener('data', onData);
                
                const statusCode = receivedData.toString().split(' ')[1];
                if (statusCode === '200') {
                    connected = true;
                    callback(null, proxySocket);
                } else {
                    proxySocket.destroy();
                    callback(new Error(`Proxy connection failed: ${receivedData.toString()}`));
                }
            }
        };

        const onError = (err) => {
            cleanup();
            callback(err);
        };

        const onClose = () => {
            if (!connected) {
                cleanup();
                callback(new Error('Proxy connection closed before complete'));
            }
        };

        const cleanup = () => {
            proxySocket.removeListener('data', onData);
            proxySocket.removeListener('error', onError);
            proxySocket.removeListener('close', onClose);
        };

        proxySocket.on('data', onData);
        proxySocket.on('error', onError);
        proxySocket.on('close', onClose);

        // 发送CONNECT请求建立隧道
        proxySocket.write(`CONNECT ${target.host}:${target.port} HTTP/1.1\r\nHost: ${target.host}:${target.port}\r\n\r\n`);
    }

    createDirectConnection(options, callback) {
        const socket = net.connect({
            host: options.host,
            port: options.port || 443
        }, () => {
            callback(null, socket);
        });
        
        socket.on('error', callback);
    }

    getTrafficStats() {
        return { ...this.trafficStats };
    }
}

// 使用示例 ================================
const httpProxy = 'socks5://127.0.0.1:9050'; // 或 'socks://127.0.0.1:1080'
const httpsProxy = 'socks5://127.0.0.1:9050';

const httpTrafficStatsAgent = new TrafficStatsAgent({ keepAlive: true }, httpProxy);
const httpsTrafficStatsAgent = new HttpsTrafficStatsAgent({}, httpsProxy);

// 测试函数保持不变
function submit1() {
    got.get('http://www.example.com', {
        agent: {
            http: httpTrafficStatsAgent,
            https: httpsTrafficStatsAgent,
            http2: httpsTrafficStatsAgent,
        },
    }).text().finally(() => {
        console.log('HTTP流量统计结果:');
        console.log(httpTrafficStatsAgent.getTrafficStats());
    })
}

function submit2() {
    got.get('https://www.example.com', {
        agent: {
            http: httpTrafficStatsAgent,
            https: httpsTrafficStatsAgent,
            http2: httpsTrafficStatsAgent,
        },
    }).text().finally(() => {
        console.log('HTTPS流量统计结果:');
        console.log(httpsTrafficStatsAgent.getTrafficStats());
    })
}

// 执行测试
submit1();
// setTimeout(submit1, 3000);
submit2();