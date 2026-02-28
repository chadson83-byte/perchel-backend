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
    let initial = username ? username.charAt(0).toUpperCase() : '?';
    let imgSrc = userProfiles[username] ? userProfiles[username] : '';

    // [수정됨] 1. 사진이 없을 때 보여줄 기본 이니셜 화면 (코드 깨짐 방지)
    let fallbackHtml = `
        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #EAEAEA; color: var(--brand-primary); font-weight: 900; font-size: 1.5em; text-transform: uppercase;">
            ${initial}
        </div>
    `;

    let imgTag = '';
    if (imgSrc && imgSrc !== "null" && imgSrc !== "undefined") {
        // 이미지가 깨지면 투명하게 숨겨서 밑에 깔린 글자(fallback)가 보이게 처리
        imgTag = `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0;" onerror="this.style.display='none';">`;
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
// [6] 핵심: 프로필 (다크 카드) 및 서열표 엔진 
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
        }

        let editFloatingBtn = '';
        if (isMe) {
            editFloatingBtn = `
                <div onclick="event.stopPropagation(); openEditProfileModal();" style="position:absolute; top:-5px; right:-10px; background:#333; color:white; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.2); font-size:14px; z-index:10; cursor:pointer;">
                    ✏️
                </div>
            `;
        }

        // CTO 수정: 뉴비 미식가 중복 노출을 막기 위해 levelHtml 출력부를 하나로 통합했습니다.
        document.getElementById('profile-header-target').innerHTML = `
            <div class="profile-dash">
                <div class="dash-header">
                    <div class="dash-pic-container" style="position:relative; display:inline-block;" ${isMe ? `onclick="triggerProfileUpload()"` : ''}>
                        ${getAvatar(u)}
                        ${editFloatingBtn}
                    </div>
                    
                    <div style="font-size:24px; font-weight:900; margin-bottom:4px; display:flex; justify-content:center; align-items:center; gap:8px; letter-spacing:-0.5px;">
                        <span id="display-profile-name">${data.nickname || u}</span>
                    </div>
                    
                    <div style="font-size:13px; font-weight:600; color:var(--brand-yellow); margin-bottom: 12px;">
                        ${levelHtml}
                    </div>
                    
                    ${philosophyHtml}
                    ${tagsHtml}
                    
                    ${profileActionBtn}
                </div>
                
                <div class="dash-stats" id="profile-stats-bar" style="display:flex; justify-content:space-around; background:rgba(255,255,255,0.05); padding:16px; border-radius:16px; margin-top:15px;"></div>
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
    
    // 💡 CTO 추가: 스마트 키워드 매핑 (메뉴를 치면 카테고리까지 같이 검색)
    let smartKeywords = [searchQuery];
    if (['탕수육', '짜장', '짬뽕', '마라', '중국집'].some(k => searchQuery.includes(k))) smartKeywords.push('중식');
    if (['스시', '초밥', '사시미', '회', '오마카세'].some(k => searchQuery.includes(k))) smartKeywords.push('일식');
    if (['파스타', '피자', '스테이크'].some(k => searchQuery.includes(k))) smartKeywords.push('양식');
    if (['삼겹살', '갈비', '한우', '소고기', '돼지고기'].some(k => searchQuery.includes(k))) smartKeywords.push('고기');
    
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
                const commentStr = (item.comment || '').toLowerCase(); 
                
                // 💡 CTO 수정: 확장된 smartKeywords 중 하나라도 포함되어 있으면 검색 결과에 노출
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

        if (items.length > 0) {
            hasAnyItem = true;
            const meta = tierMeta[key];
            
            html += `
                <div class="tier-section" style="margin-bottom: 40px;">
                    <div style="font-size: 11px; font-weight: 600; color: #888888; letter-spacing: 1px; margin-bottom: 4px;">*${meta.sub} CLASS</div>
                    <div class="tier-header-title" style="margin-bottom:16px; font-weight:900; color:#EFE9D9; font-size:20px; border-bottom: 1px solid #333; padding-bottom: 8px;">
                        ${meta.title} 
                        <span style="font-size:14px; color:#A09D96; margin-left:6px;">${items.length}</span>
                    </div>
                    <div class="guide-grid" style="display:grid; grid-template-columns:1fr; gap:12px;">
            `;

            items.forEach(function(i) {
                const safeName = (i.name || '').replace(/'/g, "");
                const safeCat = (i.category || '').replace(/'/g, "");
                const safeAddr = (i.address || '').replace(/'/g, "");
                const safeComment = (i.comment || '').replace(/'/g, "");
                const finalImg = getSmartRestImage(i.kakao_id, i.category, i.global_top_photo || i.image_url);
                
                let selectHtml = '';
                if (currentProfileIsMe) {
                    selectHtml = `
                        <select onchange="executeChangeTier('${i.id}', this.value)" onclick="event.stopPropagation()" style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.8); color:#FFF; border:1px solid rgba(255,255,255,0.3); border-radius:8px; font-size:11px; padding:6px; outline:none; font-weight:600; z-index:2;">
                            <option value="">등급수정</option>
                            <option value="⭐⭐⭐ (3스타)" ${i.tier === '⭐⭐⭐ (3스타)' ? 'selected' : ''}>3 Stars</option>
                            <option value="⭐⭐ (2스타)" ${i.tier === '⭐⭐ (2스타)' ? 'selected' : ''}>2 Stars</option>
                            <option value="⭐ (1스타)" ${i.tier === '⭐ (1스타)' ? 'selected' : ''}>1 Star</option>
                            <option value="단순 추천" ${i.tier === '단순 추천' ? 'selected' : ''}>단순추천</option>
                            <option value="" ${!i.tier ? 'selected' : ''}>Wishlist</option>
                        </select>
                    `;
                }

                // 💡 CTO 핵심 수정: openRestDetail 파라미터 맨 끝에 `true` 추가! (방명록 켜기)
                html += `
                    <div class="guide-card" onclick="openRestDetail('${safeName}', '${safeCat}', '${safeAddr}', '${safeComment}', '${i.tier||''}', '${i.kakao_id||''}', '${i.image_url||''}', '${currentProfileOwner}', '${i.id||''}', true)" style="position:relative; height:140px; border-radius:16px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.3);">
                        <img class="guide-card-bg" src="${finalImg}" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; filter:brightness(0.6);">
                        <div class="guide-card-overlay" style="position:absolute; bottom:0; left:0; right:0; padding:16px; background:linear-gradient(transparent, rgba(0,0,0,0.8));">
                            <div class="guide-tier-text" style="color:${meta.color}; font-weight:800; font-size:12px; margin-bottom:4px;">${meta.sub}</div>
                            <div class="guide-name-text" style="color:#fff; font-weight:bold; font-size:18px;">${i.name}</div>
                            <div style="font-size:11px; color:#ddd; margin-top:2px; font-weight:500;">
                                ${i.address ? i.address.split(' ')[0] : ''} · ${i.category ? i.category.split('>').pop().trim() : ''}
                            </div>
                            ${safeComment ? `<div style="margin-top:8px; font-size:12px; color:#fff; font-style:italic; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">💬 "${safeComment}"</div>` : ''}
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
                // CTO 수정: API 응답 텍스트를 무조건 예쁜 주황색 별 아이콘으로 매핑하도록 조건을 강화했습니다.
                let label = k;
                if (k.includes('3') || k.includes('3스타')) label = '⭐⭐⭐';
                else if (k.includes('2') || k.includes('2스타')) label = '⭐⭐';
                else if (k.includes('1') || k.includes('1스타')) label = '⭐';
                else if (k.includes('추천') || k.toLowerCase().includes('rec')) label = '단순추천';
                else if (k.includes('대기') || k.toLowerCase().includes('wish')) label = '대기중';

                statsHtml += `
                    <div style="text-align:center;">
                        <div style="font-weight:900; font-size:24px; line-height:1; color:var(--brand-fab);">
                            ${d.stats[k].count}
                        </div>
                        <div style="font-size:11px; font-weight:600; color:rgba(255,255,255,0.9); margin-top:6px; letter-spacing:0.5px;">
                            ${label}
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
    
    // 2.5초 뒤에 스르륵 사라짐
    setTimeout(() => {
        toast.classList.remove('toast-show');
    }, 2500);
}