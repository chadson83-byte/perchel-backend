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

// =========================================================
// [💡 CTO 긴급 패치] 프로필 사진 주소 누락 버그 완벽 해결
// =========================================================
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
        
        // 💡 핵심 수정: 백엔드 서버 주소(API_URL)가 빠져있으면 무조건 붙여주는 로직 추가!
        let finalImgSrc = imgSrc;
        if (imgSrc.startsWith('/images')) {
            finalImgSrc = `${API_URL}${imgSrc}`; // "http://내서버주소/images/사진.jpg" 로 완성!
        } else if (imgSrc.includes('127.0.0.1') || imgSrc.includes('localhost')) {
            const fileName = imgSrc.split('/').pop();
            finalImgSrc = `${API_URL}/images/${fileName}`;
        }
        
        // 올바른 주소(finalImgSrc)를 연결합니다.
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
        const res = await fetch(`${API_URL}/guide/${u}`);
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

        // 복구: 지역 통계 계산 로직 (탭 변경을 위해 필수)
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

        // 복구: 전체 게시물 수 계산
        let totalPosts = 0;
        Object.values(currentProfileGuideData).forEach(arr => {
            if (arr) totalPosts += arr.length;
        });

        const levelHtml = data.level ? data.level : '뉴비 미식가 🌱';

        // 💡 트렌디 버튼 세팅 (스타일 유지)
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

        // 💡 트렌디 프로필 헤더 그리기
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
    
    // 복구: 인스타형에서는 스탯바를 숨깁니다 (통계 유지)
    fetchStats(u);
    const bar = document.getElementById('profile-stats-bar');
    if (bar) bar.style.display = 'none';

    // 복구: 검색바를 다시 살려두고 (필요시 검색), 탭 초기화
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

// 💡 3열 그리드 + 검색 필터가 완벽하게 복구된 렌더링 함수 
function renderGuideSheet() {
    let searchQuery = '';
    const searchInput = document.getElementById('guide-search-input');
    if (searchInput) {
        searchQuery = searchInput.value.toLowerCase();
    }
    
    // 복구: 스마트 키워드 매핑 (탕수육 -> 중식)
    let smartKeywords = [searchQuery];
    if (['탕수육', '짜장', '짬뽕', '마라', '중국집'].some(k => searchQuery.includes(k))) smartKeywords.push('중식');
    if (['스시', '초밥', '사시미', '회', '오마카세'].some(k => searchQuery.includes(k))) smartKeywords.push('일식');
    if (['파스타', '피자', '스테이크'].some(k => searchQuery.includes(k))) smartKeywords.push('양식');
    if (['삼겹살', '갈비', '한우', '소고기', '돼지고기'].some(k => searchQuery.includes(k))) smartKeywords.push('고기');

    let allItems = [];
    
    // 복구: 검색어와 지역 탭에 맞춰 필터링하여 합침
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

    allItems.reverse(); // 최신순 정렬

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

        // 💡 [CTO 추가] 내 프로필일 때만 서열 변경 박스와 사진 추가 버튼을 그려줍니다.
        let selectHtml = '';
        let photoBtnHtml = '';
        
        if (currentProfileIsMe) {
            // 1. 서열 등급 수정 드롭다운
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
            
            // 2. 사진 변경/추가 📷 버튼
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
                ${selectHtml}  ${photoBtnHtml} </div>
        `;
    });
    
    html += `</div>`;
    target.innerHTML = html;
}

// 💡 서열표 목록을 팝업으로 띄워주는 함수 (유지)
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
        // 데이터 패치는 하되, 인스타형 UI에서는 별도 표시 안함 (원래 목적 복구)
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

// 프리미엄 토스트 알림 함수
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
