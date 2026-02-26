from fastapi import FastAPI, HTTPException, Request, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import json
import os
import uuid
import shutil
import requests
from datetime import datetime

# =========================================================
# [1] 앱 초기화 및 환경 설정
# =========================================================
app = FastAPI(title="Perchel Backend API", version="2.0")

# 🚨 가장 강력한 CORS 설정 (ERR_FAILED 완벽 차단)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 이미지 폴더 마운트 (PWA 로고 및 유저 업로드 이미지용)
os.makedirs("images", exist_ok=True)
app.mount("/images", StaticFiles(directory="images"), name="images")

# DB 파일 경로
USERS_DB = "users.json"
REST_DB = "restaurants.json"
NOTI_DB = "notifications.json"

# 외부 API 키 (대표님 발급 키)
KAKAO_REST_API_KEY = "cdf28be42d7f14e86fdbe2901a84398a"
GOOGLE_CLIENT_ID = "725138598590-gjhd8dduh3ag3922il5pcrf15q1rjvvn.apps.googleusercontent.com"

# =========================================================
# [2] JSON 데이터베이스 헬퍼 함수 (🚨 방어 로직 추가됨)
# =========================================================
def load_db(file_path, default_value):
    if not os.path.exists(file_path):
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(default_value, f, ensure_ascii=False, indent=4)
        return default_value
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # 🚨 핵심 방어 코드: 기존 파일이 리스트([])로 잘못 저장되어 있으면, 
            # 우리가 원하는 형태(디폴트값)로 덮어씌워서 에러를 원천 차단합니다.
            if type(data) != type(default_value):
                print(f"🚨 [경고] {file_path} 파일 형태 오류. 초기화합니다.")
                return default_value
            return data
    except:
        return default_value

def save_db(file_path, data):
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        
# =========================================================
# [3] 데이터 모델 (Pydantic)
# =========================================================
class SocialLoginRequest(BaseModel):
    provider: str
    token: str

class ProfileUpdateRequest(BaseModel):
    nickname: str
    personal_info: str
    philosophy: str
    taste_tags: List[str]

class TierUpdateRequest(BaseModel):
    tier: str

class CommentRequest(BaseModel):
    text: str

class ImageUpdateRequest(BaseModel):
    image_url: str

# =========================================================
# [4] 소셜 로그인 전용 통신 로직
# =========================================================
@app.post("/login/social")
async def social_login(req: SocialLoginRequest):
    users = load_db(USERS_DB, {})
    
    user_id = None
    email = None
    display_name = None
    profile_image = None
    
    # [A] 카카오 토큰 검증
    if req.provider == "kakao":
        headers = {"Authorization": f"Bearer {req.token}"}
        resp = requests.get("https://kapi.kakao.com/v2/user/me", headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="유효하지 않은 카카오 토큰입니다.")
        kakao_data = resp.json()
        user_id = f"kakao_{kakao_data.get('id')}"
        
        kakao_account = kakao_data.get("kakao_account", {})
        profile = kakao_account.get("profile", {})
        display_name = profile.get("nickname", "카카오유저")
        profile_image = profile.get("profile_image_url", "")
        
    # [B] 구글 토큰 검증
    elif req.provider == "google":
        resp = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={req.token}")
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="유효하지 않은 구글 토큰입니다.")
        google_data = resp.json()
        
        if google_data.get("aud") != GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=401, detail="구글 Client ID가 일치하지 않습니다.")
            
        user_id = f"google_{google_data.get('sub')}"
        display_name = google_data.get("name", "구글유저")
        profile_image = google_data.get("picture", "")
    
    else:
        raise HTTPException(status_code=400, detail="지원하지 않는 소셜 로그인입니다.")

    # [C] 신규 유저일 경우 DB에 자동 등록 (회원가입 과정 생략)
    if user_id not in users:
        users[user_id] = {
            "password": "social_login_user", # 소셜 유저는 비밀번호 불필요
            "following": [],
            "followers": 0,
            "display_name": display_name,
            "profile_image": profile_image,
            "philosophy": "",
            "taste_tags": [],
            "personal_info": "",
            "badges": ["뉴비 미식가 🌱"]
        }
        save_db(USERS_DB, users)
        print(f"[소셜가입 완료] 새로운 유저 등록: {user_id}")

    return {
        "message": "로그인 성공", 
        "username": user_id, 
        "display_name": users[user_id].get("display_name"),
        "following": users[user_id].get("following", [])
    }

