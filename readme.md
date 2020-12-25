## 背景
前端定位问题困难，很多时候定位问题只能靠猜，无法了解用户真实操作场景。已有的错误上报系统，只能知道页面的js错误，无法满足需求，因此开发该项目。

因为日志的存储量比较大，并且许多日志是无效日志，对于服务器而言一次性存储的量有限制，只有发生问题用户的日志才是定位问题的需求，选择将日志存储在用户本地。

在实际接入微信公众平台公众号业务后，通过上报监控来看，小程序提供的后台实时日志接口远远能够满足公众号日志上报的量。因此提供配置，对于关键信息，可以开启实时日志配置，自定义实时日志上报接口，进行上报。

## 存储介质选择
#### localstorage
只支持字符串，有大小和个数限制。
#### cookie
只支持字符串，隐私模式不可用。
#### websql
已被废弃。
#### indexedDB
支持存储对象，大容量，兼容性好。最终选择用indexedDB作为存储介质。

## Mplogd使用
### 如何记录日志
#### 1.快速上手
记录日志简单易上手，只需要引入mplogd的npm包，实例化mplogd对象，根据需求调用相应的info\warn\error接口即可。

日志记录在用户浏览器端的indexedDB中，默认数据库名mplog，数据库表名logs。

#### 示例
```
const Mplogd = require('@tencent/mplogd');
const mplog = new Mplogd();
mplog.info('description', 'data'); 记录描述 和 具体数据
mplog.info('delete a vote, id: ',  'xxxx');
mplog.error('ajax request error');
mplog.warn('invalid input', 'xxx');
```

#### 默认数据库记录格式
1. location 当前页面地址
2. level 日志等级
3. description 日志信息补充描述
4. data 数据
5. timestamp 时间戳

#### 2.个性化配置
- 基本配置比如数据库名、数据库表名、数据库版本等。
- 配置自动记录页面ajax请求、js错误、promise错误，同时支持ajaxFilter过滤不需要记录的ajax请求。
- 配置错误监控上报函数、实时日志上报函数
- 进阶配置，支持根据需求自定义日志记录的方式，比如：缓冲区大小、系统最大容错数、单条日志长度等。

##### 自定义配置项如下：
   自定义属性       |       说明           |    默认  
----| ---- | ----
dbName         |  数据库名            | mplog
dbStoreName    | 数据库表名           | logs
dbVersion      | 数据库版本           | 1 
bufferSize     | 写日志缓存的记录大小，可设置我1即时记录 | 10
autoLogError     |是否自动记录错误信息     |   false  
autoLogRejection  |是否自动记录promise错误 |   false
autoLogAjax       | 是否自动记录AJAX请求   |   false
logAjaxFilter    | 过滤AJAX请求的函数, 默认不做过滤 | null
maxErrorNum    | 最大容错数（比如：写入某条日志错误 | 3
maxLogSize | 单条日志最大长度 |  3000
BadJsReport | 错误监控上报 | null
reportFunction | 实时日志上报 | null

##### 使用方式
```
// 多维监控上报
let BadJsReport = (errorMsg, errorInfo) => {
	if (window.WX_BJ_REPORT && window.WX_BJ_REPORT.BadJs && typeof window.WX_BJ_REPORT.BadJs.report === 'function') {
	window.WX_BJ_REPORT.BadJs.report('mplog: error', errorMsg, {
		view: 'mmbizweb_monitor',
		mid: window.PAGE_MID,
		info: errorInfo
	});
	}
};
// 传入自定义配置
const Mplogd = require('@tencent/mplogd');
const mplog = new Mplogd({
	dbName: `mplog__${useruin}`,
	autoLogError: true,
	autoLogAjax: true,
	autoLogRejection: true,
	maxLogSize: 10000,
	BadJsReport
});
```

### 如何获取用户日志
当用户反馈问题时，日志只是记录在了用户的浏览器中，要如何或者他们的日志呢。

#### 方式1：主动上传
##### 1. 获取日志
1.1 默认获取日志格式
```
const mplog = new Mplogd({
	dbName: 'mplog', // 传入需要上传的数据库名
	dbStoreName: 'logs', // 传入需要上传的数据库表名
});
let beginTime = Date().now() - 7 * 36000;
let endTime = Date.now();
let dealFunc = (logs) => {
	console.log(logs);
};
mplog.get(beginTime, endTime, dealFunc);
```
1.2 自定义获取日志格式
```
const mplog = new Mplogd({
	dbName: 'mplog', // 传入需要上传的数据库名
	dbStoreName: 'logs', // 传入需要上传的数据库表名
});
let beginTime = Date().now() - 7 * 36000;
let endTime = Date.now();
let results = [];
let dealFunc = (event) => {
	const cursor = event.target.result;
	if (cursor) {
		results.push({
			timestamp: cursor.value.timestamp,
			data: cursor.value.data,
			description: cursor.value.
		})
		cursor.continue();
	}
};
mplog.get(beginTime, endTime, null, dealFunc);
```

1.3 下载日志至用户本地
```
const mplog = new Mplogd({
	dbName: 'mplog', // 传入需要上传的数据库名
	dbStoreName: 'logs', // 传入需要上传的数据库表名
});
let beginTime = Date().now() - 7 * 36000;
let endTime = Date.now();
mplog.download(beginTime, endTime);
```

####方式2：自动下发上传
需要业务方根据自身业务自己实现，这里提供公众号的实现方式。

1. 提供配置网址，对特定的公众号bizuin、页面、时间段的配置日志上传。

2. 后台在用户登录后，每次读取配置项，当需要日志上传时，设置标志位。

3. 前端读取后台下发的标志位，自动上传。
