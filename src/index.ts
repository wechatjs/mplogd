/**
 * @author dididong
 * @description 日志处理入口类
 */
import { LogController } from './controller/log_controller';
import { MplogConfig, LevelEnum, IgnoreCGIName } from './util/config';
import * as Util  from './util/util';

export default class Mplogd {
  private logController: LogController;

  private location: string;

  private xhrOpen = XMLHttpRequest.prototype.open;
  // xhr 原生 send 方法
  private xhrSend = XMLHttpRequest.prototype.send;

  private autoLogError: boolean;

  private autoLogRejection: boolean;

  private autoLogAjax: boolean;

  private logAjaxFilter: Function | null;

  constructor(config: MplogConfig) {
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

  public info(description?: string, data?: any): void {
    this.logController.log(this.location, LevelEnum.info, description, data);
  }

  public warn(description?: string, data?: any): void {
    this.logController.log(this.location, LevelEnum.warn, description, data);
  }

  public error(description?: string, data?: any): void {
    this.logController.log(this.location, LevelEnum.error, description, data);
  }

  /**
   *
   * @param from 开始时间
   * @param to 结束时间
   * @param dealFun 处理最终返回结果的List(可选)
   * @param successCb 处理查询成功的方法(可选)
   */
  public get(from: Date, to: Date, dealFun?: Function, successCb?: Function): any {
    this.logController.get(from, to, dealFun, successCb);
  }

  public keep(saveDays: number) {
    this.logController.keep(saveDays);
  }

  private defaultAjaxFilter = ajaxUrl => IgnoreCGIName.indexOf(Util.getLocationCGIName(ajaxUrl)) === -1;

  private bindEvent(): void {
    // 页面错误
    if (this.autoLogError) {
      window.addEventListener('error', (err) => {
        this.error(`[OnError]: ${err.message}`, `(${err.lineno}_("行")${err.colno}_("列"))`);
      });
    }
    // promise请求被reject
    if (this.autoLogRejection) {
      window.addEventListener('unhandledrejection', (err) => {
        this.error('[OnRejection]:', err.reason);
      });
    }

    this.ajaxHanler();

    this.saveUnstoreData();
  }

  private ajaxHanler(): void {
    if (this.autoLogAjax) {
      const that = this; // eslint-disable-line
      let ajaxMethod: string;
      let ajaxUrl: string;

      XMLHttpRequest.prototype.open = function open(...args: any) {
        ajaxMethod = args[0];
        ajaxUrl = Util.resolveUrl(args[1]);
        that.xhrOpen.apply(this, args);
      };

      XMLHttpRequest.prototype.send = function send(...args) {
        const startTime: number = new Date().getTime();
        const ajaxRequestId = +new Date();
        const url = ajaxUrl;
        const method = ajaxMethod;
        if ((that.logAjaxFilter && that.logAjaxFilter(ajaxUrl, ajaxMethod)) || !that.logAjaxFilter) {
          const requestMsg = `[ajax] id:${ajaxRequestId} request ${ajaxUrl} ${ajaxMethod}`;
          ajaxMethod.toLowerCase() === 'post' ? that.info(requestMsg, args[0]) : that.info(requestMsg);
        }

        // 添加 readystatechange 事件
        this.addEventListener('readystatechange', function changeEvent() {
          let infoMsg = '';
          // 排除掉用户自定义不需要记录日志的 ajax
          if ((that.logAjaxFilter && that.logAjaxFilter(url, method)) || !that.logAjaxFilter) {
            try {
              if (this.readyState === XMLHttpRequest.DONE) {
                const endTime: number = new Date().getTime();
                // 请求耗时
                const costTime = (endTime - startTime) / 1000;
                that.info(`[ajax] id:${ajaxRequestId} response ${this.status} ${url} ${costTime}`, this.responseText);
              }
            } catch (err) {
              infoMsg = `[ajax] id:${ajaxRequestId} response ${this.status} ${url}`;
              ajaxMethod.toLowerCase() === 'post' ? that.error(infoMsg, args[0]) : that.error(infoMsg);
            }
          }
        });
        that.xhrSend.apply(this, args);
      };
    }
  }

  private saveUnstoreData(): void {
    window.addEventListener('beforeunload', () => {
      try {
        this.logController.flush();
      } catch (e) {
        console.log(e);
      }
      return null; // 阻止弹框
    });
  }
}
