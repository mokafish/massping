// test/test_helper.js
import test from 'ava';
import {
    tryint,
    tryfloat,
    shlexSplit,
    topologicalSort,
    trimFalsy
} from '../lib/helper.js';

// ===================== tryint/tryfloat 测试 =====================
test('tryint: valid integer string', (t) => {
    t.is(tryint('123'), 123);
});

test('tryint: invalid string with fallback', (t) => {
    t.is(tryint('abc', 999), 999);
});

test('tryint: invalid string without fallback', (t) => {
    t.is(tryint('abc'), 'abc');
});

test('tryfloat: valid float string', (t) => {
    t.is(tryfloat('3.14'), 3.14);
});

test('tryfloat: invalid float with fallback', (t) => {
    t.is(tryfloat('xyz', 0.5), 0.5);
});

// ===================== shlexSplit 测试 =====================
test('shlexSplit: basic words', (t) => {
    t.deepEqual(shlexSplit('a b c'), ['a', 'b', 'c']);
});

test('shlexSplit: double quotes', (t) => {
    t.deepEqual(shlexSplit('a "b c" d'), ['a', 'b c', 'd']);
});

test('shlexSplit: single quotes', (t) => {
    t.deepEqual(shlexSplit("a 'b c' d"), ['a', 'b c', 'd']);
});

test('shlexSplit: escaped characters', (t) => {
    t.deepEqual(shlexSplit('a\\ b c'), ['a b', 'c']);
});

test('shlexSplit: mixed quotes', (t) => {
    t.deepEqual(shlexSplit(`'a "b"' "c 'd'"`), ['a "b"', `c 'd'`]);
});

test('shlexSplit: trailing escape', (t) => {
    t.deepEqual(shlexSplit('a\\'), ['a\\']);
});

// ===================== topologicalSort 测试 =====================
test('topologicalSort: valid dependency graph', t => {
    const items = [
        { id: 'Apple', direction: null },
        { id: 'Banana', direction: 'Elderberry' },
        { id: 'Cherry', direction: 'Banana' },
        { id: 'Dragon fruit', direction: 'Banana' },
        { id: 'Elderberry', direction: null },
    ]

    const expected = [
        { id: 'Apple', direction: null, },
        { id: 'Elderberry', direction: null, },
        { id: 'Banana', direction: 'Elderberry', },
        { id: 'Cherry', direction: 'Banana', },
        { id: 'Dragon fruit', direction: 'Banana', },
    ]

    const sorted = topologicalSort(items);

    // t.log(sorted);
    t.deepEqual(sorted, expected, 'topologicalSort should return items in correct order');
});

test('topologicalSort: valid dependency graph #2', (t) => {
    const items = [
        { id: 'A', direction: 'B' },
        { id: 'B', direction: 'C' },
        { id: 'C', direction: null },
        { id: 'D', direction: 'A' }
    ];

    const sorted = topologicalSort(items);
    const ids = sorted.map(item => item.id);
    t.deepEqual(ids, ['C', 'B', 'A', 'D']);
});

test('topologicalSort: circular dependency', (t) => {
    const items = [
        { id: 'A', direction: 'B' },
        { id: 'B', direction: 'A' }
    ];

    const error = t.throws(() => topologicalSort(items));
    t.is(error.code, 'CYCLE_DETECTED');
});

test('topologicalSort: missing dependency', (t) => {
    const items = [
        { id: 'A', direction: 'X' }
    ];

    const error = t.throws(() => topologicalSort(items));
    t.is(error.code, 'DIRECTION_NOT_FOUND');
});

// ===================== trimFalsy 测试 =====================
test('trimFalsy: trim both ends', (t) => {
    const arr = [null, 0, 'a', 'b', false, '', 'c', undefined, NaN];
    t.deepEqual(trimFalsy(arr), ['a', 'b', false, '', 'c']);
});

test('trimFalsy: all falsy', (t) => {
    t.deepEqual(trimFalsy([null, 0, false, '']), []);
});

test('trimFalsy: no trimming needed', (t) => {
    t.deepEqual(trimFalsy([1, 'a', true]), [1, 'a', true]);
});

test('trimFalsy: preserve inner falsy', (t) => {
    const arr = ['a', null, 'b', 0, 'c'];
    t.deepEqual(trimFalsy(arr), ['a', null, 'b', 0, 'c']);
});

// ---

test('trimFalsy: empty array returns empty array', t => {
    t.deepEqual(trimFalsy([]), []);
});

test('trimFalsy: all falsy values return empty array', t => {
    t.deepEqual(trimFalsy([null, undefined, 0, false, '']), []);
});

test('trimFalsy: trims leading falsy values', t => {
    t.deepEqual(trimFalsy([false, 0, 'valid', true]), ['valid', true]);
});

test('trimFalsy: trims trailing falsy values', t => {
    t.deepEqual(trimFalsy(['valid', true, null, undefined]), ['valid', true]);
});

test('trimFalsy: trims both ends with mixed values', t => {
    t.deepEqual(
        trimFalsy([undefined, 0, 'start', [], 'end', false, null]),
        ['start', [], 'end']
    );
});

test('trimFalsy: keeps middle falsy values', t => {
    t.deepEqual(
        trimFalsy([true, null, 0, 'middle', undefined, 'end']),
        [true, null, 0, 'middle', undefined, 'end'] // 注意首元素是真值不会被trim
    );
});

test('trimFalsy: handles single truthy element', t => {
    t.deepEqual(trimFalsy([true]), [true]);
    t.deepEqual(trimFalsy(['single']), ['single']);
});

test('trimFalsy: handles single falsy element', t => {
    t.deepEqual(trimFalsy([null]), []);
    t.deepEqual(trimFalsy([0]), []);
});

test('trimFalsy: preserves middle falsy types', t => {
    t.deepEqual(
        trimFalsy([false, NaN, '', 0, 'valid', null, undefined]),
        ['valid'] // 开头假值被trim，中间假值保留
    );
});

test('trimFalsy: handles whitespace truthy values', t => {
    t.deepEqual(
        trimFalsy([undefined, ' ', '\t', 'text']),
        [' ', '\t', 'text'] // 空格和制表符是真值
    );
});

test('trimFalsy: handles object and array values', t => {
    const obj = { key: 'value' };
    const arr = [1, 2, 3];
    t.deepEqual(
        trimFalsy([null, obj, arr, undefined]),
        [obj, arr]
    );
});

test('trimFalsy: complex mixed scenario', t => {
    t.deepEqual(
        trimFalsy([0, false, 'start', NaN, {}, 0, 'end', '']),
        ['start', NaN, {}, 0, 'end']
    );
});
