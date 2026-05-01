// ========== script.js ==========
(function() {
    // Google Drive API credentials
    const CLIENT_ID = '313958815059-m8m1t0g29ittf223gdj3nlfb3uv030he.apps.googleusercontent.com';
    const CLIENT_SECRET = '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';
    const REFRESH_TOKEN = '1//04kD2s8SvhjxZCgYIARAAGAQSNwF-L9IropCH-lC7siDNmuQ3yKvcNXF1GtTje7-dnd-SEUDIC9LuyYfXe1DUV0sQiOTA2nOdfcs';
    const FOLDER_NAME = 'UserData';

    // DOM references
    const themeSwitch = document.getElementById('themeSwitch');
    const htmlElement = document.documentElement;
    const toggleIcon = document.getElementById('toggleIcon');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const navLinks = document.querySelectorAll('.nav-links a');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-menu a');
    const currentYearSpan = document.getElementById('currentYear');

    // Auth UI
    const authButtons = document.getElementById('authButtons');
    const userGreeting = document.getElementById('userGreeting');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    const logoutLink = document.getElementById('logoutLink');
    const authModal = document.getElementById('authModal');
    const closeModal = document.getElementById('closeModal');
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginMessage = document.getElementById('loginMessage');
    const signupMessage = document.getElementById('signupMessage');

    // Set footer year
    if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();

    // ============ THEME ============
    const THEME_KEY = 'ikizamini-theme-preference';

    function applyTheme(theme) {
        htmlElement.setAttribute('data-theme', theme);
        themeSwitch.checked = (theme === 'dark');
        toggleIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        try { localStorage.setItem(THEME_KEY, theme); } catch(e) {}
    }

    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme) applyTheme(storedTheme);
    else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
    }

    themeSwitch.addEventListener('change', () => applyTheme(themeSwitch.checked ? 'dark' : 'light'));

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem(THEME_KEY)) applyTheme(e.matches ? 'dark' : 'light');
    });

    // ============ MOBILE MENU ============
    function openMobileMenu() {
        hamburgerBtn.classList.add('active');
        mobileMenu.classList.add('active');
        mobileOverlay.classList.add('active');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
        hamburgerBtn.classList.remove('active');
        mobileMenu.classList.remove('active');
        mobileOverlay.classList.remove('active');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    hamburgerBtn.addEventListener('click', () => {
        hamburgerBtn.classList.contains('active') ? closeMobileMenu() : openMobileMenu();
    });
    mobileOverlay.addEventListener('click', closeMobileMenu);

    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            closeMobileMenu();
            updateActiveNavLink(link.getAttribute('data-section'));
        });
    });

    function updateActiveNavLink(section) {
        [...navLinks, ...mobileNavLinks].forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-section') === section) link.classList.add('active');
        });
    }

    navLinks.forEach(link => link.addEventListener('click', (e) => {
        updateActiveNavLink(link.getAttribute('data-section'));
    }));

    // Scroll spy
    const sections = document.querySelectorAll('section[id], .hero[id]');
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
        scrollTimeout = requestAnimationFrame(() => {
            let current = 'ahabanza';
            const scrollPos = window.scrollY + 120;
            sections.forEach(section => {
                if (scrollPos >= section.offsetTop && scrollPos < section.offsetTop + section.offsetHeight) {
                    current = section.getAttribute('id');
                }
            });
            updateActiveNavLink(current);
        });
    }, { passive: true });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && hamburgerBtn.classList.contains('active')) closeMobileMenu();
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && hamburgerBtn.classList.contains('active')) closeMobileMenu();
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const navHeight = document.querySelector('.navbar').offsetHeight;
                window.scrollTo({
                    top: target.offsetTop - navHeight - 16,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ============ AUTHENTICATION UI ============
    function updateAuthUI() {
        const user = JSON.parse(localStorage.getItem('ikizamini_user'));
        if (user && user.email) {
            authButtons.style.display = 'none';
            userGreeting.style.display = 'flex';
            userNameDisplay.textContent = user.name;
        } else {
            authButtons.style.display = 'flex';
            userGreeting.style.display = 'none';
        }
    }

    loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        openModal('login');
    });

    signupLink.addEventListener('click', (e) => {
        e.preventDefault();
        openModal('signup');
    });

    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('ikizamini_user');
        updateAuthUI();
        closeModalWindow();
    });

    closeModal.addEventListener('click', closeModalWindow);
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeModalWindow();
    });

    tabLogin.addEventListener('click', () => switchTab('login'));
    tabSignup.addEventListener('click', () => switchTab('signup'));

    function openModal(tab) {
        authModal.classList.add('active');
        switchTab(tab);
    }

    function closeModalWindow() {
        authModal.classList.remove('active');
    }

    function switchTab(tab) {
        if (tab === 'login') {
            tabLogin.classList.add('active');
            tabSignup.classList.remove('active');
            loginForm.classList.add('active');
            signupForm.classList.remove('active');
        } else {
            tabSignup.classList.add('active');
            tabLogin.classList.remove('active');
            signupForm.classList.add('active');
            loginForm.classList.remove('active');
        }
    }

    // ============ GOOGLE DRIVE API ============
    async function getAccessToken() {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                refresh_token: REFRESH_TOKEN
            })
        });
        if (!response.ok) throw new Error('Failed to obtain access token');
        const data = await response.json();
        return data.access_token;
    }

    async function getFolderId(accessToken) {
        const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json();
        return data.files && data.files.length > 0 ? data.files[0].id : null;
    }

    async function createFolder(accessToken) {
        const metadata = { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' };
        const res = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });
        const data = await res.json();
        return data.id;
    }

    async function findFileByName(accessToken, folderId, fileName) {
        const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json();
        return data.files && data.files.length > 0 ? data.files[0].id : null;
    }

    async function createUserFile(accessToken, folderId, userData) {
        const fileName = `${userData.email.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        const fileContent = JSON.stringify(userData);
        const metadata = { name: fileName, parents: [folderId] };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form
        });
        return res.json();
    }

    async function readFileContent(accessToken, fileId) {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!res.ok) throw new Error('File not found');
        return res.json();
    }

    // ============ AUTH HANDLERS ============
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginMessage.textContent = '';
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        if (!email || !password) {
            loginMessage.textContent = 'Nyamuneka uzuza email na password.';
            return;
        }
        try {
            const token = await getAccessToken();
            const folderId = await getFolderId(token);
            if (!folderId) throw new Error('Nta bushyinguro bwabonetse.');
            const fileName = `${email.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
            const fileId = await findFileByName(token, folderId, fileName);
            if (!fileId) throw new Error('Konti ntabwo ibaho.');
            const user = await readFileContent(token, fileId);
            if (user.password === password) {
                const sessionUser = { name: user.name, email: user.email };
                localStorage.setItem('ikizamini_user', JSON.stringify(sessionUser));
                updateAuthUI();
                closeModalWindow();
                document.getElementById('loginEmail').value = '';
                document.getElementById('loginPassword').value = '';
                loginMessage.textContent = '';
            } else {
                loginMessage.textContent = 'Ijambobanga cyangwa email sibyo.';
            }
        } catch (err) {
            loginMessage.textContent = 'Byanze: ' + err.message;
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        signupMessage.textContent = '';
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const phone = document.getElementById('signupPhone').value.trim();
        const password = document.getElementById('signupPassword').value.trim();
        if (!name || !email || !phone || !password) {
            signupMessage.textContent = 'Nyamuneka uzuza ibisabwa byose.';
            return;
        }
        try {
            const token = await getAccessToken();
            let folderId = await getFolderId(token);
            if (!folderId) folderId = await createFolder(token);
            const fileName = `${email.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
            const existingFileId = await findFileByName(token, folderId, fileName);
            if (existingFileId) throw new Error('Email irahari, koresha indi.');
            const userData = { name, email, phone, password };
            await createUserFile(token, folderId, userData);
            signupMessage.textContent = 'Kwiyandikisha byagenze neza! Injira ubu.';
            document.getElementById('signupName').value = '';
            document.getElementById('signupEmail').value = '';
            document.getElementById('signupPhone').value = '';
            document.getElementById('signupPassword').value = '';
            setTimeout(() => switchTab('login'), 1500);
        } catch (err) {
            signupMessage.textContent = 'Byanze: ' + err.message;
        }
    });

    // Initial auth UI state
    updateAuthUI();

    console.log('Ikizamini - Modular version with authentication ready.');
})();
