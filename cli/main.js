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
    xping [options] [target]

  Options
    -c, --concurrent <num>     Set concurrent workers (default: 16)
    -d, --delay <min[-max]>    Delay between cycle in seconds (default: 1-5)
    -u, --unit <min[-max]>     Requests per cycle (default: 1)
    -H, --header <k:v>         Add custom request header (repeatable)
    -C, --cookies <file>       Load cookies.txt or cookies.json  from file
    -b, --body <file>          File to use as request raw data
    -f, --form <file>          File to use as request data
    -m, --method <name>        HTTP method to use 
    -r, --referer <rule>       Set referer "root", "same", "none" or any url
    -p, --proxy <url>          Proxy server to use (http/socks5)
    -s, --silent               Suppress output logging
        --debug                Output debug log
        --http2                Use HTTP/2 protocol
        --tag                  Config tag brackets
    -h, --help                 Show this help
    -v, --version              Show version

  Arguments
    1   target

  Examples
    xping -c 16 \\
      'https://example.com/?id={0:}&user={t5:32}&t={ms}'
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
            default: []
        },
        cookies: {
            type: 'string',
            shortFlag: 'C',
            default: '',
        },
        body: {
            type: 'string',
            shortFlag: 'b',
            default: '',

        },
        form: {
            type: 'string',
            shortFlag: 'f',
            default: '',

        },
        method: {
            type: 'string',
            shortFlag: 'm',
            default: 'GET',
        },
        proxy: {
            type: 'string',
            shortFlag: 'p',
            default: '',
        },
        silent: {
            type: 'boolean',
            shortFlag: 's',
            default: false
        },
        recover: {
            type: 'string',
            shortFlag: 'r',
            default: '',
        },
        output: {
            type: 'string',
            shortFlag: 'o',
            default: '',
        },
        outputStats: {
            type: 'string',
            default: '',
        },
        outputLog: {
            type: 'string',
            default: '',
        },
        http2: {
            type: 'boolean',
            default: false
        },
        tag: {
            type: 'string',
            default: App.defaultConfig.tag
        },
        help: {
            type: 'boolean',
            shortFlag: 'h',
            default: false
        },
        version: {
            type: 'boolean',
            shortFlag: 'v',
            default: false
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
    case 'tool':
        console.log('TODO ...');
        break;
    default:
        await run(config, target);
}
