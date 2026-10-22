const bcrypt = require('bcryptjs');
const prisma = require('./src/config/database'); // Sesuaikan path ini dengan project-mu

const defaultQuestions = [
    // --- IMMERSIVE ROOM ---
    {
        categoryName: "IMMERSIVE ROOM",
        question: "Siapa nama tokoh karakter yang melakukan perjalanan waktu ke masa lalu, dalam cerita Immersive Room?",
        timer: 15,
        answers: [
            { answerText: "DELE", isCorrect: true },
            { answerText: "REGI", isCorrect: false }
        ]
    },
    {
        categoryName: "IMMERSIVE ROOM",
        question: "Siapa nama tokoh karakter yang pertama membuat catatan tentang makanan tempe di abad 16, dalam cerita Immersive Room?",
        timer: 15,
        answers: [
            { answerText: "PANGERAN TEMBAYAT", isCorrect: false },
            { answerText: "MAS CEMBOLANG", isCorrect: true }
        ]
    },
    {
        categoryName: "IMMERSIVE ROOM",
        question: "Kapan tempe mulai berlayar masuk ke benua eropa, dalam cerita Immersive Room?",
        timer: 15,
        answers: [
            { answerText: "ABAD 18", isCorrect: false },
            { answerText: "ABAD 21", isCorrect: true } // Sesuaikan jika jawaban benarnya Abad 18
        ]
    },
    {
        categoryName: "IMMERSIVE ROOM",
        question: "Dalam cerita di Immersive Room, di sebutkan sejarah catatan pertama yang menyebutkan tentang Tempe, catatan ini ada dalam tulisan bernama?",
        timer: 15,
        answers: [
            { answerText: "SERAT RANTINI", isCorrect: false },
            { answerText: "SERAT CENTHINI", isCorrect: true }
        ]
    },
    {
        categoryName: "IMMERSIVE ROOM",
        question: "Dalam cerita di Immersive Room, Karakter Dele di bantu oleh 2 temannya, yang bernama REGI dan…?",
        timer: 15,
        answers: [
            { answerText: "DAWUN", isCorrect: true },
            { answerText: "PIPIK", isCorrect: false }
        ]
    },
    {
        categoryName: "IMMERSIVE ROOM",
        question: "Dalam cerita di Immersive Room, dijelaskan bahwa dalam kosa kata bahasa jawa kuno, terdapat istilah awal kata tempe, yaitu?",
        timer: 15,
        answers: [
            { answerText: "TAMPU", isCorrect: false },
            { answerText: "TUMPI", isCorrect: true }
        ]
    },
    {
        categoryName: "IMMERSIVE ROOM",
        question: "Dalam cerita di Immersive Room, dijelaskan mengenai catatan awal berdirinya pabrik tempe di Belanda, yaitu di tahun?",
        timer: 15,
        answers: [
            { answerText: "1986", isCorrect: false },
            { answerText: "1945", isCorrect: true } // Sesuaikan jika 1986 yang benar
        ]
    },

    // --- TEMPE WARRIOR ---
    {
        categoryName: "TEMPE WARRIOR",
        question: "Di area tempe warrior, ada penayangan video tentang seorang pembuat tempe benguk yang berasal dari Kulon Progo, siapakah dia?",
        timer: 15,
        answers: [
            { answerText: "BU ROHAYAH", isCorrect: true },
            { answerText: "BU PAINAH", isCorrect: false }
        ]
    },
    {
        categoryName: "TEMPE WARRIOR",
        question: "Di area tempe warrior, ada penayangan video tentang seorang pembuat & yang mengenalkan tempe KORO, siapakah dia?",
        timer: 15,
        answers: [
            { answerText: "BU TUMINAH", isCorrect: false },
            { answerText: "BU TUGIYEM", isCorrect: true }
        ]
    },
    {
        categoryName: "TEMPE WARRIOR",
        question: "Di area tempe warrior, ada penayangan video tentang pembuatan secara tradisional Tempeh Benguk, terbuat dari apakah bahan bakunya?",
        timer: 15,
        answers: [
            { answerText: "KACANG MEDE", isCorrect: false },
            { answerText: "KACANG KORO BENGUK", isCorrect: true }
        ]
    },

    // --- DIGITAL INTERACTIVE ANIMATION - PROSES PEMBUATAN TEMPE ---
    {
        categoryName: "DIGITAL INTERACTIVE ANIMATION - PROSES PEMBUATAN TEMPE",
        question: "Langkah awal dalam proses pembuatan tempe tradisional adalah membersihkan kotoran yang menempel pada biji kedelai., tahap ini disebut dengan?",
        timer: 15,
        answers: [
            { answerText: "MENCUCI KEDELAI", isCorrect: true },
            { answerText: "MENGGILING KEDELAI", isCorrect: false }
        ]
    },
    {
        categoryName: "DIGITAL INTERACTIVE ANIMATION - PROSES PEMBUATAN TEMPE",
        question: "Setelah kedelai bersih dan digiling, langkah krusial untuk memulai proses fermentasi agar kedelai berubah menjadi tempe adalah?",
        timer: 15,
        answers: [
            { answerText: "MEMBUNGKUS KEDELAI DENGAN DAUN", isCorrect: false },
            { answerText: "PENAMBAHAN RAGI", isCorrect: true }
        ]
    },
    {
        categoryName: "DIGITAL INTERACTIVE ANIMATION - PROSES PEMBUATAN TEMPE",
        question: "Pada metode pembuatan tradisional, bahan alami yang digunakan sebagai wadah untuk membungkus kedelai selama masa fermentasi adalah?",
        timer: 15,
        answers: [
            { answerText: "DAUN (SEPERTI DAUN PISANG ATAU DAUN JATI)", isCorrect: true },
            { answerText: "PLASTIK KEDAP UDARA", isCorrect: false }
        ]
    },

    // --- WORLD OF SOYBEAN ---
    {
        categoryName: "WORLD OF SOYBEAN",
        question: "Varietas unggul kedelai yang paling banyak di gunakan petani di Indonesia adalah ?",
        timer: 15,
        answers: [
            { answerText: "ANJASMORO", isCorrect: true },
            { answerText: "GROBOGAN", isCorrect: false }
        ]
    },
    {
        categoryName: "WORLD OF SOYBEAN",
        question: "Varietas unggul kedelai MAHAMERU di Indoonesia, paling banyak ditemukan di propinsi?",
        timer: 15,
        answers: [
            { answerText: "ACEH", isCorrect: true },
            { answerText: "SULAWESI SELATAN", isCorrect: false }
        ]
    },
    {
        categoryName: "WORLD OF SOYBEAN",
        question: "Jumlah petani kedelai di Indonesia, saat ini estimasi jumlahnya mencpai berapa ?",
        timer: 15,
        answers: [
            { answerText: "15 JUTA PETANI", isCorrect: false },
            { answerText: "15 RIBU PETANI", isCorrect: true }
        ]
    },
    {
        categoryName: "WORLD OF SOYBEAN",
        question: "Di area world of soybean, ada penjelaskan informasi tentang?",
        timer: 15,
        answers: [
            { answerText: "PROFIL PEMBUAT TEMPE", isCorrect: false },
            { answerText: "SEJARAH KEDELAI", isCorrect: true }
        ]
    },
    {
        categoryName: "WORLD OF SOYBEAN",
        question: "Varietas unggul kedelai WILIS di Indoonesia, paling banyak ditemukan di propinsi?",
        timer: 15,
        answers: [
            { answerText: "JAWA TIMUR", isCorrect: true },
            { answerText: "JAWA BARAT", isCorrect: false }
        ]
    },

    // --- RAGI & MYCELIUM ---
    {
        categoryName: "RAGI & MYCELIUM",
        question: "Dalam proses pembuatan tempe, kedelai akan di fermetasi dengan cara ditaburkan RAGI yang bernama latin?",
        timer: 15,
        answers: [
            { answerText: "RHIZOPUS OLIGOSPORUS", isCorrect: true },
            { answerText: "AGARICUS BISPORUS", isCorrect: false }
        ]
    },
    {
        categoryName: "RAGI & MYCELIUM",
        question: "Dalam proses fermentasi tempe, terjadi proses pengiktan dari jamur yang membuat kedelai menjadi lebih padat, bentukya seperti benang putih, istilah ilmiahnya adalah?",
        timer: 15,
        answers: [
            { answerText: "EKOLOGI", isCorrect: false },
            { answerText: "MISELIUM", isCorrect: true }
        ]
    },

    // --- TEMPE PRODUCTION ---
    {
        categoryName: "TEMPE PRODUCTION",
        question: "Dalam proses produksi tempe, Apa tahap paling awal yang harus dilakukan terhadap kacang kedelai mentah untuk melunakkan teksturnya?",
        timer: 15,
        answers: [
            { answerText: "MENCUCI DAN MERENDAM KACANG KEDELAI", isCorrect: true },
            { answerText: "MEMBUNGKUS KACANG KEDELAI DENGAN DAUN PISANG", isCorrect: false }
        ]
    },
    {
        categoryName: "TEMPE PRODUCTION",
        question: "Dalam proses produksi tempe, Setelah kacang kedelai dimasak atau direbus, tindakan apa yang perlu dilakukan agar jamur tempe dapat tumbuh merata pada biji kedelai?",
        timer: 15,
        answers: [
            { answerText: "MENAMBAHKAN GARAM DAPUR DALAM JUMLAH BANYAK", isCorrect: false },
            { answerText: "MENGUPAS KULIT ARI KACANG KEDELAI", isCorrect: true }
        ]
    },
    {
        categoryName: "TEMPE PRODUCTION",
        question: "Dalam proses produksi tempe, Mengapa kacang kedelai yang sudah matang harus dipastikan kering (tiris) dari air sebelum diberi ragi?",
        timer: 15,
        answers: [
            { answerText: "AGAR TEKSTUR TEMPE MENJADI KERAS SEPERTI BATU SAAT DIGORENG", isCorrect: false },
            { answerText: "AGAR RAGI DAPAT BEKERJA OPTIMAL DAN MENGHINDARI PEMBUSUKAN", isCorrect: true }
        ]
    },
    {
        categoryName: "TEMPE PRODUCTION",
        question: "Dalam proses produksi tempe, Kapan waktu yang paling tepat untuk mencampurkan ragi ke dalam kacang kedelai?",
        timer: 15,
        answers: [
            { answerText: "SAAT KEDELAI SUDAH DALAM KONDISI KERING DAN SUHU SUDAH MENDINGIN", isCorrect: true },
            { answerText: "SAAT KEDELAI MASIH SANGAT PANAS MENDIDIH DI DALAM PANCI", isCorrect: false }
        ]
    },
    {
        categoryName: "TEMPE PRODUCTION",
        question: "Dalam proses produksi tempe tradisional, bahan apa yang paling umum digunakan untuk membungkus tempe?",
        timer: 15,
        answers: [
            { answerText: "DAUN PEPAYA", isCorrect: false },
            { answerText: "DAUN PISANG", isCorrect: true }
        ]
    }
];

