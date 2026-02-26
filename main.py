from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List
import bcrypt, json, os, uuid, shutil, requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("images", exist_ok=True)
app.mount("/images", StaticFiles(directory="images"), name="images")

KAKAO_REST_API_KEY = "cdf28be42d7f14e86fdbe2901a84398a"
DATA_FILE = "restaurants.json"
USER_FILE = "users.json" 

def load_data(filename, default_val=[]):
    if not os.path.exists(filename): return default_val
    with open(filename, "r", encoding="utf-8") as f: return json.load(f)

def save_data(filename, data):
    with open(filename, "w", encoding="utf-8") as f: json.dump(data, f, ensure_ascii=False, indent=4)

class TierUpdate(BaseModel): tier: str
class UserAuth(BaseModel): username: str; password: str
class CommentInput(BaseModel): text: str
class ImageUpdate(BaseModel): image_url: str

class ProfileUpdate(BaseModel): 
    nickname: str
    personal_info: str = ""
    philosophy: str = ""
    taste_tags: list = []

TIER_LIMITS = {"⭐⭐⭐ (3스타)": 5, "⭐⭐ (2스타)": 10, "⭐ (1스타)": 15, "단순 추천": 20}

# 🌟 NEW: 알림 전송 헬퍼 함수
def send_notification(target_user: str, message: str, type_name: str = "info"):
    users = load_data(USER_FILE)
    for u in users:
        if u["username"] == target_user:
            if "notifications" not in u:
                u["notifications"] = []
            u["notifications"].append({
                "id": str(uuid.uuid4())[:8],
                "message": message,
                "type": type_name,
                "read": False
            })
            break
    save_data(USER_FILE, users)

# ==========================================
# 📊 데이터 로드 및 통계 (S마크 랭킹 엔진)
# ==========================================
@app.get("/main/data")
def get_main_dashboard_data():
    users = load_data(USER_FILE)
    restaurants = load_data(DATA_FILE)
    
    follower_counts = {}
    for u in users:
        for followed_user in u.get("following", []):
            follower_counts[followed_user] = follower_counts.get(followed_user, 0) + 1
    
    all_editors = []
    for u in users:
        uname = u.get("nickname") or u["username"] 
        all_editors.append({
            "username": u["username"],
            "display_name": uname,
            "followers": follower_counts.get(u["username"], 0),
            "following": u.get("following", []),
            "rest_count": sum(1 for r in restaurants if r.get("owner") == u["username"])
        })
    
    all_editors = sorted(all_editors, key=lambda x: x["followers"], reverse=True)
    national_top_50 = [e["username"] for e in all_editors[:50]]
    
    regions = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]
    regional_top_10 = {}
    for reg in regions:
        reg_owners = set(r["owner"] for r in restaurants if r.get("address", "").startswith(reg))
        reg_editors = [e["username"] for e in all_editors if e["username"] in reg_owners]
        regional_top_10[reg] = reg_editors[:10]

    new_restaurants = restaurants[-10:][::-1]

    pop_map = {}
    for r in restaurants:
        key = r.get("kakao_id") or r.get("name")
        if key not in pop_map:
            pop_map[key] = {"id": r["id"], "name": r["name"], "category": r["category"], "image_url": r.get("image_url"), "address": r.get("address"), "owner": r.get("owner"), "save_count": 0}
        pop_map[key]["save_count"] += 1
    
    popular_places = sorted(pop_map.values(), key=lambda x: x["save_count"], reverse=True)[:10]

    return {
        "all_editors": all_editors,
        "national_top_50": national_top_50,
        "regional_top_10": regional_top_10,
        "new_restaurants": new_restaurants,
        "popular_places": popular_places
    }

@app.get("/users/profiles")
def get_user_profiles():
    users = load_data(USER_FILE)
    return {u["username"]: u.get("profile_image") for u in users}

