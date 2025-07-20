import dns from 'node:dns';
import os from 'node:os';
import net from 'node:net';
import got from 'got';

const options = {
    family: 6,
    hints: dns.ADDRCONFIG | dns.V4MAPPED,
};

function main() {
    myDNSLookup('example.org', options, (err, address, family) =>
        console.log('address: %j family: IPv%s', address, family));
    // address: "2606:2800:21f:cb07:6820:80da:af6b:8b2c" family: IPv6

    // When options.all is true, the result will be an Array.
    options.all = true;
    myDNSLookup('example.org', options, (err, addresses) =>
        console.log('addresses: %j', addresses));

}

const known_hosts = {
    'example.com': '127.0.0.1'
};

function myDNSLookup(host, options, callback) {
    // 标准化参数处理
    if (typeof options === 'function') {
        callback = options;
        options = {};
    } else if (typeof options === 'number') {
        options = { family: options };
    }

    // 设置默认值
    options = {
        family: options.family || 0,
        hints: options.hints || 0,
        all: options.all || false,
        ...options
    };

    // 辅助函数：检查系统是否支持某地址族
    const hasAddressFamily = (family) => {
        const interfaces = os.networkInterfaces();
        const familyName = family === 4 ? 'IPv4' : 'IPv6';

        for (const iface of Object.values(interfaces)) {
            for (const addr of iface) {
                if (addr.family === familyName && !addr.internal) {
                    return true;
                }
            }
        }
        return false;
    };

    // 处理IP地址直接输入的情况
    const directIPFamily = net.isIP(host);
    if (directIPFamily) {
        let address = host;
        let family = directIPFamily;

        // 处理V4MAPPED转换 (IPv4转IPv6映射)
        if (options.family === 6 && family === 4 && (options.hints & dns.V4MAPPED)) {
            address = `::ffff:${address}`;
            family = 6;
        }

        // 检查ADDRCONFIG配置
        if ((options.hints & dns.ADDRCONFIG) && !hasAddressFamily(family)) {
            return handleNotFound(host, options, callback);
        }

        // 返回结果
        return formatResult(address, family, options, callback);
    }

    // 处理已知域名映射
    if (host in known_hosts) {
        const ip = known_hosts[host];
        const family = net.isIP(ip);

        if (family === 0) { // 无效IP
            return callback(new Error(`Invalid IP address: ${ip}`));
        }

        let address = ip;
        let resultFamily = family;

        // 处理V4MAPPED转换
        if (options.family === 6 && family === 4 && (options.hints & dns.V4MAPPED)) {
            address = `::ffff:${ip}`;
            resultFamily = 6;
        }

        // 检查ADDRCONFIG配置
        if ((options.hints & dns.ADDRCONFIG) && !hasAddressFamily(resultFamily)) {
            return handleNotFound(host, options, callback);
        }

        // 返回结果
        if (options.all) {
            callback(null, [{ address, family: resultFamily }]);
        } else {
            callback(null, address, resultFamily);
        }
    } else {
        // 未知域名使用系统DNS解析
        dns.lookup(host, options, callback);
    }
}

// 示例使用
main();