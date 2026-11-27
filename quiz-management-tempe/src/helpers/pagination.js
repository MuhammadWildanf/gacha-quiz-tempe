/**
 * Helper pagination untuk tabel.
 * Digunakan bersama Prisma skip/take.
 *
 * Contoh penggunaan di controller:
 *   const page = Math.max(1, parseInt(req.query.page, 10) || 1);
 *   const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
 *   const offset = (page - 1) * limit;
 *   const [rows, total] = await Promise.all([
 *     prisma.model.findMany({ skip: offset, take: limit, ... }),
 *     prisma.model.count({ where })
 *   ]);
 *   const meta = paginate(total, page, limit);
 *
 * Respon view: { items: rows, ...meta, filters, path }
 */
function paginate(total, page, limit) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(totalPages, Math.max(1, page));
    const offset = (currentPage - 1) * limit;
    return {
        page: currentPage,
        limit,
        total,
        totalPages,
        offset,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages,
        start: total === 0 ? 0 : offset + 1,
        end: Math.min(offset + limit, total)
    };
}

/**
 * Parse parameter halaman dari query string dengan aman.
 */
function parsePage(req, defaultLimit = 20, maxLimit = 100) {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
    return { page, limit };
}

module.exports = { paginate, parsePage };
