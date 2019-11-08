##背景
前端定位问题困难，很多时候定位问题只能靠猜，无法知道用户真实操作场景，还原现场。已有的错误上报系统，只能知道页面的js错误，无法满足需求，因此开发该项目。
因为日志的存储量比较大，对于服务器而言一次性存储的量有限制，并且许多日志是无效日志，只有发生问题用户的日志才是定位问题的需求。最终选择将日志存储在用户本地。
##存储介质选择
###localstorage
只支持字符串，有大小和个数限制。
###cookie
只支持字符串，隐私模式不可用，可能会占用内存。
###websql
已被废弃。
###indexedDB
支持存储对象，大容量，兼容性好。
最终选择用indexedDB作为存储介质。
##记录日志方式
### 储存地址
浏览器端的IndexedDB中，默认数据库名：mplog，默认数据库表名：logs，可自定义配置。

### 示例
1. `const Mplogd = require('@tencent/mplogd');`
2. `const mplog = new Mplogd();`
3. `mplog.info('delete a vote, id: ',  'xxxx');`
4. `mplog.error('ajax request error');`
5. `mplog.warn('invalid input', 'xxx');`

### 说明
1. 记录内容：级别、位置、描述、数据，位置默认是当前页面链接。
2. 避免记录用户敏感信息，若记录，须加密。
3. 默认自动记录页面Error，Promise错误，Ajax请求的时间、数据、结果等信息，可关闭

### 数据记录格式
1. location 当前页面地址
2. level 日志等级
3. description 日志信息补充描述
4. data 数据
5. timestamp 时间戳

### 关闭自动记录
```
const config = {
	autoLogError: false,
	autoLogRejection: false,
	autoLogAjax: false
}
```
### 自定义配置项
|   自定义属性       |       说明           |    默认  
----| ---- | ----
| autoLogError     |是否自动记录错误信息     |   false  
|autoLogRejection  |是否自动记录promise错误 |   false
|autoLogAjax       | 是否自动记录AJAX请求   |   false
| logAjaxFilter    | 过滤AJAX请求的函数, 默认不做过滤 | null
|   maxErrorNum    | 最大容错数（比如：写入某条日志错误 | 3
|   dbName         |  数据库名            | mplog
|   dbStoreName    | 数据库表名           | logs
|   dbVersion      | 数据库版本           | 1 
|   bufferSize     | 写日志缓存的记录大小，可设置我1即时记录 | 50
|   onupgradeneeded | 数据库发生更新时的处理函数(可设置修改初始创建时的日志格式) | null 
