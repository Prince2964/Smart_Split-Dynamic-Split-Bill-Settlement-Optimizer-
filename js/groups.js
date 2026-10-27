SS.groups = {
    
    fromApi(apiGroup) {
        const user = SS.currentUser();

        const members = (apiGroup.members || []).map(member => {
            const populated = typeof member === "object" && member !== null;

            const userId = String(
                populated ? member._id || member.id : member
            );

            return {
                userId,
                name: populated
                    ? member.name || "Member"
                    : userId === user?.id ? user.name : "Member",
                email: populated
                    ? member.email || ""
                    : userId === user?.id ? user.email : "",
                status: "accepted",
                joinedAt: apiGroup.createdAt || ""
            };
        });

        const creatorId = String(
            apiGroup.createdBy?._id ||
            apiGroup.createdBy?.id ||
            apiGroup.createdBy
        );

        return {
            id: String(apiGroup._id || apiGroup.id),
            name: apiGroup.name,
            purpose: apiGroup.purpose || "custom",
            creator: creatorId,
            creatorName: apiGroup.createdBy?.name ||
                (creatorId === user?.id ? user.name : "Group admin"),
            createdAt: apiGroup.createdAt,
            thumbnail: apiGroup.thumbnail || "",
            members,
            expenses: [],
            settlementStatuses: apiGroup.settlementStatuses
                ? (typeof apiGroup.settlementStatuses.toJSON === "function"
                    ? apiGroup.settlementStatuses.toJSON()
                    : apiGroup.settlementStatuses)
                : {},
            budget: {
                total: Number(apiGroup.budget?.total) || 0,
                categories: {
                    "Travel": Number(apiGroup.budget?.categories?.Travel) || 0,
                    "Hotel / Stay": Number(apiGroup.budget?.categories?.["Hotel / Stay"]) || 0,
                    "Food": Number(apiGroup.budget?.categories?.Food) || 0,
                    "Activities": Number(apiGroup.budget?.categories?.Activities) || 0
                }
            },
            meta: {
                ...(apiGroup.meta || {}),
                description: apiGroup.meta?.description || apiGroup.description || ""
            }
        };
    },

    async createRemote(data) {
        const user = SS.currentUser();

        if (!user) {
            throw new Error("Please log in.");
        }

        this.validate(data);

        const budget = data.budget || {};

        const response = await SS.api.request("/groups", {
            method: "POST",
            body: JSON.stringify({
                name: String(data.name || "").trim(),
                purpose: data.purpose,
                description: String(data.description || "").trim(),
                thumbnail: data.thumbnail || "",
                budget: {
                    total: Number(budget.total) || 0,
                    categories: budget.categories || {}
                },
                meta: {
                    destination: data.destination || "",
                    startDate: data.startDate || "",
                    endDate: data.endDate || "",
                    address: data.address || "",
                    description: data.description || "",
                    customPurpose: data.customPurpose || ""
                }
            })
        });

        if (!response.group) {
            throw new Error("The server did not return the created group.");
        }

        const group = this.fromApi(response.group);

        const groups = SS.storage.groups().filter(
            existing => existing.id !== group.id
        );

        groups.push(group);
        SS.storage.replaceGroups(groups);

        return group;
    },

    validate(data = {}) {
        const name = String(data.name || '').trim();
        const purpose = String(data.purpose || '').trim();
        if (!name)
            throw new Error('Enter a group name.');
        if (!['trip', 'household', 'custom'].includes(purpose))
            throw new Error('Choose a valid group type.');
        if (purpose === 'trip') {
            const start = String(data.startDate || '').trim();
            const end = String(data.endDate || '').trim();
            if ((start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) || (end && !/^\d{4}-\d{2}-\d{2}$/.test(end))) {
                throw new Error('Please enter valid trip dates.');
            }
            if (start && end && start > end)
                throw new Error('End date cannot be before start date.');
        }
        return true;
    },
    create(data) {
        const user = SS.currentUser();
        if (!user)
            throw new Error('Please log in.');
        this.validate(data);
        const now = SS.now();
        const group = {
            id: SS.uid('GRP'),
            name: String(data.name).trim(),
            purpose: data.purpose,
            creator: user.id,
            creatorName: user.name,
            createdAt: now,
            thumbnail: data.thumbnail || '',
            members: [{ userId: user.id, name: user.name, email: user.email, status: 'accepted', joinedAt: now }],
            expenses: [],
            settlementStatuses: {},
            budget: data.budget ? {
                total: Number(data.budget.total) || 0,
                categories: {
                    'Travel': Number(data.budget.categories?.['Travel']) || 0,
                    'Hotel / Stay': Number(data.budget.categories?.['Hotel / Stay']) || 0,
                    'Food': Number(data.budget.categories?.['Food']) || 0,
                    'Activities': Number(data.budget.categories?.['Activities']) || 0
                }
            } : {
                total: 0,
                categories: {
                    'Travel': 0,
                    'Hotel / Stay': 0,
                    'Food': 0,
                    'Activities': 0
                }
            },
            meta: {
                destination: String(data.destination || '').trim(),
                startDate: data.startDate || '',
                endDate: data.endDate || '',
                address: String(data.address || '').trim(),
                description: String(data.description || '').trim(),
                customPurpose: String(data.customPurpose || '').trim()
            }
        };
        const groups = SS.storage.groups();
        groups.push(group);
        SS.storage.replaceGroups(groups);
        return group;
    },
    update(group) {
        if (!group?.id)
            throw new Error('Invalid group.');
        this.validate({
            name: group.name,
            purpose: group.purpose,
            startDate: group.meta?.startDate,
            endDate: group.meta?.endDate
        });
        const groups = SS.storage.groups();
        const i = groups.findIndex(g => g.id === group.id);
        if (i < 0)
            throw new Error('Group not found.');
        groups[i] = group;
        SS.storage.replaceGroups(groups);
        return group;
    },
    addMember(groupId, user) {
        const group = SS.group(groupId);
        if (!group)
            throw new Error('Group not found.');
        if (!user?.id || !user?.email)
            throw new Error('Invalid user.');
        const existing = group.members.find(m => m.userId === user.id);
        if (existing) {
            existing.status = 'accepted';
            existing.removedAt = '';
            existing.joinedAt = existing.joinedAt || SS.now();
        }
        else {
            group.members.push({ userId: user.id, name: user.name, email: user.email, status: 'accepted', joinedAt: SS.now() });
        }
        SS.groups.update(group);
        return group;
    },
    removeMember(groupId, userId) {
        const group = SS.group(groupId);
        const user = SS.currentUser();
        if (!group || !user)
            throw new Error('Group unavailable.');
        if (group.creator !== user.id)
            throw new Error('Only the group admin can remove members.');
        if (userId === group.creator)
            throw new Error('The group admin cannot be removed.');
        const member = group.members.find(m => m.userId === userId && m.status !== 'removed');
        if (!member)
            throw new Error('Member not found.');
        member.status = 'removed';
        member.removedAt = SS.now();
        // Historical expenses intentionally remain untouched.
        SS.groups.update(group);
        return group;
    },
    delete(groupId) {
        const group = SS.group(groupId);
        const user = SS.currentUser();
        if (!group || !user)
            throw new Error('Group unavailable.');
        if (group.creator !== user.id)
            throw new Error('Only the group admin can delete this group.');
        const groups = SS.storage.groups().filter(g => g.id !== groupId);
        SS.storage.replaceGroups(groups);
        const invitations = SS.storage.invitations().filter(i => i.groupId !== groupId);
        SS.storage.replaceInvitations(invitations);
        return true;
    },
    member(group, userId) {
        return group?.members.find(m => m.userId === userId && m.status !== 'removed') || null;
    },
    activeMembers(group) {
        return (group?.members || []).filter(m => m.status !== 'removed');
    },
    userGroups(userId) {
        return SS.storage.groups().filter(g => g.members.some(m => m.userId === userId && m.status !== 'removed'));
    }
};