async function main() {
    const password = await bcrypt.hash('admin123', 10);

    // 1. Create Admin if not exists
    const existingAdmin = await prisma.user.findFirst({
        where: { email: 'admin@mail.com' }
    });

    if (!existingAdmin) {
        await prisma.user.create({
            data: {
                name: 'Administrator',
                email: 'admin@mail.com',
                password,
                role: 'admin'
            }
        });
        console.log('Admin created successfully');
    } else {
        console.log('Admin already exists');
    }

    // 2. Find or Create the Tempe Park Quiz
    let quiz = await prisma.quiz.findFirst({
        where: { title: "Tempe Park - Tempe Gacha" }
    });

    if (!quiz) {
        quiz = await prisma.quiz.create({
            data: {
                title: "Tempe Park - Tempe Gacha",
                description: "Jawab Kuisnya, Ambil Gachanya!",
                status: true
            }
        });
        console.log('Quiz "Tempe Park - Tempe Gacha" created successfully');
    } else {
        console.log('Quiz "Tempe Park - Tempe Gacha" already exists');
    }

    // 3. Ekstrak unik kategori dari defaultQuestions
    const categoryNames = [...new Set(defaultQuestions.map(q => q.categoryName))];
    const categoryMap = {};

    // 4. Find or Create Categories
    for (const name of categoryNames) {
        let category = await prisma.category.findFirst({
            where: { name: name }
        });

        if (!category) {
            category = await prisma.category.create({
                data: { name: name }
            });
            console.log(`Category "${name}" created successfully`);
        }
        categoryMap[name] = category.id; // Simpan ID untuk referensi relasi ke soal
    }

    // 5. Tambahkan Question (dengan categoryId) dan Answer nya
    let addedQuestionsCount = 0;

    for (const qData of defaultQuestions) {
        const existingQuestion = await prisma.question.findFirst({
            where: {
                quizId: quiz.id,
                question: qData.question
            }
        });

        if (!existingQuestion) {
            // Create question dengan relasi ke categoryId
            const newQuestion = await prisma.question.create({
                data: {
                    quizId: quiz.id,
                    categoryId: categoryMap[qData.categoryName], // Menyisipkan kategori di sini
                    question: qData.question,
                    timer: qData.timer
                }
            });

            // Create answers untuk question ini
            const answersData = qData.answers.map(ans => ({
                questionId: newQuestion.id,
                answerText: ans.answerText,
                isCorrect: ans.isCorrect
            }));

            await prisma.answer.createMany({
                data: answersData
            });

            addedQuestionsCount++;
        }
    }

    if (addedQuestionsCount > 0) {
        console.log(`Successfully added ${addedQuestionsCount} new categorized questions to the Tempe Park quiz.`);
    } else {
        console.log('All default categorized questions are already present in the database.');
    }

    // 6. Create default GachaSetting if not exists
    const existingSetting = await prisma.gachaSetting.findUnique({ where: { id: 1 } });
    if (!existingSetting) {
        await prisma.gachaSetting.create({
            data: { id: 1, minCorrectAnswers: 3 }
        });
        console.log('Default gacha setting created (minCorrectAnswers: 3)');
    } else {
        console.log('Gacha setting already exists');
    }

    // 7. Create default booths if not exists
    const defaultBooths = [
        { name: 'Booth 1', description: 'Booth kuis utama' },
        { name: 'Booth 2', description: 'Booth kuis kedua' },
        { name: 'Booth 3', description: 'Booth kuis ketiga' }
    ];

    for (const boothData of defaultBooths) {
        const existingBooth = await prisma.booth.findFirst({ where: { name: boothData.name } });
        if (!existingBooth) {
            await prisma.booth.create({ data: boothData });
            console.log(`Booth "${boothData.name}" created successfully`);
        } else {
            console.log(`Booth "${boothData.name}" already exists`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });