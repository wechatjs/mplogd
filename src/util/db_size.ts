/**
 * 获得当前indexeddb使用容量
 */
import { MAX_LOG_SIZE } from '../util/config';

export async function getIfCurrentUsageExceed() {
  try {
    if (window.navigator && window.navigator.storage && (<any>window.navigator).storage.estimate) {
      return window.navigator.storage.estimate().then(({ quota, usage}) => {
        return usage >= quota || usage >= MAX_LOG_SIZE;
      });  
    } else if (window.navigator && (<any>window.navigator).webkitTemporaryStorage && (<any>window.navigator).webkitTemporaryStorage.queryUsageAndQuota) {
      return (<any>window.navigator).webkitTemporaryStorage.queryUsageAndQuota(
        (usedBytes, grantedBytes) => {
          return usedBytes > grantedBytes ||  usedBytes >= MAX_LOG_SIZE;
        }
      )
    } else {
      return false;
    }
  } catch (e) {
    return false;
  }
}
