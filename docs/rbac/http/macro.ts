// src/http/macro/index.ts

import { Elysia } from 'elysia'
import { authMiddleware } from '../middleware/auth'
import {
  getAuthorizationChecker,
  type AuthorizationConfig
} from '../../services/rbac/authorization-checker'
import type { PermissionAction, RbacErrorCode } from '../../services/rbac/types'

/**
 * 错误响应接口
 */
interface MacroErrorResponse {
  code: number
  message: string
  error: typeof RbacErrorCode[keyof typeof RbacErrorCode]
}

/**
 * RBAC 宏 - 提供声明式权限控制
 *
 * 所有权限检查逻辑委托给 AuthorizationChecker，
 * 与 Guard 共用同一套逻辑，消除重复代码。
 *
 * @example
 * ```typescript
 * new Elysia()
 *   .use(rbacMacros)
 *   .get('/admin', handler, { requireAuth: true, role: ['admin'] })
 *   .post('/projects', handler, { permission: ['project', 'create'] })
 *   .put('/projects/:id', handler, {
 *     permissionOrOwnership: { permission: ['project', 'update'], resource: 'project' }
 *   })
 * ```
 */
export const rbacMacros = new Elysia({ name: 'rbac:macros' })
  .use(authMiddleware)
  .macro(({ onBeforeHandle }) => ({
    /**
     * 登录检查
     * @example { requireAuth: true }
     */
    requireAuth(enabled: boolean) {
      if (!enabled) return

      onBeforeHandle(async ({ user, error }): Promise<MacroErrorResponse | void> => {
        if (!user) {
          return error(401, {
            code: 401,
            message: '未登录',
            error: 'UNAUTHORIZED' as const
          })
        }
      })
    },

    /**
     * 单个权限检查（类型安全）
     * @example { permission: ['project', 'create'] }
     */
    permission<R extends string>([resource, action]: [R, PermissionAction]) {
      onBeforeHandle(async ({ user, params, error }): Promise<MacroErrorResponse | void> => {
        const result = await executeAuthCheck(
          { permissions: [{ resource, action }] },
          user,
          params as Record<string, string>
        )

        if (result) {
          return error(result.code, result.body)
        }
      })
    },

    /**
     * 多个权限检查（AND 关系，类型安全）
     * @example { allPermissions: [['project', 'read'], ['task', 'read']] }
     */
    allPermissions<const Checks extends readonly [string, PermissionAction][]>(
      checks: Checks
    ) {
      onBeforeHandle(async ({ user, params, error }): Promise<MacroErrorResponse | void> => {
        const result = await executeAuthCheck(
          {
            permissions: checks.map(([r, a]) => ({ resource: r, action: a })),
            permissionMode: 'all'
          },
          user,
          params as Record<string, string>
        )

        if (result) {
          return error(result.code, result.body)
        }
      })
    },

    /**
     * 任一权限检查（OR 关系，类型安全）
     * @example { anyPermission: [['project', 'delete'], ['project', 'manage']] }
     */
    anyPermission<const Checks extends readonly [string, PermissionAction][]>(
      checks: Checks
    ) {
      onBeforeHandle(async ({ user, params, error }): Promise<MacroErrorResponse | void> => {
        const result = await executeAuthCheck(
          {
            permissions: checks.map(([r, a]) => ({ resource: r, action: a })),
            permissionMode: 'any'
          },
          user,
          params as Record<string, string>
        )

        if (result) {
          return error(result.code, result.body)
        }
      })
    },

    /**
     * 角色检查（OR 关系，类型安全）
     * @example { role: ['admin', 'manager'] }
     */
    role<const Roles extends readonly string[]>(roles: Roles) {
      onBeforeHandle(async ({ user, params, error }): Promise<MacroErrorResponse | void> => {
        const result = await executeAuthCheck(
          { roles: [...roles] },
          user,
          params as Record<string, string>
        )

        if (result) {
          return error(result.code, result.body)
        }
      })
    },

    /**
     * 所有权检查
     * @example { ownership: { resource: 'project', param: 'id' } }
     */
    ownership<R extends string>(config: { resource: R; param?: string }) {
      onBeforeHandle(async ({ user, params, error }): Promise<MacroErrorResponse | void> => {
        const result = await executeAuthCheck(
          { ownership: { resource: config.resource, paramName: config.param } },
          user,
          params as Record<string, string>
        )

        if (result) {
          return error(result.code, result.body)
        }
      })
    },

    /**
     * 权限或所有权（任一满足即可，类型安全）
     * @example { permissionOrOwnership: { permission: ['project', 'update'], resource: 'project' } }
     */
    permissionOrOwnership<R extends string>(config: {
      permission: [R, PermissionAction]
      resource: R
      param?: string
    }) {
      onBeforeHandle(async ({ user, params, error }): Promise<MacroErrorResponse | void> => {
        const [resource, action] = config.permission

        const result = await executeAuthCheck(
          {
            permissions: [{ resource, action }],
            ownership: { resource: config.resource, paramName: config.param },
            allowOwnershipFallback: true
          },
          user,
          params as Record<string, string>
        )

        if (result) {
          return error(result.code, result.body)
        }
      })
    }
  }))

/**
 * 执行授权检查的辅助函数
 */
async function executeAuthCheck(
  config: AuthorizationConfig,
  user: { id: string } | null,
  params: Record<string, string>
): Promise<{ code: number; body: MacroErrorResponse } | null> {
  // 1. 登录检查
  if (!user) {
    return {
      code: 401,
      body: {
        code: 401,
        message: '未登录',
        error: 'UNAUTHORIZED'
      }
    }
  }

  // 2. 执行授权检查
  const checker = getAuthorizationChecker()
  const result = await checker.check(config, {
    userId: user.id,
    params
  })

  // 3. 返回错误（如果检查失败）
  if (!result.allowed) {
    return {
      code: result.code,
      body: {
        code: result.code,
        message: result.reason || '权限不足',
        error: 'FORBIDDEN'
      }
    }
  }

  return null
}
