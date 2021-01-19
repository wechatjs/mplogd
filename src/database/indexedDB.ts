/**
 * @author dididong
 * @description 使用indexedDB进行浏览器端存储
 */
import { MplogConfig, DBStatus, ErrorLevel, STORAGE_MAX_SIZE } from '../util/config';
import { PoolHandler } from '../controller/pool_handler';
import { formatDate } from '../util/util';
import { getIfCurrentUsageExceed, getCurrentUsage} from '../util/db_size';
import { Browser } from '../util/browser';

const TransactionType = {
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
const NoEnoughSpace = [
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

export class MPIndexedDB {
  readonly defaultDbName = 'mplog';

  readonly defaultDbStoreName = 'logs';

  public dbStatus: string = DBStatus.INITING;

  public indexedDB: IDBFactory;

  public BadJsReport: Function | null;

  public onupgradeneeded: Function | null;

  public poolHandler: PoolHandler;

  private DB_NAME: string;

  private DB_STORE_NAME: string;

  private DB_VERSION: number;

  private maxErrorNum: number;

  private currentErrorNum = 0;

  private maxRetryCount = 3;

  private currentRetryCount = 0;

  private db: any;

  private timer: any;

  private retryInterval = 10000;

  private keep7Days: boolean;

  // private isToLarge: boolean;

  private cleaning: boolean;

  constructor(config: MplogConfig, poolHandler: PoolHandler) {
    this.DB_NAME = config && config.dbName ? config.dbName : this.defaultDbName;

    this.DB_STORE_NAME = config && config.dbStoreName ? config.dbStoreName : this.defaultDbStoreName;

    this.DB_VERSION = config && typeof config.dbVersion !== 'undefined' ? config.dbVersion : 1;

    this.indexedDB = window.indexedDB || (window as any).webkitIndexedDB || (window as any).mozIndexedDB
      || (window as any).msIndexedDB;

    this.onupgradeneeded = config && config.onupgradeneeded ? config.onupgradeneeded : null;

    this.maxErrorNum = config && config.maxErrorNum ? config.maxErrorNum : 3;

    this.poolHandler = poolHandler;

    this.keep7Days = config && config.keep7Days ?  config.keep7Days : true;

    this.BadJsReport = config && config.BadJsReport ? config.BadJsReport : null;

    this.init();
  }

  public async insertItems(bufferList: Array<any>) {
    if (await getCurrentUsage() > 2000000000) {
      this.throwError(ErrorLevel.unused, 'larger than 2000MB');
      this.clean();
      return;
    }
    let request;
    const transaction = this.getTransaction(TransactionType.READ_WRITE);
    if (transaction === null) {
      this.throwError(ErrorLevel.fatal, 'transaction is null');
      return false;
    }

    const store = transaction.objectStore(this.DB_STORE_NAME);
    for (const item of bufferList) {
      request = store.put(item);
      request.onsuccess = () => {};

      request.onerror = (e) => {
        this.checkDB(e);
        return this.throwError(ErrorLevel.normal, 'add log failed', (e.target as any).error);
      };
    }
    this.checkCurrentStorage();
  }

  public get(from: Date, to: Date, dealFc?: Function, successCb?: Function): any {
    const transaction = this.getTransaction(TransactionType.READ_WRITE);
    if (transaction === null) {
      this.throwError(ErrorLevel.fatal, 'transaction is null');
      return false;
    }

    let fromTime: number = new Date().getTime();
    let toTime: number = new Date().getTime();

    try {
      fromTime = formatDate(from);
      toTime = formatDate(to);
    } catch (e) {
      this.throwError(ErrorLevel.normal, 'invalid time');
    }
    const store = transaction.objectStore(this.DB_STORE_NAME);
    const results: any = [];

    const keyRange = IDBKeyRange.bound(fromTime, toTime); // from<=timestamp<=to
    const request = store.index('timestamp').openCursor(keyRange);
    if (typeof successCb === 'function') {
      request.onsuccess = (event) => {
        successCb(event);
      };
    } else if (typeof dealFc === 'function') {
      request.onsuccess = (event) => {
        const cursor = (event.target as any).result;
        if (cursor) {
          results.push({
            time: cursor.value.time,
            level: cursor.value.level,
            location: cursor.value.location,
            description: cursor.value.description,
            data: cursor.value.data,
            timestamp: cursor.value.timestamp,
          });
          cursor.continue();
        } else {
          dealFc(results);
        }
      };
    }
    return true;
  }

  public async delete() {
    if (!Browser.isQQBrowser && !Browser.isFireFox) {
      this.dbStatus = DBStatus.FAILED;
      this.currentRetryCount = this.maxRetryCount + 1;
      this.indexedDB.deleteDatabase(this.DB_NAME);
      let reportUinList = [3098987299,3239847736,3551983495,3549047295,3586295061,3006274708,3269640101,3266552330,2395667878,3554976120,3297568903,3223689247,3578378399,3089724247,3545903934,3272891096,3283924473,3270637404,3546480740,3203066997,3580377525,3893104532,3292955980,3925196695,3258438094,2392720325,3573889771,3588801455,3523511770,3208017153,3598934044,3295015455,3553864193,3529838982,3075298111,3556610385,3070904661,3233812476,3083566301,3861549671,3283784527,3932026776,3007617172,3880435175,3885547665,3291578590,3201318251,3865364711,3512983321,3529333012,3070332279,3907160931,3574918287,3275780384,3887160995,3903157214,3297157474,3941145098,3090768813,3088583289,3554902655];
      try {
        let uin = this.DB_NAME.replace('mplog__', '').replace('mpcache__', '');
        if (reportUinList.indexOf(parseInt(uin, 10)) > -1) {
          this.throwError(ErrorLevel.unused, `delete count0 database is ${this.DB_NAME}`);
        }
      } catch(e) {
        console.log(e);
      }
      this.throwError(ErrorLevel.unused, `delete count0 database`);
    }
  }

  public async clean() {
    if (this.cleaning) {
      return;
    }
    // indexeddb中当遇到容量大时不能直接deleteDatabase 或者clearStore涉及到
    const transaction = this.getTransaction(TransactionType.READ_WRITE);
    if (transaction === null) {
      this.throwError(ErrorLevel.fatal, 'transaction is null');
      return;
    }
    try {
      this.throwError(ErrorLevel.unused, 'begin clean database');
      // 删除1/5的数据
      if (transaction === null) {
        this.throwError(ErrorLevel.unused, 'begin clean transaction is none');
      }
      const store = transaction.objectStore(this.DB_STORE_NAME);
      if (!store) {
        this.throwError(ErrorLevel.unused, 'begin clean store is none');
      }
      let beginRequest = store.openCursor();
      beginRequest.onsuccess = (event) => {
        this.throwError(ErrorLevel.unused, 'begin clean cursor opened');
        let result = (event.target as any).result;
        if (!result) {
          this.throwError(ErrorLevel.unused, 'begin clean cursor error no result');
          let errorCount = store.count();
          errorCount.onsuccess = async () => {
            this.throwError(ErrorLevel.unused, `begin clean no result${errorCount.result}`);
            await this.delete();
          };
        }
        if (result && result.primaryKey) {
          this.cleaning = true;
          this.throwError(ErrorLevel.unused, 'begin clean get primary key');
          let first = result.primaryKey;
          let countRequest = store.count();
          countRequest.onsuccess = async () => {
            this.throwError(ErrorLevel.unused, 'begin clean get count');
            let count = countRequest.result;
            if (count < 50) {
              // await this.delete();
              return;
            }
            let endCount = first + Math.ceil(count / 5);
            console.log(first, endCount, '------', count);
            let deleteRequest = store.delete(IDBKeyRange.bound(first, endCount, false, false));
            deleteRequest.onsuccess = () => {
              this.throwError(ErrorLevel.unused, 'clean database success');
              this.cleaning = false;
            };
            deleteRequest.onerror = (e) => {
              this.throwError(ErrorLevel.fatal, 'clean database error', (e.target as any).error);
            };
          };
          countRequest.onerror = (e) => {
            this.throwError(ErrorLevel.fatal, 'clean database error count error', (e.target as any).error);
          };
        }
      };
      beginRequest.onerror = (e) => {
        this.throwError(ErrorLevel.fatal, 'clean database error open cursor error', (e.target as any).error);
      };
    } catch(e) {
      this.throwError(ErrorLevel.unused, 'clean database error', e);
    }
  }

  public keep(saveDays?: number): void {
    const transaction = this.getTransaction(TransactionType.READ_WRITE);
    if (transaction === null) {
      this.throwError(ErrorLevel.fatal, 'transaction is null');
      return;
    }
    if (!saveDays) {
      let store = transaction.objectStore(this.DB_STORE_NAME);
      store.clear().onerror = event => this.throwError(ErrorLevel.serious, 'indexedb_keep_clear', (event.target as any).error);
    } else {
      // 删除过期数据
      try {
        let store = transaction.objectStore(this.DB_STORE_NAME);
        let beginRequest = store.openCursor();
        beginRequest.onsuccess = (event) => {
          let result = (event.target as any).result;
          if (result && result.primaryKey) {
            let first = result.primaryKey;
            let endTime = result.value.timestamp;
            let range = Date.now() - saveDays * 60 * 60 * 24 * 1000;
            let keyRange = IDBKeyRange.lowerBound(range, true);
            if (store.indexNames && store.indexNames.length && store.indexNames.contains('timestamp')) {
              let keepRequest = store.index('timestamp').openKeyCursor(keyRange);
              keepRequest.onsuccess = async (event) => {
                if (event.target && (event.target as any).result) {
                  let end = (event.target as any).result.primaryKey;
                  if (first === end) {
                    if (endTime < range && Browser.isSafari) {
                      await this.delete();
                    }
                    return;
                  }
                  let deleteRequest = store.delete(IDBKeyRange.bound(first, end, false, true));
                  deleteRequest.onsuccess = () => {
                    this.throwError(ErrorLevel.unused, 'keep logs success');
                  };
                  deleteRequest.onerror = (e) => {
                    this.throwError(ErrorLevel.fatal, 'keep logs error', (e.target as any).error);
                  };
                } else {
                  let countRequest = store.count();
                  countRequest.onsuccess = () => {
                    let count = countRequest.result;
                    let endCount = first + count;
                    let deleteRequest = store.delete(IDBKeyRange.bound(first, endCount, false, false));
                    deleteRequest.onsuccess = () => {
                      this.throwError(ErrorLevel.unused, 'keep logs success');
                    };
                    deleteRequest.onerror = (e) => {
                      this.throwError(ErrorLevel.fatal, 'keep logs error', (e.target as any).error);
                    };
                  }
                }
              };
            }
          }
        };
      } catch(e) {
        console.log(e);
      }
    }
  }

  public throwError(errorLevel: number, errorMsg: string, error?: Error) {
    this.currentErrorNum += errorLevel;
    if (this.currentErrorNum >= this.maxErrorNum) {
      this.dbStatus = DBStatus.FAILED;
      this.poolHandler.pool = [];
      this.currentErrorNum = 0;
    }
    let errorStr = '';

    if (error) {
      errorMsg = `${errorMsg}:${error.message || error.stack || error.name}`;
      errorStr = error.toString();
    }
    // console.error && console.error(`Mplog: error msg: ${errorMsg}, error detail: ${errorStr}`);
    // 可以对内部的错误类型上报
    try {
      if (this.BadJsReport) {
        const reportInfo = `Mplog: error msg: ${errorMsg}, error detail: ${errorStr}`;
        this.BadJsReport(errorMsg, reportInfo);
      }
    } catch (e) {}

    if (isMatchErrorType(errorStr || errorMsg, NoEnoughSpace)) {
      this.clean();
      return;
    }

    if (this.dbStatus === DBStatus.FAILED && !this.timer && errorLevel > 0) {
      this.timer = setInterval(() => {
        this.retryDBConnection();
      }, this.retryInterval);
    }
  }

  retryDBConnection() {
    this.currentRetryCount+=1;
    if (this.currentRetryCount > this.maxRetryCount) {
      this.dbStatus = DBStatus.FAILED;
      this.poolHandler.pool = [];
    } else {
      this.dbStatus = DBStatus.INITING;
      this.createDB();
    }
    clearInterval(this.timer);
  }

  private async init() {
    try {
      // 如果数据库超过100MB就什么都不做
      if (await getIfCurrentUsageExceed()) {
        // this.isToLarge = true;
        this.throwError(ErrorLevel.unused, 'this db size is too large');
        let currentStorage = await getCurrentUsage();
        if (currentStorage && currentStorage > 0) {
          currentStorage = Math.ceil((currentStorage as number) / 1000000);
          if (currentStorage > 100 && currentStorage <= 200) {
            this.throwError(ErrorLevel.unused, '100MB - 200MB');
          } else if (currentStorage > 200 && currentStorage <= 300) {
            this.throwError(ErrorLevel.unused, '200MB - 300MB');
          } else if (currentStorage > 300 && currentStorage <= 400) {
            this.throwError(ErrorLevel.unused, '300MB - 400MB');
          } else if (currentStorage > 400 && currentStorage <= 500) {
            this.throwError(ErrorLevel.unused, '400MB - 500MB');
          } else if (currentStorage > 500 && currentStorage <= 600) {
            this.throwError(ErrorLevel.unused, '500MB - 600MB');
          } else if (currentStorage > 600 && currentStorage <= 1000) {
            this.throwError(ErrorLevel.unused, '600MB - 1000MB');
          } else {
            this.throwError(ErrorLevel.unused, 'larger than 1000MB');
          }
        }
      } else {
        this.throwError(ErrorLevel.unused, 'this db size is lower than 100MB');
      }
      this.createDB();
    } catch (e) {
      console.log('Mplog createDB failed');
    }
  }

  private async createDB() {
    if (!this.indexedDB) {
      this.currentRetryCount = this.maxRetryCount + 1;
      this.throwError(ErrorLevel.fatal, 'your browser not support IndexedDB.');
      return;
    }

    if (this.dbStatus !== DBStatus.INITING) {
      this.currentRetryCount = this.maxRetryCount + 1;
      this.throwError(ErrorLevel.fatal, 'indexedDB init error');
      return;
    }

    if ((window && window.navigator && window.navigator.storage) || (window && window.navigator && (window.navigator as any).webkitTemporaryStorage)) {
      this.throwError(ErrorLevel.unused, 'user support storage calculation');
    } else {
      this.throwError(ErrorLevel.unused, 'user does not support storage calculation');
    }

    const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
    request.onerror = (e) => {
      this.checkDB(e);
      let errLvl = ErrorLevel.serious;
      if ((e.target as any).error && (e.target as any).error.name === 'VersionError') { // 打开低版本数据库导致失败
        try {
          const messgae = (e.target as any).error.message;
          const regexp = /The requested version \([0-9]+\) is less than the existing version \([0-9]\)/;
          const isVersionLowError =  messgae.search(regexp);
          if (isVersionLowError > -1) {
            const existVersion = messgae.match(/[0-9]+/ig)[1];
            if (existVersion > this.DB_VERSION) {
              this.DB_VERSION = existVersion;
            }
          }
        } catch (e) {
          console.log(e);
        }
        errLvl = ErrorLevel.fatal; // 致命错误
        this.dbStatus = DBStatus.FAILED;
      }
      this.throwError(errLvl, 'indexedDB open error', (e.target as any).error);
    };

    request.onsuccess = (e) => {
      if (this.dbStatus !== DBStatus.INITING) { // 可能onupgradeneeded执行有问题
        return;
      }
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.db = (e.target as any).result;
      this.dbStatus = DBStatus.INITED;
      // 数据库错误
      this.db.onerror = (er: any) => this.throwError(ErrorLevel.serious, 'indexedDB error', er.target.error);
      // 其他MPlog对象打开了一个更新版本的数据库，或者数据库被删除时，此数据库链接要关闭
      this.db.onversionchange = (event: any) => {
        this.db.close();
        this.dbStatus = DBStatus.FAILED;
        this.currentRetryCount = this.maxRetryCount + 1; // 不需要重试了
        this.throwError(ErrorLevel.fatal, 'indexedDB version change', event.target.error);
      };
      try {
        this.poolHandler.consume();
      } catch (e) {
        this.throwError(ErrorLevel.fatal, 'consume pool error', e);
      }
      // if (this.isToLarge) {
      //   this.clean();
      //   return;
      // }
      if (!!this.keep7Days) {
        setTimeout(() => { // 1秒后清理默认store的过期数据
          if (this.dbStatus !== DBStatus.INITED) {
            this.poolHandler.push(() => this.keep(7));
          } else {
            this.keep(7); // 保留3天数据
          }
        }, 1000);
      }
    };

    request.onblocked = () => {
      this.throwError(ErrorLevel.serious, 'indexedDB is blocked');
    };

    request.onupgradeneeded = (e: any) => {
      this.db = e.target.result;
      try {
        if (typeof this.onupgradeneeded === 'function') {
          this.onupgradeneeded(e);
        } else {
          if (!this.db.objectStoreNames.contains(this.DB_STORE_NAME)) { // 没有store则创建
            const objectStore = this.db.createObjectStore(this.DB_STORE_NAME, {
              autoIncrement: true,
            });
            objectStore.createIndex('timestamp', 'timestamp', {
              unique: false,
            });
          }
        }
      } catch (event) {
        this.dbStatus = DBStatus.FAILED;
        this.throwError(ErrorLevel.fatal, 'indexedDB upgrade error', event);
      }
    };
  }

  private async checkCurrentStorage() {
    if (await getIfCurrentUsageExceed(STORAGE_MAX_SIZE)) {
      this.clean();
      return true;
    }; 
    return false;
  }

  private checkDB(event: any): void {
    // 如果系统提示满容，或者超过限制容量清理
    if (event && event.target && event.target.error && event.target.error.name === 'QuotaExceededError') { // 硬盘容量满了，清下日志
      this.clean();
    }
  }

  private getTransaction(transactionType: string): (IDBTransaction | null) {
    let transaction: IDBTransaction | null = null;
    if (this.dbStatus === DBStatus.FAILED) {
      transaction = null;
    } else {
      try {
        transaction = this.db.transaction(this.DB_STORE_NAME, transactionType);
      } catch (e) {
        transaction = null;
      }

      if (transaction) {
        transaction.onerror = (event) => {
          event.stopPropagation();
          return this.throwError(ErrorLevel.fatal, 'transaction is error');
        };

        transaction.onabort = (event) => {
          event.stopPropagation();
          this.checkDB(event);
        };
      }
    }
    return transaction;
  }
}