# ==========================================
# 🔐 인증, 프로필, 알림 관리 시스템
# ==========================================
@app.post("/signup")
def signup(user: UserAuth):
    users = load_data(USER_FILE)
    if any(u["username"] == user.username for u in users): raise HTTPException(status_code=400, detail="이미 등록된 아이디입니다.")
    hashed = bcrypt.hashpw(user.password[:72].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    users.append({
        "username": user.username, 
        "password": hashed, 
        "following": [], 
        "notifications": [], # 🌟 알림 배열 초기화
        "profile_image": None,
        "nickname": user.username, 
        "personal_info": "",
        "philosophy": "",
        "taste_tags": []
    })
    save_data(USER_FILE, users)
    return {"message": "주주명부 등재 완료!"}

@app.post("/login")
def login(user: UserAuth):
    users = load_data(USER_FILE)
    for u in users:
        if u["username"] == user.username:
            if bcrypt.checkpw(user.password[:72].encode('utf-8'), u["password"].encode('utf-8')):
                return {"message": "인증 성공", "username": u["username"], "following": u.get("following", [])}
    raise HTTPException(status_code=401, detail="아이디 또는 비밀번호 불일치")

@app.post("/user/profile-image")
def upload_profile_image(request: Request, image: UploadFile=File(...), user_id: str=Header(...)):
    users = load_data(USER_FILE)
    me = next((u for u in users if u["username"] == user_id), None)
    if not me: raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    fname = f"profile_{uuid.uuid4().hex}{os.path.splitext(image.filename)[1]}"
    with open(f"images/{fname}", "wb") as b: shutil.copyfileobj(image.file, b)
    img_url = f"{request.base_url}images/{fname}"
    
    me["profile_image"] = img_url
    save_data(USER_FILE, users)
    return {"profile_image": img_url}

@app.put("/user/update-profile")
def update_user_profile(payload: ProfileUpdate, user_id: str = Header(...)):
    users = load_data(USER_FILE)
    me = next((u for u in users if u["username"] == user_id), None)
    if not me: 
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    
    me["nickname"] = payload.nickname
    me["personal_info"] = payload.personal_info
    me["philosophy"] = payload.philosophy
    me["taste_tags"] = payload.taste_tags
    
    save_data(USER_FILE, users)
    return {"message": "프로필 업데이트 완료"}

# 🌟 NEW: 알림 가져오기 및 읽음 처리
@app.get("/notifications")
def get_notifications(user_id: str = Header(...)):
    users = load_data(USER_FILE)
    me = next((u for u in users if u["username"] == user_id), None)
    if not me: raise HTTPException(status_code=404)
    notis = me.get("notifications", [])
    unread_count = sum(1 for n in notis if not n["read"])
    # 최신 알림이 위로 오게 뒤집어서 리턴
    return {"notifications": notis[::-1], "unread_count": unread_count}

@app.put("/notifications/read")
def mark_notifications_read(user_id: str = Header(...)):
    users = load_data(USER_FILE)
    me = next((u for u in users if u["username"] == user_id), None)
    if not me: raise HTTPException(status_code=404)
    for n in me.get("notifications", []):
        n["read"] = True
    save_data(USER_FILE, users)
    return {"message": "All read"}

@app.post("/follow/{target_user}")
def toggle_follow(target_user: str, user_id: str = Header(...)):
    users = load_data(USER_FILE)
    me = next((u for u in users if u["username"] == user_id), None)
    if not me: raise HTTPException(status_code=404)
    if "following" not in me: me["following"] = []
    
    if target_user in me["following"]: 
        me["following"].remove(target_user)
    else: 
        me["following"].append(target_user)
        # 🌟 알림 트리거: 팔로우 시 알림 발송
        send_notification(target_user, f"👤 {user_id}님이 회원님을 팔로우하기 시작했습니다.", "follow")
        
    save_data(USER_FILE, users)
    return {"following": me["following"]}

# ==========================================
# 🍽️ 레스토랑 CRUD 및 다중 사진 업로드
# ==========================================
@app.get("/search/kakao")
def search_kakao(query: str):
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    res = requests.get(url, headers={"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}, params={"query": query})
    return res.json()

@app.get("/feed")
def get_global_feed(): 
    return {"status": 200, "data": load_data(DATA_FILE)}

@app.get("/restaurants")
def get_my_restaurants(user_id: str = Header(None)):
    data = load_data(DATA_FILE)
    return {"status": 200, "data": [r for r in data if r.get("owner") == user_id]}

@app.get("/profile/stats")
def get_profile_stats(user_id: str = Header(...)):
    data = load_data(DATA_FILE)
    my = [r for r in data if r.get("owner") == user_id]
    stats = {key: {"count": 0, "limit": val} for key, val in TIER_LIMITS.items()}
    for r in my:
        t = r.get("tier")
        if t in stats: stats[t]["count"] += 1
    return {"status": 200, "stats": stats}

@app.get("/guide/{target_user}")
def get_user_guide(target_user: str):
    data = load_data(DATA_FILE)
    users = load_data(USER_FILE)
    
    user_info = next((u for u in users if u["username"] == target_user), {})
    nickname = user_info.get("nickname") or target_user
    personal_info = user_info.get("personal_info") or ""
    philosophy = user_info.get("philosophy") or ""
    taste_tags = user_info.get("taste_tags") or []

    guide = {key: [] for key in TIER_LIMITS.keys()}
    user_rests = []
    
    for r in data:
        if r.get("owner") == target_user:
            user_rests.append(r)
            if r.get("tier") in guide: 
                guide[r["tier"]].append(r)
                
    badges = []
    if len(user_rests) >= 1: badges.append("🐣 퍼슐 비기너")
    if len(user_rests) >= 5: badges.append("🔥 열혈 탐험가")
    if any(r.get("tier") == "⭐⭐⭐ (3스타)" for r in user_rests): badges.append("👑 3스타 발굴자")
        
    categories = [r.get("category", "") for r in user_rests]
    if sum(1 for c in categories if "고기" in c or "구이" in c or "돼지" in c or "소" in c) >= 3: badges.append("🥩 육식주의자")
    if sum(1 for c in categories if "카페" in c or "디저트" in c) >= 3: badges.append("🍰 디저트 러버")
    if sum(1 for c in categories if "일식" in c or "스시" in c) >= 3: badges.append("🍣 일식 마스터")

    if not badges: badges.append("🍽️ 미식 탐험가")
    badges = list(set(badges))[:3]
        
    return {
        "status": 200, 
        "guide": guide, 
        "nickname": nickname, 
        "personal_info": personal_info,
        "philosophy": philosophy,
        "taste_tags": taste_tags,
        "badges": badges
    }

@app.put("/restaurants/{restaurant_id}")
def update_tier(restaurant_id: str, payload: TierUpdate, user_id: str = Header(...)):
    data = load_data(DATA_FILE)
    target = next((r for r in data if r.get("id") == restaurant_id and r.get("owner") == user_id), None)
    if not target: raise HTTPException(status_code=403)
    if payload.tier in TIER_LIMITS:
        cnt = sum(1 for r in data if r.get("owner") == user_id and r.get("tier") == payload.tier and r.get("id") != restaurant_id)
        if cnt >= TIER_LIMITS[payload.tier]: raise HTTPException(status_code=400, detail=f"한도 초과")
    target["tier"] = payload.tier
    save_data(DATA_FILE, data)
    return {"message": "평가 완료!"}

@app.delete("/restaurants/{restaurant_id}")
def delete_restaurant(restaurant_id: str, user_id: str = Header(...)):
    data = load_data(DATA_FILE)
    target_idx = next((i for i, r in enumerate(data) if r.get("id") == restaurant_id and r.get("owner") == user_id), None)
    if target_idx is None: raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
    del data[target_idx]
    save_data(DATA_FILE, data)
    return {"message": "기록이 정상적으로 삭제되었습니다."}

# 🌟 NEW: 다중 사진 업로드 지원 (List[UploadFile])
@app.post("/restaurants")
def add_restaurant(
    request: Request, 
    name: str=Form(...), category: str=Form(...), comment: str=Form(""), 
    address: str=Form(""), kakao_id: str=Form(""), x: str=Form(""), y: str=Form(""), 
    images: List[UploadFile]=File(None), # 다중 리스트로 변경
    user_id: str=Header(...)
):
    data = load_data(DATA_FILE)
    img_urls = []
    
    # 전달받은 이미지가 있으면 모두 저장
    if images and images[0].filename:
        for img in images:
            fname = f"{uuid.uuid4().hex}{os.path.splitext(img.filename)[1]}"
            with open(f"images/{fname}", "wb") as b: shutil.copyfileobj(img.file, b)
            img_urls.append(f"{request.base_url}images/{fname}")
            
    # 첫 번째 이미지를 대표(image_url)로, 전체를 배열(image_urls)로 저장
    main_img = img_urls[0] if img_urls else None

    data.append({
        "id": str(uuid.uuid4())[:8], "name": name, "category": category, "comment": comment, 
        "address": address, "kakao_id": kakao_id, "x": x, "y": y, "tier": None, 
        "image_url": main_img, "image_urls": img_urls, # 🌟 다중 URL 배열 추가
        "owner": user_id, "likes": [], "comments": []
    })
    save_data(DATA_FILE, data)
    return {"status": 201}

# ==========================================
# 🌟 소셜 기능 API (알림 트리거 추가)
# ==========================================
@app.post("/restaurants/bookmark/{restaurant_id}")
def bookmark_restaurant(restaurant_id: str, user_id: str = Header(...)):
    data = load_data(DATA_FILE)
    original = next((r for r in data if r.get("id") == restaurant_id), None)
    if not original: raise HTTPException(status_code=404)
    if any(r.get("owner") == user_id and r.get("kakao_id") == original.get("kakao_id") for r in data):
        raise HTTPException(status_code=400, detail="이미 내 가이드에 존재하는 식당입니다.")
    
    new_entry = original.copy()
    new_entry["id"] = str(uuid.uuid4())[:8]; new_entry["owner"] = user_id; new_entry["tier"] = None; new_entry["likes"] = []; new_entry["comments"] = []
    data.append(new_entry)
    save_data(DATA_FILE, data)
    
    # 🌟 알림: 내 식당을 누군가 북마크했을 때
    if original["owner"] != user_id:
        send_notification(original["owner"], f"🔖 {user_id}님이 회원님의 '{original['name']}'을(를) 위시리스트에 담았습니다.", "bookmark")

    return {"message": "위시리스트에 담았습니다!"}

@app.post("/restaurants/{restaurant_id}/like")
def toggle_like(restaurant_id: str, user_id: str = Header(...)):
    data = load_data(DATA_FILE)
    target = next((r for r in data if r.get("id") == restaurant_id), None)
    if not target: raise HTTPException(status_code=404)
    if "likes" not in target: target["likes"] = []
    
    if user_id in target["likes"]: 
        target["likes"].remove(user_id); liked = False
    else: 
        target["likes"].append(user_id); liked = True
        # 🌟 알림: 내 식당에 좋아요를 눌렀을 때
        if target["owner"] != user_id:
            send_notification(target["owner"], f"❤️ {user_id}님이 회원님의 '{target['name']}' 기록을 좋아합니다.", "like")
            
    save_data(DATA_FILE, data)
    return {"liked": liked, "likes_count": len(target["likes"])}

@app.post("/restaurants/{restaurant_id}/comment")
def add_comment(restaurant_id: str, payload: CommentInput, user_id: str = Header(...)):
    data = load_data(DATA_FILE)
    target = next((r for r in data if r.get("id") == restaurant_id), None)
    if not target: raise HTTPException(status_code=404)
    if "comments" not in target: target["comments"] = []
    target["comments"].append({"user": user_id, "text": payload.text})
    save_data(DATA_FILE, data)
    
    # 🌟 알림: 내 식당에 방명록을 남겼을 때
    if target["owner"] != user_id:
        send_notification(target["owner"], f"💬 {user_id}님이 '{target['name']}'에 방명록을 남겼습니다: {payload.text[:10]}...", "comment")
        
    return {"comments": target["comments"]}

@app.get("/restaurants/{restaurant_id}/ai-images")
def get_ai_images(restaurant_id: str, name: str):
    url = "https://dapi.kakao.com/v2/search/image"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {"query": f"{name} 다이닝", "size": 4} 
    try:
        res = requests.get(url, headers=headers, params=params)
        images = [doc["image_url"] for doc in res.json().get("documents", [])]
    except Exception as e: images = []
    if not images:
        images = ["https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80", "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80"]
    return {"images": images}

@app.put("/restaurants/{restaurant_id}/image")
def update_restaurant_image(restaurant_id: str, payload: ImageUpdate, user_id: str = Header(...)):
    data = load_data(DATA_FILE)
    target = next((r for r in data if r.get("id") == restaurant_id and r.get("owner") == user_id), None)
    if not target: raise HTTPException(status_code=403, detail="권한이 없습니다.")
    target["image_url"] = payload.image_url
    save_data(DATA_FILE, data)
    return {"message": "Success"}

@app.get("/ranking")
def get_restaurant_ranking(keyword: str = ""):
    data = load_data(DATA_FILE)
    filtered_data = data
    if keyword:
        kw = keyword.lower()
        filtered_data = [
            r for r in data 
            if kw in r.get("name", "").lower() 
            or kw in r.get("category", "").lower() 
            or kw in r.get("comment", "").lower()
        ]
    ranking_map = {}
    for r in filtered_data:
        key = r.get("kakao_id") or r.get("name")
        if key not in ranking_map:
            ranking_map[key] = {
                "id": r.get("id"), "kakao_id": r.get("kakao_id"), "name": r.get("name"),
                "category": r.get("category"), "address": r.get("address"), "image_url": r.get("image_url"), "save_count": 0
            }
        ranking_map[key]["save_count"] += 1
    ranked_list = sorted(ranking_map.values(), key=lambda x: x["save_count"], reverse=True)
    return {"status": 200, "ranking": ranked_list[:50]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)