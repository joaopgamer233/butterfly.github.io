"use strict";


const DEFAULT_AVATAR =
    "resources/images/logo.png";

const MAX_AVATAR_SIZE =
    256;

const MAX_SOURCE_FILE_SIZE =
    200 * 1024;


/* =========================================
   DOM
========================================= */

const profileAvatar =
    document.getElementById(
        "profileAvatar"
    );

const headerAvatar =
    document.getElementById(
        "headerAvatar"
    );

const avatarInput =
    document.getElementById(
        "avatarInput"
    );

const profileUsername =
    document.getElementById(
        "profileUsername"
    );

const profileButton =
    document.getElementById(
        "profileButton"
    );

const profileModal =
    document.getElementById(
        "profileModal"
    );

const closeProfile =
    document.getElementById(
        "closeProfile"
    );

const friendsList =
    document.getElementById(
        "friendsList"
    );


/* =========================================
   PROFILE STATE
========================================= */

let currentProfile = null;


/* =========================================
   PUBLIC PROFILE API
========================================= */

window.ButterflyProfile = {

    update(user) {

        if (!user) {
            return;
        }


        currentProfile =
            user;


        const username =
            user.username ||
            "User";


        const avatar =
            user.avatar ||
            DEFAULT_AVATAR;


        profileUsername.textContent =
            username;


        profileAvatar.src =
            avatar;


        headerAvatar.src =
            avatar;

    },


    setFriends(friends) {

        friendsList.innerHTML = "";


        if (!friends.length) {

            const empty =
                document.createElement(
                    "p"
                );

            empty.className =
                "empty-list";

            empty.textContent =
                "No friends yet.";


            friendsList.appendChild(
                empty
            );

            return;
        }


        for (
            const friend
            of friends
        ) {

            const element =
                document.createElement(
                    "div"
                );

            element.className =
                "friend";


            const avatar =
                document.createElement(
                    "img"
                );

            avatar.className =
                "avatar avatar-small";

            avatar.src =
                friend.avatar ||
                DEFAULT_AVATAR;

            avatar.alt =
                friend.username;


            const name =
                document.createElement(
                    "span"
                );

            name.textContent =
                friend.username;


            element.appendChild(
                avatar
            );

            element.appendChild(
                name
            );


            friendsList.appendChild(
                element
            );

        }

    }

};


/* =========================================
   OPEN PROFILE
========================================= */

profileButton.addEventListener(
    "click",
    () => {

        profileModal.classList.remove(
            "hidden"
        );

    }
);


/* =========================================
   CLOSE PROFILE
========================================= */

closeProfile.addEventListener(
    "click",
    () => {

        profileModal.classList.add(
            "hidden"
        );

    }
);


/* =========================================
   CLICK OUTSIDE
========================================= */

profileModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            profileModal
        ) {

            profileModal.classList.add(
                "hidden"
            );

        }

    }
);


/* =========================================
   SELECT PROFILE PICTURE
========================================= */

avatarInput.addEventListener(
    "change",
    async event => {

        const file =
            event.target.files[0];


        if (!file) {
            return;
        }


        /* ---------------------------------
           File type
        --------------------------------- */

        if (
            file.type !==
                "image/png" &&

            file.type !==
                "image/jpeg"
        ) {

            alert(
                "Only PNG and JPEG images are supported."
            );

            avatarInput.value = "";

            return;
        }


        /* ---------------------------------
           File size
        --------------------------------- */

        if (
            file.size >
            MAX_SOURCE_FILE_SIZE
        ) {

            alert(
                "The image must be smaller than 200 KB."
            );

            avatarInput.value = "";

            return;
        }


        try {

            const avatar =
                await processAvatar(
                    file
                );


            /* ---------------------------------
               Local preview
            --------------------------------- */

            profileAvatar.src =
                avatar;

            headerAvatar.src =
                avatar;


            /* ---------------------------------
               SEND TO SERVER
            --------------------------------- */

            if (
                window.socket &&

                window.socket.readyState ===
                    WebSocket.OPEN
            ) {

                window.socket.send(
                    JSON.stringify({

                        type:
                            "update_profile",

                        avatar:
                            avatar

                    })
                );


            } else {

                alert(
                    "Butterfly is not connected."
                );

            }


        } catch (error) {

            console.error(
                "Profile picture error:",
                error
            );

            alert(
                "Could not process the image."
            );

        }


        avatarInput.value = "";

    }
);


/* =========================================
   PROCESS / RESIZE AVATAR
========================================= */

function processAvatar(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload =
                () => {

                    const image =
                        new Image();


                    image.onload =
                        () => {

                            const canvas =
                                document.createElement(
                                    "canvas"
                                );


                            canvas.width =
                                MAX_AVATAR_SIZE;

                            canvas.height =
                                MAX_AVATAR_SIZE;


                            const context =
                                canvas.getContext(
                                    "2d"
                                );


                            if (!context) {

                                reject(
                                    new Error(
                                        "Canvas unavailable."
                                    )
                                );

                                return;
                            }


                            const size =
                                Math.min(
                                    image.width,
                                    image.height
                                );


                            const sourceX =
                                (
                                    image.width -
                                    size
                                ) / 2;


                            const sourceY =
                                (
                                    image.height -
                                    size
                                ) / 2;


                            context.drawImage(

                                image,

                                sourceX,
                                sourceY,

                                size,
                                size,

                                0,
                                0,

                                MAX_AVATAR_SIZE,
                                MAX_AVATAR_SIZE

                            );


                            const result =
                                canvas.toDataURL(
                                    "image/jpeg",
                                    0.85
                                );


                            resolve(
                                result
                            );

                        };


                    image.onerror =
                        () => {

                            reject(
                                new Error(
                                    "Invalid image."
                                )
                            );

                        };


                    image.src =
                        reader.result;

                };


            reader.onerror =
                () => {

                    reject(
                        new Error(
                            "Could not read image."
                        )
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );
}