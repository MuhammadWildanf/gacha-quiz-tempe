const prisma = require('../config/database');
const { PERMISSIONS } = require('../config/permissions');

// Admin selalu punya semua izin, supaya tidak bisa terkunci dari sistem.
async function getPermissionsForRole(roleName) {
    if (roleName === 'admin') return Object.keys(PERMISSIONS);

    const role = await prisma.role.findUnique({
        where: { name: roleName },
        include: { permissions: true }
    });
    return role ? role.permissions.map(p => p.permission) : [];
}

module.exports = { getPermissionsForRole };
