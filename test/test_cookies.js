import test from 'ava';
import { loadFromString, toHeaderString } from '../lib/cookies.js';

// 测试 loadFromString 函数
test('loadFromString - 空输入', t => {
  t.deepEqual(loadFromString(''), []);
});

test('loadFromString - 忽略注释和空行', t => {
  const data = `
    # 注释行
    example.com\tTRUE\t/\tFALSE\t0\tname\tvalue
    
    # 另一条注释
    `;
  t.is(loadFromString(data).length, 1);
});

test('loadFromString - 字段不足时跳过', t => {
  const data = 'example.com\tTRUE\t/\tFALSE';
  t.deepEqual(loadFromString(data), []);
});

test('loadFromString - 正确解析单行', t => {
  const data = 'example.com\tTRUE\t/\tFALSE\t1699999999\tsession\tabc123';
  const result = loadFromString(data);
  
  t.is(result.length, 1);
  t.deepEqual(result[0], {
    domain: 'example.com',
    flag: true,
    path: '/',
    secure: false,
    expiration: 1699999999,
    name: 'session',
    value: 'abc123'
  });
});

test('loadFromString - 解析多行混合数据', t => {
  const data = `
    # 第一行注释
    .example.com\tTRUE\t/\tTRUE\t1700000000\tsecureCookie\tsecret
    invalid-line
    sub.example.com\tFALSE\t/path\tFALSE\t0\ttest\tvalue
  `;
  
  const result = loadFromString(data);
  t.is(result.length, 2);
  t.is(result[0].name, 'secureCookie');
  t.is(result[1].name, 'test');
});

// 测试 toHeaderString 函数
test('toHeaderString - 空数组返回空字符串', t => {
  t.is(toHeaderString([]), '');
});

test('toHeaderString - 过滤过期cookie', t => {
  const cookies = [
    { domain: 'a.com', flag: true, path: '/', secure: false, expiration: 100, name: 'expired', value: '1' },
    { domain: 'b.com', flag: true, path: '/', secure: false, expiration: 9999999999, name: 'valid', value: '2' }
  ];
  
  t.is(toHeaderString(cookies, null, 1000), 'valid=2');
});

test('toHeaderString - URL域名匹配', t => {
  const cookies = [
    { domain: '.example.com', flag: true, path: '/', secure: false, expiration: 0, name: 'root', value: '1' },
    { domain: 'sub.example.com', flag: true, path: '/', secure: false, expiration: 0, name: 'sub', value: '2' },
    { domain: 'other.com', flag: true, path: '/', secure: false, expiration: 0, name: 'other', value: '3' }
  ];
  
  const header = toHeaderString(cookies, 'https://sub.example.com/page');
  t.is(header, 'root=1; sub=2');
});

test('toHeaderString - 路径匹配', t => {
  const cookies = [
    { domain: 'a.com', flag: true, path: '/', secure: false, expiration: 0, name: 'root', value: '1' },
    { domain: 'a.com', flag: true, path: '/api', secure: false, expiration: 0, name: 'api', value: '2' },
    { domain: 'a.com', flag: true, path: '/api/v1', secure: false, expiration: 0, name: 'v1', value: '3' }
  ];
  
  const header = toHeaderString(cookies, 'https://a.com/api/v1/data');
  t.is(header, 'v1=3; api=2; root=1');
});

test('toHeaderString - 安全协议检查', t => {
  const cookies = [
    { domain: 'a.com', flag: true, path: '/', secure: true, expiration: 0, name: 'secure', value: '1' },
    { domain: 'a.com', flag: true, path: '/', secure: false, expiration: 0, name: 'insecure', value: '2' }
  ];
  
  // HTTPS 请求应包含所有 cookie
  let header = toHeaderString(cookies, 'https://a.com');
  t.is(header, 'secure=1; insecure=2');
  
  // HTTP 请求只包含非安全 cookie
  header = toHeaderString(cookies, 'http://a.com');
  t.is(header, 'insecure=2');
});

test('toHeaderString - 不额外编码', t => {
  const cookies = [
    { domain: 'a.com', flag: true, path: '/', secure: false, expiration: 0, name: 'user', value: 'john%3Ddoe' }
  ];
  
  t.is(toHeaderString(cookies), 'user=john%3Ddoe');
});

test('toHeaderString - 复杂场景综合测试', t => {
  const cookies = [
    // 匹配的 cookie
    { domain: 'example.com', flag: true, path: '/api', secure: true, expiration: 9999999999, name: 'session', value: 'abc' },
    { domain: '.example.com', flag: true, path: '/', secure: false, expiration: 9999999999, name: 'pref', value: 'dark' },
    // 不匹配的 cookie
    { domain: 'sub.example.com', flag: true, path: '/admin', secure: true, expiration: 9999999999, name: 'admin', value: 'no' },
    { domain: 'example.com', flag: true, path: '/api', secure: true, expiration: 100, name: 'expired', value: 'x' }
  ];
  
  const header = toHeaderString(
    cookies,
    'https://example.com/api/data',
    Date.now() / 1000 + 1000 // 当前时间+1000秒
  );
  
  t.is(header, 'session=abc; pref=dark');
});