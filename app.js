// =========================================================
// [PWA] Service Worker 등록 및 앱 설치 유도 (팝업 UI 연동)
// =========================================================
let deferredPrompt;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(reg) { console.log('Service Worker 등록 성공:', reg.scope); })
            .catch(function(err) { console.log('Service Worker 등록 실패:', err); });
    });
}

// 브라우저의 기본 설치 배너를 가로채고 커스텀 배너를 띄움
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) {
        installBanner.style.display = 'flex';
    }
});

// 설치 버튼 클릭 시 설치 프롬프트 실행
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

// 🚨 [추가] 뒤로가기용 탭 히스토리 추적 배열
let tabHistory = ['home'];

// =========================================================
// [1.5] 소셜 로그인 엔진 (카카오/구글) & 일반 로그인
// =========================================================

if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
    Kakao.init('cdf28be42d7f14e86fdbe2901a84398a');
}

window.handleSocialLoginServer = async function(provider, token) {
    try {
        const res = await fetch(`${API_URL}/login/social`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: provider, token: token })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('currentUser', data.username);
            followingList = data.following || [];
            
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            initApp();
        } else {
            alert(data.detail || "소셜 로그인 서버 검증에 실패했습니다.");
        }
    } catch(e) {
        console.error("로그인 서버 에러:", e);
        alert("서버 통신에 실패했습니다. 백엔드가 실행 중인지 확인해주세요.");
    }
};

window.handleGoogleLogin = function(response) {
    window.handleSocialLoginServer('google', response.credential);
};

window.triggerGoogleLogin = async function() {
    try {
        if (typeof Capacitor !== 'undefined' && Capacitor.Plugins.GoogleAuth) {
            Capacitor.Plugins.GoogleAuth.initialize({
                clientId: '725138598590-gjhd8dduh3ag3922il5pcrf15q1rjvvn.apps.googleusercontent.com',
                scopes: ['profile', 'email'],
                grantOfflineAccess: true,
            });

            const googleUser = await Capacitor.Plugins.GoogleAuth.signIn();
            
            if (googleUser && googleUser.authentication) {
                window.handleSocialLoginServer('google', googleUser.authentication.idToken);
            }
        } else {
            alert("구글 로그인 모듈이 로드되지 않았습니다. 앱 환경인지 확인해주세요.");
        }
    } catch (error) {
        console.error("구글 로그인 에러:", error);
        alert("구글 로그인이 취소되었거나 오류가 발생했습니다.");
    }
};

window.loginWithKakao = function() {
    if (typeof Kakao === 'undefined') {
        alert("카카오 스크립트가 로드되지 않았습니다. 새로고침 후 다시 시도해주세요.");
        return;
    }
    Kakao.Auth.login({
        success: function(authObj) {
            window.handleSocialLoginServer('kakao', authObj.access_token);
        },
        fail: function(err) {
            console.error("카카오 로그인 취소 또는 에러 발생:", err);
            alert("카카오 로그인 중 오류가 발생했습니다.");
        }
    });
};

async function handleLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    
    if (!u || !p) {
        alert(currentLang === 'ko' ? "아이디와 비밀번호를 정확히 입력하세요." : "Please enter details.");
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/login`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ username: u, password: p }) 
        });
        
        const data = await res.json();
        
        if (res.ok) { 
            localStorage.setItem('currentUser', data.username); 
            followingList = data.following || []; 
            
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            initApp(); 
        } else { 
            alert(data.detail || "로그인에 실패했습니다."); 
        }
    } catch(e) { 
        alert("서버 연결에 실패했습니다. 백엔드가 실행 중인지 확인해주세요."); 
    }
}

async function handleSignup() {
    const u = document.getElementById('login-user').value; 
    const p = document.getElementById('login-pass').value;
    
    if (!u || !p) {
        alert("가입할 아이디와 비밀번호를 입력하세요.");
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/signup`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ username: u, password: p }) 
        });
        
        const responseData = await res.json();
        alert(responseData.message);
    } catch (e) {
        alert("회원가입 통신 중 에러가 발생했습니다.");
    }
}

window.handleLogout = function() { 
    localStorage.removeItem('currentUser'); 
    location.reload(); 
};

// =========================================================
// [2] 공통 유틸리티 (배지, 아바타, 식당 자동 사진 매칭)
// =========================================================
function getBadgeHtml(username) {
    if (nationalTop50.includes(username)) {
        return `<div class="s-badge">전국S</div>`;
    }
    for (let reg in regionalTop10) {
        if (regionalTop10[reg] && regionalTop10[reg].includes(username)) {
            return `<div class="s-badge regional">${reg}S</div>`;
        }
    }
    return '';
}

function getAvatar(username) {
    let badge = getBadgeHtml(username);
    let imgHtml = '';
    
    if (userProfiles[username]) {
        const fallbackHtml = `<div style='width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--border-color);color:var(--brand-primary);font-weight:900;font-size:1.5em;text-transform:uppercase;'>${username ? username.charAt(0).toUpperCase() : '?'}</div>`;
        imgHtml = `<img src="${userProfiles[username]}" style="width:100%; height:100%; object-fit:cover;" onerror="this.outerHTML=\`${fallbackHtml}\`">`;
    } else {
        const initial = username ? username.charAt(0).toUpperCase() : '?';
        imgHtml = `
            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--border-color); color: var(--brand-primary); font-weight: 900; font-size: 1.5em; text-transform: uppercase;">
                ${initial}
            </div>
        `;
    }
    
    return `
        <div style="position:relative; width:100%; height:100%;">
            <div class="avatar-circle">
                ${imgHtml}
            </div>
            ${badge}
        </div>
    `;
}

function getSmartRestImage(id, category, userImg) {
    if (userImg && userImg !== 'null' && userImg !== '') {
        if (userImg.includes('127.0.0.1:8000') || userImg.startsWith('/images')) {
            const fileName = userImg.split('/').pop();
            return `${API_URL}/images/${fileName}`;
        }
        return userImg; 
    }
    
    const cat = category || "";
    
    if (cat.includes('고기') || cat.includes('구이') || cat.includes('소') || cat.includes('돼지')) return 'https://images.unsplash.com/photo-1544025162-811114cd354a?w=800&q=80';
    if (cat.includes('카페') || cat.includes('커피') || cat.includes('디저트')) return 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80';
    if (cat.includes('일식') || cat.includes('초밥') || cat.includes('스시')) return 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80';
    if (cat.includes('중식') || cat.includes('마라') || cat.includes('짜장')) return 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&q=80';
    if (cat.includes('양식') || cat.includes('파스타') || cat.includes('피자')) return 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&q=80';
    
    if (id && id !== 'undefined' && id !== 'null') {
        return `https://img1.kakaocdn.net/cthumb/local/R0x0/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flocalfiy%2Fsearch%2Fplace%2F${id}`;
    }
    
    return 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80'; 
}

async function fetchUserProfiles() {
    try {
        const res = await fetch(`${API_URL}/users/profiles`);
        if (res.ok) userProfiles = await res.json();
    } catch (error) {
        console.error("프로필 이미지를 불러오는데 실패했습니다.", error);
    }
}

// 🚨 [수정됨] 앱 환경(웹뷰)에서 파일 업로드가 막히는 현상을 해결하기 위해 강제 DOM 생성 방식 적용
function triggerProfileUpload() {
    if (!currentProfileIsMe) return;
    
    let input = document.getElementById('hidden-profile-upload');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.id = 'hidden-profile-upload';
        input.style.display = 'none';
        document.body.appendChild(input);
    }
    
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const fd = new FormData();
        fd.append('image', file);
        
        try {
            const res = await fetch(`${API_URL}/user/profile-image`, {
                method: 'POST',
                headers: { 'user-id': localStorage.getItem('currentUser') },
                body: fd
            });
            
            if (res.ok) {
                alert("프로필 사진이 성공적으로 변경되었습니다! 📸");
                await fetchUserProfiles(); 
                fetchGuideView(localStorage.getItem('currentUser')); 
            } else { 
                alert("업로드 실패: 권한이 없거나 이미지 용량이 너무 큽니다."); 
            }
        } catch(error) { 
            alert("서버 통신 오류가 발생했습니다."); 
        } finally {
            input.value = ''; // 재사용을 위해 초기화
        }
    };
    
    input.click();
}

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

