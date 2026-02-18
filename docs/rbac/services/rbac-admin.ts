// src/services/rbac/rbac-admin.ts

import { db } from '../../db/prisma'
import { getCacheInvalidator } from './cache-invalidator'

/**
 * RBAC 管理服务
 * 提供角色、权限、用户角色的管理操作
 */
export class RbacAdminService {
  private invalidator: ReturnType<typeof getCacheInvalidator>

  constructor() {
    this.invalidator = getCacheInvalidator()
  }

  // ========== 角色管理 ==========

  /**
   * 创建角色
   */
  async createRole(data: {
    name: string
    description?: string
    parentId?: string
  }) {
    return db.role.create({
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId
      }
    })
  }

  /**
   * 更新角色
   */
  async updateRole(
    roleId: string,
    data: {
      name?: string
      description?: string
      parentId?: string | null
    }
  ) {
    const role = await db.role.update({
      where: { id: roleId },
      data
    })

    // 触发缓存失效
    await this.invalidator.onRolePermissionChanged(roleId)

    return role
  }

  /**
   * 删除角色
   */
  async deleteRole(roleId: string) {
    await db.role.delete({
      where: { id: roleId }
    })
    // Prisma 中间件会自动触发缓存失效
  }

  /**
   * 获取角色详情（含权限）
   */
  async getRole(roleId: string) {
    return db.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: { permission: true }
        },
        parent: true,
        children: true
      }
    })
  }

  /**
   * 获取所有角色
   */
  async listRoles() {
    return db.role.findMany({
      include: {
        _count: {
          select: {
            userRoles: true,
            permissions: true
          }
        }
      }
    })
  }

  // ========== 权限管理 ==========

  /**
   * 创建权限
   */
  async createPermission(data: {
    resource: string
    action: string
    description?: string
  }) {
    return db.permission.create({
      data
    })
  }

  /**
   * 获取所有权限
   */
  async listPermissions() {
    return db.permission.findMany({
      include: {
        _count: {
          select: { roles: true }
        }
      }
    })
  }

  /**
   * 给角色授予权限
   */
  async grantPermissionToRole(roleId: string, permissionId: string) {
    const rolePermission = await db.rolePermission.create({
      data: { roleId, permissionId }
    })

    await this.invalidator.onRolePermissionChanged(roleId)

    return rolePermission
  }

  /**
   * 撤销角色的权限
   */
  async revokePermissionFromRole(roleId: string, permissionId: string) {
    await db.rolePermission.delete({
      where: {
        roleId_permissionId: { roleId, permissionId }
      }
    })

    await this.invalidator.onRolePermissionChanged(roleId)
  }

  /**
   * 批量设置角色权限
   */
  async setRolePermissions(roleId: string, permissionIds: string[]) {
    await this.invalidator.withBatchOperation(async () => {
      // 删除现有关联
      await db.rolePermission.deleteMany({
        where: { roleId }
      })

      // 创建新关联
      if (permissionIds.length > 0) {
        await db.rolePermission.createMany({
          data: permissionIds.map(permissionId => ({
            roleId,
            permissionId
          }))
        })
      }
    })
  }

  // ========== 用户角色管理 ==========

  /**
   * 给用户分配角色
   */
  async assignRoleToUser(
    userId: string,
    roleId: string,
    expiresAt?: Date
  ) {
    const userRole = await db.userRole.create({
      data: { userId, roleId, expiresAt }
    })

    await this.invalidator.onUserRoleAdded(userId, roleId)

    return userRole
  }

  /**
   * 移除用户角色
   */
  async removeRoleFromUser(userId: string, roleId: string) {
    await db.userRole.delete({
      where: {
        userId_roleId: { userId, roleId }
      }
    })
    // Prisma 中间件会自动触发缓存失效
  }

  /**
   * 批量设置用户角色
   */
  async setUserRoles(userId: string, roleIds: string[]) {
    await this.invalidator.withBatchOperation(async () => {
      // 删除现有关联
      await db.userRole.deleteMany({
        where: { userId }
      })

      // 创建新关联
      if (roleIds.length > 0) {
        await db.userRole.createMany({
          data: roleIds.map(roleId => ({
            userId,
            roleId
          }))
        })
      }
    })
  }

  /**
   * 获取用户的角色
   */
  async getUserRoles(userId: string) {
    return db.userRole.findMany({
      where: { userId },
      include: { role: true }
    })
  }

  // ========== 用户 Scope 管理 ==========

  /**
   * 给用户分配 Scope
   */
  async assignScopeToUser(
    userId: string,
    scopeId: string,
    parameters?: Record<string, unknown>
  ) {
    const userScope = await db.userScope.create({
      data: {
        userId,
        scopeId,
        parameters: parameters ? JSON.stringify(parameters) : null
      }
    })

    await this.invalidator.onUserScopesChanged(userId)

    return userScope
  }

  /**
   * 移除用户 Scope
   */
  async removeScopeFromUser(userId: string, scopeId: string) {
    await db.userScope.delete({
      where: {
        userId_scopeId: { userId, scopeId }
      }
    })

    await this.invalidator.onUserScopesChanged(userId)
  }

  /**
   * 获取用户的 Scope
   */
  async getUserScopes(userId: string) {
    return db.userScope.findMany({
      where: { userId },
      include: { scope: true }
    })
  }

  // ========== 策略管理 ==========

  /**
   * 创建所有权策略
   */
  async createOwnershipPolicy(data: {
    resource: string
    field: string
    condition?: Record<string, unknown>
    priority?: number
  }) {
    const policy = await db.ownershipPolicy.create({
      data: {
        resource: data.resource,
        field: data.field,
        condition: data.condition ? JSON.stringify(data.condition) : null,
        priority: data.priority ?? 0
      }
    })

    await this.invalidator.onOwnershipPolicyChanged()

    return policy
  }

  /**
   * 创建 Scope 策略
   */
  async createScopePolicy(data: {
    name: string
    resource: string
    description?: string
    conditions: Record<string, unknown>
  }) {
    const policy = await db.scopePolicy.create({
      data: {
        name: data.name,
        resource: data.resource,
        description: data.description,
        conditions: JSON.stringify(data.conditions)
      }
    })

    await this.invalidator.onScopePolicyChanged()

    return policy
  }
}

// 单例实例
let rbacAdminServiceInstance: RbacAdminService | null = null

/**
 * 获取 RBAC 管理服务单例
 */
export function getRbacAdminService(): RbacAdminService {
  if (!rbacAdminServiceInstance) {
    rbacAdminServiceInstance = new RbacAdminService()
  }
  return rbacAdminServiceInstance
}
