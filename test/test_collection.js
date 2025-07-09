// test/collection.test.js
import test from 'ava';
import { Counter, RotatingArray, LinkedList } from '../lib/collection.js';

// 测试 Counter 类
test('Counter: constructor initializes empty', t => {
    const c = new Counter();
    t.is(c.get('any'), 0);
});

test('Counter: add new key', t => {
    const c = new Counter();
    t.is(c.add('key1'), 1);
    t.is(c.get('key1'), 1);
});

test('Counter: add existing key', t => {
    const c = new Counter();
    c.add('key1', 2);
    t.is(c.add('key1', 3), 5);
    t.is(c.get('key1'), 5);
});

test('Counter: add with default key (null)', t => {
    const c = new Counter();
    t.is(c.add(), 1);
    t.is(c.get(null), 1);
});

test('Counter: inc increments value', t => {
    const c = new Counter();
    c.inc('key1');
    t.is(c.get('key1'), 1);
    c.inc('key1');
    t.is(c.get('key1'), 2);
});

test('Counter: set overrides value', t => {
    const c = new Counter();
    c.set('key1', 5);
    t.is(c.get('key1'), 5);
    c.set('key1', 10);
    t.is(c.get('key1'), 10);
});

test('Counter: has checks key existence', t => {
    const c = new Counter();
    t.false(c.has('key1'));
    c.add('key1');
    t.true(c.has('key1'));
});

test('Counter: delete removes key', t => {
    const c = new Counter();
    c.add('key1');
    t.true(c.delete('key1'));
    t.false(c.has('key1'));
    t.is(c.get('key1'), 0);
});

test('Counter: clear resets counter', t => {
    const c = new Counter();
    c.add('key1');
    c.add('key2');
    c.clear();
    t.is(c.get('key1'), 0);
    t.is(c.get('key2'), 0);
    t.is(c.data.size, 0);
});

// 测试 RotatingArray 类
test('RotatingArray: constructor initializes correctly', t => {
    const arr = new RotatingArray(3, null);
    t.is(arr.length, 3);
    t.is(arr[0], null);
    t.is(arr[1], null);
    t.is(arr[2], null);
});

test('RotatingArray: get/set with positive indices', t => {
    const arr = new RotatingArray(3, 0);
    arr.set(0, 1);
    t.is(arr.get(0), 1);
    arr[1] = 2; // Proxy setter
    t.is(arr[1], 2); // Proxy getter
});

test('RotatingArray: get/set with negative indices', t => {
    const arr = new RotatingArray(3, 0);
    arr[0] = 1;
    arr[1] = 2;
    arr[2] = 3;
    t.is(arr.get(-1), 3); // last element
    t.is(arr.get(-2), 2); // second last
    t.is(arr[-3], 1); // Proxy handles negative
});

test('RotatingArray: push rotates buffer', t => {
    const arr = new RotatingArray(3, 0);
    // Initial: [0,0,0], cur=0
    arr.push(1); // Set index0=1, cur=(0+1)%3=1
    t.is(arr[0], 0); // (1+0+3)%3=1 → data[1]=0
    t.is(arr[1], 0); // (1+1+3)%3=2 → data[2]=0
    t.is(arr[2], 1); // (1+2+3)%3=0 → data[0]=1

    arr.push(2); // Set index0=2, cur=(1+1)%3=2
    t.is(arr[0], 0); // (2+0+3)%3=2 → data[2]=0
    t.is(arr[1], 1); // (2+1+3)%3=0 → data[0]=1
    t.is(arr[2], 2); // (2+2+3)%3=1 → data[1]=2

    arr.push(3); // Set index0=3, cur=(2+1)%3=0
    t.is(arr[0], 1); // (0+0+3)%3=0 → data[0]=1
    t.is(arr[1], 2); // (0+1+3)%3=1 → data[1]=2
    t.is(arr[2], 3); // (0+2+3)%3=2 → data[2]=3
});

test('RotatingArray: iteration with Symbol.iterator', t => {
    const arr = new RotatingArray(3, 0);
    arr.push(1);
    arr.push(2);
    arr.push(3);
    t.deepEqual([...arr], [1, 2, 3]);

    arr.push(4);
    t.deepEqual([...arr], [2, 3, 4]);
});

test('RotatingArray: head returns first n elements', t => {
    const arr = new RotatingArray(3, 0);
    arr.push(1);
    arr.push(2);
    arr.push(3);
    t.deepEqual(arr.head(2), [1, 2]);
    arr.push(4);
    t.deepEqual(arr.head(2), [2, 3]);
});

test('RotatingArray: tail returns last n elements', t => {
    const arr = new RotatingArray(3, 0);
    arr.push(1);
    arr.push(2);
    arr.push(3);
    t.deepEqual(arr.tail(2), [2, 3]);
    arr.push(4);
    t.deepEqual(arr.tail(2), [3, 4]);
});

test('RotatingArray: handles length 0 correctly', t => {
    const arr = new RotatingArray(0, null);
    // 应安全处理无效操作
    t.notThrows(() => arr.push(1));
    t.is(arr.get(0), 1);
    t.deepEqual([...arr], []);
});

