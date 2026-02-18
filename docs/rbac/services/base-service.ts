// src/services/rbac/base-service.ts

/**
 * 异步初始化基类
 * 解决 constructor 中无法 await 的问题
 */
export abstract class AsyncInitializable {
  private initPromise: Promise<void> | null = null
  private initialized = false

  /**
   * 子类实现的初始化逻辑
   */
  protected abstract onInitialize(): Promise<void>

  /**
   * 确保服务已初始化
   * - 首次调用时执行初始化
   * - 后续调用返回缓存的 Promise
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    if (!this.initPromise) {
      this.initPromise = this.onInitialize()
        .then(() => {
          this.initialized = true
        })
        .catch((error) => {
          // 失败时清除 Promise，允许重试
          this.initPromise = null
          throw error
        })
    }

    return this.initPromise
  }

  /**
   * 检查是否已初始化（同步）
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 重置初始化状态（用于刷新数据）
   */
  protected resetInitialization(): void {
    this.initialized = false
    this.initPromise = null
  }
}
