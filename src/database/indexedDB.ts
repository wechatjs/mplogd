/**
 * @author dididong
 * @description 使用indexedDB进行浏览器端存储
 */
import { MplogConfig, DB_Status, ErrorLevel} from '../util/config';
import { PoolHandler } from '../controller/pool_handler';
import { formatDate } from '../util/util';

const TransactionType = {
  /**
   * 支持读写
   */
  'READ_WRITE': 'readwrite',
  /**
   * 只支持读
   */
  'READ_ONLY': 'readonly'
};

export class MPIndexedDB {
  readonly defaultDbName = `mplog`;

  readonly defaultDbStoreName = 'logs';

  private DB_NAME: string; 

  private DB_STORE_NAME: string;

  private DB_VERSION: number;

  public dbStatus: string = DB_Status.INITING;

  public indexedDB: IDBFactory;

  private maxErrorNum : number;

  private currentErrorNum = 0;

  private maxRetryCount = 3;

  private currentRetryCount = 0;

  private db: any;

  public onupgradeneeded: Function | null;

  private timer: any;

  private retryInterval = 6000;
  
  private poolHandler: PoolHandler;

  constructor(config: MplogConfig, poolHandler: PoolHandler) {
    this.DB_NAME = config && config.dbName ? config.dbName : this.defaultDbName;

    this.DB_STORE_NAME = config && config.dbStoreName ? config.dbStoreName : this.defaultDbStoreName; 

    this.DB_VERSION = config && typeof config.dbVersion !== 'undefined' ? config.dbVersion : 1;

    this.indexedDB = window.indexedDB || (window as any).webkitIndexedDB || (window as any).mozIndexedDB || (window as any).msIndexedDB;
    
    this.onupgradeneeded = config && config.onupgradeneeded ? config.onupgradeneeded : null;

    this.maxErrorNum = config && config.maxErrorNum ? config.maxErrorNum : 3;
    
    this.poolHandler = poolHandler;

    this.init();
  }

  private init(): void {
    try {
      this.createDB();
    } catch (e) {
      console.log('Mplog createDB failed');
    }
  }

