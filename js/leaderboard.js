import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Firebase 초기화
let app;
let db;
let isInitialized = false;

try {
    // 키가 플레이스홀더가 아닐 때만 초기화 시도
    if (!firebaseConfig.apiKey.includes("YOUR_API_KEY")) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        isInitialized = true;
        console.log("Firebase initialized successfully");
    } else {
        console.warn("Firebase config is missing. Leaderboard disabled.");
    }
} catch (e) {
    console.error("Firebase initialization failed:", e);
}

// 전역 스코프에 리더보드 API 노출
window.Leaderboard = {
    // Firebase 초기화 상태 확인
    isReady: function () {
        return isInitialized;
    },

    // 점수 제출
    submitScore: async function (name, score, day) {
        if (!isInitialized) {
            console.warn("Firebase not initialized - score not submitted");
            return false;
        }

        try {
            await addDoc(collection(db, "leaderboard"), {
                name: name,
                score: score,
                day: day,
                date: Timestamp.now()
            });
            console.log("Score submitted successfully");
            return true;
        } catch (e) {
            console.error("Error adding score: ", e);
            return false;
        }
    },

    // 랭킹 가져오기
    getScores: async function (limitCount = 10) {
        if (!isInitialized) return [];

        try {
            const q = query(
                collection(db, "leaderboard"),
                orderBy("score", "desc"),
                limit(limitCount)
            );

            const querySnapshot = await getDocs(q);
            const scores = [];
            querySnapshot.forEach((doc) => {
                scores.push(doc.data());
            });
            return scores;
        } catch (e) {
            console.error("Error getting scores: ", e);
            return [];
        }
    }
};
