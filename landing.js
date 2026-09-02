SS.landingPage = {
    init() {
        SS.navigation.render();
        document.querySelectorAll('[data-purpose]').forEach(button => {
            button.addEventListener('click', () => {
                const purpose = button.dataset.purpose;
                const destination = `create-group.html?purpose=${encodeURIComponent(purpose)}`;
                const user = SS.currentUser();
                // Preserve the user's intended destination through signup/login.
                location.href = user
                    ? destination
                    : `signup.html?next=${encodeURIComponent(destination)}`;
            });
        });
    }
};

