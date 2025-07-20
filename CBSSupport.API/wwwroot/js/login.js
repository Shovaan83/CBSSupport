document.addEventListener("DOMContentLoaded", function () {

    // --- Element References ---
    const signInForm = document.getElementById('signInForm');
    const roleSelectorContainer = document.getElementById('roleSelectorContainer');
    const branchCodeGroup = document.getElementById('branch-code-group');
    const branchCodeInput = document.getElementById('branchCode');
    const roleSelectorSlider = document.querySelector('.role-selector-slider');

    // --- Toast Notification Setup ---
    // Get the DOM element for the toast
    const errorToastEl = document.getElementById('errorToast');
    // Create a Bootstrap Toast instance from the element
    const errorToast = bootstrap.Toast.getOrCreateInstance(errorToastEl);
    const errorToastBody = document.getElementById('errorToastBody');

    let selectedRole = 'admin'; // Keep track of the current role

    // --- Event Handling ---

    // Use event delegation for the role selector
    roleSelectorContainer.addEventListener('click', function (e) {
        if (e.target.classList.contains('role-selector-option')) {
            // Remove active class from all options
            roleSelectorContainer.querySelectorAll('.role-selector-option').forEach(opt => opt.classList.remove('active'));
            // Add active class to the clicked option
            e.target.classList.add('active');

            selectedRole = e.target.dataset.role;
            handleRoleChange();
        }
    });

    function handleRoleChange() {
        if (selectedRole === 'client') {
            roleSelectorSlider.classList.add('client');
            branchCodeGroup.classList.remove('disabled');
            branchCodeInput.required = true;
            branchCodeInput.tabIndex = 0;
        } else {
            roleSelectorSlider.classList.remove('client');
            branchCodeGroup.classList.add('disabled');
            branchCodeInput.required = false;
            branchCodeInput.tabIndex = -1;
            branchCodeInput.value = '';
        }
    }

    // --- Form Submission Logic ---
    signInForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const loginData = {
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        };

        if (selectedRole === 'client') {
            loginData.branchCode = branchCodeInput.value;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });

            if (response.ok) {
                // Success Logic
                const data = await response.json();
                localStorage.setItem('jwt_token', data.token);
                const submitButton = signInForm.querySelector('button[type="submit"]');
                submitButton.innerHTML = '<i class="fas fa-check"></i> Success!';
                submitButton.classList.remove('btn-primary');
                submitButton.classList.add('btn-success');
                setTimeout(() => { window.location.href = '/Support'; }, 1000);
            } else {
                // Error Handling with Toast
                const errorData = await response.text();
                errorToastBody.textContent = errorData || "Invalid credentials. Please try again.";
                errorToast.show(); // This will now work correctly
            }
        } catch (error) {
            // Network/Other Error Handling with Toast
            console.error('Login error:', error);
            errorToastBody.textContent = 'A network error occurred. Please check your connection.';
            errorToast.show(); // This will now work correctly
        }
    });
});