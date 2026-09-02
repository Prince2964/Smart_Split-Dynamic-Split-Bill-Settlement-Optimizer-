SS.invitationsPage = {
    init() {
        if (!SS.requireAuth())
            return;
        SS.navigation.render();
        this.render();
    },
    render() {
        const u = SS.currentUser();
        const incoming = SS.invitations.forUser(u.email);
        const sent = SS.invitations.sentBy(u.id);
        document.getElementById('receivedCount').textContent = incoming.filter(i => i.status === 'pending').length;
        document.getElementById('sentCount').textContent = sent.filter(i => i.status === 'pending').length;
        SS.render.invitations(incoming, sent, document.getElementById('invitationsList'));
    }
};

