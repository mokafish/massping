import http from 'http';
import https from 'https';
import http2 from 'http2'; // 新增 http2 导入
import tls from 'tls';
import net from 'net';
import { SocksClient } from 'socks';

// ... 保留原有的 HttpTrafficStatsAgent 和 HttpsTrafficStatsAgent ...

export class Http2TrafficStatsAgent extends http2.Http2Session {
    /**
     * 
     * @param {http2.SessionOptions} options 
     * @param {string} proxy 代理地址 (http/socks)
     */
    constructor(options = {}, proxy = null) {
        super(options);
        this.trafficStats = {
            sentBytes: 0,
            receivedBytes: 0,
        };
        this.proxy = proxy;
        this.sockets = new Set();
    }

    async connect(authority, options) {
        if (this.proxy) {
            return this.createProxyConnection(authority, options);
        }
        return this.createDirectConnection(authority, options);
    }

    async createProxyConnection(authority, options) {
        const proxyUrl = new URL(this.proxy);
        const target = {
            host: authority.host,
            port: authority.port || 443
        };

        // SOCKS 代理
        if (proxyUrl.protocol.startsWith('socks')) {
            return this.createSocksConnection(proxyUrl, target);
        }

        // HTTP 代理
        return this.createHttpProxyConnection(proxyUrl, target, options);
    }

    async createSocksConnection(proxyUrl, target) {
        const { socket } = await SocksClient.createConnection({
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
        });

        this.setupSocketTracking(socket);
        return this.createTlsConnection(socket, target.host);
    }

    async createHttpProxyConnection(proxyUrl, target, options) {
        return new Promise((resolve, reject) => {
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
                    const statusLine = receivedData.toString().split('\r\n')[0];
                    const statusCode = parseInt(statusLine.split(' ')[1], 10);

                    if (statusCode >= 200 && statusCode < 300) {
                        connected = true;
                        this.setupSocketTracking(proxySocket);
                        resolve(this.createTlsConnection(proxySocket, target.host));
                    } else {
                        proxySocket.destroy();
                        reject(new Error(`Proxy connection failed: ${statusLine}`));
                    }
                }
            };

            proxySocket.once('error', reject);
            proxySocket.once('close', () => {
                if (!connected) reject(new Error('Proxy connection closed'));
            });

            proxySocket.on('data', onData);
            proxySocket.write(`CONNECT ${target.host}:${target.port} HTTP/1.1\r\nHost: ${target.host}:${target.port}\r\n\r\n`);
        });
    }

    createDirectConnection(authority, options) {
        return new Promise((resolve, reject) => {
            const socket = net.connect({
                host: authority.host,
                port: authority.port || 443
            });

            socket.once('connect', () => {
                this.setupSocketTracking(socket);
                resolve(this.createTlsConnection(socket, authority.host));
            });
            socket.once('error', reject);
        });
    }

    createTlsConnection(socket, servername) {
        const tlsSocket = tls.connect({
            socket,
            servername,
            ALPNProtocols: ['h2'], // 必须指定 ALPN
            ...this.options
        });

        tlsSocket.on('error', (err) => this.emit('error', err));
        tlsSocket.on('close', () => this.sockets.delete(socket));
        
        return new Promise((resolve, reject) => {
            tlsSocket.once('secureConnect', () => {
                if (tlsSocket.alpnProtocol !== 'h2') {
                    tlsSocket.destroy();
                    return reject(new Error('ALPN negotiation failed'));
                }
                resolve(tlsSocket);
            }); 
            
        });
    }

    setupSocketTracking(socket) {
        this.sockets.add(socket);

        const originalWrite = socket.write;
        socket.write = (chunk, encoding, callback) => {
            if (chunk) {
                const size = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
                this.trafficStats.sentBytes += size;
            }
            return originalWrite.call(socket, chunk, encoding, callback);
        };

        socket.on('data', (chunk) => {
            this.trafficStats.receivedBytes += chunk.length;
        });
    }

    getTrafficStats() {
        return { ...this.trafficStats };
    }

    destroy() {
        this.sockets.forEach(socket => socket.destroy());
        super.destroy();
    }
}

/**
 * 
 * @param {object} options Agent 配置
 * @param {string} proxy 代理地址 (http/socks)
 */
export default function TrafficStatsAgent(options, proxy) {
    return {
        http: new HttpTrafficStatsAgent(options, proxy),
        https: new HttpsTrafficStatsAgent(options, proxy),
        http2: new Http2TrafficStatsAgent(options, proxy) // 使用专用 HTTP/2 Agent
    };
}