# Intention Tube

A Chrome extension that helps you be more intentional about your YouTube watching habits.

## Features

- **Video Blocking**: Automatically pauses YouTube videos upon page load and implements a timer before allowing playback.
- **Intention Setting**: Prompts you to enter a reason for watching the video before proceeding.
- **User Choice**: Provides options to either continue watching or cancel after reflection.
- **History Tracking**: Keeps a record of your watching decisions and reasons.
- **Customizable Settings**: Adjust blocking duration, toggle dark mode, and more.

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension is now installed and active

## Usage

- The extension automatically activates when you visit a YouTube video page
- You'll be prompted to wait for the configured duration (default: 5 seconds)
- Enter your reason for watching the video
- Choose to either proceed with watching or cancel
- Access settings by clicking on the extension icon and selecting "Open Settings"

## Settings

- **Enable/Disable**: Toggle the extension on or off
- **Blocking Duration**: Adjust the waiting time (1-15 seconds)
- **Dark Mode**: Switch between light and dark themes
- **History**: View, export, or clear your watching history

## Development

The extension is built using standard web technologies:
- JavaScript for logic
- HTML/CSS for UI
- IndexedDB for local storage
- Chrome Extension APIs

## Files

- `manifest.json`: Extension configuration
- `popup.html/js`: Extension popup interface
- `settings.html/js`: Settings page
- `content.js`: YouTube page interaction
- `background.js`: Background processes
- `database.js`: IndexedDB operations
- `settings.js`: Settings management

## Future Enhancements

- Analytics dashboard for deeper insights into watching habits
- More customization options
- Sync settings across devices