  private createDB(): void {
    if (!this.indexedDB) {
      this.throwError(ErrorLevel.serious, 'your browser not support IndexedDB.');
      return;
    }

    if (this.dbStatus !== DB_Status.INITING) {
      this.throwError(ErrorLevel.serious, 'indexedDB init error');
      return;
    }

    const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
    request.onerror = e => {
      this.checkDB(e);
      let errLvl = ErrorLevel.serious;
      if ((<any> e.target).error && (<any> e.target).error.name === 'VersionError') { // 打开低版本数据库导致失败
        try {
          let messgae = (<any>e.target).error.message;
          let regexp = /The requested version \([0-9]+\) is less than the existing version \([0-9]\)/;
          let isVersionLowError =  messgae.search(regexp);
          if (isVersionLowError > -1) {
            let existVersion = messgae.match(/[0-9]+/ig)[1];
            if (existVersion > this.DB_VERSION) {
              this.DB_VERSION = existVersion;
            }
          }
        } catch(e) {
          console.log(e);
        } 
        errLvl = ErrorLevel.fatal; // 致命错误
        this.dbStatus = DB_Status.FAILED;
      }
      this.throwError(errLvl, 'indexedDB open error, message:', (<any>e.target).error);
    }

    request.onsuccess = e => {
      if (this.dbStatus !== DB_Status.INITING) { // 可能onupgradeneeded执行有问题
        return;
      }
      this.db = (<any>e.target).result;
      this.dbStatus = DB_Status.INITED;
      // 数据库错误
      this.db.onerror = (er : any) => this.throwError(ErrorLevel.serious, 'indexedDB error', er.target.error);
      // 其他MPlog对象打开了一个更新版本的数据库，或者数据库被删除时，此数据库链接要关闭
      this.db.onversionchange = (event: any) => {
        this.db.close();
        this.dbStatus = DB_Status.FAILED;
        this.currentRetryCount = this.maxRetryCount + 1; // 不需要重试了
        this.throwError(ErrorLevel.fatal, 'indexedDB version change, message:', event.target.error);
      };

      try {
        this.poolHandler.consume();
      } catch(e) {
        this.throwError(ErrorLevel.fatal, 'consume pool error', e);
      }
      
      setTimeout(() => { // 1秒后清理默认store的过期数据
        if (this.dbStatus !== DB_Status.INITED) {
          this.poolHandler.push(() => {
            return this.keep(7)
          });
        } else {
          this.keep(7); // 保留7天数据
        }
      }, 1000);
    };

    request.onblocked = () => {
      this.throwError(ErrorLevel.serious, 'indexedDB is blocked');
    };

    request.onupgradeneeded = (e: any) => {
      this.db = e.target.result;
      try {
        if (!this.db.objectStoreNames.contains(this.DB_STORE_NAME)) { // 没有store则创建
          const objectStore = this.db.createObjectStore(this.DB_STORE_NAME, {
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

        if (typeof this.onupgradeneeded === 'function') {
          this.onupgradeneeded(e);
        }
      } catch (event) {
        this.dbStatus = DB_Status.FAILED;
        this.throwError(ErrorLevel.fatal, 'indexedDB upgrade error', event);
      }
    }
  }

  private checkDB(event: any): void {
    if (event && event.target && event.target.error && event.target.error.name === 'QuotaExceededError') { // 硬盘容量满了，清下日志
      this.clean();
    }
  }

  private getTransaction(transactionType: string): (IDBTransaction | null) {
    let transaction: IDBTransaction | null = null;
    
    if (this.dbStatus === DB_Status.FAILED) {
      transaction = null;
    } else {
      try {
        transaction = this.db.transaction(this.DB_STORE_NAME, transactionType);
      } catch (e) {
        transaction = null;
      }

      if (transaction) {
        transaction.onerror = event => {
          event.stopPropagation();
          return this.throwError(ErrorLevel.fatal, 'transaction is error');
        };

        transaction.onabort = event => {
          event.stopPropagation();
          if ((<any>event.target).error && (<any>event.target).error.name === 'QuotaExceededError') {
            this.clean();
          }
        };
      }
    }
    return transaction;
  }

  public insertItems(bufferList: Array<any>): any {
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
        return this.throwError(ErrorLevel.normal, 'add log failed', (<any>e.target).error);
      };
    }
  }

  public get(from: Date, to: Date, dealFc: Function): any {
    const transaction = this.getTransaction(TransactionType.READ_ONLY);
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
    request.onsuccess = event => {
      const cursor = (<any>event.target).result;
      if (cursor) {
        results.push({
          time: cursor.value.time,
          level: cursor.value.level,
          location: cursor.value.location,
          description: cursor.value.description,
          data: cursor.value.data,
          timestamp: cursor.value.timestamp
        });
        cursor.continue();
      } else {
        dealFc(results);
      }
    };
    return true;
  }

  public clean(): void {
    this.db && this.db.close();
    const request = this.indexedDB.deleteDatabase(this.DB_NAME);
    request.onerror = (event) => {
      this.throwError(ErrorLevel.serious, 'clean database failed', (<any>event.target).error);
    };
    request.onsuccess = () => {
      this.dbStatus = DB_Status.FAILED;
    };
  }

  public keep(saveDays: number): void {
    const transaction = this.getTransaction(TransactionType.READ_WRITE);
    if (transaction === null) {
      this.throwError(ErrorLevel.fatal, 'transaction is null');
      return;
    }
    const store = transaction.objectStore(this.DB_STORE_NAME);
    if (!saveDays) {
      store.clear().onerror = event => {
        return this.throwError(ErrorLevel.serious, 'indexedb_keep_clear', (<any>event.target).error);
      };
    } else {
      // 删除过期数据
      const range = Date.now() - saveDays * 60 * 60 * 24 * 1000;
      const keyRange = IDBKeyRange.upperBound(range); // timestamp<=range，证明过期
      const request = store.index('timestamp').openCursor(keyRange);
      request.onsuccess = event => {
        const cursor = (<any>event.target).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      request.onerror = event => {
        return this.throwError(ErrorLevel.normal, 'keep logs error',(<any>event.target).error);
      };
    }
  }

  public throwError(errorLevel: number, errorMsg: string, error?: Error) {
    this.currentErrorNum += errorLevel;
    if (this.currentErrorNum >= this.maxErrorNum) {
      this.dbStatus = DB_Status.FAILED;
      this.poolHandler.pool = [];
      this.currentErrorNum = 0;
    }
    let errorStr = '';

    if (error) {
      errorMsg = errorMsg + ':' + (error.message || error.stack || error.name);
      errorStr = error.toString();
    }

    console.error && console.error(`Mplog: error msg: ${errorMsg}, error detail: ${errorStr}`);
    if (this.dbStatus === DB_Status.FAILED) {
      this.timer = setInterval(() => {
        this.retryDBConnection();
      }, this.retryInterval);
    }
  } 

  retryDBConnection() {
    this.currentRetryCount++;
    if (this.currentRetryCount > this.maxRetryCount) {
      this.dbStatus = DB_Status.FAILED;
      this.poolHandler.pool = [];
    } else {
      this.dbStatus = DB_Status.INITING;
      this.createDB();
    }
    clearInterval(this.timer);
  }
}