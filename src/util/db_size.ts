/**
 * 获得当前indexeddb使用容量
 */
import { MAX_LOG_SIZE } from '../util/config';

export async function getIfCurrentUsageExceed() {
  if (window.navigator && window.navigator.storage && (<any>window.navigator).storage.estimate) {
    return window.navigator.storage.estimate().then(({ quota, usage}) => {
      return usage >= quota || usage >= MAX_LOG_SIZE;
    }).catch(() => {
      return false;
    });  
  } else if (window.navigator && (<any>window.navigator).webkitTemporaryStorage && (<any>window.navigator).webkitTemporaryStorage.queryUsageAndQuota) {
    return (<any>window.navigator).webkitTemporaryStorage.queryUsageAndQuota(
      (usedBytes, grantedBytes) => {
        return usedBytes > grantedBytes ||  usedBytes >= MAX_LOG_SIZE;
      }
    ).catch(() => {
      return false;
    });
  } else {
    return false;
  }
}
