import http from 'http';
import https from 'https';
import tls from 'tls';
import net from 'net';
import got from 'got';

class TrafficStatsAgent extends http.Agent {
    constructor(options = {}) {
        super(options);
        this.trafficStats = {
            sentBytes: 0,
            receivedBytes: 0
        };
    }

    createConnection(options, callback) {
        const socket = super.createConnection(options, callback);
        const originalWrite = socket.write;
        const agent = this;

        socket.write = function (chunk, encoding, callback) {
            if (chunk) {
                const size = Buffer.isBuffer(chunk)
                    ? chunk.length
                    : Buffer.byteLength(chunk, encoding);
                agent.trafficStats.sentBytes += size;
            }
            return originalWrite.call(this, chunk, encoding, callback);
        };

        socket.on('data', (chunk) => {
            this.trafficStats.receivedBytes += chunk.length;
        });

        return socket;
    }

    getTrafficStats() {
        return { ...this.trafficStats };
    }
}

class HttpsTrafficStatsAgent extends https.Agent {
    constructor(options = {}) {
        super(options);
        this.trafficStats = {
            sentBytes: 0,
            receivedBytes: 0
        };
        this.sockets = new Set(); // 跟踪所有原始socket
    }

    createConnection(options, callback) {
        const rawSocket = net.connect({
            host: options.host,
            port: options.port || 443
        });

        const tlsSocket = tls.connect({
            socket: rawSocket,
            host: options.host,
            servername: options.servername || options.host,
            rejectUnauthorized: false
        });

        // 保存原始socket用于后续统计
        this.sockets.add(rawSocket);

        // TLS连接关闭时统计流量
        tlsSocket.on('close', () => {
            this.trafficStats.sentBytes += rawSocket.bytesWritten;
            this.trafficStats.receivedBytes += rawSocket.bytesRead;
            this.sockets.delete(rawSocket);
        });

        tlsSocket.on('secureConnect', () => {
            callback(null, tlsSocket);
        });

        tlsSocket.on('error', callback);

        return tlsSocket;
    }

    getTrafficStats() {
        return { ...this.trafficStats };
    }
}

// 使用示例 ================================
const httpTrafficStatsAgent = new TrafficStatsAgent();
const httpsTrafficStatsAgent = new HttpsTrafficStatsAgent();

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
submit2();