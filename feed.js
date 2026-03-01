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

        displayEditors = [...new Map(displayEditors.map(item => [item.username, item])).values()];

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
                const finalImg = getSmartRestImage(r.kakao_id, r.category, r.global_top_photo || r.image_url);
                
                let displayName = r.owner;
                const ownerObj = (d.all_editors || []).find(e => e.username === r.owner);
                if (ownerObj && ownerObj.display_name) {
                    displayName = ownerObj.display_name;
                }

                let subInfoHtml = isPopular && r.save_count 
                    ? `🔥 ${r.save_count}명 등록` 
                    : `<div style="display:flex; align-items:center; gap:4px;">✍️ <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80px; display:inline-block;">${displayName}</span></div>`;
    
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
        recommended = [...new Map(recommended.map(item => [item.username, item])).values()];
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
            const finalImg = getSmartRestImage(r.kakao_id, r.category, r.global_top_photo || r.image_url);
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
    const keyword = document.getElementById('search-keyword').value.trim();
    if (!keyword) return;
    
    // 💡 CTO 추가: 카카오 검색 시 메뉴 이름을 치면 카테고리를 살짝 붙여서 정확도 200% 향상!
    let finalKeyword = keyword;
    if (['탕수육', '짜장', '짬뽕', '마라'].some(k => keyword.includes(k))) finalKeyword = keyword + ' 중식';
    if (['스시', '초밥', '사시미', '오마카세'].some(k => keyword.includes(k))) finalKeyword = keyword + ' 일식';
    if (['파스타', '피자', '스테이크'].some(k => keyword.includes(k))) finalKeyword = keyword + ' 양식';
    if (['삼겹살', '갈비', '한우'].some(k => keyword.includes(k))) finalKeyword = keyword + ' 고기';
    
    try {
        // keyword 대신 finalKeyword를 서버로 보냅니다.
        const res = await fetch(`${API_URL}/search/kakao?query=${encodeURIComponent(finalKeyword)}`);
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
    
    // =========================================================
    // 💡 [CTO 패치 1] 구글/카카오 아이디 마스킹 (미식가_XXXX)
    // =========================================================
    let displayOwner = owner;
    if (owner && (owner.startsWith('google_') || owner.startsWith('kakao_'))) {
        displayOwner = '미식가_' + owner.slice(-4); // 맨 뒤 4자리만 가져옵니다.
    }

    const ownerBtn = document.getElementById('detail-owner');
    ownerBtn.innerText = `✍️ ${displayOwner}`; // 보기 흉한 원본 대신 예쁜 닉네임 표시!
    
    ownerBtn.onclick = function() { 
        closeRestDetail(); 
        fetchGuideView(owner, true); // ⚠️ 클릭 시 이동은 반드시 원본 아이디(owner)로 해야 작동합니다.
    };

    // =========================================================
    // 💡 [CTO 패치 2] 시그니처 메뉴 동적 생성 및 표시
    // =========================================================
    // (추후 파라미터로 진짜 시그니처 메뉴 데이터를 받기 전까지 보여줄 텍스트)
    let displayMenu = "시그니처 메뉴 (준비 중)"; 
    
    let sigEl = document.getElementById('detail-signature');
    if (!sigEl) {
        // HTML에 시그니처 칸이 없으면, 자바스크립트가 카테고리 밑에 강제로 만들어줍니다.
        sigEl = document.createElement('div');
        sigEl.id = 'detail-signature';
        sigEl.style.cssText = "font-size: 13px; font-weight: 800; margin-top: 10px; color: var(--brand-fab);";
        
        // 'detail-category' 요소 바로 밑에 삽입
        const catEl = document.getElementById('detail-category');
        if(catEl && catEl.parentNode) {
            catEl.parentNode.insertBefore(sigEl, catEl.nextSibling);
        }
    }
    sigEl.innerHTML = `🍽️ 시그니처 메뉴: <span style="color: #EFE9D9; font-weight: 600;">${displayMenu}</span>`;

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
// [13] 부가 기능 (AI 사진 교체, 좋아요, 북마크, 댓글)
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