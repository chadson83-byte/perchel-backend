// =========================================================
// [3] 네비게이션 및 탭 전환
// =========================================================
function toggleLanguage() {
    currentLang = currentLang === 'ko' ? 'en' : 'ko';
    document.getElementById('lang-toggle').innerText = currentLang === 'ko' ? 'EN' : 'KR';
    
    document.querySelectorAll('[data-ko]').forEach(el => { 
        el.innerText = el.getAttribute(`data-${currentLang}`); 
    });
    document.querySelectorAll('[data-ph-ko]').forEach(el => { 
        el.placeholder = el.getAttribute(`data-ph-${currentLang}`); 
    });
    
    if (document.getElementById('tab-local') && currentProfileLocalRegion) {
        document.getElementById('tab-local').innerText = currentLang === 'ko' ? `지역 맛집 (${currentProfileLocalRegion})` : `Local (${currentProfileLocalRegion})`;
    }
    
    const activeTab = document.querySelector('.nav-item.active');
    if (activeTab) switchTab(activeTab.id.replace('m-', '')); 
}

function changeGlobalRegion() {
    globalRegion = document.getElementById('global-region-select').value;
    const activeTab = document.querySelector('.nav-item.active');
    if (activeTab) { 
        const tabId = activeTab.id.replace('m-', '');
        if (tabId === 'home') fetchHomeData();
        else if (tabId === 'explore') switchExploreTab('ranking'); 
        else if (tabId === 'network') fetchNetworkData();
    }
}

function switchTab(t, skipFetch = false) {
    const user = localStorage.getItem('currentUser');
    const topBar = document.getElementById('main-top-bar');

    if (t === 'home') topBar.classList.add('transparent');
    else topBar.classList.remove('transparent');
    
    document.querySelectorAll('.tab-view').forEach(view => view.style.display = 'none');
    document.getElementById(t + '-view').style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById('m-' + t);
    if (activeNav) activeNav.classList.add('active');
    
    if (!skipFetch) {
        if (t === 'home') fetchHomeData();
        else if (t === 'network') fetchNetworkData(); 
        else if (t === 'explore') switchExploreTab('ranking'); 
        else if (t === 'profile') fetchGuideView(user);
        else if (t === 'map') setTimeout(() => initGlobalMap(), 200); 
    }
    window.scrollTo(0,0);
}

