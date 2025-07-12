#!/usr/bin/env node
import net from 'net'
const content = `<!DOCTYPE html>
<html>

<head>
    <title>504 Gateway Timeout</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no" />
    <style>
        html {
            color-scheme: light dark;
        }

        body {
            padding: 2em;
            max-width: 32em;
            margin: 0 auto;
            text-align: center;
            font-family: Tahoma, Verdana, Arial, sans-serif;
        }
    </style>
</head>

<body>
    <h1>504 Gateway Timeout</h1>
    <hr>
    <p>xping/1.0.0</p>
</body>

</html>
`

const server = net.createServer((socket) => {
    const clientIP = socket.remoteAddress;
    const clientPort = socket.remotePort;
    socket.on('data', (data) => {
        const msg = data.toString();
        console.log(`[${new Date().toISOString().slice(11, 19)}] <-`
            + ` ${clientIP.replace(/^::ffff:/, '')}:${clientPort}\n`
            + msg);

        const requestLine = msg.split('\r\n')[0] || '';
        const [method, path, protocol] = requestLine.split(' ');

        const response = [
            'HTTP/1.1 504 Gateway Timeout',
            'Content-Type: text/html; charset=utf-8',
            `Content-Length: ${content.length}`,
            `Date: ${new Date().toUTCString()}`,
            'Server: xping',
            'Connection: close',
            '',
            content
        ].join('\r\n');

        setTimeout(() => {
            socket.write(response);
            socket.end();
        }, Math.random() * 5000 + 5000)

    });
    socket.on('error', (err) => {
        console.error('socket: ' + err);
    })
});

server.on('error', (err) => {
    console.error('server: ' + err);
})

export default (port = 8504) => {
    server.listen(port, () => {
        console.log('listen [::]:' + port);
    });
}