// 🚨 [수정됨] 스와이프 뒤로가기를 위한 탭 히스토리 로직 추가
function switchTab(t, skipFetch = false, isBack = false) {
    const user = localStorage.getItem('currentUser');
    const topBar = document.getElementById('main-top-bar');
    
    // 히스토리 배열 업데이트 (뒤로가기 액션이 아닐 때만 쌓음)
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
// [4] 카카오맵 API 연동 및 주변 검색 로직
// =========================================================
function initGlobalMap() {
    if (typeof kakao === 'undefined' || !kakao.maps) {
        console.error("카카오맵 API가 로드되지 않았습니다.");
        return;
    }
    
    kakao.maps.load(function() {
        const mapContainer = document.getElementById('global-map');
        if (!mapContainer) return;
        
        if (globalMap) { 
            globalMap.relayout(); 
            moveToMyLocation(); 
            setTimeout(() => { globalMap.relayout(); moveToMyLocation(); }, 100);
            return; 
        } 
        
        const defaultLoc = new kakao.maps.LatLng(37.5665, 126.9780);
        globalMap = new kakao.maps.Map(mapContainer, { center: defaultLoc, level: 6 });
        
        moveToMyLocation();
        loadMapMarkers();
        
        setTimeout(() => { globalMap.relayout(); moveToMyLocation(); }, 100);
    });
}

function moveToMyLocation() {
    if (navigator.geolocation && globalMap) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const loc = new kakao.maps.LatLng(position.coords.latitude, position.coords.longitude);
            globalMap.setCenter(loc);
            globalMap.setLevel(4);
        });
    }
}

async function loadMapMarkers() {
    try {
        const res = await fetch(`${API_URL}/feed`);
        if (!res.ok) throw new Error("피드 데이터를 가져오는데 실패했습니다.");
        
        let feedList = await res.json();
        if (!Array.isArray(feedList)) feedList = feedList.data || [];
        
        feedList.forEach(r => {
            if (r.x && r.y) {
                const loc = new kakao.maps.LatLng(Number(r.y), Number(r.x));
                const marker = new kakao.maps.Marker({ position: loc, map: globalMap });
                
                kakao.maps.event.addListener(marker, 'click', function() {
                    openRestDetail(
                        (r.name || '').replace(/`/g, ""), 
                        (r.category || '').replace(/`/g, ""), 
                        (r.address || '').replace(/`/g, ""), 
                        (r.comment || '').replace(/`/g, ""), 
                        r.tier || '', r.kakao_id || '', r.image_url || '', r.owner || '', r.id || '', false
                    );
                });
            }
        });
    } catch (error) {
        console.error("마커 로드 중 에러 발생:", error);
    }
}

// =========================================================
// [5] 메인 데이터 렌더링 (홈, 탐색, 네트워크) 
// =========================================================
async function fetchHomeData() {
    try {
        const res = await fetch(`${API_URL}/main/data`); 
        if (!res.ok) throw new Error("서버 에러");
        const d = await res.json();
        
        nationalTop50 = d.national_top_50 || [];
        regionalTop10 = d.regional_top_10 || {};
        
        let displayEditors = [];
        const titleEl = document.getElementById('home-editor-title');

        if (globalRegion === 'national') {
            displayEditors = d.all_editors || [];
            if (titleEl) titleEl.innerText = currentLang === 'ko' ? "인기 미식가" : "Featured Gourmets";
        } else {
            const regionalUsernames = regionalTop10[globalRegion] || [];
            displayEditors = (d.all_editors || []).filter(e => regionalUsernames.includes(e.username));
            if (titleEl) titleEl.innerText = currentLang === 'ko' ? `${globalRegion}지역 추천 미식가` : `Top in ${globalRegion}`;
        }

        if (displayEditors.length === 0) {
            document.getElementById('editor-list-container').innerHTML = `<div style="padding:20px; color:var(--text-sub); font-size:13px; text-align:center; width:100%;">${currentLang === 'ko' ? '이 지역에 활동하는 미식가가 없습니다.' : 'No gourmets in this region yet.'}</div>`;
        } else {
            let editorsHtml = '';
            displayEditors.forEach(e => {
                const isMe = (e.username === localStorage.getItem('currentUser'));
                const isFollow = followingList.includes(e.username);
                let followHtml = !isMe ? `<button class="editor-follow-btn" onclick="event.stopPropagation(); const btn = this; executeToggleFollow('${e.username}').then(() => { btn.innerText = btn.innerText.includes('✓') ? '+ 팔로우' : '✓ 팔로잉'; });">${isFollow ? '✓ 팔로잉' : '+ 팔로우'}</button>` : '';

                editorsHtml += `
                    <div class="editor-card" onclick="fetchGuideView('${e.username}', true)">
                        <div class="editor-img-container" style="overflow:visible !important;">${getAvatar(e.username)}</div>
                        <div style="font-weight:800; font-size:15px; color:var(--brand-primary); margin-bottom:2px;">${e.display_name || e.username}</div>
                        <div style="font-size:11px; color:var(--text-sub);">${e.followers} ${currentLang === 'ko' ? '팔로워' : 'Followers'}</div>
                        ${followHtml}
                    </div>`;
            });
            document.getElementById('editor-list-container').innerHTML = editorsHtml;
        }
        
        const renderer = function(list, tid, isPopular = false) {
            if (globalRegion !== 'national') {
                list = list.filter(r => (r.address || '').includes(globalRegion));
            }
            if (list.length === 0) { 
                document.getElementById(tid).innerHTML = `<div style="grid-column: span 2; padding:20px; color:var(--text-sub); text-align:center; font-size:13px;">해당 지역의 식당이 없습니다.</div>`; 
                return; 
            }
            
            let html = '';
            list.forEach(r => {
                const finalImg = getSmartRestImage(r.kakao_id, r.category, r.image_url);
                let subInfoHtml = isPopular && r.save_count ? `🔥 ${r.save_count}명 등록` : `✍️ ${r.owner}`;
                let bookmarkHtml = (r.owner !== localStorage.getItem('currentUser')) ? `
                    <div class="bookmark-btn-mini" onclick="event.stopPropagation(); executeBookmark('${r.id}')" style="position:absolute; bottom:8px; right:8px; background:rgba(255,255,255,0.9); padding:6px; border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,0.2);">
                        <svg viewBox="0 0 24 24" style="width:16px; height:16px; stroke:var(--brand-primary); fill:none; stroke-width:2;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    </div>` : '';

                html += `
                    <div class="rest-card" onclick="openRestDetail(\`${(r.name||'').replace(/`/g,"")}\`, \`${(r.category||'').replace(/`/g,"")}\`, \`${(r.address||'').replace(/`/g,"")}\`, \`${(r.comment||'').replace(/`/g,"")}\`, \`${r.tier||''}\`, \`${r.kakao_id||''}\`, \`${r.image_url||''}\`, \`${r.owner||''}\`, \`${r.id||''}\`, false)">
                        <div class="rest-img-wrapper">
                            <img class="rest-img" src="${finalImg}" onerror="this.src='https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80'">
                            ${bookmarkHtml}
                        </div>
                        <div class="rest-name">${r.name}</div>
                        <div style="font-size:11px; color:var(--text-sub); padding: 0 12px 12px;">${subInfoHtml}</div>
                    </div>`;
            });
            document.getElementById(tid).innerHTML = html;
        };
        
        renderer(d.popular_places || [], 'popular-list-container', true); 
        renderer(d.new_restaurants || [], 'new-list-container', false);
        
    } catch(error) {
        console.error("메인 데이터 페치 에러:", error);
    }
}

