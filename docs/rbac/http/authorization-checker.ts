// src/services/rbac/authorization-checker.ts

import { getPermissionService } from './permission-service'
import { getOwnershipService } from './ownership-service'
import type {
  PermissionCheck,
  PermissionAction,
  RbacResource,
  RbacErrorCode,
  createRbacError
} from './types'

/**
 * 授权检查配置
 */
export interface AuthorizationConfig {
  /** 需要的权限列表 */
  permissions?: PermissionCheck[]
  /** 权限检查模式：all (AND) 或 any (OR) */
  permissionMode?: 'all' | 'any'
  /** 需要的角色列表 */
  roles?: string[]
  /** 所有权检查配置 */
  ownership?: {
    resource: string
    paramName?: string // URL 参数名，默认 'id'
  }
  /** 是否允许权限或所有权任一满足 */
  allowOwnershipFallback?: boolean
}

/**
 * 授权检查上下文
 */
export interface AuthorizationContext {
  userId: string
  params: Record<string, string>
}

/**
 * 授权检查结果
 */
export interface AuthorizationResult {
  allowed: boolean
  reason?: string
  code: number
  /** 检查详情（用于调试） */
  details?: {
    permissionChecked?: boolean
    permissionResult?: boolean
    roleChecked?: boolean
    roleResult?: boolean
    ownershipChecked?: boolean
    ownershipResult?: boolean
  }
}

/**
 * 统一授权检查器
 * 封装所有权限、角色、所有权检查逻辑
 * Guard 和 Macro 都调用此类，消除代码重复
 */
export class AuthorizationChecker {
  /**
   * 执行完整的授权检查
   */
  async check(
    config: AuthorizationConfig,
    context: AuthorizationContext
  ): Promise<AuthorizationResult> {
    const { userId, params } = context
    const details: AuthorizationResult['details'] = {}

    const permissionService = getPermissionService()
    const ownershipService = getOwnershipService()

    // 1. 角色检查
    if (config.roles && config.roles.length > 0) {
      details.roleChecked = true
      const hasRole = await this.checkRoles(userId, config.roles)

      if (!hasRole) {
        details.roleResult = false
        return {
          allowed: false,
          code: 403,
          reason: `需要角色: ${config.roles.join(' 或 ')}`,
          details
        }
      }
      details.roleResult = true
    }

    // 2. 权限检查
    if (config.permissions && config.permissions.length > 0) {
      details.permissionChecked = true
      const result = await this.checkPermissions(
        userId,
        config.permissions,
        config.permissionMode || 'all'
      )

      if (result.allowed) {
        details.permissionResult = true
        return { allowed: true, code: 200, details }
      }

      details.permissionResult = false

      // 3. 权限不足，尝试所有权检查（如果配置了 fallback）
      if (config.allowOwnershipFallback && config.ownership) {
        details.ownershipChecked = true
        const resourceId = params[config.ownership.paramName || 'id']

        const ownershipResult = await ownershipService.checkOwnership(
          userId,
          config.ownership.resource,
          resourceId
        )

        details.ownershipResult = ownershipResult.isOwner

        if (ownershipResult.isOwner) {
          return { allowed: true, code: 200, details }
        }
      }

      // 4. 单独的所有权检查（无权限要求时）
      if (!config.allowOwnershipFallback && config.ownership) {
        details.ownershipChecked = true
        const resourceId = params[config.ownership.paramName || 'id']

        const ownershipResult = await ownershipService.checkOwnership(
          userId,
          config.ownership.resource,
          resourceId
        )

        details.ownershipResult = ownershipResult.isOwner

        if (!ownershipResult.isOwner) {
          return {
            allowed: false,
            code: 403,
            reason: '只能操作自己的资源',
            details
          }
        }
      }

      return {
        allowed: false,
        code: 403,
        reason: result.reason || '权限不足',
        details
      }
    }

    // 5. 只有权属检查
    if (config.ownership && !config.permissions) {
      details.ownershipChecked = true
      const resourceId = params[config.ownership.paramName || 'id']

      const ownershipResult = await ownershipService.checkOwnership(
        userId,
        config.ownership.resource,
        resourceId
      )

      details.ownershipResult = ownershipResult.isOwner

      if (!ownershipResult.isOwner) {
        return {
          allowed: false,
          code: 403,
          reason: '只能操作自己的资源',
          details
        }
      }
    }

    return { allowed: true, code: 200, details }
  }

