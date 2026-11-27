const { paginate, parsePage } = require('../helpers/pagination');
const prisma = require('../config/database');

function readForm(body) {
    return {
        name: String(body.name || '').trim(),
        nameEn: String(body.nameEn || '').trim() || null,
        description: String(body.description || '').trim() || null
    };
}

function isUniqueError(error) {
    return error && error.code === 'P2002';
}

const listCategories = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = parsePage(req);
        const offset = (page - 1) * limit;
        
        const [categories, total] = await Promise.all([
            prisma.category.findMany({
                orderBy: { name: 'asc' },
                skip: offset,
                take: limit,
                include: { _count: { select: { questions: true } } }
            }),
            prisma.category.count()
        ]);

        const meta = paginate(total, page, limit);
        
        res.render('categories/index', {
            categories,
            path: 'categories',
            success: req.query.success || null,
            error: req.query.error || null,
            meta,
            filters: { page, limit }
        });
    } catch (error) {
        console.error('listCategories error:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const getCreateCategory = (req, res) => {
    res.render('categories/create', { form: { name: '', nameEn: '', description: '' }, error: null, path: 'categories' });
};

const postCreateCategory = async (req, res) => {
    const form = readForm(req.body);
    if (!form.name) {
        return res.render('categories/create', { form, error: 'Nama kategori wajib diisi.', path: 'categories' });
    }
    try {
        await prisma.category.create({ data: form });
        res.redirect('/admin/categories?success=created');
    } catch (error) {
        const msg = isUniqueError(error) ? 'Nama kategori sudah ada.' : 'Gagal menyimpan kategori.';
        res.render('categories/create', { form, error: msg, path: 'categories' });
    }
};

const getEditCategory = async (req, res) => {
    const category = await prisma.category.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!category) return res.redirect('/admin/categories?error=notfound');
    res.render('categories/edit', { category, error: null, path: 'categories' });
};

const postEditCategory = async (req, res) => {
    const id = parseInt(req.params.id);
    const form = readForm(req.body);
    const category = { id, ...form };
    if (!form.name) {
        return res.render('categories/edit', { category, error: 'Nama kategori wajib diisi.', path: 'categories' });
    }
    try {
        await prisma.category.update({ where: { id }, data: form });
        res.redirect('/admin/categories?success=updated');
    } catch (error) {
        const msg = isUniqueError(error) ? 'Nama kategori sudah ada.' : 'Gagal menyimpan kategori.';
        res.render('categories/edit', { category, error: msg, path: 'categories' });
    }
};

const deleteCategory = async (req, res) => {
    try {
        await prisma.category.delete({ where: { id: parseInt(req.params.id) } });
        res.redirect('/admin/categories?success=deleted');
    } catch (error) {
        console.error('deleteCategory error:', error.message);
        res.redirect('/admin/categories?error=delete_failed');
    }
};

module.exports = {
    listCategories,
    getCreateCategory,
    postCreateCategory,
    getEditCategory,
    postEditCategory,
    deleteCategory
};