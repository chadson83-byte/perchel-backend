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

// 스와이프 뒤로가기를 위한 탭 히스토리 로직
function switchTab(t, skipFetch = false, isBack = false) {
    const user = localStorage.getItem('currentUser');
    const topBar = document.getElementById('main-top-bar');
    
    if (!isBack && tabHistory[tabHistory.length - 1] !== t) {
        tabHistory.push(t);
    }

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
// 🚀 스마트폰 스와이프 (우측으로 밀어 뒤로가기)
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

function handleSwipe() {
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);

    // 사용자가 우측으로 90px 이상 밀었고, 위아래 흔들림이 60px 이하일 때만 동작 (뒤로 가기)
    if (diffX > 90 && diffY < 60) {
        
        // 1순위: 열려있는 팝업 모달창이 있다면 우선적으로 닫기
        let modalClosed = false;
        const openModals = Array.from(document.querySelectorAll('.bottom-modal')).filter(m => window.getComputedStyle(m).display === 'flex' || window.getComputedStyle(m).display === 'block');
        
        if (openModals.length > 0) {
            // 가장 위에 있는 (마지막) 모달을 닫습니다
            const topModal = openModals[openModals.length - 1];
            topModal.style.display = 'none';
            modalClosed = true;
            return;
        }

        // 2순위: 모달이 없다면 이전 탭(화면)으로 되돌아가기
        if (!modalClosed && tabHistory.length > 1) {
            tabHistory.pop(); // 현재 화면 기록 삭제
            const prevTab = tabHistory[tabHistory.length - 1]; // 바로 이전 화면
            switchTab(prevTab, false, true); // 이전 화면으로 이동
        }
    }
}