
SS.myGroupsPage = {
    state: {
        search: "",
        purpose: "all",
        sort: "recent"
    },

    init() {
        if (!SS.requireAuth()) return;

        SS.navigation.render();
        this.bind();
        this.loadGroups();
    },

    async loadGroups() {
        const host = document.getElementById("allGroupsList");
        if (host) {
            host.innerHTML = '<div class="empty-state"><p>Loading groups...</p></div>';
        }

        try {
            const response = await SS.api.request("/groups");

            const groups = (response.groups || []).map(
                group => SS.groups.fromApi(group)
            );

            SS.storage.replaceGroups(groups);
            this.render();
        } catch (error) {
            console.error("Could not load groups:", error);

            if (host) {
                host.innerHTML = `
                    <div class="empty-state">
                        <h3>Could not load groups</h3>
                        <p>${SS.escape(error.message)}</p>
                        <button type="button" id="retryGroups">
                            Try again
                        </button>
                    </div>
                `;

                document.getElementById("retryGroups")
                    ?.addEventListener("click", () => this.loadGroups());
            }
        }
    },

    groups() {
        return SS.storage.groups();
    },

    filteredGroups() {
        const search = this.state.search.trim().toLowerCase();
        const purpose = this.state.purpose;

        const groups = this.groups().filter(group => {
            const type = SS.label(group.purpose).toLowerCase();

            return (
                (!search ||
                    `${group.name} ${type}`.toLowerCase().includes(search)) &&
                (purpose === "all" || group.purpose === purpose)
            );
        });

        groups.sort((a, b) => {
            if (this.state.sort === "az") {
                return a.name.localeCompare(b.name);
            }

            if (this.state.sort === "za") {
                return b.name.localeCompare(a.name);
            }

            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return groups;
    },

    bind() {
        document.getElementById("groupSearch")
            ?.addEventListener("input", event => {
                this.state.search = event.target.value;
                this.render();
            });

        document.getElementById("groupTypeFilter")
            ?.addEventListener("change", event => {
                this.state.purpose = event.target.value;
                this.render();
            });

        document.getElementById("groupSort")
            ?.addEventListener("change", event => {
                this.state.sort = event.target.value;
                this.render();
            });

        document.getElementById("clearGroupFilters")
            ?.addEventListener("click", () => {
                this.state = {
                    search: "",
                    purpose: "all",
                    sort: "recent"
                };

                const search = document.getElementById("groupSearch");
                if (search) search.value = "";

                const type = document.getElementById("groupTypeFilter");
                if (type) type.value = "all";

                const sort = document.getElementById("groupSort");
                if (sort) sort.value = "recent";

                this.render();
                SS.notifications.info("Filters cleared");
            });
    },

    render() {
        const all = this.groups();
        const groups = this.filteredGroups();

        const count = document.getElementById("groupsCount");
        const host = document.getElementById("allGroupsList");

        if (!host || !count) return;

        count.textContent = all.length;

        if (!groups.length && all.length) {
            host.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⌕</div>
                    <h3>No groups found</h3>
                    <p>Try changing your search or filters.</p>
                </div>
            `;
            return;
        }

        SS.render.groupCards(groups, host);
    }
};
