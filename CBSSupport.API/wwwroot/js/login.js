"use strict";
document.addEventListener("DOMContentLoaded", function () {
    const signInForm = document.getElementById('signInForm');
    const errorToastEl = document.getElementById('errorToast');
    const errorToast = bootstrap.Toast.getOrCreateInstance(errorToastEl);
    const errorToastBody = document.getElementById('errorToastBody');
    const adminRoleRadio = document.getElementById('adminRole');
    const clientRoleRadio = document.getElementById('clientRole');
    const branchCodeGroup = document.getElementById('branch-code-group');
    const branchCodeInput = document.getElementById('branchCode');
    const roleSelectorSlider = document.querySelector('.role-selector-slider');
    let selectedRole = 'admin';

    function handleRoleChange() {
        if (clientRoleRadio.checked) {
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
    adminRoleRadio.addEventListener('change', handleRoleChange);
    clientRoleRadio.addEventListener('change', handleRoleChange);
    handleRoleChange();

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
                const data = await response.json();
                console.log("Login successful, token:", data.token);
                // In the future, you would save this token.
                // localStorage.setItem('jwt_token', data.token);

                const submitButton = signInForm.querySelector('button[type="submit"]');
                submitButton.innerHTML = '<i class="fas fa-check"></i> Success!';
                submitButton.classList.remove('btn-primary');
                submitButton.classList.add('btn-success');

                setTimeout(() => { window.location.href = '/Support'; }, 1000);
            } else {
                const errorData = await response.text();
                errorToastBody.textContent = errorData || "Invalid credentials.";
                errorToast.show();
            }
        } catch (error) {
            console.error('Login error:', error);
            errorToastBody.textContent = 'A network error occurred.';
            errorToast.show();
        }
    });
});