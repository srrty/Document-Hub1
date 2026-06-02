document.addEventListener('DOMContentLoaded', () => {

    // ================================================================
    // SECTION 1: VIEW SWITCHING
    // ================================================================
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view');

    function switchView(targetId) {
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.target === targetId);
        });
        views.forEach(view => {
            view.classList.toggle('active', view.id === targetId);
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            switchView(link.dataset.target);
        });
    });

    document.getElementById('logo-btn').addEventListener('click', () => {
        switchView('view-dashboard');
    });

    document.getElementById('btn-new-summary').addEventListener('click', () => {
        switchView('view-summary');
    });

    switchView('view-dashboard');


    // ================================================================
    // SECTION 2: AUTH STATE MANAGEMENT
    // ================================================================
    const navGuest  = document.getElementById('nav-guest');
    const navUser   = document.getElementById('nav-user');
    const navAvatar = document.getElementById('nav-avatar');
    const navUsername = document.getElementById('nav-username');

    function getToken() { return localStorage.getItem('token'); }
    function getUsername() { return localStorage.getItem('username'); }
    function getDisplayName() { return localStorage.getItem('displayname') || getUsername(); }

    function updateTokensUI(tokens) {
        const navTokensEl = document.getElementById('nav-tokens');
        if (navTokensEl) {
            navTokensEl.textContent = `🪙 ${tokens} 토큰`;
        }
        const billingTokensEl = document.getElementById('billing-current-tokens');
        if (billingTokensEl) {
            billingTokensEl.textContent = `${tokens} 토큰`;
        }
    }

    async function loadUserInfo() {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('user_id', data.id);
                localStorage.setItem('username', data.username);
                localStorage.setItem('displayname', data.displayname || data.username);
                localStorage.setItem('is_operator', data.is_operator ? 'true' : 'false');
                
                if (navUsername) navUsername.textContent = data.displayname || data.username;
                if (navAvatar) navAvatar.textContent = (data.displayname || data.username || 'U')[0].toUpperCase();
                
                updateTokensUI(data.tokens);
                
                const sUsernameEl = document.getElementById('settings-username-display');
                const sDisplayEl  = document.getElementById('settings-displayname');
                const sAvatarEl   = document.getElementById('settings-avatar');
                if (sUsernameEl) sUsernameEl.value = data.username || '';
                if (sDisplayEl)  sDisplayEl.value  = data.displayname || data.username || '';
                if (sAvatarEl)   sAvatarEl.textContent = (data.displayname || data.username || 'U')[0].toUpperCase();
                
                // 설정 페이지 요약 횟수 업데이트
                const sSummaryCountEl = document.getElementById('settings-summary-count');
                if (sSummaryCountEl && data.summary_count !== undefined) {
                    sSummaryCountEl.textContent = data.summary_count + '회';
                }

                // 운영자 대시보드 탭 노출 토글
                const navOperatorTab = document.getElementById('nav-operator-tab');
                if (navOperatorTab) {
                    navOperatorTab.style.display = data.is_operator ? 'block' : 'none';
                }
            } else if (res.status === 401) {
                document.getElementById('btn-logout').click();
            }
        } catch (e) {
            console.error('Error loading user info:', e);
        }
    }

    function updateNavAuthState() {
        const token = getToken();
        if (token) {
            navGuest.style.display = 'none';
            navUser.style.display  = 'flex';
            loadUserInfo();
        } else {
            navGuest.style.display = 'flex';
            navUser.style.display  = 'none';
            const navOperatorTab = document.getElementById('nav-operator-tab');
            if (navOperatorTab) navOperatorTab.style.display = 'none';
        }
    }

    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('displayname');
        localStorage.removeItem('is_operator');
        const navOperatorTab = document.getElementById('nav-operator-tab');
        if (navOperatorTab) navOperatorTab.style.display = 'none';
        updateNavAuthState();
        closeAuthPanel();

        // 대시보드 통계 및 힌트 초기화
        const statsDocCountEl = document.getElementById('stats-doc-count');
        const statsDocDescEl  = document.getElementById('stats-doc-desc');
        if (statsDocCountEl) statsDocCountEl.textContent = '0';
        if (statsDocDescEl) statsDocDescEl.textContent = '로그인 후 확인 가능';

        const recentDocsEl = document.getElementById('dashboard-recent-docs');
        if (recentDocsEl) recentDocsEl.innerHTML = '';

        const hintEl = document.getElementById('saved-list-hint');
        if (hintEl) {
            hintEl.style.display = 'block';
            hintEl.textContent = '로그인 후 저장된 요약 문서를 확인할 수 있습니다.';
        }

        const dashBadge = document.getElementById('dash-team-count-badge');
        const dashContainer = document.getElementById('dash-team-list-container');
        if (dashBadge) dashBadge.style.display = 'none';
        if (dashContainer) {
            dashContainer.innerHTML = `
                <p class="text-muted" style="font-size:12px; margin-bottom:12px;">로그인 후 팀을 생성하거나 참가하여 실시간으로 협업하세요.</p>
                <button class="btn-outline w-full" onclick="document.getElementById('btn-open-login').click()">로그인하고 시작하기</button>
            `;
        }
        // ================================================================
    // ✨ [신규 추가]: 로그아웃 시 요약 서비스 채팅 내역 초기화
    // ================================================================
    
    // 1. 브라우저 로컬 스토리지에서 채팅 세션 데이터 완전 삭제
    localStorage.removeItem('chatSessions');
    localStorage.removeItem('currentSessionId');

    // 2. JavaScript 메모리 상의 채팅 상태 초기화
    chatSessions = [];
    currentSessionId = '';

    // 3. 왼쪽 사이드바 채팅 목록 UI 비우기
    if (chatSessionList) {
        chatSessionList.innerHTML = '';
    }

    // 4. 오른쪽 메인 채팅창 초기 안내 화면(플레이스홀더)으로 되돌리기
    if (chatHistoryContainer) {
        chatHistoryContainer.innerHTML = `
            <div class="chat-placeholder">
                <div style="font-size:40px;">🤖</div>
                <p>안녕하세요! 요약하고 싶은 내용을 입력해주세요.</p>
                <p style="font-size:13px; color:#aaa;">텍스트 입력 시 AI 요약본이 즉시 생성됩니다.</p>
            </div>
        `;
    }

    // 5. 상단 채팅방 활성화 타이틀 및 문서 저장 버튼 초기화
    if (chatActiveTitle) {
        chatActiveTitle.textContent = '새 채팅';
    }
    if (btnSaveChatDoc) {
        btnSaveChatDoc.style.display = 'none';
    }

    // 6. 저장된 문서 리스트 영역도 비우기 (개인 보관함 탭 등)
    const chatSavedList = document.getElementById('chat-saved-list');
    if (chatSavedList) {
        chatSavedList.innerHTML = '<p class="text-muted" style="font-size:13px;">저장된 문서가 없습니다.</p>';
    }
    });


    // ================================================================
    // SECTION 3: AUTH PANEL (LOGIN / REGISTER)
    // ================================================================
    const authPanel       = document.getElementById('auth-panel');
    const loginForm       = document.getElementById('auth-login-form');
    const registerForm    = document.getElementById('auth-register-form');

    function openAuthPanel() {
        authPanel.classList.add('active');
        showLoginForm();
    }

    function closeAuthPanel() {
        authPanel.classList.remove('active');
    }

    function showLoginForm() {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    }

    function showRegisterForm() {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }

    document.getElementById('btn-open-login').addEventListener('click', openAuthPanel);
    document.getElementById('btn-close-auth').addEventListener('click', closeAuthPanel);
    document.getElementById('goto-register').addEventListener('click', showRegisterForm);
    document.getElementById('goto-login').addEventListener('click', showLoginForm);

    // 운영자 가입 선택에 따른 인증코드 입력란 토글
    const regIsOperatorCheck = document.getElementById('reg-is-operator-check');
    const regOperatorCodeInput = document.getElementById('reg-operator-code');
    if (regIsOperatorCheck && regOperatorCodeInput) {
        regIsOperatorCheck.addEventListener('change', () => {
            regOperatorCodeInput.style.display = regIsOperatorCheck.checked ? 'block' : 'none';
            if (!regIsOperatorCheck.checked) {
                regOperatorCodeInput.value = '';
            }
        });
    }

    // 패널 외부 클릭 시 닫기
    document.addEventListener('click', (e) => {
        if (authPanel.classList.contains('active')) {
            if (!authPanel.contains(e.target) && e.target.id !== 'btn-open-login') {
                closeAuthPanel();
            }
        }
    });

    // 로그인 처리
    document.getElementById('btn-do-login').addEventListener('click', async () => {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();
        if (!username || !password) { alert('아이디와 비밀번호를 입력해주세요.'); return; }

        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('username', username);
                localStorage.setItem('displayname', data.displayname || username);
                localStorage.setItem('is_operator', data.is_operator ? 'true' : 'false');
                closeAuthPanel();
                updateNavAuthState();
                loadMyDocuments();
                loadMyTeams();
            } else {
                const err = await res.json();
                alert('로그인 실패: ' + (err.detail || '아이디 또는 비밀번호를 확인하세요.'));
            }
        } catch { alert('서버에 연결할 수 없습니다.'); }
    });
    // 구글 로그인 버튼 클릭 시 팝업창 실행 및 백엔드 통신