# =========================================================
# [5] 프로필 및 유저 데이터 조회 로직
# =========================================================
@app.get("/users/profiles")
async def get_all_profiles():
    users = load_db(USERS_DB, {})
    profiles = {}
    for uid, udata in users.items():
        if udata.get("profile_image"):
            profiles[uid] = udata["profile_image"]
    return profiles

@app.post("/user/profile-image")
async def upload_profile_image(request: Request, image: UploadFile = File(...)):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
        
    users = load_db(USERS_DB, {})
    if user_id not in users:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    file_extension = image.filename.split(".")[-1]
    file_name = f"profile_{user_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = os.path.join("images", file_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    image_url = f"/images/{file_name}"
    users[user_id]["profile_image"] = image_url
    save_db(USERS_DB, users)

    return {"message": "프로필 이미지 업데이트 성공", "image_url": image_url}

@app.put("/user/update-profile")
async def update_profile(req: ProfileUpdateRequest, request: Request):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
        
    users = load_db(USERS_DB, {})
    if user_id not in users:
        raise HTTPException(status_code=404, detail="유저 없음")

    users[user_id]["display_name"] = req.nickname
    users[user_id]["personal_info"] = req.personal_info
    users[user_id]["philosophy"] = req.philosophy
    users[user_id]["taste_tags"] = req.taste_tags
    
    save_db(USERS_DB, users)
    return {"message": "프로필이 성공적으로 업데이트되었습니다."}

# =========================================================
# [6] 메인 화면 데이터 (홈, 네트워크)
# =========================================================
@app.get("/main/data")
async def get_main_data():
    users = load_db(USERS_DB, {})
    rests = load_db(REST_DB, [])
    
    # 1. 에디터 목록 (게시물 수, 팔로워 수 등 계산)
    editors = []
    for uid, udata in users.items():
        user_rests = [r for r in rests if r.get("owner") == uid]
        editors.append({
            "username": uid,
            "display_name": udata.get("display_name", uid),
            "followers": udata.get("followers", 0),
            "following": udata.get("following", []),
            "rest_count": len(user_rests)
        })
    
    # 팔로워 순으로 정렬하여 전국 탑 50 추출
    editors_sorted = sorted(editors, key=lambda x: x["followers"], reverse=True)
    national_top_50 = [e["username"] for e in editors_sorted[:50]]
    
    # 2. 인기 맛집 포트폴리오 (가장 많이 저장된 곳 기준)
    place_counts = {}
    for r in rests:
        kid = r.get("kakao_id")
        if kid:
            if kid not in place_counts:
                place_counts[kid] = r.copy()
                place_counts[kid]["save_count"] = 1
            else:
                place_counts[kid]["save_count"] += 1
                
    popular_places = sorted(place_counts.values(), key=lambda x: x.get("save_count", 0), reverse=True)[:10]
    
    # 3. 최근 등록된 식당 (최신순 10개)
    new_restaurants = list(reversed(rests))[:10]

    return {
        "all_editors": editors_sorted,
        "national_top_50": national_top_50,
        "regional_top_10": {}, # 고도화 시 지역별 분류 데이터 삽입 지점
        "popular_places": popular_places,
        "new_restaurants": new_restaurants
    }

