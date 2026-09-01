document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    const map = {
        landing: () => SS.landingPage.init(),
        login: () => SS.authPages.init(),
        signup: () => SS.authPages.init(),
        dashboard: () => SS.dashboardPage.init(),
        'my-groups': () => SS.myGroupsPage.init(),
        invitations: () => SS.invitationsPage.init(),
        'create-group': () => SS.createGroupPage.init(),
        group: () => SS.groupPage.init(SS.query('id')),
        invitation: () => SS.invitationPage.init()
    };
    map[page]?.();
});

