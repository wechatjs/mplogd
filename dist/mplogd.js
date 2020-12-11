(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.Mplogd = factory());
}(this, function () { 'use strict';

  var DBStatus = {
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
      FAILED: 'failed',
  };
  var ErrorLevel = {
      /**
       * 只用于上报的错误
       */
      unused: 0,
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
      fatal: 3,
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
      error: 'error',
  };
  var IgnoreCGIName = ['mplog', 'report', 'webcommreport'];
  var MAX_LOG_SIZE = 1000000000000; // 100MB

  function formatNumber(n) {
      n = n.toString();
      return n[1] ? n : "0" + n;
  }
  function formatTime(date) {
      var year = date.getFullYear();
      var month = date.getMonth() + 1;
      var day = date.getDate();
      var hour = date.getHours();
      var minute = date.getMinutes();
      var second = date.getSeconds();
      return [year, month, day].map(formatNumber).join('-') + " " + [hour, minute, second].map(formatNumber).join(':');
  }
  function resolveUrl(url) {
      var link = document.createElement('a');
      link.href = url;
      return link.protocol + "//" + link.host + link.pathname + link.search + link.hash;
  }
  function formatDate(time) {
      var timeStamp = '';
      if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(time)) {
          timeStamp += new Date(time).getTime();
      }
      else if (/^\d{13}$/.test(time)) {
          timeStamp += time;
      }
      else if (/^\d{10}$/.test(time)) {
          timeStamp += parseInt(time, 10) * 1000;
      }
      return parseInt(timeStamp, 10);
  }
  function getLocationCGIName(location) {
      var CGIName;
      if (!!location.match(/\/[A-Za-z]+\?/)) {
          CGIName = location.match(/\/[A-Za-z]+\?/)[0];
          CGIName = CGIName.replace('\?', '').replace('\/', ''); // eslint-disable-line
      }
      return CGIName;
  }

  /*! *****************************************************************************
  Copyright (c) Microsoft Corporation. All rights reserved.
  Licensed under the Apache License, Version 2.0 (the "License"); you may not use
  this file except in compliance with the License. You may obtain a copy of the
  License at http://www.apache.org/licenses/LICENSE-2.0

  THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
  WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
  MERCHANTABLITY OR NON-INFRINGEMENT.

  See the Apache Version 2.0 License for specific language governing permissions
  and limitations under the License.
  ***************************************************************************** */

  function __awaiter(thisArg, _arguments, P, generator) {
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  }

  function __generator(thisArg, body) {
      var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
      function verb(n) { return function (v) { return step([n, v]); }; }
      function step(op) {
          if (f) throw new TypeError("Generator is already executing.");
          while (_) try {
              if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
              if (y = 0, t) op = [op[0] & 2, t.value];
              switch (op[0]) {
                  case 0: case 1: t = op; break;
                  case 4: _.label++; return { value: op[1], done: false };
                  case 5: _.label++; y = op[1]; op = [0]; continue;
                  case 7: op = _.ops.pop(); _.trys.pop(); continue;
                  default:
                      if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                      if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                      if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                      if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                      if (t[2]) _.ops.pop();
                      _.trys.pop(); continue;
              }
              op = body.call(thisArg, _);
          } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
          if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
      }
  }

  function getIfCurrentUsageExceed(maxLogSize) {
      return __awaiter(this, void 0, void 0, function () {
          return __generator(this, function (_a) {
              try {
                  if (window.navigator && window.navigator.storage && window.navigator.storage.estimate) {
                      return [2 /*return*/, window.navigator.storage.estimate().then(function (_a) {
                              var quota = _a.quota, usage = _a.usage;
                              return usage >= quota || usage >= MAX_LOG_SIZE;
                          })];
                  }
                  else if (window.navigator && window.navigator.webkitTemporaryStorage
                      && window.navigator.webkitTemporaryStorage.queryUsageAndQuota) {
                      return [2 /*return*/, new Promise(function (resolve) {
                              window.navigator.webkitTemporaryStorage
                                  .queryUsageAndQuota(function (usedBytes, grantedBytes) {
                                  resolve(usedBytes > grantedBytes || usedBytes >= MAX_LOG_SIZE);
                              });
                          })];
                  }
                  return [2 /*return*/, false];
              }
              catch (e) {
                  return [2 /*return*/, false];
              }
              return [2 /*return*/];
          });
      });
  }

  var TransactionType = {
      /**
       * 支持读写
       */
      READ_WRITE: 'readwrite',
      /**
       * 只支持读
       */
      READ_ONLY: 'readonly',
  };
  // 从上报的错误日志里提取出关于满容的错误
  var NoEnoughSpace = [
      'enough space',
      'full disk',
      'Maximum key generator',
      'large IndexedDB value'
  ];
  function isMatchErrorType(errorMsg, errorTypeList) {
      var isMatch = false;
      if (errorTypeList.length) {
          errorTypeList.forEach(function (errorType) {
              if (errorMsg.indexOf(errorType) > -1) {
                  isMatch = true;
                  return;
              }
          });
      }
      return isMatch;
  }
  var MPIndexedDB = /** @class */ (function () {
      function MPIndexedDB(config, poolHandler) {
          this.defaultDbName = 'mplog';
          this.defaultDbStoreName = 'logs';
          this.dbStatus = DBStatus.INITING;
          this.currentErrorNum = 0;
          this.maxRetryCount = 3;
          this.currentRetryCount = 0;
          this.retryInterval = 6000;
          this.MAX_CLEAN_TIME = 2; // 最大清理次数
          this.currentCleanTime = 0; // 目前的清理次数
          this.DB_NAME = config && config.dbName ? config.dbName : this.defaultDbName;
          this.DB_STORE_NAME = config && config.dbStoreName ? config.dbStoreName : this.defaultDbStoreName;
          this.DB_VERSION = config && typeof config.dbVersion !== 'undefined' ? config.dbVersion : 1;
          this.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB
              || window.msIndexedDB;
          this.onupgradeneeded = config && config.onupgradeneeded ? config.onupgradeneeded : null;
          this.maxErrorNum = config && config.maxErrorNum ? config.maxErrorNum : 3;
          this.poolHandler = poolHandler;
          this.keep7Days = config && config.keep7Days ? config.keep7Days : true;
          this.BadJsReport = config && config.BadJsReport ? config.BadJsReport : null;
          this.init();
      }
      MPIndexedDB.prototype.insertItems = function (bufferList) {
          var _this = this;
          this.checkCurrentStorage();
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
                  _this.checkDB(e);
                  return _this.throwError(ErrorLevel.normal, 'add log failed', e.target.error);
              };
          }
      };
      MPIndexedDB.prototype.get = function (from, to, dealFc, successCb) {
          var transaction = this.getTransaction(TransactionType.READ_WRITE);
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
          if (typeof successCb === 'function') {
              request.onsuccess = function (event) {
                  successCb(event);
              };
          }
          else if (typeof dealFc === 'function') {
              request.onsuccess = function (event) {
                  var cursor = event.target.result;
                  if (cursor) {
                      results.push({
                          time: cursor.value.time,
                          level: cursor.value.level,
                          location: cursor.value.location,
                          description: cursor.value.description,
                          data: cursor.value.data,
                          timestamp: cursor.value.timestamp,
                      });
                      cursor["continue"]();
                  }
                  else {
                      dealFc(results);
                  }
              };
          }
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
              _this.currentCleanTime += 1;
              if (_this.currentCleanTime <= _this.MAX_CLEAN_TIME) {
                  _this.dbStatus = DBStatus.INITING;
                  _this.createDB();
              }
              else {
                  _this.dbStatus = DBStatus.FAILED;
              }
          };
      };
      MPIndexedDB.prototype.keep = function (saveDays) {
          var _this = this;
          var transaction = this.getTransaction(TransactionType.READ_WRITE);
          if (transaction === null) {
              this.throwError(ErrorLevel.fatal, 'transaction is null');
              return;
          }
          var store = transaction.objectStore(this.DB_STORE_NAME);
          if (!saveDays) {
              store.clear().onerror = function (event) { return _this.throwError(ErrorLevel.serious, 'indexedb_keep_clear', event.target.error); };
          }
          else {
              // 删除过期数据
              // const range = Date.now() - saveDays * 60 * 60 * 24 * 1000;
              // const keyRange = IDBKeyRange.upperBound(range); // timestamp<=range，证明过期
              // if (store.indexNames && store.indexNames.length && store.indexNames.contains('timestamp')) {
              //   const request = store.index('timestamp').openCursor(keyRange);
              //   request.onsuccess = (event) => {
              //     this.throwError(ErrorLevel.unused, 'keep logs success');
              //     const cursor = (event.target as any).result;
              //     if (cursor) {
              //       cursor.delete();
              //       cursor.continue();
              //     }
              //   };
              //   request.onerror = event => this.throwError(ErrorLevel.normal, 'keep logs error', (event.target as any).error);
              // } else {
              //   this.throwError(ErrorLevel.fatal, 'the store has no timestamp index');
              // }
              // test 1
              console.log('begin deleting.......', Date.now());
              var range = Date.now();
              var keyRange = IDBKeyRange.upperBound(range);
              if (store.indexNames && store.indexNames.length && store.indexNames.contains('timestamp')) {
                  // const request = store.index('timestamp').count();
                  // request.onsuccess = (e) => {
                  //   console.log(request.result);
                  // const cursor = (event.target as any).result;
                  // console.log(cursor);
                  // if (cursor) {
                  //   cursor.delete();
                  //   cursor.continue();
                  // }
                  // }
                  var request_1 = store.index('timestamp').getAllKeys(keyRange);
                  request_1.onsuccess = function (e) {
                      var resp = request_1.result;
                      if (resp && resp.length) {
                          var begin = resp[0];
                          var end = resp[resp.length - 1];
                          console.log(begin, end);
                          var deleteKeyRange = IDBKeyRange.bound(begin, end, false, false);
                          store["delete"](deleteKeyRange).onsuccess = function () {
                              store.count().onsuccess = function (e) { console.log(e.target.result); };
                              console.log('deleting success', Date.now());
                          };
                      }
                  };
              }
          }
      };
      MPIndexedDB.prototype.throwError = function (errorLevel, errorMsg, error) {
          var _this = this;
          this.currentErrorNum += errorLevel;
          if (this.currentErrorNum >= this.maxErrorNum) {
              this.dbStatus = DBStatus.FAILED;
              this.poolHandler.pool = [];
              this.currentErrorNum = 0;
          }
          var errorStr = '';
          if (error) {
              errorMsg = errorMsg + ":" + (error.message || error.stack || error.name);
              errorStr = error.toString();
          }
          console.error && console.error("Mplog: error msg: " + errorMsg + ", error detail: " + errorStr);
          // 可以对内部的错误类型上报
          try {
              if (this.BadJsReport) {
                  var reportInfo = "Mplog: error msg: " + errorMsg + ", error detail: " + errorStr;
                  this.BadJsReport(errorMsg, reportInfo);
              }
          }
          catch (e) { }
          if (isMatchErrorType(errorStr || errorMsg, NoEnoughSpace)) {
              this.clean();
              return;
          }
          if (this.dbStatus === DBStatus.FAILED) {
              this.timer = setInterval(function () {
                  _this.retryDBConnection();
              }, this.retryInterval);
          }
      };
      MPIndexedDB.prototype.retryDBConnection = function () {
          this.currentRetryCount += 1;
          if (this.currentRetryCount > this.maxRetryCount) {
              this.dbStatus = DBStatus.FAILED;
              this.poolHandler.pool = [];
          }
          else {
              this.dbStatus = DBStatus.INITING;
              this.createDB();
          }
          clearInterval(this.timer);
      };
      MPIndexedDB.prototype.init = function () {
          try {
              this.createDB();
          }
          catch (e) {
              console.log('Mplog createDB failed');
          }
      };
      MPIndexedDB.prototype.createDB = function () {
          return __awaiter(this, void 0, void 0, function () {
              var _a, request;
              var _this = this;
              return __generator(this, function (_b) {
                  switch (_b.label) {
                      case 0:
                          if (!this.indexedDB) {
                              this.throwError(ErrorLevel.serious, 'your browser not support IndexedDB.');
                              return [2 /*return*/];
                          }
                          if (this.dbStatus !== DBStatus.INITING) {
                              this.throwError(ErrorLevel.serious, 'indexedDB init error');
                              return [2 /*return*/];
                          }
                          _a = getIfCurrentUsageExceed();
                          if (!_a) return [3 /*break*/, 2];
                          return [4 /*yield*/, getIfCurrentUsageExceed()];
                      case 1:
                          _a = (_b.sent());
                          _b.label = 2;
                      case 2:
                          // 如果数据库超过100MB就什么都不做
                          if (_a) {
                              this.dbStatus = DBStatus.FAILED;
                              this.currentRetryCount = this.maxRetryCount + 1;
                              this.throwError(ErrorLevel.unused, 'the db size is too large');
                              return [2 /*return*/];
                          }
                          else {
                              this.throwError(ErrorLevel.unused, 'the db size is lower than 100MB');
                          }
                          request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
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
                                  _this.dbStatus = DBStatus.FAILED;
                              }
                              _this.throwError(errLvl, 'indexedDB open error', e.target.error);
                          };
                          request.onsuccess = function (e) {
                              if (_this.dbStatus !== DBStatus.INITING) { // 可能onupgradeneeded执行有问题
                                  return;
                              }
                              _this.db = e.target.result;
                              _this.dbStatus = DBStatus.INITED;
                              // 数据库错误
                              _this.db.onerror = function (er) { return _this.throwError(ErrorLevel.serious, 'indexedDB error', er.target.error); };
                              // 其他MPlog对象打开了一个更新版本的数据库，或者数据库被删除时，此数据库链接要关闭
                              _this.db.onversionchange = function (event) {
                                  _this.db.close();
                                  _this.dbStatus = DBStatus.FAILED;
                                  _this.currentRetryCount = _this.maxRetryCount + 1; // 不需要重试了
                                  _this.throwError(ErrorLevel.fatal, 'indexedDB version change', event.target.error);
                              };
                              try {
                                  _this.poolHandler.consume();
                              }
                              catch (e) {
                                  _this.throwError(ErrorLevel.fatal, 'consume pool error', e);
                              }
                              // if (!!this.keep7Days) {
                              //   setTimeout(() => { // 1秒后清理默认store的过期数据
                              //     if (this.dbStatus !== DBStatus.INITED) {
                              //       this.poolHandler.push(() => this.keep(3));
                              //     } else {
                              //       this.keep(3); // 保留3天数据
                              //     }
                              //   }, 1000);
                              // }
                          };
                          request.onblocked = function () {
                              _this.throwError(ErrorLevel.serious, 'indexedDB is blocked');
                          };
                          request.onupgradeneeded = function (e) {
                              _this.db = e.target.result;
                              try {
                                  if (typeof _this.onupgradeneeded === 'function') {
                                      _this.onupgradeneeded(e);
                                  }
                                  else {
                                      if (!_this.db.objectStoreNames.contains(_this.DB_STORE_NAME)) { // 没有store则创建
                                          var objectStore = _this.db.createObjectStore(_this.DB_STORE_NAME, {
                                              autoIncrement: true,
                                          });
                                          objectStore.createIndex('location', 'location', {
                                              unique: false,
                                          });
                                          objectStore.createIndex('level', 'level', {
                                              unique: false,
                                          });
                                          objectStore.createIndex('description', 'description', {
                                              unique: false,
                                          });
                                          objectStore.createIndex('data', 'data', {
                                              unique: false,
                                          });
                                          objectStore.createIndex('timestamp', 'timestamp', {
                                              unique: false,
                                          });
                                      }
                                  }
                              }
                              catch (event) {
                                  _this.dbStatus = DBStatus.FAILED;
                                  _this.throwError(ErrorLevel.fatal, 'indexedDB upgrade error', event);
                              }
                          };
                          return [2 /*return*/];
                  }
              });
          });
      };
      MPIndexedDB.prototype.checkCurrentStorage = function () {
          return __awaiter(this, void 0, void 0, function () {
              return __generator(this, function (_a) {
                  switch (_a.label) {
                      case 0: return [4 /*yield*/, getIfCurrentUsageExceed()];
                      case 1:
                          if (_a.sent()) {
                              this.clean();
                          }
                          return [2 /*return*/];
                  }
              });
          });
      };
      MPIndexedDB.prototype.checkDB = function (event) {
          // 如果系统提示满容，或者超过限制容量清理
          if (event && event.target && event.target.error && event.target.error.name === 'QuotaExceededError') { // 硬盘容量满了，清下日志
              this.clean();
          }
      };
      MPIndexedDB.prototype.getTransaction = function (transactionType) {
          var _this = this;
          var transaction = null;
          if (this.dbStatus === DBStatus.FAILED) {
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
                      _this.checkDB(event);
                  };
              }
          }
          return transaction;
      };
      return MPIndexedDB;
  }());

  /**
   * @author dididong
   * @description 管理增删改查任务
   */
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

  /**
   * @author dididong
   * @description 实际进行日志操作
   */
  var LogController = /** @class */ (function () {
      function LogController(config) {
          this.bufferLog = [];
          // 缓存记录的大小
          this.bufferSize = config && typeof config.bufferSize !== 'undefined' ? config.bufferSize * 1 : 10;
          this.maxLogSize = config && config.maxLogSize ? config.maxLogSize : 3000;
          this.poolHandler = new PoolHandler();
          this.mpIndexedDB = new MPIndexedDB(config, this.poolHandler);
      }
      LogController.prototype.log = function (location, level, description, data) {
          var date = new Date();
          var value = {
              time: formatTime(date),
              location: location,
              level: level,
              description: description,
              data: this.dealLength(this.filterFunction(data)),
              timestamp: date.getTime(),
          };
          this.bufferLog.push(value);
          if (this.bufferLog.length >= this.bufferSize) {
              this.flush();
          }
      };
      LogController.prototype.flush = function () {
          var _this = this;
          if (this.bufferLog.length === 0) {
              return false;
          }
          if (this.mpIndexedDB.dbStatus !== DBStatus.INITED) {
              return this.poolHandler.push(function () { return _this.flush(); });
          }
          this.mpIndexedDB.insertItems(this.bufferLog);
          this.bufferLog = [];
          return 0;
      };
      LogController.prototype.get = function (from, to, dealFun, successCb) {
          var _this = this;
          if (this.mpIndexedDB.dbStatus !== DBStatus.INITED) {
              return this.poolHandler.push(function () { return _this.get(from, to, dealFun, successCb); });
          }
          this.mpIndexedDB.get(from, to, dealFun, successCb);
      };
      LogController.prototype.keep = function (saveDays) {
          var _this = this;
          if (this.mpIndexedDB.dbStatus !== DBStatus.INITED) {
              return this.poolHandler.push(function () { return _this.keep(saveDays); });
          }
          this.mpIndexedDB.keep(saveDays);
      };
      LogController.prototype.dealLength = function (logValue) {
          if (typeof this.maxLogSize === 'number' && typeof logValue === 'string' && logValue.length >= this.maxLogSize) {
              logValue = logValue.substr(0, this.maxLogSize);
          }
          return logValue;
      };
      LogController.prototype.filterFunction = function (obj) {
          var newObj = {};
          try {
              if (typeof obj === 'undefined') {
                  return '';
              }
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
              console.log(e);
          }
      };
      return LogController;
  }());

  /**
   * @author dididong
   * @description 日志处理入口类
   */
  var Mplogd = /** @class */ (function () {
      function Mplogd(config) {
          this.xhrOpen = XMLHttpRequest.prototype.open;
          // xhr 原生 send 方法
          this.xhrSend = XMLHttpRequest.prototype.send;
          this.defaultAjaxFilter = function (ajaxUrl) { return IgnoreCGIName.indexOf(getLocationCGIName(ajaxUrl)) === -1; };
          // 当前页面链接
          this.location = config && config.location ? config.location : window.location.href;
          // 是否自动记录错误信息
          this.autoLogError = config && typeof config.autoLogError !== 'undefined' ? config.autoLogError : false;
          // 是否自动记录promise错误
          this.autoLogRejection = config && typeof config.autoLogRejection !== 'undefined' ? config.autoLogRejection : false;
          // 是否自动记录AJAX请求
          this.autoLogAjax = config && typeof config.autoLogAjax !== 'undefined' ? config.autoLogAjax : false;
          this.logAjaxFilter = config && config.logAjaxFilter ? config.logAjaxFilter : this.defaultAjaxFilter;
          this.logController = new LogController(config);
          this.bindEvent();
      }
      Mplogd.prototype.info = function (description, data) {
          this.logController.log(this.location, LevelEnum.info, description, data);
      };
      Mplogd.prototype.warn = function (description, data) {
          this.logController.log(this.location, LevelEnum.warn, description, data);
      };
      Mplogd.prototype.error = function (description, data) {
          this.logController.log(this.location, LevelEnum.error, description, data);
      };
      /**
       *
       * @param from 开始时间
       * @param to 结束时间
       * @param dealFun 处理最终返回结果的List(可选)
       * @param successCb 处理查询成功的方法(可选)
       */
      Mplogd.prototype.get = function (from, to, dealFun, successCb) {
          this.logController.get(from, to, dealFun, successCb);
      };
      Mplogd.prototype.keep = function (saveDays) {
          this.logController.keep(saveDays);
      };
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
              var that_1 = this; // eslint-disable-line
              var lajaxMethod_1;
              var lajaxUrl_1;
              XMLHttpRequest.prototype.open = function open() {
                  var args = [];
                  for (var _i = 0; _i < arguments.length; _i++) {
                      args[_i] = arguments[_i];
                  }
                  lajaxMethod_1 = args[0];
                  lajaxUrl_1 = resolveUrl(args[1]);
                  that_1.xhrOpen.apply(this, args);
              };
              XMLHttpRequest.prototype.send = function send() {
                  var args = [];
                  for (var _i = 0; _i < arguments.length; _i++) {
                      args[_i] = arguments[_i];
                  }
                  var startTime = new Date().getTime();
                  var ajaxRequestId = +new Date();
                  if ((that_1.logAjaxFilter && that_1.logAjaxFilter(lajaxUrl_1, lajaxMethod_1)) || !that_1.logAjaxFilter) {
                      var requestMsg = "[ajax] id:" + ajaxRequestId + " request " + lajaxUrl_1 + " " + lajaxMethod_1;
                      lajaxMethod_1.toLowerCase() === 'post' ? that_1.info(requestMsg, args[0]) : that_1.info(requestMsg);
                  }
                  // 添加 readystatechange 事件
                  this.addEventListener('readystatechange', function changeEvent() {
                      var infoMsg = '';
                      // 排除掉用户自定义不需要记录日志的 ajax
                      if ((that_1.logAjaxFilter && that_1.logAjaxFilter(lajaxUrl_1, lajaxMethod_1)) || !that_1.logAjaxFilter) {
                          try {
                              if (this.readyState === XMLHttpRequest.DONE) {
                                  var endTime = new Date().getTime();
                                  // 请求耗时
                                  var costTime = (endTime - startTime) / 1000;
                                  that_1.info("[ajax] id:" + ajaxRequestId + " response " + this.status + " " + lajaxUrl_1 + " " + costTime, this.responseText);
                              }
                          }
                          catch (err) {
                              infoMsg = "[ajax] id:" + ajaxRequestId + " response " + this.status + " " + lajaxUrl_1;
                              lajaxMethod_1.toLowerCase() === 'post' ? that_1.error(infoMsg, args[0]) : that_1.error(infoMsg);
                          }
                      }
                  });
                  that_1.xhrSend.apply(this, args);
              };
          }
      };
      Mplogd.prototype.saveUnstoreData = function () {
          var _this = this;
          window.addEventListener('beforeunload', function () {
              try {
                  _this.logController.flush();
              }
              catch (e) {
                  console.log(e);
              }
              return null; // 阻止弹框
          });
      };
      return Mplogd;
  }());

  return Mplogd;

}));
