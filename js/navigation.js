SS.navigation = {
    render() {
        const host = document.getElementById('siteNav');
        if (!host)
            return;
        const user = SS.currentUser();
        // The product navigation is intentionally visible to everyone.
        // Protected destinations perform the auth check when opened.
        const links = `
      <a href="dashboard.html" data-nav="dashboard">Dashboard</a>
      <a href="my-groups.html" data-nav="groups">My Groups</a>
      <a href="invitations.html" data-nav="invitations">Invitations</a>
      <a href="create-group.html" data-nav="create">Create Group</a>
    `;
        const actions = user
            ? `
          <span class="nav-user">
            <span class="avatar">${SS.initials(user.name)}</span>
            <span>${SS.escape(user.name.split(' ')[0])}</span>
          </span>
          <button class="btn btn-soft btn-sm" id="logoutBtn">Logout</button>
        `
            : `
          <a class="btn btn-soft btn-sm" href="login.html">Login</a>
          <a class="btn btn-primary btn-sm" href="signup.html">Sign Up</a>
        `;
        host.innerHTML = `
      <div class="container nav-inner" id="navInner">
        <a class="brand" href="index.html" aria-label="SplitSmart home">
          <span class="brand-mark">S</span>
          <span>SplitSmart</span>
        </a>
        <button class="mobile-toggle" id="mobileToggle" aria-label="Open navigation">☰</button>
        <nav class="nav-links">${links}</nav>
        <div class="nav-actions">${actions}</div>
      </div>`;
        const page = document.body.dataset.page;
        const activeMap = { dashboard: 'dashboard', 'my-groups': 'groups', invitations: 'invitations', 'create-group': 'create' };
        const active = activeMap[page];
        host.querySelector(`[data-nav="${active}"]`)?.classList.add('active');
        document.getElementById('logoutBtn')?.addEventListener('click', () => SS.auth.logout());
        document.getElementById('mobileToggle')?.addEventListener('click', () => {
            document.getElementById('navInner')?.classList.toggle('menu-open');
        });
    }
};

