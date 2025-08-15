"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const adminRadio = document.getElementById('adminRole');
    const clientRadio = document.getElementById('clientRole');
    const roleTypeHidden = document.getElementById('roleTypeHidden');
    const roleSelectorSlider = document.querySelector('.role-selector-slider');

    const adminForm = document.getElementById('adminForm');
    const clientForm = document.getElementById('clientForm');

    // Get all the input fields within each form section
    const adminInputs = adminForm.querySelectorAll('input');
    const clientInputs = clientForm.querySelectorAll('input');

    function handleRoleChange() {
        if (clientRadio.checked) {
            roleSelectorSlider.classList.add('client');

            // Show client form and hide admin form
            adminForm.style.display = 'none';
            clientForm.style.display = 'block';

            // IMPORTANT: Disable admin inputs and enable client inputs
            adminInputs.forEach(input => input.disabled = true);
            clientInputs.forEach(input => input.disabled = false);

        } else {
            roleSelectorSlider.classList.remove('client');

            // Show admin form and hide client form
            adminForm.style.display = 'block';
            clientForm.style.display = 'none';

            // IMPORTANT: Enable admin inputs and disable client inputs
            adminInputs.forEach(input => input.disabled = false);
            clientInputs.forEach(input => input.disabled = true);
        }
    }

    if (adminRadio) {
        adminRadio.addEventListener('change', handleRoleChange);
    }
    if (clientRadio) {
        clientRadio.addEventListener('change', handleRoleChange);
    }

    // Initialize the form state when the page first loads
    handleRoleChange();
});