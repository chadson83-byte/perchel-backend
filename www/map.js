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