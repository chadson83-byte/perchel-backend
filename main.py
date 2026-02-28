from fastapi import FastAPI, HTTPException, Request, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import os
import uuid
import shutil
import requests
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import re

# =========================================================
# [1] 앱 초기화 및 환경 설정 (MongoDB 연동)
# =========================================================
app = FastAPI(title="Perchel Backend API", version="3.0")

# 🚨 가장 강력한 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("images", exist_ok=True)
app.mount("/images", StaticFiles(directory="images"), name="images")

# 🚨 MongoDB 연결 (이전에 복사하신 실제 주소로 <db_password>를 변경하여 넣으세요)
MONGO_URI = "mongodb+srv://chadson83:ss11041104@cluster0.fjcxowk.mongodb.net/?appName=Cluster0"
client = AsyncIOMotorClient(MONGO_URI)
db = client["perchel_db"]

users_col = db["users"]
rests_col = db["restaurants"]
notis_col = db["notifications"]

KAKAO_REST_API_KEY = "cdf28be42d7f14e86fdbe2901a84398a"
GOOGLE_CLIENT_ID = "725138598590-gjhd8dduh3ag3922il5pcrf15q1rjvvn.apps.googleusercontent.com"

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
# [4] 소셜 로그인 (MongoDB 연동)
# =========================================================
@app.post("/login/social")
async def social_login(req: SocialLoginRequest):
    user_id, display_name, profile_image = None, None, None
    
    if req.provider == "kakao":
        headers = {"Authorization": f"Bearer {req.token}"}
        resp = requests.get("https://kapi.kakao.com/v2/user/me", headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="유효하지 않은 카카오 토큰입니다.")
        kakao_data = resp.json()
        user_id = f"kakao_{kakao_data.get('id')}"
        profile = kakao_data.get("kakao_account", {}).get("profile", {})
        display_name = profile.get("nickname", "카카오유저")
        profile_image = profile.get("profile_image_url", "")
        
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

    user = await users_col.find_one({"user_id": user_id})
    if not user:
        user = {
            "user_id": user_id,
            "following": [],
            "followers": 0,
            "display_name": display_name,
            "profile_image": profile_image,
            "philosophy": "",
            "taste_tags": [],
            "personal_info": "",
            "badges": ["뉴비 미식가 🌱"]
        }
        await users_col.insert_one(user)
        print(f"[소셜가입 완료] 새로운 유저 등록: {user_id}")

    return {
        "message": "로그인 성공", 
        "username": user_id, 
        "display_name": user.get("display_name"),
        "following": user.get("following", [])
    }

# =========================================================
# [5] 프로필 및 유저 데이터 조회 로직
# =========================================================
@app.get("/users/profiles")
async def get_all_profiles():
    profiles = {}
    async for user in users_col.find({}, {"user_id": 1, "profile_image": 1}):
        if user.get("profile_image"):
            profiles[user["user_id"]] = user["profile_image"]
    return profiles

@app.post("/user/profile-image")
async def upload_profile_image(request: Request, image: UploadFile = File(...)):
    user_id = request.headers.get('user-id')
    if not user_id: raise HTTPException(status_code=401, detail="권한 없음")
    
    file_extension = image.filename.split(".")[-1]
    file_name = f"profile_{user_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = os.path.join("images", file_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    image_url = f"/images/{file_name}"
    res = await users_col.update_one({"user_id": user_id}, {"$set": {"profile_image": image_url}})
    
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    return {"message": "프로필 이미지 업데이트 성공", "image_url": image_url}

@app.put("/user/update-profile")
async def update_profile(req: ProfileUpdateRequest, request: Request):
    user_id = request.headers.get('user-id')
    if not user_id: raise HTTPException(status_code=401, detail="권한 없음")

    res = await users_col.update_one(
        {"user_id": user_id},
        {"$set": {
            "display_name": req.nickname,
            "personal_info": req.personal_info,
            "philosophy": req.philosophy,
            "taste_tags": req.taste_tags
        }}
    )
    if res.matched_count == 0: raise HTTPException(status_code=404, detail="유저 없음")
    return {"message": "프로필이 성공적으로 업데이트되었습니다."}

