/**
 * 获得当前indexeddb使用容量
 */
import { MAX_LOG_SIZE } from '../util/config';

export async function getIfCurrentUsageExceed(maxLogSize = MAX_LOG_SIZE) {
  try {
    if (window.navigator && window.navigator.storage && (window.navigator as any).storage.estimate) {
      return window.navigator.storage.estimate().then(({ quota, usage }) => usage >= quota || usage >= MAX_LOG_SIZE);
    } else if (window.navigator && (window.navigator as any).webkitTemporaryStorage
      && (window.navigator as any).webkitTemporaryStorage.queryUsageAndQuota) {
      return new Promise((resolve) => {
        (window.navigator as any).webkitTemporaryStorage
        .queryUsageAndQuota((usedBytes, grantedBytes) => {
         resolve(usedBytes > grantedBytes ||  usedBytes >= MAX_LOG_SIZE)
        });
      })
    }
    return false;
  } catch (e) {
    return false;
  }
}
