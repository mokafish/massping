import CookiesModule from './lib/cookies.js' 

let {Cookie, CookieMap, CookieError} = CookiesModule
let cf = new CookieMap('~/cookies.txt')

console.log(cf);

