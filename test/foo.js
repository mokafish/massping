import test from 'ava';

test('foo', t => {
    t.like({ a: 1, b: 2, c: 1 }, { a: 1, b: 2 });
});
