// =========================================================
// [2] 공통 유틸리티 (배지, 아바타, 식당 자동 사진 매칭)
// =========================================================
function getBadgeHtml(username) {
    if (nationalTop50 && nationalTop50.includes(username)) {
        return `<div class="s-badge">전국고메</div>`;
    }
    for (let reg in regionalTop10) {
        if (regionalTop10[reg] && regionalTop10[reg].includes(username)) {
            return `<div class="s-badge regional">${reg}고메</div>`;
        }
    }
    return '';
}

// [💡 CTO 긴급 패치] 프로필 사진 주소 누락 버그 완벽 해결
function getAvatar(username) {
    let badge = getBadgeHtml(username);
    let initial = username ? username.charAt(0).toUpperCase() : '?';
    let imgSrc = userProfiles && userProfiles[username] ? userProfiles[username] : '';

    let fallbackHtml = `
        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #EAEAEA; color: var(--brand-primary); font-weight: 900; font-size: 1.5em; text-transform: uppercase;">
            ${initial}
        </div>
    `;

    let imgTag = '';
    if (imgSrc && imgSrc !== "null" && imgSrc !== "undefined") {
        let finalImgSrc = imgSrc;
        if (imgSrc.startsWith('/images')) {
            finalImgSrc = `${API_URL}${imgSrc}`; 
        } else if (imgSrc.includes('127.0.0.1') || imgSrc.includes('localhost')) {
            const fileName = imgSrc.split('/').pop();
            finalImgSrc = `${API_URL}/images/${fileName}`;
        }
        imgTag = `<img src="${finalImgSrc}" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0;" onerror="this.style.display='none';">`;
    }

    return `
        <div style="position:relative; width:100%; height:100%;">
            <div class="avatar-circle" style="width:100%; height:100%; border-radius:50%; overflow:hidden; position:relative; background:#eee;">
                ${fallbackHtml}
                ${imgTag}
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
        if (res.ok) {
            const data = await res.json();
            const timestamp = new Date().getTime(); 
            for (let key in data) {
                if (data[key] && !data[key].includes('?t=')) {
                    data[key] = data[key] + '?t=' + timestamp;
                }
            }
            userProfiles = data;
        }
    } catch (error) {
        console.error("프로필 이미지를 불러오는데 실패했습니다.", error);
    }
}

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
                showPremiumToast("프로필 사진이 업데이트 되었습니다.", "📸");
                await fetchUserProfiles(); 
                fetchGuideView(localStorage.getItem('currentUser')); 
            } else { 
                alert("업로드 실패: 권한이 없거나 이미지 용량이 너무 큽니다."); 
            }
        } catch(error) { 
            alert("서버 통신 오류가 발생했습니다."); 
        } finally {
            input.value = ''; 
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
        else if (t === 'explore') switchExploreTab('ranking'); // 탐색 탭 무조건 랭킹부터 노출
        else if (t === 'profile') fetchGuideView(user);
        else if (t === 'map') setTimeout(() => initGlobalMap(), 200); 
    }
    window.scrollTo(0,0);
}

// =========================================================
// [CTO 추가] 프리미엄 탐색(Explore) 탭 제어 및 핫한 맛집 렌더링
// =========================================================
function switchExploreTab(tab) {
    document.querySelectorAll('.trendy-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'ranking') {
        const btn = document.getElementById('tab-explore-ranking');
        if(btn) btn.classList.add('active');
        
        document.getElementById('explore-ranking-area').style.display = 'block';
        document.getElementById('explore-feed-area').style.display = 'none';
        fetchRankingData(); 
    } else if (tab === 'feed') {
        const btn = document.getElementById('tab-explore-feed');
        if(btn) btn.classList.add('active');
        
        document.getElementById('explore-ranking-area').style.display = 'none';
        document.getElementById('explore-feed-area').style.display = 'block';
        
        if(typeof fetchExploreFeed === 'function') fetchExploreFeed();
    }
}

async function fetchRankingData() {
    const inputEl = document.getElementById('ranking-search-input');
    const keyword = inputEl ? inputEl.value.trim() : '';
    const target = document.getElementById('ranking-list-container');
    
    if (!target) return;
    target.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-sub); font-weight: 800;">데이터를 불러오는 중입니다... ⏳</div>`;
    
    try {
        const res = await fetch(`${API_URL}/ranking?keyword=${encodeURIComponent(keyword)}`);
        const data = await res.json();
        
        if (!data.ranking || data.ranking.length === 0) {
            target.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-sub); font-weight: 600;">아직 등록된 랭킹 데이터가 없습니다.</div>`;
            return;
        }
        
        let html = '';
        data.ranking.forEach((item, index) => {
            const finalImg = typeof getSmartRestImage === 'function' ? getSmartRestImage(item.kakao_id, item.category, item.global_top_photo || item.image_url) : (item.global_top_photo || item.image_url);
            const safeName = (item.name || '').replace(/'/g, "");
            
            html += `
                <div class="trendy-rank-card" onclick="openRestDetail('${safeName}', '${item.category}', '${item.address}', '', '', '${item.kakao_id}', '${finalImg}', '${item.global_top_user}', '${item.id}')">
                    <div class="trendy-rank-num">${index + 1}</div>
                    <div class="trendy-rank-info">
                        <div style="color: #EFE9D9; font-size: 18px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;">${item.name}</div>
                        <div style="color: #A09D96; font-size: 13px; margin-top: 2px;">${item.category.split('>').pop().trim()}</div>
                        <div style="color: var(--brand-fab); font-size: 12px; font-weight: 800; margin-top: 6px;">
                            🔥 ${item.save_count}명이 서열에 등록
                        </div>
                    </div>
                    <img src="${finalImg}" class="trendy-rank-img" onerror="this.style.display='none'">
                </div>
            `;
        });
        target.innerHTML = html;
    } catch (error) {
        console.error("랭킹 데이터 로드 실패:", error);
        target.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--brand-fab); font-weight: 800;">데이터 통신에 실패했습니다.</div>`;
    }
}