async function fetchNetworkData() {
    try {
        const res = await fetch(`${API_URL}/main/data`); 
        if (!res.ok) throw new Error("서버 에러 발생");
        const d = await res.json();
        
        nationalTop50 = d.national_top_50 || [];
        regionalTop10 = d.regional_top_10 || {};

        const curUser = localStorage.getItem('currentUser');
        const me = (d.all_editors || []).find(e => e.username === curUser);
        if (me) followingList = me.following || [];
        
        let followingHtml = '';
        if (followingList.length > 0) {
            followingList.forEach(u => {
                const targetUser = (d.all_editors || []).find(e => e.username === u);
                const displayName = targetUser ? (targetUser.display_name || u) : u;

                followingHtml += `
                    <div class="user-result-item" onclick="fetchGuideView('${u}', true)" style="display:flex; align-items:center; padding:16px; background:var(--bg-card); border-radius:16px; margin-bottom:12px; box-shadow:var(--shadow-soft); cursor:pointer;">
                        <div style="width:48px; height:48px; border-radius:50%; overflow:visible; margin-right:16px;">${getAvatar(u)}</div>
                        <div style="flex:1;">
                            <div style="font-weight:700; font-size:15px; color:var(--text-main); margin-bottom:4px;">${displayName}</div>
                            <div class="tag-pill tag-blue" style="font-size:10px; padding:4px 8px; background:rgba(28, 30, 33, 0.05); color:var(--brand-primary); display:inline-block; border-radius:8px;">✓ ${currentLang === 'ko' ? '팔로잉' : 'Following'}</div>
                        </div>
                        <div style="color:var(--text-sub);"><svg class="svg-icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>`;
            });
        } else {
            followingHtml = `<div style="text-align:center; padding:40px 20px; border:1px dashed var(--border-color); border-radius:var(--radius-lg); color:var(--text-sub); font-size:13px;">아직 팔로우한 미식가가 없습니다.</div>`;
        }
        document.getElementById('following-list-container').innerHTML = followingHtml;

        let recommendedSet = new Set();
        followingList.forEach(followedUser => {
            const fUserObj = (d.all_editors || []).find(e => e.username === followedUser);
            if (fUserObj && fUserObj.following) fUserObj.following.forEach(u => recommendedSet.add(u));
        });

        let recUsernames = Array.from(recommendedSet).filter(u => u !== curUser && !followingList.includes(u));
        if (recUsernames.length === 0) {
            recUsernames = (d.all_editors || []).filter(e => e.username !== curUser && !followingList.includes(e.username)).slice(0, 10).map(e => e.username);
        }

        let recHtml = '';
        if (recUsernames.length > 0) {
            const recommended = recUsernames.map(u => (d.all_editors || []).find(e => e.username === u)).filter(Boolean);
            recHtml += `<div class="editor-row" style="padding-bottom: 10px;">`; 
            recommended.forEach(e => {
                recHtml += `
                    <div class="editor-card" onclick="fetchGuideView('${e.username}', true)">
                        <div class="editor-img-container" style="overflow:visible !important;">${getAvatar(e.username)}</div>
                        <div style="font-weight:800; font-size:14px; color:var(--brand-primary);">${e.display_name || e.username}</div>
                        <div style="font-size:11px; color:var(--text-sub); margin-top:4px;">${currentLang === 'ko' ? '게시물' : 'Posts'}: ${e.rest_count}</div>
                    </div>`;
            });
            recHtml += `</div>`; 
        } else {
            recHtml = `<div style="text-align:center; padding:40px 20px; border:1px dashed var(--border-color); border-radius:var(--radius-lg); color:var(--text-sub); font-size:13px;">추천할 미식가가 없습니다.</div>`;
        }
        document.getElementById('recommended-list-container').innerHTML = recHtml;
        
    } catch(error) {
        console.error("네트워크 탭 데이터 로드 실패", error);
    }
}

// =========================================================
// [5-1] 랭킹 및 탐색 시스템
// =========================================================
function switchExploreTab(tab) {
    if (tab === 'ranking') {
        document.getElementById('tab-explore-ranking').style.background = 'var(--brand-primary)';
        document.getElementById('tab-explore-ranking').style.color = '#FFFFFF';
        document.getElementById('tab-explore-feed').style.background = '#EAEAEA';
        document.getElementById('tab-explore-feed').style.color = '#111111';
        document.getElementById('explore-ranking-area').style.display = 'block';
        document.getElementById('explore-feed-area').style.display = 'none';
        fetchRankingData(); 
    } else {
        document.getElementById('tab-explore-feed').style.background = 'var(--brand-primary)';
        document.getElementById('tab-explore-feed').style.color = '#FFFFFF';
        document.getElementById('tab-explore-ranking').style.background = '#EAEAEA';
        document.getElementById('tab-explore-ranking').style.color = '#111111';
        document.getElementById('explore-feed-area').style.display = 'block';
        document.getElementById('explore-ranking-area').style.display = 'none';
        fetchExploreFeed(); 
    }
}

function renderRankingList(rankingData, container) {
    let html = '';
    if(rankingData.length === 0) {
        html = `<div style="text-align:center; padding:40px; border:1px dashed var(--border-color); border-radius:12px; color:var(--text-sub); font-size:13px;">검색된 조건의 랭킹 데이터가 없습니다.</div>`;
    } else {
        rankingData.forEach((r, idx) => {
            const finalImg = getSmartRestImage(r.kakao_id, r.category, r.image_url);
            let rankBadge = `<div style="font-size:18px; font-weight:900; color:var(--text-sub);">${idx + 1}</div>`;
            if(idx === 0) rankBadge = `<div style="font-size:24px;">🥇</div>`;
            else if (idx === 1) rankBadge = `<div style="font-size:24px;">🥈</div>`;
            else if (idx === 2) rankBadge = `<div style="font-size:24px;">🥉</div>`;

            html += `
                <div class="user-result-item" onclick="closeGlobalSearchModal(); openRestDetail(\`${(r.name||'').replace(/'/g,"")}\`, \`${(r.category||'').replace(/'/g,"")}\`, \`${(r.address||'').replace(/'/g,"")}\`, '', '', \`${r.kakao_id}\`, \`${r.image_url}\`, '', \`${r.id}\`, false)" style="display:flex; align-items:center; padding:16px; background:var(--bg-card); border-radius:16px; margin-bottom:12px; box-shadow:var(--shadow-soft); cursor:pointer;">
                    <div style="width:40px; text-align:center; margin-right:10px;">${rankBadge}</div>
                    <div style="width:60px; height:60px; border-radius:12px; overflow:hidden; flex-shrink:0; margin-right:16px;">
                        <img src="${finalImg}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:800; font-size:15px; color:var(--text-main); margin-bottom:4px;">${r.name}</div>
                        <div style="font-size:11px; color:var(--text-sub); margin-bottom:6px;">${r.category.split('>').pop()}</div>
                        <div class="tag-pill tag-pink" style="font-size:10px; padding:4px 8px; background:rgba(255,90,32,0.1); color:var(--brand-fab); display:inline-block; border-radius:8px; font-weight:700;">🔥 ${r.save_count}명이 서열에 등록</div>
                    </div>
                </div>`;
        });
    }
    container.innerHTML = html;
}

async function fetchRankingData() {
    const keyword = document.getElementById('ranking-search-input').value.trim();
    const container = document.getElementById('ranking-list-container');
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--brand-primary); font-size:13px; font-weight:700;">랭킹을 분석 중입니다... ⏳</div>`;
    
    try {
        const res = await fetch(`${API_URL}/ranking?keyword=${encodeURIComponent(keyword)}`);
        const d = await res.json();
        renderRankingList(d.ranking, container);
    } catch(e) { 
        container.innerHTML = `<div style="color: red; text-align: center; padding: 20px;">서버와의 통신에 실패했습니다.</div>`;
    }
}
function openGlobalSearchModal() {
    document.getElementById('global-search-modal').style.display = 'flex';
    document.getElementById('global-ranking-input').value = '';
    document.getElementById('global-search-results').innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--text-sub); font-size:13px;">원하시는 메뉴나 식당 이름을 검색하시면<br>가장 많이 등록된 순서대로 랭킹을 보여드립니다.</div>`;
}

function closeGlobalSearchModal() {
    document.getElementById('global-search-modal').style.display = 'none';
}

async function executeGlobalSearch() {
    const keyword = document.getElementById('global-ranking-input').value.trim();
    const container = document.getElementById('global-search-results');
    
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--brand-primary); font-size:13px; font-weight:700;">랭킹을 분석 중입니다... ⏳</div>`;
    
    try {
        const res = await fetch(`${API_URL}/ranking?keyword=${encodeURIComponent(keyword)}`);
        const d = await res.json();
        renderRankingList(d.ranking, container);
    } catch(e) {
        container.innerHTML = `<div class="server-error-banner" style="color: red; text-align: center; padding: 20px;">데이터를 불러오지 못했습니다.</div>`;
    }
}