# =========================================================
# [7] 랭킹 시스템 (메뉴 및 장소 검색)
# =========================================================
@app.get("/ranking")
async def get_ranking(keyword: str = ""):
    rests = load_db(REST_DB, [])
    
    place_counts = {}
    for r in rests:
        kid = r.get("kakao_id")
        if not kid:
            continue
            
        # 키워드 검색 필터링 (식당 이름, 카테고리, 주소 대상)
        match = False
        if keyword.lower() in r.get("name", "").lower() or \
           keyword.lower() in r.get("category", "").lower() or \
           keyword.lower() in r.get("address", "").lower():
            match = True
            
        if keyword == "" or match:
            if kid not in place_counts:
                place_counts[kid] = r.copy()
                place_counts[kid]["save_count"] = 1
            else:
                place_counts[kid]["save_count"] += 1
                
    ranking = sorted(place_counts.values(), key=lambda x: x["save_count"], reverse=True)
    return {"ranking": ranking}

# =========================================================
# [8] 피드 (실시간 리뷰)
# =========================================================
@app.get("/feed")
async def get_feed():
    rests = load_db(REST_DB, [])
    # 가장 최근에 등록된 데이터가 화면에 먼저 나오도록 설계
    return {"data": rests}

# =========================================================
# [9] 특정 유저의 맛집 조회 (서열표, 프로필)
# =========================================================
@app.get("/restaurants")
async def get_restaurants(request: Request):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
    
    rests = load_db(REST_DB, [])
    user_rests = [r for r in rests if r.get("owner") == user_id]
    return {"data": user_rests}

@app.get("/guide/{username}")
async def get_guide(username: str):
    rests = load_db(REST_DB, [])
    users = load_db(USERS_DB, {})
    
    user_data = users.get(username, {})
    user_rests = [r for r in rests if r.get("owner") == username]
    
    # 서열표 기본 템플릿
    guide = {
        "⭐⭐⭐ (3스타)": [],
        "⭐⭐ (2스타)": [],
        "⭐ (1스타)": [],
        "단순 추천": [],
        "평가 대기 중 ⏳": []
    }
    
    # 등록된 맛집을 티어별로 분류
    for r in user_rests:
        tier = r.get("tier", "")
        if tier in guide:
            guide[tier].append(r)
        else:
            guide["평가 대기 중 ⏳"].append(r)
            
    return {
        "guide": guide,
        "nickname": user_data.get("display_name", username),
        "philosophy": user_data.get("philosophy", ""),
        "taste_tags": user_data.get("taste_tags", []),
        "personal_info": user_data.get("personal_info", ""),
        "badges": user_data.get("badges", [])
    }

@app.get("/profile/stats")
async def get_profile_stats(request: Request):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
        
    rests = load_db(REST_DB, [])
    user_rests = [r for r in rests if r.get("owner") == user_id]
    
    stats = {
        "3 STARS": {"count": 0},
        "2 STARS": {"count": 0},
        "1 STAR": {"count": 0},
        "RECOMMENDED": {"count": 0}
    }
    
    for r in user_rests:
        tier = r.get("tier", "")
        if "3스타" in tier:
            stats["3 STARS"]["count"] += 1
        elif "2스타" in tier:
            stats["2 STARS"]["count"] += 1
        elif "1스타" in tier:
            stats["1 STAR"]["count"] += 1
        elif "단순 추천" in tier:
            stats["RECOMMENDED"]["count"] += 1
            
    return {"stats": stats}

# =========================================================
# [10] 외부 API 연동 (카카오 장소 검색 및 이미지 검색)
# =========================================================
@app.get("/search/kakao")
async def search_kakao(query: str):
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {"query": query, "size": 15}
    
    resp = requests.get(url, headers=headers, params=params)
    if resp.status_code == 200:
        return resp.json()
    return {"documents": []}

@app.get("/restaurants/{rest_id}/ai-images")
async def get_ai_images(rest_id: str, name: str):
    # 식당 이름으로 카카오 이미지 검색을 호출하여 고화질 사진 후보를 제공
    url = "https://dapi.kakao.com/v2/search/image"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {"query": f"{name} 식당", "size": 10}
    
    try:
        resp = requests.get(url, headers=headers, params=params)
        if resp.status_code == 200:
            data = resp.json()
            images = [doc['image_url'] for doc in data.get('documents', [])]
            return {"images": images}
        return {"images": []}
    except:
        return {"images": []}

