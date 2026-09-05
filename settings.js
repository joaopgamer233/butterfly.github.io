"use strict";


const settingsModal =
    document.getElementById(
        "settingsModal"
    );

const settingsButton =
    document.getElementById(
        "settingsButton"
    );

const closeSettings =
    document.getElementById(
        "closeSettings"
    );

const themeSelect =
    document.getElementById(
        "themeSelect"
    );


/* =========================================
   THEME
========================================= */

const savedTheme =
    localStorage.getItem(
        "butterfly_theme"
    ) ||
    "dark";


applyTheme(
    savedTheme
);


themeSelect.value =
    savedTheme;


themeSelect.addEventListener(
    "change",
    () => {

        const theme =
            themeSelect.value;


        localStorage.setItem(
            "butterfly_theme",
            theme
        );


        applyTheme(
            theme
        );

    }
);


function applyTheme(theme) {

    document.body.classList.toggle(
        "light",
        theme === "light"
    );

}


/* =========================================
   OPEN SETTINGS
========================================= */

settingsButton.addEventListener(
    "click",
    () => {

        settingsModal.classList.remove(
            "hidden"
        );

    }
);


/* =========================================
   CLOSE
========================================= */

closeSettings.addEventListener(
    "click",
    () => {

        settingsModal.classList.add(
            "hidden"
        );

    }
);


/* =========================================
   CHANGE USERNAME
========================================= */

document
    .getElementById(
        "changeUsernameButton"
    )
    .addEventListener(
        "click",
        () => {

            const username =
                prompt(
                    "Enter your new username:"
                );


            if (!username) {
                return;
            }


            window.Butterfly.send({

                type:
                    "request_username_change",

                username:
                    username.trim()

            });


            alert(
                "If the username is valid, a verification code will be sent to your email."
            );

        }
    );


/* =========================================
   CHANGE PASSWORD
========================================= */

document
    .getElementById(
        "changePasswordButton"
    )
    .addEventListener(
        "click",
        () => {

            const currentPassword =
                prompt(
                    "Current password:"
                );


            if (!currentPassword) {
                return;
            }


            const newPassword =
                prompt(
                    "New password:"
                );


            if (!newPassword) {
                return;
            }


            window.Butterfly.send({

                type:
                    "change_password",

                currentPassword,

                newPassword

            });

        }
    );


/* =========================================
   DELETE ACCOUNT
========================================= */

document
    .getElementById(
        "deleteAccountButton"
    )
    .addEventListener(
        "click",
        () => {

            const confirmation =
                prompt(
                    "Type DELETE to request account deletion:"
                );


            if (
                confirmation !==
                "DELETE"
            ) {

                return;
            }


            window.Butterfly.send({

                type:
                    "request_account_deletion"

            });


            alert(
                "A confirmation code has been sent to your email."
            );

        }
    );


/* =========================================
   LOGOUT
========================================= */

document
    .getElementById(
        "logoutButton"
    )
    .addEventListener(
        "click",
        () => {

            window.Butterfly.send({

                type:
                    "logout"

            });

        }
    );