"use strict";


const friendsList =
    document.getElementById(
        "friendsList"
    );

const friendRequests =
    document.getElementById(
        "friendRequests"
    );

const searchResults =
    document.getElementById(
        "searchResults"
    );

const userSearchForm =
    document.getElementById(
        "userSearchForm"
    );

const userSearchInput =
    document.getElementById(
        "userSearchInput"
    );

const onlineUsers =
    document.getElementById(
        "onlineUsers"
    );


window.ButterflyFriends = {

    setFriends(friends) {

        friendsList.innerHTML = "";


        if (!friends.length) {

            friendsList.innerHTML =
                '<p class="empty-list">No friends yet.</p>';

            return;
        }


        for (
            const friend
            of friends
        ) {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "friend";


            const avatar =
                document.createElement(
                    "img"
                );

            avatar.className =
                "avatar avatar-small";

            avatar.src =
                friend.avatar ||
                "resources/images/logo.png";


            const name =
                document.createElement(
                    "span"
                );

            name.className =
                "friend-name";

            name.textContent =
                friend.username;


            const remove =
                document.createElement(
                    "button"
                );

            remove.className =
                "friend-action";

            remove.textContent =
                "Remove";


            remove.onclick =
                () => {

                    window.Butterfly.send({

                        type:
                            "friend_remove",

                        userId:
                            friend.id

                    });

                };


            row.appendChild(
                avatar
            );

            row.appendChild(
                name
            );

            row.appendChild(
                remove
            );


            friendsList.appendChild(
                row
            );

        }

    },


    setRequests(requests) {

        friendRequests.innerHTML = "";


        if (!requests.length) {

            friendRequests.innerHTML =
                '<p class="empty-list">No requests.</p>';

            return;
        }


        for (
            const request
            of requests
        ) {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "friend-request";


            const avatar =
                document.createElement(
                    "img"
                );

            avatar.className =
                "avatar avatar-small";

            avatar.src =
                request.avatar ||
                "resources/images/logo.png";


            const name =
                document.createElement(
                    "span"
                );

            name.className =
                "friend-name";

            name.textContent =
                request.username;


            const accept =
                document.createElement(
                    "button"
                );

            accept.className =
                "friend-action";

            accept.textContent =
                "Accept";


            accept.onclick =
                () => {

                    window.Butterfly.send({

                        type:
                            "friend_accept",

                        userId:
                            request.id

                    });

                };


            const decline =
                document.createElement(
                    "button"
                );

            decline.className =
                "friend-action";

            decline.textContent =
                "×";


            decline.onclick =
                () => {

                    window.Butterfly.send({

                        type:
                            "friend_decline",

                        userId:
                            request.id

                    });

                };


            row.appendChild(
                avatar
            );

            row.appendChild(
                name
            );

            row.appendChild(
                accept
            );

            row.appendChild(
                decline
            );


            friendRequests.appendChild(
                row
            );

        }

    },


    setSearchResults(users) {

        searchResults.innerHTML = "";


        for (
            const user
            of users
        ) {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "search-result";


            const avatar =
                document.createElement(
                    "img"
                );

            avatar.className =
                "avatar avatar-small";

            avatar.src =
                user.avatar ||
                "resources/images/logo.png";


            const name =
                document.createElement(
                    "span"
                );

            name.className =
                "friend-name";

            name.textContent =
                user.username;


            const button =
                document.createElement(
                    "button"
                );

            button.className =
                "friend-action";

            button.textContent =
                "Add";


            button.onclick =
                () => {

                    window.Butterfly.send({

                        type:
                            "friend_request",

                        userId:
                            user.id

                    });

                };


            row.appendChild(
                avatar
            );

            row.appendChild(
                name
            );

            row.appendChild(
                button
            );


            searchResults.appendChild(
                row
            );

        }

    },


    setOnlineUsers(users) {

        onlineUsers.innerHTML = "";


        for (
            const user
            of users
        ) {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "online-user";


            const avatar =
                document.createElement(
                    "img"
                );

            avatar.className =
                "avatar avatar-small";

            avatar.src =
                user.avatar ||
                "resources/images/logo.png";


            const name =
                document.createElement(
                    "span"
                );

            name.textContent =
                user.username;


            row.appendChild(
                avatar
            );

            row.appendChild(
                name
            );


            onlineUsers.appendChild(
                row
            );

        }

    }

};


/* =========================================
   SEARCH
========================================= */

userSearchForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();


        const query =
            userSearchInput.value.trim();


        if (!query) {
            return;
        }


        window.Butterfly.send({

            type:
                "search_users",

            query

        });

    }
);