# =========================================================
# [6] 메인 화면 데이터 (홈, 네트워크)
# =========================================================
@app.get("/main/data")
async def get_main_data():
    all_users = await users_col.find().to_list(None)
    
    editors = []
    for u in all_users:
        uid = u["user_id"]
        count = await rests_col.count_documents({"owner": uid})
        editors.append({
            "username": uid,
            "display_name": u.get("display_name", uid),
            "followers": u.get("followers", 0),
            "following": u.get("following", []),
            "rest_count": count
        })
    
    editors_sorted = sorted(editors, key=lambda x: x["followers"], reverse=True)
    national_top_50 = [e["username"] for e in editors_sorted[:50]]
    
    popular_cursor = rests_col.aggregate([
        {"$match": {"kakao_id": {"$ne": "", "$exists": True}}},
        {"$group": {
            "_id": "$kakao_id",
            "save_count": {"$sum": 1},
            "data": {"$first": "$$ROOT"}
        }},
        {"$sort": {"save_count": -1}},
        {"$limit": 10}
    ])
    
    popular_places = []
    async for p in popular_cursor:
        doc = p["data"]
        doc["save_count"] = p["save_count"]
        doc.pop("_id", None)
        popular_places.append(doc)
        
    new_restaurants = await rests_col.find().sort("created_at", -1).limit(10).to_list(10)
    for r in new_restaurants: r.pop("_id", None)

    return {
        "all_editors": editors_sorted,
        "national_top_50": national_top_50,
        "regional_top_10": {}, 
        "popular_places": popular_places,
        "new_restaurants": new_restaurants
    }

# =========================================================
# [7] 랭킹 시스템 (메뉴 및 장소 검색 + 스마트 매핑)
# =========================================================
@app.get("/ranking")
async def get_ranking(keyword: str = ""):
    query = {"kakao_id": {"$ne": "", "$exists": True}}
    
    if keyword:
        # 💡 CTO 추가: 사용자가 메뉴를 치면 카테고리까지 유추하는 스마트 엔진
        search_terms = [keyword]
        kw_lower = keyword.lower()
        if any(k in kw_lower for k in ["탕수육", "짜장", "짬뽕", "마라", "중국집"]): search_terms.append("중식")
        if any(k in kw_lower for k in ["스시", "초밥", "사시미", "회", "오마카세"]): search_terms.append("일식")
        if any(k in kw_lower for k in ["파스타", "피자", "스테이크"]): search_terms.append("양식")
        if any(k in kw_lower for k in ["삼겹살", "갈비", "한우", "소고기", "돼지"]): search_terms.append("고기")
        
        or_conditions = []
        for term in search_terms:
            regex = re.compile(term, re.IGNORECASE)
            or_conditions.extend([
                {"name": regex},
                {"category": regex},
                {"address": regex},
                {"comment": regex}
            ])
        query["$or"] = or_conditions
        
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$kakao_id",
            "save_count": {"$sum": 1},
            "data": {"$first": "$$ROOT"}
        }},
        {"$sort": {"save_count": -1}}
    ]
    
    ranking = []
    async for p in rests_col.aggregate(pipeline):
        doc = p["data"]
        doc["save_count"] = p["save_count"]
        doc.pop("_id", None)
        ranking.append(doc)
        
    return {"ranking": ranking}

# =========================================================
# [8] 피드 (실시간 리뷰)
# =========================================================
@app.get("/feed")
async def get_feed():
    rests = await rests_col.find().sort("created_at", 1).to_list(None)
    for r in rests: r.pop("_id", None)
    return {"data": rests}