test('RotatingArray: non-numeric indices', t => {
    const arr = new RotatingArray(3, 0);
    arr.foo = 'bar'; // 非数字属性
    t.is(arr.foo, 'bar');
    t.is(arr.get('foo'), undefined);
});

test('LinkedList: append and iteration', t => {
    const list = new LinkedList();
    list.append(1);
    list.append(2);
    list.append(3);

    t.is(list.length, 3);
    t.is(list.head.value, 1);
    t.is(list.tail.value, 3);

    const arr = [...list];
    t.deepEqual(arr, [1, 2, 3]);
});

test('LinkedList: prepend', t => {
    const list = new LinkedList();
    list.prepend(1);
    list.prepend(2);
    list.prepend(3);

    t.is(list.length, 3);
    t.is(list.head.value, 3);
    t.is(list.tail.value, 1);

    const arr = [...list];
    t.deepEqual(arr, [3, 2, 1]);
});

test('LinkedList: insert after node', t => {
    const list = new LinkedList();
    const n1 = list.append('a');
    const n2 = list.append('b');
    list.insert('x', n1, true); // after n1

    t.is(list.length, 3);
    t.deepEqual([...list], ['a', 'x', 'b']);
    t.is(list.tail.value, 'b');
});

test('LinkedList: insert before node', t => {
    const list = new LinkedList();
    const n1 = list.append('a');
    const n2 = list.append('b');
    list.insert('x', n2, false); // before n2

    t.is(list.length, 3);
    t.deepEqual([...list], ['a', 'x', 'b']);
    t.is(list.tail.value, 'b');
});

test('LinkedList: getNode positive and negative', t => {
    const list = new LinkedList();
    list.append('a');
    list.append('b');
    list.append('c');
    t.is(list.getNode(0).value, 'a');
    t.is(list.getNode(1).value, 'b');
    t.is(list.getNode(2).value, 'c');
    t.is(list.getNode(-1).value, 'c');
    t.is(list.getNode(-2).value, 'b');
    t.is(list.getNode(-3).value, 'a');
    t.is(list.getNode(3), null);
    t.is(list.getNode(-4), null);
});

test('LinkedList: remove node', t => {
    const list = new LinkedList();
    const n1 = list.append('a');
    const n2 = list.append('b');
    const n3 = list.append('c');
    t.is(list.length, 3);

    t.is(list.remove(n2), 'b');
    t.is(list.length, 2);
    t.deepEqual([...list], ['a', 'c']);

    t.is(list.remove(n1), 'a');
    t.is(list.length, 1);
    t.deepEqual([...list], ['c']);

    t.is(list.remove(n3), 'c');
    t.is(list.length, 0);
    t.deepEqual([...list], []);
    t.is(list.head, null);
    t.is(list.tail, null);
});

test('LinkedList: remove throws on invalid node', t => {
    const list = new LinkedList();
    list.append('a');
    const error = t.throws(() => list.remove({}), { instanceOf: TypeError });
    t.regex(error.message, /not is a LinkedList\.Node/);
});

test('LinkedList: forLimit positive', t => {
    const list = new LinkedList();
    [1, 2, 3, 4, 5].forEach(v => list.append(v));
    const res = [];
    list.forLimit(3, v => res.push(v));
    t.deepEqual(res, [1, 2, 3]);
});

test('LinkedList: forLimit negative', t => {
    const list = new LinkedList();
    [1, 2, 3, 4, 5].forEach(v => list.append(v));
    const res = [];
    list.forLimit(-2, v => res.push(v));
    t.deepEqual(res, [4, 5]);
});

test('LinkedList: forLimit array [head, tail]', t => {
    const list = new LinkedList();
    [1, 2, 3, 4, 5, 6].forEach(v => list.append(v));
    let res = [];
    list.forLimit([2, -2], v => res.push(v));
    t.deepEqual(res, [1, 2, 5, 6]);

    res = [];
    list.forLimit([5, -5], v => res.push(v));
    t.deepEqual(res, [1, 2, 3, 4, 5, 6]);
    res = [];
    list.forLimit([6, -2], v => res.push(v));
    t.deepEqual(res, [1, 2, 3, 4, 5, 6]);
    res = [];
    list.forLimit([6, -6], v => res.push(v));
    t.deepEqual(res, [1, 2, 3, 4, 5, 6]);
    res = [];
    list.forLimit([8, -3], v => res.push(v));
    t.deepEqual(res, [1, 2, 3, 4, 5, 6]);
    res = [];
    list.forLimit([2, -8], v => res.push(v));
    t.deepEqual(res, [1, 2, 3, 4, 5, 6]);
    res = [];
});

test('LinkedList: toString', t => {
    const list = new LinkedList();
    [1, 2, 3].forEach(v => list.append(v));
    t.is(list.toString(), '[ 1 <-> 2 <-> 3 ]');
    const empty = new LinkedList();
    t.is(empty.toString(), '[]');
    const longlist = new LinkedList();
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(v => longlist.append(v));
    t.is(longlist.toString(), '[ 1 <-> 2 ... 8 <-> 9 <-> 10 ]');
    t.is(longlist.toString(6), '[ 1 <-> 2 <-> 3 ... 8 <-> 9 <-> 10 ]');

});