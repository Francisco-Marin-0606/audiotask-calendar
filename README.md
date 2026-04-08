<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/873da524-cf3e-45e6-b5f1-22490f811ba8

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key.
   You can get one for free at [Google AI Studio](https://aistudio.google.com/apikey).
3. Run the app:
   `npm run dev`

## AI Chat Assistant

The app includes an AI-powered chat assistant (TaskBot) that helps you organize and schedule tasks. Click the floating chat button in the bottom-right corner to open it.

**Features:**
- Natural language task planning and organization
- Automatic scheduling in available time slots
- Respects your configured work hours and days
- Always asks for confirmation before adding tasks to your calendar
