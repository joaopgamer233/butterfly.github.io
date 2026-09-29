"use strict";

const settingsModal = document.getElementById("settingsModal");
const settingsButton = document.getElementById("settingsButton");
const closeSettings = document.getElementById("closeSettings");
const themeSelect = document.getElementById("themeSelect");

function applyTheme(theme) {
    document.body.classList.toggle("light", theme === "light");
}

const savedTheme = localStorage.getItem("butterfly_theme") || "dark";
themeSelect.value = savedTheme;
applyTheme(savedTheme);

themeSelect.addEventListener("change", () => {
    const theme = themeSelect.value;
    localStorage.setItem("butterfly_theme", theme);
    applyTheme(theme);
});

settingsButton?.addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
});

closeSettings?.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
});

document.getElementById("changeUsernameButton")?.addEventListener("click", () => {
    const username = prompt("Enter your new username:");
    if (!username) return;

    window.Butterfly.send({
        type: "request_username_change",
        username: username.trim()
    });
});

document.getElementById("confirmUsernameButton")?.addEventListener("click", () => {
    const code = prompt("Enter the verification code from your email:");
    if (!code) return;

    window.Butterfly.send({
        type: "confirm_username_change",
        code: code.trim()
    });
});

document.getElementById("changePasswordButton")?.addEventListener("click", () => {
    const currentPassword = prompt("Current password:");
    if (!currentPassword) return;

    const newPassword = prompt("New password:");
    if (!newPassword) return;

    window.Butterfly.send({
        type: "change_password",
        currentPassword,
        newPassword
    });
});

document.getElementById("deleteAccountButton")?.addEventListener("click", () => {
    const confirmation = prompt("Type DELETE to request account deletion:");

    if (confirmation !== "DELETE") return;

    window.Butterfly.send({
        type: "request_account_deletion"
    });
});

document.getElementById("confirmDeleteButton")?.addEventListener("click", () => {
    const code = prompt("Enter the deletion code from your email:");
    if (!code) return;

    window.Butterfly.send({
        type: "confirm_account_deletion",
        code: code.trim()
    });
});

document.getElementById("logoutButton")?.addEventListener("click", () => {
    window.Butterfly.send({
        type: "logout"
    });
});
