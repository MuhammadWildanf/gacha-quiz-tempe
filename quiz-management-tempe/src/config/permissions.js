const PERMISSIONS = {
    'dashboard.view': 'Lihat dashboard',
    'quiz.manage': 'Kelola quiz & soal',
    'category.manage': 'Kelola kategori soal',
    'gacha.settings': 'Pengaturan gacha',
    'booth.manage': 'Kelola booth',
    'user.manage': 'Kelola user',
    'role.manage': 'Atur hak akses role',
    'stocklog.view': 'Lihat log stok',
    'audit.view': 'Lihat audit log perubahan user & role',
    'stock.update': 'Ubah stok (Unity)',
    'machine.config': 'Ubah pengaturan mesin (Unity)'
};

const DEFAULT_ROLES = {
    admin: {
        description: 'Administrator (semua akses, tidak bisa dibatasi)',
        permissions: Object.keys(PERMISSIONS)
    },
    operator: {
        description: 'Operator (quiz, kategori, dan stok)',
        permissions: ['quiz.manage', 'category.manage', 'stock.update']
    }
};

module.exports = { PERMISSIONS, DEFAULT_ROLES };