// =========================================================
// [13-2] 알림(Notification) 모달창 제어
// =========================================================
async function fetchNotifications() {
    const user = localStorage.getItem('currentUser');
    if (!user) return;
    
    try {
        const res = await fetch(`${API_URL}/notifications`, { 
            headers: { 'user-id': user } 
        });
        
        if (res.ok) {
            const data = await res.json();
            const badge = document.getElementById('noti-badge');
            if (data.unread_count > 0) {
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch(e) {
        console.error("알림 확인 실패", e);
    }
}

async function openNotificationModal() {
    document.getElementById('notification-modal').style.display = 'flex';
    const target = document.getElementById('notification-list-target');
    const user = localStorage.getItem('currentUser');
    
    target.innerHTML = `
        <div style="text-align:center; padding:60px 20px; color:var(--brand-primary); font-size:14px; font-weight:800;">
            알림을 불러오는 중입니다...
        </div>
    `;
    
    try {
        const res = await fetch(`${API_URL}/notifications`, { 
            headers: { 'user-id': user } 
        });
        const data = await res.json();
        
        if (!data.notifications || data.notifications.length === 0) {
            target.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:var(--text-sub); font-size:13px; font-weight:600;">
                    아직 도착한 소식이 없습니다.
                </div>
            `;
        } else {
            let html = '';
            data.notifications.forEach(function(n) {
                const icon = n.type === 'follow' ? '🤝' : n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : '🔔';
                html += `
                    <div class="noti-item ${n.read ? '' : 'unread'}" style="padding:20px; border-bottom:1px solid var(--border-color); display:flex; gap:16px; align-items:center; background:${n.read ? 'transparent' : 'rgba(255, 90, 32, 0.05)'};">
                        <div class="noti-icon" style="width:48px; height:48px; border-radius:50%; background:var(--bg-card); color:var(--brand-primary); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; border: 1px solid var(--border-color);">
                            ${icon}
                        </div>
                        <div style="flex:1; font-size:14px; color:var(--text-main); line-height:1.5; font-weight:600;">
                            ${n.message}
                        </div>
                    </div>
                `;
            });
            target.innerHTML = html;
        }
        
        fetch(`${API_URL}/notifications/read`, { 
            method: 'PUT', 
            headers: { 'user-id': user } 
        });
        
        document.getElementById('noti-badge').style.display = 'none';
        
    } catch(e) {
        console.error("알림 모달 에러", e);
    }
}

function closeNotificationModal() {
    document.getElementById('notification-modal').style.display = 'none';
}

// =========================================================
// [14] 로그인 및 앱 라이프사이클 관리
// =========================================================
function initApp() { 
    const user = localStorage.getItem('currentUser'); 
    
    if (user && user !== "null" && user !== "undefined" && user.trim() !== "") { 
        document.getElementById('login-section').style.display = 'none'; 
        document.getElementById('main-content').style.display = 'block'; 
        switchTab('home'); 
        fetchNotifications(); 
    } else {
        localStorage.removeItem('currentUser'); // 찌꺼기 데이터 확실하게 소거
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
    }
}

// =========================================================
// [15] 최적화된 온로드 초기화
// =========================================================
window.onload = function() { 
    if (typeof kakao !== 'undefined' && kakao.maps) {
        kakao.maps.load(function() {
            console.log("Kakao Map Engine Ready");
        }); 
    } else {
        console.warn("카카오맵 API 스크립트가 아직 로드되지 않았거나 키가 유효하지 않습니다.");
    }
    
    const splash = document.getElementById('splash-screen');
    setTimeout(function() {
        fetchUserProfiles(); 
        
        if (splash) { 
            splash.style.transform = 'scale(1.05)';
            splash.style.opacity = '0'; 
            setTimeout(function() { 
                splash.style.display = 'none'; 
                initApp(); 
            }, 600); 
        } else { 
            initApp(); 
        }
    }, 1800); 
};

// =========================================================
// 🚀 스마트폰 스와이프 탭 전환 (수정됨)
// =========================================================
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

window.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

window.addEventListener('touchend', function(e) {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
}, { passive: true });

// 실제 탭 전환 순서: 홈 -> 지도 -> 탐색 -> 프로필
const swipeTabs = ['home', 'map', 'explore', 'profile'];

function handleSwipe() {
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);

    // 사용자가 위아래로 스크롤하는 동작일 때는 스와이프를 무시합니다.
    if (diffY > 60) return;

    // 1순위: 열려있는 팝업 모달창이 있다면 우선적으로 닫기
    const openModals = Array.from(document.querySelectorAll('.bottom-modal')).filter(m => window.getComputedStyle(m).display === 'flex' || window.getComputedStyle(m).display === 'block');
    if (openModals.length > 0) {
        if (diffX > 90) { // 화면을 우측으로 밀면 모달창 닫힘
            const topModal = openModals[openModals.length - 1];
            topModal.style.display = 'none';
        }
        return; // 모달이 켜져있을 땐 뒤로 다른 화면으로 넘어가지 않음
    }

    // 2순위: 현재 보고있는 탭이 무엇인지 확인
    const activeNav = document.querySelector('.nav-item.active');
    if (!activeNav) return;
    const currentTab = activeNav.id.replace('m-', '');
    const currentIndex = swipeTabs.indexOf(currentTab);

    if (currentIndex === -1) return; // 중앙의 '+' 버튼일 경우 무시

    // 3순위: 화면을 민 방향에 따라 다음 탭이나 이전 탭으로 이동
    if (diffX < -90) {
        // 화면을 왼쪽으로 스와이프 -> 다음 페이지로 전환
        const nextIndex = (currentIndex + 1) % swipeTabs.length;
        switchTab(swipeTabs[nextIndex]);
    } else if (diffX > 90) {
        // 화면을 오른쪽으로 스와이프 -> 이전 페이지로 전환
        const prevIndex = (currentIndex - 1 + swipeTabs.length) % swipeTabs.length;
        switchTab(swipeTabs[prevIndex]);
    }
}
// =========================================================
// [16] 스마트폰 하드웨어 뒤로가기 완벽 제어 (앱 종료 방지)
// =========================================================
if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.App) {
    // 💡 네이티브 앱 환경(Android/iOS)일 때 작동
    Capacitor.Plugins.App.addListener('backButton', function() {
        
        // 1순위: 화면에 열려있는 팝업 모달창이 있는지 확인 (방명록, 상세창, 검색창 등)
        const openModals = Array.from(document.querySelectorAll('.bottom-modal')).filter(m => window.getComputedStyle(m).display === 'flex' || window.getComputedStyle(m).display === 'block');
        
        if (openModals.length > 0) {
            // 가장 상단에 뜬 모달만 스르륵 닫음 (앱 안 꺼짐)
            openModals[openModals.length - 1].style.display = 'none';
            return;
        }

        // 2순위: 현재 탭이 '홈(home)'이 아니면 '홈'으로 탭 이동
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav && activeNav.id !== 'm-home') {
            switchTab('home');
            return;
        }

        // 3순위: 홈 탭이고 열린 모달도 없으면 비로소 앱 종료
        Capacitor.Plugins.App.exitApp();
    });
} else {
    // 💡 모바일 웹 브라우저(크롬, 사파리) 환경일 때의 대비책
    window.history.pushState({ page: 'init' }, '', '');
    window.addEventListener('popstate', function(event) {
        const openModals = Array.from(document.querySelectorAll('.bottom-modal')).filter(m => window.getComputedStyle(m).display === 'flex' || window.getComputedStyle(m).display === 'block');
        if (openModals.length > 0) {
            openModals[openModals.length - 1].style.display = 'none';
            window.history.pushState({ page: 'modal_closed' }, '', '');
            return;
        }
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav && activeNav.id !== 'm-home') {
            switchTab('home');
            window.history.pushState({ page: 'home' }, '', '');
            return;
        }
    });
}

  /* =========================================================
   [CTO 추가] 폰 카메라 촬영 즉시 미리보기 (썸네일) 띄우기
========================================================= */
let capturedImageFile = null; // 나중에 '등록' 버튼 누를 때 서버로 보낼 사진 파일 보관소

function previewCapturedImage(event) {
    const file = event.target.files[0]; // 유저가 찍은 사진을 가져옴
    
    if (file) {
        capturedImageFile = file; // 서버 업로드를 위해 변수에 저장해둠
        
        // 사진을 읽어서 화면에 뿌려주는 자바스크립트 기본 도구
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewImg = document.getElementById('image-preview');
            previewImg.src = e.target.result; // 찍은 사진 데이터를 img 태그에 삽입
            previewImg.style.display = 'block'; // 숨겨놨던 img 태그를 짠! 하고 보여줌
            
            // 프리미엄 토스트 알림 띄우기 (이전에 만든 함수 재활용)
            if(typeof showPremiumToast === "function") {
                showPremiumToast("멋진 사진이네요! 대표 사진으로 설정되었습니다.", "📸");
            }
        }
        reader.readAsDataURL(file); // 파일 읽기 시작
    }
}

// =========================================================
// [CTO 긴급 패치] 지도 영역 내 스와이프 시 탭 넘어가는 현상 완벽 방어
// =========================================================
// 💡 앱이 켜지고 1초 뒤에 지도 영역을 찾아 방어막을 전개합니다.
setTimeout(() => {
    // 카카오맵이 그려지는 컨테이너의 ID를 가져옵니다. (보통 'map' 입니다)
    const mapElement = document.getElementById('map'); 
    
    if (mapElement) {
        // e.stopPropagation() : "내가 여기서 터치 처리했으니까, 부모 창(탭 스와이프)한테는 터치했다고 일러바치지 마!" 라는 뜻입니다.
        mapElement.addEventListener('touchstart', function(e) { 
            e.stopPropagation(); 
        }, { passive: true });
        
        mapElement.addEventListener('touchmove', function(e) { 
            e.stopPropagation(); 
        }, { passive: true });
        
        mapElement.addEventListener('touchend', function(e) { 
            e.stopPropagation(); 
        }, { passive: true });
        
        console.log("🛡️ 지도 스와이프 방어막 전개 완료!");
    }
}, 1000);

// =========================================================
// [CTO 긴급 패치] 탐색 탭 진입 시 '실시간 미식 피드' 기본화면 강제 설정
// =========================================================
if (typeof window.switchTab === 'function') {
    const _originalSwitchTabForFeed = window.switchTab;
    
    // 기존 탭 이동 함수를 잠시 가로챕니다.
    window.switchTab = function(tabId, pushHistory) {
        // 1. 원래 하던 대로 탭 이동을 정상적으로 수행합니다.
        _originalSwitchTabForFeed(tabId, pushHistory);
        
        // 2. 만약 이동한 탭이 '탐색(network)' 탭이라면?
        if (tabId === 'network' || tabId === 'explore') {
            setTimeout(() => {
                // 화면 안의 '실시간 미식 피드' 버튼을 찾아 빛의 속도로 클릭합니다!
                const elements = Array.from(document.querySelectorAll('*'));
                const feedBtn = elements.find(el => 
                    el.innerText && 
                    el.innerText.trim() === '실시간 미식 피드' && 
                    (el.tagName === 'BUTTON' || el.tagName === 'DIV')
                );
                
                if (feedBtn) {
                    feedBtn.click();
                }
            }, 10); // 탭이 열리자마자 0.01초 만에 실행
        }
    };
}