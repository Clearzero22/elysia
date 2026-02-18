// src/services/rbac/cache-invalidator.ts

import { db } from '../../db/prisma'
import { getPermissionService } from './permission-service'
import { getOwnershipService } from './ownership-service'
import { getScopeResolver } from './scope-resolver'
import type { PermissionCache } from './types'

/**
 * 缓存失效事件类型
 */
export type CacheInvalidationEvent =
  | 'user_role_added'
  | 'user_role_removed'
  | 'role_permission_changed'
  | 'role_deleted'
  | 'user_scopes_changed'
  | 'ownership_policy_changed'
  | 'scope_policy_changed'

/**
 * 缓存失效监听器
 */
export type CacheInvalidationListener = (
  event: CacheInvalidationEvent,
  data: Record<string, unknown>
) => void | Promise<void>

/**
 * 缓存失效服务
 * 集中管理所有 RBAC 相关缓存的失效逻辑
 */
export class CacheInvalidator {
  private cache: PermissionCache
  private listeners: CacheInvalidationListener[] = []
  private enabled: boolean = true

  constructor(cache: PermissionCache) {
    this.cache = cache
  }

  /**
   * 启用/禁用缓存失效
   * 批量操作时可临时禁用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * 添加事件监听器
   */
  addListener(listener: CacheInvalidationListener): void {
    this.listeners.push(listener)
  }

  /**
   * 移除事件监听器
   */
  removeListener(listener: CacheInvalidationListener): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * 触发事件
   */
  private async emit(
    event: CacheInvalidationEvent,
    data: Record<string, unknown>
  ): Promise<void> {
    await Promise.all(
      this.listeners.map(listener => listener(event, data))
    )
  }

  // ========== 用户相关 ==========

  /**
   * 用户角色添加后失效缓存
   */
  async onUserRoleAdded(userId: string, roleId: string): Promise<void> {
    if (!this.enabled) return

    await this.invalidateUserPermission(userId)
    await this.emit('user_role_added', { userId, roleId })
  }

  /**
   * 用户角色移除后失效缓存
   */
  async onUserRoleRemoved(userId: string, roleId: string): Promise<void> {
    if (!this.enabled) return

    await this.invalidateUserPermission(userId)
    await this.emit('user_role_removed', { userId, roleId })
  }

  /**
   * 用户 Scope 变更后失效缓存
   */
  async onUserScopesChanged(userId: string): Promise<void> {
    if (!this.enabled) return

    await this.invalidateUserPermission(userId)
    await this.emit('user_scopes_changed', { userId })
  }

  // ========== 角色相关 ==========

  /**
   * 角色权限变更后失效缓存
   */
  async onRolePermissionChanged(roleId: string): Promise<void> {
    if (!this.enabled) return

    await this.invalidateRoleUsers(roleId)
    await this.emit('role_permission_changed', { roleId })
  }

  /**
   * 角色删除后失效缓存
   */
  async onRoleDeleted(roleId: string): Promise<void> {
    if (!this.enabled) return

    await this.invalidateRoleUsers(roleId)
    await this.emit('role_deleted', { roleId })
  }

  // ========== 策略相关 ==========

  /**
   * 所有权策略变更后刷新
   */
  async onOwnershipPolicyChanged(): Promise<void> {
    if (!this.enabled) return

    const ownershipService = getOwnershipService()
    await ownershipService.refreshPolicies()
    await this.emit('ownership_policy_changed', {})
  }

  /**
   * Scope 策略变更后刷新
   */
  async onScopePolicyChanged(): Promise<void> {
    if (!this.enabled) return

    const scopeResolver = getScopeResolver()
    await scopeResolver.refreshPolicies()
    await this.emit('scope_policy_changed', {})
  }

  // ========== 核心失效方法 ==========

  /**
   * 失效单个用户的权限缓存
   */
  async invalidateUserPermission(userId: string): Promise<void> {
    const permissionService = getPermissionService()
    await permissionService.invalidateUserCache(userId)
  }

  /**
   * 失效拥有指定角色的所有用户的缓存
   */
  async invalidateRoleUsers(roleId: string): Promise<void> {
    // 1. 刷新权限服务的角色缓存
    const permissionService = getPermissionService()
    await permissionService.refreshRoleCache()

    // 2. 获取所有拥有该角色的用户
    const userRoles = await db.userRole.findMany({
      where: { roleId },
      select: { userId: true }
    })

    // 3. 清除这些用户的缓存
    await Promise.all(
      userRoles.map(({ userId }) =>
        this.cache.deleteUserContext(userId)
      )
    )

    // 4. 如果缓存支持批量失效，使用它
    if (this.cache.invalidateByRole) {
      await this.cache.invalidateByRole(
        roleId,
        userRoles.map(ur => ur.userId)
      )
    }
  }

  /**
   * 失效所有缓存
   */
  async invalidateAll(): Promise<void> {
    // 1. 清除用户权限缓存
    if (this.cache.clearAll) {
      await this.cache.clearAll()
    }

    // 2. 刷新角色缓存
    const permissionService = getPermissionService()
    await permissionService.refreshRoleCache()

    // 3. 刷新策略缓存
    const ownershipService = getOwnershipService()
    await ownershipService.refreshPolicies()

    const scopeResolver = getScopeResolver()
    await scopeResolver.refreshPolicies()
  }

  /**
   * 批量操作（临时禁用失效，最后统一刷新）
   */
  async withBatchOperation<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    const wasEnabled = this.enabled
    this.enabled = false

    try {
      const result = await operation()
      return result
    } finally {
      this.enabled = wasEnabled
      // 批量操作完成后，刷新所有缓存
      await this.invalidateAll()
    }
  }
}

// 单例实例
let cacheInvalidatorInstance: CacheInvalidator | null = null

/**
 * 获取缓存失效器单例
 */
export function getCacheInvalidator(): CacheInvalidator {
  if (!cacheInvalidatorInstance) {
    throw new Error(
      'CacheInvalidator not initialized. Call initializeCacheInvalidator() first.'
    )
  }
  return cacheInvalidatorInstance
}

/**
 * 初始化缓存失效器
 */
export function initializeCacheInvalidator(
  cache: PermissionCache
): CacheInvalidator {
  if (!cacheInvalidatorInstance) {
    cacheInvalidatorInstance = new CacheInvalidator(cache)
  }
  return cacheInvalidatorInstance
}
