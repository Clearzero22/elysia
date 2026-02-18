// src/services/rbac/permission-service.ts

import { db } from '../../db/prisma'
import { AsyncInitializable } from './base-service'
import type { PermissionCache } from './cache'
import type {
  PermissionCheck,
  PermissionResult,
  UserPermissionContext,
  ScopeContext
} from './types'

interface RoleWithPermissions {
  id: string
  name: string
  parentId: string | null
  permissions: Array<{
    permission: {
      resource: string
      action: string
    }
  }>
}

/**
 * 权限检查服务
 * 支持多角色、角色继承、数据范围
 */
export class PermissionService extends AsyncInitializable {
  private cache: PermissionCache

  // 角色继承缓存：roleId -> 所有祖先角色 ID（包括自己）
  private roleInheritanceCache = new Map<string, Set<string>>()

  // 角色详情缓存：roleId -> RoleWithPermissions
  private roleDetailsCache = new Map<string, RoleWithPermissions>()

  // 缓存刷新间隔
  private refreshInterval: NodeJS.Timeout | null = null

  constructor(cache: PermissionCache) {
    super()
    this.cache = cache
  }

  /**
   * 初始化：预热角色继承缓存
   */
  protected async onInitialize(): Promise<void> {
    await this.warmupRoleCache()
    this.startPeriodicRefresh()
  }

  /**
   * 预热角色缓存
   */
  private async warmupRoleCache(): Promise<void> {
    // 加载所有角色及其权限
    const roles = await db.role.findMany({
      include: {
        permissions: {
          include: { permission: true }
        }
      }
    })

    // 构建角色详情缓存
    for (const role of roles) {
      this.roleDetailsCache.set(role.id, role)
    }

    // 构建继承缓存
    for (const role of roles) {
      if (!this.roleInheritanceCache.has(role.id)) {
        await this.buildInheritanceChain(role.id)
      }
    }
  }

  /**
   * 递归构建角色继承链
   */
  private async buildInheritanceChain(roleId: string): Promise<Set<string>> {
    // 检查缓存
    const cached = this.roleInheritanceCache.get(roleId)
    if (cached) return cached

    const roleIds = new Set<string>([roleId])
    const role = this.roleDetailsCache.get(roleId)

    if (role?.parentId) {
      // 递归获取父角色的继承链
      const parentChain = await this.buildInheritanceChain(role.parentId)
      parentChain.forEach(id => roleIds.add(id))
    }

    this.roleInheritanceCache.set(roleId, roleIds)
    return roleIds
  }

  /**
   * 定期刷新缓存
   */
  private startPeriodicRefresh(): void {
    this.refreshInterval = setInterval(async () => {
      try {
        await this.warmupRoleCache()
      } catch (error) {
        console.error('Failed to refresh role cache:', error)
      }
    }, 5 * 60 * 1000)
  }

  /**
   * 手动刷新角色缓存
   */
  async refreshRoleCache(): Promise<void> {
    this.roleInheritanceCache.clear()
    this.roleDetailsCache.clear()
    await this.warmupRoleCache()
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
  }

  /**
   * 检查用户是否拥有指定权限
   */
  async checkPermission(
    userId: string,
    check: PermissionCheck
  ): Promise<PermissionResult> {
    await this.ensureInitialized()

    const context = await this.getUserContext(userId)

    if (!context) {
      return { allowed: false, reason: '用户不存在' }
    }

    const required = `${check.resource}:${check.action}`
    const wildcard = `${check.resource}:manage`

    // 检查是否有通配权限或具体权限
    const hasPermission =
      context.permissions.has('*:*') ||
      context.permissions.has(wildcard) ||
      context.permissions.has(required)

    if (!hasPermission) {
      return {
        allowed: false,
        reason: `需要 ${required} 权限`
      }
    }

    // 检查是否有数据范围限制
    const scope = this.getScopeForResource(context, check.resource)

    return { allowed: true, scope }
  }

  /**
   * 检查多个权限（AND 关系）
   */
  async checkAllPermissions(
    userId: string,
    checks: PermissionCheck[]
  ): Promise<PermissionResult> {
    await this.ensureInitialized()

    // 并行检查所有权限
    const results = await Promise.all(
      checks.map(c => this.checkPermission(userId, c))
    )

    const denied = results.find(r => !r.allowed)
    if (denied) {
      return denied
    }

    // 合并所有范围限制（取交集）
    const scopes = results
      .map(r => r.scope)
      .filter((s): s is ScopeContext => s !== undefined)

    return {
      allowed: true,
      scope: this.mergeScopes(scopes)
    }
  }