  /**
   * 检查角色（OR 关系）
   */
  private async checkRoles(
    userId: string,
    roles: string[]
  ): Promise<boolean> {
    const permissionService = getPermissionService()

    const results = await Promise.all(
      roles.map(role => permissionService.hasRole(userId, role))
    )

    return results.some(Boolean)
  }

  /**
   * 检查权限
   */
  private async checkPermissions(
    userId: string,
    permissions: PermissionCheck[],
    mode: 'all' | 'any'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const permissionService = getPermissionService()

    if (mode === 'any') {
      return permissionService.checkAnyPermission(userId, permissions)
    }

    return permissionService.checkAllPermissions(userId, permissions)
  }

  // ========== 便捷方法 ==========

  /**
   * 检查单个权限（类型安全）
   */
  async checkPermission<R extends string>(
    userId: string,
    resource: R,
    action: PermissionAction
  ): Promise<AuthorizationResult> {
    return this.check(
      { permissions: [{ resource, action }] },
      { userId, params: {} }
    )
  }

  /**
   * 检查角色
   */
  async checkRole(
    userId: string,
    roles: readonly string[]
  ): Promise<AuthorizationResult> {
    return this.check({ roles: [...roles] }, { userId, params: {} })
  }

  /**
   * 检查所有权
   */
  async checkOwnership(
    userId: string,
    resource: string,
    resourceId: string
  ): Promise<AuthorizationResult> {
    return this.check(
      { ownership: { resource } },
      { userId, params: { id: resourceId } }
    )
  }

  /**
   * 检查权限或所有权（类型安全）
   */
  async checkPermissionOrOwnership<R extends string>(
    userId: string,
    resource: R,
    action: PermissionAction,
    resourceId: string
  ): Promise<AuthorizationResult> {
    return this.check(
      {
        permissions: [{ resource, action }],
        ownership: { resource },
        allowOwnershipFallback: true
      },
      { userId, params: { id: resourceId } }
    )
  }
}

// 单例实例
let authorizationCheckerInstance: AuthorizationChecker | null = null

/**
 * 获取授权检查器单例
 */
export function getAuthorizationChecker(): AuthorizationChecker {
  if (!authorizationCheckerInstance) {
    authorizationCheckerInstance = new AuthorizationChecker()
  }
  return authorizationCheckerInstance
}

// ========== 类型安全的配置构建器 ==========

/**
 * 创建权限检查配置（类型安全）
 */
export function requirePermission<R extends string>(
  resource: R,
  action: PermissionAction
): AuthorizationConfig {
  return { permissions: [{ resource, action }] }
}

/**
 * 创建多权限检查配置（AND，类型安全）
 */
export function requireAllPermissions<
  const Checks extends readonly PermissionCheck[]
>(...checks: Checks): AuthorizationConfig {
  return { permissions: [...checks], permissionMode: 'all' }
}

/**
 * 创建多权限检查配置（OR，类型安全）
 */
export function requireAnyPermission<
  const Checks extends readonly PermissionCheck[]
>(...checks: Checks): AuthorizationConfig {
  return { permissions: [...checks], permissionMode: 'any' }
}

/**
 * 创建角色检查配置（类型安全）
 */
export function requireRole<const Roles extends readonly string[]>(
  ...roles: Roles
): AuthorizationConfig {
  return { roles: [...roles] }
}

/**
 * 创建所有权检查配置
 */
export function requireOwnership<R extends string>(
  resource: R,
  paramName?: string
): AuthorizationConfig {
  return { ownership: { resource, paramName } }
}

/**
 * 创建权限或所有权检查配置（类型安全）
 */
export function requirePermissionOrOwnership<R extends string>(
  resource: R,
  action: PermissionAction,
  paramName?: string
): AuthorizationConfig {
  return {
    permissions: [{ resource, action }],
    ownership: { resource, paramName },
    allowOwnershipFallback: true
  }
}