// =========================================================
// [6] 핵심: 프로필 (트렌디 인스타 UI) 및 서열표 엔진 
// =========================================================
async function fetchGuideView(u, isForeign = false) {
    if (isForeign) { 
        switchTab('profile', true); 
        const regTrigger = document.getElementById('registration-trigger');
        if(regTrigger) regTrigger.style.display = 'none'; 
    } else { 
        const regTrigger = document.getElementById('registration-trigger');
        if(regTrigger) regTrigger.style.display = 'block'; 
    }
    
    const curUser = localStorage.getItem('currentUser');
    const isMe = (u === curUser);
    const isFollowing = followingList.includes(u);
    
    try {
        const timestamp = new Date().getTime();
        const res = await fetch(`${API_URL}/guide/${u}?t=${timestamp}`);
        if (!res.ok) throw new Error("서버 에러 발생");
        
        const data = await res.json(); 
        
        currentProfileGuideData = data.guide;
        currentProfileOwner = u;
        currentProfileIsMe = isMe;
        
        currentProfilePhilosophy = data.philosophy || '';
        currentProfileTags = data.taste_tags || [];
        currentProfilePersonalInfo = data.personal_info || '';

        if (isMe) {
            const myRes = await fetch(`${API_URL}/restaurants`, { headers: { 'user-id': u } });
            const myData = await myRes.json();
            currentProfileGuideData["평가 대기 중 ⏳"] = myData.data.filter(r => !r.tier);
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

        let totalPosts = 0;
        Object.values(currentProfileGuideData).forEach(arr => {
            if (arr) totalPosts += arr.length;
        });

        const levelHtml = data.level ? data.level : '뉴비 미식가 🌱';

        let actionButtons = '';
        if (isMe) {
            actionButtons = `
                <button class="trendy-profile-btn" onclick="openEditProfileModal()" style="flex: 1; padding: 8px 0; background: #1A1A1C; border: 1px solid #333; border-radius: 8px; color: #EFE9D9;">프로필 편집</button>
                <button class="trendy-profile-btn" onclick="openTierListModal()" style="flex: 1; padding: 8px 0; background: #1A1A1C; border: 1px solid #333; border-radius: 8px; color: #EFE9D9;">🏆 서열표 보기</button>
            `;
        } else {
            actionButtons = `
                <button class="trendy-profile-btn" onclick="executeToggleFollow('${u}', true)" style="flex: 1; padding: 8px 0; background: ${isFollowing ? '#1A1A1C' : 'var(--brand-fab)'}; border: ${isFollowing ? '1px solid #333' : 'none'}; border-radius: 8px; color: #FFF;">${isFollowing ? '팔로잉' : '팔로우'}</button>
                <button class="trendy-profile-btn" onclick="openTierListModal()" style="flex: 1; padding: 8px 0; background: #1A1A1C; border: 1px solid #333; border-radius: 8px; color: #EFE9D9;">🏆 서열표 보기</button>
            `;
        }

        document.getElementById('profile-header-target').innerHTML = `
            <div class="insta-profile-header" style="padding: 24px 24px 10px; color: #EFE9D9; background: var(--bg-main);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                    <div style="width: 86px; height: 86px; border-radius: 50%; border: 2px solid #333; padding: 3px; position: relative;" ${isMe ? `onclick="triggerProfileUpload()"` : ''}>
                        ${getAvatar(u)}
                    </div>
                    <div style="display: flex; gap: 30px; flex: 1; justify-content: center; text-align: center; padding-left: 10px;">
                        <div><div class="trendy-stat-num">${totalPosts}</div><div class="trendy-stat-label">게시물</div></div>
                        <div><div class="trendy-stat-num">${data.followers || 0}</div><div class="trendy-stat-label">팔로워</div></div>
                        <div><div class="trendy-stat-num">${data.following?.length || 0}</div><div class="trendy-stat-label">팔로잉</div></div>
                    </div>
                </div>

                <div class="profile-bio" style="margin-bottom: 20px;">
                    <div style="margin-bottom: 6px; display:flex; align-items:center;">
                        <span class="trendy-profile-name" id="display-profile-name">${data.nickname || u}</span> 
                        <span style="font-size:11px; color:var(--brand-yellow); font-weight:700; margin-left: 6px; background:rgba(255,193,7,0.1); padding:2px 6px; border-radius:4px;">${levelHtml}</span>
                    </div>
                    ${currentProfilePhilosophy ? `<div style="font-size: 14px; line-height: 1.6; color: #DBDBDB; font-weight:500; margin-bottom: 8px;">${currentProfilePhilosophy}</div>` : ''}
                    ${currentProfileTags.length > 0 ? `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top: 8px;">${currentProfileTags.map(t => `<span class="trendy-dna-tag"># ${t}</span>`).join('')}</div>` : ''}
                </div>

                <div style="display: flex; gap: 8px;">
                    ${actionButtons}
                </div>
                
                <div style="display: flex; justify-content: center; margin-top: 24px; border-top: 1px solid #333; padding-top: 12px;">
                    <svg viewBox="0 0 24 24" style="width: 26px; height: 26px; stroke: #FFFFFF; fill: none; stroke-width: 2.5;"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                </div>
            </div>
        `;

    } catch(error) { 
        console.error("프로필 로드 실패", error); 
    }
    
    fetchStats(u);
    const bar = document.getElementById('profile-stats-bar');
    if (bar) bar.style.display = 'none';

    const guideControls = document.getElementById('guide-controls-target');
    if(guideControls) {
        guideControls.style.display = 'block'; 
        document.getElementById('guide-search-input').value = '';
    }
    
    switchGuideTab('national'); 
}

function switchGuideTab(tab) {
    activeGuideTab = tab;
    renderGuideSheet();
}

function renderGuideSheet() {
    let searchQuery = '';
    const searchInput = document.getElementById('guide-search-input');
    if (searchInput) {
        searchQuery = searchInput.value.toLowerCase();
    }
    
    let smartKeywords = [searchQuery];
    if (['탕수육', '짜장', '짬뽕', '마라', '중국집'].some(k => searchQuery.includes(k))) smartKeywords.push('중식');
    if (['스시', '초밥', '사시미', '회', '오마카세'].some(k => searchQuery.includes(k))) smartKeywords.push('일식');
    if (['파스타', '피자', '스테이크'].some(k => searchQuery.includes(k))) smartKeywords.push('양식');
    if (['삼겹살', '갈비', '한우', '소고기', '돼지고기'].some(k => searchQuery.includes(k))) smartKeywords.push('고기');

    let allItems = [];
    
    Object.values(currentProfileGuideData).forEach(arr => {
        if(arr) {
            let filteredArr = arr.filter(function(item) {
                let matchSearch = true;
                if (searchQuery) {
                    const nameStr = (item.name || '').toLowerCase();
                    const catStr = (item.category || '').toLowerCase();
                    const addrStr = (item.address || '').toLowerCase();
                    const commentStr = (item.comment || '').toLowerCase(); 
                    
                    matchSearch = smartKeywords.some(keyword => 
                        nameStr.includes(keyword) || 
                        catStr.includes(keyword) || 
                        addrStr.includes(keyword) || 
                        commentStr.includes(keyword)
                    );
                }
                
                let matchTab = true;
                if (activeGuideTab !== 'national') {
                    matchTab = (item.address || '').startsWith(currentProfileLocalRegion);
                }
                
                return matchSearch && matchTab;
            });
            allItems = allItems.concat(filteredArr);
        }
    });

    allItems.reverse(); 

    const target = document.getElementById('michelin-tables-target');
    
    if (allItems.length === 0) {
        target.innerHTML = `
            <div style="text-align:center; padding:50px 20px; color:var(--text-sub); font-size:13px; font-weight:600;">
                ${currentLang === 'ko' ? '검색 결과 또는 기록된 맛집이 없습니다.' : 'No places recorded yet.'}
            </div>
        `;
        return;
    }

    let html = `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;">`;
    
    allItems.forEach(i => {
        const safeName = (i.name || '').replace(/'/g, "");
        const safeCat = (i.category || '').replace(/'/g, "");
        const safeAddr = (i.address || '').replace(/'/g, "");
        const safeComment = (i.comment || '').replace(/'/g, "");
        const finalImg = getSmartRestImage(i.kakao_id, i.category, i.global_top_photo || i.image_url);
        
        let starBadge = '';
        if(i.tier && i.tier !== '단순 추천' && !i.tier.includes('대기')) {
            starBadge = `<div style="position: absolute; top: 6px; right: 6px; font-size: 10px; background: rgba(0,0,0,0.7); color: var(--brand-yellow); padding: 2px 6px; border-radius: 4px; font-weight: 900; z-index: 5;">${i.tier.split(' ')[0]}</div>`;
        }

        let selectHtml = '';
        let photoBtnHtml = '';
        
        if (currentProfileIsMe) {
            selectHtml = `
                <select onchange="executeChangeTier('${i.id}', this.value)" onclick="event.stopPropagation()" style="position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.8); color:#FFF; border:1px solid rgba(255,255,255,0.3); border-radius:4px; font-size:10px; padding:4px; outline:none; font-weight:600; z-index:10; max-width:70%; text-overflow:ellipsis;">
                    <option value="">등급수정</option>
                    <option value="⭐⭐⭐ (3스타)" ${i.tier === '⭐⭐⭐ (3스타)' ? 'selected' : ''}>3 Stars</option>
                    <option value="⭐⭐ (2스타)" ${i.tier === '⭐⭐ (2스타)' ? 'selected' : ''}>2 Stars</option>
                    <option value="⭐ (1스타)" ${i.tier === '⭐ (1스타)' ? 'selected' : ''}>1 Star</option>
                    <option value="단순 추천" ${i.tier === '단순 추천' ? 'selected' : ''}>단순추천</option>
                    <option value="" ${!i.tier ? 'selected' : ''}>대기중</option>
                </select>
            `;
            
            photoBtnHtml = `
                <div onclick="event.stopPropagation(); triggerRestPhotoUpdate('${i.id}')" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.7); color:#FFF; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; z-index:10; border:1px solid rgba(255,255,255,0.3); box-shadow: 0 2px 8px rgba(0,0,0,0.5);" title="사진 변경">
                    📷
                </div>
            `;
        }

        html += `
            <div onclick="openRestDetail('${safeName}', '${safeCat}', '${safeAddr}', '${safeComment}', '${i.tier||''}', '${i.kakao_id||''}', '${i.image_url||''}', '${currentProfileOwner}', '${i.id||''}', true)" 
                 style="aspect-ratio: 1; cursor: pointer; position: relative; background: #222; overflow: hidden;">
                <img src="${finalImg}" style="width: 100%; height: 100%; object-fit: cover;">
                ${starBadge}
                ${selectHtml}  ${photoBtnHtml} 
            </div>
        `;
    });
    
    html += `</div>`;
    target.innerHTML = html;
}

function openTierListModal() {
    const modal = document.getElementById('tier-list-modal');
    if(!modal) {
        alert("index.html에 서열표 모달창 코드가 아직 추가되지 않았습니다.");
        return;
    }
    
    modal.style.display = 'flex';
    const contentTarget = document.getElementById('tier-list-content');
    
    const tierMeta = { 
        "⭐⭐⭐ (3스타)": { title: "3 STARS", sub: "NO.1 CLASS", color: "var(--brand-yellow)" }, 
        "⭐⭐ (2스타)": { title: "2 STARS", sub: "PREMIUM", color: "#FFFFFF" }, 
        "⭐ (1스타)": { title: "1 STAR", sub: "EXCELLENT", color: "#CCCCCC" }, 
        "단순 추천": { title: "RECOMMENDED", sub: "REC", color: "#A86A51" }, 
        "평가 대기 중 ⏳": { title: "WISHLIST", sub: "WISH", color: "#777777" } 
    };

    let html = '';
    
    for(let key in tierMeta) {
        let items = currentProfileGuideData[key] || [];
        if (items.length > 0) {
            const meta = tierMeta[key];
            
            html += `
                <div style="margin-bottom: 30px;">
                    <div style="font-size: 11px; font-weight: 600; color: #888; margin-bottom: 4px;">*${meta.sub}</div>
                    <div style="font-weight:900; color:#EFE9D9; font-size:18px; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 12px; display:flex; justify-content:space-between;">
                        ${meta.title} <span style="font-size:14px; color:#A09D96;">${items.length}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
            `;
            
            items.forEach(i => {
                const safeName = (i.name || '').replace(/'/g, "");
                const safeCat = (i.category || '').replace(/'/g, "");
                const safeAddr = (i.address || '').replace(/'/g, "");
                const safeComment = (i.comment || '').replace(/'/g, "");
                const finalImg = getSmartRestImage(i.kakao_id, i.category, i.global_top_photo || i.image_url);
                
                html += `
                    <div class="user-result-item" onclick="document.getElementById('tier-list-modal').style.display='none'; openRestDetail('${safeName}', '${safeCat}', '${safeAddr}', '${safeComment}', '${i.tier||''}', '${i.kakao_id||''}', '${i.image_url||''}', '${currentProfileOwner}', '${i.id||''}', true)" 
                         style="display:flex; align-items:center; padding:12px; background:#1A1A1C; border-radius:12px; border: 1px solid #333; cursor:pointer;">
                        <img src="${finalImg}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; margin-right: 12px;">
                        <div style="flex:1;">
                            <div style="font-weight:800; font-size:14px; color:#EFE9D9;">${i.name}</div>
                            <div style="font-size:11px; color:#A09D96;">${i.category.split('>').pop().trim()}</div>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        }
    }
    
    if (html === '') {
        html = `<div style="text-align:center; color:#A09D96; padding:40px;">등록된 서열이 없습니다.</div>`;
    }
    
    contentTarget.innerHTML = html;
}

// =========================================================
// [기타 기능 함수들] (통계, 팔로우, 편집 등)
// =========================================================
async function fetchStats(u) {
    try {
        const res = await fetch(`${API_URL}/profile/stats`, { 
            headers: { 'user-id': u } 
        });
        const d = await res.json();
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
            showPremiumToast(currentLang === 'ko' ? "프로필 정보가 성공적으로 업데이트되었습니다! ✨" : "Profile successfully updated! ✨");
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

function showPremiumToast(msg, icon = '✨') {
    let toast = document.getElementById('premium-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'premium-toast';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span style="font-size:16px;">${icon}</span> <span>${msg}</span>`;
    toast.classList.add('toast-show');
    
    setTimeout(() => {
        toast.classList.remove('toast-show');
    }, 2500);
}

function triggerRestPhotoUpdate(restId) {
    let input = document.getElementById('hidden-rest-photo-upload');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.id = 'hidden-rest-photo-upload';
        input.style.display = 'none';
        document.body.appendChild(input);
    }
    
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const fd = new FormData();
        fd.append('image', file);
        
        if(typeof showPremiumToast === 'function') showPremiumToast("사진을 업로드 중입니다...", "⏳");
        
        try {
            const res = await fetch(`${API_URL}/restaurants/${restId}/photo`, {
                method: 'POST',
                headers: { 'user-id': localStorage.getItem('currentUser') },
                body: fd
            });
            
            if (res.ok) {
                if(typeof showPremiumToast === 'function') showPremiumToast("사진이 업데이트 되었습니다! 📸 (앱을 재시작하면 간판이 바뀝니다)", "✨");
                fetchGuideView(localStorage.getItem('currentUser')); 
            } else {
                alert("사진 업로드에 실패했습니다.");
            }
        } catch(error) {
            alert("서버와 통신할 수 없습니다.");
        } finally {
            input.value = '';
        }
    };
    input.click();
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
// 🚀 스마트폰 스와이프 탭 전환
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

const swipeTabs = ['home', 'map', 'explore', 'profile'];

function handleSwipe() {
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);

    if (diffY > 60) return;

    const openModals = Array.from(document.querySelectorAll('.bottom-modal')).filter(m => window.getComputedStyle(m).display === 'flex' || window.getComputedStyle(m).display === 'block');
    if (openModals.length > 0) {
        if (diffX > 90) { 
            const topModal = openModals[openModals.length - 1];
            topModal.style.display = 'none';
        }
        return; 
    }

    const activeNav = document.querySelector('.nav-item.active');
    if (!activeNav) return;
    const currentTab = activeNav.id.replace('m-', '');
    const currentIndex = swipeTabs.indexOf(currentTab);

    if (currentIndex === -1) return; 

    if (diffX < -90) {
        const nextIndex = (currentIndex + 1) % swipeTabs.length;
        switchTab(swipeTabs[nextIndex]);
    } else if (diffX > 90) {
        const prevIndex = (currentIndex - 1 + swipeTabs.length) % swipeTabs.length;
        switchTab(swipeTabs[prevIndex]);
    }
}

// =========================================================
// [16] 스마트폰 하드웨어 뒤로가기 완벽 제어
// =========================================================
if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.App) {
    Capacitor.Plugins.App.addListener('backButton', function() {
        const openModals = Array.from(document.querySelectorAll('.bottom-modal')).filter(m => window.getComputedStyle(m).display === 'flex' || window.getComputedStyle(m).display === 'block');
        
        if (openModals.length > 0) {
            openModals[openModals.length - 1].style.display = 'none';
            return;
        }

        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav && activeNav.id !== 'm-home') {
            switchTab('home');
            return;
        }

        Capacitor.Plugins.App.exitApp();
    });
} else {
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

// =========================================================
// [CTO 추가] 폰 카메라 촬영 즉시 미리보기
// =========================================================
let capturedImageFile = null; 

function previewCapturedImage(event) {
    const file = event.target.files[0]; 
    
    if (file) {
        capturedImageFile = file; 
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewImg = document.getElementById('image-preview');
            if(previewImg) {
                previewImg.src = e.target.result; 
                previewImg.style.display = 'block'; 
            }
            
            if(typeof showPremiumToast === "function") {
                showPremiumToast("멋진 사진이네요! 대표 사진으로 설정되었습니다.", "📸");
            }
        }
        reader.readAsDataURL(file); 
    }
}

// =========================================================
// [CTO 긴급 패치] 지도 영역 내 스와이프 시 탭 넘어가는 현상 완벽 방어
// =========================================================
setTimeout(() => {
    const mapElement = document.getElementById('global-map'); 
    
    if (mapElement) {
        mapElement.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
        mapElement.addEventListener('touchmove', function(e) { e.stopPropagation(); }, { passive: true });
        mapElement.addEventListener('touchend', function(e) { e.stopPropagation(); }, { passive: true });
        console.log("🛡️ 지도 스와이프 방어막 전개 완료!");
    }
}, 2000);