  /**
   * 检查任一权限（OR 关系）- 并行执行
   */
  async checkAnyPermission(
    userId: string,
    checks: PermissionCheck[]
  ): Promise<PermissionResult> {
    await this.ensureInitialized()

    // 并行检查所有权限
    const results = await Promise.all(
      checks.map(c => this.checkPermission(userId, c))
    )

    // 找到第一个允许的结果
    const allowed = results.find(r => r.allowed)
    if (allowed) {
      return allowed
    }

    // 所有权限都被拒绝
    const perms = checks.map(c => `${c.resource}:${c.action}`).join(' 或 ')
    return {
      allowed: false,
      reason: `需要以下任一权限: ${perms}`
    }
  }

  /**
   * 检查用户角色
   */
  async hasRole(userId: string, roleName: string): Promise<boolean> {
    await this.ensureInitialized()

    const context = await this.getUserContext(userId)
    if (!context) return false

    // 查找角色名称
    for (const roleId of context.roleIds) {
      const role = this.roleDetailsCache.get(roleId)
      if (role?.name === roleName) {
        return true
      }
    }

    return false
  }

  /**
   * 获取用户权限上下文（带缓存）
   * Public 方法，供其他服务使用
   */
  async getUserContext(
    userId: string
  ): Promise<UserPermissionContext | null> {
    // 1. 尝试从缓存获取
    const cached = await this.cache.getUserContext(userId)
    if (cached) return cached

    // 2. 从数据库加载
    const context = await this.loadUserContext(userId)
    if (context) {
      await this.cache.setUserContext(userId, context)
    }

    return context
  }

  /**
   * 从数据库加载用户权限上下文
   */
  private async loadUserContext(
    userId: string
  ): Promise<UserPermissionContext | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          },
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true }
                }
              }
            }
          }
        },
        userScopes: {
          include: { scope: true }
        }
      }
    })

    if (!user) return null

    // 收集所有角色 ID（使用缓存的继承链）
    const roleIds = new Set<string>()
    const allPermissions = new Set<string>()

    for (const userRole of user.userRoles) {
      // 获取继承链（从缓存）
      const inheritanceChain = this.roleInheritanceCache.get(userRole.roleId)

      if (inheritanceChain) {
        inheritanceChain.forEach(id => roleIds.add(id))
      }

      // 收集直接角色的权限
      for (const rp of userRole.role.permissions) {
        allPermissions.add(`${rp.permission.resource}:${rp.permission.action}`)
      }

      // 收集继承角色的权限
      if (inheritanceChain) {
        for (const roleId of inheritanceChain) {
          const role = this.roleDetailsCache.get(roleId)
          if (role) {
            for (const rp of role.permissions) {
              allPermissions.add(
                `${rp.permission.resource}:${rp.permission.action}`
              )
            }
          }
        }
      }
    }

    // 解析数据范围
    const scopes = user.userScopes.map(us => ({
      type: us.scope.name,
      conditions: JSON.parse(us.scope.conditions),
      parameters: us.parameters ? JSON.parse(us.parameters) : undefined
    }))

    return {
      userId: user.id,
      roleIds: Array.from(roleIds),
      permissions: allPermissions,
      scopes
    }
  }

  /**
   * 获取资源对应的数据范围
   */
  private getScopeForResource(
    context: UserPermissionContext,
    resource: string
  ): ScopeContext | undefined {
    return context.scopes.find(s => s.conditions.resource === resource)
  }

  /**
   * 合并多个范围限制（取交集）
   */
  private mergeScopes(scopes: ScopeContext[]): ScopeContext | undefined {
    if (scopes.length === 0) return undefined
    if (scopes.length === 1) return scopes[0]

    return {
      type: 'merged',
      conditions: {
        AND: scopes.map(s => s.conditions)
      }
    }
  }

  /**
   * 清除用户权限缓存
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.cache.deleteUserContext(userId)
  }

  /**
   * 角色权限变更时，清除相关用户缓存
   */
  async invalidateCacheForRole(roleId: string): Promise<void> {
    // 刷新角色缓存
    await this.refreshRoleCache()

    // 获取所有拥有该角色的用户
    const userRoles = await db.userRole.findMany({
      where: { roleId },
      select: { userId: true }
    })

    // 清除这些用户的权限缓存
    await Promise.all(
      userRoles.map(({ userId }) => this.cache.deleteUserContext(userId))
    )
  }
}

// 单例实例
let permissionServiceInstance: PermissionService | null = null

/**
 * 获取权限服务单例
 */
export function getPermissionService(): PermissionService {
  if (!permissionServiceInstance) {
    throw new Error(
      'PermissionService not initialized. Call initializePermissionService() first.'
    )
  }
  return permissionServiceInstance
}

/**
 * 初始化权限服务（应用启动时调用）
 */
export async function initializePermissionService(
  cache: PermissionCache
): Promise<PermissionService> {
  if (!permissionServiceInstance) {
    permissionServiceInstance = new PermissionService(cache)
  }
  await permissionServiceInstance.ensureInitialized()
  return permissionServiceInstance
}
