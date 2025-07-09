/** 
 * @file lib/sbl.builtin.js
 * @description SBL builtin syntaxs
 */

import helper from "./helper.js";
import * as generator from "./generator.js";

export const charTable = {
    t: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    u: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    l: 'abcdefghijklmnopqrstuvwxyz',
    w: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    h: '0123456789abcdef',
    H: '0123456789ABCDEF',
    d: '0123456789'
};

export function toFullId(scope, id) {
    if (id.includes(':')) {
        return id;
    }
    return `${scope}:${id}`;
}

export const processor = generator

export const syntaxs = [
    {
        name: 'reference',
        match: /^\#([\w\:]+)/,
        // match: /\#(\w*):?(\w+)/,
        handler: (_, id) => ['ref', toFullId(_.scope, id)],
    },
    {
        name: 'time',
        match: /^([tm])s$/,
        handler: (_, t) => ['time', t == 't']
    },
    {
        name: 'choose_file',
        match: /^(c)hoose:(.*)/i,
        handler: (_, c, file) => ['chooseFromFile', file, c == 'C'],
    },
    {
        name: 'choose',
        match: /^[^\|]+\|.*/,
        handler: (_) => ['choose', _.match[0].split('|'), false],
    },
    {
        name: 'choose_orderly',
        match: /^[^,]+,.*/,
        handler: (_) => ['choose', _.match[0].split(','), true],
    },
    {
        name: 'rand_text',
        match: /^([tulwhHd])(\d+)-(\d+)/,
        handler: (_, cat, minLength, maxLength) => [
            'randText',
            charTable[cat],
            helper.tryint(minLength),
            helper.tryint(maxLength)
        ]
    },
    {
        name: 'power_text',
        match: /^([tulwhHd])(\d+):(\d+)?/,
        handler: (_, cat, minLength, maxLength) => [
            'power',
            charTable[cat],
            helper.tryint(minLength),
            helper.tryint(maxLength||minLength),
            ''
        ]
    },
    {
        name: 'sequence',
        match: /^([\d]*):([\d]*)(?::([\-\+\d]*))?/,
        handler: (_, start, end, step) => {
            [start, end, step] = [start, end, step].map(v => helper.tryint(v, 0));
            step = step || 1;
            end = end || Number.MAX_SAFE_INTEGER;
            return ['seq', start, end, step]
        }
    },
    {
        name: 'random',
        match: /^([\d]*)-([\d]*)-?([\-\+\d]*)?/,
        handler: (_, min, max, countdown) => {
            [min, max, countdown] = [min, max, countdown].map(v => helper.tryint(v, 0));
            countdown = countdown || (max + 1 - min);
            max = max || Number.MAX_SAFE_INTEGER;
            return ['rand', min, max, countdown]
        }
    },

    // {
    //     name: 'echo',
    //     match: /(.+)/,
    //     handler: (_, value) => ['echo', value]
    // }
]

export const attrMacros = [
    {
        name: 'set pow scope:id(ref)',
        match: /\^([\w\:]+)/,
        // match: /\^(\d+)/,
        handler: (_, id) => ['pow', toFullId(_.scope, id)]
    },
    {
        name: 'set id',
        match: /\#(\w+)/,
        handler: (_, id) => ['id', toFullId(_.scope, id)]
    },
    {
        name: 'base',
        match: /([^\=]+)(?:\=(.*))?/,
        handler: (_, name, value) => [name, value || true]
    }
];

export const encoder = {
    str: s => String(s),
    url: s => encodeURI(s),
    urlc: s => encodeURIComponent(s)
}

export const formatter = {

}

export const executor = processor
export default {
    processor,
    syntaxs,
    attrMacros,
    encoder,
    formatter,
}


