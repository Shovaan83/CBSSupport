document.addEventListener("DOMContentLoaded", function () {
    const signInForm = document.getElementById('signInForm');
    const errorMessageDiv = document.getElementById('error-message');

    signInForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        errorMessageDiv.classList.add('d-none'); // Hide error on new submit

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                // Success! Store the token and redirect.
                localStorage.setItem('jwt_token', data.token);
                window.location.href = '/Support'; // Redirect to the support dashboard
            } else {
                // Handle login failure
                const errorData = await response.text();
                errorMessageDiv.textContent = errorData || "Invalid username or password.";
                errorMessageDiv.classList.remove('d-none');
            }

        } catch (error) {
            console.error('Login error:', error);
            errorMessageDiv.textContent = 'An error occurred. Please try again later.';
            errorMessageDiv.classList.remove('d-none');
        }
    });
});