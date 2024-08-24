function calculateMBTI(mbtiResult) {
    return `${mbtiResult.E > mbtiResult.I ? 'E' : 'I'}${mbtiResult.S > mbtiResult.N ? 'S' : 'N'}${mbtiResult.T > mbtiResult.F ? 'T' : 'F'}${mbtiResult.J > mbtiResult.P ? 'J' : 'P'}`;
}

const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const winston = require('winston');

const app = express();

// 로깅 설정
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).send('Something broke!');
});

app.use(express.urlencoded({ extended: true }));


// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MySQL 데이터베이스 연결
const db = mysql.createConnection({
    host: 'mysql-302e4ce9-kimsojeong777-55b9.e.aivencloud.com',
    user: 'avnadmin',
    password: 'AVNS_6GENmxgK1_ms2bG1Xz6',
    database: 'defaultdb',
    port: 12559,
    connectTimeout: 10000,
    ssl: {
        ca: fs.readFileSync(path.join(__dirname, 'ca.pem')), // CA 파일을 현재 디렉토리에서 읽음
        rejectUnauthorized: true
    }
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
    }
    console.log('Connected to MySQL as id ' + db.threadId);
});

app.use(bodyParser.urlencoded({ extended: false })); // bodyparser 설정
app.use(express.static('public')); // 정적 파일 제공

// 메인 페이지 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 질문 페이지 라우트
app.get('/questions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'questions.html'));
});


app.post('/result', (req, res) => {
    try {
        const { username, mbti_result, interest } = req.body;

        if (!interest) {
            logger.warn('Interest not selected by user');
            return res.status(400).send('관심사를 선택하지 않았습니다. 다시 시도해주세요.');
        }

        if (!username || !mbti_result) {
            logger.warn('Missing username or MBTI result');
            throw new Error('모든 입력값이 필요합니다.');
        }

        let mbti;
        try {
            const mbtiObject = JSON.parse(mbti_result); // JSON 문자열을 객체로 변환
            mbti = calculateMBTI(mbtiObject); // 최종 MBTI 문자열 계산
        } catch (err) {
            logger.error('Error parsing MBTI result: ' + err.message);
            throw new Error('MBTI 결과를 파싱하는 데 실패했습니다.');
        }

        const query = `
            SELECT mbti, name, image_url, interest, lecture_link, description 
            FROM celebrities 
            WHERE mbti = ? AND interest = ?`;

        db.query(query, [mbti, interest], (err, results) => {
            if (err) {
                logger.error('Database query error: ' + err.message);
                return res.status(500).send('데이터베이스 쿼리 중 오류가 발생했습니다.');
            }

            res.render('result', { username, mbti, celebrities: results });
        });
    } catch (err) {
        logger.error('Server error: ' + err.message);
        res.status(500).send('서버에서 오류가 발생했습니다. 나중에 다시 시도해주세요.');
    }
});


// 서버 실행
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
