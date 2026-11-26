const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { recordAudit } = require('../services/audit');

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
const MIN_PASSWORD_LENGTH = 6;
const AUDITED_FIELDS = ['name', 'username', 'email', 'role', 'isActive'];

function diffUser(before, after) {
    const changes = {};
    for (const field of AUDITED_FIELDS) {
        if (before[field] !== after[field]) changes[field] = { from: before[field], to: after[field] };
    }
    return changes;
}

async function getRoleNames() {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' }, select: { name: true } });
    return roles.map(r => r.name);
}

function validateInput({ name, username, email, password, role }, { requirePassword }) {
    if (!name || !name.trim()) return 'Nama wajib diisi.';
    if (!USERNAME_PATTERN.test(username)) {
        return 'Username harus 3-30 karakter: huruf kecil, angka, titik, atau garis bawah.';
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return 'Format email tidak valid.';
    if (!role) return 'Role wajib dipilih.';
    if ((requirePassword || password) && password.length < MIN_PASSWORD_LENGTH) {
        return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
    }
    return null;
}

function readForm(body) {
    return {
        name: String(body.name || '').trim(),
        username: String(body.username || '').trim().toLowerCase(),
        email: String(body.email || '').trim().toLowerCase() || null,
        password: String(body.password || ''),
        role: String(body.role || '').trim(),
        isActive: body.isActive === 'on' || body.isActive === 'true' || body.isActive === true
    };
}

function isUniqueError(error) {
    return error && error.code === 'P2002';
}

const listUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
        res.render('users/index', {
            users,
            currentUserId: req.user.id,
            success: req.query.success || null,
            error: req.query.error || null,
            path: 'users'
        });
    } catch (error) {
        console.error('listUsers error:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const getCreateUser = async (req, res) => {
    const roles = await getRoleNames();
    res.render('users/create', {
        form: { name: '', username: '', email: '', role: 'operator', isActive: true },
        roles,
        error: null,
        path: 'users'
    });
};

const postCreateUser = async (req, res) => {
    const form = readForm(req.body);
    const roles = await getRoleNames();
    const error = validateInput(form, { requirePassword: true });

    if (error || !roles.includes(form.role)) {
        return res.render('users/create', { form, roles, error: error || 'Role tidak dikenal.', path: 'users' });
    }

    try {
        const password = await bcrypt.hash(form.password, 10);
        const created = await prisma.user.create({
            data: {
                name: form.name,
                username: form.username,
                email: form.email,
                password,
                role: form.role,
                isActive: form.isActive
            }
        });
        await recordAudit({
            actor: req.user,
            action: 'USER_CREATE',
            target: created.username,
            detail: { name: created.name, email: created.email, role: created.role, isActive: created.isActive }
        });
        res.redirect('/admin/users?success=created');
    } catch (err) {
        const msg = isUniqueError(err) ? 'Username atau email sudah dipakai.' : 'Gagal menyimpan user.';
        res.render('users/create', { form, roles, error: msg, path: 'users' });
    }
};

const getEditUser = async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!user) return res.redirect('/admin/users?error=notfound');
    const roles = await getRoleNames();
    res.render('users/edit', {
        user,
        roles,
        isSelf: user.id === req.user.id,
        error: null,
        path: 'users'
    });
};

// Mencegah admin terkunci: tidak boleh menonaktifkan/menurunkan diri sendiri,
// dan tidak boleh menghilangkan admin aktif terakhir.
async function checkLockoutRules(target, { newRole, newIsActive, isDelete, actorId }) {
    const losesAdmin = target.role === 'admin' && target.isActive &&
        (isDelete || newRole !== 'admin' || !newIsActive);

    if (target.id === actorId && (isDelete || losesAdmin)) {
        return 'Kamu tidak bisa menghapus, menonaktifkan, atau menurunkan role akunmu sendiri.';
    }
    if (losesAdmin) {
        const otherActiveAdmins = await prisma.user.count({
            where: { role: 'admin', isActive: true, id: { not: target.id } }
        });
        if (otherActiveAdmins === 0) {
            return 'Harus ada minimal satu admin aktif.';
        }
    }
    return null;
}

const postEditUser = async (req, res) => {
    const id = parseInt(req.params.id);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.redirect('/admin/users?error=notfound');

    const form = readForm(req.body);
    const roles = await getRoleNames();
    const isSelf = target.id === req.user.id;
    const error = validateInput(form, { requirePassword: false });

    const renderError = (msg) => res.render('users/edit', {
        user: { ...target, ...form, id: target.id },
        roles,
        isSelf,
        error: msg,
        path: 'users'
    });

    if (error || !roles.includes(form.role)) return renderError(error || 'Role tidak dikenal.');

    const ruleError = await checkLockoutRules(target, {
        newRole: form.role,
        newIsActive: form.isActive,
        isDelete: false,
        actorId: req.user.id
    });
    if (ruleError) return renderError(ruleError);

    try {
        const data = {
            name: form.name,
            username: form.username,
            email: form.email,
            role: form.role,
            isActive: form.isActive
        };
        if (form.password) data.password = await bcrypt.hash(form.password, 10);

        const updated = await prisma.user.update({ where: { id }, data });
        const changes = diffUser(target, updated);
        if (form.password) changes.password = 'diganti';
        if (Object.keys(changes).length > 0) {
            await recordAudit({ actor: req.user, action: 'USER_UPDATE', target: updated.username, detail: changes });
        }
        res.redirect('/admin/users?success=updated');
    } catch (err) {
        const msg = isUniqueError(err) ? 'Username atau email sudah dipakai.' : 'Gagal menyimpan user.';
        renderError(msg);
    }
};

const deleteUser = async (req, res) => {
    const id = parseInt(req.params.id);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.redirect('/admin/users?error=notfound');

    const ruleError = await checkLockoutRules(target, {
        isDelete: true,
        actorId: req.user.id
    });
    if (ruleError) return res.redirect(`/admin/users?error=${encodeURIComponent(ruleError)}`);

    try {
        await prisma.user.delete({ where: { id } });
        await recordAudit({
            actor: req.user,
            action: 'USER_DELETE',
            target: target.username,
            detail: { name: target.name, role: target.role, isActive: target.isActive }
        });
        res.redirect('/admin/users?success=deleted');
    } catch (err) {
        console.error('deleteUser error:', err.message);
        res.redirect('/admin/users?error=delete_failed');
    }
};

module.exports = {
    listUsers,
    getCreateUser,
    postCreateUser,
    getEditUser,
    postEditUser,
    deleteUser
};