const btnGoogleLogin = document.getElementById('btn-google-login');
if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', () => {
        const client = google.accounts.oauth2.initTokenClient({
            // public/app.js 파일의 283번째 줄을 이 코드로 정확하게 교체하세요!
            client_id: '105861234209-sjr68qr3lct6tslvcdmae1it2jocmo36.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
            callback: async (response) => {
                if (response.access_token) {
                    try {
                        // 구글 토큰을 우리 백엔드 서버로 전송
                        const res = await fetch('/api/auth/google', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ access_token: response.access_token })
                        });
                        
                        if (res.ok) {
                            const data = await res.json();
                            // 기존 토큰 보관 로직과 동기화
                            localStorage.setItem('token', data.access_token);
                            localStorage.setItem('username', data.username);
                            localStorage.setItem('displayname', data.displayname || data.username);
                            localStorage.setItem('is_operator', data.is_operator ? 'true' : 'false');
                            
                            closeAuthPanel();
                            updateNavAuthState();
                            loadMyDocuments();
                            loadMyTeams();
                            alert('구글 계정으로 로그인이 완료되었습니다!');
                        } else {
                            const err = await res.json();
                            alert('구글 인증 실패: ' + (err.detail || '오류 발생'));
                        }
                    } catch (e) {
                        alert('서버와 통신하는 중 오류가 발생했습니다.');
                    }
                }
            },
        });
        // 구글 로그인 팝업창 띄우기
        client.requestAccessToken();
    });
}
    
    // 회원가입 처리
    document.getElementById('btn-do-register').addEventListener('click', async () => {
        const username    = document.getElementById('reg-username').value.trim();
        const displayname = document.getElementById('reg-displayname').value.trim();
        const password    = document.getElementById('reg-password').value.trim();
        const password2   = document.getElementById('reg-password2').value.trim();

        const isOperatorChecked = document.getElementById('reg-is-operator-check').checked;
        const operatorCode = isOperatorChecked ? document.getElementById('reg-operator-code').value.trim() : null;

        if (!username || !password) { alert('아이디와 비밀번호를 입력해주세요.'); return; }
        if (password !== password2) { alert('비밀번호가 일치하지 않습니다.'); return; }
        if (isOperatorChecked && !operatorCode) { alert('운영자 인증 코드를 입력해주세요.'); return; }

        try {
            const signupData = { username, password, displayname: displayname || username };
            if (isOperatorChecked) {
                signupData.operator_code = operatorCode;
            }
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signupData)
            });
            if (res.ok) {
                alert('회원가입 성공! 이제 로그인해주세요.');
                showLoginForm();
                document.getElementById('login-username').value = username;
                // 가입 폼 초기화
                document.getElementById('reg-username').value = '';
                document.getElementById('reg-displayname').value = '';
                document.getElementById('reg-password').value = '';
                document.getElementById('reg-password2').value = '';
                if (regIsOperatorCheck) regIsOperatorCheck.checked = false;
                if (regOperatorCodeInput) {
                    regOperatorCodeInput.value = '';
                    regOperatorCodeInput.style.display = 'none';
                }
            } else {
                const err = await res.json();
                alert('가입 실패: ' + (err.detail || '이미 사용 중인 아이디입니다.'));
            }
        } catch { alert('서버에 연결할 수 없습니다.'); }
    });


    // ================================================================
    // SECTION 4: SETTINGS PAGE
    // ================================================================
    const btnSaveProfile = document.getElementById('btn-save-profile');
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener('click', async () => {
            const displayname = document.getElementById('settings-displayname').value.trim();
            const newPassword = document.getElementById('settings-new-password').value.trim();
            const token = getToken();
            if (!token) { alert('로그인이 필요합니다.'); return; }

            try {
                const body = { displayname };
                if (newPassword) body.new_password = newPassword;
                const res = await fetch('/api/auth/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(body)
                });
                if (res.ok) {
                    localStorage.setItem('displayname', displayname);
                    updateNavAuthState();
                    alert('프로필이 저장되었습니다.');
                } else {
                    const err = await res.json();
                    alert('저장 실패: ' + (err.detail || '오류'));
                }
            } catch { alert('서버 오류'); }
        });
    }

    // AI 요약 모델 설정 연동
    const selectAiModel = document.getElementById('settings-ai-model');
    if (selectAiModel) {
        const savedModel = localStorage.getItem('selectedModel') || 'gemini-1.5-flash';
        selectAiModel.value = savedModel;
        
        selectAiModel.addEventListener('change', () => {
            localStorage.setItem('selectedModel', selectAiModel.value);
        });
    }

    // 사진 변경 버튼 클릭 시 준비 중 안내
    const btnChangePhoto = document.querySelector('.profile-avatar-area button');
    if (btnChangePhoto) {
        btnChangePhoto.addEventListener('click', () => {
            alert('프로필 이미지 업로드 기능은 다음 정식 서비스 업데이트에 추가될 예정입니다!\n현재는 설정하신 표시 이름의 첫 글자가 아바타(Avatar)에 자동으로 반영됩니다.');
        });
    }

    // 계정 삭제 버튼 이벤트 핸들러
    const btnDeleteAccount = document.getElementById('btn-delete-account');
    if (btnDeleteAccount) {
        btnDeleteAccount.addEventListener('click', async () => {
            const token = getToken();
            if (!token) { alert('로그인이 필요합니다.'); return; }
            
            if (!confirm('정말로 계정을 삭제하시겠습니까?\n저장된 문서 및 모든 데이터가 영구적으로 삭제되며 되돌릴 수 없습니다.')) {
                return;
            }
            
            try {
                const res = await fetch('/api/auth/account', {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) {
                    alert('계정이 안전하게 삭제되었습니다. 이용해 주셔서 감사합니다.');
                    document.getElementById('btn-logout').click();
                    switchView('view-dashboard');
                } else {
                    const err = await res.json();
                    alert('계정 삭제 실패: ' + (err.detail || '오류 발생'));
                }
            } catch {
                alert('서버 오류가 발생했습니다.');
            }
        });
    }


    // ================================================================
    // SECTION 5: DASHBOARD SUMMARY GENERATION
    // ================================================================
    const btnStartSummary = document.getElementById('btn-start-summary');
    const summaryTextInput = document.getElementById('summary-text-input');
    const summaryExtraPrompt = document.getElementById('summary-extra-prompt');
    const previewContent = document.getElementById('preview-content');
    let lastSummaryText = '';
    let lastSummaryResult = '';
    let lastSummaryFileName = '';

    // 마크다운 형식의 요약 텍스트를 깨끗한 HTML로 변환하는 헬퍼 함수
    function formatSummaryText(text) {
        if (!text) return '';
        // 1. 볼드 기호 (**텍스트**) -> <strong>텍스트</strong> 변환
        let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // 2. 줄 단위 분석을 통해 목록 기호(*, -) 정제
        const lines = html.split('\n');
        const processedLines = lines.map(line => {
            let trimmed = line.trim();
            // 맨 앞의 에스터리스크(*)나 하이픈(-) 글머리 기호를 가독성 좋은 원 기호(•)로 변환
            if (trimmed.startsWith('*') && !trimmed.startsWith('**')) {
                return line.replace(/^\s*\*\s*/, '• ');
            }
            if (trimmed.startsWith('-')) {
                return line.replace(/^\s*-\s*/, '• ');
            }
            return line;
        });
        html = processedLines.join('\n');
        
        // 3. 줄바꿈(\n) -> <br> 변환
        return html.replace(/\n/g, '<br>');
    }

    // 파일 업로드 드롭존 & 선택 이벤트 연동
    const fileInput = document.getElementById('file-input');
    const fileDropZone = document.getElementById('file-drop-zone');
    let selectedFile = null;

    if (fileDropZone && fileInput) {
        // 드래그앤드롭 이벤트 리스너 정의
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileDropZone.addEventListener(eventName, (e) => e.preventDefault(), false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            fileDropZone.addEventListener(eventName, () => {
                fileDropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            fileDropZone.addEventListener(eventName, () => {
                fileDropZone.classList.remove('dragover');
            }, false);
        });

        // 파일 드롭 핸들러
        fileDropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                handleFileSelection(files[0]);
            }
        });

        // 파일 수동 선택 핸들러
        fileInput.addEventListener('change', (e) => {
            if (fileInput.files.length > 0) {
                handleFileSelection(fileInput.files[0]);
            }
        });
    }

    // 파일 선택 완료 후 UI 업데이트 및 입력 잠금
    function handleFileSelection(file) {
        const allowedExtensions = ['.txt', '.pdf', '.docx', '.hwp'];
        const filename = file.name;
        const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();

        if (!allowedExtensions.includes(extension)) {
            alert('지원하지 않는 파일 형식입니다.\n.txt, .pdf, .docx, .hwp 파일만 요약 가능합니다.');
            return;
        }

        selectedFile = file;
        
        // UI 변경
        const dropIcon = fileDropZone.querySelector('.drop-icon');
        const dropText = fileDropZone.querySelector('.drop-text');
        const fileTypes = fileDropZone.querySelector('.file-types');
        const selectBtn = fileDropZone.querySelector('button');

        if (dropIcon) dropIcon.textContent = '📂';
        if (dropText) dropText.innerHTML = `<strong>${filename}</strong><br><span style="color:var(--primary); font-weight:600;">파일이 선택되었습니다.</span>`;
        if (fileTypes) fileTypes.textContent = `크기: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
        if (selectBtn) selectBtn.textContent = '다른 파일 선택';
        
        // 텍스트 직접 입력창 비활성화 (혼선 방지)
        if (summaryTextInput) {
            summaryTextInput.placeholder = '파일 요약 모드가 활성화되었습니다. 직접 입력 모드로 돌아가려면 파일을 해제하거나 다른 요약 서비스를 사용하세요.';
            summaryTextInput.value = '';
            summaryTextInput.disabled = true;
        }
    }

    // 파일 선택 리셋
    function resetFileSelection() {
        selectedFile = null;
        if (fileDropZone) {
            const dropIcon = fileDropZone.querySelector('.drop-icon');
            const dropText = fileDropZone.querySelector('.drop-text');
            const fileTypes = fileDropZone.querySelector('.file-types');
            const selectBtn = fileDropZone.querySelector('button');

            if (dropIcon) dropIcon.textContent = '📄';
            if (dropText) dropText.textContent = '여기에 파일을 끌어다 놓거나';
            if (fileTypes) fileTypes.textContent = 'txt, pdf, docx, hwp 지원 · 최대 10MB';
            if (selectBtn) selectBtn.textContent = '파일 선택';
        }
        if (fileInput) fileInput.value = '';
        if (summaryTextInput) {
            summaryTextInput.placeholder = '또는 여기에 요약할 텍스트 내용을 직접 입력하거나 붙여넣으세요...';
            summaryTextInput.disabled = false;
        }
    }

    if (btnStartSummary) {
        btnStartSummary.addEventListener('click', async () => {
            const text = summaryTextInput.value.trim();
            const promptText = summaryExtraPrompt.value.trim();

            if (!selectedFile && !text) {
                alert('요약할 텍스트를 직접 입력하거나 요약할 파일을 드롭/선택해주세요.');
                return;
            }

            btnStartSummary.textContent = '요약 중...';
            btnStartSummary.disabled = true;
            previewContent.innerHTML = '<div class="loading-spinner"></div><p style="text-align:center;color:#999;margin-top:8px;">AI가 요약 중입니다...</p>';

            try {
                let res;
                const token = getToken();
                const headers = {};
                if (token) {
                    headers['Authorization'] = 'Bearer ' + token;
                }

                if (selectedFile) {
                    // 파일 요약 업로드 API 호출
                    const formData = new FormData();
                    formData.append('file', selectedFile);
                    formData.append('prompt', promptText);
                    const selectedModel = localStorage.getItem('selectedModel') || 'gemini-1.5-flash';
                    formData.append('model', selectedModel);

                    res = await fetch('/api/summary/upload', {
                        method: 'POST',
                        headers: headers,
                        body: formData
                    });
                } else {
                    // 텍스트 요약 API 호출
                    const textHeaders = {
                        'Content-Type': 'application/json',
                        ...headers
                    };
                    const selectedModel = localStorage.getItem('selectedModel') || 'gemini-1.5-flash';
                    res = await fetch('/api/summary/generate', {
                        method: 'POST',
                        headers: textHeaders,
                        body: JSON.stringify({ text, prompt: promptText, model: selectedModel })
                    });
                }

                if (res.ok) {
                    const data = await res.json();
                    if (selectedFile) {
                        lastSummaryText = data.original_text || selectedFile.name + " 본문";
                        lastSummaryFileName = selectedFile.name;
                    } else {
                        lastSummaryText = text;
                        lastSummaryFileName = "";
                    }
                    lastSummaryResult = data.summary;
                    previewContent.innerHTML = `<div class="preview-text-block">${formatSummaryText(data.summary)}</div>`;
                    
                    // 요약이 성공적으로 끝나면 선택된 파일 리셋
                    resetFileSelection();

                    if (data.remaining_tokens !== undefined && data.remaining_tokens !== null) {
                        updateTokensUI(data.remaining_tokens);
                    }
                } else {
                    const err = await res.json();
                    previewContent.innerHTML = `<div class="empty-state" style="color:red; font-size:13px;">요약 생성에 실패했습니다.<br>사유: ${err.detail || '오류 발생'}</div>`;
                    if (res.status === 402) {
                        if (confirm('보유 토큰이 소모되었습니다. 결제 페이지에서 충전하시겠습니까?')) {
                            switchView('view-billing');
                        }
                    }
                }
            } catch (e) {
                console.error(e);
                previewContent.innerHTML = '<div class="empty-state" style="color:red;">서버에 연결할 수 없습니다.</div>';
            } finally {
                btnStartSummary.textContent = '요약 시작';
                btnStartSummary.disabled = false;
            }
        });
    }

    // 문서 저장 버튼
    const btnSaveDoc = document.getElementById('btn-save-doc');
    if (btnSaveDoc) {
        btnSaveDoc.addEventListener('click', async () => {
            if (!lastSummaryResult) { alert('먼저 요약을 생성하세요.'); return; }
            if (!getToken()) { alert('저장하려면 로그인이 필요합니다.'); openAuthPanel(); return; }

            // 업로드한 파일명이 존재할 경우 확장자 제거 후 타이틀 제안
            let defaultTitle = '요약 문서 ' + new Date().toLocaleDateString('ko-KR');
            if (lastSummaryFileName) {
                const nameWithoutExt = lastSummaryFileName.substring(0, lastSummaryFileName.lastIndexOf('.'));
                defaultTitle = nameWithoutExt + ' 요약';
            }

            const title = prompt('문서 제목을 입력하세요:', defaultTitle);
            if (!title) return;

            // 저장할 위치 물어보기
            let teamId = null;
            if (myTeams.length > 0) {
                let msg = '저장할 위치를 선택하세요:\n0: 💻 내 컴퓨터 (개인 보관함)\n';
                myTeams.forEach((t, i) => {
                    msg += `${i + 1}: 👥 ${t.name}\n`;
                });
                const selection = prompt(msg, '0');
                if (selection === null) return;
                const idx = parseInt(selection.trim());
                if (!isNaN(idx) && idx > 0 && idx <= myTeams.length) {
                    teamId = myTeams[idx - 1].id;
                }
            }

            try {
                const body = { title, original_content: lastSummaryText, summary_content: lastSummaryResult };
                if (teamId) body.team_id = teamId;

                const res = await fetch('/api/documents', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + getToken()
                    },
                    body: JSON.stringify(body)
                });
                if (res.ok) {
                    alert(teamId ? '팀 공유 문서에 저장되었습니다!' : '내 컴퓨터 문서에 저장되었습니다!');
                    loadMyDocuments();
                    if (teamId && activeTeamId === teamId) {
                        loadActiveTeamDocuments(teamId);
                    }
                    // 팀 탭 select-saved-team의 문서 자동 갱신을 위해 이벤트 트리거
                    const selectEl = document.getElementById('select-saved-team');
                    if (selectEl && selectEl.value == teamId) {
                        selectEl.dispatchEvent(new Event('change'));
                    }
                } else {
                    alert('저장 실패');
                }
            } catch { alert('서버 오류'); }
        });
    }

    // PDF 내보내기 버튼 이벤트
    const btnExportPdf = document.getElementById('btn-export-pdf');
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', () => {
            if (!lastSummaryResult) { alert('먼저 요약을 생성하거나 문서를 선택하세요.'); return; }
            
            let defaultTitle = '요약 문서 ' + new Date().toLocaleDateString('ko-KR');
            if (lastSummaryFileName) {
                const nameWithoutExt = lastSummaryFileName.substring(0, lastSummaryFileName.lastIndexOf('.'));
                defaultTitle = nameWithoutExt + ' 요약';
            }

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('팝업 차단을 해제해주세요.');
                return;
            }
            printWindow.document.write(`
                <html>
                <head>
                    <title>${defaultTitle}</title>
                    <style>
                        body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; padding: 40px; color: #1a1a2e; line-height: 1.8; }
                        h1 { font-size: 24px; border-bottom: 2px solid #5c6ef8; padding-bottom: 10px; margin-bottom: 20px; }
                        .meta { font-size: 12px; color: #8892a0; margin-bottom: 30px; }
                        .content { font-size: 15px; white-space: pre-wrap; word-break: break-all; }
                    </style>
                </head>
                <body>
                    <h1>${defaultTitle}</h1>
                    <div class="meta">발행일자: ${new Date().toLocaleString('ko-KR')}</div>
                    <div class="content">${lastSummaryResult}</div>
                    <script>
                        window.onload = function() {
                            window.print();
                            window.onafterprint = function() { window.close(); }
                        }
                    <\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        });
    }

    // 링크 복사 버튼 이벤트 (요약 내용 복사)
    const btnCopyPreviewLink = document.getElementById('btn-copy-preview-link');
    if (btnCopyPreviewLink) {
        btnCopyPreviewLink.addEventListener('click', () => {
            if (!lastSummaryResult) { alert('먼저 요약을 생성하거나 문서를 선택하세요.'); return; }
            navigator.clipboard.writeText(lastSummaryResult).then(() => {
                alert('요약 결과가 클립보드에 복사되었습니다!');
            }).catch(() => {
                alert('클립보드 복사에 실패했습니다.');
            });
        });
    }

    // 팀에 공유 버튼 이벤트
    const btnShareTeam = document.getElementById('btn-share-team');
    if (btnShareTeam) {
        btnShareTeam.addEventListener('click', async () => {
            if (!lastSummaryResult) { alert('먼저 요약을 생성하거나 문서를 선택하세요.'); return; }
            const token = getToken();
            if (!token) { alert('팀에 공유하려면 로그인이 필요합니다.'); openAuthPanel(); return; }
            
            if (myTeams.length === 0) {
                alert('가입된 팀이 없습니다. 팀 탭에서 먼저 팀을 생성하거나 참가해주세요.');
                switchView('view-team');
                return;
            }
            
            let msg = '공유할 팀을 선택하세요 (번호 입력):\n';
            myTeams.forEach((t, i) => {
                msg += `${i + 1}: 👥 ${t.name}\n`;
            });
            const selection = prompt(msg, '1');
            if (selection === null) return;
            
            const idx = parseInt(selection.trim());
            if (isNaN(idx) || idx < 1 || idx > myTeams.length) {
                alert('올바른 팀 번호가 아닙니다.');
                return;
            }
            const chosenTeam = myTeams[idx - 1];
            
            let defaultTitle = '요약 문서 ' + new Date().toLocaleDateString('ko-KR');
            if (lastSummaryFileName) {
                const nameWithoutExt = lastSummaryFileName.substring(0, lastSummaryFileName.lastIndexOf('.'));
                defaultTitle = nameWithoutExt + ' 요약';
            }
            
            const title = prompt(`'${chosenTeam.name}' 팀에 저장할 문서 제목을 입력하세요:`, defaultTitle);
            if (!title) return;
            
            try {
                const body = { 
                    title, 
                    original_content: lastSummaryText, 
                    summary_content: lastSummaryResult,
                    team_id: chosenTeam.id
                };
                const res = await fetch('/api/documents', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(body)
                });
                if (res.ok) {
                    alert(`'${chosenTeam.name}' 팀 보관함에 요약 문서가 공유되었습니다!`);
                    // UI 갱신
                    if (activeTeamId === chosenTeam.id) {
                        loadActiveTeamDocuments(chosenTeam.id);
                    }
                    const selectEl = document.getElementById('select-saved-team');
                    if (selectEl && selectEl.value == chosenTeam.id) {
                        selectEl.dispatchEvent(new Event('change'));
                    }
                } else {
                    alert('공유 실패');
                }
            } catch { alert('서버 오류'); }
        });
    }


    // ================================================================
    // SECTION 6: CHAT VIEW (요약 서비스)
    // ================================================================
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatPromptInput = document.getElementById('chat-prompt-input');
    const chatHistoryContainer = document.getElementById('chat-history-container');
    const chatSessionList = document.getElementById('chat-session-list');
    const btnCreateChat = document.getElementById('btn-create-chat');

    let chatSessions = [];
    let currentSessionId = '';

    // 로컬 스토리지에서 채팅방 목록 및 메시지 히스토리 로드
    function loadChatSessions() {
        try {
            const savedSessions = localStorage.getItem('chatSessions');
            const savedCurrentId = localStorage.getItem('currentSessionId');
            
            if (savedSessions) {
                chatSessions = JSON.parse(savedSessions);
            }
            
            if (savedCurrentId) {
                currentSessionId = savedCurrentId;
            }
            
            // 세션 리스트가 완전히 빈 경우, 기본 세션 하나 자동 생성
            if (chatSessions.length === 0) {
                createNewChatSession(false);
            } else {
                // 현재 활성화된 currentSessionId가 유효한지 검증
                const exists = chatSessions.some(s => s.id === currentSessionId);
                if (!exists && chatSessions.length > 0) {
                    currentSessionId = chatSessions[0].id;
                }
            }
        } catch (e) {
            console.error('Error loading chat sessions:', e);
            createNewChatSession(false);
        }
        
        renderChatSessions();
        renderCurrentSessionMessages();
    }

    // 로컬 스토리지에 채팅방 목록 및 메시지 히스토리 저장
    function saveChatSessions() {
        try {
            localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
            localStorage.setItem('currentSessionId', currentSessionId);
        } catch (e) {
            console.error('Error saving chat sessions:', e);
        }
    }

    // 새로운 채팅 세션 생성
    function createNewChatSession(shouldFocus = true) {
        const newId = 'session-' + Date.now();
        const timeString = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        const newSession = {
            id: newId,
            title: `새 채팅 (${timeString})`,
            messages: []
        };
        
        chatSessions.unshift(newSession);
        currentSessionId = newId;
        
        if (shouldFocus) {
            saveChatSessions();
            renderChatSessions();
            renderCurrentSessionMessages();
        }
    }

    // 채팅 세션 삭제
    function deleteChatSession(sessionId, event) {
        if (event) event.stopPropagation(); // 세션 스위칭 이벤트 전파 차단
        
        const index = chatSessions.findIndex(s => s.id === sessionId);
        if (index === -1) return;
        
        chatSessions.splice(index, 1);
        
        // 내가 활성화해서 보고 있던 채팅방을 삭제한 경우, 포커스 재배치
        if (currentSessionId === sessionId) {
            if (chatSessions.length > 0) {
                currentSessionId = chatSessions[0].id;
            } else {
                createNewChatSession(false);
            }
        }
        
        saveChatSessions();
        renderChatSessions();
        renderCurrentSessionMessages();
    }

    // 사이드바 채팅 목록 렌더링
    function renderChatSessions() {
        if (!chatSessionList) return;
        chatSessionList.innerHTML = '';
        
        chatSessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'sidebar-list-item' + (session.id === currentSessionId ? ' active' : '');
            item.setAttribute('data-id', session.id);
            
            // 제목 영역
            const titleEl = document.createElement('div');
            titleEl.className = 'list-item-title';
            titleEl.textContent = session.title;
            item.appendChild(titleEl);
            
            // 삭제 버튼 (&times; 기호 사용)
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-chat-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = '채팅 삭제';
            deleteBtn.addEventListener('click', (e) => deleteChatSession(session.id, e));
            item.appendChild(deleteBtn);
            
            // 클릭 시 해당 채팅 세션으로 전환
            item.addEventListener('click', () => {
                currentSessionId = session.id;
                saveChatSessions();
                renderChatSessions();
                renderCurrentSessionMessages();
            });
            
            chatSessionList.appendChild(item);
        });
    }

    // 현재 활성화된 세션의 대화 메시지 렌더링
    const chatActiveTitle = document.getElementById('chat-active-title');
    const btnSaveChatDoc = document.getElementById('btn-save-chat-doc');

    function renderCurrentSessionMessages() {
        if (!chatHistoryContainer) return;
        chatHistoryContainer.innerHTML = '';
        
        const session = chatSessions.find(s => s.id === currentSessionId);

        if (chatActiveTitle) {
            chatActiveTitle.textContent = session ? session.title : '새 채팅';
        }
        
        if (btnSaveChatDoc) {
            if (session && session.messages.length > 0) {
                btnSaveChatDoc.style.display = 'block';
            } else {
                btnSaveChatDoc.style.display = 'none';
            }
        }

        if (!session || session.messages.length === 0) {
            // 비어있는 상태의 웰컴 플레이스홀더 표시
            const placeholder = document.createElement('div');
            placeholder.className = 'chat-placeholder';
            placeholder.innerHTML = `
                <div style="font-size:40px;">🤖</div>
                <p>안녕하세요! 요약하고 싶은 내용을 입력해주세요.</p>
                <p style="font-size:13px; color:#aaa;">텍스트 입력 시 AI 요약본이 즉시 생성됩니다.</p>
            `;
            chatHistoryContainer.appendChild(placeholder);
            return;
        }
        
        session.messages.forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble ' + (msg.isUser ? 'user-bubble' : 'ai-bubble');
            bubble.innerHTML = msg.isUser ? msg.text.replace(/\n/g, '<br>') : formatSummaryText(msg.text);
            chatHistoryContainer.appendChild(bubble);
        });
        
        chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
    }

    // 대화 말풍선 추가 및 세션 내역 상태 동기화
    function addChatBubble(content, isUser = false) {
        const placeholder = chatHistoryContainer.querySelector('.chat-placeholder');
        if (placeholder) placeholder.remove();

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + (isUser ? 'user-bubble' : 'ai-bubble');
        bubble.innerHTML = isUser ? content.replace(/\n/g, '<br>') : formatSummaryText(content);
        chatHistoryContainer.appendChild(bubble);
        chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
        
        // 활성화된 세션 데이터에 동적으로 추가 후 영속화
        const session = chatSessions.find(s => s.id === currentSessionId);
        if (session) {
            session.messages.push({ text: content, isUser });
            saveChatSessions();
        }
        
        if (btnSaveChatDoc) {
            btnSaveChatDoc.style.display = 'block';
        }
        
        return bubble;
    }

    // 메시지 전송 처리
    async function sendChatMessage() {
        const prompt = chatPromptInput.value.trim();
        if (!chatSelectedFile && !prompt) return;

        // 1. 사용자 입력 말풍선 추가 및 상태 반영
        let userMsg = '';
        if (chatSelectedFile) {
            userMsg += `📁 [파일 첨부] ${chatSelectedFile.name}`;
            if (prompt) {
                userMsg += `\n요청사항: ${prompt}`;
            }
        } else {
            userMsg = prompt;
        }

        addChatBubble(userMsg, true);
        chatPromptInput.value = '';
        chatPromptInput.style.height = 'auto';

        // 2. 새 채팅방명 생성 시점이면 제목 업데이트
        const session = chatSessions.find(s => s.id === currentSessionId);
        if (session && session.title.startsWith('새 채팅')) {
            const titleBase = chatSelectedFile ? chatSelectedFile.name : prompt;
            session.title = titleBase.substring(0, 12) + (titleBase.length > 12 ? '...' : '');
            saveChatSessions();
            renderChatSessions();
        }

        const fileToUpload = chatSelectedFile;
        
        // 첨부 파일 선택 UI 리셋
        chatSelectedFile = null;
        if (chatFileInput) chatFileInput.value = '';
        if (chatFilePreview) chatFilePreview.style.display = 'none';
        chatPromptInput.placeholder = '요약할 내용 또는 요청사항을 입력하세요... (Shift+Enter: 줄바꿈)';

        // 3. AI 로딩 말풍선 추가
        const aiBubble = addChatBubble('<span style="color:#aaa;">요약 중...</span>', false);

        try {
            const token = getToken();
            const headers = {};
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }
            const selectedModel = localStorage.getItem('selectedModel') || 'gemini-1.5-flash';

            let res;
            if (fileToUpload) {
                const formData = new FormData();
                formData.append('file', fileToUpload);
                formData.append('prompt', prompt);
                formData.append('model', selectedModel);
                
                res = await fetch('/api/summary/upload', {
                    method: 'POST',
                    headers: headers,
                    body: formData
                });
            } else {
                const textHeaders = {
                    'Content-Type': 'application/json',
                    ...headers
                };
                res = await fetch('/api/summary/generate', {
                    method: 'POST',
                    headers: textHeaders,
                    body: JSON.stringify({ text: prompt, prompt: '', model: selectedModel })
                });
            }
            
            if (res.ok) {
                const data = await res.json();
                aiBubble.innerHTML = formatSummaryText(data.summary);
                
                // 메모리 내 마지막 메시지(AI 요약본) 텍스트 업데이트 후 영속화
                if (session && session.messages.length > 0) {
                    session.messages[session.messages.length - 1].text = data.summary;
                    saveChatSessions();
                }

                if (data.remaining_tokens !== undefined && data.remaining_tokens !== null) {
                    updateTokensUI(data.remaining_tokens);
                }
            } else {
                const err = await res.json();
                const errMsg = err.detail || '요약 중 오류가 발생했습니다.';
                const errText = `<span style="color:red;">요약 실패: ${errMsg}</span>`;
                aiBubble.innerHTML = errText;
                if (session && session.messages.length > 0) {
                    session.messages[session.messages.length - 1].text = errText;
                    saveChatSessions();
                }
                if (res.status === 402) {
                    if (confirm('보유 토큰이 소모되었습니다. 결제 페이지에서 충전하시겠습니까?')) {
                        switchView('view-billing');
                    }
                }
            }
        } catch {
            const errText = '<span style="color:red;">서버에 연결할 수 없습니다.</span>';
            aiBubble.innerHTML = errText;
            if (session && session.messages.length > 0) {
                session.messages[session.messages.length - 1].text = errText;
                saveChatSessions();
            }
        }
    }

    if (chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);

    if (chatPromptInput) {
        chatPromptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
        // 입력 박스 자동 늘어나기
        chatPromptInput.addEventListener('input', () => {
            chatPromptInput.style.height = 'auto';
            chatPromptInput.style.height = Math.min(chatPromptInput.scrollHeight, 120) + 'px';
        });
    }

    if (btnCreateChat) {
        btnCreateChat.addEventListener('click', () => {
            createNewChatSession(true);
        });
    }

    // 채팅 세션 정보 최초 세팅
    loadChatSessions();

    if (btnSaveChatDoc) {
        btnSaveChatDoc.addEventListener('click', async () => {
            const session = chatSessions.find(s => s.id === currentSessionId);
            if (!session || session.messages.length === 0) {
                alert('저장할 채팅 내용이 없습니다.');
                return;
            }
            if (!getToken()) {
                alert('저장하려면 로그인이 필요합니다.');
                openAuthPanel();
                return;
            }

            const title = prompt('문서 제목을 입력하세요:', session.title);
            if (!title) return;

            const originalContent = session.messages
                .filter(m => m.isUser)
                .map(m => m.text)
                .join('\n\n---\n\n');
            const summaryContent = session.messages
                .filter(m => !m.isUser)
                .map(m => m.text)
                .join('\n\n---\n\n');

            let teamId = null;
            if (myTeams.length > 0) {
                let msg = '저장할 위치를 선택하세요:\n0: 💻 내 컴퓨터 (개인 보관함)\n';
                myTeams.forEach((t, i) => {
                    msg += `${i + 1}: 👥 ${t.name}\n`;
                });
                const selection = prompt(msg, '0');
                if (selection === null) return;
                const idx = parseInt(selection.trim());
                if (!isNaN(idx) && idx > 0 && idx <= myTeams.length) {
                    teamId = myTeams[idx - 1].id;
                }
            }

            try {
                const body = { title, original_content: originalContent, summary_content: summaryContent };
                if (teamId) body.team_id = teamId;

                const res = await fetch('/api/documents', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + getToken()
                    },
                    body: JSON.stringify(body)
                });

                if (res.ok) {
                    alert(teamId ? '팀 공유 문서에 저장되었습니다!' : '내 컴퓨터 문서에 저장되었습니다!');
                    loadMyDocuments();
                    if (teamId && activeTeamId === teamId) {
                        loadActiveTeamDocuments(teamId);
                    }
                    const selectEl = document.getElementById('select-saved-team');
                    if (selectEl && selectEl.value == teamId) {
                        selectEl.dispatchEvent(new Event('change'));
                    }
                } else {
                    alert('문서 저장에 실패했습니다.');
                }
            } catch (e) {
                console.error(e);
                alert('서버 오류가 발생했습니다.');
            }
        });
    }

    // 요약 서비스 채팅 파일 첨부 기능
    const chatAttachBtn = document.getElementById('btn-chat-attach');
    const chatFileInput = document.getElementById('chat-file-input');
    const chatFilePreview = document.getElementById('chat-file-preview');
    const chatFileNameSpan = document.getElementById('chat-file-name');
    const btnClearChatFile = document.getElementById('btn-clear-chat-file');
    let chatSelectedFile = null;

    if (chatAttachBtn && chatFileInput) {
        chatAttachBtn.addEventListener('click', () => {
            chatFileInput.click();
        });

        chatFileInput.addEventListener('change', () => {
            if (chatFileInput.files.length > 0) {
                const file = chatFileInput.files[0];
                const allowedExtensions = ['.txt', '.pdf', '.docx', '.hwp'];
                const filename = file.name;
                const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();

                if (!allowedExtensions.includes(extension)) {
                    alert('지원하지 않는 파일 형식입니다.\n.txt, .pdf, .docx, .hwp 파일만 요약 가능합니다.');
                    chatFileInput.value = '';
                    return;
                }

                chatSelectedFile = file;
                if (chatFileNameSpan) {
                    chatFileNameSpan.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
                }
                if (chatFilePreview) {
                    chatFilePreview.style.display = 'flex';
                }
                if (chatPromptInput) {
                    chatPromptInput.placeholder = '파일 요약에 대한 추가 요청사항을 입력해보세요... (예: 3줄 요약)';
                }
            }
        });
    }

    if (btnClearChatFile) {
        btnClearChatFile.addEventListener('click', () => {
            chatSelectedFile = null;
            if (chatFileInput) chatFileInput.value = '';
            if (chatFilePreview) chatFilePreview.style.display = 'none';
            if (chatPromptInput) {
                chatPromptInput.placeholder = '요약할 내용 또는 요청사항을 입력하세요... (Shift+Enter: 줄바꿈)';
            }
        });
    }


    // ================================================================
    // SECTION 7: SAVED DOCUMENTS
    // ================================================================
    async function loadMyDocuments() {
        if (!getToken()) return;

        try {
            const res = await fetch('/api/documents/my', {
                headers: { 'Authorization': 'Bearer ' + getToken() }
            });
            if (!res.ok) return;
            const docs = await res.json();

            const savedDocList = document.getElementById('saved-doc-list');
            const chatSavedList = document.getElementById('chat-saved-list');
            const hintEl = document.getElementById('saved-list-hint');

            if (hintEl) hintEl.textContent = docs.length > 0 ? `${docs.length}개의 요약 문서가 있습니다.` : '저장된 문서가 없습니다.';

            if (savedDocList) {
                savedDocList.innerHTML = '';
                if (docs.length === 0) {
                    savedDocList.innerHTML = '<p class="text-muted" style="padding:16px;font-size:13px;">저장된 문서가 없습니다.</p>';
                } else {
                    docs.forEach(doc => {
                        const item = document.createElement('div');
                        item.className = 'saved-doc-item';
                        item.innerHTML = `
                            <div class="saved-doc-title">${doc.title}</div>
                            <div class="saved-doc-date">${new Date(doc.created_at).toLocaleDateString('ko-KR')}</div>
                        `;
                        item.addEventListener('click', () => showDocPreview(doc, true));
                        savedDocList.appendChild(item);
                    });
                }
            }

            if (chatSavedList) {
                chatSavedList.innerHTML = '';
                if (docs.length === 0) {
                    chatSavedList.innerHTML = '<p class="text-muted" style="font-size:13px;">저장된 문서가 없습니다.</p>';
                } else {
                    docs.forEach(doc => {
                        const item = document.createElement('div');
                        item.className = 'sidebar-list-item';
                        item.style.cursor = 'pointer';
                        item.innerHTML = `<div class="list-item-title" style="font-size:13px;">${doc.title}</div>`;
                        chatSavedList.appendChild(item);
                    });
                }
            }

            // 대시보드 통계 카드 및 최근 문서 업데이트
            const statsDocCountEl = document.getElementById('stats-doc-count');
            const statsDocDescEl  = document.getElementById('stats-doc-desc');
            if (statsDocCountEl) {
                statsDocCountEl.textContent = docs.length;
            }
            if (statsDocDescEl) {
                statsDocDescEl.textContent = docs.length > 0 ? '내 보관함 동기화 완료' : '문서가 비어 있습니다';
            }

            const recentDocsEl = document.getElementById('dashboard-recent-docs');
            if (recentDocsEl) {
                recentDocsEl.innerHTML = '';
                if (docs.length === 0) {
                    recentDocsEl.style.display = 'none';
                    if (hintEl) {
                        hintEl.style.display = 'block';
                        hintEl.textContent = '저장된 문서가 없습니다.';
                    }
                } else {
                    if (hintEl) hintEl.style.display = 'none';
                    recentDocsEl.style.display = 'flex';
                    // 최신 3개 요약본 노출
                    docs.slice(0, 3).forEach(doc => {
                        const item = document.createElement('div');
                        item.className = 'recent-doc-item';
                        item.innerHTML = `
                            <span class="recent-doc-name">${doc.title}</span>
                            <span class="recent-doc-date">${new Date(doc.created_at).toLocaleDateString('ko-KR')}</span>
                        `;
                        item.addEventListener('click', () => {
                            // 대시보드 미리보기 패널에 렌더링
                            lastSummaryText = doc.original_content || '';
                            lastSummaryResult = doc.summary_content;
                            const previewContentEl = document.getElementById('preview-content');
                            if (previewContentEl) {
                                previewContentEl.innerHTML = `
                                    <div class="preview-text-block">
                                        <h3 style="margin-bottom:12px; font-size:16px; font-weight:700;">${doc.title}</h3>
                                        <div style="font-size:12px;color:#999;margin-bottom:16px;">저장일자: ${new Date(doc.created_at).toLocaleString('ko-KR')}</div>
                                        <div style="line-height:1.75;font-size:14px;color:var(--text);">${formatSummaryText(doc.summary_content)}</div>
                                    </div>
                                `;
                            }
                        });
                        recentDocsEl.appendChild(item);
                    });
                }
            }

            // 설정 페이지 카운트 업데이트
            const docCountEl = document.getElementById('settings-doc-count');
            if (docCountEl) docCountEl.textContent = docs.length + '개';

        } catch (e) { console.error(e); }
    }

    function showDocPreview(doc, isPersonal = false) {
        const zone = document.getElementById('doc-preview-zone');
        if (!zone) return;
        
        const currentUserId = parseInt(localStorage.getItem('user_id'));
        const isMyDoc = isPersonal || (doc.owner_id === currentUserId);

        zone.innerHTML = `
            <div style="padding: 8px; width: 100%;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:12px;">
                    <h3 style="font-size:18px; margin:0;">${doc.title}</h3>
                    <div style="display:flex; gap:8px; align-items:center;">
                        ${doc.owner_name ? `<span style="font-size:12px; color:var(--text-muted); background:var(--bg); padding:3px 8px; border-radius:12px;">공유자: ${doc.owner_name}</span>` : ''}
                        ${isMyDoc ? `<button id="btn-delete-doc" class="btn-sm-danger" style="padding:4px 8px; font-size:11px;">삭제 🗑️</button>` : ''}
                    </div>
                </div>
                <p style="font-size:12px;color:#999;margin-bottom:16px;">작성일시: ${new Date(doc.created_at).toLocaleString('ko-KR')}</p>
                <div style="line-height:1.75;font-size:14px;color:var(--text);">${formatSummaryText(doc.summary_content)}</div>
            </div>
        `;

        const deleteDocBtn = document.getElementById('btn-delete-doc');
        if (deleteDocBtn) {
            deleteDocBtn.addEventListener('click', async () => {
                if (!confirm(`정말로 '${doc.title}' 문서를 삭제하시겠습니까?`)) return;
                
                try {
                    const res = await fetch(`/api/documents/${doc.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + getToken() }
                    });
                    if (res.ok) {
                        alert('문서가 삭제되었습니다.');
                        
                        // Clear preview pane
                        zone.innerHTML = `
                            <div class="empty-state" id="saved-preview-empty-state">
                                <div style="font-size:40px;">📂</div>
                                <p>왼쪽에서 문서를 선택하거나 텍스트를 불러오세요.</p>
                                <span class="empty-state-sub">내 컴퓨터 보관함 또는 가입한 팀 보관함의 문서 목록에서 요약본을 조회할 수 있습니다.</span>
                            </div>
                        `;
                        
                        // Refresh documents lists
                        loadMyDocuments();
                        
                        // If it's a team document, refresh team document list
                        const selectEl = document.getElementById('select-saved-team');
                        if (selectEl && selectEl.value) {
                            selectEl.dispatchEvent(new Event('change'));
                        }
                    } else {
                        const err = await res.json();
                        alert('삭제 실패: ' + (err.detail || '오류 발생'));
                    }
                } catch {
                    alert('서버 오류가 발생했습니다.');
                }
            });
        }
    }

    // ================================================================
    // SECTION 8: TEAM COLLABORATION STATE & EVENT HANDLERS
    // ================================================================
    let myTeams = [];
    let activeTeamId = null;

    async function loadMyTeams() {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch('/api/teams', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return;
            myTeams = await res.json();
            
            // 저장된 문서 탭 내 팀 선택 드롭다운 갱신
            const selectTeam = document.getElementById('select-saved-team');
            if (selectTeam) {
                const currentVal = selectTeam.value;
                selectTeam.innerHTML = '<option value="">-- 내 가입 팀 선택 --</option>';
                myTeams.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = `${t.name} (${t.member_count}명)`;
                    selectTeam.appendChild(opt);
                });
                if (currentVal && myTeams.some(t => t.id == currentVal)) {
                    selectTeam.value = currentVal;
                }
            }

            // 팀 페이지 소속 팀 목록 개수 배지 갱신
            const countEl = document.getElementById('my-teams-count');
            if (countEl) countEl.textContent = `${myTeams.length}개`;

            renderMyTeamsList();

            // 대시보드 팀 및 협업 영역 갱신
            const dashBadge = document.getElementById('dash-team-count-badge');
            const dashContainer = document.getElementById('dash-team-list-container');
            if (dashBadge && dashContainer) {
                dashBadge.textContent = `${myTeams.length}개`;
                dashBadge.style.display = 'inline-block';
                
                dashContainer.innerHTML = '';
                if (myTeams.length === 0) {
                    dashContainer.innerHTML = `
                        <p class="text-muted" style="font-size:12px; margin-bottom:12px;">아직 가입한 팀이 없습니다. 새 그룹을 만들어보세요!</p>
                        <button class="btn-outline w-full" onclick="document.querySelector('.nav-link[data-target=view-team]').click()">팀 만들기/참가</button>
                    `;
                } else {
                    // 최신 3개 팀 표시
                    myTeams.slice(0, 3).forEach(t => {
                        const item = document.createElement('div');
                        item.className = 'dash-team-item';
                        item.innerHTML = `
                            <span class="dash-team-name">👥 ${t.name}</span>
                            <span class="dash-team-members">멤버 ${t.member_count}명</span>
                        `;
                        item.addEventListener('click', () => {
                            switchView('view-team');
                            selectActiveTeam(t.id);
                        });
                        dashContainer.appendChild(item);
                    });
                    
                    const btnMore = document.createElement('button');
                    btnMore.className = 'btn-outline w-full';
                    btnMore.style.marginTop = '8px';
                    btnMore.style.fontSize = '12px';
                    btnMore.style.padding = '6px 12px';
                    btnMore.textContent = '전체 그룹 관리';
                    btnMore.onclick = () => {
                        switchView('view-team');
                    };
                    dashContainer.appendChild(btnMore);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    function renderMyTeamsList() {
        const container = document.getElementById('my-teams-list');
        if (!container) return;
        container.innerHTML = '';
        if (myTeams.length === 0) {
            container.innerHTML = '<p class="text-muted" style="font-size:13px; grid-column: 1/-1;">가입된 팀이 없습니다.</p>';
            return;
        }
        myTeams.forEach(t => {
            const card = document.createElement('div');
            card.className = 'team-card-item' + (activeTeamId === t.id ? ' active' : '');
            card.innerHTML = `
                <div class="team-card-name">${t.name}</div>
                <div class="team-card-members">멤버 ${t.member_count}명 · 코드: ${t.code}</div>
            `;
            card.addEventListener('click', () => {
                selectActiveTeam(t.id);
            });
            container.appendChild(card);
        });
    }

    async function selectActiveTeam(teamId) {
        activeTeamId = teamId;
        renderMyTeamsList();
        
        const team = myTeams.find(t => t.id === teamId);
        if (!team) return;

        // UI 토글
        const emptyState = document.getElementById('team-workspace-empty');
        const contentState = document.getElementById('team-workspace-content');
        const badgesState = document.getElementById('active-team-badges');
        const activeName = document.getElementById('active-team-name');
        
        if (emptyState) emptyState.style.display = 'none';
        if (contentState) contentState.style.display = 'block';
        if (badgesState) badgesState.style.display = 'flex';
        if (activeName) activeName.textContent = team.name;

        // 초대 정보 연동
        const codeBadge = document.getElementById('active-team-code-badge');
        if (codeBadge) codeBadge.textContent = team.code;

        // 초대 링크 복사 핸들러
        const copyBtn = document.getElementById('btn-copy-team-link');
        if (copyBtn) {
            copyBtn.onclick = () => {
                const joinUrl = `${window.location.origin}${window.location.pathname}?join_code=${team.code}`;
                navigator.clipboard.writeText(joinUrl).then(() => {
                    alert('팀 초대 링크가 클립보드에 복사되었습니다!\n' + joinUrl);
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                });
            };
        }

        // 팀 탈퇴/해체 핸들러
        const leaveBtn = document.getElementById('btn-leave-team');
        if (leaveBtn) {
            const currentUserId = parseInt(localStorage.getItem('user_id'));
            const isOwner = team.owner_id === currentUserId;
            leaveBtn.textContent = isOwner ? '팀 해체하기 🗑️' : '팀 탈퇴하기 🚪';
            
            leaveBtn.onclick = async () => {
                const confirmMsg = isOwner 
                    ? `정말로 '${team.name}' 팀을 해체하시겠습니까?\n모든 팀원들과 공유된 문서가 전부 삭제됩니다.` 
                    : `정말로 '${team.name}' 팀에서 탈퇴하시겠습니까?`;
                if (!confirm(confirmMsg)) return;
                
                try {
                    const res = await fetch(`/api/teams/${team.id}/leave`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + getToken() }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        alert(data.message);
                        activeTeamId = null;
                        
                        // UI 초기화
                        if (emptyState) emptyState.style.display = 'block';
                        if (contentState) contentState.style.display = 'none';
                        if (badgesState) badgesState.style.display = 'none';
                        
                        await loadMyTeams();
                    } else {
                        const err = await res.json();
                        alert('실패: ' + (err.detail || '오류 발생'));
                    }
                } catch {
                    alert('서버 오류가 발생했습니다.');
                }
            };
        }

        // 멤버 & 문서 동기화 로드
        loadActiveTeamMembers(teamId);
        loadActiveTeamDocuments(teamId);
    }

    async function loadActiveTeamMembers(teamId) {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch(`/api/teams/${teamId}/members`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return;
            const members = await res.json();
            
            const countEl = document.getElementById('team-member-count');
            if (countEl) countEl.textContent = members.length;

            const listEl = document.getElementById('team-members-list');
            if (listEl) {
                listEl.innerHTML = '';
                members.forEach(m => {
                    const item = document.createElement('div');
                    item.className = 'member-item';
                    item.innerHTML = `
                        <div class="user-avatar-sm">${(m.displayname || m.username)[0].toUpperCase()}</div>
                        <div class="member-name">${m.displayname || m.username}</div>
                        <div class="member-joined">${new Date(m.joined_at).toLocaleDateString('ko-KR')}</div>
                    `;
                    listEl.appendChild(item);
                });
            }
        } catch (e) { console.error(e); }
    }

    async function loadActiveTeamDocuments(teamId) {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch(`/api/teams/${teamId}/documents`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) return;
            const docs = await res.json();

            const countEl = document.getElementById('team-doc-count');
            if (countEl) countEl.textContent = docs.length;

            const listEl = document.getElementById('team-shared-docs-list');
            if (listEl) {
                listEl.innerHTML = '';
                if (docs.length === 0) {
                    listEl.innerHTML = '<p class="text-muted" style="font-size:12px; padding:10px;">공유된 문서가 없습니다.</p>';
                    return;
                }
                docs.forEach(doc => {
                    const item = document.createElement('div');
                    item.className = 'saved-doc-item';
                    item.style.padding = '10px 12px';
                    item.style.background = '#fff';
                    item.style.border = '1px solid var(--border)';
                    item.style.borderRadius = '6px';
                    item.style.cursor = 'pointer';
                    item.innerHTML = `
                        <div class="saved-doc-title" style="font-size:13px; font-weight:700; margin-bottom:2px;">${doc.title}</div>
                        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted);">
                            <span>작성자: ${doc.owner_name}</span>
                            <span>${new Date(doc.created_at).toLocaleDateString('ko-KR')}</span>
                        </div>
                    `;
                    item.addEventListener('click', () => {
                        showDocPreview(doc, false);
                    });
                    listEl.appendChild(item);
                });
            }
        } catch (e) { console.error(e); }
    }

    // 팀 생성 버튼 이벤트 리스너
    const btnCreateTeam = document.getElementById('btn-create-team');
    const createTeamNameInput = document.getElementById('create-team-name');
    if (btnCreateTeam && createTeamNameInput) {
        btnCreateTeam.addEventListener('click', async () => {
            const name = createTeamNameInput.value.trim();
            if (!name) { alert('팀 이름을 입력해주세요.'); return; }
            const token = getToken();
            if (!token) { alert('로그인이 필요합니다.'); return; }
            try {
                const res = await fetch('/api/teams', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ name })
                });
                if (res.ok) {
                    const team = await res.json();
                    alert(`팀 '${team.name}'이 성공적으로 생성되었습니다!\n초대 코드: ${team.code}`);
                    createTeamNameInput.value = '';
                    await loadMyTeams();
                    selectActiveTeam(team.id);
                } else {
                    alert('팀 생성에 실패했습니다.');
                }
            } catch { alert('서버 오류가 발생했습니다.'); }
        });
    }

    // 팀 참가 버튼 이벤트 리스너
    const btnJoinTeam = document.getElementById('btn-join-team');
    const joinTeamCodeInput = document.getElementById('join-team-code');
    if (btnJoinTeam && joinTeamCodeInput) {
        btnJoinTeam.addEventListener('click', async () => {
            const code = joinTeamCodeInput.value.trim().toUpperCase();
            if (!code) { alert('초대 코드를 입력해주세요.'); return; }
            const token = getToken();
            if (!token) { alert('로그인이 필요합니다.'); return; }
            try {
                const res = await fetch('/api/teams/join', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ code })
                });
                const data = await res.json();
                if (res.ok) {
                    alert(data.message);
                    joinTeamCodeInput.value = '';
                    await loadMyTeams();
                    selectActiveTeam(data.team_id);
                } else {
                    alert(data.detail || '가입에 실패했습니다. 코드를 확인하세요.');
                }
            } catch { alert('서버 오류가 발생했습니다.'); }
        });
    }

    // 저장된 문서 탭 분할 전환 리스너
    const tabPersonal = document.getElementById('tab-saved-personal');
    const tabTeam = document.getElementById('tab-saved-team');
    const panePersonal = document.getElementById('saved-personal-pane');
    const paneTeam = document.getElementById('saved-team-pane');

    if (tabPersonal && tabTeam && panePersonal && paneTeam) {
        tabPersonal.addEventListener('click', () => {
            tabPersonal.classList.add('active');
            tabTeam.classList.remove('active');
            panePersonal.style.display = 'block';
            paneTeam.style.display = 'none';
        });

        tabTeam.addEventListener('click', () => {
            tabTeam.classList.add('active');
            tabPersonal.classList.remove('active');
            panePersonal.style.display = 'none';
            paneTeam.style.display = 'block';
            loadMyTeams();
        });
    }

    // 저장된 문서 탭 팀 문서 선택 드롭다운 리스너
    const selectSavedTeam = document.getElementById('select-saved-team');
    if (selectSavedTeam) {
        selectSavedTeam.addEventListener('change', async (e) => {
            const teamId = e.target.value;
            const listEl = document.getElementById('saved-team-doc-list');
            if (!listEl) return;
            if (!teamId) {
                listEl.innerHTML = '<p class="text-muted" style="padding:16px; font-size:13px;">팀을 선택해 주세요.</p>';
                return;
            }
            listEl.innerHTML = '<div class="loading-spinner"></div>';
            const token = getToken();
            if (!token) return;
            try {
                const res = await fetch(`/api/teams/${teamId}/documents`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!res.ok) {
                    listEl.innerHTML = '<p class="text-muted" style="padding:16px; font-size:13px; color:red;">문서를 불러오지 못했습니다.</p>';
                    return;
                }
                const docs = await res.json();
                listEl.innerHTML = '';
                if (docs.length === 0) {
                    listEl.innerHTML = '<p class="text-muted" style="padding:16px; font-size:13px;">공유된 문서가 없습니다.</p>';
                    return;
                }
                docs.forEach(doc => {
                    const item = document.createElement('div');
                    item.className = 'saved-doc-item';
                    item.innerHTML = `
                        <div class="saved-doc-title">${doc.title}</div>
                        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:2px;">
                            <span>작성자: ${doc.owner_name}</span>
                            <span>${new Date(doc.created_at).toLocaleDateString('ko-KR')}</span>
                        </div>
                    `;
                    item.addEventListener('click', () => showDocPreview(doc, false));
                    listEl.appendChild(item);
                });
            } catch {
                listEl.innerHTML = '<p class="text-muted" style="padding:16px; font-size:13px; color:red;">서버 오류</p>';
            }
        });
    }

    // URL 초대 코드 파싱 및 가입 팝업 핸들러
    function handleURLJoinCode() {
        const params = new URLSearchParams(window.location.search);
        const joinCode = params.get('join_code');
        if (joinCode) {
            // 주소창 파라미터 청소
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);

            const token = getToken();
            if (!token) {
                alert(`[팀 초대] 초대 코드(${joinCode})가 감지되었습니다.\n로그인 또는 회원가입 후 팀 탭에서 코드를 입력하여 입장하세요.`);
                openAuthPanel();
                return;
            }

            setTimeout(() => {
                switchView('view-team');
                const confirmJoin = confirm(`팀 초대 코드(${joinCode})가 감지되었습니다.\n이 팀에 지금 가입하시겠습니까?`);
                if (confirmJoin) {
                    joinTeamByCode(joinCode);
                }
            }, 500);
        }
    }

    async function joinTeamByCode(code) {
        const token = getToken();
        if (!token) return;
        try {
            const res = await fetch('/api/teams/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ code })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                await loadMyTeams();
                selectActiveTeam(data.team_id);
            } else {
                alert(data.detail || '가입에 실패했습니다.');
            }
        } catch { alert('서버 오류가 발생했습니다.'); }
    }

    // ================================================================
    // SECTION 9: BILLING & PAYMENT MODAL
    // ================================================================
    const modalPayment = document.getElementById('modal-payment');
    const btnClosePayment = document.getElementById('btn-close-payment');
    const buyButtons = document.querySelectorAll('.btn-buy-tokens');
    const payPlanName = document.getElementById('pay-plan-name');
    const payPlanTokens = document.getElementById('pay-plan-tokens');
    const payPlanPrice = document.getElementById('pay-plan-price');
    const methodButtons = document.querySelectorAll('.method-btn');
    const cardFormArea = document.getElementById('card-form-area');
    const btnDoCharge = document.getElementById('btn-do-charge');
    const paymentProcessArea = document.getElementById('payment-process-area');
    const paySpinner = document.getElementById('pay-spinner');
    const payCheckmark = document.getElementById('pay-checkmark');
    const payProcessStatus = document.getElementById('pay-process-status');

    let selectedPlan = null;

    if (buyButtons.length > 0 && modalPayment) {
        buyButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const token = getToken();
                if (!token) {
                    alert('토큰을 충전하려면 먼저 로그인해야 합니다.');
                    openAuthPanel();
                    return;
                }
                
                selectedPlan = {
                    name: btn.getAttribute('data-plan'),
                    tokens: parseInt(btn.getAttribute('data-tokens')),
                    price: parseInt(btn.getAttribute('data-price'))
                };
                
                if (payPlanName) payPlanName.textContent = selectedPlan.name;
                if (payPlanTokens) payPlanTokens.textContent = `🪙 ${selectedPlan.tokens} 토큰`;
                if (payPlanPrice) payPlanPrice.textContent = `₩ ${selectedPlan.price.toLocaleString()}`;
                
                // 결제 진행 구역 리셋
                if (paymentProcessArea) paymentProcessArea.style.display = 'none';
                if (cardFormArea) cardFormArea.style.display = 'block';
                if (btnDoCharge) {
                    btnDoCharge.style.display = 'block';
                    btnDoCharge.disabled = false;
                }
                
                // 신용카드 결제를 기본으로 활성화
                methodButtons.forEach(mb => {
                    mb.classList.toggle('active', mb.getAttribute('data-method') === 'card');
                });
                
                modalPayment.classList.add('active');
            });
        });
    }

    function closePaymentModal() {
        if (modalPayment) {
            modalPayment.classList.remove('active');
        }
    }

    if (btnClosePayment) {
        btnClosePayment.addEventListener('click', closePaymentModal);
    }

    if (modalPayment) {
        modalPayment.addEventListener('click', (e) => {
            if (e.target === modalPayment) {
                closePaymentModal();
            }
        });
    }

    if (methodButtons.length > 0) {
        methodButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                methodButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const method = btn.getAttribute('data-method');
                if (method === 'card') {
                    if (cardFormArea) cardFormArea.style.display = 'block';
                } else {
                    if (cardFormArea) cardFormArea.style.display = 'none';
                }
            });
        });
    }

    if (btnDoCharge) {
        btnDoCharge.addEventListener('click', async () => {
            if (!selectedPlan) return;
            const token = getToken();
            if (!token) return;

            // 로딩 상태 시작
            btnDoCharge.disabled = true;
            if (cardFormArea) cardFormArea.style.display = 'none';
            if (btnDoCharge) btnDoCharge.style.display = 'none';
            
            if (paymentProcessArea) paymentProcessArea.style.display = 'block';
            if (paySpinner) paySpinner.style.display = 'block';
            if (payCheckmark) payCheckmark.style.display = 'none';
            if (payProcessStatus) payProcessStatus.textContent = '결제 요청을 전송하는 중...';
            
            // 모의 결제 대기 효과 (1.5초)
            setTimeout(async () => {
                if (payProcessStatus) payProcessStatus.textContent = '결제 완료 및 토큰 충전 승인 중...';
                
                try {
                    const res = await fetch('/api/payment/charge', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({
                            plan_name: selectedPlan.name,
                            token_amount: selectedPlan.tokens
                        })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        
                        // 성공 완료 표시
                        if (paySpinner) paySpinner.style.display = 'none';
                        if (payCheckmark) payCheckmark.style.display = 'block';
                        if (payProcessStatus) payProcessStatus.textContent = `결제 완료! ${selectedPlan.tokens} 토큰이 충전되었습니다.`;
                        
                        // 토큰 UI 동기화
                        updateTokensUI(data.tokens);
                        
                        // 1.5초 후 닫기
                        setTimeout(() => {
                            closePaymentModal();
                        }, 1500);
                    } else {
                        const err = await res.json();
                        alert('결제 승인 실패: ' + (err.detail || '오류 발생'));
                        // 상태 복원
                        if (paymentProcessArea) paymentProcessArea.style.display = 'none';
                        if (btnDoCharge) {
                            btnDoCharge.style.display = 'block';
                            btnDoCharge.disabled = false;
                        }
                        const activeMethod = document.querySelector('.method-btn.active');
                        if (activeMethod && activeMethod.getAttribute('data-method') === 'card') {
                            if (cardFormArea) cardFormArea.style.display = 'block';
                        }
                    }
                } catch (e) {
                    console.error(e);
                    alert('서버 연결 오류로 결제에 실패했습니다.');
                    if (paymentProcessArea) paymentProcessArea.style.display = 'none';
                    if (btnDoCharge) {
                        btnDoCharge.style.display = 'block';
                        btnDoCharge.disabled = false;
                    }
                    const activeMethod = document.querySelector('.method-btn.active');
                    if (activeMethod && activeMethod.getAttribute('data-method') === 'card') {
                        if (cardFormArea) cardFormArea.style.display = 'block';
                    }
                }
            }, 1500);
        });
    }

    // ================================================================
    // SECTION 10: USER INQUIRY SYSTEM & OPERATOR DASHBOARD
    // ================================================================
    const floatingInquiryBtn = document.getElementById('floating-inquiry-btn');
    const modalInquiry = document.getElementById('modal-inquiry');
    const btnCloseInquiry = document.getElementById('btn-close-inquiry');
    const btnSubmitInquiry = document.getElementById('btn-submit-inquiry');

    const modalInquiryDetail = document.getElementById('modal-inquiry-detail');
    const btnCloseInquiryDetail = document.getElementById('btn-close-inquiry-detail');
    const btnCloseDetailModal = document.getElementById('btn-close-detail-modal');

    const btnRefreshInquiries = document.getElementById('btn-refresh-inquiries');
    const operatorInquiryTbody = document.getElementById('operator-inquiry-tbody');

    // 1. Inquiry submission modal controls
    if (floatingInquiryBtn && modalInquiry) {
        floatingInquiryBtn.addEventListener('click', () => {
            modalInquiry.classList.add('active');
        });
    }

    function closeInquiryModal() {
        if (modalInquiry) {
            modalInquiry.classList.remove('active');
            // reset form fields
            document.getElementById('inquiry-title').value = '';
            document.getElementById('inquiry-content').value = '';
            document.getElementById('inquiry-type').value = '기능 문의';
        }
    }

    if (btnCloseInquiry) {
        btnCloseInquiry.addEventListener('click', closeInquiryModal);
    }

    if (modalInquiry) {
        modalInquiry.addEventListener('click', (e) => {
            if (e.target === modalInquiry) closeInquiryModal();
        });
    }

    // Submit inquiry
    if (btnSubmitInquiry) {
        btnSubmitInquiry.addEventListener('click', async () => {
            const type = document.getElementById('inquiry-type').value;
            const title = document.getElementById('inquiry-title').value.trim();
            const content = document.getElementById('inquiry-content').value.trim();

            if (!title || !content) {
                alert('제목과 내용을 입력해주세요.');
                return;
            }

            btnSubmitInquiry.disabled = true;
            btnSubmitInquiry.textContent = '등록 중...';

            try {
                const token = getToken();
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = 'Bearer ' + token;

                const res = await fetch('/api/inquiries', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ type, title, content })
                });

                if (res.ok) {
                    alert('문의가 성공적으로 등록되었습니다.');
                    closeInquiryModal();
                    // If the user is an operator and currently viewing the operator dashboard, refresh it
                    const isOp = localStorage.getItem('is_operator') === 'true';
                    if (isOp && document.getElementById('view-operator').classList.contains('active')) {
                        loadOperatorInquiries();
                    }
                } else {
                    const err = await res.json();
                    alert('문의 등록 실패: ' + (err.detail || '오류 발생'));
                }
            } catch (e) {
                console.error(e);
                alert('서버에 연결할 수 없습니다.');
            } finally {
                btnSubmitInquiry.disabled = false;
                btnSubmitInquiry.textContent = '문의 등록하기';
            }
        });
    }

    // 2. Operator dashboard list loading
    let loadedInquiries = [];

    async function loadOperatorInquiries() {
        const token = getToken();
        if (!token) return;

        if (operatorInquiryTbody) {
            operatorInquiryTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><div class="loading-spinner"></div></td></tr>';
        }

        try {
            const res = await fetch('/api/inquiries', {
                headers: { 'Authorization': 'Bearer ' + token }
            });

            if (res.ok) {
                loadedInquiries = await res.json();
                renderOperatorInquiries();
            } else {
                if (operatorInquiryTbody) {
                    operatorInquiryTbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;color:red;">문의 내역을 불러오지 못했습니다.</td></tr>';
                }
            }
        } catch (e) {
            console.error(e);
            if (operatorInquiryTbody) {
                operatorInquiryTbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;color:red;">서버 연결 오류</td></tr>';
            }
        }
    }

    function renderOperatorInquiries() {
        if (!operatorInquiryTbody) return;
        operatorInquiryTbody.innerHTML = '';

        if (loadedInquiries.length === 0) {
            operatorInquiryTbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align: center; padding: 30px 0;">등록된 문의 사항이 없습니다.</td></tr>';
            return;
        }

        loadedInquiries.forEach((inq, idx) => {
            const tr = document.createElement('tr');
            
            // Badge matching the type
            let badgeClass = 'type-etc';
            if (inq.type.includes('기능')) badgeClass = 'type-feature';
            else if (inq.type.includes('수정')) badgeClass = 'type-edit';
            else if (inq.type.includes('버그')) badgeClass = 'type-bug';

            const createdDate = new Date(inq.created_at).toLocaleString('ko-KR');

            tr.innerHTML = `
                <td>${loadedInquiries.length - idx}</td>
                <td><span class="inquiry-badge ${badgeClass}">${inq.type}</span></td>
                <td style="font-weight: 600;">${inq.title}</td>
                <td>${inq.displayname || inq.username}</td>
                <td class="text-muted" style="font-size:12px;">${createdDate}</td>
            `;

            tr.addEventListener('click', () => showInquiryDetails(inq));
            operatorInquiryTbody.appendChild(tr);
        });
    }

    // Details modal
    function showInquiryDetails(inq) {
        if (!modalInquiryDetail) return;
        
        document.getElementById('detail-inquiry-title').textContent = inq.title;
        document.getElementById('detail-inquiry-type').textContent = inq.type;
        document.getElementById('detail-inquiry-author').textContent = `${inq.displayname || inq.username} (${inq.username})`;
        document.getElementById('detail-inquiry-date').textContent = new Date(inq.created_at).toLocaleString('ko-KR');
        document.getElementById('detail-inquiry-content').textContent = inq.content;

        // Badge styling for details
        let badgeClass = 'type-etc';
        if (inq.type.includes('기능')) badgeClass = 'type-feature';
        else if (inq.type.includes('수정')) badgeClass = 'type-edit';
        else if (inq.type.includes('버그')) badgeClass = 'type-bug';
        
        const typeEl = document.getElementById('detail-inquiry-type');
        typeEl.className = 'inquiry-badge ' + badgeClass;

        modalInquiryDetail.classList.add('active');
    }

    function closeInquiryDetailModal() {
        if (modalInquiryDetail) {
            modalInquiryDetail.classList.remove('active');
        }
    }

    if (btnCloseInquiryDetail) btnCloseInquiryDetail.addEventListener('click', closeInquiryDetailModal);
    if (btnCloseDetailModal) btnCloseDetailModal.addEventListener('click', closeInquiryDetailModal);
    if (modalInquiryDetail) {
        modalInquiryDetail.addEventListener('click', (e) => {
            if (e.target === modalInquiryDetail) closeInquiryDetailModal();
        });
    }

    if (btnRefreshInquiries) {
        btnRefreshInquiries.addEventListener('click', loadOperatorInquiries);
    }

    // Refresh when view switches to operator tab
    const navOperatorTab = document.getElementById('nav-operator-tab');
    if (navOperatorTab) {
        navOperatorTab.addEventListener('click', () => {
            loadOperatorInquiries();
        });
    }

    // ================================================================
    // INIT
    // ================================================================
    updateNavAuthState();
    loadMyDocuments();
    loadMyTeams();
    handleURLJoinCode();

});
