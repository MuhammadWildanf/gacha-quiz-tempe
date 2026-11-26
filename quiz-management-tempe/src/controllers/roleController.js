const prisma = require('../config/database');
const { PERMISSIONS } = require('../config/permissions');
const { recordAudit } = require('../services/audit');

const LOCKED_ROLES = ['admin'];

const getRoles = async (req, res) => {
    try {
        const roles = await prisma.role.findMany({
            orderBy: { name: 'asc' },
            include: { permissions: true }
        });

        const matrix = roles.map(role => ({
            id: role.id,
            name: role.name,
            description: role.description,
            locked: LOCKED_ROLES.includes(role.name),
            granted: new Set(role.permissions.map(p => p.permission))
        }));

        res.render('roles/index', {
            matrix,
            permissionKeys: Object.keys(PERMISSIONS),
            permissionLabels: PERMISSIONS,
            success: req.query.success || null,
            path: 'roles'
        });
    } catch (error) {
        console.error('getRoles error:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const postRolePermissions = async (req, res) => {
    const id = parseInt(req.params.id);
    const role = await prisma.role.findUnique({ where: { id }, include: { permissions: true } });
    if (!role) return res.redirect('/admin/roles');
    if (LOCKED_ROLES.includes(role.name)) return res.redirect('/admin/roles?success=locked');

    const submitted = [].concat(req.body.permissions || []);
    const valid = submitted.filter(key => Object.prototype.hasOwnProperty.call(PERMISSIONS, key));

    try {
        await prisma.$transaction([
            prisma.rolePermission.deleteMany({ where: { roleId: id } }),
            prisma.rolePermission.createMany({
                data: valid.map(permission => ({ roleId: id, permission }))
            })
        ]);

        const before = new Set(role.permissions.map(p => p.permission));
        const after = new Set(valid);
        const granted = valid.filter(p => !before.has(p));
        const revoked = [...before].filter(p => !after.has(p));
        if (granted.length > 0 || revoked.length > 0) {
            await recordAudit({
                actor: req.user,
                action: 'ROLE_PERMISSIONS_UPDATE',
                target: role.name,
                detail: { granted, revoked }
            });
        }
        res.redirect('/admin/roles?success=saved');
    } catch (error) {
        console.error('postRolePermissions error:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = { getRoles, postRolePermissions };
