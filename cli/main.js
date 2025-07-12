#!/usr/bin/env node

/**
 * @file  cli/ping.js
 * @description cli entry process arguments
 */

import fs from 'fs/promises';
import meow from 'meow';
import winston from 'winston'
import App from '../app/app.js'
import run from './run.js'
import { tryint } from '../lib/helper.js';

/**
 * 
 * @param {string} expr 
 * @returns {number[]}
 */
function parseRangeExpr(expr) {
    const parts = expr.split('-');
    if (parts.length === 2) {
        const a = parseFloat(parts[0])
        const b = parseFloat(parts[1])
        return [a, b].sort()
    } else {
        const n = parseFloat(expr)
        return [n, n];
    }
}

const cli = meow(`
  Usage
    massping [options] <target>

  Options
    -c, --concurrent <num>     Set concurrent workers (default: 16)
    -d, --delay <min[-max]>    Delay between cycle in seconds (default: 1-5)
    -u, --unit <min[-max]>     Requests per cycle (default: 1)
    -H, --header <k:v>         Add custom request header (repeatable)
    -C, --cookies <file>       Load cookies.txt or cookies.json  from file
    -b, --body <file>          File to use as request text data
    -B, --body-binary <file>   File to use as request binary data
    -f, --form <file>          File to use as request form data
    -m, --method <name>        HTTP method to use 
    -r, --referer <rule>       Set referer "root", "same", "none" or any url
    -q, --quality <rule>       Add quality test rule (repeatable)
    -p, --proxy <url>          Proxy server to use (http/socks5)
    -s, --silent               Suppress output logging
        --debug                Output debug log
        --http2                Use HTTP/2 protocol
        --tag                  Config tag brackets
        --max-size <num>       Limit response body size (default: 65535)
        --shutdown <num>       Shutdown if quality is below threshold
    -h, --help                 Show this help
        --help-sbl             Show help for SBL
    -v, --version              Show version

  Arguments
    target                     Target url with SBL tag

  Examples
    massping -c 16 \\
      'https://example.com/?id={0:}&user={t5:32}&t={ms}'
  About
    * Online document https://github.com/mokafish/massping#readme
`, {
    importMeta: import.meta,
    flags: {
        concurrent: {
            type: 'number',
            shortFlag: 'c',
            default: App.defaultConfig.concurrent
        },
        delay: {
            type: 'string',
            shortFlag: 'd',
            default: App.defaultConfig.delay.join('-')
        },
        unit: {
            type: 'string',
            shortFlag: 'u',
            default: App.defaultConfig.unit.join('-')
        },
        header: {
            type: 'string',
            shortFlag: 'H',
            isMultiple: true,
            default: App.defaultConfig.header || ''
        },
        cookies: {
            type: 'string',
            shortFlag: 'C',
            default: App.defaultConfig.cookies || ''
        },
        body: {
            type: 'string',
            shortFlag: 'b',
            default: App.defaultConfig.body || ''
        },
        form: {
            type: 'string',
            shortFlag: 'f',
            default: App.defaultConfig.form || ''
        },
        method: {
            type: 'string',
            shortFlag: 'm',
            default: App.defaultConfig.method || ''
        },
        referer: {
            type: 'string',
            shortFlag: 'r',
            default: App.defaultConfig.referer || ''
        },
        quality: {
            type: 'string',
            shortFlag: 'q',
            isMultiple: true,
            default: App.defaultConfig.quality || []
        },
        proxy: {
            type: 'string',
            shortFlag: 'p',
            default: App.defaultConfig.proxy || ''
        },
        silent: {
            type: 'boolean',
            shortFlag: 's',
            default: App.defaultConfig.silent || false
        },
        debug: {
            type: 'boolean',
            default: App.defaultConfig.debug || false
        },
        http2: {
            type: 'boolean',
            default: App.defaultConfig.http2 || false
        },
        tag: {
            type: 'string',
            default: App.defaultConfig.tag || ''
        },
        maxSize: {
            type: 'number',
            default: App.defaultConfig.maxSize || 65536
        },
        shutdown: {
            type: 'number',
            default: App.defaultConfig.shutdown || 0
        }
    }
})

/** @type {typeof App.defaultConfig} */
const config = cli.flags;
const target = cli.input[0];
config.delay = parseRangeExpr(cli.flags.delay);
config.unit = parseRangeExpr(cli.flags.unit);

if (config.method === 'GET' && (config.form || config.body)) {
    config.method = 'POST'
}

switch (target) {
    case 'echo':
        console.log(config);
        console.log(cli.input);
        break;
    case 'server':
        let p = tryint(cli.input[1], 8504)
        import('../app/server.js').then(x => {
            x.default(p)
        })
        break;
    case 'tool':
        console.log('TODO ...');
        break;
    default:
        run(config, target);
}
