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
  var MAX_LOG_SIZE = 100000000; // 100MB
  var STORAGE_MAX_SIZE = 50000000; // 50MB

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
      if (maxLogSize === void 0) { maxLogSize = MAX_LOG_SIZE; }
      return __awaiter(this, void 0, void 0, function () {
          return __generator(this, function (_a) {
              try {
                  if (window.navigator && window.navigator.storage && window.navigator.storage.estimate) {
                      return [2 /*return*/, window.navigator.storage.estimate().then(function (_a) {
                              var quota = _a.quota, usage = _a.usage;
                              return usage >= quota || usage >= maxLogSize;
                          })];
                  }
                  else if (window.navigator && window.navigator.webkitTemporaryStorage
                      && window.navigator.webkitTemporaryStorage.queryUsageAndQuota) {
                      return [2 /*return*/, new Promise(function (resolve) {
                              window.navigator.webkitTemporaryStorage
                                  .queryUsageAndQuota(function (usedBytes, grantedBytes) {
                                  resolve(usedBytes > grantedBytes || usedBytes >= maxLogSize);
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
  function getCurrentUsage() {
      return __awaiter(this, void 0, void 0, function () {
          return __generator(this, function (_a) {
              try {
                  if (window.navigator && window.navigator.storage && window.navigator.storage.estimate) {
                      return [2 /*return*/, window.navigator.storage.estimate().then(function (_a) {
                              var usage = _a.usage;
                              return usage;
                          })];
                  }
                  else if (window.navigator && window.navigator.webkitTemporaryStorage
                      && window.navigator.webkitTemporaryStorage.queryUsageAndQuota) {
                      return [2 /*return*/, new Promise(function (resolve) {
                              window.navigator.webkitTemporaryStorage
                                  .queryUsageAndQuota(function (usedBytes) {
                                  resolve(usedBytes);
                              });
                          })];
                  }
                  return [2 /*return*/, 0];
              }
              catch (e) {
                  return [2 /*return*/, 0];
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
          this.retryInterval = 10000;
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
          return __awaiter(this, void 0, void 0, function () {
              var request, transaction, store, _i, bufferList_1, item;
              var _this = this;
              return __generator(this, function (_a) {
                  switch (_a.label) {
                      case 0: return [4 /*yield*/, this.checkCurrentStorage()];
                      case 1:
                          if (_a.sent()) {
                              return [2 /*return*/];
                          }
                          transaction = this.getTransaction(TransactionType.READ_WRITE);
                          if (transaction === null) {
                              this.throwError(ErrorLevel.fatal, 'transaction is null');
                              return [2 /*return*/, false];
                          }
                          store = transaction.objectStore(this.DB_STORE_NAME);
                          for (_i = 0, bufferList_1 = bufferList; _i < bufferList_1.length; _i++) {
                              item = bufferList_1[_i];
                              request = store.put(item);
                              request.onsuccess = function () { };
                              request.onerror = function (e) {
                                  _this.checkDB(e);
                                  return _this.throwError(ErrorLevel.normal, 'add log failed', e.target.error);
                              };
                          }
                          return [2 /*return*/];
                  }
              });
          });
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
          // indexeddb中当遇到容量大时不能直接deleteDatabase 或者clearStore涉及到
          var transaction = this.getTransaction(TransactionType.READ_WRITE);
          if (transaction === null) {
              this.throwError(ErrorLevel.fatal, 'transaction is null');
              return;
          }
          try {
              this.dbStatus = DBStatus.FAILED;
              this.currentRetryCount = this.maxRetryCount + 1;
              this.throwError(ErrorLevel.unused, 'begin clean database');
              // 删除1/3的数据
              if (transaction === null) {
                  this.throwError(ErrorLevel.unused, 'begin clean transaction is none');
              }
              var store_1 = transaction.objectStore(this.DB_STORE_NAME);
              if (!store_1) {
                  this.throwError(ErrorLevel.unused, 'begin clean store is none');
              }
              var beginRequest = store_1.openCursor();
              beginRequest.onsuccess = function (event) {
                  _this.throwError(ErrorLevel.unused, 'begin clean cursor opened');
                  var result = event.target.result;
                  if (!result) {
                      _this.throwError(ErrorLevel.unused, 'begin clean cursor error no result');
                      var errorCount_1 = store_1.count();
                      errorCount_1.onsuccess = function () {
                          _this.throwError(ErrorLevel.unused, "begin clean no result" + errorCount_1.result);
                      };
                  }
                  if (result && !result.primaryKey) {
                      _this.throwError(ErrorLevel.unused, 'begin clean cursor error no primarykey', result.key);
                  }
                  if (result && result.primaryKey) {
                      _this.throwError(ErrorLevel.unused, 'begin clean get primary key');
                      var first_1 = result.primaryKey;
                      var countRequest_1 = store_1.count();
                      countRequest_1.onsuccess = function () {
                          _this.throwError(ErrorLevel.unused, 'begin clean get count');
                          var count = countRequest_1.result;
                          var endCount = first_1 + Math.ceil(count / 3);
                          var deleteRequest = store_1["delete"](IDBKeyRange.bound(first_1, endCount, false, false));
                          deleteRequest.onsuccess = function () {
                              _this.throwError(ErrorLevel.unused, 'clean database success');
                          };
                          deleteRequest.onerror = function (e) {
                              _this.throwError(ErrorLevel.fatal, 'clean database error', e.target.error);
                          };
                      };
                      countRequest_1.onerror = function (e) {
                          _this.throwError(ErrorLevel.fatal, 'clean database error count error', e.target.error);
                      };
                  }
              };
              beginRequest.onerror = function (e) {
                  _this.throwError(ErrorLevel.fatal, 'clean database error open cursor error', e.target.error);
              };
          }
          catch (e) {
              this.throwError(ErrorLevel.unused, 'clean database error', e);
          }
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
              var store_2 = transaction.objectStore(this.DB_STORE_NAME);
              var beginRequest = store_2.openCursor();
              beginRequest.onsuccess = function (event) {
                  var result = event.target.result;
                  if (result && result.primaryKey) {
                      var first_2 = result.primaryKey;
                      var range = Date.now() - saveDays * 60 * 60 * 24 * 1000;
                      var keyRange = IDBKeyRange.lowerBound(range);
                      if (store_2.indexNames && store_2.indexNames.length && store_2.indexNames.contains('timestamp')) {
                          var keepRequest = store_2.index('timestamp').openKeyCursor(keyRange);
                          keepRequest.onsuccess = function (event) {
                              if (event.target && event.target.result) {
                                  var end = event.target.result.primaryKey;
                                  var deleteRequest = store_2["delete"](IDBKeyRange.bound(first_2, end, false, false));
                                  deleteRequest.onsuccess = function () {
                                      _this.throwError(ErrorLevel.unused, 'keep logs success');
                                  };
                                  deleteRequest.onerror = function (e) {
                                      _this.throwError(ErrorLevel.fatal, 'keep logs error', e.target.error);
                                  };
                              }
                              else {
                                  var countRequest_2 = store_2.count();
                                  countRequest_2.onsuccess = function () {
                                      var count = countRequest_2.result;
                                      var endCount = first_2 + count;
                                      var deleteRequest = store_2["delete"](IDBKeyRange.bound(first_2, endCount, false, false));
                                      deleteRequest.onsuccess = function () {
                                          _this.throwError(ErrorLevel.unused, 'keep logs success');
                                      };
                                      deleteRequest.onerror = function (e) {
                                          _this.throwError(ErrorLevel.fatal, 'keep logs error', e.target.error);
                                      };
                                  };
                              }
                          };
                      }
                  }
              };
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
          if (this.dbStatus === DBStatus.FAILED && !this.timer && errorLevel > 0) {
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
          return __awaiter(this, void 0, void 0, function () {
              var currentStorage, e_1;
              return __generator(this, function (_a) {
                  switch (_a.label) {
                      case 0:
                          _a.trys.push([0, 5, , 6]);
                          return [4 /*yield*/, getIfCurrentUsageExceed()];
                      case 1:
                          if (!_a.sent()) return [3 /*break*/, 3];
                          this.isToLarge = true;
                          this.throwError(ErrorLevel.unused, 'this db size is too large');
                          return [4 /*yield*/, getCurrentUsage()];
                      case 2:
                          currentStorage = _a.sent();
                          if (currentStorage && currentStorage > 0) {
                              currentStorage = Math.ceil(currentStorage / 1000000);
                              if (currentStorage > 100 && currentStorage <= 200) {
                                  this.throwError(ErrorLevel.unused, '100MB - 200MB');
                              }
                              else if (currentStorage > 200 && currentStorage <= 300) {
                                  this.throwError(ErrorLevel.unused, '200MB - 300MB');
                              }
                              else if (currentStorage > 300 && currentStorage <= 400) {
                                  this.throwError(ErrorLevel.unused, '300MB - 400MB');
                              }
                              else if (currentStorage > 400 && currentStorage <= 500) {
                                  this.throwError(ErrorLevel.unused, '400MB - 500MB');
                              }
                              else if (currentStorage > 500 && currentStorage <= 600) {
                                  this.throwError(ErrorLevel.unused, '500MB - 600MB');
                              }
                              else if (currentStorage > 600 && currentStorage <= 1000) {
                                  this.throwError(ErrorLevel.unused, '600MB - 1000MB');
                              }
                              else {
                                  this.throwError(ErrorLevel.unused, 'larger than 1000MB');
                              }
                          }
                          return [3 /*break*/, 4];
                      case 3:
                          this.throwError(ErrorLevel.unused, 'this db size is lower than 100MB');
                          _a.label = 4;
                      case 4:
                          this.createDB();
                          return [3 /*break*/, 6];
                      case 5:
                          e_1 = _a.sent();
                          console.log('Mplog createDB failed');
                          return [3 /*break*/, 6];
                      case 6: return [2 /*return*/];
                  }
              });
          });
      };
      MPIndexedDB.prototype.createDB = function () {
          return __awaiter(this, void 0, void 0, function () {
              var request;
              var _this = this;
              return __generator(this, function (_a) {
                  if (!this.indexedDB) {
                      this.currentRetryCount = this.maxRetryCount + 1;
                      this.throwError(ErrorLevel.fatal, 'your browser not support IndexedDB.');
                      return [2 /*return*/];
                  }
                  if (this.dbStatus !== DBStatus.INITING) {
                      this.currentRetryCount = this.maxRetryCount + 1;
                      this.throwError(ErrorLevel.fatal, 'indexedDB init error');
                      return [2 /*return*/];
                  }
                  if ((window && window.navigator && window.navigator.storage) || (window && window.navigator && window.navigator.webkitTemporaryStorage)) {
                      this.throwError(ErrorLevel.unused, 'user support storage calculation');
                  }
                  else {
                      this.throwError(ErrorLevel.unused, 'user does not support storage calculation');
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
                      if (_this.timer) {
                          clearInterval(_this.timer);
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
                      if (_this.isToLarge) {
                          _this.clean();
                          return;
                      }
                      if (!!_this.keep7Days) {
                          setTimeout(function () {
                              if (_this.dbStatus !== DBStatus.INITED) {
                                  _this.poolHandler.push(function () { return _this.keep(7); });
                              }
                              else {
                                  _this.keep(7); // 保留3天数据
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
                          if (typeof _this.onupgradeneeded === 'function') {
                              _this.onupgradeneeded(e);
                          }
                          else {
                              if (!_this.db.objectStoreNames.contains(_this.DB_STORE_NAME)) { // 没有store则创建
                                  var objectStore = _this.db.createObjectStore(_this.DB_STORE_NAME, {
                                      autoIncrement: true,
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
              });
          });
      };
      MPIndexedDB.prototype.checkCurrentStorage = function () {
          return __awaiter(this, void 0, void 0, function () {
              return __generator(this, function (_a) {
                  switch (_a.label) {
                      case 0: return [4 /*yield*/, getIfCurrentUsageExceed(STORAGE_MAX_SIZE)];
                      case 1:
                          if (_a.sent()) {
                              this.clean();
                              return [2 /*return*/, true];
                          }
                          return [2 /*return*/, false];
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
          this.poolSize = 20;
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
          this.reportFunction = config && config.reportFunction;
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
              this.flush(this.bufferLog);
              this.bufferLog = [];
          }
      };
      LogController.prototype.flush = function (items) {
          var _this = this;
          if (items === void 0) { items = this.bufferLog; }
          if (!items || items.length === 0) {
              return false;
          }
          if (this.reportFunction) {
              this.reportFunction(items);
          }
          if (this.mpIndexedDB.dbStatus !== DBStatus.INITED) {
              return this.poolHandler.push(function () { return _this.flush(items); });
          }
          this.mpIndexedDB.insertItems(items);
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
          // 只记录string | number | boolean 类型
          try {
              if (typeof obj === 'number' || typeof obj === 'boolean') {
                  return '' + obj;
              }
              else if (typeof obj === 'string') {
                  return obj;
              }
              return '';
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
              var ajaxMethod_1;
              var ajaxUrl_1;
              XMLHttpRequest.prototype.open = function open() {
                  var args = [];
                  for (var _i = 0; _i < arguments.length; _i++) {
                      args[_i] = arguments[_i];
                  }
                  ajaxMethod_1 = args[0];
                  ajaxUrl_1 = resolveUrl(args[1]);
                  that_1.xhrOpen.apply(this, args);
              };
              XMLHttpRequest.prototype.send = function send() {
                  var args = [];
                  for (var _i = 0; _i < arguments.length; _i++) {
                      args[_i] = arguments[_i];
                  }
                  var startTime = new Date().getTime();
                  var ajaxRequestId = +new Date();
                  var url = ajaxUrl_1;
                  var method = ajaxMethod_1;
                  if ((that_1.logAjaxFilter && that_1.logAjaxFilter(ajaxUrl_1, ajaxMethod_1)) || !that_1.logAjaxFilter) {
                      var requestMsg = "[ajax] id:" + ajaxRequestId + " request " + ajaxUrl_1 + " " + ajaxMethod_1;
                      ajaxMethod_1.toLowerCase() === 'post' ? that_1.info(requestMsg, args[0]) : that_1.info(requestMsg);
                  }
                  // 添加 readystatechange 事件
                  this.addEventListener('readystatechange', function changeEvent() {
                      var infoMsg = '';
                      // 排除掉用户自定义不需要记录日志的 ajax
                      if ((that_1.logAjaxFilter && that_1.logAjaxFilter(url, method)) || !that_1.logAjaxFilter) {
                          try {
                              if (this.readyState === XMLHttpRequest.DONE) {
                                  var endTime = new Date().getTime();
                                  // 请求耗时
                                  var costTime = (endTime - startTime) / 1000;
                                  that_1.info("[ajax] id:" + ajaxRequestId + " response " + this.status + " " + url + " " + costTime, this.responseText);
                              }
                          }
                          catch (err) {
                              infoMsg = "[ajax] id:" + ajaxRequestId + " response " + this.status + " " + url;
                              ajaxMethod_1.toLowerCase() === 'post' ? that_1.error(infoMsg, args[0]) : that_1.error(infoMsg);
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
