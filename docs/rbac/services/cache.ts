// src/services/rbac/cache.ts

import type { PermissionCache, UserPermissionContext } from './types'

/**
 * Redis 分布式缓存实现
 */
export class RedisPermissionCache implements PermissionCache {
  private redis: Redis
  private ttl: number
  private keyPrefix = 'rbac:user:'

  constructor(redis: Redis, ttlSeconds: number = 300) {
    this.redis = redis
    this.ttl = ttlSeconds
  }

  async getUserContext(userId: string): Promise<UserPermissionContext | null> {
    const key = `${this.keyPrefix}${userId}`
    const data = await this.redis.get(key)

    if (!data) return null

    try {
      const parsed = JSON.parse(data)
      // 还原 Set 类型
      return {
        ...parsed,
        permissions: new Set(parsed.permissions)
      }
    } catch {
      return null
    }
  }

  async setUserContext(
    userId: string,
    context: UserPermissionContext
  ): Promise<void> {
    const key = `${this.keyPrefix}${userId}`
    const data = JSON.stringify({
      ...context,
      permissions: Array.from(context.permissions)
    })

    await this.redis.setex(key, this.ttl, data)
  }

  async deleteUserContext(userId: string): Promise<void> {
    const key = `${this.keyPrefix}${userId}`
    await this.redis.del(key)
  }

  /**
   * 批量清除缓存（角色变更时）
   * 使用 SCAN 命令遍历所有用户缓存
   */
  async invalidateByRole(roleId: string): Promise<void> {
    // 方案1: 使用 Redis Keyspace Notifications
    // 方案2: 维护 role -> users 的反向索引
    // 方案3: 使用 Pub/Sub 通知所有实例

    // 这里采用简单的 SCAN 方案
    const pattern = `${this.keyPrefix}*`
    let cursor = '0'

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      )
      cursor = nextCursor

      if (keys.length > 0) {
        // 批量删除
        await this.redis.del(...keys)
      }
    } while (cursor !== '0')
  }
}

/**
 * 内存缓存实现（单实例部署时使用）
 */
export class MemoryPermissionCache implements PermissionCache {
  private cache = new Map<string, { data: string; expires: number }>()
  private ttl: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(ttlSeconds: number = 300) {
    this.ttl = ttlSeconds * 1000
    this.startCleanup()
  }

  async getUserContext(userId: string): Promise<UserPermissionContext | null> {
    const entry = this.cache.get(userId)
    if (!entry) return null

    if (Date.now() > entry.expires) {
      this.cache.delete(userId)
      return null
    }

    try {
      const parsed = JSON.parse(entry.data)
      return {
        ...parsed,
        permissions: new Set(parsed.permissions)
      }
    } catch {
      return null
    }
  }

  async setUserContext(
    userId: string,
    context: UserPermissionContext
  ): Promise<void> {
    this.cache.set(userId, {
      data: JSON.stringify({
        ...context,
        permissions: Array.from(context.permissions)
      }),
      expires: Date.now() + this.ttl
    })
  }

  async deleteUserContext(userId: string): Promise<void> {
    this.cache.delete(userId)
  }

  /**
   * 清除所有缓存
   */
  async clearAll(): Promise<void> {
    this.cache.clear()
  }

  /**
   * 定期清理过期缓存
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expires) {
          this.cache.delete(key)
        }
      }
    }, 60000)
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
  }
}

/**
 * 创建缓存实例的工厂函数
 */
export function createPermissionCache(
  redis?: Redis
): PermissionCache {
  if (redis) {
    return new RedisPermissionCache(redis, 300)
  }
  return new MemoryPermissionCache(300)
}

// 类型声明，避免直接依赖 ioredis
declare class Redis {
  get(key: string): Promise<string | null>
  setex(key: string, seconds: number, value: string): Promise<'OK'>
  del(...keys: string[]): Promise<number>
  scan(
    cursor: string,
    command: 'MATCH' | 'COUNT',
    arg1: string | number,
    arg2?: string | number
  ): Promise<[string, string[]]>
}
