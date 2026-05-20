# PageTyper Chrome Web Store Listing

## Name

PageTyper

## Short Description

Turn article pages into focused typing practice with inline or overlay modes.

## Detailed Description

PageTyper helps you read and remember articles by typing along with the text directly in your browser.

Use it on article-like pages to automatically detect the main content and start a focused typing practice session. PageTyper supports a separate overlay mode as well as an experimental inline mode that lets you type over the original article text.

Features:

- Detects likely article content on the current page
- Overlay typing mode for focused practice
- Inline typing mode for typing directly over the article text
- Current, correct, and incorrect character highlighting
- Progress, WPM, accuracy, and mistake tracking
- Configurable milestone rewards every 100 correct characters
- Optional visual effects, sound, streaks, and local badges
- Local-first design with no analytics or remote code

PageTyper is built for readers, writers, students, and keyboard-heavy knowledge workers who want to turn reading into active recall and muscle memory.

## Single Purpose

PageTyper turns readable article text on the current web page into configurable typing practice.

## Category

Productivity

## Permission Justification

### storage

Used to save PageTyper settings, milestone stats, streaks, and local badges.

### tabs

Used by the popup to find the active tab and send PageTyper start/stop/settings messages to the content script.

### host access

PageTyper injects a content script on pages so it can detect article text and render the typing overlay or inline typing mode. Page text is processed locally in the browser and is not sent to a server.

## Privacy Summary

PageTyper does not collect analytics, does not run remote code, and does not transmit article text or typing stats to any server. Settings are stored with Chrome sync storage. Milestone stats and badges are stored locally.
