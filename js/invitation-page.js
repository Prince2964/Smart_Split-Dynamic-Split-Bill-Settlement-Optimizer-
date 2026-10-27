
SS.invitationPage = {
    async init() {
        const token = SS.query("token");
        const root = document.getElementById("inviteRoot");

        SS.navigation.render();

        if (!token) {
            this.showError(root, "Invitation link is missing its token.");
            return;
        }

        root.innerHTML =
            '<div class="panel empty-state">Loading invitation...</div>';

        try {
            const data = await SS.api.request(
                `/groups/invitation/${encodeURIComponent(token)}`
            );

            const invitation = data.invitation;
            const group = data.group;
            const user = SS.currentUser();

            root.innerHTML = `
                <div class="invite-page-card">
                    <div class="invite-hero-icon">✉</div>
                    <span class="eyebrow">SplitSmart invitation</span>
                    <h1>You're invited to join
                        <span>${SS.escape(group.name)}</span>
                    </h1>

                    <p>${SS.escape(group.creatorName)}
                    invited you to join this group.</p>

                    <div class="invite-group-preview">
                        <div>
                            <h3>${SS.escape(group.name)}</h3>
                            <p>${Number(group.memberCount)} active members</p>
                            <p>${SS.escape(group.description || "")}</p>
                        </div>
                    </div>

                    <div class="notice">
                        Invitation for
                        <b>${SS.escape(invitation.email || "any account")}</b>
                    </div>

                    <div id="inviteMessage"></div>

                    ${
                        user
                            ? `
                                <p>Logged in as:
                                    <b>${SS.escape(user.email || "")}</b>
                                </p>
                                <button class="btn btn-primary"
                                    id="acceptInvite">
                                    Accept Invitation
                                </button>
                            `
                            : `
                                <p>Log in or create an account to accept
                                this invitation.</p>
                                <div class="hero-actions centered">
                                    <a class="btn btn-primary"
                                       href="signup.html?next=${encodeURIComponent(
                                           "invitation.html?token=" + token
                                       )}">Create Account</a>

                                    <a class="btn btn-soft"
                                       href="login.html?next=${encodeURIComponent(
                                           "invitation.html?token=" + token
                                       )}">Login</a>
                                </div>
                            `
                    }
                </div>
            `;

            document.getElementById("acceptInvite")
                ?.addEventListener("click", async () => {
                    const button =
                        document.getElementById("acceptInvite");
                    const message =
                        document.getElementById("inviteMessage");

                    button.disabled = true;
                    message.textContent = "Joining group...";

                    try {
                        const result = await SS.api.request(
                            "/groups/join",
                            {
                                method: "POST",
                                body: JSON.stringify({ token })
                            }
                        );

                        message.innerHTML =
                            '<div class="success-message">' +
                            'Invitation accepted! You joined the group.' +
                            '</div>';

                        window.location.href =
                            "group.html?id=" +
                            encodeURIComponent(result.groupId);
                    } catch (error) {
                        message.textContent = error.message;
                        button.disabled = false;
                    }
                });

        } catch (error) {
            this.showError(root, error.message);
        }
    },

    showError(root, message) {
        root.innerHTML = `
            <div class="panel empty-state">
                <h3>Invitation unavailable</h3>
                <p>${SS.escape(message)}</p>
                <p>Ask the group admin to send a new invitation
                if the link has expired or already been used.</p>
            </div>
        `;
    }
};
