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
        // 웹뷰 환경을 고려한 고정밀도 옵션 추가
        const options = {
            enableHighAccuracy: true, // GPS를 적극적으로 사용
            timeout: 10000,           // 10초까지 기다림 (앱 환경은 웹보다 느릴 수 있음)
            maximumAge: 0             // 이전 위치 캐시 무시
        };

        navigator.geolocation.getCurrentPosition(
            function(position) {
                // 성공 시
                const loc = new kakao.maps.LatLng(position.coords.latitude, position.coords.longitude);
                globalMap.setCenter(loc);
                globalMap.setLevel(4);
            },
            function(error) {
                // 에러 처리 (웹뷰에서 막히면 여기서 콘솔에 이유를 뱉습니다)
                console.error("위치 획득 실패 (코드 " + error.code + "): " + error.message);
                
                if (error.code === 1) {
                    alert("앱의 위치 권한이 거부되었습니다. 스마트폰 설정에서 권한을 허용해주세요.");
                } else {
                    alert("현재 위치를 찾을 수 없습니다. (GPS 신호 약함)");
                }
            },
            options
        );
    } else {
        alert("이 기기에서는 위치 기능을 지원하지 않습니다.");
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