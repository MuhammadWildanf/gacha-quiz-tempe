const bcrypt = require('bcryptjs');
const prisma = require('./src/config/database'); // Sesuaikan path ini dengan project-mu
const { DEFAULT_ROLES } = require('./src/config/permissions');

const defaultQuestions = [
    // --- Immersive Room ---
    {
        categoryName: "Immersive Room",
        categoryNameEn: "Immersive Room",
        question: "Siapa nama tokoh karakter yang melakukan perjalanan waktu ke masa lalu dalam cerita Immersive Room?",
        questionEn: "What is the name of the character who travels back in time in the Immersive Room story?",
        timer: 15,
        answers: [
            { answerText: "Dele", answerTextEn: "Dele", isCorrect: true },
            { answerText: "Regi", answerTextEn: "Regi", isCorrect: false }
        ]
    },
    {
        categoryName: "Immersive Room",
        categoryNameEn: "Immersive Room",
        question: "Siapa nama tokoh karakter yang pertama membuat catatan tentang makanan tempe di abad ke-16 dalam cerita Immersive Room?",
        questionEn: "What is the name of the character who first wrote a record about tempe as a food in the 16th century, in the Immersive Room story?",
        timer: 15,
        answers: [
            { answerText: "Pangeran Tembayat", answerTextEn: "Prince Tembayat", isCorrect: false },
            { answerText: "Mas Cembolang", answerTextEn: "Mas Cembolang", isCorrect: true }
        ]
    },
    {
        categoryName: "Immersive Room",
        categoryNameEn: "Immersive Room",
        question: "Kapan tempe mulai berlayar masuk ke benua Eropa dalam cerita Immersive Room?",
        questionEn: "When did tempe begin to sail into Europe, according to the Immersive Room story?",
        timer: 15,
        answers: [
            { answerText: "Abad ke-18", answerTextEn: "18th Century", isCorrect: false },
            { answerText: "Abad ke-21", answerTextEn: "21st Century", isCorrect: true }
        ]
    },
    {
        categoryName: "Immersive Room",
        categoryNameEn: "Immersive Room",
        question: "Dalam cerita di Immersive Room, disebutkan sejarah catatan pertama yang menyebutkan tentang tempe. Catatan ini ada dalam tulisan bernama?",
        questionEn: "The Immersive Room story mentions the first historical record of tempe. What is the name of the text it appears in?",
        timer: 15,
        answers: [
            { answerText: "Serat Rantini", answerTextEn: "Serat Rantini", isCorrect: false },
            { answerText: "Serat Centhini", answerTextEn: "Serat Centhini", isCorrect: true }
        ]
    },
    {
        categoryName: "Immersive Room",
        categoryNameEn: "Immersive Room",
        question: "Dalam cerita di Immersive Room, karakter Dele dibantu oleh 2 temannya, yaitu Regi dan...?",
        questionEn: "In the Immersive Room story, Dele is helped by two friends. One is Regi. Who is the other?",
        timer: 15,
        answers: [
            { answerText: "Dawun", answerTextEn: "Dawun", isCorrect: true },
            { answerText: "Pipik", answerTextEn: "Pipik", isCorrect: false }
        ]
    },
    {
        categoryName: "Immersive Room",
        categoryNameEn: "Immersive Room",
        question: "Dalam cerita di Immersive Room, dijelaskan bahwa dalam kosakata bahasa Jawa kuno terdapat istilah awal kata tempe, yaitu?",
        questionEn: "The Immersive Room story explains that Old Javanese vocabulary contains the earliest form of the word \"tempe.\" What is it?",
        timer: 15,
        answers: [
            { answerText: "Tampu", answerTextEn: "Tampu", isCorrect: false },
            { answerText: "Tumpi", answerTextEn: "Tumpi", isCorrect: true }
        ]
    },
    {
        categoryName: "Immersive Room",
        categoryNameEn: "Immersive Room",
        question: "Dalam cerita di Immersive Room, dijelaskan mengenai catatan awal berdirinya pabrik tempe di Belanda, yaitu pada tahun?",
        questionEn: "The Immersive Room story describes the earliest record of a tempe factory being established in the Netherlands. In what year was it?",
        timer: 15,
        answers: [
            { answerText: "1986", answerTextEn: "1986", isCorrect: false },
            { answerText: "1945", answerTextEn: "1945", isCorrect: true }
        ]
    },

    // --- Tempe Warrior / Traditional Process Area ---
    {
        categoryName: "Tempe Warrior",
        categoryNameEn: "Traditional Process Area",
        question: "Di area Tempe Warrior, ada penayangan video tentang seorang pembuat tempe benguk yang berasal dari Kulon Progo, siapakah dia?",
        questionEn: "In the Traditional Process Area, a video shows a maker of tempe benguk from Kulon Progo. Who is she?",
        timer: 15,
        answers: [
            { answerText: "Bu Rohayah", answerTextEn: "Mrs. Rohayah", isCorrect: true },
            { answerText: "Bu Painah", answerTextEn: "Mrs. Painah", isCorrect: false }
        ]
    },
    {
        categoryName: "Tempe Warrior",
        categoryNameEn: "Traditional Process Area",
        question: "Di area Tempe Warrior, ada penayangan video tentang seorang pembuat dan yang mengenalkan tempe koro, siapakah dia?",
        questionEn: "In the Traditional Process Area, a video shows a maker who introduced koro tempe. Who is she?",
        timer: 15,
        answers: [
            { answerText: "Bu Tuminah", answerTextEn: "Mrs. Tuminah", isCorrect: false },
            { answerText: "Bu Tugiyem", answerTextEn: "Mrs. Tugiyem", isCorrect: true }
        ]
    },
    {
        categoryName: "Tempe Warrior",
        categoryNameEn: "Traditional Process Area",
        question: "Di area Tempe Warrior, ada penayangan video tentang pembuatan tempe benguk secara tradisional. Terbuat dari apakah bahan bakunya?",
        questionEn: "In the Traditional Process Area, a video shows the traditional making of tempe benguk. What is the raw material?",
        timer: 15,
        answers: [
            { answerText: "Kacang mede", answerTextEn: "Cashew nuts", isCorrect: false },
            { answerText: "Kacang koro benguk", answerTextEn: "Koro benguk beans", isCorrect: true }
        ]
    },

    // --- Digital Interactive Animation - Proses Pembuatan Tempe ---
    {
        categoryName: "Digital Interactive Animation - Proses Pembuatan Tempe",
        categoryNameEn: "Digital Interactive Animation: Tempe-Making Process",
        question: "Langkah awal dalam proses pembuatan tempe tradisional adalah membersihkan kotoran yang menempel pada biji kedelai. Tahap ini disebut dengan?",
        questionEn: "The first step in traditional tempe making is removing the dirt clinging to the soybeans. What is this step called?",
        timer: 15,
        answers: [
            { answerText: "Mencuci kedelai", answerTextEn: "Washing the soybeans", isCorrect: true },
            { answerText: "Menggiling kedelai", answerTextEn: "Grinding the soybeans", isCorrect: false }
        ]
    },
    {
        categoryName: "Digital Interactive Animation - Proses Pembuatan Tempe",
        categoryNameEn: "Digital Interactive Animation: Tempe-Making Process",
        question: "Setelah kedelai bersih dan digiling, langkah krusial untuk memulai proses fermentasi agar kedelai berubah menjadi tempe adalah?",
        questionEn: "After the soybeans are cleaned and ground, what is the crucial step that starts the fermentation that turns soybeans into tempe?",
        timer: 15,
        answers: [
            { answerText: "Membungkus kedelai dengan daun", answerTextEn: "Wrapping the soybeans in leaves", isCorrect: false },
            { answerText: "Penambahan ragi", answerTextEn: "Adding the starter (ragi)", isCorrect: true }
        ]
    },
    {
        categoryName: "Digital Interactive Animation - Proses Pembuatan Tempe",
        categoryNameEn: "Digital Interactive Animation: Tempe-Making Process",
        question: "Pada metode pembuatan tradisional, bahan alami yang digunakan sebagai wadah untuk membungkus kedelai selama masa fermentasi adalah?",
        questionEn: "In the traditional method, what natural material is used to wrap the soybeans during fermentation?",
        timer: 15,
        answers: [
            { answerText: "Daun (seperti daun pisang atau daun jati)", answerTextEn: "Leaves (such as banana or teak leaves)", isCorrect: true },
            { answerText: "Plastik kedap udara", answerTextEn: "Airtight plastic", isCorrect: false }
        ]
    },

    // --- World of Soybean ---
    {
        categoryName: "World of Soybean",
        categoryNameEn: "World of Soybean",
        question: "Varietas unggul kedelai yang paling banyak digunakan petani di Indonesia adalah?",
        questionEn: "Which improved soybean variety is most widely used by farmers in Indonesia?",
        timer: 15,
        answers: [
            { answerText: "Anjasmoro", answerTextEn: "Anjasmoro", isCorrect: true },
            { answerText: "Grobogan", answerTextEn: "Grobogan", isCorrect: false }
        ]
    },
    {
        categoryName: "World of Soybean",
        categoryNameEn: "World of Soybean",
        question: "Varietas unggul kedelai Mahameru di Indonesia paling banyak ditemukan di provinsi?",
        questionEn: "In which province is the Mahameru improved soybean variety most commonly found in Indonesia?",
        timer: 15,
        answers: [
            { answerText: "Aceh", answerTextEn: "Aceh", isCorrect: true },
            { answerText: "Sulawesi Selatan", answerTextEn: "South Sulawesi", isCorrect: false }
        ]
    },
    {
        categoryName: "World of Soybean",
        categoryNameEn: "World of Soybean",
        question: "Jumlah petani kedelai di Indonesia saat ini estimasi jumlahnya mencapai berapa?",
        questionEn: "What is the current estimated number of soybean farmers in Indonesia?",
        timer: 15,
        answers: [
            { answerText: "15 juta petani", answerTextEn: "15 million farmers", isCorrect: false },
            { answerText: "15 ribu petani", answerTextEn: "15 thousand farmers", isCorrect: true }
        ]
    },
    {
        categoryName: "World of Soybean",
        categoryNameEn: "World of Soybean", question: "Di area World of Soybean, ada penjelasan informasi tentang?",
        questionEn: "What information is explained in the World of Soybean area?",
        timer: 15,
        answers: [
            { answerText: "Profil pembuat tempe", answerTextEn: "Profiles of tempe makers", isCorrect: false },
            { answerText: "Sejarah kedelai", answerTextEn: "History of soybeans", isCorrect: true }
        ]
    },
    {
        categoryName: "World of Soybean",
        categoryNameEn: "World of Soybean",
        question: "Varietas unggul kedelai Wilis di Indonesia paling banyak ditemukan di provinsi?",
        questionEn: "In which province is the Wilis improved soybean variety most commonly found in Indonesia?",
        timer: 15,
        answers: [
            { answerText: "Jawa Timur", answerTextEn: "East Java", isCorrect: true },
            { answerText: "Jawa Barat", answerTextEn: "West Java", isCorrect: false }
        ]
    },
    // --- Ragi & Mycelium ---
    {
        categoryName: "Ragi & Mycelium",
        categoryNameEn: "Ragi & Mycelium",
        question: "Dalam proses pembuatan tempe, kedelai akan difermentasi dengan cara ditaburkan ragi yang bernama Latin?",
        questionEn: "In tempe production, soybeans are fermented by sprinkling on a starter (ragi). What is its Latin name?",
        timer: 15,
        answers: [
            { answerText: "Rhizopus oligosporus", answerTextEn: "Rhizopus oligosporus", isCorrect: true },
            { answerText: "Agaricus bisporus", answerTextEn: "Agaricus bisporus", isCorrect: false }
        ]
    },
    {
        categoryName: "Ragi & Mycelium",
        categoryNameEn: "Ragi & Mycelium",
        question: "Dalam proses fermentasi tempe, terjadi proses pengikatan dari jamur yang membuat kedelai menjadi lebih padat dan bentuknya seperti benang putih. Istilah ilmiahnya adalah?",
        questionEn: "During tempe fermentation, the mold binds the soybeans together, making them denser, and forms white threadlike strands. What is the scientific term for these?",
        timer: 15,
        answers: [
            { answerText: "Ekologi", answerTextEn: "Ecology", isCorrect: false },
            { answerText: "Miselium", answerTextEn: "Mycelium", isCorrect: true }
        ]
    },
    // --- Tempe Production ---
    {
        categoryName: "Tempe Production",
        categoryNameEn: "Tempe Production",
        question: "Dalam proses produksi tempe, apa tahap paling awal yang harus dilakukan terhadap kacang kedelai mentah untuk melunakkan teksturnya?",
        questionEn: "In tempe production, what is the very first step for softening the texture of raw soybeans?",
        timer: 15,
        answers: [
            { answerText: "Mencuci dan merendam kacang kedelai", answerTextEn: "Washing and soaking the soybeans", isCorrect: true },
            { answerText: "Membungkus kacang kedelai dengan daun pisang", answerTextEn: "Wrapping the soybeans in banana leaves", isCorrect: false }
        ]
    },
    {
        categoryName: "Tempe Production",
        categoryNameEn: "Tempe Production",
        question: "Dalam proses produksi tempe, setelah kacang kedelai dimasak atau direbus, tindakan apa yang perlu dilakukan agar jamur tempe dapat tumbuh merata pada biji kedelai?",
        questionEn: "After the soybeans are cooked or boiled, what must be done so the tempe mold can grow evenly on the beans?",
        timer: 15,
        answers: [
            { answerText: "Menambahkan garam dapur dalam jumlah banyak", answerTextEn: "Adding a large amount of table salt", isCorrect: false },
            { answerText: "Mengupas kulit ari kacang kedelai", answerTextEn: "Removing the soybean skins", isCorrect: true }
        ]
    },
    {
        categoryName: "Tempe Production",
        categoryNameEn: "Tempe Production",
        question: "Dalam proses produksi tempe, mengapa kacang kedelai yang sudah matang harus dipastikan kering (tiris) dari air sebelum diberi ragi?",
        questionEn: "Why must cooked soybeans be thoroughly drained and dried before the starter is added?",
        timer: 15,
        answers: [
            { answerText: "Agar tekstur tempe menjadi keras seperti batu saat digoreng", answerTextEn: "So the tempe becomes hard as a rock when fried", isCorrect: false },
            { answerText: "Agar ragi dapat bekerja optimal dan menghindari pembusukan", answerTextEn: "So the starter can work optimally and spoilage is prevented", isCorrect: true }
        ]
    },
    {
        categoryName: "Tempe Production",
        categoryNameEn: "Tempe Production",
        question: "Dalam proses produksi tempe, kapan waktu yang paling tepat untuk mencampurkan ragi ke dalam kacang kedelai?",
        questionEn: "When is the best time to mix the starter into the soybeans?",
        timer: 15,
        answers: [
            { answerText: "Saat kedelai sudah dalam kondisi kering dan suhu sudah mendingin", answerTextEn: "When the soybeans are dry and have cooled down", isCorrect: true },
            { answerText: "Saat kedelai masih sangat panas mendidih di dalam panci", answerTextEn: "When the soybeans are still boiling hot in the pot", isCorrect: false }
        ]
    },

    // ============================================================
    // ADDITIONAL QUESTIONS (sumber: additional-question.md)
    // ============================================================

    // --- Immersive Room (tambahan) ---
    {
        categoryName: "Immersive Room",
        categoryNameEn: "Immersive Room",
        question: "Mengapa Serat Centhini dianggap penting dalam perjalanan sejarah tempe di Indonesia?",
        questionEn: "Why is Serat Centhini considered important in the history of tempe in Indonesia?",
        timer: 15,
        answers: [
            { answerText: "Karena memuat catatan tentang tempe", answerTextEn: "Because it contains a record of tempe", isCorrect: true },
            { answerText: "Karena menjelaskan cara budidaya kedelai", answerTextEn: "Because it explains how to cultivate soybeans", isCorrect: false }
        ]
    },
    {
        categoryName: "Immersive Room",
        categoryNameEn: "Immersive Room",
        question: "Dalam cerita Immersive Room, tokoh Mas Cembolang memiliki keterkaitan dengan sejarah tempe. Pada abad berapakah peristiwa tersebut berlangsung?",
        questionEn: "In the Immersive Room story, Mas Cembolang is associated with the history of tempe. In which century did this event take place?",
        timer: 15,
        answers: [
            { answerText: "Abad ke-16", answerTextEn: "16th Century", isCorrect: true },
            { answerText: "Abad ke-20", answerTextEn: "20th Century", isCorrect: false }
        ]
    },
    {
        categoryName: "Immersive Room",
        categoryNameEn: "Immersive Room",
        question: "Benua manakah yang menjadi tujuan penyebaran tersebut dalam cerita Immersive Room?",
        questionEn: "Which continent was its destination in the Immersive Room story?",
        timer: 15,
        answers: [
            { answerText: "Eropa", answerTextEn: "Europe", isCorrect: true },
            { answerText: "Afrika", answerTextEn: "Africa", isCorrect: false }
        ]
    },

    // --- Tempe Warrior / Traditional Process Area (tambahan) ---
    {
        categoryName: "Tempe Warrior",
        categoryNameEn: "Traditional Process Area",
        question: "Tempe tradisional Indonesia tidak hanya dibuat dari kedelai. Salah satu bahan alternatif yang ditampilkan dalam Traditional Process Area adalah ...",
        questionEn: "Traditional Indonesian tempe is not made only from soybeans. One alternative ingredient featured in the Traditional Process Area is ...",
        timer: 15,
        answers: [
            { answerText: "Kacang koro", answerTextEn: "Koro beans", isCorrect: true },
            { answerText: "Kacang hijau", answerTextEn: "Mung beans", isCorrect: false }
        ]
    },
    {
        categoryName: "Tempe Warrior",
        categoryNameEn: "Traditional Process Area",
        question: "Apa nilai penting yang dapat dipelajari dari video para pengrajin tempe tradisional di zona ini?",
        questionEn: "What important value can visitors learn from the videos of traditional tempe makers in this area?",
        timer: 15,
        answers: [
            { answerText: "Pelestarian pengetahuan dan keterampilan pembuatan tempe", answerTextEn: "Preserving traditional tempe-making knowledge and skills", isCorrect: true },
            { answerText: "Penggantian seluruh proses tradisional dengan mesin", answerTextEn: "Replacing all traditional processes with machines", isCorrect: false }
        ]
    },
    {
        categoryName: "Tempe Warrior",
        categoryNameEn: "Traditional Process Area",
        question: "Tempe benguk merupakan salah satu variasi tempe khas Indonesia. Bahan utama apa yang membedakannya dari tempe kedelai pada umumnya?",
        questionEn: "Tempe benguk is a traditional Indonesian tempe variety. Which main ingredient distinguishes it from ordinary soybean tempe?",
        timer: 15,
        answers: [
            { answerText: "Kacang benguk", answerTextEn: "Benguk beans", isCorrect: true },
            { answerText: "Kedelai hitam", answerTextEn: "Black soybeans", isCorrect: false }
        ]
    },

    // --- Digital Interactive Animation: Tempe-Making Process (tambahan) ---
    {
        categoryName: "Digital Interactive Animation - Proses Pembuatan Tempe",
        categoryNameEn: "Digital Interactive Animation: Tempe-Making Process",
        question: "Mengapa kedelai perlu dibersihkan sebelum memasuki tahapan pengolahan berikutnya?",
        questionEn: "Why must soybeans be cleaned before moving on to the next processing stage?",
        timer: 15,
        answers: [
            { answerText: "Untuk menghilangkan kotoran dan zat pengotor", answerTextEn: "To remove dirt and impurities", isCorrect: true },
            { answerText: "Untuk menambah kandungan gula", answerTextEn: "To increase their sugar content", isCorrect: false }
        ]
    },
    {
        categoryName: "Digital Interactive Animation - Proses Pembuatan Tempe",
        categoryNameEn: "Digital Interactive Animation: Tempe-Making Process",
        question: "Apa yang terjadi ketika ragi tempe ditambahkan ke dalam kedelai yang telah dipersiapkan dengan benar?",
        questionEn: "What happens when tempe starter is added to properly prepared soybeans?",
        timer: 15,
        answers: [
            { answerText: "Proses fermentasi dimulai", answerTextEn: "Fermentation begins", isCorrect: true },
            { answerText: "Kedelai langsung menjadi matang", answerTextEn: "The soybeans become fully cooked immediately", isCorrect: false }
        ]
    },
    {
        categoryName: "Digital Interactive Animation - Proses Pembuatan Tempe",
        categoryNameEn: "Digital Interactive Animation: Tempe-Making Process",
        question: "Mengapa daun pisang atau daun jati sering digunakan sebagai pembungkus dalam pembuatan tempe tradisional?",
        questionEn: "Why are banana or teak leaves commonly used as wrappers in traditional tempe production?",
        timer: 15,
        answers: [
            { answerText: "Sebagai pembungkus alami selama fermentasi", answerTextEn: "As natural wrappers during fermentation", isCorrect: true },
            { answerText: "Sebagai bahan utama pembentuk ragi", answerTextEn: "As the main ingredient used to make the starter", isCorrect: false }
        ]
    },

    // --- World of Soybean (tambahan) ---
    {
        categoryName: "World of Soybean",
        categoryNameEn: "World of Soybean",
        question: "Mengapa kedelai menjadi komoditas pertanian yang penting bagi masyarakat Indonesia?",
        questionEn: "Why are soybeans an important agricultural commodity for Indonesian society?",
        timer: 15,
        answers: [
            { answerText: "Karena menjadi bahan baku berbagai produk pangan", answerTextEn: "Because they are used as raw materials for various food products", isCorrect: true },
            { answerText: "Karena hanya digunakan sebagai pakan ternak", answerTextEn: "Because they are only used as animal feed", isCorrect: false }
        ]
    },
    {
        categoryName: "World of Soybean",
        categoryNameEn: "World of Soybean",
        question: "Berdasarkan informasi zona World of Soybean, varietas kedelai manakah yang dikenal banyak ditemukan di Jawa Timur?",
        questionEn: "According to the information in the World of Soybean area, which soybean variety is commonly found in East Java?",
        timer: 15,
        answers: [
            { answerText: "Wilis", answerTextEn: "Wilis", isCorrect: true },
            { answerText: "Mahameru", answerTextEn: "Mahameru", isCorrect: false }
        ]
    },
    {
        categoryName: "World of Soybean",
        categoryNameEn: "World of Soybean",
        question: "Apa tujuan utama pengembangan varietas unggul kedelai seperti Anjasmoro, Wilis, dan Mahameru?",
        questionEn: "What is the main purpose of developing improved soybean varieties such as Anjasmoro, Wilis, and Mahameru?",
        timer: 15,
        answers: [
            { answerText: "Meningkatkan kualitas dan produktivitas kedelai", answerTextEn: "To improve soybean quality and productivity", isCorrect: true },
            { answerText: "Mengurangi keberagaman varietas kedelai", answerTextEn: "To reduce soybean variety diversity", isCorrect: false }
        ]
    },

    // --- Ragi & Mycelium (tambahan) ---
    {
        categoryName: "Ragi & Mycelium",
        categoryNameEn: "Ragi & Mycelium",
        question: "Mikroorganisme apa yang berperan penting dalam proses fermentasi kedelai menjadi tempe?",
        questionEn: "Which microorganism plays an important role in fermenting soybeans into tempe?",
        timer: 15,
        answers: [
            { answerText: "Kapang (mold)", answerTextEn: "Mold", isCorrect: true },
            { answerText: "Alga (algae)", answerTextEn: "Algae", isCorrect: false }
        ]
    },
    {
        categoryName: "Ragi & Mycelium",
        categoryNameEn: "Ragi & Mycelium",
        question: "Bagaimana tampilan miselium yang tumbuh selama proses fermentasi tempe?",
        questionEn: "What does mycelium look like as it grows during tempe fermentation?",
        timer: 15,
        answers: [
            { answerText: "Benang-benang halus berwarna putih", answerTextEn: "Fine white thread-like structures", isCorrect: true },
            { answerText: "Lapisan cair berwarna kuning", answerTextEn: "A yellow liquid layer", isCorrect: false }
        ]
    },
    {
        categoryName: "Ragi & Mycelium",
        categoryNameEn: "Ragi & Mycelium",
        question: "Apa perubahan fisik yang paling mudah diamati pada kedelai setelah mengalami fermentasi tempe secara optimal?",
        questionEn: "What is the most noticeable physical change in soybeans after optimal tempe fermentation?",
        timer: 15,
        answers: [
            { answerText: "Biji kedelai menyatu membentuk tempe yang padat", answerTextEn: "The soybeans bind together into a firm block of tempe", isCorrect: true },
            { answerText: "Biji kedelai berubah menjadi tepung", answerTextEn: "The soybeans turn into flour", isCorrect: false }
        ]
    },

    // --- Tempe Production (tambahan) ---
    {
        categoryName: "Tempe Production",
        categoryNameEn: "Tempe Production",
        question: "Dalam produksi tempe, mengapa kedelai perlu direbus atau dimasak sebelum diberi ragi?",
        questionEn: "Why do soybeans need to be boiled or cooked before the starter is added?",
        timer: 15,
        answers: [
            { answerText: "Untuk melunakkan kedelai dan mempersiapkannya untuk fermentasi", answerTextEn: "To soften the soybeans and prepare them for fermentation", isCorrect: true },
            { answerText: "Untuk menghilangkan seluruh kandungan protein", answerTextEn: "To remove all of their protein content", isCorrect: false }
        ]
    },
    {
        categoryName: "Tempe Production",
        categoryNameEn: "Tempe Production",
        question: "Mengapa ragi tidak dianjurkan untuk dicampurkan ketika kedelai masih dalam keadaan sangat panas?",
        questionEn: "Why should the starter not be mixed into soybeans while they are still very hot?",
        timer: 15,
        answers: [
            { answerText: "Karena suhu tinggi dapat merusak atau menghambat pertumbuhan kapang", answerTextEn: "Because high temperatures can damage or inhibit mold growth", isCorrect: true },
            { answerText: "Karena suhu tinggi membuat kedelai menjadi lebih manis", answerTextEn: "Because high temperatures make the soybeans sweeter", isCorrect: false }
        ]
    },
    {
        categoryName: "Tempe Production",
        categoryNameEn: "Tempe Production",
        question: "Bagaimana ciri tempe yang menunjukkan bahwa proses fermentasinya berhasil dengan baik?",
        questionEn: "What is a characteristic of tempe that indicates successful fermentation?",
        timer: 15,
        answers: [
            { answerText: "Biji kedelai menyatu dan terikat oleh lapisan putih miselium", answerTextEn: "The soybeans are bound together by a white layer of mycelium", isCorrect: true },
            { answerText: "Biji kedelai terpisah dan terendam dalam cairan", answerTextEn: "The soybeans remain separated and submerged in liquid", isCorrect: false }
        ]
    },

    // --- Soal lama (id 25) yang belum punya terjemahan Inggris di database ---
    // Catatan: teks bahasa Indonesia sengaja dipertahankan persis supaya
    // logika update di bawah mencocokkan soal/jawaban yang sudah ada.
    {
        categoryName: "Tempe Production",
        categoryNameEn: "Tempe Production",
        question: "Dalam proses produksi tempe tradisional, bahan apa yang paling umum digunakan untuk membungkus tempe?",
        questionEn: "In traditional tempe production, what is the most commonly used material for wrapping tempe?",
        timer: 15,
        answers: [
            { answerText: "Daun pepaya", answerTextEn: "Papaya leaves", isCorrect: false },
            { answerText: "Daun pisang", answerTextEn: "Banana leaves", isCorrect: true }
        ]
    }
]

