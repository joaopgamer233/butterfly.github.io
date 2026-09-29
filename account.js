"use strict";

const loginView = document.getElementById("loginView");
const registerView = document.getElementById("registerView");
const recoveryView = document.getElementById("recoveryView");
const verificationView = document.getElementById("verificationView");
const authStatus = document.getElementById("authStatus");

let pendingVerificationEmail = "";
let pendingRecoveryEmail = "";

function showOnly(view) {
    [loginView, registerView, recoveryView, verificationView]
        .forEach(element => element.classList.add("hidden"));
    view.classList.remove("hidden");
}

window.ButterflyAccount = {
    setUser(user) {
        window.ButterflyProfile?.update(user);
    },

    showError(message) {
        authStatus.textContent = message || "";
    },

    showVerification(email = pendingVerificationEmail, message = "") {
        pendingVerificationEmail = email || pendingVerificationEmail;
        showOnly(verificationView);
        authStatus.textContent =
            message || `A verification email was sent to ${pendingVerificationEmail}.`;
    },

    showLogin(message = "") {
        showOnly(loginView);
        authStatus.textContent = message;
    },

    showRecoveryCode(message = "") {
        document.getElementById("recoveryRequestForm").classList.add("hidden");
        document.getElementById("recoveryResetForm").classList.remove("hidden");
        authStatus.textContent = message;
    }
};

document.getElementById("showRegister").addEventListener("click", () => {
    showOnly(registerView);
    authStatus.textContent = "";
});

document.getElementById("showLoginFromRegister").addEventListener("click", () => {
    window.ButterflyAccount.showLogin();
});

document.getElementById("showRecovery").addEventListener("click", () => {
    showOnly(recoveryView);
    document.getElementById("recoveryRequestForm").classList.remove("hidden");
    document.getElementById("recoveryResetForm").classList.add("hidden");
    authStatus.textContent = "";
});

document.getElementById("showLoginFromRecovery").addEventListener("click", () => {
    window.ButterflyAccount.showLogin();
});

document.getElementById("registerForm").addEventListener("submit", event => {
    event.preventDefault();

    const username = document.getElementById("registerUsername").value.trim();
    const email = document.getElementById("registerEmail").value.trim().toLowerCase();
    const password = document.getElementById("registerPassword").value;
    const confirm = document.getElementById("registerPasswordConfirm").value;

    if (password !== confirm) {
        window.ButterflyAccount.showError("Passwords do not match.");
        return;
    }

    if (password.length < 8) {
        window.ButterflyAccount.showError("Password must contain at least 8 characters.");
        return;
    }

    pendingVerificationEmail = email;

    if (!window.Butterfly.send({
        type: "register",
        username,
        email,
        password
    })) {
        window.ButterflyAccount.showError("Butterfly is not connected.");
    }
});

document.getElementById("verificationForm").addEventListener("submit", event => {
    event.preventDefault();

    const code = document.getElementById("verificationCode").value.trim();

    if (!pendingVerificationEmail || !code) {
        window.ButterflyAccount.showError("Enter the verification code.");
        return;
    }

    window.Butterfly.send({
        type: "verify_email",
        email: pendingVerificationEmail,
        code
    });
});

document.getElementById("resendVerificationButton")?.addEventListener("click", () => {
    if (!pendingVerificationEmail) {
        window.ButterflyAccount.showError("Enter your account email first.");
        return;
    }

    if (!window.Butterfly.send({
        type: "resend_verification",
        email: pendingVerificationEmail
    })) {
        window.ButterflyAccount.showError("Butterfly is not connected.");
    }
});

document.getElementById("loginForm").addEventListener("submit", event => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;

    window.Butterfly.send({
        type: "login",
        email,
        password
    });
});

document.getElementById("recoveryRequestForm").addEventListener("submit", event => {
    event.preventDefault();

    pendingRecoveryEmail =
        document.getElementById("recoveryEmail").value.trim().toLowerCase();

    window.Butterfly.send({
        type: "request_password_reset",
        email: pendingRecoveryEmail
    });
});

document.getElementById("recoveryResetForm").addEventListener("submit", event => {
    event.preventDefault();

    const code = document.getElementById("recoveryCode").value.trim();
    const password = document.getElementById("recoveryNewPassword").value;
    const confirm = document.getElementById("recoveryNewPasswordConfirm").value;

    if (password !== confirm) {
        window.ButterflyAccount.showError("Passwords do not match.");
        return;
    }

    if (password.length < 8) {
        window.ButterflyAccount.showError("Password must contain at least 8 characters.");
        return;
    }

    window.Butterfly.send({
        type: "reset_password",
        email: pendingRecoveryEmail,
        code,
        password
    });
});
