SS.authPages = {
    init() {
        if (!SS.requireGuest())
            return;
        const signup = document.getElementById('signupForm');
        if (signup) {
            signup.addEventListener('submit', e => {
                e.preventDefault();
                const d = Object.fromEntries(new FormData(signup));
                const err = document.getElementById('formError');
                err.textContent = '';
                if (d.name.trim().length < 2)
                    return err.textContent = 'Please enter your full name.';
                if (!/^\S+@\S+\.\S+$/.test(d.email))
                    return err.textContent = 'Enter a valid email address.';
                if (d.password.length < 6)
                    return err.textContent = 'Password must be at least 6 characters.';
                if (d.password !== d.confirmPassword)
                    return err.textContent = 'Passwords do not match.';
                try {
                    const user = SS.auth.register(d);
                    const next = SS.query('next');
                    const loginUrl = next
                        ? `login.html?next=${encodeURIComponent(next)}`
                        : 'login.html';
                    // Replace the form with a clear success state before moving to Login.
                    const panel = signup.closest('.auth-content') || signup.parentElement;
                    panel.innerHTML = `
            <div class="account-success">
              <div class="success-check">✓</div>
              <span class="eyebrow">Account created</span>
              <h2>You're all set, ${SS.escape(user.name.split(' ')[0])}.</h2>
              <p class="muted">Your SplitSmart account was created successfully. Taking you to Login so you can continue.</p>
              <div class="success-progress"><span></span></div>
              <a class="btn btn-primary" href="${loginUrl}">Continue to Login →</a>
            </div>`;
                    // Short pause lets the user actually see the confirmation.
                    setTimeout(() => { location.href = loginUrl; }, 1400);
                }
                catch (x) {
                    err.textContent = x.message;
                }
            });
        }
        const login = document.getElementById('loginForm');
        if (login) {
            login.addEventListener('submit', e => {
                e.preventDefault();
                const d = Object.fromEntries(new FormData(login));
                const err = document.getElementById('formError');
                err.textContent = '';
                try {
                    SS.auth.login(d.email, d.password);
                    // Return the user to the page they originally wanted.
                    // Example: Start a Trip → Signup → Login → Create Group.
                    const next = SS.query('next');
                    const destination = next || 'dashboard.html';
                    location.href = destination;
                }
                catch (x) {
                    err.textContent = x.message;
                }
            });
        }
    }
};

