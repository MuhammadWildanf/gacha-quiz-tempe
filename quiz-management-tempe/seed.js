const bcrypt = require('bcryptjs');
const prisma = require('./src/config/database'); // Sesuaikan path ini dengan project-mu

const defaultQuestions = [
    // --- Immersive Room ---
    {
        categoryName: "Immersive Room",
        question: "Siapa nama tokoh karakter yang melakukan perjalanan waktu ke masa lalu dalam cerita Immersive Room?",
        timer: 15,
        answers: [
            { answerText: "Dele", isCorrect: true },
            { answerText: "Regi", isCorrect: false }
        ]
    },
    {
        categoryName: "Immersive Room",
        question: "Siapa nama tokoh karakter yang pertama membuat catatan tentang makanan tempe di abad ke-16 dalam cerita Immersive Room?",
        timer: 15,
        answers: [
            { answerText: "Pangeran Tembayat", isCorrect: false },
            { answerText: "Mas Cembolang", isCorrect: true }
        ]
    },
    {
        categoryName: "Immersive Room",
        question: "Kapan tempe mulai berlayar masuk ke benua Eropa dalam cerita Immersive Room?",
        timer: 15,
        answers: [
            { answerText: "Abad ke-18", isCorrect: false },
            { answerText: "Abad ke-21", isCorrect: true } // Sesuaikan jika jawaban benarnya Abad ke-18
        ]
    },
    {
        categoryName: "Immersive Room",
        question: "Dalam cerita di Immersive Room, disebutkan sejarah catatan pertama yang menyebutkan tentang tempe. Catatan ini ada dalam tulisan bernama?",
        timer: 15,
        answers: [
            { answerText: "Serat Rantini", isCorrect: false },
            { answerText: "Serat Centhini", isCorrect: true }
        ]
    },
    {
        categoryName: "Immersive Room",
        question: "Dalam cerita di Immersive Room, karakter Dele dibantu oleh 2 temannya, yaitu Regi dan...?",
        timer: 15,
        answers: [
            { answerText: "Dawun", isCorrect: true },
            { answerText: "Pipik", isCorrect: false }
        ]
    },
    {
        categoryName: "Immersive Room",
        question: "Dalam cerita di Immersive Room, dijelaskan bahwa dalam kosakata bahasa Jawa kuno terdapat istilah awal kata tempe, yaitu?",
        timer: 15,
        answers: [
            { answerText: "Tampu", isCorrect: false },
            { answerText: "Tumpi", isCorrect: true }
        ]
    },
    {
        categoryName: "Immersive Room",
        question: "Dalam cerita di Immersive Room, dijelaskan mengenai catatan awal berdirinya pabrik tempe di Belanda, yaitu pada tahun?",
        timer: 15,
        answers: [
            { answerText: "1986", isCorrect: false },
            { answerText: "1945", isCorrect: true } // Sesuaikan jika 1986 yang benar
        ]
    },

    // --- Tempe Warrior ---
    {
        categoryName: "Tempe Warrior",
        question: "Di area Tempe Warrior, ada penayangan video tentang seorang pembuat tempe benguk yang berasal dari Kulon Progo, siapakah dia?",
        timer: 15,
        answers: [
            { answerText: "Bu Rohayah", isCorrect: true },
            { answerText: "Bu Painah", isCorrect: false }
        ]
    },
    {
        categoryName: "Tempe Warrior",
        question: "Di area Tempe Warrior, ada penayangan video tentang seorang pembuat dan yang mengenalkan tempe koro, siapakah dia?",
        timer: 15,
        answers: [
            { answerText: "Bu Tuminah", isCorrect: false },
            { answerText: "Bu Tugiyem", isCorrect: true }
        ]
    },
    {
        categoryName: "Tempe Warrior",
        question: "Di area Tempe Warrior, ada penayangan video tentang pembuatan tempe benguk secara tradisional. Terbuat dari apakah bahan bakunya?",
        timer: 15,
        answers: [
            { answerText: "Kacang mede", isCorrect: false },
            { answerText: "Kacang koro benguk", isCorrect: true }
        ]
    },

    // --- Digital Interactive Animation - Proses Pembuatan Tempe ---
    {
        categoryName: "Digital Interactive Animation - Proses Pembuatan Tempe",
        question: "Langkah awal dalam proses pembuatan tempe tradisional adalah membersihkan kotoran yang menempel pada biji kedelai. Tahap ini disebut dengan?",
        timer: 15,
        answers: [
            { answerText: "Mencuci kedelai", isCorrect: true },
            { answerText: "Menggiling kedelai", isCorrect: false }
        ]
    },
    {
        categoryName: "Digital Interactive Animation - Proses Pembuatan Tempe",
        question: "Setelah kedelai bersih dan digiling, langkah krusial untuk memulai proses fermentasi agar kedelai berubah menjadi tempe adalah?",
        timer: 15,
        answers: [
            { answerText: "Membungkus kedelai dengan daun", isCorrect: false },
            { answerText: "Penambahan ragi", isCorrect: true }
        ]
    },
    {
        categoryName: "Digital Interactive Animation - Proses Pembuatan Tempe",
        question: "Pada metode pembuatan tradisional, bahan alami yang digunakan sebagai wadah untuk membungkus kedelai selama masa fermentasi adalah?",
        timer: 15,
        answers: [
            { answerText: "Daun (seperti daun pisang atau daun jati)", isCorrect: true },
            { answerText: "Plastik kedap udara", isCorrect: false }
        ]
    },

    // --- World of Soybean ---
    {
        categoryName: "World of Soybean",
        question: "Varietas unggul kedelai yang paling banyak digunakan petani di Indonesia adalah?",
        timer: 15,
        answers: [
            { answerText: "Anjasmoro", isCorrect: true },
            { answerText: "Grobogan", isCorrect: false }
        ]
    },
    {
        categoryName: "World of Soybean",
        question: "Varietas unggul kedelai Mahameru di Indonesia paling banyak ditemukan di provinsi?",
        timer: 15,
        answers: [
            { answerText: "Aceh", isCorrect: true },
            { answerText: "Sulawesi Selatan", isCorrect: false }
        ]
    },
    {
        categoryName: "World of Soybean",
        question: "Jumlah petani kedelai di Indonesia saat ini estimasi jumlahnya mencapai berapa?",
        timer: 15,
        answers: [
            { answerText: "15 juta petani", isCorrect: false },
            { answerText: "15 ribu petani", isCorrect: true }
        ]
    },
    {
        categoryName: "World of Soybean",
        question: "Di area World of Soybean, ada penjelasan informasi tentang?",
        timer: 15,
        answers: [
            { answerText: "Profil pembuat tempe", isCorrect: false },
            { answerText: "Sejarah kedelai", isCorrect: true }
        ]
    },
    {
        categoryName: "World of Soybean",
        question: "Varietas unggul kedelai Wilis di Indonesia paling banyak ditemukan di provinsi?",
        timer: 15,
        answers: [
            { answerText: "Jawa Timur", isCorrect: true },
            { answerText: "Jawa Barat", isCorrect: false }
        ]
    },

    // --- Ragi & Mycelium ---
    {
        categoryName: "Ragi & Mycelium",
        question: "Dalam proses pembuatan tempe, kedelai akan difermentasi dengan cara ditaburkan ragi yang bernama Latin?",
        timer: 15,
        answers: [
            { answerText: "Rhizopus oligosporus", isCorrect: true },
            { answerText: "Agaricus bisporus", isCorrect: false }
        ]
    },
    {
        categoryName: "Ragi & Mycelium",
        question: "Dalam proses fermentasi tempe, terjadi proses pengikatan dari jamur yang membuat kedelai menjadi lebih padat dan bentuknya seperti benang putih. Istilah ilmiahnya adalah?",
        timer: 15,
        answers: [
            { answerText: "Ekologi", isCorrect: false },
            { answerText: "Miselium", isCorrect: true }
        ]
    },

    // --- Tempe Production ---
    {
        categoryName: "Tempe Production",
        question: "Dalam proses produksi tempe, apa tahap paling awal yang harus dilakukan terhadap kacang kedelai mentah untuk melunakkan teksturnya?",
        timer: 15,
        answers: [
            { answerText: "Mencuci dan merendam kacang kedelai", isCorrect: true },
            { answerText: "Membungkus kacang kedelai dengan daun pisang", isCorrect: false }
        ]
    },
    {
        categoryName: "Tempe Production",
        question: "Dalam proses produksi tempe, setelah kacang kedelai dimasak atau direbus, tindakan apa yang perlu dilakukan agar jamur tempe dapat tumbuh merata pada biji kedelai?",
        timer: 15,
        answers: [
            { answerText: "Menambahkan garam dapur dalam jumlah banyak", isCorrect: false },
            { answerText: "Mengupas kulit ari kacang kedelai", isCorrect: true }
        ]
    },
    {
        categoryName: "Tempe Production",
        question: "Dalam proses produksi tempe, mengapa kacang kedelai yang sudah matang harus dipastikan kering (tiris) dari air sebelum diberi ragi?",
        timer: 15,
        answers: [
            { answerText: "Agar tekstur tempe menjadi keras seperti batu saat digoreng", isCorrect: false },
            { answerText: "Agar ragi dapat bekerja optimal dan menghindari pembusukan", isCorrect: true }
        ]
    },
    {
        categoryName: "Tempe Production",
        question: "Dalam proses produksi tempe, kapan waktu yang paling tepat untuk mencampurkan ragi ke dalam kacang kedelai?",
        timer: 15,
        answers: [
            { answerText: "Saat kedelai sudah dalam kondisi kering dan suhu sudah mendingin", isCorrect: true },
            { answerText: "Saat kedelai masih sangat panas mendidih di dalam panci", isCorrect: false }
        ]
    },
    {
        categoryName: "Tempe Production",
        question: "Dalam proses produksi tempe tradisional, bahan apa yang paling umum digunakan untuk membungkus tempe?",
        timer: 15,
        answers: [
            { answerText: "Daun pepaya", isCorrect: false },
            { answerText: "Daun pisang", isCorrect: true }
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