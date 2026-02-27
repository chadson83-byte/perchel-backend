// =========================================================
// [PWA] Service Worker 등록 및 앱 설치 유도
// =========================================================
let deferredPrompt;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(reg) { console.log('Service Worker 등록 성공:', reg.scope); })
            .catch(function(err) { console.log('Service Worker 등록 실패:', err); });
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) {
        installBanner.style.display = 'flex';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            const installBanner = document.getElementById('pwa-install-banner');
            if (installBanner) installBanner.style.display = 'none';
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('앱 설치가 수락되었습니다.');
                } else {
                    console.log('앱 설치가 거절되었습니다.');
                }
                deferredPrompt = null;
            }
        });
    }
});

// =========================================================
// [1] 글로벌 변수 및 환경 설정
// =========================================================
const API_URL = `https://perchel-backend.onrender.com`; 

let followingList = [];
let currentLang = 'ko'; 
let globalRegion = 'national';
let currentProfileGuideData = {};
let currentProfileOwner = '';
let currentProfileIsMe = false;
let currentProfileLocalRegion = '';
let activeGuideTab = 'national';
let currentOpenRestId = null; 
let userProfiles = {}; 

let currentProfilePhilosophy = '';
let currentProfileTags = [];
let currentProfilePersonalInfo = '';

let globalMap = null; 
let previewMap = null; 
let previewMarker = null;

let nationalTop50 = [];
let regionalTop10 = {};

// [추가] 뒤로가기용 탭 히스토리 추적 배열
let tabHistory = ['home'];