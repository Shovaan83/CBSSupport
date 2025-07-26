"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const adminRadio = document.getElementById('adminRole');
    const clientRadio = document.getElementById('clientRole');
    const branchCodeGroup = document.getElementById('branch-code-group');
    const roleTypeHidden = document.getElementById('roleTypeHidden')
    const branchCodeInput = document.getElementById('branchCode');
    const roleSelectorSlider = document.querySelector('.role-selector-slider');
    const branchCodeHidden = document.getElementById('branchCodeHidden');

    function updateRole() {
        if (adminRadio.checked) {
            roleTypeHidden.value = "admin";
        } else if (clientRadio.checked) {
            roleTypeHidden.value = "client";
        }
    }

    function updateBranchCode() {
        branchCodeHidden.value = branchCodeInput.value;
    }
    function handleRoleChange() {
        if (clientRadio.checked) {
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

    adminRadio.addEventListener('change', handleRoleChange);
    clientRadio.addEventListener('change', handleRoleChange);
    branchCodeInput.addEventListener('input', updateBranchCode);

    updateRole();
    handleRoleChange();
});