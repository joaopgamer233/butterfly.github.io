"use strict";


const loginView =
    document.getElementById("loginView");

const registerView =
    document.getElementById("registerView");

const recoveryView =
    document.getElementById("recoveryView");

const verificationView =
    document.getElementById("verificationView");

const authStatus =
    document.getElementById("authStatus");


let pendingVerificationEmail =
    null;


/* =========================================
   ACCOUNT API
========================================= */

window.ButterflyAccount = {

    setUser(user) {

        if (
            window.ButterflyProfile
        ) {

            window.ButterflyProfile.update(
                user
            );

        }

    },


    showError(message) {

        authStatus.textContent =
            message || "Something went wrong.";

    },


    showVerification() {

        loginView.classList.add(
            "hidden"
        );

        registerView.classList.add(
            "hidden"
        );

        recoveryView.classList.add(
            "hidden"
        );

        verificationView.classList.remove(
            "hidden"
        );

        authStatus.textContent =
            "Check your email for a verification link or code.";

    },


    showLogin(message = "") {

        loginView.classList.remove(
            "hidden"
        );

        registerView.classList.add(
            "hidden"
        );

        recoveryView.classList.add(
            "hidden"
        );

        verificationView.classList.add(
            "hidden"
        );

        authStatus.textContent =
            message;

    }

};


/* =========================================
   VIEW SWITCHING
========================================= */

document
    .getElementById("showRegister")
    .addEventListener(
        "click",
        () => {

            loginView.classList.add(
                "hidden"
            );

            registerView.classList.remove(
                "hidden"
            );

            recoveryView.classList.add(
                "hidden"
            );

        }
    );


document
    .getElementById("showLoginFromRegister")
    .addEventListener(
        "click",
        () => {

            window.ButterflyAccount.showLogin();

        }
    );


document
    .getElementById("showRecovery")
    .addEventListener(
        "click",
        () => {

            loginView.classList.add(
                "hidden"
            );

            recoveryView.classList.remove(
                "hidden"
            );

        }
    );


document
    .getElementById("showLoginFromRecovery")
    .addEventListener(
        "click",
        () => {

            window.ButterflyAccount.showLogin();

        }
    );


/* =========================================
   REGISTER
========================================= */

document
    .getElementById("registerForm")
    .addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const username =
                document
                    .getElementById(
                        "registerUsername"
                    )
                    .value
                    .trim();


            const email =
                document
                    .getElementById(
                        "registerEmail"
                    )
                    .value
                    .trim();


            const password =
                document
                    .getElementById(
                        "registerPassword"
                    )
                    .value;


            const confirm =
                document
                    .getElementById(
                        "registerPasswordConfirm"
                    )
                    .value;


            if (
                password !==
                confirm
            ) {

                window.ButterflyAccount.showError(
                    "Passwords do not match."
                );

                return;
            }


            if (
                password.length < 8
            ) {

                window.ButterflyAccount.showError(
                    "Password must contain at least 8 characters."
                );

                return;
            }


            pendingVerificationEmail =
                email;


            if (
                !window.Butterfly.send({

                    type:
                        "register",

                    username,

                    email,

                    password

                })
            ) {

                window.ButterflyAccount.showError(
                    "Not connected to Butterfly."
                );

            }

        }
    );


/* =========================================
   VERIFY EMAIL
========================================= */

document
    .getElementById("verificationForm")
    .addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const code =
                document
                    .getElementById(
                        "verificationCode"
                    )
                    .value
                    .trim();


            window.Butterfly.send({

                type:
                    "verify_email",

                email:
                    pendingVerificationEmail,

                code

            });

        }
    );


/* =========================================
   RESEND VERIFICATION EMAIL
========================================= */

const resendVerificationButton =
    document.getElementById(
        "resendVerificationButton"
    );


if (resendVerificationButton) {

    resendVerificationButton.addEventListener(
        "click",
        () => {

            if (!pendingVerificationEmail) {
                window.ButterflyAccount.showError(
                    "Your verification email is missing. Please register again."
                );
                return;
            }

            if (!window.Butterfly.send({
                type: "resend_verification",
                email: pendingVerificationEmail
            })) {
                window.ButterflyAccount.showError(
                    "Not connected to Butterfly."
                );
            }
        }
    );

}


/* =========================================
   LOGIN
========================================= */

document
    .getElementById("loginForm")
    .addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const email =
                document
                    .getElementById(
                        "loginEmail"
                    )
                    .value
                    .trim();


            const password =
                document
                    .getElementById(
                        "loginPassword"
                    )
                    .value;


            window.Butterfly.send({

                type:
                    "login",

                email,

                password

            });

        }
    );


/* =========================================
   RECOVERY REQUEST
========================================= */

document
    .getElementById("recoveryRequestForm")
    .addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const email =
                document
                    .getElementById(
                        "recoveryEmail"
                    )
                    .value
                    .trim();


            window.Butterfly.send({

                type:
                    "request_password_reset",

                email

            });


            document
                .getElementById(
                    "recoveryRequestForm"
                )
                .classList.add(
                    "hidden"
                );


            document
                .getElementById(
                    "recoveryResetForm"
                )
                .classList.remove(
                    "hidden"
                );

        }
    );


/* =========================================
   RECOVERY RESET
========================================= */

document
    .getElementById("recoveryResetForm")
    .addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const email =
                document
                    .getElementById(
                        "recoveryEmail"
                    )
                    .value
                    .trim();


            const code =
                document
                    .getElementById(
                        "recoveryCode"
                    )
                    .value
                    .trim();


            const password =
                document
                    .getElementById(
                        "recoveryNewPassword"
                    )
                    .value;


            const confirm =
                document
                    .getElementById(
                        "recoveryNewPasswordConfirm"
                    )
                    .value;


            if (
                password !==
                confirm
            ) {

                window.ButterflyAccount.showError(
                    "Passwords do not match."
                );

                return;
            }


            window.Butterfly.send({

                type:
                    "reset_password",

                email,

                code,

                password

            });

        }
    );