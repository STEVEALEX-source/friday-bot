riday Bot

Friday Bot is a comprehensive Node.js application combining a Slack bot built with the Bolt framework and an Express REST API. It handles interactive Slack commands, background event listening, and automated messaging endpoints secured with API key authentication.

Features

Slack Socket Mode Integration for real-time bidirectional communication without public webhook URLs
Interactive Slack Slash Commands including system status checks, text echoing, math calculations, and external profile retrieval
REST API Endpoints for triggering messages, managing broadcasts, scheduling tasks, and initiating mood checks
Rate Limited Architecture using express-rate-limit to protect API routes against abuse
CORS Support enabled for secure cross-origin resource sharing

Project Structure

src/server.js serves as the main application entry point, initializing Express, configuring middleware, setting up Slack Bolt commands, and starting the server
src/routes/api.js contains all authenticated REST API endpoints for communicating with Slack channels and tracking stats

Prerequisites

Node.js version 18 or higher installed on your system
A Slack workspace with a custom app configured and Socket Mode enabled

Environment Variables

Create a file named .env in the root directory and populate it with the following configuration values:

SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret
API_KEY=your-secure-api-key
PORT=3000
BROADCAST_CHANNELS=channel-id-one,channel-id-two

Installation and Setup

Clone the repository to your local machine
Navigate into the project directory
Install the required project dependencies by running npm install
Start the development server with live reload by running npm run dev

Available Slack Commands

/bot-status checks and returns the current system uptime and operational health
/bot-echo [text] repeats the provided text back into the Slack channel
/bot-calc [expression] evaluates a safe mathematical expression and returns the result
/bot-user fetches a sample user profile from an external public API

API Authentication

All endpoints under the /api route require an API key passed in the request headers:
X-API-Key: your-secure-api-key