# =========================================================
# [9] 특정 유저의 맛집 조회 (서열표, 프로필)
# =========================================================
@app.get("/restaurants")
async def get_restaurants(request: Request):
    user_id = request.headers.get('user-id')
    if not user_id: raise HTTPException(status_code=401, detail="권한 없음")
    
    user_rests = await rests_col.find({"owner": user_id}).to_list(None)
    for r in user_rests: r.pop("_id", None)
    return {"data": user_rests}

@app.get("/guide/{username}")
async def get_guide(username: str):
    user_data = await users_col.find_one({"user_id": username}) or {}
    user_rests = await rests_col.find({"owner": username}).to_list(None)
    
    guide = {
        "⭐⭐⭐ (3스타)": [],
        "⭐⭐ (2스타)": [],
        "⭐ (1스타)": [],
        "단순 추천": [],
        "평가 대기 중 ⏳": []
    }
    
    for r in user_rests:
        r.pop("_id", None)
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
    if not user_id: raise HTTPException(status_code=401, detail="권한 없음")
        
    user_rests = await rests_col.find({"owner": user_id}).to_list(None)
    
    stats = {
        "3 STARS": {"count": 0},
        "2 STARS": {"count": 0},
        "1 STAR": {"count": 0},
        "RECOMMENDED": {"count": 0}
    }
    
    for r in user_rests:
        tier = r.get("tier", "")
        if "3스타" in tier: stats["3 STARS"]["count"] += 1
        elif "2스타" in tier: stats["2 STARS"]["count"] += 1
        elif "1스타" in tier: stats["1 STAR"]["count"] += 1
        elif "단순 추천" in tier: stats["RECOMMENDED"]["count"] += 1
            
    return {"stats": stats}

# =========================================================
# [10] 외부 API 연동
# =========================================================
@app.get("/search/kakao")
async def search_kakao(query: str):
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"}
    params = {"query": query, "size": 15}
    resp = requests.get(url, headers=headers, params=params)
    if resp.status_code == 200: return resp.json()
    return {"documents": []}

@app.get("/restaurants/{rest_id}/ai-images")
async def get_ai_images(rest_id: str, name: str):
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

# 💡 [CTO 핵심 로직] 유저의 미적 권위(랭크)를 수치화하는 함수
async def get_user_rank(user_id: str):
    user = await users_col.find_one({"user_id": user_id})
    if not user: return 0
    
    followers = user.get("followers", 0)
    review_count = await rests_col.count_documents({"owner": user_id})
    
    # 랭크 점수 공식: $rank\_score = (followers \times 10) + (reviews \times 2)$
    return (followers * 10) + (review_count * 2)


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
    if not user_id: raise HTTPException(status_code=401, detail="권한 없음")

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

    # ---------------------------------------------------------
    # 👑 [옵션 C: 멘토 우선 로직 - 썸네일 쟁탈전]
    # ---------------------------------------------------------
    rank_score = await get_user_rank(user_id)
    
    # 이 식당(kakao_id)의 기존 마스터 정보 확인
    existing_rests = await rests_col.find({"kakao_id": kakao_id}).to_list(None)
    
    current_top_rank = 0
    current_top_photo = ""
    current_top_user = user_id
    
    if existing_rests:
        current_top_rank = existing_rests[0].get("global_top_rank", 0)
        current_top_photo = existing_rests[0].get("global_top_photo", "")
        current_top_user = existing_rests[0].get("global_top_user", "")

    # 내 점수가 기존 멘토보다 높거나 같고, 새로운 사진을 올렸다면 왕좌 탈환!
    if rank_score >= current_top_rank and main_image:
        new_top_photo = main_image
        new_top_rank = rank_score
        new_top_user = user_id
        
        # 기존에 등록된 이 식당의 모든 피드 썸네일을 내 사진으로 강제 일괄 교체
        await rests_col.update_many(
            {"kakao_id": kakao_id},
            {"$set": {
                "global_top_photo": new_top_photo,
                "global_top_rank": new_top_rank,
                "global_top_user": new_top_user
            }}
        )
    else:
        # 내 랭크가 낮거나 사진이 없으면 기존 마스터 썸네일 유지
        new_top_photo = current_top_photo if current_top_photo else main_image
        new_top_rank = current_top_rank
        new_top_user = current_top_user
    # ---------------------------------------------------------

    rest_data = {
        "id": str(uuid.uuid4()),
        "owner": user_id,
        "name": name,
        "category": category,
        "address": address,
        "kakao_id": kakao_id,
        "x": x, "y": y,
        "comment": comment,
        "tier": "", 
        "image_url": main_image,          # 내 개인 피드용 원본
        "image_urls": image_urls,
        "global_top_photo": new_top_photo,# 💡 앱 전체 간판용 사진
        "global_top_rank": new_top_rank,  # 💡 권력 방어용 점수
        "global_top_user": new_top_user,  # 💡 썸네일 점유자 마크
        "likes": [],
        "comments": [],
        "created_at": datetime.now().isoformat()
    }

    await rests_col.insert_one(rest_data)
    return {"message": "성공적으로 추가되었습니다.", "id": rest_data["id"]}