# =========================================================
# [11] 맛집 등록, 수정, 삭제 (CRUD)
# =========================================================
@app.post("/restaurants")
async def add_restaurant(
    request: Request,
    name: str = Form(...),
    category: str = Form(...),
    address: str = Form(...),
    kakao_id: str = Form(""),
    x: str = Form(""),
    y: str = Form(""),
    comment: str = Form(""),
    images: List[UploadFile] = File(None)
):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")

    # 1. 다중 사진 업로드 처리
    image_urls = []
    if images and len(images) > 0 and images[0].filename != '':
        for img in images:
            file_extension = img.filename.split(".")[-1]
            file_name = f"rest_{uuid.uuid4().hex[:12]}.{file_extension}"
            file_path = os.path.join("images", file_name)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(img.file, buffer)
            image_urls.append(f"/images/{file_name}")

    main_image = image_urls[0] if image_urls else ""

    # 2. 데이터 생성
    rest_data = {
        "id": str(uuid.uuid4()),
        "owner": user_id,
        "name": name,
        "category": category,
        "address": address,
        "kakao_id": kakao_id,
        "x": x,
        "y": y,
        "comment": comment,
        "tier": "", # 기본값은 빈 문자열 (위시리스트)
        "image_url": main_image,
        "image_urls": image_urls,
        "likes": [],
        "comments": [],
        "created_at": datetime.now().isoformat()
    }

    # 3. DB 저장
    rests = load_db(REST_DB, [])
    rests.append(rest_data)
    save_db(REST_DB, rests)

    return {"message": "성공적으로 추가되었습니다.", "id": rest_data["id"]}

@app.put("/restaurants/{rest_id}")
async def update_tier(rest_id: str, req: TierUpdateRequest, request: Request):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
        
    rests = load_db(REST_DB, [])
    for r in rests:
        if r["id"] == rest_id and r["owner"] == user_id:
            r["tier"] = req.tier
            save_db(REST_DB, rests)
            return {"message": "등급이 변경되었습니다."}
            
    raise HTTPException(status_code=404, detail="맛집을 찾을 수 없거나 권한이 없습니다.")

@app.put("/restaurants/{rest_id}/image")
async def update_restaurant_image(rest_id: str, req: ImageUpdateRequest, request: Request):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
        
    rests = load_db(REST_DB, [])
    for r in rests:
        if r["id"] == rest_id and r["owner"] == user_id:
            r["image_url"] = req.image_url
            if req.image_url not in r.get("image_urls", []):
                urls = r.get("image_urls", [])
                urls.insert(0, req.image_url)
                r["image_urls"] = urls
            save_db(REST_DB, rests)
            return {"message": "사진이 성공적으로 교체되었습니다."}
            
    raise HTTPException(status_code=404, detail="수정 권한이 없습니다.")

@app.delete("/restaurants/{rest_id}")
async def delete_restaurant(rest_id: str, request: Request):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
        
    rests = load_db(REST_DB, [])
    original_len = len(rests)
    
    rests = [r for r in rests if not (r["id"] == rest_id and r["owner"] == user_id)]
    
    if len(rests) == original_len:
        raise HTTPException(status_code=404, detail="삭제할 대상이 없거나 권한이 없습니다.")
        
    save_db(REST_DB, rests)
    return {"message": "성공적으로 삭제되었습니다."}

# =========================================================
# [12] 소셜 네트워킹 (팔로우, 북마크, 좋아요, 방명록)
# =========================================================
def add_notification(user_id, noti_type, message):
    notis = load_db(NOTI_DB, {})
    if user_id not in notis:
        notis[user_id] = []
    
    notis[user_id].insert(0, {
        "id": str(uuid.uuid4()),
        "type": noti_type,
        "message": message,
        "read": False,
        "created_at": datetime.now().isoformat()
    })
    
    # 알림이 너무 길어지지 않게 50개 유지
    notis[user_id] = notis[user_id][:50]
    save_db(NOTI_DB, notis)