async function fetchExploreFeed() {
    try {
        const current = localStorage.getItem('currentUser');
        const res = await fetch(`${API_URL}/feed`); 
        if (!res.ok) {
            throw new Error("서버 에러 발생");
        }
        
        let feedList = await res.json();
        
        if (!Array.isArray(feedList)) {
            feedList = feedList.data || [];
        }
        
        if (globalRegion !== 'national') {
            feedList = feedList.filter(function(r) { 
                return (r.address || '').includes(globalRegion); 
            });
        }

        if (!feedList || feedList.length === 0) {
            document.getElementById('feed-scroll-area').innerHTML = `
                <div style="text-align:center; padding:60px 20px; border:1px dashed var(--border-color); border-radius:var(--radius-lg); color:var(--text-sub); font-size:14px;">
                    ${currentLang === 'ko' ? '해당 지역에 아직 소식이 없습니다.' : 'No posts here.'}
                </div>
            `;
            return;
        }
        
        let html = '';
        feedList.reverse().forEach(function(r) {
            const isMe = (r.owner === current); 
            const isFollowing = followingList.includes(r.owner);
            const finalImg = getSmartRestImage(r.kakao_id, r.category, r.image_url);
            const fallbackImg = "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80";
            
            const safeName = (r.name || '').replace(/`/g, "");
            const safeCat = (r.category || '').replace(/`/g, "");
            const safeAddr = (r.address || '').replace(/`/g, "");
            const safeComment = (r.comment || '').replace(/`/g, "");
            
            const likesCount = (r.likes || []).length;
            const isLiked = (r.likes || []).includes(current);

            let socialHtml = `
                <div class="social-bar" onclick="event.stopPropagation()" style="display:flex; justify-content:space-between; align-items:center; padding-top:16px; border-top:1px solid var(--border-color); margin-top:16px;">
                    <div style="display:flex; gap:16px;">
                        <div id="like-btn-${r.id}" class="action-btn ${isLiked ? 'liked' : ''}" onclick="executeLike('${r.id}')" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                            <svg class="svg-icon" viewBox="0 0 24 24" style="width:20px; height:20px; stroke:var(--text-sub); fill:${isLiked ? 'var(--brand-fab)' : 'none'};"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            <span id="like-count-${r.id}" style="color:var(--text-sub); font-size:13px; font-weight:600;">${likesCount}</span>
                        </div>
                        <div class="action-btn" onclick="openRestDetail(\`${safeName}\`, \`${safeCat}\`, \`${safeAddr}\`, \`${safeComment}\`, \`${r.tier||''}\`, \`${r.kakao_id||''}\`, \`${r.image_url||''}\`, \`${r.owner||''}\`, \`${r.id||''}\`, false)" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                            <svg class="svg-icon" viewBox="0 0 24 24" style="width:20px; height:20px; stroke:var(--text-sub);"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        </div>
                    </div>
            `;
            
            if (!isMe) {
                socialHtml += `
                    <div class="action-btn" onclick="executeBookmark('${r.id}')" style="cursor:pointer;">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:20px; height:20px; stroke:var(--text-sub);"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                `;
            }
            
            socialHtml += `</div>`;

            html += `
            <div class="feed-card" style="background:var(--bg-card); border-radius:var(--radius-xl); padding:24px; box-shadow:var(--shadow-soft); border:1px solid var(--border-color); margin-bottom:30px; cursor:pointer;" onclick="openRestDetail(\`${safeName}\`, \`${safeCat}\`, \`${safeAddr}\`, \`${safeComment}\`, \`${r.tier||''}\`, \`${r.kakao_id||''}\`, \`${r.image_url||''}\`, \`${r.owner||''}\`, \`${r.id||''}\`, false)">
                
                <div class="feed-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;" onclick="event.stopPropagation()">
                    <div class="feed-user" onclick="fetchGuideView('${r.owner}', true)" style="font-weight:800; cursor:pointer; display:flex; align-items:center; gap:10px; color:var(--brand-primary);">
                        <div style="width:36px; height:36px; border-radius:50%; overflow:visible;">
                            ${getAvatar(r.owner)}
                        </div>
                        ${r.owner}
                    </div>
                    ${!isMe ? `<button onclick="executeToggleFollow('${r.owner}')" style="background:transparent; border:1px solid var(--border-color); color:var(--text-sub); padding:6px 12px; border-radius:8px; font-weight:600; font-size:11px; cursor:pointer;">${isFollowing?'✓ 팔로잉':'Follow'}</button>` : ''}
                </div>
                
                <div style="position:relative; width:100%; border-radius:16px; overflow:hidden; margin-bottom:20px;">
                    <img src="${finalImg}" class="feed-main-img" onerror="this.src='${fallbackImg}'" style="width:100%; height:260px; object-fit:cover;">
                    ${r.tier ? `<div class="rest-badge" style="position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.7); color:white; padding:6px 12px; border-radius:10px; font-size:11px; font-weight:800;">⭐️ ${r.tier.split(' ')[0]}</div>` : ''}
                </div>
                
                <div class="feed-body" style="padding:0;">
                    <div class="feed-rest-name" style="font-size:20px; font-weight:900; color:var(--text-main); margin-bottom:8px;">
                        ${r.name}
                    </div>
                    <div style="font-size:12px; color:var(--text-sub); margin-bottom:16px; font-weight:500; display:flex; align-items:center; gap:6px;">
                        <span>📍 ${r.address.split(' ')[0]} ${r.address.split(' ')[1] || ''}</span>
                        <span>•</span>
                        <span>${r.category.split('>').pop()}</span>
                    </div>
                    ${r.comment ? `<div style="font-size:14px; color:var(--text-main); line-height:1.6; font-weight:400;">"${r.comment}"</div>` : ''}
                    
                    ${socialHtml}
                </div>
            </div>`;
        });
        
        document.getElementById('feed-scroll-area').innerHTML = html;
        
    } catch(error) {
        console.error("피드 로드 실패:", error);
    }
}

// =========================================================
// [6] 핵심: 프로필 (다크 카드) 및 서열표 엔진 (완벽 복구)
// =========================================================
async function fetchGuideView(u, isForeign = false) {
    if (isForeign) { 
        switchTab('profile', true); 
        document.getElementById('registration-trigger').style.display = 'none'; 
    } else { 
        document.getElementById('registration-trigger').style.display = 'block'; 
    }
    
    const curUser = localStorage.getItem('currentUser');
    const isMe = (u === curUser);
    const isFollowing = followingList.includes(u);
    
    try {
        const res = await fetch(`${API_URL}/guide/${u}`);
        if (!res.ok) {
            throw new Error("서버 에러 발생");
        }
        
        const data = await res.json(); 
        
        currentProfileGuideData = data.guide;
        currentProfileOwner = u;
        currentProfileIsMe = isMe;
        
        currentProfilePhilosophy = data.philosophy || '';
        currentProfileTags = data.taste_tags || [];
        currentProfilePersonalInfo = data.personal_info || '';

        if (isMe) {
            const myRes = await fetch(`${API_URL}/restaurants`, { 
                headers: { 'user-id': u } 
            });
            const myData = await myRes.json();
            
            currentProfileGuideData["평가 대기 중 ⏳"] = myData.data.filter(function(r) { 
                return !r.tier; 
            });
        }

        let regionCounts = {}; 
        let maxCount = 0; 
        currentProfileLocalRegion = '';
        
        Object.values(currentProfileGuideData).forEach(function(tierList) {
            tierList.forEach(function(item) {
                if (item.address) {
                    let region = item.address.split(' ')[0];
                    regionCounts[region] = (regionCounts[region] || 0) + 1;
                    
                    if (regionCounts[region] > maxCount) { 
                        maxCount = regionCounts[region]; 
                        currentProfileLocalRegion = region; 
                    }
                }
            });
        });

        // 🚨 [수정됨] 칭호(별/레벨) 아이콘 복구
        const levelHtml = data.level ? data.level : '뉴비 미식가 🌱';

        const philosophyHtml = currentProfilePhilosophy 
            ? `<div class="profile-philosophy">"${currentProfilePhilosophy}"</div>` 
            : '';
        
        const tagsHtml = currentProfileTags.length > 0 
            ? `<div class="profile-dna-tags">${currentProfileTags.map(function(t) { return `<div class="dna-tag">#${t}</div>`; }).join('')}</div>`
            : '';
            
        const badgesHtml = data.badges && data.badges.length > 0
            ? `<div class="profile-badges">${data.badges.map(function(b) { return `<span class="badge-item">${b}</span>`; }).join('')}</div>`
            : '';

        let profileActionBtn = '';
        if (!isMe) {
            profileActionBtn = `
                <button onclick="executeToggleFollow('${u}', true)" style="background:var(--brand-fab); color:#FFF; border:none; padding:12px 36px; border-radius:24px; font-weight:800; font-size:13px; cursor:pointer; margin-bottom:10px; box-shadow:var(--shadow-fab); transition:all 0.2s;">
                    ${isFollowing ? (currentLang==='ko'?'✓ 팔로잉':'✓ Following') : (currentLang==='ko'?'+ 팔로우':'+ Follow')}
                </button>
            `;
        } else {
            profileActionBtn = `
                <button class="my-journal-btn" onclick="openEditProfileModal()" style="background:rgba(255,255,255,0.1); color:#FFF; border:1px solid rgba(255,255,255,0.3); padding:8px 24px; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer;">
                    EDIT PROFILE
                </button>
            `;
        }

        document.getElementById('profile-header-target').innerHTML = `
            <div class="profile-dash">
                <div class="dash-header">
                    <div class="dash-pic-container" ${isMe ? `onclick="triggerProfileUpload()"` : ''}>
                        ${getAvatar(u)}
                    </div>
                    
                    <div style="font-size:26px; font-weight:900; margin-bottom:4px; display:flex; justify-content:center; align-items:center; gap:8px; letter-spacing:-0.5px;">
                        <span id="display-profile-name">${data.nickname || u}</span>
                    </div>
                    
                    <div style="font-size:14px; font-weight:600; color:var(--brand-yellow); margin-bottom: 16px;">
                        ${levelHtml}
                    </div>
                    
                    ${philosophyHtml}
                    ${tagsHtml}
                    ${badgesHtml}
                    
                    ${profileActionBtn}
                </div>
                
                <div class="dash-stats" id="profile-stats-bar"></div>
            </div>
        `;

    } catch(error) {
        console.error("프로필 데이터 로드 실패", error);
    }
    
    fetchStats(u);

    document.getElementById('guide-controls-target').style.display = 'block';
    document.getElementById('guide-search-input').value = '';
    
    switchGuideTab('national'); 
}

