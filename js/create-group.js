SS.createGroupPage = {
    init() {
        if (!SS.requireAuth())
            return;
        SS.navigation.render();
        const purpose = document.getElementById('purpose');
        const fields = document.getElementById('purposeFields');
        const fileInput = document.getElementById('groupThumbnail');
        const preview = document.getElementById('thumbnailPreview');
        const previewImage = document.getElementById('thumbnailPreviewImage');
        const fileName = document.getElementById('thumbnailFileName');
        const form = document.getElementById('groupForm');
        const draw = () => {
            const p = purpose.value;
            if (p === 'trip')
                fields.innerHTML = `
        <div class="form-section-label">Trip details</div>
        <div class="form-row">
          <div class="field"><label>Trip name</label><input name="name" required placeholder="Goa Trip 2026"></div>
          <div class="field"><label>Destination</label><input name="destination" placeholder="Goa"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Start date</label><input type="date" name="startDate"></div>
          <div class="field"><label>End date</label><input type="date" name="endDate"></div>
        </div>
        <div class="field"><label>Description</label><textarea name="description" placeholder="What is this trip about?"></textarea></div>`;
            else if (p === 'household')
                fields.innerHTML = `
        <div class="form-section-label">Household details</div>
        <div class="field"><label>Household name</label><input name="name" required placeholder="Flat 302"></div>
        <div class="field"><label>Address / location <small>(optional)</small></label><input name="address" placeholder="Sector 15"></div>
        <div class="field"><label>Description</label><textarea name="description" placeholder="Shared apartment expenses..."></textarea></div>`;
            else
                fields.innerHTML = `
        <div class="form-section-label">Custom group details</div>
        <div class="field"><label>Group name</label><input name="name" required placeholder="College Event"></div>
        <div class="field"><label>Purpose</label><input name="customPurpose" placeholder="Wedding, Party, Project..."></div>
        <div class="field"><label>Description</label><textarea name="description" placeholder="Describe your group"></textarea></div>`;
        };
        draw();
        document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('[data-tab]').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            purpose.value = b.dataset.tab;
            draw();
        }));
        const requested = SS.query('purpose');
        if (requested && ['trip', 'household', 'custom'].includes(requested))
            document.querySelector(`[data-tab="${requested}"]`)?.click();
        fileInput?.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) {
                preview?.classList.add('hide');
                return;
            }
            fileName.textContent = file.name;
            const url = URL.createObjectURL(file);
            previewImage.src = url;
            preview.classList.remove('hide');
            previewImage.onload = () => URL.revokeObjectURL(url);
        });
        document.getElementById('removeThumbnail')?.addEventListener('click', () => {
            fileInput.value = '';
            preview.classList.add('hide');
        });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const d = Object.fromEntries(new FormData(e.currentTarget));
            const submit = e.currentTarget.querySelector('button[type="submit"]');
            try {
                submit.disabled = true;
                submit.innerHTML = 'Creating…';
                d.thumbnail = await SS.readImageAsDataUrl(fileInput?.files[0]);
                const g = SS.groups.create(d);
                location.href = `group.html?id=${encodeURIComponent(g.id)}&new=1`;
            }
            catch (x) {
                SS.toast(x.message);
            }
            finally {
                submit.disabled = false;
                submit.innerHTML = 'Create Group <span>→</span>';
            }
        });
    }
};

