// src/modules/admin/rbac-routes.ts
// RBAC 管理 API 路由示例

import { Elysia, t } from 'elysia'
import { rbacMacros } from '../../http/macro'
import { getRbacAdminService } from '../../services/rbac'

/**
 * RBAC 管理路由
 * 需要管理员权限
 */
export const rbacAdminRoutes = new Elysia({ prefix: '/admin/rbac' })
  .use(rbacMacros)

  // ========== 角色管理 ==========

  .get('/roles', async () => {
    const admin = getRbacAdminService()
    return admin.listRoles()
  }, {
    role: ['admin']
  })

  .post('/roles', async ({ body }) => {
    const admin = getRbacAdminService()
    const role = await admin.createRole(body)
    return { role }
  }, {
    role: ['admin'],
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 50 }),
      description: t.Optional(t.String({ maxLength: 200 })),
      parentId: t.Optional(t.String())
    })
  })

  .get('/roles/:id', async ({ params }) => {
    const admin = getRbacAdminService()
    const role = await admin.getRole(params.id)
    if (!role) {
      return { error: 'Role not found' }
    }
    return { role }
  }, {
    role: ['admin']
  })

  .put('/roles/:id', async ({ params, body }) => {
    const admin = getRbacAdminService()
    const role = await admin.updateRole(params.id, body)
    return { role }
  }, {
    role: ['admin'],
    body: t.Partial(t.Object({
      name: t.String({ minLength: 1 }),
      description: t.String(),
      parentId: t.Union([t.String(), t.Null()])
    }))
  })

  .delete('/roles/:id', async ({ params }) => {
    const admin = getRbacAdminService()
    await admin.deleteRole(params.id)
    return { message: 'Role deleted' }
  }, {
    role: ['admin']
  })

  // ========== 权限管理 ==========

  .get('/permissions', async () => {
    const admin = getRbacAdminService()
    return admin.listPermissions()
  }, {
    role: ['admin']
  })

  .post('/permissions', async ({ body }) => {
    const admin = getRbacAdminService()
    const permission = await admin.createPermission(body)
    return { permission }
  }, {
    role: ['admin'],
    body: t.Object({
      resource: t.String({ minLength: 1 }),
      action: t.String({ minLength: 1 }),
      description: t.Optional(t.String())
    })
  })

  // ========== 角色-权限关联 ==========

  .post('/roles/:roleId/permissions', async ({ params, body }) => {
    const admin = getRbacAdminService()
    await admin.grantPermissionToRole(params.roleId, body.permissionId)
    return { message: 'Permission granted' }
  }, {
    role: ['admin'],
    body: t.Object({
      permissionId: t.String()
    })
  })

  .delete('/roles/:roleId/permissions/:permissionId', async ({ params }) => {
    const admin = getRbacAdminService()
    await admin.revokePermissionFromRole(params.roleId, params.permissionId)
    return { message: 'Permission revoked' }
  }, {
    role: ['admin']
  })

  .put('/roles/:roleId/permissions', async ({ params, body }) => {
    const admin = getRbacAdminService()
    await admin.setRolePermissions(params.roleId, body.permissionIds)
    return { message: 'Permissions updated' }
  }, {
    role: ['admin'],
    body: t.Object({
      permissionIds: t.Array(t.String())
    })
  })

  // ========== 用户角色管理 ==========

  .get('/users/:userId/roles', async ({ params }) => {
    const admin = getRbacAdminService()
    return admin.getUserRoles(params.userId)
  }, {
    role: ['admin']
  })

  .post('/users/:userId/roles', async ({ params, body }) => {
    const admin = getRbacAdminService()
    const userRole = await admin.assignRoleToUser(
      params.userId,
      body.roleId,
      body.expiresAt ? new Date(body.expiresAt) : undefined
    )
    return { userRole }
  }, {
    role: ['admin'],
    body: t.Object({
      roleId: t.String(),
      expiresAt: t.Optional(t.String())
    })
  })

  .delete('/users/:userId/roles/:roleId', async ({ params }) => {
    const admin = getRbacAdminService()
    await admin.removeRoleFromUser(params.userId, params.roleId)
    return { message: 'Role removed' }
  }, {
    role: ['admin']
  })

  .put('/users/:userId/roles', async ({ params, body }) => {
    const admin = getRbacAdminService()
    await admin.setUserRoles(params.userId, body.roleIds)
    return { message: 'Roles updated' }
  }, {
    role: ['admin'],
    body: t.Object({
      roleIds: t.Array(t.String())
    })
  })

  // ========== 用户 Scope 管理 ==========

  .get('/users/:userId/scopes', async ({ params }) => {
    const admin = getRbacAdminService()
    return admin.getUserScopes(params.userId)
  }, {
    role: ['admin']
  })

  .post('/users/:userId/scopes', async ({ params, body }) => {
    const admin = getRbacAdminService()
    const userScope = await admin.assignScopeToUser(
      params.userId,
      body.scopeId,
      body.parameters
    )
    return { userScope }
  }, {
    role: ['admin'],
    body: t.Object({
      scopeId: t.String(),
      parameters: t.Optional(t.Record(t.String(), t.Any()))
    })
  })

  .delete('/users/:userId/scopes/:scopeId', async ({ params }) => {
    const admin = getRbacAdminService()
    await admin.removeScopeFromUser(params.userId, params.scopeId)
    return { message: 'Scope removed' }
  }, {
    role: ['admin']
  })

  // ========== 缓存管理 ==========

  .post('/cache/invalidate', async () => {
    const { getCacheInvalidator } = await import('../../services/rbac/cache-invalidator')
    const invalidator = getCacheInvalidator()
    await invalidator.invalidateAll()
    return { message: 'All caches invalidated' }
  }, {
    role: ['admin']
  })

  .post('/cache/invalidate/user/:userId', async ({ params }) => {
    const { getCacheInvalidator } = await import('../../services/rbac/cache-invalidator')
    const invalidator = getCacheInvalidator()
    await invalidator.invalidateUserPermission(params.userId)
    return { message: 'User cache invalidated' }
  }, {
    role: ['admin']
  })

  .post('/cache/invalidate/role/:roleId', async ({ params }) => {
    const { getCacheInvalidator } = await import('../../services/rbac/cache-invalidator')
    const invalidator = getCacheInvalidator()
    await invalidator.invalidateRoleUsers(params.roleId)
    return { message: 'Role cache invalidated' }
  }, {
    role: ['admin']
  })