@app.put("/restaurants/{rest_id}")
async def update_tier(rest_id: str, req: TierUpdateRequest, request: Request):
    user_id = request.headers.get('user-id')
    res = await rests_col.update_one({"id": rest_id, "owner": user_id}, {"$set": {"tier": req.tier}})
    if res.matched_count == 0: raise HTTPException(status_code=404, detail="맛집을 찾을 수 없거나 권한이 없습니다.")
    return {"message": "등급이 변경되었습니다."}

@app.put("/restaurants/{rest_id}/image")
async def update_restaurant_image(rest_id: str, req: ImageUpdateRequest, request: Request):
    user_id = request.headers.get('user-id')
    rest = await rests_col.find_one({"id": rest_id, "owner": user_id})
    if not rest: raise HTTPException(status_code=404, detail="수정 권한이 없습니다.")
    
    urls = rest.get("image_urls", [])
    if req.image_url not in urls:
        urls.insert(0, req.image_url)
        
    await rests_col.update_one({"id": rest_id}, {"$set": {"image_url": req.image_url, "image_urls": urls}})
    return {"message": "사진이 성공적으로 교체되었습니다."}

@app.delete("/restaurants/{rest_id}")
async def delete_restaurant(rest_id: str, request: Request):
    user_id = request.headers.get('user-id')
    res = await rests_col.delete_one({"id": rest_id, "owner": user_id})
    if res.deleted_count == 0: raise HTTPException(status_code=404, detail="삭제할 대상이 없거나 권한이 없습니다.")
    return {"message": "성공적으로 삭제되었습니다."}

# =========================================================
# [12] 소셜 네트워킹 (팔로우, 북마크, 좋아요, 방명록) & 알림
# =========================================================
async def add_notification(user_id, noti_type, message):
    noti_data = {
        "id": str(uuid.uuid4()),
        "type": noti_type,
        "message": message,
        "read": False,
        "created_at": datetime.now().isoformat()
    }
    
    # 해당 유저의 알림 도큐먼트가 없으면 생성하고, 있으면 맨 앞에 추가하되 50개 유지
    await notis_col.update_one(
        {"user_id": user_id},
        {"$push": {
            "notifications": {
                "$each": [noti_data],
                "$position": 0,
                "$slice": 50
            }
        }},
        upsert=True
    )

