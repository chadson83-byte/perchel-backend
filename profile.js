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

    // 사진이 없을 때 보여줄 기본 G/이니셜 화면
    let fallbackHtml = `
        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--border-color); color: var(--brand-primary); font-weight: 900; font-size: 1.5em; text-transform: uppercase;">
            ${initial}
        </div>
    `;

    let imgTag = '';
    if (imgSrc) {
        // 사진이 있으면 출력하고, 서버에러로 깨지면 즉시 fallback 표시
        imgTag = `
            <img src="${imgSrc}" style="width:100%; height:100%; object-fit:cover;" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div style="display:none; width:100%; height:100%;">${fallbackHtml}</div>
        `;
    } else {
        imgTag = fallbackHtml;
    }

    return `
        <div style="position:relative; width:100%; height:100%;">
            <div class="avatar-circle" style="width:100%; height:100%; border-radius:50%; overflow:hidden;">
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

// 수정됨: 사진이 바로 바뀌지 않는 현상(캐시) 방지 코드 추가
async function fetchUserProfiles() {
    try {
        const res = await fetch(`${API_URL}/users/profiles`);
        if (res.ok) {
            const data = await res.json();
            const timestamp = new Date().getTime(); // 현재 시간을 구함
            
            // 모든 프로필 이미지 URL 뒤에 시간을 붙여서 브라우저가 매번 새 사진으로 인식하게 만듦
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
                alert("프로필 사진이 성공적으로 변경되었습니다! 📸");
                await fetchUserProfiles(); // 수정됨: 사진 업로드 후 강제 갱신 트리거 작동
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