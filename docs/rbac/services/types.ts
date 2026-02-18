// src/services/rbac/types.ts

import type { PermissionAction, RbacResource } from './model-helpers'

// 重新导出
export type { PermissionAction, RbacResource } from './model-helpers'

/**
 * 权限检查请求
 * @template R - 资源类型
 * @template A - 操作类型
 */
export interface PermissionCheck<
  R extends string = string,
  A extends PermissionAction = PermissionAction
> {
  resource: R
  action: A
}

/**
 * 权限字符串类型
 * 格式: "resource:action"
 */
export type PermissionString<
  R extends string = string,
  A extends PermissionAction = PermissionAction
> = `${R}:${A}`

/**
 * 权限检查结果
 */
export interface PermissionResult {
  allowed: boolean
  reason?: string
  scope?: ScopeContext
}

/**
 * 数据范围上下文
 */
export interface ScopeContext {
  type: string
  conditions: Record<string, unknown>
  parameters?: Record<string, unknown>
}

/**
 * 所有权检查结果
 */
export interface OwnershipResult {
  isOwner: boolean
  policy?: string
}

/**
 * 用户权限上下文
 */
export interface UserPermissionContext {
  userId: string
  roleIds: string[]
  permissions: Set<PermissionString>
  scopes: ScopeContext[]
}

/**
 * 权限缓存接口
 */
export interface PermissionCache {
  /** 获取用户权限上下文 */
  getUserContext(userId: string): Promise<UserPermissionContext | null>

  /** 设置用户权限上下文 */
  setUserContext(userId: string, context: UserPermissionContext): Promise<void>

  /** 删除用户权限上下文 */
  deleteUserContext(userId: string): Promise<void>

  /**
   * 批量清除缓存（角色变更时）
   * @param roleId - 变更的角色 ID
   * @param userIds - 可选，受影响的用户 ID 列表（用于优化）
   */
  invalidateByRole?(roleId: string, userIds?: string[]): Promise<void>

  /**
   * 清除所有缓存
   */
  clearAll?(): Promise<void>
}

/**
 * RBAC 错误类型
 */
export const RbacErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INVALID_TOKEN: 'INVALID_TOKEN',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
} as const

export type RbacErrorCodeType = (typeof RbacErrorCode)[keyof typeof RbacErrorCode]

/**
 * RBAC 错误响应
 */
export interface RbacErrorResponse {
  code: number
  message: string
  error: RbacErrorCodeType
  details?: Record<string, unknown>
}

/**
 * 创建 RBAC 错误响应
 */
export function createRbacError(
  code: number,
  message: string,
  error: RbacErrorCodeType,
  details?: Record<string, unknown>
): RbacErrorResponse {
  return { code, message, error, details }
}
