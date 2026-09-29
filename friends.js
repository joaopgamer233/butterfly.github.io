"use strict";

const friendsList = document.getElementById("friendsList");
const friendRequests = document.getElementById("friendRequests");
const searchResults = document.getElementById("searchResults");
const userSearchForm = document.getElementById("userSearchForm");
const userSearchInput = document.getElementById("userSearchInput");
const onlineUsers = document.getElementById("onlineUsers");

const avatarURL = user => user.avatar || "resources/images/logo.png";

function createAvatar(user) {
    const avatar = document.createElement("img");
    avatar.className = "avatar avatar-small";
    avatar.src = avatarURL(user);
    avatar.alt = user.username || "User";
    return avatar;
}

window.ButterflyFriends = {
    setFriends(friends) {
        friendsList.innerHTML = "";

        if (!friends.length) {
            friendsList.innerHTML = '<p class="empty-list">No friends yet.</p>';
            return;
        }

        for (const friend of friends) {
            const row = document.createElement("div");
            row.className = "friend";
            row.append(createAvatar(friend));

            const name = document.createElement("span");
            name.className = "friend-name";
            name.textContent = friend.username;

            const remove = document.createElement("button");
            remove.className = "friend-action";
            remove.textContent = "Remove";
            remove.addEventListener("click", () => {
                window.Butterfly.send({
                    type: "friend_remove",
                    userId: friend.id
                });
            });

            row.append(name, remove);
            friendsList.appendChild(row);
        }
    },

    setRequests(requests) {
        friendRequests.innerHTML = "";

        if (!requests.length) {
            friendRequests.innerHTML = '<p class="empty-list">No requests.</p>';
            return;
        }

        for (const request of requests) {
            const row = document.createElement("div");
            row.className = "friend-request";
            row.append(createAvatar(request));

            const name = document.createElement("span");
            name.className = "friend-name";
            name.textContent = request.username;

            const accept = document.createElement("button");
            accept.className = "friend-action";
            accept.textContent = "Accept";
            accept.addEventListener("click", () => {
                window.Butterfly.send({
                    type: "friend_accept",
                    userId: request.id
                });
            });

            const decline = document.createElement("button");
            decline.className = "friend-action";
            decline.textContent = "×";
            decline.addEventListener("click", () => {
                window.Butterfly.send({
                    type: "friend_decline",
                    userId: request.id
                });
            });

            row.append(name, accept, decline);
            friendRequests.appendChild(row);
        }
    },

    setSearchResults(users) {
        searchResults.innerHTML = "";

        if (!users.length) {
            searchResults.innerHTML = '<p class="empty-list">No users found.</p>';
            return;
        }

        for (const user of users) {
            const row = document.createElement("div");
            row.className = "search-result";
            row.append(createAvatar(user));

            const name = document.createElement("span");
            name.className = "friend-name";
            name.textContent = user.username;

            const button = document.createElement("button");
            button.className = "friend-action";
            button.textContent = "Add";
            button.addEventListener("click", () => {
                window.Butterfly.send({
                    type: "friend_request",
                    userId: user.id
                });
            });

            row.append(name, button);
            searchResults.appendChild(row);
        }
    },

    setOnlineUsers(users) {
        onlineUsers.innerHTML = "";

        for (const user of users) {
            const row = document.createElement("div");
            row.className = "online-user";
            row.append(createAvatar(user));

            const name = document.createElement("span");
            name.textContent = user.username;

            row.appendChild(name);
            onlineUsers.appendChild(row);
        }
    }
};

userSearchForm?.addEventListener("submit", event => {
    event.preventDefault();

    const query = userSearchInput.value.trim();
    if (!query) return;

    window.Butterfly.send({
        type: "search_users",
        query
    });
});