function switchGuideTab(tab) {
    activeGuideTab = tab;
    renderGuideSheet();
}

function renderGuideSheet() {
    let searchQuery = '';
    if (document.getElementById('guide-search-input')) {
        searchQuery = document.getElementById('guide-search-input').value.toLowerCase();
    }
    
    const tierMeta = { 
        "⭐⭐⭐ (3스타)": { title: "3 STARS", sub: "NO.1 CLASS", color: "var(--brand-yellow)" }, 
        "⭐⭐ (2스타)": { title: "2 STARS", sub: "PREMIUM", color: "#FFFFFF" }, 
        "⭐ (1스타)": { title: "1 STAR", sub: "EXCELLENT", color: "#CCCCCC" }, 
        "단순 추천": { title: "RECOMMENDED", sub: "REC", color: "#A86A51" }, 
        "평가 대기 중 ⏳": { title: "WISHLIST", sub: "WISH", color: "#777777" } 
    };
    
    let html = '';
    let hasAnyItem = false;
    
    for(let key in tierMeta) {
        let items = currentProfileGuideData[key] || [];
        
        items = items.filter(function(item) {
            let matchSearch = true;
            if (searchQuery) {
                const nameStr = (item.name || '').toLowerCase();
                const catStr = (item.category || '').toLowerCase();
                const addrStr = (item.address || '').toLowerCase();
                
                matchSearch = nameStr.includes(searchQuery) || catStr.includes(searchQuery) || addrStr.includes(searchQuery);
            }
            
            let matchTab = true;
            if (activeGuideTab !== 'national') {
                matchTab = (item.address || '').startsWith(currentProfileLocalRegion);
            }
            
            return matchSearch && matchTab;
        });

        if (items.length > 0) {
            hasAnyItem = true;
            const meta = tierMeta[key];
            
            html += `
                <div class="tier-section" style="margin-bottom: 30px;">
                    <div class="tier-header-title">
                        ${meta.title} 
                        <span style="font-size:14px; color:var(--text-sub);">${items.length}</span>
                    </div>
                    <div class="guide-grid">
            `;
            
            items.forEach(function(i) {
                const safeName = (i.name || '').replace(/'/g, "");
                const safeCat = (i.category || '').replace(/'/g, "");
                const safeAddr = (i.address || '').replace(/'/g, "");
                const safeComment = (i.comment || '').replace(/'/g, "");
                const finalImg = getSmartRestImage(i.kakao_id, i.category, i.image_url);
                
                let selectHtml = '';
                if (currentProfileIsMe) {
                    selectHtml = `
                        <select onchange="executeChangeTier('${i.id}', this.value)" onclick="event.stopPropagation()" style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.8); color:#FFF; border:1px solid rgba(255,255,255,0.3); border-radius:8px; font-size:11px; padding:6px; outline:none; font-weight:600;">
                            <option value="">등급수정</option>
                            <option value="⭐⭐⭐ (3스타)" ${i.tier === '⭐⭐⭐ (3스타)' ? 'selected' : ''}>3 Stars</option>
                            <option value="⭐⭐ (2스타)" ${i.tier === '⭐⭐ (2스타)' ? 'selected' : ''}>2 Stars</option>
                            <option value="⭐ (1스타)" ${i.tier === '⭐ (1스타)' ? 'selected' : ''}>1 Star</option>
                            <option value="단순 추천" ${i.tier === '단순 추천' ? 'selected' : ''}>Rec</option>
                            <option value="" ${!i.tier ? 'selected' : ''}>Wishlist</option>
                        </select>
                    `;
                }

                html += `
                    <div class="guide-card" onclick="openRestDetail('${safeName}', '${safeCat}', '${safeAddr}', '${safeComment}', '${i.tier||''}', '${i.kakao_id||''}', '${i.image_url||''}', '${currentProfileOwner}', '${i.id||''}')">
                        <img class="guide-card-bg" src="${finalImg}">
                        <div class="guide-card-overlay">
                            <div class="guide-tier-text" style="color:${meta.color};">${meta.sub}</div>
                            <div class="guide-name-text">${i.name}</div>
                            <div style="font-size:10px; color:#ddd; margin-top:4px; font-weight:500;">
                                ${i.address ? i.address.split(' ')[0] : ''} · ${i.category ? i.category.split('>').pop().trim() : ''}
                            </div>
                        </div>
                        ${selectHtml}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
    }
    
    if (!hasAnyItem) {
        html = `
            <div style="text-align:center; padding:50px 20px; border:1px dashed var(--border-color); border-radius:var(--radius-lg); color:var(--text-sub); font-size:13px; font-weight:600;">
                ${currentLang === 'ko' ? '기록된 맛집이 없습니다.' : 'No places recorded yet.'}
            </div>
        `;
    }
    
    document.getElementById('michelin-tables-target').innerHTML = html;
}

async function fetchStats(u) {
    try {
        const res = await fetch(`${API_URL}/profile/stats`, { 
            headers: { 'user-id': u } 
        });
        const d = await res.json();
        
        const bar = document.getElementById('profile-stats-bar');
        if (bar) {
            let statsHtml = '';
            Object.keys(d.stats).forEach(function(k) {
                statsHtml += `
                    <div style="text-align:center;">
                        <div style="font-weight:800; font-size:20px; line-height:1; color:#FFFFFF;">
                            ${d.stats[k].count}
                        </div>
                        <div style="font-size:10px; font-weight:600; color:rgba(255,255,255,0.6); margin-top:6px; text-transform:uppercase; letter-spacing:1px;">
                            ${k.split(' ')[0]}
                        </div>
                    </div>
                `;
            });
            bar.innerHTML = statsHtml;
        }
    } catch(e) {
        console.error("통계 정보를 불러오는데 실패했습니다.", e);
    }
}

async function executeChangeTier(id, tier) {
    const user = localStorage.getItem('currentUser');
    try {
        await fetch(`${API_URL}/restaurants/${id}`, { 
            method: 'PUT', 
            headers: { 
                'Content-Type': 'application/json', 
                'user-id': user 
            }, 
            body: JSON.stringify({ tier: tier }) 
        });
        fetchGuideView(user);
    } catch(e) {
        console.error("티어 변경 실패", e);
    }
}

async function executeToggleFollow(target, isFromProfile = false) {
    const user = localStorage.getItem('currentUser');
    try {
        const res = await fetch(`${API_URL}/follow/${target}`, { 
            method: 'POST', 
            headers: { 'user-id': user } 
        });
        
        if (res.ok) { 
            const data = await res.json();
            followingList = data.following; 
            
            if (isFromProfile) {
                fetchGuideView(target, true); 
            } else {
                fetchNetworkData(); 
            }
        }
    } catch(e) {
        console.error("팔로우 토글 실패", e);
    }
}

// =========================================================
// [8] 장소 검색 및 새로운 등기 (글쓰기) 로직
// =========================================================
function openSearchModal() { 
    switchTab('profile'); 
    document.getElementById('search-modal').style.display = 'flex'; 
}

function closeSearchModal() { 
    document.getElementById('search-modal').style.display = 'none'; 
}

async function executeKakaoSearch() {
    const keyword = document.getElementById('search-keyword').value;
    if (!keyword) return;
    
    try {
        const res = await fetch(`${API_URL}/search/kakao?query=${encodeURIComponent(keyword)}`);
        const d = await res.json();
        
        if (d.errorType || d.msg || d.code) {
            alert(`🚨 카카오 서버 차단 사유: ${d.message || d.msg || d.code}`);
            return;
        }

        const target = document.getElementById('search-results-target');
        
        if (!d.documents || d.documents.length === 0) { 
            target.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--text-sub); font-size:13px; font-weight:600;">
                    ${currentLang === 'ko' ? '검색 결과가 없습니다.' : 'No results.'}
                </div>
            `; 
            return; 
        }
        
        let html = '';
        d.documents.forEach(function(doc) {
            const safeName = doc.place_name.replace(/'/g, "\\'");
            const safeCat = doc.category_name.replace(/'/g, "\\'");
            const safeAddr = (doc.road_address_name || doc.address_name).replace(/'/g, "\\'");
            const phone = doc.phone || '';
            
            html += `
                <div class="user-result-item" onclick="preparePosting('${safeName}', '${safeCat}', '${safeAddr}', '${doc.id}', ${doc.x}, ${doc.y}, '${phone}')" style="border:none; border-bottom:1px solid var(--border-color); border-radius:0; box-shadow:none; padding:16px 0; background:transparent;">
                    <div style="flex:1;">
                        <div style="font-weight:800; font-size:15px; color:var(--brand-primary); margin-bottom:4px;">
                            ${doc.place_name}
                        </div>
                        <div style="font-size:12px; color:var(--text-sub); font-weight:500;">
                            ${doc.road_address_name || doc.address_name}
                        </div>
                    </div>
                    <div style="color:var(--brand-fab);">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:20px; height:20px;">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </div>
                </div>
            `;
        });
        
        target.innerHTML = html;
        
    } catch(e) {
        alert("🚨 파이썬 백엔드 서버가 멈춰있습니다. 터미널을 확인해주세요.");
    }
}

function handleImagePreview(input) {
    const photoBox = document.getElementById('selected-rest-photo');
    
    if (input.files && input.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            photoBox.style.backgroundImage = `url('${e.target.result}')`;
            
            const count = input.files.length;
            const statusText = count > 1 
                ? `🔥 총 ${count}장의 사진 선택됨` 
                : `✅ 사진 1장 선택됨`;
            
            photoBox.innerHTML = `
                <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.7); color:white; font-size:12px; font-weight:800; text-align:center; padding: 10px 0;">
                    ${statusText}
                </div>
            `;
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        photoBox.style.backgroundImage = 'none';
        photoBox.innerHTML = '';
    }
}

function preparePosting(n, c, a, id, x, y, phone) {
    closeSearchModal();
    
    const form = document.getElementById('post-detail-modal');
    form.style.display = 'flex';
    
    document.getElementById('h-name').value = n;
    document.getElementById('h-cat').value = c.split('>').pop().trim();
    document.getElementById('h-addr').value = a;
    document.getElementById('h-id').value = id;
    document.getElementById('h-x').value = x;
    document.getElementById('h-y').value = y;
    document.getElementById('h-phone').value = phone || '';
    
    document.getElementById('selected-info-text').innerHTML = `
        <b style="font-size:20px; font-weight:900; color:var(--brand-primary);">${n}</b><br>
        <span style="font-size:13px; color:var(--text-sub); font-weight:600; display:inline-block; margin-top:4px;">${a}</span>
    `;

    const photoBox = document.getElementById('selected-rest-photo');
    const defaultBgUrl = getSmartRestImage(id, c, null);
    photoBox.style.backgroundImage = `url('${defaultBgUrl}')`;
    photoBox.innerHTML = '<div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.6); color:white; font-size:11px; font-weight:700; text-align:center; padding: 6px 0;">✨ AI Theme Image</div>'; 
    
    const photoUrl = `https://img1.kakaocdn.net/cthumb/local/R0x0/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flocalfiy%2Fsearch%2Fplace%2F${id}`;
    let img = new Image();
    
    img.onload = function() { 
        photoBox.style.backgroundImage = `url('${photoUrl}')`; 
        photoBox.innerHTML = `
            <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.6); color:white; font-size:11px; font-weight:700; text-align:center; padding: 6px 0;">
                📍 Basic Location Image
            </div>
        `;
    };
    img.src = photoUrl;

    setTimeout(function() {
        if (typeof kakao !== 'undefined' && kakao.maps) {
            const mapArea = document.getElementById('map-preview-area');
            mapArea.innerHTML = ''; 
            
            const loc = new kakao.maps.LatLng(Number(y), Number(x));
            
            if (!previewMap) {
                previewMap = new kakao.maps.Map(mapArea, { center: loc, level: 3 });
                previewMarker = new kakao.maps.Marker({ position: loc, map: previewMap });
            } else {
                previewMap.relayout();
                previewMap.setCenter(loc);
                previewMarker.setPosition(loc);
            }
            
            setTimeout(function() { 
                previewMap.relayout(); 
                previewMap.setCenter(loc); 
            }, 200);
        }
    }, 300); 
}

function cancelPosting() { 
    document.getElementById('post-detail-modal').style.display = 'none'; 
    document.getElementById('post-image').value = '';
    document.getElementById('post-comment').value = '';
}

async function executeAddRestaurant() {
    const user = localStorage.getItem('currentUser');
    const fd = new FormData();
    
    fd.append('name', document.getElementById('h-name').value);
    fd.append('category', document.getElementById('h-cat').value);
    fd.append('address', document.getElementById('h-addr').value);
    fd.append('kakao_id', document.getElementById('h-id').value);
    fd.append('x', document.getElementById('h-x').value);
    fd.append('y', document.getElementById('h-y').value);
    
    const comment = document.getElementById('post-comment').value;
    if (!comment) { 
        alert("미식평을 작성해주세요."); 
        return; 
    }
    fd.append('comment', comment);
    
    const files = document.getElementById('post-image').files;
    if (files && files.length > 0) { 
        for(let i=0; i<files.length; i++) {
            fd.append('images', files[i]); 
        }
    }

    try {
        const res = await fetch(`${API_URL}/restaurants`, { 
            method: 'POST', 
            headers: { 'user-id': encodeURI(user) }, 
            body: fd 
        });
        
        if (res.ok) { 
            alert("성공적으로 등록되었습니다! 📝"); 
            cancelPosting(); 
            fetchGuideView(user); 
        } else { 
            const errText = await res.text();
            alert(`🚨 서버 저장 실패! (코드: ${res.status})\n이유: ${errText}`); 
        }
    } catch(e) { 
        alert(`🚨 네트워크 통신 에러 발생!\n${e.message}\n(터미널 서버 로그를 확인해주세요)`); 
    }
}

async function executeDeleteRestaurant() {
    if (!confirm("이 맛집 기록을 정말 삭제하시겠습니까?\n한 번 삭제하면 복구할 수 없습니다.")) {
        return;
    }

    const user = localStorage.getItem('currentUser');
    const restaurantId = currentOpenRestId; 

    if (!restaurantId) {
        alert("삭제할 식당 정보를 찾을 수 없습니다.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/restaurants/${restaurantId}`, {
            method: 'DELETE',
            headers: { 'user-id': encodeURI(user) }
        });

        if (res.ok) {
            alert("기록이 성공적으로 삭제되었습니다.");
            closeRestDetail(); 
            fetchGuideView(user); 
        } else {
            const errText = await res.text();
            alert(`🚨 삭제 실패: ${errText}`);
        }
    } catch (error) {
        alert(`🚨 네트워크 오류로 삭제하지 못했습니다: ${error.message}`);
    }
}

// =========================================================
// [12] 식당 상세 정보 모달 제어
// =========================================================
function openRestDetail(name, category, address, comment, tier, kakao_id, img_url, owner, db_id, showGuestbook = false) {
    document.getElementById('restaurant-detail-modal').style.display = 'flex';
    const user = localStorage.getItem('currentUser');
    
    currentOpenRestId = db_id; 
    
    const detailImgEl = document.getElementById('detail-img');
    const finalImg = getSmartRestImage(kakao_id, category, img_url);
    
    const oldSlider = detailImgEl.querySelector('.multi-image-slider');
    if (oldSlider) {
        oldSlider.remove();
    }
    
    const oldIndicator = detailImgEl.querySelector('.image-indicator');
    if (oldIndicator) {
        oldIndicator.remove();
    }
    
    detailImgEl.style.backgroundImage = `url('${finalImg}')`;
    
    const deleteBtn = document.getElementById('delete-rest-btn');
    if (owner === user && db_id && db_id !== 'undefined') {
        deleteBtn.style.display = 'block';
    } else {
        deleteBtn.style.display = 'none';
    }

    const aiBtn = document.getElementById('ai-sync-btn');
    if (owner === user && db_id && db_id !== 'undefined') {
        aiBtn.style.display = 'block';
        aiBtn.onclick = function(e) { 
            e.stopPropagation(); 
            openAIPicker(db_id, name); 
        };
    } else { 
        aiBtn.style.display = 'none'; 
    }

    document.getElementById('detail-name').innerText = name;
    document.getElementById('detail-category').innerText = category.split('>').pop().trim();
    document.getElementById('detail-address').innerText = `📍 ${address.split(' ')[0]} ${address.split(' ')[1] || ''}`;
    document.getElementById('detail-comment').innerText = comment && comment !== "undefined" ? `"${comment}"` : "등록된 미식평이 없습니다.";
    document.getElementById('detail-tier').innerText = tier ? `⭐️ ${tier.split(' ')[0]}` : "New Entry";
    
    const ownerBtn = document.getElementById('detail-owner');
    ownerBtn.innerText = `✍️ ${owner}`;
    ownerBtn.onclick = function() { 
        closeRestDetail(); 
        fetchGuideView(owner, true); 
    };

    const followBtn = document.getElementById('detail-follow-btn');
    if (owner === user || !owner || owner === 'undefined') {
        followBtn.style.display = 'none';
    } else {
        followBtn.style.display = 'inline-block';
        const isFollowing = followingList.includes(owner);
        
        followBtn.innerText = isFollowing ? (currentLang === 'ko' ? '✓ 팔로잉' : '✓ Following') : (currentLang === 'ko' ? '+ 팔로우' : '+ Follow');
        
        followBtn.onclick = function(e) {
            e.stopPropagation();
            executeToggleFollow(owner, false).then(function() {
                const updated = followingList.includes(owner);
                followBtn.innerText = updated ? (currentLang === 'ko' ? '✓ 팔로잉' : '✓ Following') : (currentLang === 'ko' ? '+ 팔로우' : '+ Follow');
            });
        };
    }
    
    document.getElementById('detail-phone').style.display = 'none';
    document.getElementById('detail-map-area').innerHTML = `
        <div style="text-align:center; padding:100px 0; color:var(--text-sub); font-size:13px; font-weight:600;">
            지도를 불러오는 중입니다...
        </div>
    `;

    const existingAgg = document.querySelector('.aggregated-reviews');
    if (existingAgg) existingAgg.remove();
    
    const existingComment = document.querySelector('.comment-area');
    if (existingComment) existingComment.remove();

    if (db_id && db_id !== 'undefined') {
        fetch(`${API_URL}/feed`)
        .then(function(r) { 
            return r.json(); 
        })
        .then(function(res) {
            const dataList = Array.isArray(res) ? res : (res.data || []);
            const targetData = dataList.find(function(item) { 
                return item.id === db_id; 
            });
            
            if (targetData && targetData.image_urls && targetData.image_urls.length > 1) {
                let sliderHtml = `<div class="multi-image-slider">`;
                
                let indicatorHtml = `
                    <div class="image-indicator" style="position:absolute; top:12px; left:12px; background:rgba(0,0,0,0.8); color:var(--brand-yellow); padding:6px 14px; border-radius:12px; font-size:11px; font-weight:800; z-index:15; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                        📸 다중 사진 (${targetData.image_urls.length}장)
                    </div>
                `;

                targetData.image_urls.forEach(function(u) {
                    sliderHtml += `<img src="${u}" class="multi-image-slide">`;
                });
                sliderHtml += `</div>`;
                
                detailImgEl.style.backgroundImage = 'none';
                detailImgEl.insertAdjacentHTML('afterbegin', indicatorHtml + sliderHtml);
            }
            
            const samePlaces = dataList.filter(function(item) {
                return item.kakao_id === kakao_id && item.comment && item.comment.trim() !== '';
            });

            let reviewHtml = '';
            if (samePlaces.length > 0) {
                samePlaces.forEach(function(p) {
                    reviewHtml += `
                    <div style="padding: 16px 0; border-bottom: 1px dashed var(--border-color);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div style="font-weight:800; font-size:13px; color:var(--brand-primary); cursor:pointer;" onclick="closeRestDetail(); fetchGuideView('${p.owner}', true)">
                                🧑‍🍳 ${p.owner}
                            </div>
                            ${p.tier ? `<span class="s-badge" style="position:static; font-size:9px; padding:4px 8px;">${p.tier.split(' ')[0]}</span>` : ''}
                        </div>
                        <div style="color:var(--text-main); font-size: 14px; line-height:1.6; font-weight:500;">
                            "${p.comment}"
                        </div>
                    </div>`;
                });
            } else {
                reviewHtml = `
                    <div style="color:var(--text-sub); font-size:12px; text-align:center; padding: 20px 0; font-weight:500;">
                        아직 다른 미식가들의 평가가 없습니다.
                    </div>
                `;
            }

            const aggregatedHtml = `
                <div class="aggregated-reviews" style="padding: 24px; background:var(--bg-main); border-radius:16px; margin-bottom:24px;">
                    <div style="font-size:12px; font-weight:800; margin-bottom:16px; color:var(--brand-primary); text-transform:uppercase; letter-spacing:0.5px;">
                        💡 이 식당에 대한 다른 미식가들의 한줄평
                    </div>
                    <div style="max-height:200px; overflow-y:auto; padding-right:8px;">
                        ${reviewHtml}
                    </div>
                </div>
            `;

            let guestbookHtml = '';
            if (targetData && showGuestbook) {
                guestbookHtml = `
                    <div class="comment-area" style="background:var(--bg-main); border-radius:16px; padding:20px; margin-bottom:30px;">
                        <div style="font-size:12px; font-weight:800; margin-bottom:16px; color:var(--brand-primary); text-transform:uppercase;">
                            💬 ${owner}님의 기록에 방명록 남기기
                        </div>
                        <div id="comment-list-${db_id}" class="comment-list"></div>
                        <div class="comment-input-row" style="display:flex; gap:10px; margin-top:10px;">
                            <input type="text" id="comment-input-${db_id}" class="comment-input input-field" placeholder="방명록을 남겨보세요..." style="flex:1; margin:0;">
                            <button class="comment-btn btn-primary" onclick="submitComment('${db_id}')" style="width:auto; padding:12px 24px;">게시</button>
                        </div>
                    </div>
                `;
            }

            document.getElementById('detail-map-area').insertAdjacentHTML('beforebegin', aggregatedHtml + guestbookHtml);
            
            if (targetData && showGuestbook) {
                renderComments(db_id, targetData.comments || []);
            }
        });
    }
    
    fetch(`${API_URL}/search/kakao?query=${encodeURIComponent(name)}`)
        .then(function(res) { 
            return res.json(); 
        })
        .then(function(d) {
            const place = d.documents.find(function(doc) { 
                return doc.id === kakao_id; 
            }) || d.documents[0];
            
            if (place) {
                if (place.phone) {
                    document.getElementById('detail-phone').innerText = `📞 ${place.phone}`;
                    document.getElementById('detail-phone').style.display = 'inline-block';
                }
                
                document.getElementById('detail-kakao-btn').onclick = function() { 
                    window.open(place.place_url, '_blank'); 
                };
                
                setTimeout(function() {
                    if (typeof kakao !== 'undefined' && kakao.maps) {
                        const mapArea = document.getElementById('detail-map-area');
                        mapArea.innerHTML = ''; 
                        
                        const loc = new kakao.maps.LatLng(Number(place.y), Number(place.x));
                        const map = new kakao.maps.Map(mapArea, { center: loc, level: 3 });
                        const marker = new kakao.maps.Marker({ position: loc, map: map });
                        
                        setTimeout(function() { 
                            map.relayout(); 
                            map.setCenter(loc); 
                        }, 200);
                    }
                }, 300);
            }
        })
        .catch(function(e) {
            console.error("카카오 맵 세팅 중 에러 발생", e);
        });
}

function closeRestDetail() { 
    document.getElementById('restaurant-detail-modal').style.display = 'none'; 
    currentOpenRestId = null; 
}

// =========================================================
// [13] 부가 기능 (AI 사진 교체, 알림, 댓글)
// =========================================================
async function openAIPicker(db_id, name) {
    document.getElementById('ai-image-modal').style.display = 'flex';
    const target = document.getElementById('ai-image-target');
    
    target.innerHTML = `
        <div style="grid-column: span 2; text-align:center; padding: 60px 0; color:var(--brand-primary); font-size:14px; font-weight:800; line-height: 1.6;">
            서버에서 고화질 사진을 추출 중입니다...<br>잠시만 기다려주세요 ⏳
        </div>
    `;
    
    try {
        const res = await fetch(`${API_URL}/restaurants/${db_id}/ai-images?name=${encodeURIComponent(name)}`);
        const data = await res.json();
        
        if (data.images && data.images.length > 0) {
            let html = '';
            data.images.forEach(function(img) {
                html += `
                    <img src="${img}" class="ai-image-item" onclick="selectAIImage('${db_id}', '${img}')" onerror="this.style.display='none'" style="width:100%; height:150px; object-fit:cover; border-radius:12px; cursor:pointer;">
                `;
            });
            target.innerHTML = html;
        } else {
            target.innerHTML = `
                <div style="grid-column: span 2; text-align:center; padding: 40px 0; color:var(--text-sub); font-size:13px; font-weight: 600;">
                    사진을 찾을 수 없습니다.
                </div>
            `;
        }
    } catch(error) {
        console.error("AI 사진 추출 실패", error);
    }
}

async function selectAIImage(db_id, img_url) {
    if (!confirm("이 사진으로 식당의 대표 이미지를 교체하시겠습니까?")) {
        return;
    }
    
    const user = localStorage.getItem('currentUser');
    try {
        const res = await fetch(`${API_URL}/restaurants/${db_id}/image`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'user-id': user },
            body: JSON.stringify({ image_url: img_url })
        });
        
        if (res.ok) {
            alert("대표 사진이 성공적으로 교체되었습니다! ✨");
            document.getElementById('ai-image-modal').style.display = 'none';
            document.getElementById('restaurant-detail-modal').style.display = 'none';
            fetchGuideView(user);
        }
    } catch(e) {
        console.error("사진 교체 실패", e);
    }
}

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

async function executeBookmark(restaurant_id) {
    const user = localStorage.getItem('currentUser');
    try {
        const res = await fetch(`${API_URL}/restaurants/bookmark/${restaurant_id}`, { 
            method: 'POST', 
            headers: { 'user-id': user } 
        });
        const data = await res.json();
        alert(data.message || "위시리스트에 담았습니다!");
    } catch(e) {
        console.error("북마크 실패", e);
    }
}

async function executeLike(restaurant_id) {
    const user = localStorage.getItem('currentUser');
    try {
        const res = await fetch(`${API_URL}/restaurants/${restaurant_id}/like`, { 
            method: 'POST', 
            headers: { 'user-id': user } 
        });
        
        if (res.ok) {
            const data = await res.json();
            
            const countEl = document.getElementById(`like-count-${restaurant_id}`);
            if (countEl) {
                countEl.innerText = data.likes_count;
            }
            
            const btn = document.getElementById(`like-btn-${restaurant_id}`);
            if (btn) {
                const svg = btn.querySelector('svg');
                if (data.liked) {
                    btn.classList.add('liked'); 
                    svg.style.fill = 'var(--brand-fab)';
                    svg.style.stroke = 'var(--brand-fab)';
                } else {
                    btn.classList.remove('liked'); 
                    svg.style.fill = 'none';
                    svg.style.stroke = 'var(--text-sub)';
                }
            }
        }
    } catch(e) {
        console.error("좋아요 처리 실패", e);
    }
}

function recommendAIComment() {
    const name = document.getElementById('h-name').value || "이 곳";
    const cat = document.getElementById('h-cat').value || "";
    
    const comments = {
        "고기": [`입안 가득 퍼지는 육즙이 예술인 ${name}!`, `고기 퀄리티가 남다른 ${name}, 강력 추천합니다.`, `회식이나 모임 장소로 손색없는 ${name}입니다.`],
        "카페": [`분위기 맛집 ${name}, 커피 향이 너무 좋아요.`, `디저트와 커피의 완벽한 조화, ${name}에서 힐링하고 갑니다.`, `인테리어가 예뻐서 사진 찍기 좋은 ${name}!`],
        "일식": [`신선한 재료가 돋보이는 ${name}, 훌륭한 식사였습니다.`, `정갈하고 깔끔한 맛, ${name}에서의 한 끼는 최고네요.`, `입에서 살살 녹는 맛, ${name} 재방문 의사 100%입니다.`],
        "중식": [`불맛이 살아있는 ${name}, 자꾸 생각나는 맛입니다.`, `스트레스 풀리는 매콤함! ${name} 추천해요.`, `기본기가 탄탄한 중식당, ${name}입니다.`],
        "양식": [`고급스러운 분위기와 완벽한 플레이팅, ${name} 최고!`, `데이트 코스로 딱 좋은 ${name}, 와인과 찰떡궁합입니다.`, `파스타 소스가 정말 꾸덕하고 맛있는 ${name}!`],
        "default": [`${name}, 기대 이상으로 너무 훌륭한 미식 경험이었습니다.`, `분위기, 맛, 서비스 모두 만족스러운 ${name}!`, `숨겨진 보석 같은 ${name}, 나만 알고 싶은 맛집이네요.`]
    };

    let selectedCategory = "default";
    if (cat.includes("고기") || cat.includes("돼지") || cat.includes("소") || cat.includes("구이")) {
        selectedCategory = "고기";
    } else if (cat.includes("카페") || cat.includes("커피") || cat.includes("디저트")) {
        selectedCategory = "카페";
    } else if (cat.includes("일식") || cat.includes("초밥") || cat.includes("스시")) {
        selectedCategory = "일식";
    } else if (cat.includes("중식") || cat.includes("마라") || cat.includes("짜장")) {
        selectedCategory = "중식";
    } else if (cat.includes("양식") || cat.includes("파스타") || cat.includes("피자")) {
        selectedCategory = "양식";
    }

    const list = comments[selectedCategory];
    const randomComment = list[Math.floor(Math.random() * list.length)];
    
    document.getElementById('post-comment').value = randomComment;
}

async function submitComment(restaurant_id) {
    const user = localStorage.getItem('currentUser');
    const input = document.getElementById(`comment-input-${restaurant_id}`);
    const text = input.value.trim();
    
    if (!text) {
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/restaurants/${restaurant_id}/comment`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'user-id': user },
            body: JSON.stringify({ text: text })
        });
        
        if (res.ok) {
            const data = await res.json();
            input.value = '';
            renderComments(restaurant_id, data.comments);
        }
    } catch(e) {
        console.error("댓글 전송 실패", e);
    }
}

function renderComments(restaurant_id, comments) {
    const listEl = document.getElementById(`comment-list-${restaurant_id}`);
    if (!listEl) return;
    
    if (!comments || comments.length === 0) {
        listEl.innerHTML = `
            <div style="color:var(--text-sub); font-size:12px; text-align:center; padding: 20px 0; font-weight:500;">
                ${currentLang === 'ko' ? '첫 방명록을 남겨보세요.' : 'Leave the first comment.'}
            </div>
        `;
        return;
    }
    
    let html = '';
    comments.forEach(function(c) {
        html += `
            <div class="comment-item" style="margin-bottom: 12px; font-size: 14px; line-height: 1.5;">
                <b style="color:var(--brand-primary); font-weight:800; margin-right: 6px;">${c.user}</b> 
                <span style="color:var(--text-main); font-weight:500;">${c.text}</span>
            </div>
        `;
    });
    
    listEl.innerHTML = html;
    listEl.scrollTop = listEl.scrollHeight;
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
        localStorage.removeItem('currentUser'); 
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
    }
}

function openEditProfileModal() {
    document.getElementById('edit-nickname-input').value = document.getElementById('display-profile-name').innerText;
    document.getElementById('edit-philosophy-input').value = currentProfilePhilosophy;
    document.getElementById('edit-dna-input').value = currentProfileTags.join(', ');
    document.getElementById('edit-personal-info').value = currentProfilePersonalInfo;
    
    document.getElementById('edit-profile-modal').style.display = 'flex';
}

function closeEditProfileModal() {
    document.getElementById('edit-profile-modal').style.display = 'none';
}

// 🚨 [수정됨] 프로필 수정 에러 방지 (async/await 구조로 통일)
async function submitProfileEdit() {
    const newName = document.getElementById('edit-nickname-input').value.trim();
    
    if (!newName) {
        alert(currentLang === 'ko' ? "변경할 닉네임을 입력해주세요." : "Please enter a name.");
        return;
    }
    
    const rawTags = document.getElementById('edit-dna-input').value.split(',');
    const tagsArray = rawTags.map(function(t) { 
        return t.trim(); 
    }).filter(function(t) { 
        return t !== ""; 
    });
    
    try {
        const res = await fetch(`${API_URL}/user/update-profile`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'user-id': localStorage.getItem('currentUser') 
            },
            body: JSON.stringify({ 
                nickname: newName, 
                personal_info: document.getElementById('edit-personal-info').value,
                philosophy: document.getElementById('edit-philosophy-input').value.trim(),
                taste_tags: tagsArray
            })
        });

        if(res.ok) {
            alert(currentLang === 'ko' ? "프로필 정보가 성공적으로 업데이트되었습니다! ✨" : "Profile successfully updated! ✨");
            closeEditProfileModal();
            fetchGuideView(localStorage.getItem('currentUser')); 
        } else {
            alert("프로필 수정 중 서버 오류가 발생했습니다.");
        }
    } catch(e) {
        console.error("프로필 수정 에러", e);
        alert("네트워크 통신 에러가 발생했습니다.");
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
// 🚀 [신규 추가] 스마트폰 스와이프 (우측으로 밀어 뒤로가기)
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