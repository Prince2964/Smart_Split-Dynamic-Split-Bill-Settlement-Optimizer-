SS.invitations = {
    EXPIRATION_DAYS: 7,
    _normalize(list) {
        const now = Date.now();
        let changed = false;
        list.forEach(inv => {
            if (!inv.createdAt) {
                inv.createdAt = SS.now();
                changed = true;
            }
            if (!inv.expiresAt) {
                const created = new Date(inv.createdAt).getTime();
                if (Number.isFinite(created)) {
                    inv.expiresAt = new Date(created + this.EXPIRATION_DAYS * 86400000).toISOString();
                    changed = true;
                }
            }
            if (inv.status === 'pending' && inv.expiresAt) {
                const expires = new Date(inv.expiresAt).getTime();
                if (Number.isFinite(expires) && expires <= now) {
                    inv.status = 'expired';
                    inv.expiredAt = inv.expiredAt || SS.now();
                    changed = true;
                }
            }
        });
        if (changed)
            SS.storage.replaceInvitations(list);
        return list;
    },
    create(groupId, name, email) {
        const group = SS.group(groupId);
        const user = SS.currentUser();
        if (!group || !user)
            throw new Error('Group or user unavailable.');
        // Authorization is enforced here, not only by the Invite button in the UI.
        if (group.creator !== user.id)
            throw new Error('Only the group admin can send invitations.');
        const cleanName = String(name || '').trim();
        const normalized = String(email || '').trim().toLowerCase();
        if (!cleanName)
            throw new Error('Enter the member name.');
        if (!/^\S+@\S+\.\S+$/.test(normalized))
            throw new Error('Enter a valid email address.');
        if (normalized === user.email)
            throw new Error('You are already a member of this group.');
        if (group.members.some(m => String(m.email || '').toLowerCase() === normalized && m.status !== 'removed')) {
            throw new Error('This person is already a member.');
        }
        const list = this._normalize(SS.storage.invitations());
        const existing = list.find(i => i.groupId === groupId && i.email === normalized && i.status === 'pending');
        if (existing)
            throw new Error('A pending invitation already exists for this email.');
        const createdAt = SS.now();
        const invitation = {
            id: SS.uid('INV'),
            token: Math.random().toString(36).slice(2, 8).toUpperCase(),
            groupId,
            name: cleanName,
            email: normalized,
            invitedBy: user.id,
            invitedByName: user.name,
            status: 'pending',
            createdAt,
            expiresAt: new Date(Date.now() + this.EXPIRATION_DAYS * 86400000).toISOString()
        };
        list.push(invitation);
        SS.storage.replaceInvitations(list);
        return invitation;
    },
    async send(invitation) {
        // Phase 1 mock only. Phase 2 replacement: POST /api/invitations.
        return { ok: true, invitation };
    },
    forUser(email, status = null) {
        const normalized = String(email || '').trim().toLowerCase();
        const list = this._normalize(SS.storage.invitations());
        const result = list.filter(i => String(i.email || '').toLowerCase() === normalized);
        return status ? result.filter(i => i.status === status) : result;
    },
    sentBy(userId, status = null) {
        const list = this._normalize(SS.storage.invitations());
        const result = list.filter(i => i.invitedBy === userId);
        return status ? result.filter(i => i.status === status) : result;
    },
    byToken(token) {
        const list = this._normalize(SS.storage.invitations());
        return list.find(i => i.token === token) || null;
    },
    isExpired(invitation) {
        if (!invitation?.expiresAt)
            return false;
        const time = new Date(invitation.expiresAt).getTime();
        return Number.isFinite(time) && time <= Date.now();
    },
    accept(id) {
        const user = SS.currentUser();
        if (!user)
            throw new Error('Log in with the invited email first.');
        const list = this._normalize(SS.storage.invitations());
        const invitation = list.find(i => i.id === id);
        if (!invitation)
            throw new Error('Invitation not found.');
        if (invitation.email !== user.email)
            throw new Error(`Log in as ${invitation.email} to accept this invitation.`);
        if (invitation.status === 'pending' && this.isExpired(invitation)) {
            invitation.status = 'expired';
            invitation.expiredAt = SS.now();
            SS.storage.replaceInvitations(list);
        }
        if (invitation.status !== 'pending')
            throw new Error(`This invitation is ${invitation.status}.`);
        const group = SS.group(invitation.groupId);
        if (!group)
            throw new Error('Group no longer exists.');
        SS.groups.addMember(group.id, user);
        invitation.status = 'accepted';
        invitation.acceptedBy = user.id;
        invitation.acceptedAt = SS.now();
        SS.storage.replaceInvitations(list);
        return SS.group(group.id);
    },
    decline(id) {
        const user = SS.currentUser();
        const list = this._normalize(SS.storage.invitations());
        const invitation = list.find(i => i.id === id);
        if (!invitation)
            throw new Error('Invitation not found.');
        if (!user || invitation.email !== user.email)
            throw new Error(`Log in as ${invitation.email} to manage this invitation.`);
        if (invitation.status === 'pending' && this.isExpired(invitation)) {
            invitation.status = 'expired';
            invitation.expiredAt = SS.now();
            SS.storage.replaceInvitations(list);
            throw new Error('This invitation has expired.');
        }
        if (invitation.status !== 'pending')
            throw new Error(`This invitation is ${invitation.status}.`);
        invitation.status = 'declined';
        invitation.declinedAt = SS.now();
        SS.storage.replaceInvitations(list);
        return invitation;
    }
};

