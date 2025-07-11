/** 
 * @file lib/cookies.js
 * @description 
 */


export function loadFromString(data) {
    const cookieJar = [];
    data.split('\n').forEach(line => {
        // 跳过空行和注释
        if (!line.trim() || line.startsWith('#')) return;

        const fields = line.trim().split('\t');
        // 确保有7个字段
        if (fields.length < 7) return;

        cookieJar.push({
            domain: fields[0],
            flag: fields[1] === 'TRUE',
            path: fields[2],
            secure: fields[3] === 'TRUE',
            expiration: parseInt(fields[4], 10),
            name: fields[5],
            value: fields[6]
        });
    });

    return cookieJar;
}

export function toHeaderString(cookieJar, url = null, time = 0) {
    const filteredCookies = [];
    for (const cookie of cookieJar) {
        // 检查过期时间（如果time不为0）
        if (time && cookie.expiration < time) {
            continue;
        }

        if (url) {
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname;
            const pathname = parsedUrl.pathname;
            const protocol = parsedUrl.protocol;
            // 处理域名匹配
            let domain = cookie.domain;
            if (domain.startsWith('.')) {
                domain = domain.substring(1);
            }

            const host = hostname.toLowerCase();
            domain = domain.toLowerCase();

            // 检查域名是否匹配
            if (!host.endsWith(domain)) {
                continue;
            }

            // 检查路径是否匹配
            if (!pathname.startsWith(cookie.path)) {
                continue;
            }

            // 检查安全协议
            if (cookie.secure && protocol !== 'https:') {
                continue;
            }
        }

        filteredCookies.push(cookie);
    }

    // 按路径长度降序排序（路径越长越具体）
    filteredCookies.sort((a, b) => b.path.length - a.path.length);

    // 构建Cookie头字符串
    return filteredCookies
        .map(cookie => `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`)
        .join('; ');
}

// // 辅助函数：检查请求路径是否匹配Cookie路径
// function pathMatches(requestPath, cookiePath) {
//     if (!cookiePath) return false;

//     if (requestPath === cookiePath) {
//         return true;
//     }

//     if (requestPath.startsWith(cookiePath)) {
//         // 检查路径分隔符
//         if (cookiePath.endsWith('/')) {
//             return true;
//         }
//         // 确保是完整路径段
//         if (requestPath[cookiePath.length] === '/') {
//             return true;
//         }
//     }

//     return false;
// }