@app.post("/follow/{target_user}")
async def toggle_follow(target_user: str, request: Request):
    user_id = request.headers.get('user-id')
    if not user_id or user_id == target_user:
        raise HTTPException(status_code=400, detail="잘못된 요청입니다.")

    users = load_db(USERS_DB, {})
    if target_user not in users:
        raise HTTPException(status_code=404, detail="대상을 찾을 수 없습니다.")

    following_list = users[user_id].get("following", [])
    
    if target_user in following_list:
        following_list.remove(target_user)
        users[target_user]["followers"] -= 1
    else:
        following_list.append(target_user)
        users[target_user]["followers"] += 1
        users[user_id]["badges"].append(f"{target_user}님의 팬")
        add_notification(target_user, "follow", f"🤝 {user_id}님이 회원님을 팔로우합니다.")

    users[user_id]["following"] = following_list
    save_db(USERS_DB, users)
    
    return {"following": following_list}

@app.post("/restaurants/bookmark/{rest_id}")
async def bookmark_restaurant(rest_id: str, request: Request):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
        
    rests = load_db(REST_DB, [])
    target = next((r for r in rests if r["id"] == rest_id), None)
    
    if not target:
        raise HTTPException(status_code=404, detail="식당을 찾을 수 없습니다.")
        
    # 북마크 기능을 통해 내 리스트로 복사
    new_rest = target.copy()
    new_rest["id"] = str(uuid.uuid4())
    new_rest["owner"] = user_id
    new_rest["tier"] = "" # 내 위시리스트로 이동
    new_rest["likes"] = []
    new_rest["comments"] = []
    
    rests.append(new_rest)
    save_db(REST_DB, rests)
    
    add_notification(target["owner"], "bookmark", f"📌 {user_id}님이 회원님의 '{target['name']}' 기록을 위시리스트에 담았습니다.")
    
    return {"message": f"[{target['name']}]을 내 위시리스트에 담았습니다!"}

@app.post("/restaurants/{rest_id}/like")
async def toggle_like(rest_id: str, request: Request):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
        
    rests = load_db(REST_DB, [])
    for r in rests:
        if r["id"] == rest_id:
            likes = r.get("likes", [])
            if user_id in likes:
                likes.remove(user_id)
                liked = False
            else:
                likes.append(user_id)
                liked = True
                if r["owner"] != user_id:
                    add_notification(r["owner"], "like", f"❤️ {user_id}님이 '{r['name']}' 게시물을 좋아합니다.")
            
            r["likes"] = likes
            save_db(REST_DB, rests)
            return {"liked": liked, "likes_count": len(likes)}
            
    raise HTTPException(status_code=404, detail="식당을 찾을 수 없습니다.")

@app.post("/restaurants/{rest_id}/comment")
async def add_comment(rest_id: str, req: CommentRequest, request: Request):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
        
    rests = load_db(REST_DB, [])
    for r in rests:
        if r["id"] == rest_id:
            comments = r.get("comments", [])
            new_comment = {"user": user_id, "text": req.text, "time": datetime.now().isoformat()}
            comments.append(new_comment)
            r["comments"] = comments
            save_db(REST_DB, rests)
            
            if r["owner"] != user_id:
                add_notification(r["owner"], "comment", f"💬 {user_id}님이 '{r['name']}'에 방명록을 남겼습니다: {req.text}")
                
            return {"comments": comments}
            
    raise HTTPException(status_code=404, detail="식당을 찾을 수 없습니다.")

# =========================================================
# [13] 알림 시스템
# =========================================================
@app.get("/notifications")
async def get_notifications(request: Request):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
        
    notis = load_db(NOTI_DB, {})
    user_notis = notis.get(user_id, [])
    unread_count = sum(1 for n in user_notis if not n.get("read"))
    
    return {"notifications": user_notis, "unread_count": unread_count}

@app.put("/notifications/read")
async def read_notifications(request: Request):
    user_id = request.headers.get('user-id')
    if not user_id:
        raise HTTPException(status_code=401, detail="권한 없음")
        
    notis = load_db(NOTI_DB, {})
    if user_id in notis:
        for n in notis[user_id]:
            n["read"] = True
        save_db(NOTI_DB, notis)
        
    return {"message": "알림 읽음 처리 완료"}