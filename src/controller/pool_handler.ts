/**
 * @author dididong
 * @description 管理增删改查任务
 */
export class PoolHandler {
  private poolSize = 100;

  public pool: Array<any> = [];

  public push(action: any): void {
    if (this.pool.length < this.poolSize) {
      this.pool.push(action);
    }
  }

  public consume(): void {
    let handler = this.pool.shift();
    while (handler) {
      handler();
      handler = this.pool.shift();
    }
  }
}
