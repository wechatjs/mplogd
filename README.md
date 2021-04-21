## 介绍
基于IndexedDB的前端日志存储系统Mplogd。

前端开发同学定位问题困难，无法了解用户真实操作场景，很多时候定位问题只能靠猜。因此选择记录下用户的操作日志，帮助定位问题。

## Mplogd优势：
1. 个性化灵活配置。比如：日志监控上报、关键日志实时上报等等。

2. 支持自动记录。包括：http请求、页面error错误、promise reject、fetch请求，每一自动记录项都支持单独配置。

3. 更稳定的服务。维护内部状态，错误监控。

4. 容量控制。1. 保存7天日志。 2. 单条日志大小自定义限制。 3.日志总容量控制。 

## 使用
@tencent/mplogd 1.0.6
#### 示例
```
const Mplogd = require('@tencent/mplogd');
const mplog = new Mplogd();
1. 记录
mplog.info('ajax request', requestBodyData);   // description: 记录描述(可用于后续半匹配搜索) 和 data: 具体数据

2. 查询
mplog.get('2021-4-18', '2021-4-19', (items) => {
	if (items.length) {
		items.forEach(item => {
			console.log(item);
		})
	}
});
```
#### 默认数据库记录格式
1. location 当前页面地址
2. level 日志等级
3. description 日志信息补充描述
4. data 数据
5. timestamp 时间戳

#### 自定义配置项如下：
   自定义属性       |       说明           |    默认  
----| ---- | ----
dbName         |  数据库名            | mplog
dbStoreName    | 数据库表名           | logs
dbVersion      | 数据库版本           | 1 
bufferSize     | 写日志缓存的记录大小，可设置为1即时记录 | 10
autoLogError     |是否自动记录错误信息     |   false  
autoLogRejection  |是否自动记录promise错误 |   false
autoLogAjax       | 是否自动记录AJAX请求   |   false
autoLogFetch      | 是否自动记录fetch请求  |   false
logAjaxFilter    | 过滤AJAX请求的函数, 默认不做过滤 | null
maxErrorNum    | 最大容错数（比如：写入某条日志错误 | 3
maxLogSize | 单条日志最大长度 |  3000
ErrorReport | 错误监控上报 | null
reportFunction | 实时日志上报 | null

#### 扩展配置使用方式
```
// 错误兼容上报
let ErrorReport = (errorMsg, errorInfo) => {
	// errorMsg和errorInfo, 为错误描述和具体的错误内容，业务方可自行处理上报。
};

const Mplogd = require('@tencent/mplogd');
const mplog = new Mplogd({
	dbName: `mplog__${useruin}`,
	autoLogError: true,
	autoLogAjax: true,
	autoLogRejection: true,
	maxLogSize: 10000,
	ErrorReport
});

// 实时日志上报
let reportFunction = (items) => { // 当前的日志元素 [数组格式]
	// 可上报日志到实时
};
```