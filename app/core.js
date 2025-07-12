/** 
 * @file app/core.js
 * @description xping core  
 */

import { EventEmitter } from 'events'
import fs from 'fs/promises';
import got from 'got';
import UserAgent from 'user-agents';
import { RotatingArray, LinkedList } from '../lib/collection.js'
import SBL from '../lib/sbl.js'
import { rand, seq } from '../lib/generator.js';
import helper from '../lib/helper.js';
import TrafficStatsAgent from '../lib/traffic-stats-agent.js'
import { loadFromString, toHeaderString } from '../lib/cookies.js';


export default class Core {
    static defaultConfig = {
        concurrent: 16,
        delay: [1, 5],
        unit: [1, 1],
        header: [],
        cookies: '', 
        body: '', // TODO
        form: '', // TODO
        method: 'GET',
        referer: 'root',
        quality: [], // TODO
        proxy: '', 
        silent: false,
        debug: false,
        http2: false, // TODO
        tag: '{...}',
        maxSize: 65536,
        shutdown: 0  // TODO
    }

    static defaultHeaders = {
        "upgrade-insecure-requests": "1",
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-dest': 'document',
        'sec-fetch-user': '?1',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'user-agent': 'curl/7.8.0',
    }


    /**
     * 
     * @param {typeof defaultConfig} config 
     * @param {string[]} target
     */
    constructor(config, target = 'http://httpbin.org/delay/10?id={1:}') {
        /** @type {typeof Core.defaultConfig} */
        this.config = { ...Core.defaultConfig, ...config, }
        this.target = target
        this.eventEmitter = new EventEmitter()
        this.sbl = new SBL()
        this.alive = new LinkedList()
        this.running = false
        this.nextDelay = rand(this.config.delay[0] * 1000, this.config.delay[1] * 1000,)
        this.nextUnit = rand(...this.config.unit)
        this.nextID = seq(1)
        this.agent = TrafficStatsAgent({ keepAlive: true }, this.config.proxy)
    }


    async submit() {
        let { url, header, cookie, ip } = this.sbl.execute()
        let ua = new UserAgent().toString()
        let headers = {
            ...Core.defaultHeaders,
            ...helper.buildClientHints(ua),
            'user-agent': ua,
            ...helper.headersStringToObject(header),
        }

        switch (this.config.referer) {
            case 'root':
                headers['referer'] = new URL('/', url).toString()
                break;
            case 'same':
                headers['referer'] = url
                break;
            case 'none':
                break;
            default:
                headers['referer'] = this.config.referer
        }

        // randomized X-Forwarded-For and X-Real-IP address
        if (ip) {
            headers['X-Forwarded-For'] = ip
            headers['X-Real-IP'] = ip
        }

        if (cookie){
            headers['cookie'] = toHeaderString(loadFromString(cookie))
        }

        let body = ''
        let bodySummary = ''
        // let sym = Symbol(url)
        let id = this.nextID().value
        let reqInfo = {
            id,
            url,
            headers,
            bodySummary,
        }
    

        const node = this.alive.append(id)
        this.emit('submit', reqInfo)
        const controller = new AbortController();
        try {
            const req = got(url, {
                method: 'GET',
                headers,
                cookieJar: undefined,
                body: undefined,
                isStream: true,
                responseType: 'buffer',
                throwHttpErrors: false,
                signal: controller.signal, // 绑定取消信号,
                agent: this.agent,
            })

            let maxSize = this.config.maxSize || 65536
            let buff = Buffer.alloc(maxSize)
            let bi = 0
            req.on('data', data => {
                const rem = maxSize - bi;  // 计算剩余空间
                if (data.length <= rem) {
                    // 当前数据块可完全放入缓冲区
                    buff.set(data, bi);
                    bi += data.length;
                } else {
                    // 只取能填满缓冲区的部分
                    buff.set(data.subarray(0, rem), bi);
                    bi = maxSize;  // 标记缓冲区已满
                }

                if (bi >= maxSize) {
                    controller.abort();
                    req.destroy()
                    req.emit('end')
                }
            })

            req.on('end', () => {
                if (bi < maxSize) {
                    buff = buff.subarray(0, bi);
                }
                this.alive.remove(node)
                // fix got lib `req.timings.phases.total` is undefined
                let phases = req.timings.phases.total ||
                    (Date.now() - req.timings.start)

                let response = req.response
                let result = {
                    id,
                    url: req.requestUrl,
                    code: response.statusCode,
                    headers: response.headers,
                    phases,
                    bodySummary: buff,
                }

                // this.history.push(result)
                this.emit('result', result)
            })

            req.on('error', error => {
                if (error.name !== 'AbortError') {
                    this.alive.remove(node)
                    this.emit('error', error, reqInfo)
                }
            })
        } catch (error) {
            this.alive.remove(node)
            this.emit('error', error, reqInfo)
        }
        // this.emit('res', u)
    }

    async init() {
        try {
            this.sbl.load(this.target, 'url')
            this.sbl.load('{1-254}.{1-254}.{1-254}.{1-254}', 'ip')
            this.sbl.load(this.config.header.join('\n'), 'header')
            if (this.config.cookies) {
                // TODO: if extname == 'json'
                let data = await fs.readFile(this.config.cookies, 'utf-8')
                this.sbl.load(data, 'cookie')
            } else {
                this.sbl.load('', 'cookie')
            }
            // this.interpreter.load('', 'form')
            // this.interpreter.load('', 'body')
            this.sbl.ready()
            this.emit('ready')
        } catch (e) {
            console.log(e);
            console.log('xping: init fial');
            process.exit(1)
        }
    }

    async start() {
        if (this.running) return;
        this.running = true
        this.emit('start')
        while (this.running) {
            await this.tick()
        }
    }


    async tick() {
        let currentUnit = this.nextUnit().value
        for (let i = 0; i < currentUnit && this.alive.length < this.config.concurrent; i++) {
            this.submit()
        }

        this.emit('tick')
        await helper.sleep(this.nextDelay().value)
    }

    on(event, listener) {
        this.eventEmitter.on(event, listener);
        return this;
    }

    once(event, listener) {
        this.eventEmitter.once(event, listener)
        return this;
    }

    off(event, listener) {
        this.eventEmitter.off(event, listener)
        return this;
    }

    emit(event, ...args) {
        this.eventEmitter.emit(event, ...args);
        return this;
    }
}

