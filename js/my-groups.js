SS.myGroupsPage = {
    init() {
        if (!SS.requireAuth())
            return;
        SS.navigation.render();
        const u = SS.currentUser();
        const groups = SS.groups.userGroups(u.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        document.getElementById('groupsCount').textContent = groups.length;
        SS.render.groupCards(groups, document.getElementById('allGroupsList'));
    }
};

