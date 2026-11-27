const { paginate, parsePage } = require('../helpers/pagination');
const prisma = require('../config/database');

const listUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = parsePage(req);
        const offset = (page - 1) * limit;
        
        const [users, total] = await Promise.all([
            prisma.user.findMany({ orderBy: { id: 'asc' }, skip: offset, take: limit }),
            prisma.user.count()
        ]);

        const meta = paginate(total, page, limit);
        
        res.render('users/index', {
            users,
            currentUserId: req.user.id,
            success: req.query.success || null,
            error: req.query.error || null,
            meta,
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
            data: { name: form.name, username: form.username, email: form.email, 
                   password, role: form.role, isActive: form.isActive }
        });
        await recordAudit({ actor: req.user, action: 'USER_CREATE', target: created.username, 
            detail: { name: created.name, email: created.email, role: created.role, isActive: created.isActive } });
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

const postEditUser = async (req, res) => {
    const id = parseInt(req.params.id);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.redirect('/admin/users?error=notfound');

    const form = readForm(req.body);
    const roles = await getRoleNames();
    const isSelf = target.id === req.user.id;
    const renderError = (msg) => res.render('users/edit', {
        user: { ...target, ...form, id: target.id },
        roles,
        isSelf,
        error: msg,
        path: 'users'
    });

    if (error || !roles.includes(form.role)) return renderError(error || 'Role tidak dikenal.');

    const ruleError = await checkLockoutRules(target, { newRole: form.role, newIsActive: form.isActive, isDelete: false, actorId: req.user.id });
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

    const ruleError = await checkLockoutRules(target, { isDelete: true, actorId: req.user.id });
    if (ruleError) return res.redirect(`/admin/users?error=${encodeURIComponent(ruleError)}`);

    try {
        await prisma.user.delete({ where: { id } });
        await recordAudit({ actor: req.user, action: 'USER_DELETE', target: target.username, 
            detail: { name: target.name, role: target.role, isActive: target.isActive } });
        res.redirect('/admin/users?success=deleted');
    } catch (err) {
        console.error('deleteUser error:', err.message);
        res.redirect('/admin/users?error=delete_failed');
    }
};

function renderError(msg) {
    res.render('users/edit', { user: { ...target, ...form }, roles, isSelf, error: msg, path: 'users' });
}

module.exports = {
    listUsers,
    getCreateUser,
    postCreateUser,
    getEditUser,
    postEditUser,
    deleteUser
};