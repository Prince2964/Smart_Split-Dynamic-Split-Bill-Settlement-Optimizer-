SS.invitationPage = {
    init() {
        const token = SS.query('token');
        const invitation = SS.invitations.byToken(token);
        const root = document.getElementById('inviteRoot');
        SS.navigation.render();
        if (!invitation) {
            root.innerHTML = '<div class="panel empty-state"><h3>Invitation not found</h3><p>This demo invitation may be invalid or expired.</p></div>';
            return;
        }
        const group = SS.group(invitation.groupId);
        const user = SS.currentUser();
        if (!group) {
            root.innerHTML = '<div class="panel empty-state"><h3>Group no longer exists</h3></div>';
            return;
        }
        const expired = invitation.status === 'expired' || SS.invitations.isExpired(invitation);
        if (expired && invitation.status === 'pending') {
            const list = SS.storage.invitations();
            const current = list.find(i => i.id === invitation.id);
            if (current) {
                current.status = 'expired';
                current.expiredAt = current.expiredAt || SS.now();
                SS.storage.replaceInvitations(list);
                invitation.status = 'expired';
            }
        }
        const canAct = Boolean(user && user.email === invitation.email && invitation.status === 'pending' && !expired);
        const statusMessage = invitation.status === 'expired'
            ? '<div class="danger-message">This invitation has expired. Ask the group admin to send a new invitation.</div>'
            : invitation.status === 'accepted'
                ? '<div class="success-message">This invitation has already been accepted.</div>'
                : invitation.status === 'declined'
                    ? '<div class="danger-message">This invitation was declined.</div>'
                    : '';
        root.innerHTML = `<div class="invite-page-card"><div class="invite-hero-icon">✉</div><span class="eyebrow">SplitSmart invitation</span><h1>You’re invited to join <span>${SS.escape(group.name)}</span></h1><p>${SS.escape(invitation.invitedByName)} invited <b>${SS.escape(invitation.name)}</b> to join this ${SS.label(group.purpose).toLowerCase()} group.</p><div class="invite-group-preview"><div><img class="invite-group-thumb" src="${SS.escape(SS.thumbnail(group))}" alt=""></div><div><span class="purpose-badge ${SS.escape(group.purpose)}">${SS.label(group.purpose)}</span><h3>${SS.escape(group.name)}</h3><p>${SS.groups.activeMembers(group).length} active members · ${SS.escape(group.creatorName)} created this group</p></div></div>${statusMessage}${user ? `<div class="invite-login-match ${user.email === invitation.email ? 'matched' : 'mismatch'}">${user.email === invitation.email ? '✓ You are logged in with the invited email.' : '! This invitation is for ' + SS.escape(invitation.email) + ', but you are logged in as ' + SS.escape(user.email) + '.'}</div><div class="hero-actions centered"><button class="btn btn-primary" id="acceptInvite" ${canAct ? '' : 'disabled'}>Accept Invitation</button><button class="btn btn-soft" id="declineInvite" ${canAct ? '' : 'disabled'}>Decline</button></div>` : `<div class="notice">Create an account or log in using <b>${SS.escape(invitation.email)}</b> to accept this invitation.</div><div class="hero-actions centered"><a class="btn btn-primary" href="signup.html?next=${encodeURIComponent('invitation.html?token=' + invitation.token)}">Create Account</a><a class="btn btn-soft" href="login.html?next=${encodeURIComponent('invitation.html?token=' + invitation.token)}">Login</a></div>`}<div id="inviteMessage"></div></div>`;
        document.getElementById('acceptInvite')?.addEventListener('click', () => {
            try {
                const acceptedGroup = SS.invitations.accept(invitation.id);
                document.getElementById('inviteMessage').innerHTML = '<div class="success-message">✓ Invitation accepted. You are now a group member.</div><a class="btn btn-primary" href="group.html?id=' + encodeURIComponent(acceptedGroup.id) + '">Open Group →</a>';
            }
            catch (x) {
                SS.toast(x.message);
            }
        });
        document.getElementById('declineInvite')?.addEventListener('click', () => {
            try {
                SS.invitations.decline(invitation.id);
                document.getElementById('inviteMessage').innerHTML = '<div class="danger-message">Invitation declined.</div>';
            }
            catch (x) {
                SS.toast(x.message);
            }
        });
    }
};

