# Telegram Bot & Mini App Setup Guide

This guide explains how to set up your Telegram Bot and Mini App with BotFather.

## 1. Create the Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot`.
3. Choose a display name (for example, `Sentinel Pocket Monitor`).
4. Choose a username ending in `bot` (for example, `sentinel_pocket_dev_bot`).
5. Copy the generated HTTP API token. Place it in your `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   ```

## 2. Register the Mini App

1. In `@BotFather`, send `/newapp`.
2. Select your bot from the list.
3. Provide a title (for example, `Sentinel Pocket Cockpit`).
4. Provide a description (for example, `Mobile incident cockpit and monitoring dashboard`).
5. Upload an app icon image (640x360 px recommended).
6. When prompted for the Web App URL, enter your public HTTPS URL (for example, `https://your-domain.com` or your `ngrok` tunnel URL).
7. Choose a short name for the app (for example, `cockpit`).

## 3. Configure the Menu Button

To let users open the Mini App directly from the bottom left menu button:
1. In `@BotFather`, send `/setmenubutton`.
2. Select your bot.
3. Choose "Configure menu button".
4. Enter the button text: `Sentinel Pocket`.
5. Enter your public HTTPS URL.

## 4. Retrieve Your Telegram User ID

To restrict runbook actions to authorized operators:
1. Message [@userinfobot](https://t.me/userinfobot) on Telegram.
2. Note your numeric `Id` (for example, `987654321`).
3. Add it to `.env`:
   ```env
   ALLOWED_TELEGRAM_USERS=987654321
   ```
