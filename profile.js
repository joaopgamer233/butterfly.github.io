"use strict";

const profileButton = document.getElementById("profileButton");
const profileModal = document.getElementById("profileModal");
const closeProfile = document.getElementById("closeProfile");
const avatarInput = document.getElementById("avatarInput");
const profileAvatar = document.getElementById("profileAvatar");
const headerAvatar = document.getElementById("headerAvatar");
const headerUsername = document.getElementById("headerUsername");
const profileUsername = document.getElementById("profileUsername");

const DEFAULT_AVATAR = "resources/images/logo.png";
const MAX_SOURCE_FILE_SIZE = 200 * 1024;
const MAX_AVATAR_SIZE = 256;

window.ButterflyProfile = {
    update(user) {
        if (!user) return;

        const avatar = user.avatar || DEFAULT_AVATAR;
        profileAvatar.src = avatar;
        headerAvatar.src = avatar;
        headerUsername.textContent = user.username || "User";
        profileUsername.textContent = user.username || "User";
    }
};

profileButton?.addEventListener("click", () => {
    profileModal.classList.remove("hidden");
});

closeProfile?.addEventListener("click", () => {
    profileModal.classList.add("hidden");
});

profileModal?.addEventListener("click", event => {
    if (event.target === profileModal) {
        profileModal.classList.add("hidden");
    }
});

avatarInput?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
        window.ButterflyAccount?.showError("Only PNG and JPEG images are supported.");
        avatarInput.value = "";
        return;
    }

    if (file.size > MAX_SOURCE_FILE_SIZE) {
        window.ButterflyAccount?.showError("The image must be smaller than 200 KB.");
        avatarInput.value = "";
        return;
    }

    try {
        const avatar = await processAvatar(file);

        profileAvatar.src = avatar;
        headerAvatar.src = avatar;

        if (!window.Butterfly.send({
            type: "update_profile",
            avatar
        })) {
            window.ButterflyAccount?.showError("Butterfly is not connected.");
        }
    } catch (error) {
        console.error("Profile picture error:", error);
        window.ButterflyAccount?.showError("Could not process the image.");
    }

    avatarInput.value = "";
});

function processAvatar(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const image = new Image();

            image.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = MAX_AVATAR_SIZE;
                canvas.height = MAX_AVATAR_SIZE;

                const context = canvas.getContext("2d");
                if (!context) {
                    reject(new Error("Canvas unavailable."));
                    return;
                }

                const size = Math.min(image.width, image.height);
                const sourceX = (image.width - size) / 2;
                const sourceY = (image.height - size) / 2;

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

                resolve(canvas.toDataURL("image/jpeg", 0.85));
            };

            image.onerror = () => reject(new Error("Invalid image."));
            image.src = reader.result;
        };

        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
    });
}