async function main() {
    const password = await bcrypt.hash('admin123', 10);

    // 1. Roles default (izin hanya dibuat saat role baru; perubahan dari menu Roles tidak ditimpa)
    for (const [name, def] of Object.entries(DEFAULT_ROLES)) {
        const existingRole = await prisma.role.findUnique({ where: { name } });
        if (existingRole) continue;
        await prisma.role.create({
            data: {
                name,
                description: def.description,
                permissions: { create: def.permissions.map(permission => ({ permission })) }
            }
        });
        console.log(`Role "${name}" created`);
    }

    // 2. Create Admin if not exists (atau beri username jika akun lama masih pakai email saja)
    const existingAdmin = await prisma.user.findFirst({
        where: { OR: [{ username: 'admin' }, { email: 'admin@mail.com' }] }
    });

    if (!existingAdmin) {
        await prisma.user.create({
            data: {
                name: 'Administrator',
                username: 'admin',
                email: 'admin@mail.com',
                password,
                role: 'admin'
            }
        });
        console.log('Admin created successfully');
    } else {
        console.log('Admin already exists (tidak diubah)');
    }

    // 2. Find or Create the Tempe Park Quiz
    let quiz = await prisma.quiz.findFirst({
        where: { title: "Tempe Park - Tempe Gacha" }
    });

    if (!quiz) {
        quiz = await prisma.quiz.create({
            data: {
                title: "Tempe Park - Tempe Gacha",
                titleEn: "Tempe Park - Tempe Gacha",
                description: "Jawab Kuisnya, Ambil Gachanya!",
                descriptionEn: "Answer the Quiz, Claim Your Gacha!",
                status: true
            }
        });
        console.log('Quiz "Tempe Park - Tempe Gacha" created successfully');
    } else if (!quiz.titleEn || !quiz.descriptionEn) {
        // Isi terjemahan Inggris hanya yang masih kosong; yang sudah diubah admin tidak ditimpa.
        quiz = await prisma.quiz.update({
            where: { id: quiz.id },
            data: {
                titleEn: quiz.titleEn || "Tempe Park - Tempe Gacha",
                descriptionEn: quiz.descriptionEn || "Answer the Quiz, Claim Your Gacha!"
            }
        });
        console.log('Quiz "Tempe Park - Tempe Gacha": terjemahan Inggris yang kosong diisi');
    }

    // 3. Ekstrak unik kategori beserta versi Inggrisnya
    const uniqueCategories = new Map();
    for (const q of defaultQuestions) {
        if (!uniqueCategories.has(q.categoryName)) {
            uniqueCategories.set(q.categoryName, q.categoryNameEn);
        }
    }
    const categoryMap = {};

    // 4. Find or Create / Update Categories
    for (const [name, nameEn] of uniqueCategories.entries()) {
        let category = await prisma.category.findFirst({
            where: { name: name }
        });

        if (!category) {
            category = await prisma.category.create({
                data: { name: name, nameEn: nameEn }
            });
            console.log(`Category "${name}" created successfully`);
        } else if (!category.nameEn) {
            category = await prisma.category.update({
                where: { id: category.id },
                data: { nameEn: nameEn }
            });
        }
        categoryMap[name] = category.id;
    }

    // 5. Tambahkan / Update Question dan Answer nya
    let addedQuestionsCount = 0;
    let updatedQuestionsCount = 0;

    for (const qData of defaultQuestions) {
        const existingQuestion = await prisma.question.findFirst({
            where: {
                quizId: quiz.id,
                question: qData.question
            }
        });

        if (!existingQuestion) {
            // Create question baru lengkap dengan versi Inggris
            const newQuestion = await prisma.question.create({
                data: {
                    quizId: quiz.id,
                    categoryId: categoryMap[qData.categoryName],
                    question: qData.question,
                    questionEn: qData.questionEn,
                    timer: qData.timer
                }
            });

            const answersData = qData.answers.map(ans => ({
                questionId: newQuestion.id,
                answerText: ans.answerText,
                answerTextEn: ans.answerTextEn,
                isCorrect: ans.isCorrect
            }));

            await prisma.answer.createMany({
                data: answersData
            });

            addedQuestionsCount++;
        } else if (!existingQuestion.questionEn) {
            // Isi terjemahan Inggris yang masih kosong saja.
            await prisma.question.update({
                where: { id: existingQuestion.id },
                data: { questionEn: qData.questionEn }
            });

            for (const ans of qData.answers) {
                await prisma.answer.updateMany({
                    where: {
                        questionId: existingQuestion.id,
                        answerText: ans.answerText,
                        answerTextEn: null
                    },
                    data: {
                        answerTextEn: ans.answerTextEn
                    }
                });
            }

            updatedQuestionsCount++;
        }
    }

    console.log(`Added: ${addedQuestionsCount} new questions | Updated English translation: ${updatedQuestionsCount} existing questions.`);

    if (addedQuestionsCount > 0) {
        console.log(`Successfully added ${addedQuestionsCount} new categorized questions to the Tempe Park quiz.`);
    } else {
        console.log('All default categorized questions are already present in the database.');
    }

    // 6. Booth awal hanya dibuat saat database belum punya booth sama sekali.
    //    Kalau admin sudah menghapus/mengubah booth, seed tidak membuatnya lagi.
    const boothCount = await prisma.booth.count();
    if (boothCount === 0) {
        const defaultBooths = [
            { name: 'Booth 1', description: 'Booth kuis utama' },
            { name: 'Booth 2', description: 'Booth kuis kedua' },
            { name: 'Booth 3', description: 'Booth kuis ketiga' }
        ];
        for (const boothData of defaultBooths) {
            await prisma.booth.create({ data: boothData });
            console.log(`Booth "${boothData.name}" created successfully`);
        }
    } else {
        console.log(`Booth sudah ada (${boothCount}), tidak diubah.`);
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