/** 
 * @file lib/collection.js
 * @description common collections
 */

/**
 * 基于Map的计数器类，支持键值计数操作
 * @class
 * @example
 * const counter = new Counter();
 * counter.add('apple', 3);
 * counter.inc('apple');
 * console.log(counter.get('apple')); // 输出 4
 */
export class Counter {
    /**
     * 创建计数器实例
     * @constructor
     */
    constructor() {
        /**
         * 存储计数的内部Map
         * @private
         * @type {Map<any, number>}
         */
        this.data = new Map();
    }

    /**
     * 增加指定键的计数值
     * @param {any} [key=null] - 要计数的键（默认null）
     * @param {number} [value=1] - 要增加的值（默认1）
     * @returns {number} 增加后的计数值
     */
    add(key = null, value = 1) {
        if (this.data.has(key)) {
            this.data.set(key, this.data.get(key) + value);
        } else {
            this.data.set(key, value);
        }

        return this.data.get(key);
    }

    /**
     * 将指定键的计数值增加1（add的快捷方法）
     * @param {any} [key=null] - 要计数的键（默认null）
     * @returns {number} 增加后的计数值
     */
    inc(key = null) {
        return this.add(key, 1);
    }

    /**
     * 获取指定键的当前计数值
     * @param {any} key - 要查询的键
     * @returns {number} 计数值（键不存在时返回0）
     */
    get(key) {
        return this.data.get(key) || 0;
    }

    /**
     * 直接设置指定键的计数值
     * @param {any} key - 要设置的键
     * @param {number} value - 要设置的计数值
     */
    set(key, value) {
        this.data.set(key, value);
    }

    /**
     * 检查键是否存在
     * @param {any} key - 要检查的键
     * @returns {boolean} 键是否存在
     */
    has(key) {
        return this.data.has(key);
    }

    /**
     * 删除指定键的计数
     * @param {any} key - 要删除的键
     * @returns {boolean} 是否成功删除
     */
    delete(key) {
        return this.data.delete(key);
    }

    /**
     * 重置计数器，清除所有计数
     */
    clear() {
        this.data.clear();
    }
}

/**
 * 循环数组（环形缓冲区）实现类，支持代理访问和迭代操作
 * @class
 * @example
 * const arr = new RotatingArray(3);
 * arr[0] = 'a'; // 实际存储位置: [0]
 * arr.push('b'); // 存储位置: [1,0] (cur=1)
 * arr.push('c'); // 存储位置: [2,1,0] (cur=2)
 * arr.push('d'); // 覆盖最旧元素: [2(d),1,0] -> cur=0
 * console.log(arr[0]); // 输出 'd' (最新元素)
 */
export class RotatingArray {
    /**
     * 创建循环数组实例
     * @constructor
     * @param {number} [length=0] - 数组固定长度
     * @param {any} [fill=null] - 数组初始化填充值
     * @returns {Proxy} 代理对象支持类数组访问
     */
    constructor(length = 0, fill = null) {
        /**
         * 内部存储数组
         * @private
         * @type {Array}
         */
        this.data = new Array(length).fill(fill);

        /**
         * 数组固定长度
         * @type {number}
         */
        this.length = length;

        /**
         * 当前指针位置（指向下一个写入位置）
         * @private
         * @type {number}
         */
        this.cur = 0;

        return new Proxy(this, {
            get: (target, prop) => {
                if (typeof target[prop] === 'function') {
                    return target[prop].bind(target);
                }

                const index = parseInt(prop, 10);
                if (!isNaN(index)) {
                    return target.get(index);
                }

                return target[prop];
            },
            set: (target, prop, value) => {
                const index = parseInt(prop, 10);
                if (!isNaN(index)) {
                    target.set(prop, value);
                    return true;
                }
                return target[prop] = value;
            }
        });
    }

    /**
     * 计算实际存储索引（处理循环偏移）
     * @private
     * @param {number} index - 逻辑索引
     * @returns {number} 实际存储索引
     */
    rawIndex(index) {
        return (this.cur + index + this.length) % this.length;
    }

    /**
     * 获取指定逻辑索引处的值
     * @param {number} index - 要获取的逻辑索引（0=最新元素）
     * @returns {any} 索引对应的值
     */
    get(index) {
        return this.data[this.rawIndex(index)];
    }

    /**
     * 设置指定逻辑索引处的值
     * @param {number} index - 要设置的逻辑索引
     * @param {any} value - 要设置的值
     */
    set(index, value) {
        this.data[this.rawIndex(index)] = value;
    }

    /**
     * 向数组头部添加新元素（覆盖最旧元素）
     * @param {any} value - 要添加的值
     */
    push(value) {
        this.set(0, value);
        this.cur = (this.cur + 1) % this.data.length;
    }

    /**
     * 实现迭代器协议，支持for...of循环
     * @returns {Iterator} 数组迭代器
     */
    [Symbol.iterator]() {
        let index = 0;
        return {
            next: () => {
                if (index < this.length) {
                    return {
                        value: this.get(index++),
                        done: false
                    };
                }
                return { done: true };
            }
        };
    }

