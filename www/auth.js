// =========================================================
// [1.5] 소셜 로그인 엔진 (카카오/구글) & 일반 로그인
// =========================================================

if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
    Kakao.init('cdf28be42d7f14e86fdbe2901a84398a');
}

window.handleSocialLoginServer = async function(provider, token) {
    try {
        const res = await fetch(`${API_URL}/login/social`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: provider, token: token })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('currentUser', data.username);
            followingList = data.following || [];
            
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            initApp();
        } else {
            alert(data.detail || "소셜 로그인 서버 검증에 실패했습니다.");
        }
    } catch(e) {
        console.error("로그인 서버 에러:", e);
        alert("서버 통신에 실패했습니다. 백엔드가 실행 중인지 확인해주세요.");
    }
};

window.handleGoogleLogin = function(response) {
    window.handleSocialLoginServer('google', response.credential);
};

window.triggerGoogleLogin = async function() {
    try {
        if (typeof Capacitor !== 'undefined' && Capacitor.Plugins.GoogleAuth) {
            Capacitor.Plugins.GoogleAuth.initialize({
                clientId: '725138598590-gjhd8dduh3ag3922il5pcrf15q1rjvvn.apps.googleusercontent.com',
                scopes: ['profile', 'email'],
                grantOfflineAccess: true,
            });

            const googleUser = await Capacitor.Plugins.GoogleAuth.signIn();
            
            if (googleUser && googleUser.authentication) {
                window.handleSocialLoginServer('google', googleUser.authentication.idToken);
            }
        } else {
            alert("구글 로그인 모듈이 로드되지 않았습니다. 앱 환경인지 확인해주세요.");
        }
    } catch (error) {
        console.error("구글 로그인 에러:", error);
        alert("구글 로그인이 취소되었거나 오류가 발생했습니다.");
    }
};

window.loginWithKakao = function() {
    if (typeof Kakao === 'undefined') {
        alert("카카오 스크립트가 로드되지 않았습니다. 새로고침 후 다시 시도해주세요.");
        return;
    }
    Kakao.Auth.login({
        success: function(authObj) {
            window.handleSocialLoginServer('kakao', authObj.access_token);
        },
        fail: function(err) {
            console.error("카카오 로그인 취소 또는 에러 발생:", err);
            alert("카카오 로그인 중 오류가 발생했습니다.");
        }
    });
};

async function handleLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    
    if (!u || !p) {
        alert(currentLang === 'ko' ? "아이디와 비밀번호를 정확히 입력하세요." : "Please enter details.");
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/login`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ username: u, password: p }) 
        });
        
        const data = await res.json();
        
        if (res.ok) { 
            localStorage.setItem('currentUser', data.username); 
            followingList = data.following || []; 
            
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            initApp(); 
        } else { 
            alert(data.detail || "로그인에 실패했습니다."); 
        }
    } catch(e) { 
        alert("서버 연결에 실패했습니다. 백엔드가 실행 중인지 확인해주세요."); 
    }
}

async function handleSignup() {
    const u = document.getElementById('login-user').value; 
    const p = document.getElementById('login-pass').value;
    
    if (!u || !p) {
        alert("가입할 아이디와 비밀번호를 입력하세요.");
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/signup`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ username: u, password: p }) 
        });
        
        const responseData = await res.json();
        alert(responseData.message);
    } catch (e) {
        alert("회원가입 통신 중 에러가 발생했습니다.");
    }
}

window.handleLogout = function() { 
    localStorage.removeItem('currentUser'); 
    location.reload(); 
};