@app.post("/follow/{target_user}")
async def toggle_follow(target_user: str, request: Request):
    user_id = request.headers.get('user-id')
    if not user_id or user_id == target_user: raise HTTPException(status_code=400, detail="잘못된 요청입니다.")

    target = await users_col.find_one({"user_id": target_user})
    me = await users_col.find_one({"user_id": user_id})
    if not target or not me: raise HTTPException(status_code=404, detail="대상을 찾을 수 없습니다.")

    following_list = me.get("following", [])
    if target_user in following_list:
        following_list.remove(target_user)
        await users_col.update_one({"user_id": target_user}, {"$inc": {"followers": -1}})
    else:
        following_list.append(target_user)
        await users_col.update_one({"user_id": target_user}, {"$inc": {"followers": 1}})
        await users_col.update_one({"user_id": user_id}, {"$addToSet": {"badges": f"{target_user}님의 팬"}})
        await add_notification(target_user, "follow", f"🤝 {user_id}님이 회원님을 팔로우합니다.")

    await users_col.update_one({"user_id": user_id}, {"$set": {"following": following_list}})
    return {"following": following_list}

@app.post("/restaurants/bookmark/{rest_id}")
async def bookmark_restaurant(rest_id: str, request: Request):
    user_id = request.headers.get('user-id')
    target = await rests_col.find_one({"id": rest_id})
    if not target: raise HTTPException(status_code=404, detail="식당을 찾을 수 없습니다.")
        
    new_rest = target.copy()
    new_rest.pop("_id", None)
    new_rest["id"] = str(uuid.uuid4())
    new_rest["owner"] = user_id
    new_rest["tier"] = "" 
    new_rest["likes"] = []
    new_rest["comments"] = []
    
    await rests_col.insert_one(new_rest)
    await add_notification(target["owner"], "bookmark", f"📌 {user_id}님이 회원님의 '{target['name']}' 기록을 위시리스트에 담았습니다.")
    return {"message": f"[{target['name']}]을 내 위시리스트에 담았습니다!"}

@app.post("/restaurants/{rest_id}/like")
async def toggle_like(rest_id: str, request: Request):
    user_id = request.headers.get('user-id')
    r = await rests_col.find_one({"id": rest_id})
    if not r: raise HTTPException(status_code=404, detail="식당을 찾을 수 없습니다.")
        
    likes = r.get("likes", [])
    if user_id in likes:
        likes.remove(user_id)
        liked = False
    else:
        likes.append(user_id)
        liked = True
        if r["owner"] != user_id:
            await add_notification(r["owner"], "like", f"❤️ {user_id}님이 '{r['name']}' 게시물을 좋아합니다.")
            
    await rests_col.update_one({"id": rest_id}, {"$set": {"likes": likes}})
    return {"liked": liked, "likes_count": len(likes)}

@app.post("/restaurants/{rest_id}/comment")
async def add_comment(rest_id: str, req: CommentRequest, request: Request):
    user_id = request.headers.get('user-id')
    r = await rests_col.find_one({"id": rest_id})
    if not r: raise HTTPException(status_code=404, detail="식당을 찾을 수 없습니다.")
        
    comments = r.get("comments", [])
    new_comment = {"user": user_id, "text": req.text, "time": datetime.now().isoformat()}
    comments.append(new_comment)
    
    await rests_col.update_one({"id": rest_id}, {"$set": {"comments": comments}})
    
    if r["owner"] != user_id:
        await add_notification(r["owner"], "comment", f"💬 {user_id}님이 '{r['name']}'에 방명록을 남겼습니다: {req.text}")
        
    return {"comments": comments}

# =========================================================
# [13] 알림 시스템
# =========================================================
@app.get("/notifications")
async def get_notifications(request: Request):
    user_id = request.headers.get('user-id')
    user_doc = await notis_col.find_one({"user_id": user_id}) or {}
    user_notis = user_doc.get("notifications", [])
    unread_count = sum(1 for n in user_notis if not n.get("read"))
    
    return {"notifications": user_notis, "unread_count": unread_count}

@app.put("/notifications/read")
async def read_notifications(request: Request):
    user_id = request.headers.get('user-id')
    user_doc = await notis_col.find_one({"user_id": user_id})
    if user_doc:
        notis = user_doc.get("notifications", [])
        for n in notis: n["read"] = True
        await notis_col.update_one({"user_id": user_id}, {"$set": {"notifications": notis}})
        
    return {"message": "알림 읽음 처리 완료"}