    /**
     * 获取前n个最新元素（按时间顺序从新到旧）
     * @param {number} n - 要获取的元素数量
     * @returns {Array} 包含最新元素的数组
     */
    head(n) {
        if (n <= 0) return [];
        const result = [];
        for (let i = 0; i < n; i++) {
            result.push(this.get(i));
        }
        return result;
    }

    /**
     * 获取后n个最旧元素（按时间顺序从旧到新）
     * @param {number} n - 要获取的元素数量
     * @returns {Array} 包含最旧元素的数组
     */
    tail(n) {
        if (n <= 0) return [];
        const result = [];
        for (let i = this.length - n; i < this.length; i++) {
            result.push(this.get(i));
        }
        return result;
    }
}

export class LinkedList {
    static Node = class Node {
        constructor(value, prev = null, next = null, list) {
            this.value = value;
            this.prev = prev;
            this.next = next;
            this.list = list;
        }
    }

    constructor() {
        this.head = null;
        this.tail = null;
        this.length = 0;
    }

    append(value) {
        const newNode = new LinkedList.Node(value);
        newNode.list = this
        if (!this.head) {
            this.head = newNode;
            this.tail = newNode;
        } else {
            newNode.prev = this.tail;
            this.tail.next = newNode;
            this.tail = newNode;
        }
        this.length++;
        return newNode;
    }

    prepend(value) {
        const newNode = new LinkedList.Node(value);
        newNode.list = this
        if (!this.head) {
            this.head = newNode;
            this.tail = newNode;
        } else {
            newNode.next = this.head;
            this.head.prev = newNode;
            this.head = newNode;
        }
        this.length++;
        return newNode;
    }

    insert(value, node, beNext = true) {
        if (node) {
            if (beNext) {
                // 在参考节点后插入
                const newNode = new LinkedList.Node(value, node, node.next, this);
                if (node.next) node.next.prev = newNode;
                else this.tail = newNode;
                node.next = newNode;
                this.length++;
                return newNode;
            } else {
                // 在参考节点前插入
                const newNode = new LinkedList.Node(value, node.prev, node, this);
                if (node.prev) node.prev.next = newNode;
                else this.head = newNode;
                node.prev = newNode;
                this.length++;
                return newNode;
            }
        }

        return this.append(value)
    }

    /**
     * 链表的随机访问
     * @param {number} pos 
     * @returns {LinkedList.Node}
     */
    getNode(pos) {
        let current = this.head
        let dir = 'next'
        let steps = pos
        if (pos < 0) {
            current = this.tail
            dir = 'prev'
            steps = -pos - 1
        }

        for (let i = 0; i < steps && current; i++) {
            current = current[dir]
        }

        return current
    }

    /**
     * O(1) 复杂度的删除操作
     * @param {LinkedList.Node} node  
     * @returns 
     */
    remove(node) {
        if (node.list === this) {
            if (node.prev) node.prev.next = node.next;
            else this.head = node.next;
            if (node.next) node.next.prev = node.prev;
            else this.tail = node.prev
            node.prev = null;
            node.next = null;
            this.length--;
            return node.value;
        }

        if (node instanceof LinkedList.Node) {
            return node.value;
        }

        let type = typeof node
        type = type === 'object' ? type.constructor : type
        throw TypeError(`<${type}>${node} not is a LinkedList.Node. `)
    }

    /**
     * 遍历链表的部分节点
     * @param {number|number[]} limit - 限制条件：
     *   - 如果为正数：遍历开头的limit个节点
     *   - 如果为负数：遍历末尾的-limit个节点
     *   - 如果是数组[headLimit, tailLimit]：同时遍历开头headLimit个和末尾-tailLimit个节点
     * @param {Function} callback - 遍历回调函数
     */
    forLimit(limit, callback) {
        if (limit instanceof Array) {
            let [lh, lt] = limit
            // 计算末尾还可以遍历的实际数量，避免与开头部分重叠 (lt 始终为负数)
            lt = Math.max(-(this.length - Math.min(lh, this.length)), lt)
            this.forLimit(lh, callback);
            this.forLimit(lt, callback);
            return;
        }

        if (limit < 0) {
            // 负数：遍历末尾部分
            let current = this.getNode(limit)
            for (let i = limit; i < 0 && current; i--) {
                callback(current.value, i, this);
                current = current.next;
            }
        } else {
            // 正数：遍历开头部分
            let current = this.head;
            for (let i = 0; i < limit && current; i++) {
                callback(current.value, i, this);
                current = current.next;
            }
        }
    }

    [Symbol.iterator]() {
        let current = this.head;
        return {
            next: () => {
                if (current) {
                    const value = current.value;
                    current = current.next;
                    return { value, done: false };
                }
                return { done: true };
            }
        };
    }

    toString(limit = 5) {
        if (this.length === 0) return '[]'
        let lh, lt
        if (limit < this.length) {
            lh = Math.floor(limit / 2);
            lt = -limit + lh;

        } else {
            lh = limit
            lt = 0
        }
        let heads = [];
        let tails = [];
        this.forLimit([lh, lt], (v, i) => {
            i < 0 ? tails.push(v) : heads.push(v)
        })
        return '[ ' + [...heads].join(', ') + (tails.length ? ' ... ' : '') + [...tails].join(', ') + ' ]';
    }
}

