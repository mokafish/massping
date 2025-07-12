# Massping - Mass send requests for test web application
[![Node.js Package](https://github.com/mokafish/massping/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/mokafish/massping/actions/workflows/npm-publish.yml)

**Table of content**
 - install
 - using
 - 

## Install
```shell
npm i -g massping
```

## Using

```
massping [options] <target>
```

### Options

```
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
```

### Target
Target url with SBL tag

## SBL
Structured Build Language (SBL) is a domain-specific language used to generate data. Similar to template engines, uses interpolation tags to render data into text. What sets it apart is that its tags are not predefined variables, but rather a syntax governed by specific generation rules.

**Simple Demo**
* SBL source code:  `/{zh,en}/{1:5}?i={100-200}`
* 1st execution: `/zh/1?i=123`
* 2nd execution: `/en/2?i=163`
* 3rd execution: `/zh/3?i=155`
* 4th execution: `/en/4?i=178`
* 5th execution: `/zh/5?i=200`
* 6th execution: `/en/1?i=100`
* 100th execution: `/en/5?i=111`

### Syntaxs
### Random

