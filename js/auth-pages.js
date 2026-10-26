
SS.authPages = {
    init() {
        if (!SS.requireGuest()) return;

        const signup = document.getElementById("signupForm");

        if (signup) {
            signup.addEventListener("submit", async event => {
                event.preventDefault();

                const data = Object.fromEntries(
                    new FormData(signup)
                );

                const errorBox = document.getElementById("formError");
                errorBox.textContent = "";

                if (data.name.trim().length < 2) {
                    errorBox.textContent =
                        "Please enter your full name.";
                    return;
                }

                if (data.password.length < 8) {
                    errorBox.textContent =
                        "Password must be at least 8 characters.";
                    return;
                }

                if (data.password !== data.confirmPassword) {
                    errorBox.textContent =
                        "Passwords do not match.";
                    return;
                }

                const button = signup.querySelector(
                    'button[type="submit"]'
                );
                button.disabled = true;

                try {
                    const user = await SS.auth.register(data);

                    const next = SS.query("next");
                    const loginUrl = next
                        ? `login.html?next=${encodeURIComponent(next)}`
                        : "login.html";

                    const panel = signup.closest(".auth-content")
                        || signup.parentElement;

                    panel.innerHTML = `
                        <div class="account-success">
                            <div class="success-check">✓</div>
                            <span class="eyebrow">Account created</span>
                            <h2>You're all set, ${
                                SS.escape(user.name.split(" ")[0])
                            }.</h2>
                            <p class="muted">
                                Your account was saved successfully.
                                Continue to log in.
                            </p>
                            <a class="btn btn-primary" href="${loginUrl}">
                                Continue to Login →
                            </a>
                        </div>`;
                } catch (error) {
                    errorBox.textContent = error.message;
                    button.disabled = false;
                }
            });
        }

        const login = document.getElementById("loginForm");

        if (login) {
            login.addEventListener("submit", async event => {
                event.preventDefault();

                const data = Object.fromEntries(
                    new FormData(login)
                );

                const errorBox = document.getElementById("formError");
                errorBox.textContent = "";

                const button = login.querySelector(
                    'button[type="submit"]'
                );
                button.disabled = true;

                try {
                    await SS.auth.login(
                        data.email,
                        data.password
                    );

                    const next = SS.query("next");
                    location.href = next || "dashboard.html";
                } catch (error) {
                    errorBox.textContent = error.message;
                    button.disabled = false;
                }
            });
        }
    }
};
