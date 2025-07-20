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
    -l, --log-level            Set log level (default: notice)
        --ip                   True ip of target host (repeatable)
        --http2                Use HTTP/2 protocol
        --tag  <style>         Config tag brackets style (default: {...})
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
    * Online document: https://github.com/mokafish/massping#readme
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
        bodyBinary: {
            type: 'string',
            shortFlag: 'B',
            default: App.defaultConfig.bodyBinary || ''
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
        logLevel: {
            type: 'string',
            shortFlag: 'l',
            default: App.defaultConfig.logLevel || 'info'
        },
        ip: {
            type: 'string',
            isMultiple: true,
            default: App.defaultConfig.ip || []
        },
        http2: {
            type: 'boolean',
            default: App.defaultConfig.http2 || false
        },
        tag: {
            type: 'string',
            default: App.defaultConfig.tag || '{...}'
        },
        maxSize: {
            type: 'number',
            default: App.defaultConfig.maxSize || 65536
        },
        shutdown: {
            type: 'number',
            default: App.defaultConfig.shutdown || 0
        },
        helpSbl: {
            type: 'boolean',
            default: false
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
        },
    }
})

/** @type {typeof App.defaultConfig} */
const config = cli.flags;
const target = cli.input[0];
config.delay = parseRangeExpr(cli.flags.delay);
config.unit = parseRangeExpr(cli.flags.unit);

if (config.method === 'GET' && (config.form || config.body || config.bodyBinary)) {
    config.method = 'POST'
}

if (cli.flags.helpSbl) {
    console.log(`
Structured Build Language (SBL) is a domain-specific language used to generate data. 
Similar to template engines, uses interpolation tags to render data into text. 
What sets it apart is that its tag are not predefined variables, 
but rather a syntax governed by specific generation rules.

**Simple Demo**
* SBL source code:  \`/{zh,en}/{1:5}?i={100-200}\`
* 1st execution: \`/zh/1?i=123\`
* 2nd execution: \`/en/2?i=163\`
* 3rd execution: \`/zh/3?i=155\`
* 4th execution: \`/en/4?i=178\`
* 5th execution: \`/zh/5?i=200\`
* 6th execution: \`/en/1?i=100\`
* 100th execution: \`/en/5?i=111\`

### Syntaxs

>All interval representations are closed intervals.
>There can be no spaces in syntax.

- Random \`min-max\`
- Sequence \`start:end:step\`
- Random text \`<type>minLength-maxLength\`
    - type \`t\`: from A-Z, a-z and 0-9 chars
    - type \`u\`: from A-Z chars
    - type \`l\`: from a-z chars
    - type \`w\`: from A-Z and a-z chars
    - type \`h\`: from 0-9 and a-f chars
    - type \`H\`: from 0-9 and a-H chars
    - type \`d\`: from 0-9 chars
- Cartesian power text \`<type>startLength:endLength\` 
    - type be the same as the above
- Choose
    - random mode: \`word1|word2|...\`
    - orderly mode: \`word1,word2,...\`
    - from file \`choose:<filename>\`, file content one word per line
        - 'choose' lowercase is random mode, and uppercase is orderly mode.
- time stamp of seconds \`ts\`
- time stamp of milliseconds \`ms\`
- reference \`#id\``);
    process.exit(0)
}


switch (target) {
    case undefined:
        console.log(`${cli.pkg.name}/${cli.pkg.version}`);
        cli.showHelp()
        break;
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
    case 'mkform':
        import('./mkform.js').then(x => {
            x.mkform(cli.input[1], cli.input[2])
        })
        break;
    case 'tool':
        console.log('TODO ...');
        break;
    default:
        run(config, target);
}
