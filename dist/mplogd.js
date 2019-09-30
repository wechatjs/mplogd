(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.Mplogd = factory());
}(this, function () { 'use strict';

  var DB_Status = {
      /**
       * 初始化中
       */
      INITING: 'initing',
      /**
       * 初始化完成
       */
      INITED: 'inited',
      /**
       * 失败
       */
      FAILED: 'failed'
  };
  var ErrorLevel = {
      /**
      * 一般级别错误
      */
      normal: 1,
      /**
       * 严重错误
       */
      serious: 2,
      /**
       * 致命错误
       */
      fatal: 3
  };
  var LevelEnum = {
      /**
       * 信息
       */
      info: 'info',
      /**
       * 警告
       */
      warn: 'warn',
      /**
       * 错误
       */
      error: 'error'
  };

  function formatNumber(n) {
      n = n.toString();
      return n[1] ? n : '0' + n;
  }
  function formatTime(date) {
      var year = date.getFullYear();
      var month = date.getMonth() + 1;
      var day = date.getDate();
      var hour = date.getHours();
      var minute = date.getMinutes();
      var second = date.getSeconds();
      return [year, month, day].map(formatNumber).join('-') + ' ' + [hour, minute, second].map(formatNumber).join(':');
  }
  function resolveUrl(url) {
      var link = document.createElement('a');
      link.href = url;
      return link.protocol + '//' + link.host + link.pathname + link.search + link.hash;
  }
  function formatDate(time) {
      var timeStamp = '';
      if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(time)) {
          timeStamp += new Date(time).getTime();
      }
      else if (/^\d{13}$/.test(time)) {
          timeStamp += time;
      }
      return parseInt(timeStamp);
  }

  var g = {
      defaultDbName: "mplog",
      defaultDbStoreName: 'logs'
  };
  var TransactionType = {
      /**
       * 支持读写
       */
      'READ_WRITE': 'readwrite',
      /**
       * 只支持读
       */
      'READ_ONLY': 'readonly'
  };
  var MPIndexedDB = /** @class */ (function () {
      function MPIndexedDB(config, poolHandler) {
          this.defaultDbName = "mplog";
          this.defaultDbStoreName = 'logs';
          this.dbStatus = DB_Status.INITING;
          this.currentErrorNum = 0;
          this.maxRetryCount = 3;
          this.currentRetryCount = 0;
          this.retryInterval = 6000;
          // 数据库名称,如果不是写日志，还是新建一个数据库好，不然打开同一个版本数据库时，很可能导致另外的store不能增删改结构
          this.DB_NAME = config && config.dbName ? config.dbName : this.defaultDbName;
          // 数据库表名， 
          this.DB_STORE_NAME = config && config.dbStoreName ? config.dbStoreName : g.defaultDbStoreName;
          // 数据库版本。只能增加。如果没有修改数据库名称，但是想要新建，删除，更新store, 版本号要在这里改动
          // 如果修改了版本号，灰度了又回退，一定要再修改一次版本号，不然会open时会报错
          this.DB_VERSION = config && typeof config.dbVersion !== 'undefined' ? config.dbVersion : 1;
          this.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
          this.onupgradeneeded = config && config.onupgradeneeded ? config.onupgradeneeded : null;
          this.maxErrorNum = config && config.maxErrorNum ? config.maxErrorNum : 3;
          this.poolHandler = poolHandler;
          this.init();
      }
      MPIndexedDB.prototype.init = function () {
          try {
              this.createDB();
          }
          catch (e) {
              console.log('Mplog createDB failed');
          }
      };
      // 创建数据库
      MPIndexedDB.prototype.createDB = function () {
          var _this = this;
          if (!this.indexedDB) {
              this.throwError(ErrorLevel.serious, 'your browser not support IndexedDB.');
              return;
          }
          if (this.dbStatus !== DB_Status.INITING) {
              this.throwError(ErrorLevel.serious, 'indexedDB init error');
              return;
          }
          var request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
          request.onerror = function (e) {
              _this.checkDB(e);
              var errLvl = ErrorLevel.serious;
              if (e.target.error && e.target.error.name === 'VersionError') { // 打开低版本数据库导致失败
                  try {
                      var messgae = e.target.error.message;
                      var regexp = /The requested version \([0-9]+\) is less than the existing version \([0-9]\)/;
                      var isVersionLowError = messgae.search(regexp);
                      if (isVersionLowError > -1) {
                          var existVersion = messgae.match(/[0-9]+/ig)[1];
                          if (existVersion > _this.DB_VERSION) {
                              _this.DB_VERSION = existVersion;
                          }
                      }
                  }
                  catch (e) {
                      console.log(e);
                  }
                  errLvl = ErrorLevel.fatal; // 致命错误
                  _this.dbStatus = DB_Status.FAILED;
                  // this.currentRetryCount = 2;
                  // this.currentRetryCount = this.maxRetryCount + 1; // 不需要重试了
              }
              _this.throwError(errLvl, 'indexedDB open error, message:', e.target.error);
          };
          request.onsuccess = function (e) {
              if (_this.dbStatus !== DB_Status.INITING) { // 可能onupgradeneeded执行有问题
                  return;
              }
              _this.db = e.target.result;
              _this.dbStatus = DB_Status.INITED;
              // 数据库错误
              _this.db.onerror = function (er) { return _this.throwError(ErrorLevel.serious, 'indexedDB error', er.target.error); };
              // 其他MPlog对象打开了一个更新版本的数据库，或者数据库被删除时，此数据库链接要关闭
              _this.db.onversionchange = function (event) {
                  _this.db.close();
                  _this.dbStatus = DB_Status.FAILED;
                  _this.currentRetryCount = _this.maxRetryCount + 1; // 不需要重试了
                  _this.throwError(ErrorLevel.fatal, 'indexedDB version change, message:', event.target.error);
              };
              try {
                  _this.poolHandler.consume();
              }
              catch (e) {
                  _this.throwError(ErrorLevel.fatal, 'consume pool error', e);
              }
              if (_this.DB_NAME === g.defaultDbName && _this.DB_STORE_NAME === g.defaultDbStoreName) {
                  setTimeout(function () {
                      if (_this.dbStatus !== DB_Status.INITED) {
                          _this.poolHandler.push(function () {
                              return _this.keep(7);
                          });
                      }
                      else {
                          _this.keep(7); // 保留7天数据
                      }
                  }, 1000);
              }
          };
          request.onblocked = function () {
              _this.throwError(ErrorLevel.serious, 'indexedDB is blocked');
          };
          request.onupgradeneeded = function (e) {
              _this.db = e.target.result;
              try {
                  if (_this.DB_NAME === g.defaultDbName && _this.DB_STORE_NAME === g.defaultDbStoreName) {
                      if (!_this.db.objectStoreNames.contains(_this.DB_STORE_NAME)) { // 没有store则创建
                          var objectStore = _this.db.createObjectStore(_this.DB_STORE_NAME, {
                              autoIncrement: true
                          });
                          objectStore.createIndex('location', 'location', {
                              unique: false
                          });
                          objectStore.createIndex('level', 'level', {
                              unique: false
                          });
                          objectStore.createIndex('description', 'description', {
                              unique: false
                          });
                          objectStore.createIndex('data', 'data', {
                              unique: false
                          });
                          objectStore.createIndex('timestamp', 'timestamp', {
                              unique: false
                          });
                      }
                      else if (e.oldVersion < 3) { // 旧版本，需要更新数据，新增时间戳字段和索引
                          var store = e.target.transaction.objectStore(_this.DB_STORE_NAME);
                          store.createIndex('timestamp', 'timestamp', {
                              unique: false
                          });
                          store.openCursor().onsuccess = function (event) {
                              var cursor = event.target.result;
                              if (cursor) {
                                  cursor.update({
                                      time: cursor.value.time,
                                      level: cursor.value.level,
                                      location: cursor.value.location,
                                      description: cursor.value.description,
                                      data: cursor.value.data,
                                      timestamp: (new Date(cursor.value.time)).getTime()
                                  });
                                  cursor["continue"]();
                              }
                          };
                      }
                  }
                  if (typeof _this.onupgradeneeded === 'function') {
                      _this.onupgradeneeded(e);
                  }
              }
              catch (event) {
                  _this.dbStatus = DB_Status.FAILED;
                  _this.throwError(ErrorLevel.fatal, 'indexedDB upgrade error', event);
              }
          };
      };
      MPIndexedDB.prototype.checkDB = function (event) {
          if (event && event.target && event.target.error && event.target.error.name === 'QuotaExceededError') { // 硬盘容量满了，清下日志
              this.clean();
          }
      };
      MPIndexedDB.prototype.getTransaction = function (transactionType) {
          var _this = this;
          var transaction = null;
          if (this.dbStatus === DB_Status.FAILED) {
              transaction = null;
          }
          else {
              try {
                  transaction = this.db.transaction(this.DB_STORE_NAME, transactionType);
              }
              catch (e) {
                  transaction = null;
              }
              if (transaction) {
                  transaction.onerror = function (event) {
                      event.stopPropagation();
                      return _this.throwError(ErrorLevel.fatal, 'transaction is error');
                  };
                  transaction.onabort = function (event) {
                      event.stopPropagation();
                      if (event.target.error && event.target.error.name === 'QuotaExceededError') {
                          _this.clean();
                      }
                  };
              }
          }
          return transaction;
      };
      MPIndexedDB.prototype.insertItems = function (bufferList) {
          var _this = this;
          var request;
          var transaction = this.getTransaction(TransactionType.READ_WRITE);
          if (transaction === null) {
              this.throwError(ErrorLevel.fatal, 'transaction is null');
              return false;
          }
          var store = transaction.objectStore(this.DB_STORE_NAME);
          for (var _i = 0, bufferList_1 = bufferList; _i < bufferList_1.length; _i++) {
              var item = bufferList_1[_i];
              request = store.put(item);
              request.onsuccess = function () { };
              request.onerror = function (e) {
                  return _this.throwError(ErrorLevel.normal, 'add log failed', e.target.error);
              };
          }
      };
      MPIndexedDB.prototype.get = function (from, to, dealFc) {
          if (this.DB_NAME !== g.defaultDbName || this.DB_STORE_NAME !== g.defaultDbStoreName) {
              // 不是默认数据库不执行
              return false;
          }
          var transaction = this.getTransaction(TransactionType.READ_ONLY);
          if (transaction === null) {
              this.throwError(ErrorLevel.fatal, 'transaction is null');
              return false;
          }
          var fromTime = new Date().getTime();
          var toTime = new Date().getTime();
          try {
              fromTime = formatDate(from);
              toTime = formatDate(to);
          }
          catch (e) {
              this.throwError(ErrorLevel.normal, 'invalid time');
          }
          var store = transaction.objectStore(this.DB_STORE_NAME);
          var results = [];
          var keyRange = IDBKeyRange.bound(fromTime, toTime); // from<=timestamp<=to
          var request = store.index('timestamp').openCursor(keyRange);
          request.onsuccess = function (event) {
              var cursor = event.target.result;
              if (cursor) {
                  results.push({
                      time: cursor.value.time,
                      level: cursor.value.level,
                      location: cursor.value.location,
                      description: cursor.value.description,
                      data: cursor.value.data,
                      timestamp: cursor.value.timestamp
                  });
                  cursor["continue"]();
              }
              else {
                  dealFc(results);
              }
          };
          return true;
      };
      MPIndexedDB.prototype.clean = function () {
          var _this = this;
          this.db && this.db.close();
          var request = this.indexedDB.deleteDatabase(this.DB_NAME);
          request.onerror = function (event) {
              _this.throwError(ErrorLevel.serious, 'clean database failed', event.target.error);
          };
          request.onsuccess = function () {
              _this.dbStatus = DB_Status.FAILED;
          };
      };
      MPIndexedDB.prototype.keep = function (saveDays) {
          var _this = this;
          if (this.DB_NAME !== g.defaultDbName || this.DB_STORE_NAME !== g.defaultDbStoreName) {
              // 不是默认数据库不执行
              return;
          }
          var transaction = this.getTransaction(TransactionType.READ_WRITE);
          if (transaction === null) {
              this.throwError(ErrorLevel.fatal, 'transaction is null');
              return;
          }
          var store = transaction.objectStore(this.DB_STORE_NAME);
          if (!saveDays) {
              store.clear().onerror = function (event) {
                  return _this.throwError(ErrorLevel.serious, 'indexedb_keep_clear', event.target.error);
              };
          }
          else {
              // 删除过期数据
              var range = Date.now() - saveDays * 60 * 60 * 24 * 1000;
              var keyRange = IDBKeyRange.upperBound(range); // timestamp<=range，证明过期
              var request = store.index('timestamp').openCursor(keyRange);
              request.onsuccess = function (event) {
                  var cursor = event.target.result;
                  if (cursor) {
                      cursor["delete"]();
                      cursor["continue"]();
                  }
              };
              request.onerror = function (event) {
                  return _this.throwError(ErrorLevel.normal, 'keep logs error', event.target.error);
              };
          }
      };
      MPIndexedDB.prototype.throwError = function (errorLevel, errorMsg, error) {
          var _this = this;
          this.currentErrorNum += errorLevel;
          if (this.currentErrorNum >= this.maxErrorNum) {
              this.dbStatus = DB_Status.FAILED;
              this.poolHandler.pool = [];
              this.currentErrorNum = 0;
          }
          var errorStr = '';
          if (error) {
              errorMsg = errorMsg + ':' + (error.message || error.stack || error.name);
              errorStr = error.toString();
          }
          console.error && console.error("Mplog: error msg: " + errorMsg + ", error detail: " + errorStr);
          if (this.dbStatus === DB_Status.FAILED) {
              this.timer = setInterval(function () {
                  _this.retryDBConnection();
              }, this.retryInterval);
          }
      };
      MPIndexedDB.prototype.retryDBConnection = function () {
          this.currentRetryCount++;
          if (this.currentRetryCount > this.maxRetryCount) {
              this.dbStatus = DB_Status.FAILED;
              this.poolHandler.pool = [];
          }
          else {
              this.dbStatus = DB_Status.INITING;
              this.createDB();
          }
          clearInterval(this.timer);
      };
      return MPIndexedDB;
  }());

  var PoolHandler = /** @class */ (function () {
      function PoolHandler() {
          this.poolSize = 100;
          this.pool = [];
      }
      PoolHandler.prototype.push = function (action) {
          if (this.pool.length < this.poolSize) {
              this.pool.push(action);
          }
      };
      PoolHandler.prototype.consume = function () {
          var handler = this.pool.shift();
          while (handler) {
              handler();
              handler = this.pool.shift();
          }
      };
      return PoolHandler;
  }());

  var LogController = /** @class */ (function () {
      function LogController(config) {
          this.defaultAjaxFilter = null;
          this.bufferLog = [];
          // 是否自动记录错误信息
          this.autoLogError = config && typeof config.autoLogError !== 'undefined' ? config.autoLogError : false;
          // 是否自动记录promise错误
          this.autoLogRejection = config && typeof config.autoLogRejection !== 'undefined' ? config.autoLogRejection : false;
          // 是否自动记录AJAX请求
          this.autoLogAjax = config && typeof config.autoLogAjax !== 'undefined' ? config.autoLogAjax : false;
          this.logAjaxFilter = config && config.logAjaxFilter && config.logAjaxFilter ? config.logAjaxFilter : this.defaultAjaxFilter;
          // 最大允许错误数
          this.maxErrorNum = config && config.maxErrorNum ? config.maxErrorNum : 3;
          // 缓存记录的大小
          this.bufferSize = config && typeof config.bufferSize !== 'undefined' ? config.bufferSize * 1 : 3;
          this.poolHandler = new PoolHandler();
          this.mpIndexedDB = new MPIndexedDB(config, this.poolHandler);
      }
      LogController.prototype.log = function (location, level, description, data) {
          var date = new Date();
          var value = {
              'time': formatTime(date),
              'location': location,
              'level': level,
              'description': description,
              'data': this.filterFunction(data),
              'timestamp': date.getTime() // 时间戳，单位毫秒
          };
          this.bufferLog.push(value);
          if (this.bufferLog.length >= this.bufferSize) {
              this.flush();
          }
      };
      LogController.prototype.filterFunction = function (obj) {
          var newObj = {};
          try {
              // 函数则转为字符串
              if (typeof obj === 'function') {
                  return obj.toString();
              }
              if (typeof obj !== 'object') {
                  return obj;
              }
              for (var i in obj) {
                  if (Object.prototype.hasOwnProperty.call(obj, i)) {
                      if (typeof obj[i] !== 'function') {
                          newObj[i] = this.filterFunction(obj[i]);
                      }
                  }
              }
              return newObj;
          }
          catch (e) {
              return {
                  error: 'filterFunction error'
              };
          }
      };
      LogController.prototype.flush = function () {
          var _this = this;
          if (this.bufferLog.length === 0) {
              return false;
          }
          if (this.mpIndexedDB.dbStatus !== DB_Status.INITED) {
              return this.poolHandler.push(function () {
                  return _this.flush();
              });
          }
          this.mpIndexedDB.insertItems(this.bufferLog);
          this.bufferLog = [];
          return 0;
      };
      LogController.prototype.get = function (from, to, dealFun) {
          var _this = this;
          if (this.mpIndexedDB.dbStatus !== DB_Status.INITED) {
              return this.poolHandler.push(function () {
                  return _this.get(from, to, dealFun);
              });
          }
          this.mpIndexedDB.get(from, to, dealFun);
      };
      LogController.prototype.keep = function (saveDays) {
          var _this = this;
          if (this.mpIndexedDB.dbStatus !== DB_Status.INITED) {
              return this.poolHandler.push(function () {
                  return _this.keep(saveDays);
              });
          }
          this.mpIndexedDB.keep(saveDays);
      };
      return LogController;
  }());

  var Mplogd = /** @class */ (function () {
      function Mplogd(config) {
          this.defaultAjaxFilter = null;
          this.xhrOpen = XMLHttpRequest.prototype.open;
          // xhr 原生 send 方法
          this.xhrSend = XMLHttpRequest.prototype.send;
          // 当前页面链接
          this.location = config && config.location ? config.location : window.location.href;
          // 是否自动记录错误信息
          this.autoLogError = config && typeof config.autoLogError !== 'undefined' ? config.autoLogError : false;
          // 是否自动记录promise错误
          this.autoLogRejection = config && typeof config.autoLogRejection !== 'undefined' ? config.autoLogRejection : false;
          // 是否自动记录AJAX请求
          this.autoLogAjax = config && typeof config.autoLogAjax !== 'undefined' ? config.autoLogAjax : false;
          this.logAjaxFilter = config && config.logAjaxFilter && config.logAjaxFilter ? config.logAjaxFilter : this.defaultAjaxFilter;
          this.logController = new LogController(config);
          this.bindEvent();
      }
      Mplogd.prototype.bindEvent = function () {
          var _this = this;
          // 页面错误
          if (this.autoLogError) {
              window.addEventListener('error', function (err) {
                  _this.error("[OnError]: " + err.message, "(" + err.lineno + "_(\"\u884C\")" + err.colno + "_(\"\u5217\"))");
              });
          }
          // promise请求被reject
          if (this.autoLogRejection) {
              window.addEventListener('unhandledrejection', function (err) {
                  _this.error('[OnRejection]:', err.reason);
              });
          }
          this.ajaxHanler();
          this.saveUnstoreData();
      };
      Mplogd.prototype.ajaxHanler = function () {
          if (this.autoLogAjax) {
              var that_1 = this;
              var lajaxMethod;
              var lajaxUrl;
              XMLHttpRequest.prototype.open = function open() {
                  var args = [];
                  for (var _i = 0; _i < arguments.length; _i++) {
                      args[_i] = arguments[_i];
                  }
                  lajaxMethod = args[0];
                  lajaxUrl = resolveUrl(args[1]);
                  that_1.xhrOpen.apply(this, args);
              };
              XMLHttpRequest.prototype.send = function send() {
                  var args = [];
                  for (var _i = 0; _i < arguments.length; _i++) {
                      args[_i] = arguments[_i];
                  }
                  var startTime = new Date().getTime();
                  if (that_1.logAjaxFilter && that_1.logAjaxFilter(lajaxUrl, lajaxMethod) || !that_1.logAjaxFilter) {
                      // 添加一条日志到缓存
                      that_1.info('[ajax] send: ' + lajaxMethod.toLowerCase() + '; request：' + lajaxUrl);
                  }
                  // 添加 readystatechange 事件
                  this.addEventListener('readystatechange', function changeEvent() {
                      // 排除掉用户自定义不需要记录日志的 ajax
                      if (that_1.logAjaxFilter && that_1.logAjaxFilter(lajaxUrl, lajaxMethod) || !that_1.logAjaxFilter) {
                          try {
                              if (this.readyState === XMLHttpRequest.DONE) {
                                  var endTime = new Date().getTime();
                                  // 请求耗时
                                  var costTime = (endTime - startTime) / 1000;
                                  if (this.status >= 200 && this.status < 400) {
                                      that_1.info('request succeed');
                                  }
                                  else {
                                      that_1.info('request failed');
                                  }
                                  that_1.info('request cost：' + costTime + '; URL：' + lajaxUrl + '; request method:' + lajaxMethod);
                                  if (lajaxMethod.toLowerCase() === 'post') {
                                      that_1.info('request data: ', args[0]);
                                  }
                              }
                          }
                          catch (err) {
                              that_1.error('request failed！', err);
                              that_1.error('URL：' + lajaxUrl + ';request method：' + lajaxMethod + ',' + this.status);
                              if (lajaxMethod.toLowerCase() === 'post') {
                                  that_1.error('request data', args[0]);
                              }
                          }
                      }
                  });
                  that_1.xhrSend.apply(this, args);
              };
          }
      };
      Mplogd.prototype.saveUnstoreData = function () {
          var _this = this;
          window.addEventListener('beforeunload', function (event) {
              try {
                  _this.logController.flush();
              }
              catch (e) {
                  console.log(e);
              }
              event.preventDefault();
          });
      };
      Mplogd.prototype.info = function (description, data) {
          this.logController.log(this.location, LevelEnum.info, description, data);
      };
      Mplogd.prototype.warn = function (description, data) {
          this.logController.log(this.location, LevelEnum.warn, description, data);
      };
      Mplogd.prototype.error = function (description, data) {
          this.logController.log(this.location, LevelEnum.error, description, data);
      };
      Mplogd.prototype.get = function (from, to, dealFun) {
          this.logController.get(from, to, dealFun);
      };
      Mplogd.prototype.keep = function (saveDays) {
          this.logController.keep(saveDays);
      };
      return Mplogd;
  }());

  return Mplogd;

}));
