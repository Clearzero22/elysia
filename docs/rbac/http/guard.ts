// src/http/guard/index.ts

import { Elysia } from 'elysia'
import { authMiddleware } from '../middleware/auth'
import {
  getAuthorizationChecker,
  type AuthorizationConfig
} from '../../services/rbac/authorization-checker'
import type { PermissionAction, RbacErrorCode } from '../../services/rbac/types'

// 重新导出配置构建器
export {
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireRole,
  requireOwnership,
  requirePermissionOrOwnership
} from '../../services/rbac/authorization-checker'

/**
 * 错误响应接口
 */
interface GuardErrorResponse {
  code: number
  message: string
  error: typeof RbacErrorCode[keyof typeof RbacErrorCode]
}

/**
 * 创建权限守卫
 *
 * @example
 * ```typescript
 * // 单个权限
 * .use(createGuard(requirePermission('project', 'create')))
 *
 * // 权限或所有权
 * .use(createGuard(requirePermissionOrOwnership('project', 'update')))
 *
 * // 自定义配置
 * .use(createGuard({
 *   roles: ['admin', 'manager'],
 *   permissions: [{ resource: 'project', action: 'read' }],
 *   permissionMode: 'all'
 * }))
 * ```
 */
export function createGuard(config: AuthorizationConfig): Elysia {
  // 生成稳定的插件名称
  const pluginName = `guard:${hashConfig(config)}`

  return new Elysia({ name: pluginName })
    .use(authMiddleware)
    .onBeforeHandle(async ({ user, params, set }): Promise<GuardErrorResponse | void> => {
      // 1. 检查登录
      if (!user) {
        set.status = 401
        return {
          code: 401,
          message: '未登录',
          error: 'UNAUTHORIZED'
        }
      }

      // 2. 执行授权检查
      const checker = getAuthorizationChecker()
      const result = await checker.check(config, {
        userId: user.id,
        params: params as Record<string, string>
      })

      // 3. 处理结果
      if (!result.allowed) {
        set.status = result.code
        return {
          code: result.code,
          message: result.reason || '权限不足',
          error: 'FORBIDDEN'
        }
      }
    })
}

/**
 * 简化的守卫函数
 */

/** 要求登录 */
export function requireAuthGuard(): Elysia {
  return createGuard({})
}

/** 要求指定权限（类型安全） */
export function guardPermission<R extends string>(
  resource: R,
  action: PermissionAction
): Elysia {
  return createGuard({ permissions: [{ resource, action }] })
}

/** 要求指定角色（类型安全） */
export function guardRole<const Roles extends readonly string[]>(
  ...roles: Roles
): Elysia {
  return createGuard({ roles: [...roles] })
}

/** 要求所有权 */
export function guardOwnership<R extends string>(
  resource: R,
  paramName?: string
): Elysia {
  return createGuard({ ownership: { resource, paramName } })
}

/**
 * 配置哈希函数（用于生成稳定的插件名称）
 */
function hashConfig(config: AuthorizationConfig): string {
  const parts: string[] = []

  if (config.permissions) {
    parts.push(`perms:${config.permissions.map(p => `${p.resource}:${p.action}`).sort().join(',')}`)
  }
  if (config.permissionMode) {
    parts.push(`mode:${config.permissionMode}`)
  }
  if (config.roles) {
    parts.push(`roles:${[...config.roles].sort().join(',')}`)
  }
  if (config.ownership) {
    parts.push(`owner:${config.ownership.resource}:${config.ownership.paramName || 'id'}`)
  }
  if (config.allowOwnershipFallback) {
    parts.push('fallback:true')
  }

  // 简单哈希（使用 Buffer 替代可能不稳定的 base64）
  let hash = 0
  const str = parts.join('|')
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36).slice(0, 12)
}
